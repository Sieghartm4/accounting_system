const { WebSocketServer } = require('ws')
const jwt = require('jsonwebtoken')
const { logger } = require('../util/logger.util')
const { getSessionStore, getSessionCookieName } = require('./session.startup')

/**
 * Real-time channel for the accounting server.
 *
 * ## Why this authenticates
 *
 * This originally accepted every connection and pushed every event to every
 * socket:
 *
 *     wss.clients.forEach((client) => client.send(JSON.stringify({ type, data })))
 *
 * In a system where each company is its own database, that means one company's
 * receipts, sales and payments were delivered into another company's open
 * browser tabs. It was a live cross-tenant data leak, independent of anything
 * else in this file.
 *
 * ## How identity is established
 *
 * An HTTP upgrade never reaches the express-session middleware, so the cookie
 * is read and resolved against the Mongo store by hand. Two sources are
 * accepted, in order:
 *
 *   1. the session cookie - the normal path. httpOnly only stops JavaScript
 *      reading it; the browser still sends it on the upgrade request.
 *   2. a `?token=` query parameter - for deployments where the client and the
 *      server sit on different hosts, since the cookie is then scoped to the
 *      client host and never reaches the socket.
 *
 * The token is verified with the same secret the login flow uses, so the claims
 * are the ones the rest of the app already trusts: userId, username, dbName.
 *
 * A connection that resolves a token but no `userId` or `dbName` is refused.
 * That is the shape of the `_DEFAULT_API_TOKEN` development bypass, and it must
 * not be able to subscribe to a tenant's live feed.
 */

let wss = null

// Sockets that finished the handshake, keyed for lookup by user.
const clientsByUser = new Map()

const HEARTBEAT_MS = Number(process.env._WS_HEARTBEAT_MS || 30000)

/**
 * Minimal Cookie header reader.
 *
 * Hand-rolled rather than pulling in a parser: the header is a flat list of
 * name=value pairs, and a dependency added only for this would be harder to
 * justify than nine lines of splitting.
 */
const parseCookies = (header) => {
  const out = {}
  if (!header) return out
  for (const part of String(header).split(';')) {
    const eq = part.indexOf('=')
    if (eq < 0) continue
    const name = part.slice(0, eq).trim()
    if (!name) continue
    try {
      out[name] = decodeURIComponent(part.slice(eq + 1).trim())
    } catch {
      out[name] = part.slice(eq + 1).trim()
    }
  }
  return out
}

const readTokenFromCookie = (req) => {
  const name = getSessionCookieName()
  const sid = parseCookies(req.headers && req.headers.cookie)[name]
  if (!sid) return Promise.resolve(null)
  const store = getSessionStore()
  if (!store) return Promise.resolve(null)
  return new Promise((resolve) => {
    try {
      store.get(sid, (err, sess) => {
        if (err || !sess) return resolve(null)
        resolve(sess.jwt || null)
      })
    } catch {
      resolve(null)
    }
  })
}

const readTokenFromQuery = (req) => {
  try {
    const url = new URL(req.url, 'http://localhost')
    return url.searchParams.get('token')
  } catch {
    return null
  }
}

/**
 * Short-lived one-time tickets.
 *
 * The cookie path above only works when the browser sends the session cookie on
 * the upgrade, which it does not do when the page and the API are on different
 * hosts - a cookie is scoped to a host, and in development the client is often
 * reached at localhost while VITE_SERVER_LINK points at a LAN address. The
 * client cannot send the JWT instead, because the login response deliberately
 * discards it and keeps authentication on the httpOnly cookie.
 *
 * So the client asks for a ticket over normal same-origin-ish HTTP (where
 * credentials already work), then presents it on the upgrade. The ticket lives
 * for a minute and is consumed on first use, so it is not a bearer credential
 * that can be replayed from a log or browser history the way a JWT in a query
 * string would be.
 */
const tickets = new Map()
const TICKET_TTL_MS = Number(process.env._WS_TICKET_TTL_MS || 60000)

const issueTicket = (identity) => {
  const ticket = require('crypto')
    .randomBytes(24)
    .toString('hex')
  tickets.set(ticket, {
    ...identity,
    expiresAt: Date.now() + TICKET_TTL_MS,
  })
  return ticket
}

const consumeTicket = (ticket) => {
  if (!ticket) return null
  const entry = tickets.get(ticket)
  // Single use: removed whether or not it had expired.
  tickets.delete(ticket)
  if (!entry) return null
  if (Date.now() > entry.expiresAt) return null
  return { userId: entry.userId, username: entry.username, dbName: entry.dbName }
}

// Drop anything unused, so a client that never connects cannot grow the map.
const sweepTickets = () => {
  const now = Date.now()
  for (const [ticket, entry] of tickets) {
    if (now > entry.expiresAt) tickets.delete(ticket)
  }
}

/**
 * Resolve who is connecting.
 * @returns {Promise<{userId:number, username:string, dbName:string}|null>}
 */
const identify = async (req) => {
  const query = (() => {
    try {
      return new URL(req.url, 'http://localhost')
    } catch {
      return null
    }
  })()

  const ticket = consumeTicket(query && query.searchParams.get('ticket'))

  // A ticket is already proof of identity; if one was presented, do not fall
  // through to the cookie, or a stale ticket would be masked by a valid session.
  if (ticket) return ticket

  const cookieToken = await readTokenFromCookie(req)
  const queryToken = readTokenFromQuery(req)
  const token = cookieToken || queryToken

  logger.info(
    `[ws] handshake: cookie=${cookieToken ? 'yes' : 'no'} ` +
      `queryToken=${queryToken ? 'yes' : 'no'} ticket=${query ? (query.searchParams.get('ticket') ? 'present' : 'absent') : 'no-url'}`,
  )

  if (!token) return null

  let claims
  try {
    claims = jwt.verify(token, process.env._SECRET_KEY)
  } catch (err) {
    logger.warn('[ws] handshake rejected: token failed verification')
    return null
  }

  const userId = Number(claims.userId)
  const dbName = claims.dbName || claims.tenantDb

  if (!Number.isFinite(userId) || userId <= 0 || !dbName) {
    logger.warn('[ws] handshake rejected: token lacks userId or dbName')
    return null
  }

  return { userId, username: claims.username || null, dbName }
}

const rejectUpgrade = (ws, code, reason) => {
  try {
    ws.close(code, reason)
  } catch {
    try {
      ws.terminate()
    } catch {
      /* the socket is already gone */
    }
  }
}

/**
 * Start the WebSocket server on the existing HTTP server.
 * @param {http.Server} server
 */
const initWebSocket = (server) => {
  wss = new WebSocketServer({ server })

  // No `path`, so the client connects to the server root. Rejecting during the
  // upgrade rather than after it keeps unauthenticated sockets from ever being
  // registered.
  wss.on('connection', (ws, req) => {
    identify(req)
      .then((identity) => {
        if (!identity) {
          rejectUpgrade(ws, 4401, 'Unauthorized')
          return
        }

        ws.isAlive = true
        ws.userId = identity.userId
        ws.username = identity.username
        ws.dbName = identity.dbName

        ws.on('pong', () => {
          ws.isAlive = true
        })

        ws.on('error', () => {
          unregisterClient(ws)
        })

        ws.on('close', () => {
          unregisterClient(ws)
        })

        registerClient(ws)
      })
      .catch(() => rejectUpgrade(ws, 4401, 'Unauthorized'))
  })

  // Without this, a socket that vanished without a close frame (laptop lid,
  // dropped wifi, proxy timeout) stays in the registry forever and every
  // broadcast pays to write to it. Nothing on either end sends a heartbeat,
  // so the server has to initiate it.
  const heartbeat = setInterval(() => {
    wss.clients.forEach((client) => {
      if (client.readyState !== 1) return
      if (client.isAlive === false) {
        try {
          client.terminate()
        } catch {
          /* already closed */
        }
        unregisterClient(client)
        return
      }
      client.isAlive = false
      try {
        client.ping()
      } catch {
        /* already closed */
      }
    })
  }, HEARTBEAT_MS)

  if (typeof heartbeat.unref === 'function') heartbeat.unref()

  const ticketSweep = setInterval(sweepTickets, TICKET_TTL_MS)
  if (typeof ticketSweep.unref === 'function') ticketSweep.unref()
}

/** A handshake that has completed, and therefore may receive events. */
const registerClient = (ws) => {
  const key = `${ws.dbName}:${ws.userId}`
  if (!clientsByUser.has(key)) clientsByUser.set(key, new Set())
  clientsByUser.get(key).add(ws)
}

const unregisterClient = (ws) => {
  const key = `${ws.dbName}:${ws.userId}`
  const set = clientsByUser.get(key)
  if (!set) return
  set.delete(ws)
  if (set.size === 0) clientsByUser.delete(key)
}

/**
 * The delivery rule, kept pure so it can be tested without a live server.
 *
 * @param {{dbName?:string,userId?:number}} client what the socket proved
 * @param {{dbName?:string,userIds?:number[],module?:string}} scope what the event is for
 */
const shouldDeliver = (client, scope) => {
  // An unidentified socket receives nothing. A handshake that has not completed
  // leaves these undefined, and "undefined !== anything" is what keeps an
  // in-flight connection from being broadcast to.
  if (!client || !client.dbName || !client.userId) return false

  // No scope means no tenant, and an event with no tenant is one we cannot prove
  // is safe to send. Refusing is the only safe reading.
  if (!scope || !scope.dbName) return false

  if (client.dbName !== scope.dbName) return false

  if (Array.isArray(scope.userIds) && scope.userIds.length > 0) {
    return scope.userIds.some((id) => Number(id) === Number(client.userId))
  }

  return true
}

/**
 * Send an event to every authenticated socket in one tenant.
 *
 * @param {Object} data payload
 * @param {String} type event name
 * @param {{dbName:string,userIds?:number[],module?:string}} scope
 *        dbName is required. Making it optional would preserve the leak this
 *        replaced, so a caller that forgets it gets a warning and no delivery.
 */
const broadcastUpdates = (data, type, scope) => {
  if (!wss) {
    logger.warn('WebSocket not initialized, skipping broadcast.')
    return 0
  }
  if (!scope || !scope.dbName) {
    logger.warn(
      `Refusing to broadcast "${type}" without a tenant scope. ` +
        'An unscoped event cannot be proven safe to send.',
    )
    return 0
  }

  const message = JSON.stringify({ type, data })
  let delivered = 0

  wss.clients.forEach((client) => {
    if (client.readyState !== 1) return
    if (!shouldDeliver({ dbName: client.dbName, userId: client.userId }, scope)) return
    try {
      client.send(message)
      delivered++
    } catch {
      unregisterClient(client)
    }
  })

  return delivered
}

/**
 * Send an event to specific users in one tenant. Used for notifications, where
 * the whole point is that a user's activity is not broadcast back to them.
 */
const pushToUsers = (dbName, userIds, type, data) => {
  return broadcastUpdates(data, type, { dbName, userIds })
}

/** Test and diagnostics helper. */
const getRegisteredClientCount = () => {
  let total = 0
  for (const set of clientsByUser.values()) total += set.size
  return total
}

module.exports = {
  initWebSocket,
  broadcastUpdates,
  pushToUsers,
  shouldDeliver,
  parseCookies,
  identify,
  issueTicket,
  consumeTicket,
  getRegisteredClientCount,
}