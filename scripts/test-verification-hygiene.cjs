/**
 * Verification scripts must not leave rows in a live tenant.
 *
 * Two notifications turned up in a real tenant titled "sales MM-..." and
 * "receipts MM-..." with no link and no changes, so they could not be opened and
 * said nothing about what had happened. They were leftover rows from the
 * verification scripts, and two things allowed them to survive:
 *
 *   1. The marker was in the middle of the title ("sales MM-<ts>") while the
 *      cleanup matched it as a prefix (LIKE 'MM-%'), which does not match.
 *   2. One script threw before reaching its cleanup, so nothing was deleted.
 *
 * Both are the kind of mistake that only shows up much later, in someone else's
 * UI, so they are checked here rather than trusted.
 */
'use strict'

const fs = require('fs')
const path = require('path')

const DIR = __dirname
let failed = 0
const ok = (label, pass, detail) => {
  if (!pass) failed++
  console.log('  ' + (pass ? 'ok   ' : 'FAIL ') + label + (detail && !pass ? '  -> ' + detail : ''))
}

// This file is excluded: it quotes the very markers it forbids, so scanning
// itself always finds them.
const scripts = fs
  .readdirSync(DIR)
  .filter((f) => /^(verify-|test-).*\.cjs$/.test(f) && f !== path.basename(__filename))
  .map((f) => ({ name: f, src: fs.readFileSync(path.join(DIR, f), 'utf8') }))

// Only scripts that actually open a tenant database. Several of the suites are
// pure source inspection - they mention notifyFromController as a string and
// would otherwise be mistaken for writers.
const writers = scripts.filter((s) => /getTenantPool/.test(s.src))

console.log('\nonly scripts that touch a live database are judged')
for (const { name, src } of writers) {
  ok(`${name} reaches a tenant pool, so it is judged`, /getTenantPool/.test(src))
}

// The marker must be matchable wherever it appears in the title.
console.log('\nthe marker is matched as a substring, not a prefix')
// Comments are stripped first: these scripts explain the broken LIKE 'MM-%' in
// their own doc comment, and the documentation was failing the rule.
const stripComments = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
for (const { name, src } of writers) {
  const code = stripComments(src)
  const prefixes = code.match(/LIKE '\s*(MM|E2E|EDITPROBE)-?%/g)
  ok(`${name} does not match its marker as a prefix`, !prefixes,
    prefixes ? prefixes.join(', ') : undefined)
  if (/TESTPROBE_MARKER|EDITPROBE/.test(src)) {
      ok(`${name} wraps its marker in %...%`,
      /%\$\{tag\}%/.test(code) || /nt_title LIKE \?/.test(code))
  }
}

console.log('\nevery seeded row is findable by the marker')
// The row that leaked was seeded before the marker was added to its title, so the
// cleanup matched nothing and the finally block happily reported success. A
// marker that is not in the title is worse than no marker: it looks safe.
for (const { name, src } of writers) {
  const code = stripComments(src)
  if (!/notifyFromController\(|INSERT INTO notifications/.test(code)) continue
  const titles = [...code.matchAll(/title:s*`([^`]*)`/g)].map((m) => m[1])
  ok(`${name} puts its marker in the title it seeds`,
    !titles.length || titles.some((t) => /\$\{tag\}|\$\{MARKER\}|TESTPROBE|EDITPROBE/.test(t)),
    titles.length ? 'titles: ' + titles.join(' | ') : undefined)
}

console.log('\ncleanup cannot be skipped by a failure')
for (const { name, src } of writers) {
  const hasCleanup = /DELETE FROM notifications/.test(src)
  if (!hasCleanup) continue
  // Either a finally block, or deletes immediately after the seeding with no
  // await that can reject in between.
  const inFinally = /finally\s*\{[\s\S]*DELETE FROM notifications/.test(src)
  const deletesById = /DELETE FROM notifications WHERE nt_id IN \(\?\)|DELETE FROM notifications WHERE nt_id = \?/.test(src)
  ok(`${name} cleans up even when an assertion throws`, inFinally || deletesById,
    'a mid-test throw previously left rows behind')
  ok(`${name} verifies it removed them`,
    /remaining|no test rows left|rows left behind|rows left|cleaned up/.test(src))
}

console.log('\nno script hardcodes the old inline markers')
for (const { name, src } of writers) {
  ok(`${name} has no leftover 'MM-' or 'E2E-' literal titles`,
    !/`MM-"|'MM-'|'E2E-'/.test(src))
}

console.log(failed ? `\n  ${failed} failed` : '\n  verification scripts clean up after themselves')
process.exit(failed ? 1 : 0)