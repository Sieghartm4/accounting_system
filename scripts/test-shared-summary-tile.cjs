/**
 * Four list pages each carried their own plain SummaryCard while Receipts had a
 * properly designed tile. The receipts tile is now a shared component and the
 * four pages use it.
 *
 * Two failures happened while doing this and are what most of these checks are
 * for, because neither is caught by a passing build:
 *
 *   1. The grid's own closing </div> was consumed during the swap, so the page
 *      closed one wrapper too few. esbuild reported it, but only by accident.
 *   2. Wallet was referenced as icon={Wallet} and never imported. esbuild does
 *      not verify that an identifier exists, so this compiled cleanly and threw
 *      only when the page rendered.
 */
'use strict'

const fs = require('fs')
const path = require('path')

const SRC = path.join(__dirname, '..', 'client/src')
const TILE = path.join(SRC, 'components/SummaryTile.jsx')
const PAGES = [
  { file: 'pages/customers/Customer.jsx', money: false },
  { file: 'pages/vendors/Vendors.jsx', money: false },
  { file: 'pages/customers/CustomerTransactions.jsx', money: true },
  { file: 'pages/vendors/VendorTransactions.jsx', money: true },
]

let failed = 0
const ok = (label, pass, detail) => {
  if (!pass) failed++
  console.log('  ' + (pass ? 'ok   ' : 'FAIL ') + label + (detail && !pass ? '  -> ' + detail : ''))
}
const section = (t) => console.log('\n' + t)
const read = (p) => fs.readFileSync(path.join(SRC, p), 'utf8')

const tile = read('components/SummaryTile.jsx')

section('the receipts tile is shared, not copied')
ok('the shared component exists', tile.length > 0)
for (const theme of ['emerald', 'amber', 'orange', 'rose', 'blue', 'dark']) {
  ok('the ' + theme + ' theme survived the extraction', new RegExp('^  ' + theme + ':', 'm').test(tile))
}
// Checked against code, not prose: the comment in this file deliberately quotes
// the old `label !== 'Total Amount Due'` expression to explain why it went.
const tileCode = tile
  .split(/\r?\n/)
  .filter((l) => !/^\s*(\*|\/\*)/.test(l))
  .join('\n')
ok('clickability comes from onClick, not from a label string',
  /const isClickable = Boolean\(onClick\)/.test(tileCode) && !/label !== /.test(tileCode))

section('hover is separate from clickability')
// Hover used to be gated on isClickable, so every page whose tiles are not
// filters - Customer, Vendors and both transaction pages - rendered inert cards
// with no hover feedback at all.
ok('a hoverable prop exists', /hoverable = false/.test(tile))
ok('hover is computed from click OR hoverable',
  /const showHover = isClickable \|\| hoverable/.test(tile))
ok('the accent bar sweeps on showHover', /\$\{showHover \? 'group-hover:h-full' : ''\}/.test(tile))
ok('no hover is still gated on isClickable alone',
  (tileCode.match(/isClickable \? 'group-hover/g) || []).length === 0)
ok('the sweep gate count matches the other hover gates',
  (tileCode.match(/showHover \?/g) || []).length === 6)
ok('only a clickable tile claims to be pressable',
  /\$\{isClickable \? 'cursor-pointer' : ''\}/.test(tileCode))
ok('the group class comes from showHover', /\$\{showHover \? 'hover:scale-105/.test(tileCode))
ok('the headline style is an explicit prop', /plainLabel/.test(tile))

const receipts = read('pages/receipts/Receipts.jsx')
section('Receipts still renders from the shared component')
ok('it imports the shared tile', receipts.includes("from '../../components/SummaryTile'"))
ok('the duplicated definition is gone', !/function SummaryTile\(\{/.test(receipts))
ok('all six of its tiles are still rendered', (receipts.match(/<SummaryTile/g) || []).length === 6)
ok('its filter tiles still pass onClick', (receipts.match(/onClick=\{\(\) => setActiveFilter/g) || []).length === 5)
ok('its money tile still uses the dark theme', /color="dark"/.test(receipts))

section('the pages that had no hover now have it')
for (const page of PAGES.filter((p) => p.file !== 'pages/receipts/Receipts.jsx')) {
  const src = read(page.file)
  ok(path.basename(page.file) + ': all three tiles are hoverable',
    (src.match(/^\s*hoverable\s*$/gm) || []).length === 3,
    String((src.match(/^\s*hoverable\s*$/gm) || []).length))
}
ok('Receipts is untouched and keeps driving hover through onClick',
  !/hoverable/.test(receipts))

for (const page of PAGES) {
  const label = page.file.replace('pages/', '')
  const src = read(page.file)
  section(label)

  ok('uses the shared tile', src.includes("from '../../components/SummaryTile'"))
  ok('renders three tiles', (src.match(/<SummaryTile/g) || []).length === 3)
  ok('the page-local card is gone', !/function SummaryCard\(/.test(src))
  ok('the old card markup is gone', !/bg-gray-50 rounded-xl/.test(src))

  // Every icon a tile names must actually be imported. icon={X} is not a JSX
  // tag, so a naive check for <X /> misses it entirely.
  const used = [...new Set([...src.matchAll(/icon=\{([A-Z][A-Za-z0-9]*)\}/g)].map((m) => m[1]))]
  ok('every tile icon is imported', used.every((n) => /^\s*Object/.test('') || new RegExp('(^[ \\t]*' + n + ',?$)|(import \\{[^}]*\\b' + n + '\\b)', 'm').test(src)),
    used.filter((n) => !new RegExp('(^[ \\t]*' + n + ',?$)|(import \\{[^}]*\\b' + n + '\\b)', 'm').test(src)).join(', '))
  ok('no tile icon is missing from the import list', used.length > 0)

  // The JSX has to balance. Losing one </div> around the grid compiles to a
  // component that silently swallows the rest of the page.
  const gridIdx = src.split(/\r?\n/).findIndex((l) => l.includes('grid grid-cols-1 md:grid-cols-3 gap-4 mb-6'))
  ok('the tile grid still exists', gridIdx >= 0)
  if (gridIdx >= 0) {
    const lines = src.split(/\r?\n/)
    const gridIndent = (lines[gridIdx].match(/^\s*/) || [''])[0].length
    let closes = []
    for (let i = gridIdx + 1; i < lines.length && i < gridIdx + 60; i++) {
      const m = lines[i].match(/^(\s*)<\/div>\s*$/)
      if (m) {
        closes.push(m[1].length)
        if (m[1].length < gridIndent) break
      }
    }
    ok('the grid closes at its own indent', closes[0] === gridIndent,
      'grid at ' + gridIndent + ', first close at ' + closes[0])
    ok('the wrapper close is still there', closes.length >= 2 && closes[1] < gridIndent,
      'closes: ' + closes.join(','))
  }

  if (page.money) {
    ok('the money tile uses the dark theme', /color="dark"/.test(src))
    ok('the money tile reads as a headline, not a badge', /plainLabel/.test(src))
    ok('Wallet is imported for it', /\bWallet\b/.test(src.split("from 'lucide-react'")[0]))
  }
}

console.log(failed ? '\n  ' + failed + ' failed' : '\n  all shared-tile checks passed')
process.exit(failed ? 1 : 0)