'use strict'

/**
 * BIR tax return catalog.
 *
 * This file is the single source of truth for what a BIR return *is* inside
 * this application. A "form" here is data, not code:
 *
 *   - `line_schema`   ordered line items with the labels BIR prints. The
 *                     client renders it, the exporters render it, and the
 *                     filing records store computed values against `key`.
 *   - `applicability` a declarative rule AST evaluated against the taxpayer
 *                     profile plus ledger evidence. See applicability.service.js
 *   - `deadline`      the statutory filing deadline, used to build the
 *                     calendar and to flag overdue filings.
 *
 * Nothing in here invents figures. Every `source` path names a fact the
 * ledger service must be able to produce; if it cannot, the computation
 * module records a data gap rather than substituting a value.
 *
 * LINE NUMBERS: taken from the current BIR form layouts. BIR revises these,
 * so each form records `form_revision` and the `source` citation it was
 * transcribed from. Re-verify before relying on a number for a filing.
 */

// ---------------------------------------------------------------------------
// Taxpayer types. These are the axes that actually decide which returns apply.
// ---------------------------------------------------------------------------
const TAXPAYER_TYPES = {
  DOMESTIC_CORPORATION: 'Domestic Corporation',
  FOREIGN_CORPORATION: 'Resident Foreign Corporation',
  NON_RESIDENT_FOREIGN: 'Non-Resident Foreign Corporation',
  INDIVIDUAL: 'Individual (employee / non-professional)',
  SELF_EMPLOYED_PROFESSIONAL: 'Self-Employed Professional (Sec. 3)',
  SOLE_PROPRIETOR: 'Sole Proprietor / Proprietary',
  PARTNERSHIP: 'Partnership / Association',
  NON_VIRTUAL_OFFICER: 'Non-Virtual Officer / Employee',
  TRUST: 'Trust',
}

const REGISTRATIONS = {
  VAT: 'Registered with the BIR for VAT (RR 07-2020 > registered)',
  EWT_AGENT: 'Designated withholding agent for compensation / EWT',
  EWT_REMITTER: 'Withholding agent for expanded withholding tax',
  AVAT: 'Authorized VAT Representative',
  PEZA: 'Registered with PEZA / SBMA / BCDA',
  NON_FILING: 'Non-filing / exempt from certain returns',
}

// The proportion of the tax year already covered by filed remittances. A
// corporation must have remitted 1% of gross income in the preceding
// quarter-ends (1701-Q) and individuals have their own interim payments
// (1701-A / 1702-Q). Used to validate the income tax schedules, not to
// compute them.
const PERIOD_BASIS = {
  CALENDAR_MONTH: 'CALENDAR_MONTH',
  CALENDAR_QUARTER: 'CALENDAR_QUARTER',
  CALENDAR_YEAR: 'CALENDAR_YEAR',
  FISCAL_YEAR: 'FISCAL_YEAR',
  FISCAL_QUARTER: 'FISCAL_QUARTER',
  PER_CREDENTIAL: 'PER_CREDENTIAL',
}

const CATEGORY = {
  VAT: 'VAT',
  WITHHOLDING: 'Withholding',
  INCOME_TAX: 'Income Tax',
  CERTIFICATE: 'Certificate',
  SCHEDULE: 'Supporting Schedule',
}

const FREQUENCY = {
  MONTHLY: 'MONTHLY',
  QUARTERLY: 'QUARTERLY',
  ANNUAL: 'ANNUAL',
  EVENT_DRIVEN: 'EVENT_DRIVEN',
}

// ---------------------------------------------------------------------------
// Reusable rule fragments. Keeping these named makes the per-form rules
// readable and stops the same predicate being re-typed six times with
// slightly different wording.
// ---------------------------------------------------------------------------

const registeredForVat = {
  fact: 'vat_registered',
  equals: true,
  why: 'the taxpayer is registered with the BIR for VAT',
}

const isCorporation = {
  fact: 'taxpayer_type',
  in: ['DOMESTIC_CORPORATION', 'FOREIGN_CORPORATION'],
  why: 'the taxpayer is a corporation',
}

const isIndividualFilers = {
  fact: 'taxpayer_type',
  in: [
    'INDIVIDUAL',
    'SELF_EMPLOYED_PROFESSIONAL',
    'SOLE_PROPRIETOR',
    'PARTNERSHIP',
  ],
  why: 'the taxpayer is an individual, professional, or partnership filer',
}

const isIndividualCompensationPayer = {
  any: [
    {
      fact: 'taxpayer_type',
      in: ['INDIVIDUAL', 'NON_VIRTUAL_OFFICER'],
      why: 'the taxpayer pays compensation as an individual employer',
    },
    {
      fact: 'compensation_pays_receipts',
      greater_than: 0,
      why: 'the ledger shows compensation payable this period',
    },
  ],
}

const hasEwtWithholding = {
  fact: 'has_ewt_postings',
  equals: true,
  why: 'the ledger contains expanded-withholding-tax postings',
}

const isEwtRemittingAgent = {
  any: [
    { fact: 'ewt_remitter', equals: true, why: 'the taxpayer is a designated EWT remitting agent' },
    hasEwtWithholding,
  ],
}

const isWithholdingAgentForCompensation = {
  any: [
    { fact: 'ewt_agent', equals: true, why: 'the taxpayer is a registered withholding agent' },
    isIndividualCompensationPayer,
  ],
}

const hasCreditableWithheld = {
  fact: 'has_cwt_postings',
  equals: true,
  why: 'the ledger contains creditable-tax-withheld postings to be certified',
}

const onCalendarYear = {
  fact: 'fiscal_year_basis',
  equals: 'CALENDAR',
  why: "the taxpayer's fiscal year follows the calendar year",
}

// ---------------------------------------------------------------------------
// Line schema vocabulary
// ---------------------------------------------------------------------------
//   key       stable identifier; computed values are persisted against it
//   line      the number BIR prints in the margin
//   section   grouping heading the line sits under
//   label     printed text
//   kind      'computed' | 'input' | 'subtotal' | 'blank' | 'memo'
//   source    dotted path into the fact bag the computation module resolves
//   formula   for subtotals: { op, args } over sibling line keys
//   columns   per-period breakdown (quarterly forms) — ordered column defs
//   emphasis  BIR boxes/bolds this line on the official form
//   gap_key   data-gap identifier emitted when `source` cannot be resolved
// ---------------------------------------------------------------------------

const cols = (...names) => names.map((name) => ({ key: name, label: name }))

// ===========================================================================
// VAT
// ===========================================================================

const VAT_2550M = {
  form_code: '2550M',
  category: CATEGORY.VAT,
  title: 'Monthly Value-Added Tax Declaration',
  short_title: 'Monthly VAT Declaration',
  form_revision: 'BIR 2550M (ENCS, rev. 2019)',
  frequency: FREQUENCY.MONTHLY,
  period_basis: PERIOD_BASIS.CALENDAR_MONTH,
  computation_key: 'VAT_2550M',
  is_declaration: true,
  prerequisite_forms: [],
  export_profiles: ['efps_dat', 'efps_xml', 'pdf_a4'],
  // 2550M is due on the 20th of the month following the sale month, or the
  // 25th when the 20th falls on a Saturday or Sunday. The offset moves the
  // reference month forward before the day is applied.
  deadline: { day: 20, grace_weekend_to: 25, offset_months: 1 },
  applicability: {
    all: [
      registeredForVat,
      {
        not: { fact: 'taxpayer_type', equals: 'NON_FILING' },
        why: 'the taxpayer is not marked non-filing',
      },
    ],
  },
  notes:
    'Sales/receipts figures are reconstructed from VAT-tagged sales documents. Zero-rated and exempt sales must be separately tagged at the point of document approval; if they are not, Part I will reconcile to the Output VAT account and the computation will raise a gap rather than force a number.',
  header_fields: [
    { key: 'tin', label: "TIN", width: 22 },
    { key: 'rdo_code', label: 'RDO Code', width: 10 },
    { key: 'registered_name', label: 'Registered Name', width: 40 },
    { key: 'registered_address', label: 'Registered Address', width: 40 },
    { key: 'business_activity', label: 'Principal Business Activity', width: 50 },
  ],
  line_schema: [
    { key: 'vat_payable_prior_period', line: 12, section: 'II', label: 'Prior Month / prior quarter excess input tax (overpayment) claimed', kind: 'computed', source: 'vat.prior_period_credit', gap_key: 'vat.prior_period_credit' },
    { key: 'sales_total', line: 1, section: 'I', label: 'Amount of Sales and/or Receipts (including all non-creditable sales)', kind: 'subtotal', formula: { op: 'add', args: ['vatable_sales', 'exempt_sales', 'zero_rated_sales', 'export_sales'] }, emphasis: true },
    { key: 'vatable_sales', line: 5, section: 'I', label: 'Sales and/or Receipts subject to 12% VAT', kind: 'computed', source: 'vat.vatable_sales', gap_key: 'vat.vatable_sales' },
    { key: 'exempt_sales', line: 2, section: 'I', label: 'Exempt Sales and/or Receipts', kind: 'computed', source: 'vat.exempt_sales', gap_key: 'vat.exempt_sales' },
    { key: 'zero_rated_sales', line: 3, section: 'I', label: 'Special (Zero-Rated) Sales and/or Receipts', kind: 'computed', source: 'vat.zero_rated_sales', gap_key: 'vat.zero_rated_sales' },
    { key: 'export_sales', line: 4, section: 'I', label: 'Amount of Export Sales and/or Receipts', kind: 'computed', source: 'vat.export_sales', gap_key: 'vat.export_sales' },
    { key: 'output_tax_due', line: 7, section: 'II', label: 'Output Tax Due (12% VAT)', kind: 'computed', source: 'vat.output_tax_due', gap_key: 'vat.output_tax_due' },
    { key: 'input_tax_total', line: 17, section: 'III', label: 'Total Allowable Input Tax', kind: 'computed', source: 'vat.input_tax_total', gap_key: 'vat.input_tax_total' },
    { key: 'excess_input_tax', line: 20, section: 'III', label: 'Excess of Input Tax over Output Tax (credit)', kind: 'computed', source: 'vat.excess_input_tax', gap_key: 'vat.excess_input_tax' },
    { key: 'net_vat_payable', line: 21, section: 'III', label: 'Net VAT Payable', kind: 'subtotal', formula: { op: 'add', args: ['output_tax_due', 'excess_input_tax'] }, emphasis: true },
    { key: 'net_vat_overpayment', line: 22, section: 'III', label: 'Net VAT Payable / (Overpayment)', kind: 'computed', source: 'vat.net_vat_payable_or_overpayment', gap_key: 'vat.net_overpayment' },
    { key: 'vat_payable_this_period', line: 26, section: 'III', label: 'TOTAL AMOUNT PAYABLE (net VAT payable plus prior-period overpayment claimed)', kind: 'computed', source: 'vat.total_payable', gap_key: 'vat.total_payable' },
    { key: 'amount_paid', line: 27, section: 'III', label: 'Less: Amount Paid (including creditable tax withheld at source)', kind: 'input', source: 'filings.amount_paid' },
    { key: 'amount_still_due', line: 28, section: 'III', label: 'Amount Still Due', kind: 'subtotal', formula: { op: 'subtract', args: ['vat_payable_this_period', 'amount_paid'] }, emphasis: true },
  ],
  schedules: [
    { key: 'schedule_1', label: 'Schedule 1 — Sales/Receipts subject to 12% VAT (by registered business activity)' },
    { key: 'schedule_2', label: 'Schedule 2 — Exempt Sales/Receipts' },
    { key: 'schedule_3', label: 'Schedule 3 — Special (Zero-Rated) Sales/Receipts' },
    { key: 'schedule_4', label: 'Schedule 4 — Amount of Export Sales/Receipts by country' },
    { key: 'schedule_5', label: 'Schedule 5 — Purchase of Capital Goods subject to 12% VAT (amortization)' },
    { key: 'schedule_6', label: 'Schedule 6 — Creditable Tax Withheld at Source (VAT withheld by government)' },
  ],
}

const VAT_2550Q = {
  ...VAT_2550M,
  // Must come after the spread above, otherwise 2550M's own form_code wins and
  // this form registers as a duplicate of the monthly return.
  form_code: '2550Q',
  title: 'Quarterly Value-Added Tax Declaration',
  short_title: 'Quarterly VAT Declaration',
  form_revision: 'BIR 2550Q (ENCS, rev. 2019)',
  frequency: FREQUENCY.QUARTERLY,
  period_basis: PERIOD_BASIS.CALENDAR_QUARTER,
  computation_key: 'VAT_2550Q',
  prerequisite_forms: ['2550M'],
  export_profiles: ['efps_dat', 'efps_xml', 'pdf_a4'],
  // 2550Q is due on the 30th of the month following the quarter, not the 31st.
  deadline: { day: 30, grace_weekend_to: null, offset_months: 1 },
  applicability: {
    all: [
      registeredForVat,
      {
        fact: 'vat_filing_frequency',
        equals: 'QUARTERLY',
        why: 'the taxpayer is registered as a quarterly VAT filer',
      },
    ],
  },
  notes:
    'A quarterly filer still files 2550M for each month of the quarter. 2550Q consolidates the quarter and must agree with the three monthlies; the computation module cross-checks them and reports any variance instead of silently substituting one for the other.',
    // header_fields is inherited from the 2550M spread above.
    line_schema: [
    { key: 'vat_payable_prior_period', line: 12, section: 'II', label: 'Prior quarter excess input tax (overpayment) claimed', kind: 'computed', source: 'vat.prior_period_credit', gap_key: 'vat.prior_period_credit' },
    { key: 'sales_total', line: 1, section: 'I', label: 'Amount of Sales and/or Receipts', kind: 'subtotal', formula: { op: 'add', args: ['vatable_sales', 'exempt_sales', 'zero_rated_sales', 'export_sales'] }, emphasis: true, columns: ['month_1', 'month_2', 'month_3', 'total'] },
    { key: 'vatable_sales', line: 5, section: 'I', label: 'Sales and/or Receipts subject to 12% VAT', kind: 'computed', source: 'vat.vatable_sales', gap_key: 'vat.vatable_sales', columns: ['month_1', 'month_2', 'month_3', 'total'] },
    { key: 'exempt_sales', line: 2, section: 'I', label: 'Exempt Sales and/or Receipts', kind: 'computed', source: 'vat.exempt_sales', gap_key: 'vat.exempt_sales', columns: ['month_1', 'month_2', 'month_3', 'total'] },
    { key: 'zero_rated_sales', line: 3, section: 'I', label: 'Special (Zero-Rated) Sales and/or Receipts', kind: 'computed', source: 'vat.zero_rated_sales', gap_key: 'vat.zero_rated_sales', columns: ['month_1', 'month_2', 'month_3', 'total'] },
    { key: 'export_sales', line: 4, section: 'I', label: 'Amount of Export Sales and/or Receipts', kind: 'computed', source: 'vat.export_sales', gap_key: 'vat.export_sales', columns: ['month_1', 'month_2', 'month_3', 'total'] },
    { key: 'output_tax_due', line: 7, section: 'II', label: 'Output Tax Due (12% VAT)', kind: 'computed', source: 'vat.output_tax_due', gap_key: 'vat.output_tax_due', columns: ['month_1', 'month_2', 'month_3', 'total'] },
    { key: 'input_tax_total', line: 17, section: 'III', label: 'Total Allowable Input Tax', kind: 'computed', source: 'vat.input_tax_total', gap_key: 'vat.input_tax_total', columns: ['month_1', 'month_2', 'month_3', 'total'] },
    { key: 'excess_input_tax', line: 20, section: 'III', label: 'Excess of Input Tax over Output Tax (credit)', kind: 'computed', source: 'vat.excess_input_tax', gap_key: 'vat.excess_input_tax', columns: ['month_1', 'month_2', 'month_3', 'total'] },
    { key: 'net_vat_payable', line: 21, section: 'III', label: 'Net VAT Payable', kind: 'subtotal', formula: { op: 'add', args: ['output_tax_due', 'excess_input_tax'] }, emphasis: true, columns: ['month_1', 'month_2', 'month_3', 'total'] },
    { key: 'vat_payable_this_period', line: 26, section: 'III', label: 'TOTAL AMOUNT PAYABLE', kind: 'computed', source: 'vat.total_payable', gap_key: 'vat.total_payable', columns: ['month_1', 'month_2', 'month_3', 'total'] },
    { key: 'amount_paid', line: 27, section: 'III', label: 'Less: Amount Paid', kind: 'input', source: 'filings.amount_paid', columns: ['month_1', 'month_2', 'month_3', 'total'] },
    { key: 'amount_still_due', line: 28, section: 'III', label: 'Amount Still Due', kind: 'subtotal', formula: { op: 'subtract', args: ['vat_payable_this_period', 'amount_paid'] }, emphasis: true, columns: ['month_1', 'month_2', 'month_3', 'total'] },
  ],
}

// ===========================================================================
// WITHHOLDING
// ===========================================================================

const atcSchedule = (label) => ({
  key: 'atc_schedule',
  kind: 'schedule',
  label,
  // The ATC rows themselves are data-dependent: one row per (ATC, counterparty
  // class) that actually posted in the period. The form definition declares the
  // columns; the computation module supplies the rows.
  columns: [
    { key: 'atc', label: 'ATC', type: 'text' },
    { key: 'description', label: 'Nature of Income Payment', type: 'text' },
    { key: 'base', label: 'Taxable Base', type: 'amount' },
    { key: 'rate', label: 'Rate', type: 'percent' },
    { key: 'tax_withheld', label: 'Tax Withheld', type: 'amount' },
  ],
})

const EWT_0619E = {
  form_code: '0619E',
  category: CATEGORY.WITHHOLDING,
  title: 'Monthly Remittance Return of Creditable Income Taxes Withheld at Source',
  short_title: 'Monthly EWT Return (Individual)',
  form_revision: 'BIR Form 0619-E (ENCS, rev. 2018)',
  frequency: FREQUENCY.MONTHLY,
  period_basis: PERIOD_BASIS.CALENDAR_MONTH,
  computation_key: 'EWT_0619E',
  is_declaration: false,
  prerequisite_forms: [],
  export_profiles: ['saws_dat', 'efps_xml', 'pdf_a4'],
  deadline: { day: 10, grace_weekend_to: null, offset_months: 1 },
  applicability: {
    all: [
      isIndividualFilers,
      isEwtRemittingAgent,
      {
        not: { fact: 'taxpayer_type', in: ['DOMESTIC_CORPORATION', 'FOREIGN_CORPORATION'] },
        why: '0619-E is the individual filer return; corporations file 1601-E',
      },
    ],
  },
  notes:
    '0619-E is the monthly return an individual or professional remitter files. A corporation withholding expanded tax on behalf of others files 1601-E instead — running both is a common double-filing mistake, so the engine will say so explicitly.',
  header_fields: [
    { key: 'tin', label: 'TIN', width: 22 },
    { key: 'rdo_code', label: 'RDO Code', width: 10 },
    { key: 'registered_name', label: 'Name of Payor / Withholding Agent', width: 40 },
    { key: 'registered_address', label: 'Registered Address', width: 40 },
  ],
  line_schema: [
    atcSchedule('Schedule of Income Payments and Income Taxes Withheld'),
    { key: 'total_base', line: 17, section: 'III', label: 'Total Income Payments', kind: 'subtotal', formula: { op: 'sumAtc', args: ['base'] }, emphasis: true },
    { key: 'total_tax_withheld', line: 18, section: 'III', label: 'Total Income Tax Withheld', kind: 'subtotal', formula: { op: 'sumAtc', args: ['tax_withheld'] }, emphasis: true },
    { key: 'net_payable', line: 20, section: 'IV', label: 'Net Amount of Remittance Payable', kind: 'computed', source: 'ewt.net_remittance' },
    { key: 'prior_period_credit', line: 21, section: 'IV', label: 'Add: Prior Period Overpayment / Credit', kind: 'computed', source: 'ewt.prior_period_credit', gap_key: 'ewt.prior_period_credit' },
    { key: 'amount_paid', line: 22, section: 'IV', label: 'Less: Amount Paid (TIN, date, and receipts attached)', kind: 'input', source: 'filings.amount_paid' },
    { key: 'total_remittance', line: 24, section: 'IV', label: 'TOTAL AMOUNT OF REMITTANCE', kind: 'computed', source: 'ewt.total_remittance', emphasis: true },
    { key: 'amount_overpaid', line: 25, section: 'IV', label: 'Overpayment / (Underpayment)', kind: 'computed', source: 'ewt.overpayment' },
  ],
}

const EWT_1601E = {
  form_code: '1601E',
  category: CATEGORY.WITHHOLDING,
  title: 'Monthly Remittance Return of Creditable Income Taxes Withheld at Source on Compensation',
  short_title: 'Monthly EWT Remittance (Compensation)',
  form_revision: 'BIR Form 1601-E (rev. 2018)',
  frequency: FREQUENCY.MONTHLY,
  period_basis: PERIOD_BASIS.CALENDAR_MONTH,
  computation_key: 'EWT_1601E',
  is_declaration: false,
  prerequisite_forms: [],
  export_profiles: ['saws_dat', 'efps_xml', 'pdf_a4'],
  deadline: { day: 10, grace_weekend_to: null, offset_months: 1 },
  applicability: {
    all: [
      isCorporation,
      isWithholdingAgentForCompensation,
    ],
  },
  notes:
    '1601-E covers compensation withheld. Expanded withholding on payments to non-employees goes on 1601-F. 1601-C later in the quarter consolidates the 1601-E monthlies — it does not replace them.',
  // Identity block, matching the forms that already declare one.
  header_fields: [
    { key: 'tin', label: 'TIN', width: 22 },
    { key: 'rdo_code', label: 'RDO Code', width: 10 },
    { key: 'registered_name', label: 'Registered Name', width: 40 },
    { key: 'registered_address', label: 'Registered Address', width: 40 },
  ],
  line_schema: [
    { key: 'total_compensation', line: 3, section: 'II', label: 'Total Compensation and Benefits Paid', kind: 'computed', source: 'comp.total_compensation', gap_key: 'comp.total_compensation' },
    { key: 'compensation_taxable', line: 4, section: 'II', label: 'Taxable Compensation and Benefits', kind: 'computed', source: 'comp.taxable_compensation', gap_key: 'comp.taxable_compensation' },
    { key: 'tax_withheld', line: 5, section: 'II', label: 'Tax Withheld', kind: 'computed', source: 'comp.tax_withheld', gap_key: 'comp.tax_withheld' },
    { key: 'net_payable', line: 8, section: 'III', label: 'Net Amount of Compensation Tax Withheld Payable', kind: 'computed', source: 'comp.net_payable' },
    { key: 'prior_period_credit', line: 9, section: 'III', label: 'Add: Prior Period Overpayment / Credit', kind: 'computed', source: 'comp.prior_period_credit', gap_key: 'comp.prior_period_credit' },
    { key: 'total_remittance', line: 11, section: 'III', label: 'TOTAL AMOUNT OF REMITTANCE', kind: 'computed', source: 'comp.total_remittance', emphasis: true },
    { key: 'amount_paid', line: 12, section: 'III', label: 'Less: Amount Paid', kind: 'input', source: 'filings.amount_paid' },
    { key: 'amount_still_due', line: 13, section: 'III', label: 'Amount Still Due', kind: 'computed', source: 'comp.amount_still_due', emphasis: true },
  ],
}

const EWT_1601C = {
  form_code: '1601C',
  category: CATEGORY.WITHHOLDING,
  title: 'Consolidated Remittance Return of Creditable Income Taxes Withheld at Source on Compensation',
  short_title: 'Consolidated Compensation EWT (Quarter)',
  form_revision: 'BIR Form 1601-C (rev. 2018)',
  frequency: FREQUENCY.QUARTERLY,
  period_basis: PERIOD_BASIS.CALENDAR_QUARTER,
  computation_key: 'EWT_1601C',
  is_declaration: false,
  // This is the important structural fact: 1601-C is *derived from* the three
  // 1601-E monthlies. It cannot be computed from the ledger alone without
  // double counting, so the module reads the filed monthlies.
  prerequisite_forms: ['1601E'],
  export_profiles: ['saws_dat', 'efps_xml', 'pdf_a4'],
  deadline: { day: 31, grace_weekend_to: null, offset_months: 1 },
  applicability: {
    all: [
      isCorporation,
      isWithholdingAgentForCompensation,
    ],
  },
  notes:
    'Must agree with the three 1601-E monthlies for the quarter. The computation cross-checks each month against its 1601-E and reports the variance per month rather than rolling them up silently.',
  // Identity block, matching the forms that already declare one.
  header_fields: [
    { key: 'tin', label: 'TIN', width: 22 },
    { key: 'rdo_code', label: 'RDO Code', width: 10 },
    { key: 'registered_name', label: 'Registered Name', width: 40 },
    { key: 'registered_address', label: 'Registered Address', width: 40 },
  ],
  line_schema: [
    { key: 'month_1_compensation', line: 5, section: 'II', label: 'First month — compensation and benefits paid', kind: 'computed', source: 'consolidated.months[0].compensation', columns: ['compensation', 'tax_withheld'] },
    { key: 'month_2_compensation', line: 6, section: 'II', label: 'Second month — compensation and benefits paid', kind: 'computed', source: 'consolidated.months[1].compensation', columns: ['compensation', 'tax_withheld'] },
    { key: 'month_3_compensation', line: 7, section: 'II', label: 'Third month — compensation and benefits paid', kind: 'computed', source: 'consolidated.months[2].compensation', columns: ['compensation', 'tax_withheld'] },
    { key: 'total_compensation', line: 8, section: 'II', label: 'Total compensation and benefits paid', kind: 'subtotal', formula: { op: 'sumLines', args: ['month_1_compensation', 'month_2_compensation', 'month_3_compensation'] }, emphasis: true, columns: ['compensation', 'tax_withheld'] },
    { key: 'tax_withheld', line: 9, section: 'II', label: 'Total tax withheld', kind: 'subtotal', formula: { op: 'sumLines', args: ['month_1_compensation', 'month_2_compensation', 'month_3_compensation'], field: 'tax_withheld' }, emphasis: true, columns: ['compensation', 'tax_withheld'] },
    { key: 'prior_period_credit', line: 12, section: 'III', label: 'Add: Prior period overpayment / credit', kind: 'computed', source: 'consolidated.prior_period_credit', gap_key: 'consolidated.prior_period_credit' },
    { key: 'total_remittance', line: 14, section: 'III', label: 'TOTAL AMOUNT OF REMITTANCE', kind: 'computed', source: 'consolidated.total_remittance', emphasis: true },
    { key: 'amount_paid', line: 15, section: 'III', label: 'Less: Amount Paid', kind: 'input', source: 'filings.amount_paid' },
    { key: 'amount_still_due', line: 16, section: 'III', label: 'Amount Still Due', kind: 'computed', source: 'consolidated.amount_still_due', emphasis: true },
  ],
}

const EWT_1601EQ = {
  form_code: '1601EQ',
  category: CATEGORY.WITHHOLDING,
  title: 'Quarterly Remittance Return of Creditable Income Taxes Withheld at Source',
  short_title: 'Quarterly EWT Return (Corporation)',
  form_revision: 'BIR Form 1601-EQ (rev. 2018)',
  frequency: FREQUENCY.QUARTERLY,
  period_basis: PERIOD_BASIS.CALENDAR_QUARTER,
  computation_key: 'EWT_1601EQ',
  is_declaration: false,
  prerequisite_forms: [],
  export_profiles: ['saws_dat', 'efps_xml', 'pdf_a4'],
  deadline: { day: 31, grace_weekend_to: null, offset_months: 1 },
  applicability: {
    all: [
      isCorporation,
      isEwtRemittingAgent,
    ],
  },
  notes:
    'A corporation files 1601-EQ for a quarter and, if it withheld on compensation, also files 1601-E monthly plus the consolidating 1601-C. The "tax still due" figure is only meaningful once the monthlies in the quarter have been recorded as remittances — that is why a remittance ledger exists rather than hardcoded zeros.',
  // Identity block, matching the forms that already declare one.
  header_fields: [
    { key: 'tin', label: 'TIN', width: 22 },
    { key: 'rdo_code', label: 'RDO Code', width: 10 },
    { key: 'registered_name', label: 'Registered Name', width: 40 },
    { key: 'registered_address', label: 'Registered Address', width: 40 },
  ],
  line_schema: [
    atcSchedule('Schedule of Income Payments and Expanded Withholding Tax by ATC'),
    { key: 'total_base', line: 19, section: 'II', label: 'Total Income Payments', kind: 'subtotal', formula: { op: 'sumAtc', args: ['base'] }, emphasis: true },
    { key: 'total_tax_withheld', line: 20, section: 'II', label: 'Total Income Tax Withheld for the Quarter', kind: 'subtotal', formula: { op: 'sumAtc', args: ['tax_withheld'] }, emphasis: true },
    { key: 'remit_prior', line: 21, section: 'II', label: 'Less: Remittance — first month', kind: 'computed', source: 'ewt.remittances[0]', gap_key: 'ewt.remittance_months' },
    { key: 'remit_second', line: 22, section: 'II', label: 'Less: Remittance — second month', kind: 'computed', source: 'ewt.remittances[1]', gap_key: 'ewt.remittance_months' },
    { key: 'remit_third', line: 23, section: 'II', label: 'Less: Remittance — third month', kind: 'computed', source: 'ewt.remittances[2]', gap_key: 'ewt.remittance_months' },
    { key: 'total_remittances', line: 24, section: 'II', label: 'Total Remittances Made', kind: 'subtotal', formula: { op: 'add', args: ['remit_prior', 'remit_second', 'remit_third'] }, emphasis: true },
    { key: 'tax_still_due', line: 25, section: 'II', label: 'TAX STILL DUE / (Over-remittance)', kind: 'computed', source: 'ewt.tax_still_due', emphasis: true },
    { key: 'prior_period_credit', line: 26, section: 'II', label: 'Add: Prior quarter over-remittance / credit', kind: 'computed', source: 'ewt.prior_period_credit', gap_key: 'ewt.prior_period_credit' },
    { key: 'total_remittance', line: 30, section: 'II', label: 'TOTAL AMOUNT OF REMITTANCE', kind: 'computed', source: 'ewt.total_remittance', emphasis: true },
    { key: 'amount_paid', line: 31, section: 'II', label: 'Less: Amount Paid', kind: 'input', source: 'filings.amount_paid' },
    { key: 'amount_still_due', line: 32, section: 'II', label: 'TOTAL AMOUNT STILL DUE', kind: 'computed', source: 'ewt.amount_still_due', emphasis: true },
  ],
}

const EWT_1604C = {
  form_code: '1604C',
  category: CATEGORY.WITHHOLDING,
  title: 'Quarterly Summary List of Creditable Income Taxes Withheld at Source',
  short_title: 'Quarterly EWT Summary (Corporation)',
  form_revision: 'BIR Form 1604-C (rev. 2018)',
  frequency: FREQUENCY.QUARTERLY,
  period_basis: PERIOD_BASIS.CALENDAR_QUARTER,
  computation_key: 'EWT_1604C',
  is_declaration: false,
  prerequisite_forms: ['1601E'],
  export_profiles: ['saws_dat', 'efps_xml', 'pdf_a4'],
  deadline: { day: 31, grace_weekend_to: null, offset_months: 1 },
  applicability: {
    all: [
      isCorporation,
      isWithholdingAgentForCompensation,
    ],
  },
  notes:
    'This is the summary counterpart to 1601-C: the ATC breakdown that supports the quarterly compensation remittance. It is filed alongside 1601-C, not instead of it.',
  // Identity block, matching the forms that already declare one.
  header_fields: [
    { key: 'tin', label: 'TIN', width: 22 },
    { key: 'rdo_code', label: 'RDO Code', width: 10 },
    { key: 'registered_name', label: 'Registered Name', width: 40 },
    { key: 'registered_address', label: 'Registered Address', width: 40 },
  ],
  line_schema: [
    atcSchedule('Summary List of Income Payments and Compensation Tax Withheld, by ATC'),
    { key: 'total_base', line: 10, section: 'II', label: 'Total Income Payments', kind: 'subtotal', formula: { op: 'sumAtc', args: ['base'] }, emphasis: true },
    { key: 'total_tax_withheld', line: 11, section: 'II', label: 'Total Compensation Tax Withheld', kind: 'subtotal', formula: { op: 'sumAtc', args: ['tax_withheld'] }, emphasis: true },
  ],
}

const EWT_1604E = {
  form_code: '1604E',
  category: CATEGORY.WITHHOLDING,
  title: 'Quarterly Summary List of Creditable Income Taxes Withheld at Source on Compensation',
  short_title: 'Quarterly Compensation EWT Summary',
  form_revision: 'BIR Form 1604-E (rev. 2018)',
  frequency: FREQUENCY.QUARTERLY,
  period_basis: PERIOD_BASIS.CALENDAR_QUARTER,
  computation_key: 'EWT_1604E',
  is_declaration: false,
  prerequisite_forms: ['1601E'],
  export_profiles: ['saws_dat', 'efps_xml', 'pdf_a4'],
  deadline: { day: 31, grace_weekend_to: null, offset_months: 1 },
  applicability: {
    all: [isIndividualFilers, isWithholdingAgentForCompensation],
  },
  notes:
    'The individual-filer companion to 1601-E. Filed by an individual or professional who withheld compensation tax during the quarter.',
  // Identity block, matching the forms that already declare one.
  header_fields: [
    { key: 'tin', label: 'TIN', width: 22 },
    { key: 'rdo_code', label: 'RDO Code', width: 10 },
    { key: 'registered_name', label: 'Registered Name', width: 40 },
    { key: 'registered_address', label: 'Registered Address', width: 40 },
  ],
  line_schema: [
    atcSchedule('Summary List of Compensation Paid and Tax Withheld, by ATC'),
    { key: 'total_base', line: 10, section: 'II', label: 'Total Compensation Paid', kind: 'subtotal', formula: { op: 'sumAtc', args: ['base'] }, emphasis: true },
    { key: 'total_tax_withheld', line: 11, section: 'II', label: 'Total Compensation Tax Withheld', kind: 'subtotal', formula: { op: 'sumAtc', args: ['tax_withheld'] }, emphasis: true },
  ],
}

// ===========================================================================
// INCOME TAX
// ===========================================================================

const personServiceSchedule = () => ({
  key: 'person_service_schedule',
  kind: 'schedule',
  label: 'Schedule of Personals (compensation, benefits, and honoraria) by recipient TIN',
  columns: [
    { key: 'recipient_tin', label: "Recipient's TIN", type: 'text' },
    { key: 'recipient_name', label: 'Name', type: 'text' },
    { key: 'january_february', label: 'Jan–Feb', type: 'amount' },
    { key: 'march_august', label: 'Mar–Aug', type: 'amount' },
    { key: 'september_december', label: 'Sep–Dec', type: 'amount' },
    { key: 'total', label: 'Total', type: 'amount' },
  ],
})

const INCOME_1701 = {
  form_code: '1701',
  // Income tax periods follow the taxpayer's fiscal year, not the calendar
  // year, so the basis upgrades from CALENDAR_* to FISCAL_* when the profile
  // declares a non-December year end. See computation/index.js.
  follows_fiscal_year: true,
  category: CATEGORY.INCOME_TAX,
  title: 'Annual Income Tax Return — Domestic Corporation',
  short_title: 'Annual Income Tax Return (Corporation)',
  form_revision: 'BIR Form 1701 (rev. 2018, as amended by CREATE)',
  frequency: FREQUENCY.ANNUAL,
  period_basis: PERIOD_BASIS.CALENDAR_YEAR,
  computation_key: 'INCOME_1701',
  is_declaration: true,
  prerequisite_forms: ['1701Q'],
  export_profiles: ['efps_dat', 'efps_xml', 'pdf_a4'],
  deadline: { day: 15, grace_weekend_to: null, offset_months: 4 },
  applicability: {
    all: [isCorporation, { fact: 'subject_to_income_tax', equals: true, why: 'the taxpayer is subject to income tax' }],
  },
  notes:
    'Gross income is available from the ledger. The things a corporation return needs that a ledger does not contain are prior-year carryover, net operating loss carryforward, optional deductions, special deductions, and prior-quarter 1701-Q payments. Those lines are marked kind:"input" and the module reports them as required data gaps — it will not carry forward a figure from the prior return automatically, because silently rolling a prior return forward is how wrong returns get filed.',
  header_fields: [
    { key: 'tin', label: 'TIN', width: 22 },
    { key: 'rdo_code', label: 'RDO Code', width: 10 },
    { key: 'registered_name', label: 'Registered Name', width: 40 },
    { key: 'registered_address', label: 'Registered Address', width: 40 },
    { key: 'accounting_period', label: 'Accounting Period (FY start/end)', width: 30 },
  ],
  line_schema: [
    { key: 'gross_income', line: 1, section: 'I', label: 'Gross Income (from Schedule 1)', kind: 'computed', source: 'income.gross_income', gap_key: 'income.gross_income' },
    { key: 'less_exemptions', line: 2, section: 'I', label: 'Less: Exemptions (from Schedule 2)', kind: 'computed', source: 'income.exempt_income', gap_key: 'income.exempt_income' },
    { key: 'taxable_income', line: 3, section: 'I', label: 'Taxable Income', kind: 'subtotal', formula: { op: 'subtract', args: ['gross_income', 'less_exemptions'] }, emphasis: true },
    { key: 'taxable_income_base', line: 4, section: 'II', label: 'Taxable Income Subject to 20%/25%/30% Graduated Tax', kind: 'computed', source: 'income.taxable_income_base', gap_key: 'income.taxable_income_base' },
    { key: 'graduated_tax', line: 5, section: 'II', label: 'Graduated Tax', kind: 'computed', source: 'income.graduated_tax' },
    { key: 'prior_year_credit', line: 11, section: 'II', label: 'Add: Income Tax Paid for Prior Taxable Year', kind: 'input', source: 'input.prior_year_credit' },
    { key: 'personal_exemptions', line: 12, section: 'II', label: 'Add: Personal Exemptions', kind: 'input', source: 'input.personal_exemptions' },
    { key: 'special_deductions', line: 13, section: 'II', label: 'Add: Special Deductions', kind: 'input', source: 'input.special_deductions' },
    { key: 'ordinary_deductions', line: 14, section: 'II', label: 'Add: Optional Standard Deductions / Itemized Deductions', kind: 'input', source: 'input.ordinary_deductions' },
    { key: 'net_op_loss', line: 15, section: 'II', label: 'Add: Net Operating Loss Carryforward', kind: 'input', source: 'input.net_operating_loss' },
    { key: 'creditable_taxes', line: 16, section: 'II', label: 'Add: Creditable Taxes Withheld (2307 certificates)', kind: 'computed', source: 'income.creditable_withheld', gap_key: 'income.creditable_withheld' },
    { key: 'income_tax_due', line: 17, section: 'II', label: 'Income Tax Due for the Taxable Year', kind: 'computed', source: 'income.income_tax_due', emphasis: true },
    { key: 'quarterly_payments', line: 18, section: 'II', label: 'Less: Quarterly 1701-Q Payments Made', kind: 'computed', source: 'income.quarterly_payments', gap_key: 'income.quarterly_payments' },
    { key: 'tax_balance_due', line: 19, section: 'II', label: 'TAX BALANCE DUE / (Overpayment)', kind: 'computed', source: 'income.balance_due', emphasis: true },
    { key: 'surplus', line: 20, section: 'II', label: 'Add: Previous Year’s Surplus Applicable for This Year', kind: 'input', source: 'input.previous_year_surplus' },
    { key: 'total_amount_due', line: 21, section: 'II', label: 'TOTAL AMOUNT DUE', kind: 'computed', source: 'income.total_amount_due', emphasis: true },
    { key: 'amount_paid', line: 22, section: 'II', label: 'Less: Total Paid / Creditable Taxes (Schedule 3)', kind: 'input', source: 'filings.amount_paid' },
    { key: 'amount_still_due', line: 23, section: 'II', label: 'Amount Still Due', kind: 'computed', source: 'income.amount_still_due', emphasis: true },
  ],
  schedules: [
    { key: 'schedule_1', label: 'Schedule 1 — Gross Income Reconciliation (per books vs per tax, SRC / non-operating)' },
    { key: 'schedule_2', label: 'Schedule 2 — Exemptions' },
    { key: 'schedule_3', label: 'Schedule 3 — Payment of Income Tax (TIN, RDO, date filed, amount, receipt no.)' },
    { key: 'schedule_4', label: 'Schedule 4 — Computation of Net Operating Loss Carryforward' },
    { key: 'schedule_5', label: 'Schedule 5 — Foreign Tax Credits' },
    { key: 'schedule_6', label: 'Schedule 6 — Personals and Beneficiaries' },
  ],
}

const INCOME_1701A = {
  form_code: '1701A',
  // Income tax periods follow the taxpayer's fiscal year, not the calendar
  // year, so the basis upgrades from CALENDAR_* to FISCAL_* when the profile
  // declares a non-December year end. See computation/index.js.
  follows_fiscal_year: true,
  category: CATEGORY.INCOME_TAX,
  title: 'Annual Income Tax Return — Individuals, Estates and Trusts (with income tax on compensation paid by government or prescribed classes)',
  short_title: 'Annual Income Tax Return (Individual — compensation)',
  form_revision: 'BIR Form 1701-A (rev. 2018)',
  frequency: FREQUENCY.ANNUAL,
  period_basis: PERIOD_BASIS.CALENDAR_YEAR,
  computation_key: 'INCOME_1701A',
  is_declaration: true,
  prerequisite_forms: [],
  export_profiles: ['efps_dat', 'efps_xml', 'pdf_a4'],
  deadline: { day: 15, grace_weekend_to: null, offset_months: 4 },
  applicability: {
    all: [
      isIndividualFilers,
      {
        fact: 'compensation_pays_receipts',
        greater_than: 0,
        why: 'the taxpayer paid compensation to individuals',
      },
    ],
  },
  notes:
    'The individual filer who paid compensation uses 1701-A; an individual professional on flat rate uses 1702. The graduated-tax brackets below are the TRAIN-era NIRC Sec. 24 brackets and must be re-verified whenever the schedule changes.',
  // Identity block, matching the forms that already declare one.
  header_fields: [
    { key: 'tin', label: 'TIN', width: 22 },
    { key: 'rdo_code', label: 'RDO Code', width: 10 },
    { key: 'registered_name', label: 'Registered Name', width: 40 },
    { key: 'registered_address', label: 'Registered Address', width: 40 },
  ],
  line_schema: [
    personServiceSchedule(),
    { key: 'taxable_personals', line: 3, section: 'I', label: 'Total Personals (compensation, benefits, honoraria)', kind: 'computed', source: 'income.taxable_personals', gap_key: 'income.taxable_personals' },
    { key: 'taxable_business_professional', line: 4, section: 'I', label: 'Total Business/Professional Income', kind: 'computed', source: 'income.business_professional_income', gap_key: 'income.business_professional_income' },
    { key: 'mixed_income_benefits', line: 5, section: 'I', label: 'Mixed Income Benefits', kind: 'input', source: 'input.mixed_income_benefits' },
    { key: 'total_taxable_income', line: 6, section: 'I', label: 'Total Income Received/Accrual', kind: 'subtotal', formula: { op: 'add', args: ['taxable_personals', 'taxable_business_professional', 'mixed_income_benefits'] }, emphasis: true },
    { key: 'less_legal_pros_lookback', line: 7, section: 'I', label: 'Less: Share of Other Income Received by Taxable Persons not subject to graduated tax', kind: 'input', source: 'input.legal_professional_share' },
    { key: 'less_farm_income', line: 8, section: 'I', label: 'Less: Income Derived from Farming / Fishing', kind: 'input', source: 'input.farm_fishing_income' },
    { key: 'less_actual_farm', line: 9, section: 'I', label: 'Less: Income Derived from Sale of Assets (capital asset gains)', kind: 'input', source: 'input.capital_asset_gains' },
    { key: 'less_actual_gross', line: 10, section: 'I', label: 'Less: Actual Gross Income received in full by taxpayer as member of partnership', kind: 'input', source: 'input.partnership_gross_income' },
    { key: 'taxable_income', line: 11, section: 'I', label: 'TOTAL TAXABLE INCOME', kind: 'computed', source: 'income.taxable_income', emphasis: true },
    { key: 'tax_due', line: 12, section: 'II', label: 'Tax Due (graduated)', kind: 'computed', source: 'income.graduated_tax' },
    { key: 'less_special_payroll_tax', line: 13, section: 'II', label: 'Less: Special (Payroll) Tax', kind: 'input', source: 'input.special_payroll_tax' },
    { key: 'less_creditable_withheld', line: 14, section: 'II', label: 'Less: Creditable Taxes Withheld (2307 certificates)', kind: 'computed', source: 'income.creditable_withheld', gap_key: 'income.creditable_withheld' },
    { key: 'less_prior_year_income_tax', line: 15, section: 'II', label: 'Less: Income Tax Paid for Prior Taxable Year', kind: 'input', source: 'input.prior_year_income_tax' },
    { key: 'add_under_withholding', line: 16, section: 'II', label: 'Add: Amount Under Withholding per Sec. 58', kind: 'input', source: 'input.under_withholding' },
    { key: 'add_final_withholding', line: 17, section: 'II', label: 'Add: Final Withholding Tax (as compensation)', kind: 'input', source: 'input.final_withholding_tax' },
    { key: 'total_tax_due', line: 18, section: 'II', label: 'TOTAL TAX DUE', kind: 'computed', source: 'income.total_tax_due', emphasis: true },
    { key: 'less_quarterly_payments', line: 19, section: 'II', label: 'Less: Income Tax Paid for Prior Quarters', kind: 'computed', source: 'income.quarterly_payments', gap_key: 'income.quarterly_payments' },
    { key: 'tax_balance_due', line: 20, section: 'II', label: 'TAX BALANCE DUE / (Overpayment)', kind: 'computed', source: 'income.balance_due', emphasis: true },
    { key: 'add_prev_year_surplus', line: 21, section: 'II', label: 'Add: Previous Year’s Surplus Applicable', kind: 'input', source: 'input.previous_year_surplus' },
    { key: 'total_amount_due', line: 22, section: 'II', label: 'TOTAL AMOUNT DUE', kind: 'computed', source: 'income.total_amount_due', emphasis: true },
    { key: 'amount_still_due', line: 23, section: 'II', label: 'Amount Still Due', kind: 'computed', source: 'income.amount_still_due', emphasis: true },
  ],
  schedules: [
    { key: 'schedule_1', label: 'Schedule 1 — Itemized deductions (Schedule of OSD or itemized deductions)' },
    { key: 'schedule_2', label: 'Schedule 2 — Personals by TIN (already above)' },
    { key: 'schedule_3', label: 'Schedule 3 — Creditable tax withheld (2307)' },
    { key: 'schedule_4', label: 'Schedule 4 — Computation of tax credits' },
  ],
}

const INCOME_1701Q = {
  form_code: '1701Q',
  // Income tax periods follow the taxpayer's fiscal year, not the calendar
  // year, so the basis upgrades from CALENDAR_* to FISCAL_* when the profile
  // declares a non-December year end. See computation/index.js.
  follows_fiscal_year: true,
  category: CATEGORY.INCOME_TAX,
  title: 'Quarterly Income Tax Return for Corporate Taxpayers',
  short_title: 'Quarterly Income Tax Return (Corporation)',
  form_revision: 'BIR Form 1701-Q (RA 10963, s. 3)',
  frequency: FREQUENCY.QUARTERLY,
  period_basis: PERIOD_BASIS.CALENDAR_QUARTER,
  computation_key: 'INCOME_1701Q',
  is_declaration: true,
  prerequisite_forms: [],
  export_profiles: ['efps_dat', 'efps_xml', 'pdf_a4'],
  deadline: { day: 15, grace_weekend_to: null, offset_months: 1 },
  applicability: {
    all: [
      isCorporation,
      { fact: 'subject_to_income_tax', equals: true, why: 'the taxpayer is subject to income tax' },
    ],
  },
  notes:
    'A corporation must remit 1% of the preceding quarter’s gross income (or actual quarterly income where greater) by the 15th of the month after each quarter end. The comparison is the whole point of the form, so both figures are computed and the greater is selected rather than assumed.',
  // Identity block, matching the forms that already declare one.
  header_fields: [
    { key: 'tin', label: 'TIN', width: 22 },
    { key: 'rdo_code', label: 'RDO Code', width: 10 },
    { key: 'registered_name', label: 'Registered Name', width: 40 },
    { key: 'registered_address', label: 'Registered Address', width: 40 },
  ],
  line_schema: [
    { key: 'gross_income', line: 1, section: 'I', label: 'Gross Income and Receipts of the immediately preceding quarter', kind: 'computed', source: 'income.prior_quarter_gross_income', gap_key: 'income.prior_quarter_gross_income' },
    { key: 'one_percent', line: 2, section: 'I', label: 'One Percent (1%) of Gross Income and Receipts', kind: 'computed', formula: { op: 'percentOf', args: ['gross_income'], rate: 0.01 } },
    { key: 'quarterly_income', line: 3, section: 'I', label: 'Total Income for the current quarter', kind: 'computed', source: 'income.current_quarter_gross_income', gap_key: 'income.current_quarter_gross_income' },
    { key: 'tax_base', line: 4, section: 'I', label: 'TAX BASE (greater of 1% of preceding quarter, or total current-quarter income)', kind: 'computed', formula: { op: 'max', args: ['one_percent', 'quarterly_income'] }, emphasis: true },
    { key: 'tax_due', line: 5, section: 'II', label: 'TAX DUE', kind: 'computed', formula: { op: 'percentOf', args: ['tax_base'], rate: 0.01 }, emphasis: true },
    { key: 'creditable_withheld', line: 6, section: 'II', label: 'Less: Creditable Taxes Withheld', kind: 'computed', source: 'income.creditable_withheld', gap_key: 'income.creditable_withheld' },
    { key: 'prior_qtr_credit', line: 7, section: 'II', label: 'Less: Prior Quarter Tax Credit', kind: 'computed', source: 'income.prior_quarter_credit', gap_key: 'income.prior_quarter_credit' },
    { key: 'tax_balance_due', line: 8, section: 'II', label: 'TAX BALANCE DUE / (Overpayment)', kind: 'computed', source: 'income.balance_due', emphasis: true },
    { key: 'amount_paid', line: 9, section: 'II', label: 'Less: Amount Paid', kind: 'input', source: 'filings.amount_paid' },
    { key: 'amount_still_due', line: 10, section: 'II', label: 'AMOUNT STILL DUE', kind: 'computed', source: 'income.amount_still_due', emphasis: true },
  ],
}

const INCOME_1702 = {
  form_code: '1702',
  // Income tax periods follow the taxpayer's fiscal year, not the calendar
  // year, so the basis upgrades from CALENDAR_* to FISCAL_* when the profile
  // declares a non-December year end. See computation/index.js.
  follows_fiscal_year: true,
  category: CATEGORY.INCOME_TAX,
  title: 'Annual Income Tax Return for Individuals, Estates and Trusts and Purely Personal Income Earned (other than income received in the exercise of a profession or trade) — Individuals Taxed on Graduated or Flat Rates',
  short_title: 'Annual Income Tax Return (Individual)',
  form_revision: 'BIR Form 1702 (rev. 2018)',
  frequency: FREQUENCY.ANNUAL,
  period_basis: PERIOD_BASIS.CALENDAR_YEAR,
  computation_key: 'INCOME_1702',
  is_declaration: true,
  prerequisite_forms: ['1702Q'],
  export_profiles: ['efps_dat', 'efps_xml', 'pdf_a4'],
  deadline: { day: 15, grace_weekend_to: null, offset_months: 4 },
  applicability: {
    any: [
      { all: [isIndividualFilers, { fact: 'self_employed_professional', equals: true, why: 'the taxpayer is a self-employed professional taxed on the graduated scale' }] },
      { all: [isIndividualFilers, { fact: 'compensation_pays_receipts', greater_than: 0, why: 'the taxpayer receives compensation' }] },
    ],
  },
  notes:
    '1702 is the individual return. The 4% and 3% graduated rates and the 6%/12% enhanced rates on professional income, plus the graduated personal exemption of ₱200,000, are statutory parameters held in computation/income.js — update them as one set.',
  // Identity block, matching the forms that already declare one.
  header_fields: [
    { key: 'tin', label: 'TIN', width: 22 },
    { key: 'rdo_code', label: 'RDO Code', width: 10 },
    { key: 'registered_name', label: 'Registered Name', width: 40 },
    { key: 'registered_address', label: 'Registered Address', width: 40 },
  ],
  line_schema: [
    { key: 'taxable_personals', line: 1, section: 'I', label: 'Taxable Personals (compensation, benefits and honoraria)', kind: 'computed', source: 'income.taxable_personals', gap_key: 'income.taxable_personals' },
    { key: 'taxable_business_professional', line: 2, section: 'I', label: 'Total Business/Professional Income', kind: 'computed', source: 'income.business_professional_income', gap_key: 'income.business_professional_income' },
    { key: 'mixed_income_benefits', line: 3, section: 'I', label: 'Mixed Income Benefits', kind: 'input', source: 'input.mixed_income_benefits' },
    { key: 'total_income', line: 4, section: 'I', label: 'Total Income Received/Accrual During the Taxable Year', kind: 'subtotal', formula: { op: 'add', args: ['taxable_personals', 'taxable_business_professional', 'mixed_income_benefits'] }, emphasis: true },
    { key: 'less_mixed_lookback', line: 5, section: 'I', label: 'Less: Mixed Income Benefits Included in Personals', kind: 'input', source: 'input.mixed_income_lookback' },
    { key: 'less_legal_pros_share', line: 6, section: 'I', label: 'Less: Share of Other Income Received by Taxable Persons not subject to graduated tax', kind: 'input', source: 'input.legal_professional_share' },
    { key: 'less_farm_income', line: 7, section: 'I', label: 'Less: Income Derived from Farming', kind: 'input', source: 'input.farm_fishing_income' },
    { key: 'less_capital_gains', line: 8, section: 'I', label: 'Less: Gain on Sale of Capital Assets (not subject to final tax)', kind: 'input', source: 'input.capital_asset_gains' },
    { key: 'less_partnership_gross', line: 9, section: 'I', label: 'Less: Actual Gross Income received in full as member of partnership', kind: 'input', source: 'input.partnership_gross_income' },
    { key: 'total_taxable_income', line: 10, section: 'I', label: 'TOTAL TAXABLE INCOME', kind: 'computed', source: 'income.taxable_income', emphasis: true },
    { key: 'tax_due_graduated', line: 11, section: 'II', label: 'Tax Due (graduated)', kind: 'computed', source: 'income.graduated_tax' },
    { key: 'tax_due_business_flat', line: 12, section: 'II', label: 'Tax Due on Business/Professional Income (flat rate)', kind: 'computed', source: 'income.flat_rate_tax' },
    { key: 'add_fmw_income_tax', line: 13, section: 'II', label: 'Add: Tax on Less Than One Year employment (in lieu of graduated tax)', kind: 'input', source: 'input.fmw_income_tax' },
    { key: 'add_under_withholding', line: 14, section: 'II', label: 'Add: Amount Under Withholding per Sec. 58', kind: 'input', source: 'input.under_withholding' },
    { key: 'add_final_withholding', line: 15, section: 'II', label: 'Add: Final Withholding Tax', kind: 'input', source: 'input.final_withholding_tax' },
    { key: 'add_special_payroll_tax', line: 16, section: 'II', label: 'Add: Special (Payroll) Tax', kind: 'input', source: 'input.special_payroll_tax' },
    { key: 'less_personal_exemption', line: 17, section: 'II', label: 'Less: Personal Exemption', kind: 'computed', source: 'income.personal_exemption' },
    { key: 'add_osd_or_itemized', line: 18, section: 'II', label: 'Add: Optional Standard Deductions or Itemized Deductions', kind: 'input', source: 'input.ordinary_deductions' },
    { key: 'less_creditable_withheld', line: 19, section: 'II', label: 'Less: Creditable Taxes Withheld (2307 certificates)', kind: 'computed', source: 'income.creditable_withheld', gap_key: 'income.creditable_withheld' },
    { key: 'total_tax_due', line: 20, section: 'II', label: 'TOTAL TAX DUE', kind: 'computed', source: 'income.total_tax_due', emphasis: true },
    { key: 'less_payments', line: 21, section: 'II', label: 'Less: Income Tax Paid for Prior Quarters / Prior Year', kind: 'computed', source: 'income.prior_payments', gap_key: 'income.prior_payments' },
    { key: 'tax_balance_due', line: 22, section: 'II', label: 'TAX BALANCE DUE / (Overpayment)', kind: 'computed', source: 'income.balance_due', emphasis: true },
    { key: 'add_prev_year_surplus', line: 23, section: 'II', label: 'Add: Previous Year’s Surplus Applicable for this Year', kind: 'input', source: 'input.previous_year_surplus' },
    { key: 'total_amount_due', line: 24, section: 'II', label: 'TOTAL AMOUNT DUE', kind: 'computed', source: 'income.total_amount_due', emphasis: true },
    { key: 'amount_paid', line: 25, section: 'II', label: 'Less: Total Paid', kind: 'input', source: 'filings.amount_paid' },
    { key: 'amount_still_due', line: 26, section: 'II', label: 'Amount Still Due', kind: 'computed', source: 'income.amount_still_due', emphasis: true },
  ],
  schedules: [
    { key: 'schedule_1', label: 'Schedule 1 — Itemized deductions' },
    { key: 'schedule_2', label: 'Schedule 2 — Personals by TIN' },
    { key: 'schedule_3', label: 'Schedule 3 — Creditable tax withheld (2307)' },
    { key: 'schedule_4', label: 'Schedule 4 — Computation of tax credits' },
  ],
}

const INCOME_1702Q = {
  form_code: '1702Q',
  // Income tax periods follow the taxpayer's fiscal year, not the calendar
  // year, so the basis upgrades from CALENDAR_* to FISCAL_* when the profile
  // declares a non-December year end. See computation/index.js.
  follows_fiscal_year: true,
  category: CATEGORY.INCOME_TAX,
  title: 'Quarterly Income Tax Return for Individuals, Estates and Trusts (whose income is subject to graduated tax or has no income tax payable in the preceding quarter)',
  short_title: 'Quarterly Income Tax Return (Individual)',
  form_revision: 'BIR Form 1702-Q (RA 10963, s. 3)',
  frequency: FREQUENCY.QUARTERLY,
  period_basis: PERIOD_BASIS.CALENDAR_QUARTER,
  computation_key: 'INCOME_1702Q',
  is_declaration: true,
  prerequisite_forms: [],
  export_profiles: ['efps_dat', 'efps_xml', 'pdf_a4'],
  deadline: { day: 15, grace_weekend_to: null, offset_months: 1 },
  applicability: {
    all: [isIndividualFilers, { fact: 'subject_to_income_tax', equals: true, why: 'the taxpayer is subject to income tax' }],
  },
  notes:
    'Filed in the second and fourth quarters only (and the third where income is all from compensation). An individual with no income tax payable in the preceding quarter files the fourth-quarter return at ₱0. The engine treats a zero-amount quarter as a valid filing that must still be filed, not as "nothing to do".',
  // Identity block, matching the forms that already declare one.
  header_fields: [
    { key: 'tin', label: 'TIN', width: 22 },
    { key: 'rdo_code', label: 'RDO Code', width: 10 },
    { key: 'registered_name', label: 'Registered Name', width: 40 },
    { key: 'registered_address', label: 'Registered Address', width: 40 },
  ],
  line_schema: [
    { key: 'taxable_income_q1', line: 1, section: 'I', label: 'Taxable Income — First Quarter', kind: 'computed', source: 'income.quarters[0].taxable_income', gap_key: 'income.quarterly_taxable_income' },
    { key: 'taxable_income_q2', line: 2, section: 'I', label: 'Taxable Income — Second Quarter', kind: 'computed', source: 'income.quarters[1].taxable_income', gap_key: 'income.quarterly_taxable_income' },
    { key: 'taxable_income_q3', line: 3, section: 'I', label: 'Taxable Income — Third Quarter', kind: 'computed', source: 'income.quarters[2].taxable_income', gap_key: 'income.quarterly_taxable_income' },
    { key: 'taxable_income_q4', line: 4, section: 'I', label: 'Taxable Income — Fourth Quarter', kind: 'computed', source: 'income.quarters[3].taxable_income', gap_key: 'income.quarterly_taxable_income' },
    { key: 'total_taxable_income', line: 5, section: 'I', label: 'TOTAL TAXABLE INCOME', kind: 'subtotal', formula: { op: 'add', args: ['taxable_income_q1', 'taxable_income_q2', 'taxable_income_q3', 'taxable_income_q4'] }, emphasis: true },
    { key: 'tax_due', line: 6, section: 'II', label: 'Tax Due (graduated)', kind: 'computed', source: 'income.graduated_tax' },
    { key: 'add_under_withholding', line: 7, section: 'II', label: 'Add: Amount Under Withholding per Sec. 58', kind: 'input', source: 'input.under_withholding' },
    { key: 'add_final_withholding', line: 8, section: 'II', label: 'Add: Final Withholding Tax', kind: 'input', source: 'input.final_withholding_tax' },
    { key: 'less_creditable_withheld', line: 9, section: 'II', label: 'Less: Creditable Taxes Withheld (2307 certificates)', kind: 'computed', source: 'income.creditable_withheld', gap_key: 'income.creditable_withheld' },
    { key: 'total_tax_due', line: 10, section: 'II', label: 'TOTAL TAX DUE', kind: 'computed', source: 'income.total_tax_due', emphasis: true },
    { key: 'less_prior_payments', line: 11, section: 'II', label: 'Less: Income Tax Paid for Prior Quarters', kind: 'computed', source: 'income.prior_payments', gap_key: 'income.prior_payments' },
    { key: 'tax_balance_due', line: 12, section: 'II', label: 'TAX BALANCE DUE / (Overpayment)', kind: 'computed', source: 'income.balance_due', emphasis: true },
    { key: 'amount_still_due', line: 13, section: 'II', label: 'AMOUNT STILL DUE', kind: 'computed', source: 'income.amount_still_due', emphasis: true },
  ],
}

// ===========================================================================
// CERTIFICATE
// ===========================================================================

const CERTIFICATE_2307 = {
  form_code: '2307',
  category: CATEGORY.CERTIFICATE,
  title: 'Certificate of Creditable Tax Withheld at Source',
  short_title: '2307 Certificate',
  form_revision: 'BIR Form 2307 (rev. 2018)',
  frequency: FREQUENCY.ANNUAL,
  period_basis: PERIOD_BASIS.PER_CREDENTIAL,
  computation_key: 'CERTIFICATE_2307',
  is_declaration: false,
  prerequisite_forms: [],
  export_profiles: ['pdf_a4', 'xml'],
  deadline: null, // issued on request, not filed on a schedule
  // A 2307 is issued by the withholding agent. It is "applicable" as a
  // capability whenever the taxpayer withholds creditable tax, and each
  // individual certificate is driven by payee demand — tracked as a filing
  // per payee per year rather than per period.
  applicability: {
    any: [
      isEwtRemittingAgent,
      hasCreditableWithheld,
    ],
  },
  notes:
    '2307 is a certificate, not a return: it is not filed with a deadline but issued to a payee on demand. One certificate covers one payee for one year, so filings are keyed payee + tax year. A certificate can only be issued once the payee has a TIN on file and the withheld amount traces to specific vouchers — an unallocated total is not issuable, and the module will say so rather than issue one.',
  header_fields: [
    { key: 'tin', label: 'TIN (Withholding Agent)', width: 22 },
    { key: 'rdo_code', label: 'RDO Code', width: 10 },
    { key: 'registered_name', label: 'Registered Name', width: 40 },
    { key: 'registered_address', label: 'Registered Address', width: 40 },
    { key: 'payee_tin', label: "Payee's TIN", width: 22 },
    { key: 'payee_name', label: "Payee's Name", width: 40 },
  ],
  line_schema: [
    {
      key: 'payments_schedule',
      kind: 'schedule',
      label: 'Income Payments and Tax Withheld — by ATC, with quarterly period columns',
      columns: [
        { key: 'atc', label: 'ATC', type: 'text' },
        { key: 'nature_of_income', label: 'Nature of Income Payment', type: 'text' },
        { key: 'period_1', label: 'First Period', type: 'amount' },
        { key: 'period_2', label: 'Second Period', type: 'amount' },
        { key: 'period_3', label: 'Third Period', type: 'amount' },
        { key: 'period_4', label: 'Fourth Period', type: 'amount' },
        { key: 'total', label: 'Total', type: 'amount' },
        { key: 'tax_withheld', label: 'Tax Withheld', type: 'amount' },
      ],
    },
    { key: 'total_payments', line: 1, section: 'II', label: 'Total Income Payments', kind: 'subtotal', formula: { op: 'sumAtc', args: ['total'] }, emphasis: true },
    { key: 'total_tax_withheld', line: 2, section: 'II', label: 'Total Tax Withheld', kind: 'subtotal', formula: { op: 'sumAtc', args: ['tax_withheld'] }, emphasis: true },
  ],
  certificate_fields: [
    { key: 'certificate_number', label: 'Certificate No.', required: true, note: 'Internally generated; the BIR copy stays blank until the payee signs.' },
    { key: 'issued_date', label: 'Date of Issue', required: true },
    { key: 'tax_year', label: 'Tax Year Covered', required: true },
  ],
}

// ===========================================================================
// SUPPORTING SCHEDULES — not filed on their own, attached to a parent return
// ===========================================================================

const SCHEDULES = [
  {
    form_code: 'SCHED-A',
    category: CATEGORY.SCHEDULE,
    title: 'Schedule A — Creditable Tax Withheld at Source Detail (supporting 1601-E / 0619-E)',
    short_title: 'ATC Detail Schedule',
    form_revision: 'derived',
    frequency: FREQUENCY.MONTHLY,
    period_basis: PERIOD_BASIS.CALENDAR_MONTH,
    computation_key: 'EWT_SCHEDULE_A',
    is_declaration: false,
    prerequisite_forms: ['0619E', '1601E', '1601EQ'],
    export_profiles: ['csv', 'xml'],
    deadline: null,
    applicability: { all: [isEwtRemittingAgent] },
    notes:
      'A working paper, not a BIR form. Breaks the parent return’s ATC totals down to individual vouchers so the filed return can be reconciled back to the ledger line by line.',
    // Identity block, matching the forms that already declare one.
    header_fields: [
      { key: 'tin', label: 'TIN', width: 22 },
      { key: 'rdo_code', label: 'RDO Code', width: 10 },
      { key: 'registered_name', label: 'Registered Name', width: 40 },
      { key: 'registered_address', label: 'Registered Address', width: 40 },
    ],
    line_schema: [
      {
        key: 'voucher_detail',
        kind: 'schedule',
        label: 'Voucher-level withholding detail',
        columns: [
          { key: 'date', label: 'Date', type: 'date' },
          { key: 'reference_no', label: 'Document Ref.', type: 'text' },
          { key: 'payee', label: 'Payee', type: 'text' },
          { key: 'payee_tin', label: "Payee's TIN", type: 'text' },
          { key: 'atc', label: 'ATC', type: 'text' },
          { key: 'nature_of_income', label: 'Nature of Income Payment', type: 'text' },
          { key: 'base', label: 'Taxable Base', type: 'amount' },
          { key: 'rate', label: 'Rate', type: 'percent' },
          { key: 'tax_withheld', label: 'Tax Withheld', type: 'amount' },
        ],
      },
    ],
  },
  {
    form_code: 'SCHED-VAT-RECON',
    category: CATEGORY.SCHEDULE,
    title: 'Schedule — VAT Reconciliation: per-books sales vs Output VAT account',
    short_title: 'VAT Reconciliation',
    form_revision: 'derived',
    frequency: FREQUENCY.MONTHLY,
    period_basis: PERIOD_BASIS.CALENDAR_MONTH,
    computation_key: 'VAT_RECONCILIATION',
    is_declaration: false,
    prerequisite_forms: ['2550M', '2550Q'],
    export_profiles: ['csv', 'pdf_a4'],
    deadline: null,
    applicability: { all: [registeredForVat] },
    notes:
      'The check that catches a misclassified sale. 12% of per-books revenue should agree with the Output VAT account balance; where it does not, the difference is the value of sales posted to revenue without a VAT tag, or of zero-rated/exempt sales that were never split out. Surfaced as a variance, never auto-corrected.',
    // Identity block, matching the forms that already declare one.
    header_fields: [
      { key: 'tin', label: 'TIN', width: 22 },
      { key: 'rdo_code', label: 'RDO Code', width: 10 },
      { key: 'registered_name', label: 'Registered Name', width: 40 },
      { key: 'registered_address', label: 'Registered Address', width: 40 },
    ],
    line_schema: [
      { key: 'books_revenue', line: 1, section: 'I', label: 'Revenue per books (accounts tagged as sales/revenue)', kind: 'computed', source: 'vat.books_revenue' },
      { key: 'implied_output_tax', line: 2, section: 'I', label: 'Implied output tax at 12%', kind: 'computed', formula: { op: 'percentOf', args: ['books_revenue'], rate: 0.12 } },
      { key: 'ledger_output_tax', line: 3, section: 'I', label: 'Output VAT per ledger (Output VAT account balance)', kind: 'computed', source: 'vat.output_tax_due' },
      { key: 'variance', line: 4, section: 'I', label: 'VARIANCE (unexplained difference)', kind: 'computed', formula: { op: 'subtract', args: ['implied_output_tax', 'ledger_output_tax'] }, emphasis: true },
    ],
  },
  {
    form_code: 'SCHED-CWT',
    category: CATEGORY.SCHEDULE,
    title: 'Schedule — Creditable Tax Withheld at Source by Payee and ATC (supporting 2307 and 1701/1702)',
    short_title: 'Creditable Tax Schedule',
    form_revision: 'derived',
    frequency: FREQUENCY.QUARTERLY,
    period_basis: PERIOD_BASIS.CALENDAR_QUARTER,
    computation_key: 'CWT_SCHEDULE',
    is_declaration: false,
    prerequisite_forms: ['2307', '1701', '1701A', '1702'],
    export_profiles: ['csv', 'xml', 'pdf_a4'],
    deadline: null,
    applicability: { all: [hasCreditableWithheld] },
    notes:
      'Feeds two consumers at once: the 2307 certificates issued to payees, and the creditable-tax line on the annual income tax return. A payee with no TIN on file is listed as blocked rather than omitted — an unblocked total that silently drops a payee is worse than a visible error.',
    // Identity block, matching the forms that already declare one.
    header_fields: [
      { key: 'tin', label: 'TIN', width: 22 },
      { key: 'rdo_code', label: 'RDO Code', width: 10 },
      { key: 'registered_name', label: 'Registered Name', width: 40 },
      { key: 'registered_address', label: 'Registered Address', width: 40 },
    ],
    line_schema: [
      {
        key: 'payee_detail',
        kind: 'schedule',
        label: 'Creditable tax withheld, by payee and ATC',
        columns: [
          { key: 'payee_name', label: 'Payee', type: 'text' },
          { key: 'payee_tin', label: "Payee's TIN", type: 'text' },
          { key: 'atc', label: 'ATC', type: 'text' },
          { key: 'period_1', label: 'Q1', type: 'amount' },
          { key: 'period_2', label: 'Q2', type: 'amount' },
          { key: 'period_3', label: 'Q3', type: 'amount' },
          { key: 'period_4', label: 'Q4', type: 'amount' },
          { key: 'total', label: 'Total', type: 'amount' },
          { key: 'tax_withheld', label: 'Tax Withheld', type: 'amount' },
          { key: 'certificate_status', label: '2307 Status', type: 'text' },
        ],
      },
      { key: 'total_base', line: 1, section: 'II', label: 'Total Income Payments', kind: 'subtotal', formula: { op: 'sumAtc', args: ['total'] }, emphasis: true },
      { key: 'total_tax_withheld', line: 2, section: 'II', label: 'Total Tax Withheld', kind: 'computed', source: 'cwt.total_tax_withheld', emphasis: true },
    ],
  },
]

// ===========================================================================
// The catalog
// ===========================================================================

const FORMS = [
  VAT_2550M,
  VAT_2550Q,
  EWT_0619E,
  EWT_1601E,
  EWT_1601C,
  EWT_1601EQ,
  EWT_1604C,
  EWT_1604E,
  INCOME_1701,
  INCOME_1701A,
  INCOME_1701Q,
  INCOME_1702,
  INCOME_1702Q,
  CERTIFICATE_2307,
  ...SCHEDULES,
]

// Normalised form-code lookup. Form codes are strings everywhere in this
// system. The pre-registry code used a bare number for 2307 in two places,
// which made `save-draft` and `mark-filed` disagree on which record to touch;
// normalising at the catalog boundary removes that class of bug.
const FORMS_BY_CODE = new Map(FORMS.map((form) => [String(form.form_code).trim(), form]))

const getForm = (formCode) => FORMS_BY_CODE.get(String(formCode || '').trim()) || null

// Resolve any punctuation variant to the exact registered code.
//
// "2550M", "2550-M", "2550 M" and "2550_M" all mean the same return, so a
// caller-supplied code is squashed to compare — but the value written to the
// database and returned to the client must be the canonical `form_code`. The
// squashed string is only a lookup key: SCHED-A squashes to SCHEDA, which
// matches no row, so squashing was making every hyphenated schedule code
// unfindable. The fallback map is keyed on the squashed form so the tolerant
// lookup still works.
const FORMS_BY_SQUASHED_CODE = new Map(
  FORMS.map((form) => [String(form.form_code).trim().toUpperCase().replace(/[\s\-_]/g, ''), form]),
)

/**
 * The canonical registered code for a caller-supplied code, or '' if unknown.
 * Exact match wins, so a real registered code is never re-interpreted.
 */
const resolveFormCode = (formCode) => {
  const exact = FORMS_BY_CODE.get(String(formCode || '').trim())
  if (exact) return exact.form_code
  const loose = FORMS_BY_SQUASHED_CODE.get(
    String(formCode || '')
      .trim()
      .toUpperCase()
      .replace(/[\s\-_]/g, ''),
  )
  return loose ? loose.form_code : ''
}

const isFilable = (form) =>
  Boolean(form) && form.category !== CATEGORY.SCHEDULE

module.exports = {
  TAXPAYER_TYPES,
  REGISTRATIONS,
  CATEGORY,
  FREQUENCY,
  PERIOD_BASIS,
  FORMS,
  FORMS_BY_CODE,
  resolveFormCode,
  getForm,
  isFilable,
  // rule fragments, exported so the seeder/tests can reason about the same
  // predicates the engine uses
  rules: {
    registeredForVat,
    isCorporation,
    isIndividualFilers,
    isEwtRemittingAgent,
    isWithholdingAgentForCompensation,
    hasCreditableWithheld,
    onCalendarYear,
  },
}
