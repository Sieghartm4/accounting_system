/**
 * WebSocket broadcast scoping.
 *
 * The broadcast used to be:
 *
 *     wss.clients.forEach((client) => client.send(JSON.stringify({ type, data })))
 *
 * with no authentication on the handshake and no filter on delivery. Each company
 * is its own database, so one company's receipts, sales and payments were pushed
 * into another company's open browser tabs. These checks pin the two properties
 * that close it.
 *
 * The delivery rule is exported as a pure function precisely so it can be tested
 * without standing up a live server; a test that needs a real socket would be
 * skipped more often than it would run.
 */
'use strict'

const fs = require('fs')
const path = require('path')

const SRC = path.join(__dirname, '..', 'server/src')
const socket = require(path.join(SRC, 'startup/socket.startup'))

const { shouldDeliver, parseCookies } = socket

let failed = 0
const ok = (label, pass, detail) => {
  if (!pass) failed++
  console.log('  ' + (pass ? 'ok   ' : 'FAIL ') + label + (detail && !pass ? '  -> ' + detail : ''))
}
const section = (t) => console.log('\n' + t)

const aliceAcme = { dbName: 'acme_accounting', userId: 1 }
const bobAcme = { dbName: 'acme_accounting', userId: 2 }
const carolGlobex = { dbName: 'globex_accounting', userId: 3 }

section('a tenant never receives another tenant\'s event')
ok(
  'the event goes to the tenant it belongs to',
  shouldDeliver(aliceAcme, { dbName: 'acme_accounting' }) === true &&
    shouldDeliver(carolGlobex, { dbName: 'acme_accounting' }) === false,
)
ok(
  'the other tenant is refused even when it is connected',
  shouldDeliver(carolGlobex, { dbName: 'acme_accounting' }) === false,
  'a globex socket must not receive an acme event',
)
ok('the refusal is symmetric', shouldDeliver(aliceAcme, { dbName: 'acme_accounting' }) !== shouldDeliver(carolGlobex, { dbName: 'acme_accounting' }))

section('an unidentified socket receives nothing')
// A handshake in flight leaves these undefined. This is the case that let the old
// code broadcast to sockets that had never proved anything.
ok('a socket with no dbName is refused', shouldDeliver({ userId: 1 }, { dbName: 'acme_accounting' }) === false)
ok('a socket with no userId is refused', shouldDeliver({ dbName: 'acme_accounting' }, { dbName: 'acme_accounting' }) === false)
ok('an empty client object is refused', shouldDeliver({}, { dbName: 'acme_accounting' }) === false)
ok('a missing client is refused', shouldDeliver(undefined, { dbName: 'acme_accounting' }) === false)
ok('a client with no userId cannot be reached even by a userIds scope',
  shouldDeliver({ dbName: 'acme_accounting' }, { dbName: 'acme_accounting', userIds: [1] }) === false)

section('an unscoped event is refused rather than sent everywhere')
// Making dbName optional would have preserved the original leak.
ok('no scope at all is refused', shouldDeliver(aliceAcme, undefined) === false)
ok('a scope with no dbName is refused', shouldDeliver(aliceAcme, {}) === false)
ok('a scope with an empty dbName is refused', shouldDeliver(aliceAcme, { dbName: '' }) === false)
ok('a scope with a null dbName is refused', shouldDeliver(aliceAcme, { dbName: null }) === false)

section('targeting specific users')
ok('a listed user is reached', shouldDeliver(aliceAcme, { dbName: 'acme_accounting', userIds: [1] }) === true)
ok('an unlisted user in the same tenant is not',
  shouldDeliver(bobAcme, { dbName: 'acme_accounting', userIds: [1] }) === false)
ok('a userId given as a string still matches',
  shouldDeliver(aliceAcme, { dbName: 'acme_accounting', userIds: ['1'] }) === true)
ok('several users can be listed', shouldDeliver(bobAcme, { dbName: 'acme_accounting', userIds: [1, 2] }) === true)
ok('an empty userIds list means the whole tenant',
  shouldDeliver(bobAcme, { dbName: 'acme_accounting', userIds: [] }) === true)
ok('a userIds list never overrides the tenant check',
  shouldDeliver(carolGlobex, { dbName: 'acme_accounting', userIds: [1, 2, 3] }) === false)

section('cookie reading')
ok('a single cookie parses', parseCookies('a=1').a === '1')
ok('several cookies parse', parseCookies('a=1; b=2').b === '2')
ok('surrounding whitespace is trimmed', parseCookies('  a=1  ;b=2').a === '1')
ok('a value containing an equals sign survives',
  parseCookies('jwt=abc.def==').jwt === 'abc.def==')
ok('a percent-encoded value is decoded', parseCookies('sid=a%20b').sid === 'a b')
ok('a malformed value does not throw', parseCookies('sid=%E0%A4%A').sid === '%E0%A4%A')
ok('an empty header yields nothing', Object.keys(parseCookies('')).length === 0)
ok('a missing header yields nothing', Object.keys(parseCookies(undefined)).length === 0)
ok('a valueless pair is skipped', parseCookies('a=1; flag; b=2').flag === undefined)

section('the handshake refuses what it cannot verify')
const socketSrc = fs.readFileSync(path.join(SRC, 'startup/socket.startup.js'), 'utf8')
ok('a failed identity closes with 4401',
  /if \(!identity\) \{\s*\n\s*rejectUpgrade\(ws, 4401, 'Unauthorized'\)\s*\n\s*return\s*\n\s*\}/.test(socketSrc))
ok('the refusal returns before the socket is registered',
  socketSrc.indexOf('if (!identity)') < socketSrc.indexOf('registerClient(ws)'))
ok('a token without a userId is refused',
  /!Number\.isFinite\(userId\) \|\| userId <= 0 \|\| !dbName\)\s*\{[\s\S]{0,160}?return null/.test(socketSrc))
ok('a token without a dbName is refused',
  /const dbName = claims\.dbName \|\| claims\.tenantDb/.test(socketSrc))
ok('an unscoped broadcast warns and delivers nothing',
  /if \(!scope \|\| !scope\.dbName\) \{[\s\S]*?logger\.warn\([\s\S]*?\)\s*\n\s*return 0\s*\n\s*\}/.test(socketSrc),
  'the guard must warn and return before any send')
ok('the token is verified with the login secret',
  /jwt\.verify\(token, process\.env\._SECRET_KEY\)/.test(socketSrc))
ok('a cookie is accepted as a source', /readTokenFromCookie/.test(socketSrc))
ok('a query token is accepted as a fallback', /readTokenFromQuery/.test(socketSrc))

section('every broadcast call site is scoped')
const files = [
  'controller/receipt.controller.js',
  'controller/sales.controller.js',
  'controller/purchase.controller.js',
  'controller/payments.controller.js',
  'controller/collection.controller.js',
  'controller/adjustments.controller.js',
  'controller/cash_disbursement.controller.js',
  'controller/journal_entries.controller.js',
  'util/recurringJournal.util.js',
]
let total = 0
let unscoped = []
for (const f of files) {
  const src = fs.readFileSync(path.join(SRC, f), 'utf8')
  const lines = src.split(/\r?\n/)
  lines.forEach((line, idx) => {
    if (!line.includes('broadcastUpdates(')) return
    total++
    let block = line
    for (let k = idx + 1; k < Math.min(idx + 18, lines.length); k++) {
      block += '\n' + lines[k]
      if (/^\s*\)/.test(lines[k])) break
    }
    if (!/dbName|scope/.test(block)) unscoped.push(f + ':' + (idx + 1))
  })
}
ok('all ' + total + ' broadcast call sites carry a tenant scope', unscoped.length === 0, unscoped.join(', '))

section('a heartbeat exists')
// The nine subscribing pages listen only for error and close, so a socket that
// dies silently stays in the registry and every broadcast pays to write to it.
ok('a ping interval is started', /setInterval/.test(socketSrc))
ok('an unresponsive client is terminated', /client\.terminate\(\)/.test(socketSrc))
ok('liveness is tracked', /isAlive/.test(socketSrc))

console.log(failed ? '\n  ' + failed + ' failed' : '\n  all WebSocket scoping checks passed')
process.exit(failed ? 1 : 0)