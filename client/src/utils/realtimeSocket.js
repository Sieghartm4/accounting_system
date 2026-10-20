/**
 * One way to open the accounting server's WebSocket.
 *
 * Nine pages each derived the socket URL inline and connected unauthenticated.
 * Two problems with that:
 *
 *   1. The handshake now authenticates, and the session cookie only reaches the
 *      upgrade when the page and the API share a host. The client has no JWT to
 *      offer instead - the login response discards it deliberately. So the socket
 *      first asks for a short-lived, one-time ticket over normal HTTP, where
 *      `credentials: 'include'` already works.
 *   2. None of them reconnected. A socket that dropped stayed dead until the page
 *      was reloaded, and the page had no way to notice.
 *
 * Usage mirrors what the pages already do:
 *
 *     useEffect(() => {
 *       const close = connectRealtime({
 *         onMessage: (type, data) => { ... },
 *         onError: (err) => { ... },
 *       })
 *       return close
 *     }, [])
 */

import { fetchWithAuth } from './api'
import { API, SERVER } from '../api/endpoints'

const buildSocketUrl = () => {
  const serverLink = SERVER()
  if (!serverLink) return null
  // http->ws, https->wss. Deriving from the page protocol instead would break
  // behind a TLS-terminating proxy, where the page is https but the socket
  // endpoint is still plain http internally.
  return serverLink.replace(/^http:/i, 'ws:').replace(/^https:/i, 'wss:')
}

/**
 * Ask the server for a one-time handshake ticket.
 * Goes through fetchWithAuth so it uses the same session and the same
 * 401/402 handling as every other call.
 */
const fetchTicket = async () => {
  const res = await fetchWithAuth(API.realtimeTicket())
  if (!res.ok) return null
  const json = await res.json().catch(() => null)
  return json?.ticket || null
}

const OPEN = 1

/**
 * Connect, keeping the socket alive.
 * @param {{onMessage?:Function, onError?:Function, maxRetries?:number}} handlers
 * @returns {() => void} disconnect
 */
const connectRealtime = ({ onMessage, onError, maxRetries = 5 } = {}) => {
  if (typeof WebSocket === 'undefined') return () => {}

  const base = buildSocketUrl()
  if (!base) return () => {}

  let socket = null
  let closedByCaller = false
  let retries = 0
  let retryTimer = null

  const clearRetry = () => {
    if (retryTimer) {
      clearTimeout(retryTimer)
      retryTimer = null
    }
  }

  const open = async () => {
    clearRetry()
    if (closedByCaller) return

    // The ticket is what the handshake trusts when the cookie cannot make the
    // trip, so it is fetched per attempt rather than once.
    let ticket = null
    try {
      ticket = await fetchTicket()
    } catch {
      ticket = null
    }
    if (closedByCaller) return

    if (!ticket) {
      onError?.(new Error('No realtime ticket available'))
      scheduleRetry()
      return
    }

    const sep = base.includes('?') ? '&' : '?'
    socket = new WebSocket(`${base}${sep}ticket=${encodeURIComponent(ticket)}`)

    socket.addEventListener('message', (event) => {
      let payload = null
      try {
        payload = JSON.parse(event.data)
      } catch {
        return
      }
      if (payload?.type) onMessage?.(payload.type, payload.data)
    })

    socket.addEventListener('open', () => {
      retries = 0
    })

    socket.addEventListener('error', (event) => {
      // A socket we closed ourselves can still fire `error` on the way down. In
      // StrictMode every effect is mounted, unmounted and remounted, so the first
      // socket is closed while still CONNECTING - the browser reports that as
      // "closed before the connection is established", and passing it on made
      // every list page log a realtime error for a socket that was never meant to
      // survive. A genuine failure still arrives here, because in that case the
      // close was not ours.
      if (closedByCaller) return
      onError?.(event instanceof Error ? event : new Error('WebSocket error'))
    })

    socket.addEventListener('close', () => {
      // Reconnect unless the caller asked for the socket to go away. The old
      // inline handlers had no close listener at all, so a dropped socket stayed
      // dead and nothing on screen updated until a manual reload.
      if (!closedByCaller) scheduleRetry()
    })
  }

  const scheduleRetry = () => {
    if (closedByCaller || retries >= maxRetries) return
    retries += 1
    const delay = Math.min(1000 * 2 ** (retries - 1), 15000)
    clearRetry()
    retryTimer = setTimeout(open, delay)
  }

  open()

  return () => {
    closedByCaller = true
    clearRetry()
    if (socket && (socket.readyState === 0 || socket.readyState === OPEN)) {
      try {
        // 1000 is "going away". Without a code the browser logs the deliberate
        // close of a still-CONNECTING socket as a failure, which is noise the
        // page then has to swallow.
        socket.close(1000, 'client disconnect')
      } catch {
        /* already closing */
      }
    }
    socket = null
  }
}

export default connectRealtime
export { connectRealtime, buildSocketUrl, fetchTicket }