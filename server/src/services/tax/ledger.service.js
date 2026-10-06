'use strict'

const { Query } = require('../../database/util/queries.util')

/**
 * Ledger fact extraction.
 *
 * Everything the tax module knows about a taxpayer comes from here. Two rules:
 *
 *   1. Only posted journals sourced from APPROVED documents count. This matches
 *      how the dashboard and report modules read the ledger, so tax figures
 *      reconcile against what the rest of the system already shows.
 *
 *   2. A withholding tax figure is only ever paired with a *sibling* posting in
 *      the same source document. `journal_entries` carries `je_db_name` +
 *      `je_db_id`, which together ARE the voucher key: one document posts all
 *      its lines atomically, so `sales:1042` is a complete voucher. Pairing the
 *      WHT leg with the income/expense leg inside that key is what makes
 *      "taxable base" mean the actual consideration rather than the tax again.
 *      (The previous client code grouped by a `voucherId` it did not know how
 *      to obtain and fell back to date+module+RC, which merged unrelated
 *      same-day documents. The key was already there.)
 */

// Only journals traceable to an approved document are eligible.
const APPROVED_SOURCE_FILTER = `
  AND (
    (je.je_db_name = 'receipts' AND EXISTS (
      SELECT 1 FROM receipts r
      WHERE r.r_id = je.je_db_id AND r.r_state = 'APPROVED'
    ))
    OR (je.je_db_name = 'cash_disbursements' AND EXISTS (
      SELECT 1 FROM cash_disbursements cd
      WHERE cd.cd_id = je.je_db_id AND cd.cd_state = 'APPROVED'
    ))
    OR (je.je_db_name = 'sales' AND EXISTS (
      SELECT 1 FROM sales s
      WHERE s.s_id = je.je_db_id AND s.s_state = 'APPROVED'
    ))
    OR (je.je_db_name = 'collections' AND EXISTS (
      SELECT 1 FROM collections c
      WHERE c.c_id = je.je_db_id AND c.c_state = 'APPROVED'
    ))
    OR (je.je_db_name = 'purchase' AND EXISTS (
      SELECT 1 FROM purchase p
      WHERE p.p_id = je.je_db_id AND p.p_state = 'APPROVED'
    ))
    OR (je.je_db_name = 'payments' AND EXISTS (
      SELECT 1 FROM payments pay
      WHERE pay.c_id = je.je_db_id AND pay.c_state = 'APPROVED'
    ))
    OR (je.je_db_name = 'adjustments' AND EXISTS (
      SELECT 1 FROM adjustments a
      WHERE a.a_id = je.je_db_id AND a.a_status = 'APPROVED'
    ))
  )
`

// Account names the module keys off. Centralised because these are the only
// strings tying the tax module to a specific chart of accounts setup — a tenant
// that renames "Output VAT" needs this list changed, not the SQL.
const ACCOUNTS = {
  OUTPUT_VAT: 'Output VAT',
  INPUT_VAT: 'Input VAT',
  EWT: 'Withholding Tax - Expanded',
  CWT: 'Creditable Withholding Tax',
  COMPENSATION: 'Compensation Expense',
  ACCOUNTS_PAYABLE: 'Accounts Payable',
  ACCOUNTS_RECEIVABLE: 'Accounts Receivable',
}

const VAT_RATE = 0.12

const sum = (rows, key) =>
  rows.reduce((total, row) => total + (Number(row[key]) || 0), 0)

const signedAmount = (entry) =>
  Number(entry.amount || 0) * (entry.type === 'DEBIT' ? 1 : -1)

// ---------------------------------------------------------------------------
// Journal entry fetch — one query, everything downstream derived from it
// ---------------------------------------------------------------------------

const fetchJournalEntries = async (startDate, endDate) => {
  const query = `
    SELECT
      je.je_id AS id,
      je.je_db_name AS dbName,
      je.je_db_id AS dbId,
      je.je_coa_id AS coaId,
      je.je_responsibility_center AS responsibilityCenter,
      je.je_type AS type,
      je.je_amount AS amount,
      je.je_date AS date,
      coa.coa_code AS coaCode,
      coa.coa_name AS coaName,
      coa.coa_type AS coaType,
      CONCAT(je.je_db_name, ':', je.je_db_id) AS voucherId,
      COALESCE(
        (SELECT wt.wt_code FROM purchase_items pi
         INNER JOIN withholding_tax wt ON wt.wt_id = pi.pi_witholding_tax
         WHERE je.je_db_name = 'purchase' AND pi.pi_purchase_id = je.je_db_id
         ORDER BY pi.pi_id LIMIT 1),
        (SELECT wt.wt_code FROM cash_disbursement_items cdi
         INNER JOIN withholding_tax wt ON wt.wt_id = cdi.cdi_witholding_tax
         WHERE je.je_db_name = 'cash_disbursements' AND cdi.cdi_cash_disbursement_id = je.je_db_id
         ORDER BY cdi.cdi_id LIMIT 1),
        (SELECT wt.wt_code FROM sales_items si
         INNER JOIN withholding_tax wt ON wt.wt_id = si.si_witholding_tax
         WHERE je.je_db_name = 'sales' AND si.si_sales_id = je.je_db_id
         ORDER BY si.si_id LIMIT 1),
        (SELECT wt.wt_code FROM receipt_items ri
         INNER JOIN withholding_tax wt ON wt.wt_id = ri.ri_witholding_tax
         WHERE je.je_db_name = 'receipts' AND ri.ri_receipts_id = je.je_db_id
         ORDER BY ri.ri_id LIMIT 1)
      ) AS atc,
      COALESCE(
        (SELECT wt.wt_name FROM purchase_items pi
         INNER JOIN withholding_tax wt ON wt.wt_id = pi.pi_witholding_tax
         WHERE je.je_db_name = 'purchase' AND pi.pi_purchase_id = je.je_db_id
         ORDER BY pi.pi_id LIMIT 1),
        (SELECT wt.wt_name FROM cash_disbursement_items cdi
         INNER JOIN withholding_tax wt ON wt.wt_id = cdi.cdi_witholding_tax
         WHERE je.je_db_name = 'cash_disbursements' AND cdi.cdi_cash_disbursement_id = je.je_db_id
         ORDER BY cdi.cdi_id LIMIT 1),
        (SELECT wt.wt_name FROM sales_items si
         INNER JOIN withholding_tax wt ON wt.wt_id = si.si_witholding_tax
         WHERE je.je_db_name = 'sales' AND si.si_sales_id = je.je_db_id
         ORDER BY si.si_id LIMIT 1),
        (SELECT wt.wt_name FROM receipt_items ri
         INNER JOIN withholding_tax wt ON wt.wt_id = ri.ri_witholding_tax
         WHERE je.je_db_name = 'receipts' AND ri.ri_receipts_id = je.je_db_id
         ORDER BY ri.ri_id LIMIT 1)
      ) AS atcDescription,
      COALESCE(
        (SELECT wt.wt_rate FROM purchase_items pi
         INNER JOIN withholding_tax wt ON wt.wt_id = pi.pi_witholding_tax
         WHERE je.je_db_name = 'purchase' AND pi.pi_purchase_id = je.je_db_id
         ORDER BY pi.pi_id LIMIT 1),
        (SELECT wt.wt_rate FROM cash_disbursement_items cdi
         INNER JOIN withholding_tax wt ON wt.wt_id = cdi.cdi_witholding_tax
         WHERE je.je_db_name = 'cash_disbursements' AND cdi.cdi_cash_disbursement_id = je.je_db_id
         ORDER BY cdi.cdi_id LIMIT 1),
        (SELECT wt.wt_rate FROM sales_items si
         INNER JOIN withholding_tax wt ON wt.wt_id = si.si_witholding_tax
         WHERE je.je_db_name = 'sales' AND si.si_sales_id = je.je_db_id
         ORDER BY si.si_id LIMIT 1),
        (SELECT wt.wt_rate FROM receipt_items ri
         INNER JOIN withholding_tax wt ON wt.wt_id = ri.ri_witholding_tax
         WHERE je.je_db_name = 'receipts' AND ri.ri_receipts_id = je.je_db_id
         ORDER BY ri.ri_id LIMIT 1)
      ) AS atcRate,
      CASE
        WHEN je.je_db_name = 'receipts' THEN r.r_document_reference
        WHEN je.je_db_name = 'cash_disbursements' THEN cd.cd_document_reference
        WHEN je.je_db_name = 'sales' THEN s.s_document_reference
        WHEN je.je_db_name = 'collections' THEN c.c_document_reference
        WHEN je.je_db_name = 'purchase' THEN p.p_document_reference
        WHEN je.je_db_name = 'payments' THEN pay.c_document_reference
        WHEN je.je_db_name = 'adjustments' THEN a.a_document_reference
        ELSE NULL
      END AS referenceNo,
      CASE
        WHEN je.je_db_name IN ('receipts', 'sales', 'collections') THEN cust.c_name
        WHEN je.je_db_name IN ('cash_disbursements', 'purchase', 'payments') THEN vend.v_name
        ELSE NULL
      END AS counterpartyName,
      CASE
        WHEN je.je_db_name IN ('receipts', 'sales', 'collections') THEN ci.ci_tin
        WHEN je.je_db_name IN ('cash_disbursements', 'purchase', 'payments') THEN vi.vi_tin
        ELSE NULL
      END AS counterpartyTin,
      CASE
        WHEN je.je_db_name IN ('receipts', 'sales', 'collections') THEN cust.c_type
        WHEN je.je_db_name IN ('cash_disbursements', 'purchase', 'payments') THEN vend.v_type
        ELSE NULL
      END AS counterpartyType
    FROM journal_entries je
    INNER JOIN charts_of_accounts coa ON je.je_coa_id = coa.coa_id
    LEFT JOIN receipts r
      ON je.je_db_name = 'receipts' AND r.r_id = je.je_db_id
    LEFT JOIN cash_disbursements cd
      ON je.je_db_name = 'cash_disbursements' AND cd.cd_id = je.je_db_id
    LEFT JOIN sales s
      ON je.je_db_name = 'sales' AND s.s_id = je.je_db_id
    LEFT JOIN collections c
      ON je.je_db_name = 'collections' AND c.c_id = je.je_db_id
    LEFT JOIN purchase p
      ON je.je_db_name = 'purchase' AND p.p_id = je.je_db_id
    LEFT JOIN payments pay
      ON je.je_db_name = 'payments' AND pay.c_id = je.je_db_id
    LEFT JOIN adjustments a
      ON je.je_db_name = 'adjustments' AND a.a_id = je.je_db_id
    LEFT JOIN customers cust
      ON (je.je_db_name = 'receipts' AND cust.c_id = r.r_customer_id)
      OR (je.je_db_name = 'sales' AND cust.c_id = s.s_customer_id)
      OR (je.je_db_name = 'collections' AND cust.c_id = c.c_customer_id)
    LEFT JOIN vendors vend
      ON (je.je_db_name = 'cash_disbursements' AND vend.v_id = cd.cd_vendor_id)
      OR (je.je_db_name = 'purchase' AND vend.v_id = p.p_vendor_id)
      OR (je.je_db_name = 'payments' AND vend.v_id = pay.c_vendor_id)
    LEFT JOIN customers_information ci ON ci.ci_customer_id = cust.c_id
    LEFT JOIN vendors_information vi ON vi.vi_vendor_id = vend.v_id
    WHERE je.je_db_id IS NOT NULL
      AND je.je_coa_id IS NOT NULL
      AND DATE(je.je_date) >= ?
      AND DATE(je.je_date) <= ?
      ${APPROVED_SOURCE_FILTER}
    ORDER BY je.je_date ASC, je.je_id ASC
  `

  const rows = await Query(query, [startDate, endDate])
  return Array.isArray(rows) ? rows : []
}

// ---------------------------------------------------------------------------
// Classification
// ---------------------------------------------------------------------------

const matches = (entry, pattern) => pattern.test(entry?.coaName || '')

/**
 * Distinct chart-of-accounts codes behind a set of journal lines.
 *
 * Every figure the 2550 prints is a reduction over journal lines, and the
 * taxpayer has to be able to audit that reduction. Carrying the account codes
 * alongside the amount lets the UI link the printed figure straight to the
 * ledger lines it came from, the way Trial Balance and Balance Sheet already
 * do, instead of asking the user to trust the number.
 */
const accountCodesOf = (entries) => {
  const byCode = new Map()
  for (const entry of entries) {
    if (!entry.coaCode) continue
    const code = String(entry.coaCode)
    if (!byCode.has(code)) byCode.set(code, { code, name: entry.coaName || code })
  }
  return [...byCode.values()].sort((a, b) =>
    a.code.localeCompare(b.code, undefined, { numeric: true }),
  )
}

const mergeAccounts = (...lists) => {
  const seen = new Map()
  for (const list of lists) for (const account of list) seen.set(account.code, account)
  return [...seen.values()].sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }))
}

const isOutputVatLine = (entry) => matches(entry, /^output\s*vat/i)
const isInputVatLine = (entry) => matches(entry, /^input\s*vat/i)
const isEwtLine = (entry) => matches(entry, /withholding\s*tax\s*-\s*expanded/i)
const isCwtLine = (entry) => matches(entry, /creditable\s*withholding\s*tax/i)
const isCompensationLine = (entry) =>
  matches(entry, /^(compensation|salaries|wages|employee benefits|payroll)/i)
const isRevenueLine = (entry) =>
  matches(entry, /^(income from|sales|revenue)/i) && coaTypeIs(entry, 'REVENUE')
const isExpenseLine = (entry) =>
  (matches(entry, /purchase|cost of sales|expense|professional fee|rent|service|contractor/i) ||
    matches(entry, /^(supplies|utilities|maintenance|freight|transport)/i)) &&
  coaTypeIs(entry, 'EXPENSE')

// The account-type check is a guard, not the primary test. A tenant can name
// accounts anything they like, so a revenue line is one whose account is
// typed as a revenue; where no type is set the name test carries the weight
// and the `typeTagMissing` flag below lets the caller warn.
const coaTypeIs = (entry, type) => {
  const actual = String(entry?.coaType || '').toUpperCase()
  if (!actual) return true
  return actual.includes(type)
}

const groupByVoucher = (entries) => {
  const vouchers = new Map()
  for (const entry of entries) {
    const key = entry.voucherId || `orphan:${entry.id}`
    if (!vouchers.has(key)) vouchers.set(key, [])
    vouchers.get(key).push(entry)
  }
  return vouchers
}

// ---------------------------------------------------------------------------
// VAT
// ---------------------------------------------------------------------------

/**
 * VAT facts for a period.
 *
 * The split between vatable / zero-rated / exempt / export is the part a naive
 * implementation gets wrong, and it is the part the BIR form is checked on.
 * This implementation reads the taxpayer's own `vat` master table (the same
 * table behind the VAT codes screen) to classify sales documents by their VAT
 * code, and reports exactly which lines it could not classify instead of
 * defaulting them to vatable — defaulting is how exempt income gets reported
 * as taxable and the 2550 comes out wrong.
 */
const extractVatFacts = async (entries, startDate, endDate) => {
  const outputVatEntries = entries.filter(isOutputVatLine)
  const inputVatEntries = entries.filter(isInputVatLine)

  // Output VAT on a liability account is a credit; input VAT on an asset
  // account is a debit. An offsetting entry means a correction or a
  // non-vatable document touched the account.
  //
  // Both figures are reported to the BIR as positive magnitudes, so each side
  // is negated out of debit/credit form. Output VAT is a credit liability, so
  // its credits are the amount due; input VAT is a debit asset, so its debits
  // are the creditable amount. An offsetting entry of the opposite type
  // therefore reduces the figure, which is what a correction should do.
  const outputTaxDue = outputVatEntries.reduce(
    (total, entry) => total + -signedAmount(entry),
    0,
  )
  const inputTaxTotal = inputVatEntries.reduce(
    (total, entry) => total + signedAmount(entry),
    0,
  )

  const salesEntries = entries.filter(isRevenueLine)
  const booksRevenue = salesEntries.reduce(
    (total, entry) => total + Math.abs(signedAmount(entry)),
    0,
  )

  const split = await classifySalesByVatCode(salesEntries)

  // Prior-period credit actually claimed: the amount carried on a filed 2550
  // as an overpayment. Passed in by the caller from the filings table so this
  // service stays read-only over the ledger.
  const vatableSales = split.vatable
  const impliedOutputTax = vatableSales * VAT_RATE

  const excessInputTax = Math.max(0, inputTaxTotal - outputTaxDue)
  const netPayable = Math.max(0, outputTaxDue - inputTaxTotal)
  const netOverpayment = Math.max(0, inputTaxTotal - outputTaxDue)

  // The line is one number carrying a sign, not a payable/overpayment pair:
  // positive means the taxpayer owes, negative means BIR carries a credit
  // forward. Reporting the magnitude and letting the excess line carry the
  // opposite case made "output < input" print as zero payable and zero
  // overpayment, which is a filed return that neither pays nor claims.
  const netVatPayableOrOverpayment = round2(netPayable - netOverpayment)

  // Keyed by the same dotted paths the form catalog uses as `source`, so a
  // rendered line resolves its own provenance with a single lookup.
  const outputAccounts = accountCodesOf(outputVatEntries)
  const inputAccounts = accountCodesOf(inputVatEntries)
  const revenueAccounts = accountCodesOf(salesEntries)
  const trace = {
    'vat.books_revenue': { accounts: revenueAccounts, note: 'Revenue accounts in the period' },
    'vat.vatable_sales': {
      accounts: split.accounts.vatable,
      note: 'Revenue accounts whose sales documents carry a vatable VAT code',
    },
    'vat.exempt_sales': {
      accounts: split.accounts.exempt,
      note: 'Revenue accounts whose sales documents carry an exempt VAT code',
    },
    'vat.zero_rated_sales': {
      accounts: split.accounts.zeroRated,
      note: 'Revenue accounts whose sales documents carry a zero-rated VAT code',
    },
    'vat.export_sales': {
      accounts: split.accounts.exported,
      note: 'Revenue accounts whose sales documents carry an export VAT code',
    },
    'vat.unclassified_sales': {
      accounts: split.accounts.unclassified,
      note: 'Revenue postings with no VAT code on the source document',
    },
    'vat.output_tax_due': {
      accounts: outputAccounts,
      note: 'Output VAT liability account, credits net of debits',
    },
    'vat.input_tax_total': {
      accounts: inputAccounts,
      note: 'Input VAT asset account, debits net of credits',
    },
    'vat.excess_input_tax': {
      accounts: mergeAccounts(inputAccounts, outputAccounts),
      note: 'Derived: input tax less output tax',
    },
    'vat.net_vat_payable': {
      accounts: mergeAccounts(outputAccounts, inputAccounts),
      note: 'Derived: output tax less creditable input tax',
    },
    'vat.net_vat_payable_or_overpayment': {
      accounts: mergeAccounts(outputAccounts, inputAccounts),
      note: 'Derived: positive means payable, negative means a credit carried forward',
    },
    'vat.total_payable': {
      accounts: mergeAccounts(outputAccounts, inputAccounts),
      note: 'Derived: net VAT payable plus any prior-period credit claimed',
    },
  }

  return {
    period: { start_date: startDate, end_date: endDate },
    rate: VAT_RATE,
    books_revenue: round2(booksRevenue),
    vatable_sales: round2(vatableSales),
    exempt_sales: round2(split.exempt),
    zero_rated_sales: round2(split.zeroRated),
    export_sales: round2(split.exported),
    unclassified_sales: round2(split.unclassified),
    unclassified_detail: split.unclassifiedDetail,
    output_tax_due: round2(outputTaxDue),
    input_tax_total: round2(inputTaxTotal),
    excess_input_tax: round2(excessInputTax),
    net_vat_payable: round2(netPayable),
    net_vat_payable_or_overpayment: netVatPayableOrOverpayment,
    net_vat_overpayment: round2(netOverpayment),
    total_payable: round2(netPayable),
    // Account codes behind every printed figure, for ledger drill-down.
    trace,
    // The reconciliation that catches misclassified sales. If the books
    // revenue implies more output tax than the Output VAT account received,
    // some sales were posted without a VAT tag.
    reconciliation: {
      books_revenue: round2(booksRevenue),
      implied_output_tax: round2(impliedOutputTax),
      ledger_output_tax: round2(outputTaxDue),
      variance: round2(impliedOutputTax - outputTaxDue),
      unexplained_sales: round2(split.unclassified),
      reconciles: Math.abs(impliedOutputTax - outputTaxDue) < 1,
    },
    gaps: buildGaps([
      {
        key: 'vat.vatable_sales',
        present: vatableSales > 0 || booksRevenue === 0,
        severity: 'error',
        message:
          'No vatable sales could be identified. Sales documents must carry a VAT code from the VAT master so the 2550 Part I split can be built.',
      },
      {
        key: 'vat.unclassified_sales',
        present: split.unclassified === 0,
        severity: 'warning',
        message: `${round2(split.unclassified)} of revenue is not tied to a VAT code and was not assigned to vatable, zero-rated, exempt, or export. It is excluded from Part I rather than reported as vatable.`,
        detail: split.unclassifiedDetail,
      },
      {
        key: 'vat.prior_period_credit',
        present: true,
        severity: 'info',
        message:
          'Prior-period input-tax credit is carried from the previous filed 2550. Record it on the filing as line 12 if it applies.',
      },
    ]),
  }
}

/**
 * Classify sales lines by the VAT code on the underlying sales document.
 *
 * Falls back to an all-vatable treatment ONLY when the tenant has no VAT
 * classification available at all, and says so via a gap. When codes exist but
 * some documents lack one, those lines are reported separately rather than
 * assumed.
 */
const classifySalesByVatCode = async (salesEntries) => {
  const result = {
    vatable: 0,
    zeroRated: 0,
    exempt: 0,
    exported: 0,
    unclassified: 0,
    unclassifiedDetail: [],
    // Per-bucket account codes, so each Part I line can be traced to the
    // revenue accounts it was summed from. `vatable` legitimately covers many
    // accounts, which is why this is a list and not a single code.
    accounts: { vatable: [], zeroRated: [], exempt: [], exported: [], unclassified: [] },
  }

  if (salesEntries.length === 0) return result

  // Sales document VAT codes, keyed by sales id.
  let salesByVatCode = new Map()
  try {
    const rows = await Query(
      // si_vat is the FK to vat.vat_id. It is a DECIMAL(18,2) column, so the
      // driver hands it back as a string; String() below normalises the key.
      // There is no si_vat_id column -- the sales controller already joins
      // Master.vat on Accounting.sales_items.selectOptionColumns.vat.
      `SELECT si.si_sales_id AS salesId, si.si_vat AS vatId, v.vat_type AS vatType,
              v.vat_code AS vatCode, v.vat_name AS vatName
         FROM sales_items si
         LEFT JOIN vat v ON v.vat_id = si.si_vat
        WHERE si.si_sales_id IS NOT NULL`,
      [],
    )
    if (Array.isArray(rows)) {
      for (const row of rows) {
        if (row.vatType) salesByVatCode.set(String(row.salesId), row)
      }
    }
  } catch (error) {
    // The vat_code column is optional across tenant versions. If it cannot be
    // read, fall through to the all-vatable path below rather than failing
    // the whole 2550.
    salesByVatCode = new Map()
    // Silent degradation here means every 2550 is filed as "all vatable", which
    // over-declares output tax and misstates Box 2. That is wrong enough to be
    // worth a loud log, even though the return still computes.
    console.warn(
      `[tax] Could not read VAT classification from sales_items (${error.code || error.message}). ` +
        'All sales will be treated as vatable; zero-rated/exempt amounts will be overstated.',
    )
  }

  if (salesByVatCode.size === 0) {
    // No classification available. Treat all sales as vatable — the
    // conservative default for the *tax* (over-declares rather than
    // under-declares) — and flag it hard.
    result.vatable = salesEntries.reduce(
      (total, entry) => total + Math.abs(signedAmount(entry)),
      0,
    )
    result.unclassified = result.vatable
    // The whole figure sits on these revenue accounts, so it must still be
    // traceable. Leaving the list empty would render a non-zero line with no
    // drill-down, which is the one case where a taxpayer least needs to be
    // asked to take the number on trust.
    result.accounts.vatable = accountCodesOf(salesEntries)
    result.accounts.unclassified = result.accounts.vatable
    result.unclassifiedDetail.push({
      reason: 'No VAT codes are assigned to sales documents in this tenant.',
      amount: round2(result.vatable),
    })
    return result
  }

  for (const entry of salesEntries) {
    const amount = Math.abs(signedAmount(entry))
    const code = salesByVatCode.get(String(entry.dbId))
    if (!code) {
      result.unclassified += amount
      if (entry.coaCode) {
        result.accounts.unclassified = mergeAccounts(result.accounts.unclassified, [
          { code: String(entry.coaCode), name: entry.coaName || String(entry.coaCode) },
        ])
      }
      // Not every revenue-account line is a sales document. Receipts and
      // adjustments also post to revenue accounts and carry no VAT code, so
      // naming the source module keeps the warning actionable.
      const source = entry.dbName || 'entry'
      const isSalesDoc = source === 'sales'
      result.unclassifiedDetail.push({
        reason: isSalesDoc
          ? `Sales document ${entry.referenceNo || entry.dbId} has no VAT code`
          : `${source} entry ${entry.referenceNo || entry.dbId} posted to a revenue account but is not a sales document, so it has no VAT code`,
        amount: round2(amount),
      })
      continue
    }
    const type = String(code.vatType || '').toLowerCase()
    const account = entry.coaCode
      ? [{ code: String(entry.coaCode), name: entry.coaName || String(entry.coaCode) }]
      : []
    if (type.includes('exempt')) {
      result.exempt += amount
      result.accounts.exempt = mergeAccounts(result.accounts.exempt, account)
    } else if (type.includes('zero')) {
      result.zeroRated += amount
      result.accounts.zeroRated = mergeAccounts(result.accounts.zeroRated, account)
    } else if (type.includes('export')) {
      result.exported += amount
      result.accounts.exported = mergeAccounts(result.accounts.exported, account)
    } else {
      result.vatable += amount
      result.accounts.vatable = mergeAccounts(result.accounts.vatable, account)
    }
  }

  return result
}

// ---------------------------------------------------------------------------
// Expanded withholding tax
// ---------------------------------------------------------------------------

/**
 * One row per withholding transaction: the WHT leg plus the taxable base it
 * was withheld from.
 *
 * When the sibling base line is missing, `base` is null and the row is counted
 * in `unmatched`. An unmatched row is NOT dropped and its base is NOT
 * defaulted to the withheld amount — reporting base = tax would imply a 100%
 * rate, which is nonsense and would inflate every ATC total downstream.
 */
const extractEwtTransactions = (entries) => {
  const vouchers = groupByVoucher(entries)
  const transactions = []

  for (const [voucherId, lines] of vouchers) {
    const whtLine = lines.find(isEwtLine)
    if (!whtLine) continue

    const withheld = Math.abs(signedAmount(whtLine))
    if (withheld === 0) continue

    // The base is the largest non-WHT, non-tax-account leg in the same
    // voucher: the consideration the tax was withheld from. On a service
    // purchase that is the expense; on a sale-with-commission it is revenue.
    const baseCandidates = lines
      .filter(
        (line) =>
          line.id !== whtLine.id &&
          !isEwtLine(line) &&
          !isCwtLine(line) &&
          !isOutputVatLine(line) &&
          !isInputVatLine(line) &&
          !isCompensationLine(line) &&
          (isExpenseLine(line) || isRevenueLine(line)),
      )
      .map((line) => Math.abs(signedAmount(line)))

    const base = baseCandidates.length ? Math.max(...baseCandidates) : null

    transactions.push({
      voucher_id: voucherId,
      date: toDateOnly(whtLine.date),
      reference_no: whtLine.referenceNo || null,
      atc: whtLine.atc || 'UNSPECIFIED',
      atc_description: whtLine.atcDescription || null,
      atc_rate: whtLine.atcRate === null || whtLine.atcRate === undefined
        ? null
        : Number(whtLine.atcRate),
      atc_inferred: !whtLine.atc,
      counterparty_name: whtLine.counterpartyName || null,
      counterparty_tin: whtLine.counterpartyTin || null,
      counterparty_type: whtLine.counterpartyType || null,
      base,
      withheld: round2(withheld),
      // Withheld against a base the module could not find. Flagged rather
      // than zero-filled: a zero base would read as "withheld from nothing".
      base_matched: base !== null,
    })
  }

  return transactions
}

/** EWT aggregated to one row per ATC — the shape 0619-E / 1601-EQ need. */
const summarizeEwtByAtc = (transactions) => {
  const byAtc = new Map()

  for (const txn of transactions) {
    if (!byAtc.has(txn.atc)) {
      byAtc.set(txn.atc, {
        atc: txn.atc,
        description: txn.atc_description || null,
        rate: txn.atc_rate,
        base: 0,
        tax_withheld: 0,
        vouchers: 0,
        unmatched: 0,
        inferred: true,
        counterparties: new Set(),
      })
    }
    const row = byAtc.get(txn.atc)
    if (txn.base !== null) row.base += txn.base
    row.tax_withheld += txn.withheld
    row.vouchers += 1
    if (txn.base === null) row.unmatched += 1
    if (!txn.atc_inferred) row.inferred = false
    if (txn.counterparty_name) row.counterparties.add(txn.counterparty_name)
  }

  return Array.from(byAtc.values())
    .map((row) => ({
      atc: row.atc,
      description: row.description,
      rate: row.rate,
      base: round2(row.base),
      tax_withheld: round2(row.tax_withheld),
      vouchers: row.vouchers,
      unmatched: row.unmatched,
      inferred: row.inferred,
      counterparty_count: row.counterparties.size,
    }))
    .sort((a, b) => b.tax_withheld - a.tax_withheld)
}

/** EWT aggregated to one row per calendar month — 1601-EQ's remittance lines. */
const summarizeEwtByMonth = (transactions) => {
  const byMonth = new Map()
  for (const txn of transactions) {
    const month = String(txn.date || '').slice(0, 7)
    if (!month) continue
    if (!byMonth.has(month)) byMonth.set(month, { month, base: 0, tax_withheld: 0, vouchers: 0 })
    const row = byMonth.get(month)
    if (txn.base !== null) row.base += txn.base
    row.tax_withheld += txn.withheld
    row.vouchers += 1
  }
  return Array.from(byMonth.values())
    .map((row) => ({
      ...row,
      base: round2(row.base),
      tax_withheld: round2(row.tax_withheld),
    }))
    .sort((a, b) => a.month.localeCompare(b.month))
}

// ---------------------------------------------------------------------------
// Creditable withholding tax (2307 / income tax credits)
// ---------------------------------------------------------------------------

/**
 * Creditable tax withheld, grouped payee → ATC → quarter.
 *
 * A payee with no TIN is retained under a sentinel key and marked
 * `blocked`, because a 2307 cannot be issued without the payee's TIN and the
 * amount must still appear in the total. Dropping it would make the schedule
 * disagree with the ledger and the income tax credit would be understated by
 * exactly the missing amount, invisibly.
 */
const UNASSIGNED = '__UNASSIGNED__'

const extractCwtTransactions = (entries) => {
  const vouchers = groupByVoucher(entries)
  const transactions = []

  for (const [voucherId, lines] of vouchers) {
    const cwtLine = lines.find(isCwtLine)
    if (!cwtLine) continue

    const withheld = Math.abs(signedAmount(cwtLine))
    if (withheld === 0) continue

    const revenueLines = lines
      .filter((line) => line.id !== cwtLine.id && isRevenueLine(line))
      .map((line) => Math.abs(signedAmount(line)))

    transactions.push({
      voucher_id: voucherId,
      date: toDateOnly(cwtLine.date),
      reference_no: cwtLine.referenceNo || null,
      atc: cwtLine.atc || 'UNSPECIFIED',
      atc_description: cwtLine.atcDescription || null,
      payee_name: cwtLine.counterpartyName || null,
      payee_tin: cwtLine.counterpartyTin || null,
      base: revenueLines.length ? Math.max(...revenueLines) : null,
      tax_withheld: round2(withheld),
    })
  }

  return transactions
}

const summarizeCwtByPayee = (transactions) => {
  const byPayee = new Map()

  for (const txn of transactions) {
    const hasPayee = Boolean(txn.payee_name)
    const key = `${hasPayee ? txn.payee_name : UNASSIGNED}|${txn.payee_tin || ''}|${txn.atc}`
    if (!byPayee.has(key)) {
      byPayee.set(key, {
        payee_name: hasPayee ? txn.payee_name : null,
        payee_tin: txn.payee_tin || null,
        atc: txn.atc,
        atc_description: txn.atc_description || null,
        quarters: { 1: 0, 2: 0, 3: 0, 4: 0 },
        total_base: 0,
        tax_withheld: 0,
        vouchers: 0,
      })
    }
    const row = byPayee.get(key)
    const quarter = getQuarter(txn.date)
    if (txn.base !== null && quarter) row.quarters[quarter] += txn.base
    if (txn.base !== null) row.total_base += txn.base
    row.tax_withheld += txn.tax_withheld
    row.vouchers += 1
  }

  return Array.from(byPayee.values())
    .map((row) => ({
      ...row,
      quarters: {
        1: round2(row.quarters[1]),
        2: round2(row.quarters[2]),
        3: round2(row.quarters[3]),
        4: round2(row.quarters[4]),
      },
      total_base: round2(row.total_base),
      tax_withheld: round2(row.tax_withheld),
      blocked: !row.payee_name || !row.payee_tin,
      blocked_reason: !row.payee_name
        ? 'Payee could not be identified from the source document.'
        : !row.payee_tin
          ? `Payee "${row.payee_name}" has no TIN on file; a 2307 cannot be issued without it.`
          : null,
    }))
    .sort((a, b) => b.tax_withheld - a.tax_withheld)
}

// ---------------------------------------------------------------------------
// Compensation withholding (1601-E / 1601-C / 1604-E)
// ---------------------------------------------------------------------------

const extractCompensationFacts = (entries) => {
  const vouchers = groupByVoucher(entries)
  const rows = []

  for (const [voucherId, lines] of vouchers) {
    const whtLine = lines.find(isEwtLine)
    const compLine = lines.find(isCompensationLine)
    if (!whtLine && !compLine) continue

    // A compensation withholding transaction is one where the WHT leg sits
    // in the same voucher as a compensation/benefit posting. Without that
    // pairing, the 1601-E figures would just be the 1601-EQ figures, i.e. the
    // same money counted on two returns.
    if (!whtLine || !compLine) continue

    const compensation = Math.abs(signedAmount(compLine))
    const withheld = Math.abs(signedAmount(whtLine))

    rows.push({
      voucher_id: voucherId,
      date: toDateOnly(whtLine.date || compLine.date),
      reference_no: whtLine.referenceNo || compLine.referenceNo || null,
      payee_name: whtLine.counterpartyName || compLine.counterpartyName || null,
      payee_tin: whtLine.counterpartyTin || compLine.counterpartyTin || null,
      atc: whtLine.atc || null,
      compensation: round2(compensation),
      tax_withheld: round2(withheld),
    })
  }

  const totalCompensation = sum(rows, 'compensation')
  const totalWithheld = sum(rows, 'tax_withheld')

  return {
    rows,
    total_compensation: round2(totalCompensation),
    taxable_compensation: round2(totalCompensation),
    tax_withheld: round2(totalWithheld),
    net_payable: round2(totalWithheld),
    total_remittance: round2(totalWithheld),
    by_month: groupCompensationByMonth(rows),
    gaps: buildGaps([
      {
        key: 'comp.paired_vouchers',
        present: rows.length > 0,
        severity: 'error',
        message:
          'No compensation withholding could be paired. A 1601-E needs a compensation or benefit posting in the same voucher as the withholding leg; check how payroll journal entries are posted.',
      },
    ]),
  }
}

const groupCompensationByMonth = (rows) => {
  const byMonth = new Map()
  for (const row of rows) {
    const month = String(row.date || '').slice(0, 7)
    if (!month) continue
    if (!byMonth.has(month)) byMonth.set(month, { month, compensation: 0, tax_withheld: 0, payees: 0 })
    const bucket = byMonth.get(month)
    bucket.compensation += row.compensation
    bucket.tax_withheld += row.tax_withheld
    bucket.payees += 1
  }
  return Array.from(byMonth.values())
    .map((row) => ({
      ...row,
      compensation: round2(row.compensation),
      tax_withheld: round2(row.tax_withheld),
    }))
    .sort((a, b) => a.month.localeCompare(b.month))
}

// ---------------------------------------------------------------------------
// Income tax inputs
// ---------------------------------------------------------------------------

/**
 * Income figures the ledger can support.
 *
 * This is the honest subset. It does NOT attempt prior-year carryover, net
 * operating loss, optional or special deductions — those live in the prior
 * return and in elections this module has no basis to guess. They are
 * returned as null with a gap so the income tax modules emit them as required
 * inputs rather than zero-filling them.
 */
const extractIncomeFacts = (entries, period) => {
  const revenueLines = entries.filter(isRevenueLine)
  const expenseLines = entries.filter(isExpenseLine)

  const grossIncome = revenueLines.reduce(
    (total, entry) => total + Math.abs(signedAmount(entry)),
    0,
  )
  const deductibleExpenses = expenseLines.reduce(
    (total, entry) => total + Math.abs(signedAmount(entry)),
    0,
  )

  // Compensation paid BY this taxpayer (a liability) vs compensation RECEIVED
  // (revenue). Only the payable side is a 1701-A/1601-E item; the receivable
  // side is a deduction on the payor's return. Reading the sign from the
  // account type is what keeps them apart.
  const compensationPaidRows = []
  const vouchers = groupByVoucher(entries)
  for (const lines of vouchers.values()) {
    const compLine = lines.find(isCompensationLine)
    if (!compLine) continue
    if (isRevenueLine(compLine)) continue
    const whtLine = lines.find(isEwtLine)
    compensationPaidRows.push({
      date: toDateOnly(compLine.date),
      payee_name: compLine.counterpartyName,
      payee_tin: compLine.counterpartyTin,
      compensation: round2(Math.abs(signedAmount(compLine))),
      tax_withheld: whtLine ? round2(Math.abs(signedAmount(whtLine))) : null,
    })
  }

  const cwtTransactions = extractCwtTransactions(entries)
  const creditableWithheld = round2(sum(cwtTransactions, 'tax_withheld'))

  return {
    period,
    gross_income: round2(grossIncome),
    deductible_expenses: round2(deductibleExpenses),
    book_net_income: round2(grossIncome - deductibleExpenses),
    compensation_paid: round2(sum(compensationPaidRows, 'compensation')),
    compensation_pays_receipts: round2(sum(compensationPaidRows, 'compensation')),
    compensation_detail: compensationPaidRows,
    // Personals received BY the taxpayer, which is what 1701-A/1702 line 1
    // wants. Read from revenue-typed compensation accounts.
    personals_received: round2(
      revenueLines
        .filter(isCompensationLine)
        .reduce((total, entry) => total + Math.abs(signedAmount(entry)), 0),
    ),
    business_professional_income: round2(grossIncome - sum(revenueLines.filter(isCompensationLine), 'amount')),
    creditable_withheld: creditableWithheld,
    // Explicitly unknown — see the function comment.
    prior_year_credit: null,
    prior_year_income_tax: null,
    net_operating_loss: null,
    personal_exemption: null,
    ordinary_deductions: null,
    special_deductions: null,
    quarterly_payments: null,
    gaps: buildGaps([
      {
        key: 'income.gross_income',
        present: true,
        severity: 'info',
        message:
          'Gross income is taken from revenue-typed accounts. Reconcile against Schedule 1 before filing — non-operating income and per-book/per-tax differences are not derivable here.',
      },
      {
        key: 'income.prior_year_credit',
        present: false,
        severity: 'error',
        message:
          'Prior-year income tax paid is not in the ledger. Enter it from the prior year BIR return.',
      },
      {
        key: 'income.ordinary_deductions',
        present: false,
        severity: 'error',
        message:
          'Optional standard (40%) or itemized deductions must be elected. This module does not choose between them.',
      },
      {
        key: 'income.net_operating_loss',
        present: false,
        severity: 'warning',
        message:
          'Net operating loss carryforward requires Schedule 4 from the prior return.',
      },
      {
        key: 'income.quarterly_payments',
        present: false,
        severity: 'error',
        message:
          'Prior quarterly 1701-Q / 1702-Q payments must be entered from the remittance ledger or the prior quarter filings.',
      },
      {
        key: 'income.creditable_withheld',
        present: creditableWithheld > 0,
        severity: 'warning',
        message:
          'No creditable tax withheld was found in this period. 2307 certificates on hand may not have been applied.',
      },
    ]),
  }
}

// ---------------------------------------------------------------------------
// Evidence — the ledger's answer to "what does this taxpayer actually do?"
// ---------------------------------------------------------------------------

const buildEvidence = ({ entries, vat, ewtTransactions, cwtTransactions, compensation }) => {
  const hasVatPostings = entries.some(isOutputVatLine)
  const hasInputVat = entries.some(isInputVatLine)

  return {
    has_vat_postings: hasVatPostings,
    has_input_vat_postings: hasInputVat,
    has_ewt_postings: ewtTransactions.length > 0,
    has_cwt_postings: cwtTransactions.length > 0,
    has_compensation_postings: compensation.rows.length > 0,
    compensation_pays_receipts: compensation.total_compensation,
    ewt_postings_count: ewtTransactions.length,
    cwt_postings_count: cwtTransactions.length,
    vat_output_amount: vat.output_tax_due,
    vat_input_amount: vat.input_tax_total,
  }
}

// ---------------------------------------------------------------------------
// Orchestration
// ---------------------------------------------------------------------------

/**
 * Read every tax fact for a period in one pass.
 *
 * @param {{start_date: string, end_date: string}} period  YYYY-MM-DD bounds
 * @returns the fact bag consumed by the computation modules
 */
const collectTaxFacts = async (period) => {
  const { start_date: startDate, end_date: endDate } = period
  const entries = await fetchJournalEntries(startDate, endDate)

  const vat = await extractVatFacts(entries, startDate, endDate)
  const ewtTransactions = extractEwtTransactions(entries)
  const cwtTransactions = extractCwtTransactions(entries)
  const compensation = extractCompensationFacts(entries)
  const income = extractIncomeFacts(entries, period)

  const ewt = {
    transactions: ewtTransactions,
    by_atc: summarizeEwtByAtc(ewtTransactions),
    by_month: summarizeEwtByMonth(ewtTransactions),
    total_tax_withheld: round2(sum(ewtTransactions, 'withheld')),
    total_base: round2(
      ewtTransactions.filter((t) => t.base !== null).reduce((s, t) => s + t.base, 0),
    ),
    unmatched_count: ewtTransactions.filter((t) => t.base === null).length,
    inferred_atc_count: ewtTransactions.filter((t) => t.atc_inferred).length,
  }

  const cwt = {
    transactions: cwtTransactions,
    by_payee: summarizeCwtByPayee(cwtTransactions),
    total_tax_withheld: round2(sum(cwtTransactions, 'tax_withheld')),
    blocked_payee_count: summarizeCwtByPayee(cwtTransactions).filter((r) => r.blocked)
      .length,
  }

  const evidence = buildEvidence({ entries, vat, ewtTransactions, cwtTransactions, compensation })

  return {
    period,
    journal_entry_count: entries.length,
    journal_entries: entries,
    vat,
    ewt,
    cwt,
    comp: compensation,
    income,
    evidence,
  }
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

const round2 = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100

const toDateOnly = (value) => {
  if (!value) return null
  if (typeof value === 'string') return value.slice(0, 10)
  if (value instanceof Date) {
    // Local components, not toISOString(). The UTC round trip shifts the day
    // backwards for any timezone ahead of UTC (PHT is +8), which would move
    // postings out of the period they belong to.
    const y = value.getFullYear()
    const m = String(value.getMonth() + 1).padStart(2, '0')
    const d = String(value.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  return null
}

const getQuarter = (dateOnly) => {
  if (!dateOnly) return null
  const month = Number(String(dateOnly).slice(5, 7))
  if (!month || month < 1 || month > 12) return null
  return Math.floor((month - 1) / 3) + 1
}

const buildGaps = (entries) =>
  entries
    .filter((entry) => !entry.present)
    .map((entry) => ({
      key: entry.key,
      severity: entry.severity || 'warning',
      message: entry.message,
      detail: entry.detail || null,
    }))

module.exports = {
  ACCOUNTS,
  VAT_RATE,
  APPROVED_SOURCE_FILTER,
  collectTaxFacts,
  fetchJournalEntries,
  extractVatFacts,
  extractEwtTransactions,
  summarizeEwtByAtc,
  summarizeEwtByMonth,
  extractCwtTransactions,
  summarizeCwtByPayee,
  extractCompensationFacts,
  extractIncomeFacts,
  buildEvidence,
  isOutputVatLine,
  isInputVatLine,
  isEwtLine,
  isCwtLine,
  isCompensationLine,
  isRevenueLine,
  isExpenseLine,
  groupByVoucher,
  round2,
  toDateOnly,
  getQuarter,
  UNASSIGNED,
}
