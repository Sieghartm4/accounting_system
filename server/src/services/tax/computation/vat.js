'use strict'

const { round2 } = require('../ledger.service')

/**
 * VAT computations — 2550M and 2550Q.
 *
 * The distinguishing problem for 2550Q is that it must agree with the three
 * 2550M monthlies already filed for the quarter. Rather than recomputing the
 * quarter from the ledger and hoping it matches (it will disagree whenever a
 * month was adjusted after filing), the quarterly module is handed the filed
 * monthlies and reports the variance per month. A 2550Q that silently differs
 * from its own monthlies is a rejected return.
 */

const pct = (value, rate) => round2(Number(value || 0) * rate)

/**
 * @param {object} facts    fact bag from ledger.service.collectTaxFacts
 * @param {object} options  { period, priorPeriodCredit, filedMonthlies, form }
 */
const compute2550M = (facts, options = {}) => {
  const { period, priorPeriodCredit = 0, amountPaid = 0 } = options
  const vat = facts.vat

  // The ledger service already clamps each side, so payable and overpayment
  // are never both positive and the pair always reconciles to the signed line.
  const netPayable = round2(vat.net_vat_payable)
  const overpayment = round2(vat.net_vat_overpayment)
  const totalPayable = round2(netPayable + priorPeriodCredit)
  const stillDue = round2(totalPayable - amountPaid)

  const gaps = [...(vat.gaps || [])]
  if (priorPeriodCredit === 0) {
    gaps.push({
      key: 'vat.prior_period_credit',
      severity: 'info',
      message:
        'No prior-period input-tax credit entered. Enter the overpayment claimed on the previous 2550 on line 12, or leave it at zero if none is being claimed.',
    })
  }

  return {
    lines: {
      vat_payable_prior_period: round2(priorPeriodCredit),
      sales_total: vat.vatable_sales + vat.exempt_sales + vat.zero_rated_sales + vat.export_sales,
      vatable_sales: vat.vatable_sales,
      exempt_sales: vat.exempt_sales,
      zero_rated_sales: vat.zero_rated_sales,
      export_sales: vat.export_sales,
      output_tax_due: vat.output_tax_due,
      input_tax_total: vat.input_tax_total,
      excess_input_tax: vat.excess_input_tax,
      net_vat_payable: netPayable,
      net_vat_overpayment: vat.net_vat_overpayment,
      vat_payable_this_period: totalPayable,
      amount_paid: round2(amountPaid),
      amount_still_due: stillDue,
    },
    totals: {
      total_payable: totalPayable,
      amount_still_due: stillDue,
      overpayment: overpayment,
    },
    reconciliation: vat.reconciliation,
    schedules: buildVatSchedules(facts, options),
    gaps,
    blocking: gaps.some((gap) => gap.severity === 'error'),
  }
}

const compute2550Q = (facts, options = {}) => {
  const { period, filedMonthlies = [], priorPeriodCredit = 0, amountPaid = 0 } = options
  const months = (period && period.months) || []

  const monthly = months.map((month) => {
    const filed = filedMonthlies.find(
      (m) => String(m.start || '').slice(0, 7) === month,
    )
    return { month, filed: filed || null }
  })

  // When the monthlies are on file, the quarter IS the monthlies. Summing the
  // ledger instead would produce a different number with no explanation.
  const useFiledMonthlies = monthly.length > 0 && monthly.every((m) => m.filed)

  const base = useFiledMonthlies
    ? null
    : compute2550M(facts, { ...options, priorPeriodCredit, amountPaid: 0 })

  const lineFromMonthly = (key) =>
    round2(
      monthly.reduce(
        (total, m) => total + Number(m.filed?.lines?.[key] || 0),
        0,
      ),
    )

  const perMonth = (key) => {
    const values = monthly.map((m) => Number(m.filed?.lines?.[key] || 0))
    const total = values.reduce((a, b) => a + b, 0)
    return [...values, round2(total)]
  }

  const get = (key) =>
    useFiledMonthlies ? lineFromMonthly(key) : Number(base.lines[key] || 0)

  const totalPayable = get('vat_payable_this_period')
  const stillDue = round2(totalPayable - amountPaid)

  const gaps = [...(useFiledMonthlies ? [] : base.gaps)]

  if (!useFiledMonthlies) {
    const missing = monthly.filter((m) => !m.filed).map((m) => m.month)
    gaps.push({
      key: 'vat_2550q_monthlies',
      severity: 'error',
      message: missing.length
        ? `No filed 2550M found for ${missing.join(', ')}. A quarterly return consolidates the monthlies; compute it from the ledger instead and the figures may not match what was already filed.`
        : 'No filed 2550M monthlies were supplied; the quarter was computed directly from the ledger.',
      detail: { missing_months: missing },
    })
  }

  // Cross-check: the quarter built from the monthlies must equal the quarter
  // computed from the ledger. A difference means the ledger moved after the
  // monthlies were filed.
  let variance = null
  if (useFiledMonthlies) {
    const ledgerQuarter = compute2550M(facts, { ...options, priorPeriodCredit: 0, amountPaid: 0 })
    variance = {
      output_tax_due: round2(get('output_tax_due') - Number(ledgerQuarter.lines.output_tax_due || 0)),
      input_tax_total: round2(get('input_tax_total') - Number(ledgerQuarter.lines.input_tax_total || 0)),
      vatable_sales: round2(get('vatable_sales') - Number(ledgerQuarter.lines.vatable_sales || 0)),
    }
    const material = Object.values(variance).some((value) => Math.abs(value) >= 1)
    if (material) {
      gaps.push({
        key: 'vat_2550q_variance',
        severity: 'error',
        message:
          'The filed monthlies do not agree with the ledger for this quarter. Either the ledger was adjusted after filing or a monthly is wrong. Resolve before filing the 2550Q.',
        detail: variance,
      })
    }
  }

  const withColumns = (key) => perMonth(key)

  return {
    lines: {
      vat_payable_prior_period: round2(priorPeriodCredit),
      sales_total: get('sales_total'),
      vatable_sales: get('vatable_sales'),
      exempt_sales: get('exempt_sales'),
      zero_rated_sales: get('zero_rated_sales'),
      export_sales: get('export_sales'),
      output_tax_due: get('output_tax_due'),
      input_tax_total: get('input_tax_total'),
      excess_input_tax: get('excess_input_tax'),
      net_vat_payable: get('net_vat_payable'),
      vat_payable_this_period: totalPayable,
      amount_paid: round2(amountPaid),
      amount_still_due: stillDue,
    },
    columns: {
      vatable_sales: withColumns('vatable_sales'),
      exempt_sales: withColumns('exempt_sales'),
      zero_rated_sales: withColumns('zero_rated_sales'),
      export_sales: withColumns('export_sales'),
      output_tax_due: withColumns('output_tax_due'),
      input_tax_total: withColumns('input_tax_total'),
      net_vat_payable: withColumns('net_vat_payable'),
      sales_total: withColumns('sales_total'),
    },
    monthly_breakdown: monthly,
    derived_from_monthlies: useFiledMonthlies,
    monthlies_variance: variance,
    totals: { total_payable: totalPayable, amount_still_due: stillDue },
    reconciliation: facts.vat.reconciliation,
    schedules: buildVatSchedules(facts, options),
    gaps,
    blocking: gaps.some((gap) => gap.severity === 'error'),
  }
}

const buildVatSchedules = (facts, options = {}) => {
  const vat = facts.vat
  return {
    schedule_1: {
      title: 'Sales/Receipts subject to 12% VAT',
      total: vat.vatable_sales,
      rows: [
        { label: 'Vatable sales, per Sales and Receipts accounts', amount: vat.vatable_sales },
        { label: 'Implied output tax at 12%', amount: pct(vat.vatable_sales, vat.rate) },
        { label: 'Output tax actually posted to the Output VAT account', amount: vat.output_tax_due },
        {
          label: 'Difference (sales posted without a VAT tag, or misclassified)',
          amount: round2(pct(vat.vatable_sales, vat.rate) - vat.output_tax_due),
          flagged: Math.abs(pct(vat.vatable_sales, vat.rate) - vat.output_tax_due) >= 1,
        },
      ],
    },
    schedule_2: {
      title: 'Exempt Sales/Receipts',
      total: vat.exempt_sales,
      rows: [{ label: 'Exempt sales per exempt-coded sales documents', amount: vat.exempt_sales }],
    },
    schedule_3: {
      title: 'Special (Zero-Rated) Sales/Receipts',
      total: vat.zero_rated_sales,
      rows: [{ label: 'Zero-rated sales per zero-rated-coded sales documents', amount: vat.zero_rated_sales }],
    },
    schedule_4: {
      title: 'Export Sales/Receipts',
      total: vat.export_sales,
      rows: [{ label: 'Export sales', amount: vat.export_sales }],
    },
    schedule_6: {
      title: 'Creditable Tax Withheld at Source (VAT withheld by government)',
      total: facts.cwt.total_tax_withheld,
      rows: [
        {
          label: 'Creditable tax withheld (from Creditable Withholding Tax postings)',
          amount: facts.cwt.total_tax_withheld,
        },
      ],
      note: 'Only VAT withheld by a government agency is creditable here; EWT on other income is a different credit line on the annual return.',
    },
    unallocated: {
      title: 'Sales not assigned a VAT code',
      total: vat.unclassified_sales,
      rows: vat.unclassified_sales
        ? [
            { label: 'Unclassified', amount: vat.unclassified_sales },
            ...(vat.unclassified_detail || []).map((detail) => ({
              label: detail.reason,
              amount: detail.amount,
            })),
          ]
        : [],
      note:
        'Excluded from Part I. Reporting these as vatable would overstate output tax; excluding them silently would understate sales. Resolve the VAT coding on the source documents.',
    },
  }
}

module.exports = { compute2550M, compute2550Q, buildVatSchedules, pct }
