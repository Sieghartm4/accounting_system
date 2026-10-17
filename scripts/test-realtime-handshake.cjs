/**
 * The realtime handshake, after the socket started refusing connections.
 *
 * Phase 0 made the handshake authenticate, which closed a cross-tenant leak but
 * also broke all nine subscribing pages. The cause was not the leak fix itself:
 *
 *   - the login response throws the JWT away (`const { token: _, ...sessionUser }
 *     = result.data`) and keeps authentication on the httpOnly session cookie
 *   - a cookie is host-scoped, so it is only sent on the upgrade when the page
 *     and VITE_SERVER_LINK share a host - which is not the case when the client
 *     is reached at localhost while the server link points at a LAN address
 *
 * So there was no credential the socket could present. The fix is a one-time
 * ticket fetched over ordinary HTTP, where `credentials: 'include'` already
 * works.
 *
 * These checks pin the handshake, the ticket's lifetime, and the fact that no
 * page constructs a socket by hand any more.
 */
'use strict'

const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')
const SERVER = path.join(ROOT, 'server/src')
const CLIENT = path.join(ROOT, 'client/src')

let failed = 0
const ok = (label, pass, detail) => {
  if (!pass) failed++
  console.log('  ' + (pass ? 'ok   ' : 'FAIL ') + label + (detail && !pass ? '  -> ' + detail : ''))
}
const section = (t) => console.log('\n' + t)
const read = (p) => fs.readFileSync(p, 'utf8')

const sock = read(path.join(SERVER, 'startup/socket.startup.js'))
const ticketRoute = read(path.join(SERVER, 'routes/realtimeTicket.routes.js'))
const startup = read(path.join(SERVER, 'startup/routes.startup.js'))
const helper = read(path.join(CLIENT, 'utils/realtimeSocket.js'))

section('the client cannot offer a token, so it uses a ticket')
ok('the login response discards the JWT',
  /const \{ token: _, \.\.\.sessionUser \} = result\.data/.test(
    read(path.join(CLIENT, 'pages/login/useLogin.js'))),
  'this is why ?token= can never work on its own')
ok('a ticket can be issued', /const issueTicket =/.test(sock))
ok('a ticket is random hex from crypto', /randomBytes\(24\)\s*\n?\s*\.toString\('hex'\)/.test(sock))
ok('a ticket is consumed on first use', /const consumeTicket =/.test(sock) && /tickets\.delete\(ticket\)/.test(sock))
ok('an expired ticket is refused', /Date\.now\(\) > entry\.expiresAt\) return null/.test(sock))
// The identity is spread in, so the assertion has to look at the spread and at
// what the route puts into it - not for literal userId/dbName inside the set call.
ok('a ticket stores the identity it was issued for',
  /tickets\.set\(ticket, \{\s*\n\s*\.\.\.identity,/.test(sock))
ok('the route issues against userId and dbName',
  /issueTicket\(\{ userId, username: ctx\.username \|\| null, dbName \}\)/.test(ticketRoute))
ok('an expired ticket is refused', /Date\.now\(\) > entry\.expiresAt\) return null/.test(sock))
ok('expired tickets are swept', /const sweepTickets = \(\) => \{[\s\S]*?if \(now > entry\.expiresAt\) tickets\.delete\(ticket\)/.test(sock))
ok('the sweep timer runs', /setInterval\(sweepTickets, TICKET_TTL_MS\)/.test(sock))

section('a presented ticket short-circuits the cookie')
// Otherwise a stale ticket could be silently masked by a valid session.
ok('the ticket is consumed before the cookie is read',
  /if \(ticket\) return ticket/.test(sock))
ok('the cookie is still a fallback', /readTokenFromCookie/.test(sock) && /queryToken/.test(sock))

section('the handshake says why it refused')
// A silent 4401 cost a round trip to diagnose.
ok('the cookie/query/ticket presence is logged',
  /\[ws\] handshake: cookie=/.test(sock))
ok('a bad token is logged', /handshake rejected: token failed verification/.test(sock))
ok('a token without identity is logged', /handshake rejected: token lacks userId or dbName/.test(sock))

section('the ticket endpoint')
ok('it exists', /realtimeTicketRouter/.test(ticketRoute))
ok('it is mounted', /app\.use\('\/realtime', realtimeTicketRouter\)/.test(startup))
ok('it is mounted above the subscription gate',
  startup.indexOf("app.use('/realtime'") < startup.indexOf('app.use(requireSubscription)'))
ok('it is mounted below auth', startup.indexOf('app.use(auth)') < startup.indexOf("app.use('/realtime'"))
ok('it fails closed without a userId and tenant',
  /!Number\.isFinite\(userId\) \|\| userId <= 0 \|\| !dbName\)/.test(ticketRoute))
ok('it returns 401 with a code', /status\(401\)/.test(ticketRoute) && /USER_REQUIRED/.test(ticketRoute))
ok('it returns no tenant data, only a ticket',
  /res\.status\(200\)\.json\(\{ success: true, ticket \}\)/.test(ticketRoute))

section('the shared client helper')
ok('it exists', helper.length > 0)
ok('it fetches a ticket per attempt', /fetchTicket\(\)/.test(helper))
ok('it uses fetchWithAuth so the session applies', /fetchWithAuth\(/.test(helper))
ok('it derives ws:// from http://', /replace\(\/\^http:\/i, 'ws:'\)/.test(helper))
ok('it derives wss:// from https://', /replace\(\/\^https:\/i, 'wss:'\)/.test(helper))
ok('it presents the ticket on the upgrade', /ticket=\$\{encodeURIComponent\(ticket\)\}/.test(helper))
ok('it reconnects on close', /addEventListener\('close'/.test(helper) && /scheduleRetry\(\)/.test(helper))
ok('reconnection backs off', /2 \*\* \(retries - 1\)/.test(helper))
ok('reconnection gives up', /retries >= maxRetries/.test(helper))
ok('a caller disconnect stops the retries', /closedByCaller = true/.test(helper))
ok('a ticket that cannot be fetched retries rather than giving up',
  /if \(!ticket\) \{[\s\S]{0,200}?scheduleRetry\(\)/.test(helper))
ok('it returns a disconnect function', /return \(\) => \{[\s\S]{0,200}?closedByCaller = true/.test(helper))

section('every subscribing page uses it')
const PAGES = [
  'pages/receipts/Receipts.jsx',
  'pages/sales/Sales.jsx',
  'pages/payments/Payments.jsx',
  'pages/purchase/Purchase.jsx',
  'pages/collections/Collections.jsx',
  'pages/disbursements/Disbursements.jsx',
  'pages/advances/Advances.jsx',
  'pages/adjustments/Adjustments.jsx',
  'pages/recurring_journals/RecurringJournals.jsx',
]
for (const p of PAGES) {
  const src = read(path.join(CLIENT, p))
  const name = path.basename(p)
  ok(name + ' imports the helper', /utils\/realtimeSocket/.test(src))
  ok(name + ' no longer builds a socket itself', !/new WebSocket/.test(src))
  ok(name + ' returns the disconnect function', /return close/.test(src))
  // A handler that references a function the hook does not export throws at
  // runtime, not at build time, so the name has to be checked against the dep list.
  const depList = (src.match(/\}, \[([^\]]*)\]\)/) || [])[1] || ''
  const called = [...src.matchAll(/connectRealtime\(\{[\s\S]{0,600}?\n\s{6}([A-Za-z_$][\w$]*)\(/g)].map((m) => m[1])
  const bad = called.filter((fn) => !depList.includes(fn))
  ok(name + ' only calls functions in its dependency array', bad.length === 0, bad.join(', '))
}

console.log(failed ? '\n  ' + failed + ' failed' : '\n  all realtime handshake checks passed')
process.exit(failed ? 1 : 0)