/**
 * The Balance Sheet is three columns (Assets, Liabilities, Equity) followed by a
 * verification summary. It rendered at its content height, so a tenant with a
 * handful of accounts left most of the viewport empty instead of stretching the
 * columns, unlike Trial Balance and Journal Entries which fill the screen.
 *
 * Four things had to line up, and each was broken on its own:
 *
 *   1. the page resolved to min-h-full, a minimum rather than the viewport
 *   2. the wrapper below the header used h-full, which resolves against an
 *      auto-height parent and so constrained nothing
 *   3. the column cards could not shrink inside the grid row
 *   4. the column body was capped at maxHeight 480px, which silently defeats
 *      flex-1 - the identical bug fixed on Trial Balance and Journal Entries
 *
 * This asserts the whole chain, not just one class, because any single break
 * puts the empty space straight back.
 */
'use strict'

const fs = require('fs')
const path = require('path')

const SRC = path.join(
  __dirname, '..', 'client/src/pages/reports/BalanceSheet.jsx',
)
const src = fs.readFileSync(SRC, 'utf8')

let failed = 0
const ok = (label, pass, detail) => {
  if (!pass) failed++
  console.log('  ' + (pass ? 'ok   ' : 'FAIL ') + label + (detail && !pass ? '  -> ' + detail : ''))
}
const section = (t) => console.log('\n' + t)

section('the page fills the viewport')
ok('the page resolves to the screen height, not a minimum',
  /bg-\[#F3F4F6\] h-full/.test(src) && !/bg-\[#F3F4F6\][^"]*min-h-full/.test(src))
ok('the wrapper below the header grows into the leftover space',
  /flex flex-col flex-1 min-h-0 gap-4 overflow-hidden/.test(src))
ok('the three-column grid still grows',
  /grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1 min-h-0/.test(src))

section('the columns themselves')
ok('the column card may shrink inside its grid row',
  /flex flex-col h-full min-h-0 overflow-x-auto/.test(src))
ok('the column body grows to fill the card',
  /overflow-y-auto overflow-x-auto custom-scrollbar flex-1 min-h-0/.test(src))
ok('nothing caps the column height in pixels',
  !/maxHeight: '\d+px'/.test(src),
  (src.match(/maxHeight: '\d+px'/g) || []).join(', '))
ok('the summary card keeps its own height',
  /Balance Verification Summary/.test(src) && /overflow-hidden flex-shrink-0/.test(src))

section('the className prop is actually applied')
// Section was called with className at all three call sites but never
// destructured it, so the height classes it was given were silently dropped.
ok('Section destructures className',
  /onNetIncomeClick,\s*\r?\n\s*className = '',/.test(src))
ok('Section spreads className onto its root',
  /custom-scrollbar \$\{className\}"/.test(src))
ok('no call site passes a className Section would ignore',
  (src.match(/className="min-h-0"/g) || []).length === 3)
ok('no stale className prop left over',
  !/className="h-full flex flex-col min-h-0"/.test(src))

section('the header and toolbar are unaffected')
ok('the header row is untouched',
  /flex items-center justify-between flex-wrap gap-4/.test(src))
ok('the period control is untouched',
  /border-slate-200 bg-slate-50 pl-3 pr-2 py-1\.5 shadow-sm/.test(src))

console.log(failed ? '\n  ' + failed + ' failed' : '\n  all Balance Sheet height checks passed')
process.exit(failed ? 1 : 0)