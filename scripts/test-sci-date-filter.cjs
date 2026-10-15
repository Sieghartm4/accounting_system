/**
 * The Statement of Comprehensive Income built its date filter with a leading
 * " AND " and then stripped it with .replace(' AND ', '') before placing it in
 * an ON clause. That removed the only conjunction joining the filter to the
 * join condition, producing:
 *
 *   ON je_coa_id = coa_id je_date BETWEEN ? AND ?
 *
 * With no dates the filter was an empty string, so the malformed SQL was never
 * assembled and the bug stayed hidden. It surfaced the moment the reports began
 * opening on the current month and started sending start_date/end_date.
 *
 * These checks rebuild the ON clause the way the controller does and assert the
 * conjunction is present and the placeholder count matches the params.
 */
const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')
const ctrl = fs.readFileSync(
  path.join(ROOT, 'server/src/controller/reports.controller.js'),
  'utf8',
)

// Pull the SCI handler out of the shared controller.
const start = ctrl.indexOf('const getStatementOfComprehensiveIncome')
if (start < 0) {
  console.log('  FAIL  the SCI handler was not found')
  process.exit(1)
}
const fn = ctrl.slice(start, ctrl.indexOf('\nconst getBankReconciliation', start))

let failed = 0
const ok = (label, pass) => {
  if (!pass) failed++
  console.log('  ' + (pass ? 'ok   ' : 'FAIL ') + label)
}

console.log('  Statement of Comprehensive Income date filter')

// The filter carries its own leading conjunction so it can be appended to the
// ON clause as-is.
ok('the filter is built with a leading AND', /dateFilter\s*=\s*\n?\s*' AND '\s*\+/.test(fn))

// Stripping the conjunction is what broke it. It must not appear in the SCI
// handler at all.
ok('the filter is no longer stripped of its AND', !/dateFilter\.replace\(' AND ', ''\)/.test(fn))

// Both queries place the filter in an ON clause.
const onClauseUses = (fn.match(/ON \$\{Accounting\.journal_entries\.selectOptionColumns\.coa_id\}[\s\S]{0,200}?\$\{dateFilter\}/g) || []).length
ok('both queries place the raw filter in their ON clause', onClauseUses === 2)
ok('no ON clause still uses the stripped form', !/ON[^]*?\$\{dateFilter\.replace/.test(fn))

// Placeholders must line up with the params the controller sends. The filter is
// defined once and interpolated into both queries, so there is one definition
// feeding two placeholders at runtime.
const betweenCount = (fn.match(/BETWEEN \? AND \?/g) || []).length
ok('the filter is defined once with two placeholders', betweenCount === 1)
ok(
  'two params are pushed for them',
  /queryParams\.push\(start_date, end_date\)/.test(fn),
)
ok('both queries receive the params', (fn.match(/Query\((income_statement_query|oci_query), queryParams\)/g) || []).length === 2)

// With no dates the filter is empty and the join condition stands alone, which
// is what made the bug invisible.
ok('the filter stays empty when no dates are given', /if \(start_date \|\| end_date\)/.test(fn))

// Reconstruct the ON clause both ways so the regression is legible as SQL.
const col = 'je_date'
const filter = ' AND ' + col + ' BETWEEN ? AND ?'
const broken = `je_coa_id = coa_id${filter.replace(' AND ', '')}`
const fixed = `je_coa_id = coa_id${filter}`
ok(
  'the old form ran the filter straight into the join condition',
  /je_coa_id = coa_id\s*je_date BETWEEN/.test(broken),
)
ok(
  'the fixed form reads "je_coa_id = coa_id AND je_date BETWEEN ..."',
  /je_coa_id = coa_id AND je_date BETWEEN \? AND \?/.test(fixed),
)

console.log(failed ? '  ' + failed + ' failed' : '  all SCI date-filter checks passed')
process.exit(failed ? 1 : 0)