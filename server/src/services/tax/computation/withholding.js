'use strict'

const { round2 } = require('../ledger.service')

/**
 * Withholding computations.
 *
 * The family breaks into two quite different problems, and conflating them is
 * the classic filing error:
 *
 *   Expanded withholding by non-employees  -> 0619-E (individual) /
 *                                               1601-EQ (corporation)
 *   Compensation withheld by an employer     -> 1601-E monthly, consolidated
 *                                               by 1601-C, summarised by
 *                                               1604-C / 1604-E
 *
 * A corporation normally files 1601-E monthly AND 1601-EQ for the quarter.
 * 1601-C does not replace the 1601-E monthlies; it consolidates them. So the
 * consolidated computation reads the filed monthlies rather than the ledger,
 * and reports the variance between the two — the previous implementation
 * hardcoded both remittance months to 0, which produced a "tax still due"
 * equal to the entire quarter's liability and quietly filed a false balance.
 */

const sum = (rows, key) =>
  rows.reduce((total, row) => total + (Number(row[key]) || 0), 0)

// ---------------------------------------------------------------------------
// 0619-E — monthly EWT return, individual remitters
// ---------------------------------------------------------------------------

const compute0619E = (facts, options = {}) => {
  const { inputs = {}, remittances = [] } = options
  const amountPaid = Number(inputs.amount_paid || 0)
  const ewt = facts.ewt

  const totalBase = round2(ewt.total_base)
  const totalWithheld = round2(ewt.total_tax_withheld)

  // Prior-period credit is only real money if a remittance actually exists
  // showing an overpayment. Absent that, it is zero — but a gap is raised so
  // the accountant confirms rather than assumes.
  const priorCredit = round2(sum(remittances, 'overpayment'))

  const netRemittance = round2(totalWithheld - priorCredit)
  const overpayment = round2(totalWithheld - netRemittance)

  const gaps = [...(ewt.unmatched_count
    ? [
        {
          key: 'ewt.unmatched_base',
          severity: 'warning',
          message: `${ewt.unmatched_count} withholding transaction(s) could not be matched to a taxable base posting in the same source document. Their withheld tax is included in the total; their base is not. Check the ATC on the source document.`,
        },
      ]
    : [])]

  if (ewt.inferred_atc_count > 0) {
    gaps.push({
      key: 'ewt.inferred_atc',
      severity: 'warning',
      message: `${ewt.inferred_atc_count} transaction(s) have no ATC on the source document and are grouped under UNSPECIFIED. The total is correct but the ATC schedule is not — the 0619-E schedule is filed per ATC.`,
    })
  }

  if (priorCredit === 0) {
    gaps.push({
      key: 'ewt.prior_period_credit',
      severity: 'info',
      message:
        'No prior-period overpayment recorded. Line 21 is zero unless a previous 0619-E was filed showing more paid than due.',
    })
  }

  return {
    lines: {
      total_base: totalBase,
      total_tax_withheld: totalWithheld,
      net_payable: netRemittance,
      prior_period_credit: priorCredit,
      amount_paid: round2(amountPaid),
      total_remittance: netRemittance,
      amount_overpaid: overpayment,
    },
    atc_schedule: ewt.by_atc.map((row) => ({
      atc: row.atc,
      description: row.description || 'ATC not assigned on the source document',
      base: row.base,
      rate: row.rate === null ? null : Number(row.rate),
      tax_withheld: row.tax_withheld,
      unmatched: row.unmatched,
      inferred: row.inferred,
    })),
    totals: {
      total_base: totalBase,
      total_tax_withheld: totalWithheld,
      total_remittance: netRemittance,
    },
    gaps,
    blocking: gaps.some((gap) => gap.severity === 'error'),
  }
}

// ---------------------------------------------------------------------------
// 1601-EQ — quarterly EWT return, corporations
// ---------------------------------------------------------------------------

const compute1601EQ = (facts, options = {}) => {
  const { inputs = {}, period = null, remittances = [] } = options
  const amountPaid = Number(inputs.amount_paid || 0)
  const priorPeriodCredit = Number(inputs.prior_period_credit || 0)
  const ewt = facts.ewt
  const months = (period && period.months) || []

  const totalWithheld = round2(ewt.total_tax_withheld)
  const totalBase = round2(ewt.total_base)

  // Remittance lines must come from real remittance records for the quarter's
  // months. Anything missing is reported as missing, not as zero — "no
  // remittance recorded" and "nothing was remitted" are different statements
  // and only one of them can justify a nil figure on a filed return.
  const remitLines = months.map((month, index) => {
    const record = remittances.find(
      (r) => String(r.period_start || r.month || '').slice(0, 7) === month,
    )
    return {
      key: ['remit_prior', 'remit_second', 'remit_third'][index] || `remit_${index}`,
      month,
      amount: record ? round2(record.amount_remitted || record.amount_paid || 0) : null,
      record: record || null,
    }
  })

  const recordedRemittances = remitLines.filter((r) => r.amount !== null)
  const totalRemittances = round2(sum(recordedRemittances, 'amount'))
  const missingRemittances = remitLines.filter((r) => r.amount === null).map((r) => r.month)

  const taxStillDue = round2(totalWithheld - totalRemittances)
  const totalRemittance = round2(taxStillDue + priorPeriodCredit)
  const amountStillDue = round2(totalRemittance - amountPaid)

  const gaps = []

  if (missingRemittances.length) {
    gaps.push({
      key: 'ewt.remittance_months',
      severity: 'error',
      message: `No remittance recorded for ${missingRemittances.join(', ')}. The "tax still due" figure on this return depends on the monthlies actually remitted inside the quarter — without them the balance cannot be computed and must not be filed as zero.`,
      detail: { missing_months: missingRemittances },
    })
  }

  if (totalRemittances > totalWithheld && totalWithheld > 0) {
    gaps.push({
      key: 'ewt.over_remittance',
      severity: 'warning',
      message: `Remittances (${totalRemittances.toFixed(2)}) exceed the tax withheld for the quarter (${totalWithheld.toFixed(2)}). The excess is a credit carried forward — confirm against the monthly 1601-E / 1604-C filings.`,
    })
  }

  if (ewt.unmatched_count > 0) {
    gaps.push({
      key: 'ewt.unmatched_base',
      severity: 'warning',
      message: `${ewt.unmatched_count} withholding transaction(s) have no matching taxable base posting. Their tax is in the total; their base is not.`,
    })
  }

  if (priorPeriodCredit === 0) {
    gaps.push({
      key: 'ewt.prior_period_credit',
      severity: 'info',
      message:
        'No prior-quarter over-remittance entered. Line 26 stays at zero unless the previous 1601-EQ was filed showing more paid than due.',
    })
  }

  return {
    lines: {
      total_base: totalBase,
      total_tax_withheld: totalWithheld,
      remit_prior: remitLines[0]?.amount ?? null,
      remit_second: remitLines[1]?.amount ?? null,
      remit_third: remitLines[2]?.amount ?? null,
      total_remittances: totalRemittances,
      tax_still_due: taxStillDue,
      prior_period_credit: round2(priorPeriodCredit),
      total_remittance: totalRemittance,
      amount_paid: round2(amountPaid),
      amount_still_due: amountStillDue,
    },
    atc_schedule: ewt.by_atc.map((row) => ({
      atc: row.atc,
      description: row.description || 'ATC not assigned on the source document',
      base: row.base,
      rate: row.rate === null ? null : Number(row.rate),
      tax_withheld: row.tax_withheld,
      unmatched: row.unmatched,
      inferred: row.inferred,
    })),
    remittance_lines: remitLines,
    totals: {
      total_base: totalBase,
      total_tax_withheld: totalWithheld,
      total_remittances: totalRemittances,
      tax_still_due: taxStillDue,
      total_remittance: totalRemittance,
      amount_still_due: amountStillDue,
    },
    gaps,
    blocking: gaps.some((gap) => gap.severity === 'error'),
  }
}

// ---------------------------------------------------------------------------
// 1601-E — monthly compensation withholding
// ---------------------------------------------------------------------------

const compute1601E = (facts, options = {}) => {
  const { inputs = {}, remittances = [] } = options
  const amountPaid = Number(inputs.amount_paid || 0)
  const comp = facts.comp

  const totalWithheld = round2(comp.tax_withheld)
  const priorCredit = round2(sum(remittances, 'overpayment'))
  const totalRemittance = round2(totalWithheld - priorCredit)
  const stillDue = round2(totalRemittance - amountPaid)

  const gaps = [...(comp.gaps || [])]
  if (priorCredit === 0) {
    gaps.push({
      key: 'comp.prior_period_credit',
      severity: 'info',
      message: 'No prior-period overpayment recorded. Line 9 stays at zero unless a previous 1601-E was filed showing more paid than due.',
    })
  }

  return {
    lines: {
      total_compensation: comp.total_compensation,
      compensation_taxable: comp.taxable_compensation,
      tax_withheld: totalWithheld,
      net_payable: totalWithheld,
      prior_period_credit: priorCredit,
      total_remittance: totalRemittance,
      amount_paid: round2(amountPaid),
      amount_still_due: stillDue,
    },
    payee_detail: comp.rows,
    totals: {
      total_compensation: comp.total_compensation,
      tax_withheld: totalWithheld,
      total_remittance: totalRemittance,
      amount_still_due: stillDue,
    },
    gaps,
    blocking: gaps.some((gap) => gap.severity === 'error'),
  }
}

// ---------------------------------------------------------------------------
// 1601-C — consolidated quarterly compensation remittance
// ---------------------------------------------------------------------------

/**
 * Derived from the filed 1601-E monthlies, not from the ledger. Reading the
 * ledger directly would restate a quarter that has already been remitted
 * against its monthlies; the two must be compared instead.
 */
const compute1601C = (facts, options = {}) => {
  const { inputs = {}, period = null, filedMonthlies = [] } = options
  const amountPaid = Number(inputs.amount_paid || 0)
  const priorPeriodCredit = Number(inputs.prior_period_credit || 0)
  const comp = facts.comp
  const months = (period && period.months) || []

  const monthDetail = months.map((month, index) => {
    const filed = filedMonthlies.find((m) => String(m.start || '').slice(0, 7) === month)
    return {
      index,
      month,
      line_key: [`month_1_compensation`, `month_2_compensation`, `month_3_compensation`][index],
      filed: Boolean(filed),
      compensation: filed ? round2(filed.lines?.total_compensation || 0) : null,
      tax_withheld: filed ? round2(filed.lines?.tax_withheld || 0) : null,
      filing_id: filed?.tf_id || null,
      status: filed?.tf_status || null,
    }
  })

  const allFiled = monthDetail.length > 0 && monthDetail.every((m) => m.filed)
  const missing = monthDetail.filter((m) => !m.filed).map((m) => m.month)

  const lines = {}
  for (const detail of monthDetail) {
    lines[detail.line_key] = detail.compensation
  }

  const totalCompensation = allFiled
    ? round2(sum(monthDetail, 'compensation'))
    : round2(sum(monthDetail.filter((m) => m.compensation !== null), 'compensation'))
  const totalWithheld = allFiled
    ? round2(sum(monthDetail, 'tax_withheld'))
    : round2(sum(monthDetail.filter((m) => m.tax_withheld !== null), 'tax_withheld'))

  // Ledger view, kept only to report the variance.
  const ledgerCompensation = round2(comp.total_compensation)
  const ledgerWithheld = round2(comp.tax_withheld)
  const variance = {
    compensation: round2(totalCompensation - ledgerCompensation),
    tax_withheld: round2(totalWithheld - ledgerWithheld),
  }

  const totalRemittance = round2(totalWithheld - priorPeriodCredit)
  const stillDue = round2(totalRemittance - amountPaid)

  const gaps = []

  if (missing.length) {
    gaps.push({
      key: 'consolidated.missing_monthlies',
      severity: 'error',
      message: `1601-E is not on file for ${missing.join(', ')}. A 1601-C consolidates the monthlies; it cannot be computed without them.`,
      detail: { missing_months: missing },
    })
  }

  const materialVariance = allFiled && Object.values(variance).some((v) => Math.abs(v) >= 1)
  if (materialVariance) {
    gaps.push({
      key: 'consolidated.ledger_variance',
      severity: 'warning',
      message:
        'The filed monthlies differ from the ledger for this quarter. The consolidation follows the monthlies (as filed); the difference usually means the ledger was adjusted after the monthly return was filed.',
      detail: variance,
    })
  }

  return {
    lines: {
      ...lines,
      total_compensation: totalCompensation,
      tax_withheld: totalWithheld,
      prior_period_credit: round2(priorPeriodCredit),
      total_remittance: totalRemittance,
      amount_paid: round2(amountPaid),
      amount_still_due: stillDue,
    },
    columns: {
      month_1_compensation: [monthDetail[0]?.compensation ?? null, monthDetail[0]?.tax_withheld ?? null],
      month_2_compensation: [monthDetail[1]?.compensation ?? null, monthDetail[1]?.tax_withheld ?? null],
      month_3_compensation: [monthDetail[2]?.compensation ?? null, monthDetail[2]?.tax_withheld ?? null],
    },
    monthly_breakdown: monthDetail,
    derived_from_monthlies: allFiled,
    ledger_variance: variance,
    ledger_totals: {
      compensation: ledgerCompensation,
      tax_withheld: ledgerWithheld,
    },
    totals: {
      total_compensation: totalCompensation,
      tax_withheld: totalWithheld,
      total_remittance: totalRemittance,
      amount_still_due: stillDue,
    },
    gaps,
    blocking: gaps.some((gap) => gap.severity === 'error'),
  }
}

// ---------------------------------------------------------------------------
// 1604-C / 1604-E — quarterly summary lists
// ---------------------------------------------------------------------------

const compute1604 = (facts, options = {}) => {
  const { period, filedMonthlies = [] } = options
  const ewt = facts.ewt
  const comp = facts.comp
  const months = (period && period.months) || []

  // A 1604 summary's purpose is to support the quarterly compensation
  // remittance, so it aggregates the compensation withholding the monthlies
  // reported — by ATC, per month of the quarter.
  const source = comp.rows.length ? comp.rows : ewt.transactions

  const byAtc = new Map()
  for (const row of source) {
    const atc = row.atc || 'UNSPECIFIED'
    if (!byAtc.has(atc)) {
      byAtc.set(atc, {
        atc,
        description: row.atc_description || null,
        base_by_month: { 1: 0, 2: 0, 3: 0 },
        base: 0,
        tax_withheld: 0,
        unmatched: 0,
      })
    }
    const bucket = byAtc.get(atc)
    const monthIndex = months.findIndex(
      (m) => String(row.date || '').slice(0, 7) === m,
    )
    if (row.base !== null && row.base !== undefined) {
      bucket.base += row.base
      if (monthIndex >= 0) bucket.base_by_month[monthIndex + 1] += row.base
    } else {
      bucket.unmatched += 1
    }
    bucket.tax_withheld += row.withheld ?? row.tax_withheld ?? 0
  }

  const schedule = Array.from(byAtc.values()).map((row) => ({
    atc: row.atc,
    description: row.description || 'ATC not assigned on the source document',
    month_1: round2(row.base_by_month[1]),
    month_2: round2(row.base_by_month[2]),
    month_3: round2(row.base_by_month[3]),
    base: round2(row.base),
    rate: null,
    tax_withheld: round2(row.tax_withheld),
    unmatched: row.unmatched,
  }))

  const totalBase = round2(sum(schedule, 'base'))
  const totalWithheld = round2(sum(schedule, 'tax_withheld'))

  const gaps = []

  if (filedMonthlies.length && !source.length) {
    gaps.push({
      key: 'summary.no_compensation_detail',
      severity: 'error',
      message:
        'Monthlies are on file but no compensation withholding could be read from the ledger, so the summary cannot be tied back. Check how payroll entries post their WHT leg.',
    })
  }

  if (!source.length) {
    gaps.push({
      key: 'summary.empty',
      severity: 'warning',
      message:
        'No compensation withholding in this period. If this return is genuinely nil, file it as nil — a summary list is still a required return once the taxpayer is a registered withholding agent.',
    })
  }

  return {
    lines: {
      total_base: totalBase,
      total_tax_withheld: totalWithheld,
    },
    atc_schedule: schedule,
    totals: { total_base: totalBase, total_tax_withheld: totalWithheld },
    gaps,
    blocking: gaps.some((gap) => gap.severity === 'error'),
  }
}

module.exports = {
  compute0619E,
  compute1601EQ,
  compute1601E,
  compute1601C,
  compute1604,
}
