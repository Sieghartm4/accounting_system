/**
 * A notification should open the document, not its module list.
 *
 * Clicking "Purchase PO-101626-0002 updated" used to land on the Purchase list,
 * where the document is one of many rows and the notification has told you
 * nothing you could act on.
 *
 * The header search already solves this: it navigates to `/{route}?id={id}` and
 * the module page fetches that single document and opens it in view mode. Two
 * problems made that unusable for notifications:
 *
 *   1. Every controller passed the module route with no id. Fixed centrally in
 *      buildDeepLink rather than at ~28 call sites, so no module can drift from
 *      the search routeMap.
 *   2. The controllers pass the *document reference* ("PO-101626-0002"), because
 *      that is what they title the notification with. The pages fetch by primary
 *      key. So the reference has to be translated, and the translation cannot
 *      assume a shape: some tables key on a number, receipts keys on a
 *      reference-like string, and document references are not even unique.
 */
'use strict'

const fs = require('fs')
const path = require('path')

const SRV = path.join(__dirname, '..', 'server/src')
const CLIENT = path.join(__dirname, '..', 'client/src')
const read = (p) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n')

let failed = 0
const ok = (label, pass, detail) => {
  if (!pass) failed++
  console.log('  ' + (pass ? 'ok   ' : 'FAIL ') + label + (detail && !pass ? '  -> ' + detail : ''))
}

const service = read(path.join(SRV, 'services/notification/notification.service.js'))
const header = read(path.join(CLIENT, 'components/layout/Header.jsx'))
const receipts = read(path.join(CLIENT, 'pages/receipts/Receipts.jsx'))

console.log('\nit matches the convention the header search already uses')
ok('the search navigates with ?id=', /navigate\(`\/\$\{route\}\?id=\$\{encodeURIComponent\(id\)\}`\)/.test(header))
ok('the page reads it', /searchParams\.get\('id'\)/.test(receipts))
ok('the page fetches that single document', /\/receipt\/\$\{id\}`/.test(receipts))
ok('the service builds the same shape',
  service.includes("}id=${encodeURIComponent(documentId)}"))

console.log('\nevery module can be deep-linked')
for (const [module, route] of [
  ['receipts', 'receipts'],
  ['sales', 'sales'],
  ['purchase', 'purchase'],
  ['collection', 'collections'],
  ['disbursement', 'disbursement'],
  ['payments', 'payments'],
  ['adjustments', 'adjustments'],
]) {
  ok(`${module} resolves to /${route}`,
    new RegExp(`${module}: '${route}'`).test(service),
    'collection is the one that differs, which is why it is written out')
}

console.log('\nthe reference is translated to the primary key')
ok('both columns are matched', /WHERE \$\{target\.id\} = \? OR TRIM\(\$\{target\.ref\}\) = \?/.test(service))
ok('an exact primary key hit wins',
  /const exact = rows\.filter\(\(row\) => String\(row\[target\.id\]\) === value\)/.test(service))
// Not an optimisation - the tenant this was built against has one receipt
// reference repeated eight times, so a reference hit can be a coin flip.
ok('an ambiguous reference refuses to guess',
  /if \(rows\.length > 1\) \{[\s\S]{0,160}?return null/.test(service),
  'opening the wrong document is worse than opening the list')
ok('it fetches two rows so ambiguity is detectable', /LIMIT 2/.test(service))
ok('a whitespace-only reference is not a reference', /if \(!value\) return null/.test(service))

console.log('\nit degrades to the module page rather than to nothing')
ok('a module with no table mapping appends nothing', /if \(!target\) return null/.test(service))
ok('an unresolvable id keeps the plain module route', /if \(!documentId\) return base/.test(service))
ok('an authored deep link is left alone', /if \(\/\[\?&\]id=\/\.test\(base\)\) return base/.test(service))
ok('a missing link is derived from the module', /link \|\| \(route \? `\/\$\{route\}` : null\)/.test(service))

console.log('\nthe deep link is computed once and used twice')
ok('createNotification resolves it', /v\.link = await buildDeepLink\(/.test(service))
ok('createAndNotify resolves it for the push too',
  (service.match(/v\.link = await buildDeepLink\(/g) || []).length === 2,
  'the pushed payload is built from a second normalisation and would drift')
ok('and hands the resolved link down so it is not resolved twice',
  /createNotification\(\{ \.\.\.input, link: v\.link \}\)/.test(service))

console.log(failed ? `\n  ${failed} failed` : '\n  notifications open the document they are about')
process.exit(failed ? 1 : 0)