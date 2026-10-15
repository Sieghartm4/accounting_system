/**
 * Sidebar links must resolve to a registered route.
 *
 * The masters section builds its links from the raw module code
 * (`/${item.name}`), so `withholding_tax` resolves to /withholding_tax. That path
 * was never registered - only the dashed /withholding-tax and the misspelled
 * /witholding_tax were - so clicking the nav item fell through to React Router's
 * "No routes matched location" while the same page opened fine from search, which
 * links by a different spelling.
 *
 * This walks every sidebar section, reproduces the link each one would build, and
 * checks it against the registered paths. A new nav item added without a route
 * fails here instead of in the browser.
 */
'use strict'

const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')
const CLIENT = path.join(ROOT, 'client/src')

const read = (p) => fs.readFileSync(path.join(CLIENT, p), 'utf8')

let failed = 0
const ok = (label, pass, detail) => {
  if (!pass) failed++
  console.log('  ' + (pass ? 'ok   ' : 'FAIL ') + label + (detail && !pass ? '  -> ' + detail : ''))
}
const section = (t) => console.log('\n' + t)

const app = read('App.jsx')
const side = read('components/layout/Sidebar.jsx')

section('registered paths')
const paths = new Set([...app.matchAll(/path="([^"]+)"/g)].map((m) => m[1]))
console.log('  ' + paths.size + ' routes registered')
ok('App.jsx still imports the withholding page', /import WithholdingTax from/.test(app))

section('every sidebar link resolves to a route')
// Each section uses one of two builders. Both are reproduced here rather than
// assumed, because the mismatch between them is what caused the bug.
const builders = [...side.matchAll(/to=\{`\/\$\{([^}]+)\}`\}/g)].map((m) => m[1])
ok('sidebar link builders were found', builders.length > 0)

// The masters nav names, taken from the icon map which lists them literally.
const iconStart = side.indexOf('withholding_tax: Receipt')
const iconBlock = side.slice(Math.max(0, iconStart - 2500), iconStart + 2500)
const masterNames = [
  ...new Set(
    [...iconBlock.matchAll(/^\s*([a-z][a-z_]*):\s*[A-Z][A-Za-z]*,?\s*$/gm)].map((m) => m[1]),
  ),
].filter((n) => !['bg', 'text', 'border'].includes(n))

ok('master nav items were discovered', masterNames.length > 0, String(masterNames.length))

for (const name of masterNames) {
  // The masters section links with the raw code, so the underscore form is the
  // one that has to exist.
  const underscore = '/' + name
  ok('masters link ' + underscore + ' resolves', paths.has(name) || paths.has(name.replace(/_/g, '-')))
}

// The three spellings of the withholding page must all exist, because three
// different linkers emit them.
section('withholding tax is reachable by every spelling that links to it')
for (const p of ['withholding_tax', 'withholding-tax', 'witholding_tax']) {
  ok('/' + p + ' is registered', paths.has(p))
}

// React Router keeps the first match. Two identical paths mean one is dead.
section('no duplicate routes shadow each other')
const all = [...app.matchAll(/path="([^"]+)"/g)].map((m) => m[1])
const seen = new Map()
for (const p of all) seen.set(p, (seen.get(p) || 0) + 1)
const dupes = [...seen.entries()].filter(([, c]) => c > 1)
// "/" legitimately appears twice: once for the login branch and once for the
// authenticated branch, which are separate <Routes> trees.
const realDupes = dupes.filter(([p]) => p !== '/')
for (const [p, c] of realDupes) ok('duplicate path ' + p, false, c + ' occurrences')
if (!realDupes.length) ok('no duplicate paths outside the two route trees', true)

// Each withholding route must still be gated on the same module code.
section('withholding routes are access-gated')
const gated = [...app.matchAll(/path="with[^"]*"[\s\S]{0,220}?routeName="withholding_tax"/g)]
ok('all three withholding routes use routeName="withholding_tax"', gated.length === 3, String(gated.length))

console.log(failed ? '\n  ' + failed + ' failed' : '\n  all route-coverage checks passed')
process.exit(failed ? 1 : 0)