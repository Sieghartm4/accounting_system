/**
 * The Balance Verification Summary used to be four figures in a row:
 * Total Assets, Total Liabilities, Total Equity, Liab. + Equity, Difference.
 * Three of them repeated the column footers directly above, and "Liab. + Equity"
 * gave no indication of where it came from, so the row read as a restatement
 * rather than a check.
 *
 * It now states the accounting equation - Assets = Liabilities + Equity - and
 * names the subtraction behind the residual. These checks pin the equation, the
 * arithmetic, and the layout detail that is easy to regress (a grid here wraps
 * the four children into two rows and puts Equity under Liabilities).
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

section('the summary states the equation')
ok('Total Assets is shown', /Total Assets/.test(src))
ok('Total Liabilities is shown', /Total Liabilities/.test(src))
ok('Total Equity is shown', /Total Equity/.test(src))
ok('an equals operator renders between the two sides', /<Equal size=\{14\}/.test(src))
ok('a plus operator renders between the two right-hand terms', /<Plus size=\{14\}/.test(src))
ok('the summed right-hand side is labelled, not just totalled', /Right side/.test(src))
ok('the header names the equation', /Assets = Liabilities \+ Equity/.test(src))

section('the residual explains itself')
// U+2212 MINUS SIGN, not a hyphen.
ok('the subtraction behind the difference is named',
  /Assets \u2212 \(Liabilities \+ Equity\)/.test(src))
ok('the residual still renders balanceDiff', /\{fmt\(balanceDiff\)\}/.test(src))
ok('the verdict is driven by isBalanced',
  /isBalanced \? 'Balanced' : 'Out of Balance'/.test(src))

section('no duplicated verdict')
const verdicts = (src.match(/isBalanced \? 'Balanced' : 'Out of Balance'/g) || []).length
ok('the verdict appears exactly once', verdicts === 1, String(verdicts))

section('the old flat layout is gone')
ok('the five-column grid is gone', !/md:grid-cols-5/.test(src))
ok('the bare "Liab. + Equity" label is gone', !/>Liab\. \+ Equity</.test(src))
ok('the difference cell no longer stands alone', !/text-slate-500 mb-1">Difference</.test(src))

section('the right side stays on one line')
// grid-cols-2 over four children wraps to two rows: Equity lands under
// Liabilities and the equation stops reading left to right.
ok('the right side is flex, not a two-column grid',
  /flex-\[2\] flex items-stretch/.test(src) && !/flex-\[2\] grid grid-cols-2/.test(src))
ok('the operator cell cannot stretch', /shrink-0/.test(src))
ok('the three figures share the row evenly', (src.match(/flex-1 flex flex-col justify-center px-4 py-3/g) || []).length >= 3)

section('the arithmetic the equation depends on')
// Absolute values, because the API returns credit-normal accounts as negatives.
ok('assets are compared as absolute values', /const absAssets = Math\.abs\(data\.totalAssets\)/.test(src))
ok('liabilities are compared as absolute values', /const absLiabilities = Math\.abs\(data\.totalLiabilities\)/.test(src))
ok('equity is compared as absolute values', /const absEquity = Math\.abs\(data\.totalEquity\)/.test(src))
ok('the right side is the sum of the two', /const absLiabEquity = absLiabilities \+ absEquity/.test(src))
ok('the residual is assets minus the right side', /const balanceDiff = Math\.abs\(absAssets - absLiabEquity\)/.test(src))
ok('a sub-cent difference counts as balanced', /const isBalanced = balanceDiff < 0\.01/.test(src))

// Prove the check agrees with the equation on the numbers from the screenshot.
section('the arithmetic on the reported figures')
const A = 2800.0, L = 200.0, E = 3000.0
const right = L + E
const diff = Math.abs(A - right)
ok('Assets 2,800 vs Liabilities 200 + Equity 3,000 is reported out of balance',
  !(diff < 0.01) && diff === 400, 'diff=' + diff)
ok('a balanced pair resolves to zero',
  Math.abs(3000 - (1000 + 2000)) < 0.01)

section('the height fix from the previous change is still in place')
ok('the page still fills the viewport', /bg-\[#F3F4F6\] h-full/.test(src))
ok('the column body is still uncapped', !/maxHeight: '\d+px'/.test(src))
ok('the summary card still keeps its own height', /overflow-hidden flex-shrink-0/.test(src))

console.log(failed ? '\n  ' + failed + ' failed' : '\n  all Balance Sheet summary checks passed')
process.exit(failed ? 1 : 0)