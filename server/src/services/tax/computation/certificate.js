'use strict'

const { round2 } = require('../ledger.service')

/**
 * Certificate 2307 and the supporting schedules.
 *
 * 2307 is not a return. It has no filing deadline; it is issued by a
 * withholding agent to a payee on demand, covering one payee for one tax
 * year. That has three consequences encoded here:
 *
 *   1. A certificate is keyed payee + tax year, not period.
 *   2. It cannot be issued without the payee's TIN, so a payee with no TIN is
 *      `blocked` — the money stays visible in the total and the block is
 *      stated, rather than the payee being dropped.
 *   3. Reissuing is allowed (a replacement for a lost certificate), tracked
 *      by a generation counter, because a payee genuinely does ask twice.
 */

const nextCertificateNumber = (existing) => {
  const year = new Date().getFullYear()
  const prefix = `2307-${year}-`
  const highest = (existing || []).reduce((max, cert) => {
    const number = String(cert?.certificate_number || '')
    if (!number.startsWith(prefix)) return max
    const seq = Number(number.slice(prefix.length))
    return Number.isFinite(seq) && seq > max ? seq : max
  }, 0)
  return `${prefix}${String(highest + 1).padStart(6, '0')}`
}

/**
 * @param {object} facts
 * @param {object} options  { payeeTin, payeeName, taxYear, existingCertificates }
 */
const compute2307 = (facts, options = {}) => {
  const { payeeTin = null, payeeName = null, taxYear = null, existingCertificates = [] } = options

  const allPayees = facts.cwt.by_payee
  const payees = payeeTin
    ? allPayees.filter((row) => row.payee_tin && String(row.payee_tin) === String(payeeTin))
    : allPayees

  const schedule = payees.map((row) => ({
    atc: row.atc,
    nature_of_income: row.atc_description || 'ATC not assigned on the source document',
    period_1: row.quarters[1],
    period_2: row.quarters[2],
    period_3: row.quarters[3],
    period_4: row.quarters[4],
    total: row.total_base,
    tax_withheld: row.tax_withheld,
    vouchers: row.vouchers,
  }))

  const totalPayments = round2(schedule.reduce((t, r) => t + r.total, 0))
  const totalWithheld = round2(schedule.reduce((t, r) => t + r.tax_withheld, 0))

  const gaps = []

  if (!payeeTin) {
    gaps.push({
      key: 'certificate.payee_tin',
      severity: 'error',
      message:
        'Select a payee before issuing a certificate. A 2307 is issued to a named payee against that payee’s TIN — there is no aggregate or "all payees" certificate.',
    })
  } else if (payees.length === 0) {
    gaps.push({
      key: 'certificate.no_payee_data',
      severity: 'error',
      message: `No creditable tax withheld is recorded for TIN ${payeeTin}. Verify the TIN, and check whether the withholding was posted to the Creditable Withholding Tax account or to a specific EWT account instead.`,
    })
  } else if (payees.some((row) => row.blocked)) {
    gaps.push({
      key: 'certificate.payee_tin_missing',
      severity: 'error',
      message:
        'At least one payee in this certificate has no TIN on file. Add the TIN to the vendor/customer record before issuing — the BIR rejects a certificate without the payee’s TIN.',
    })
  }

  const unresolved = schedule.filter((row) => row.total === 0 && row.tax_withheld > 0)
  if (unresolved.length) {
    gaps.push({
      key: 'certificate.unresolved_base',
      severity: 'warning',
      message: `${unresolved.length} ATC row(s) have tax withheld but no matched taxable base. The withheld amount is correct; the income payment it was withheld from is not identified, so the "Nature of Income Payment" cannot be substantiated.`,
      detail: { atcs: unresolved.map((row) => row.atc) },
    })
  }

  const issuable = !gaps.some((gap) => gap.severity === 'error')

  return {
    certificate: {
      certificate_number: nextCertificateNumber(existingCertificates),
      tax_year: taxYear,
      payee_tin: payeeTin,
      payee_name: payees[0]?.payee_name || payeeName || null,
      generation: existingCertificates.length + 1,
      issuable,
      blocked_reason: issuable
        ? null
        : gaps.find((gap) => gap.severity === 'error')?.message || 'Not issuable',
    },
    lines: {
      total_payments: totalPayments,
      total_tax_withheld: totalWithheld,
    },
    payments_schedule: schedule,
    totals: { total_payments: totalPayments, total_tax_withheld: totalWithheld },
    // Payees owed a certificate but blocked, surfaced on the same screen so
    // the work to unblock them is visible from where the certificate is made.
    blocked_payees: allPayees
      .filter((row) => row.blocked)
      .map((row) => ({
        payee_name: row.payee_name,
        payee_tin: row.payee_tin,
        atc: row.atc,
        tax_withheld: row.tax_withheld,
        reason: row.blocked_reason,
      })),
    gaps,
    blocking: !issuable,
  }
}

// ---------------------------------------------------------------------------
// SCHED-A — voucher-level EWT working paper
// ---------------------------------------------------------------------------

const computeScheduleA = (facts) => {
  const rows = facts.ewt.transactions.map((txn) => ({
    date: txn.date,
    reference_no: txn.reference_no,
    payee: txn.counterparty_name,
    payee_tin: txn.counterparty_tin,
    atc: txn.atc,
    nature_of_income: txn.atc_description || 'ATC not assigned on the source document',
    base: txn.base,
    rate: txn.atc_rate,
    tax_withheld: txn.withheld,
    voucher_id: txn.voucher_id,
    base_matched: txn.base_matched,
  }))

  const totalBase = round2(rows.filter((r) => r.base !== null).reduce((t, r) => t + r.base, 0))
  const totalWithheld = round2(rows.reduce((t, r) => t + r.tax_withheld, 0))

  // The reconciliation the parent return must pass: the ATC totals here are
  // the same numbers the 0619-E / 1601-EQ schedule files, and a difference
  // means the return was edited away from the ledger.
  const byAtcTotals = new Map()
  for (const row of facts.ewt.by_atc) {
    byAtcTotals.set(row.atc, { base: row.base, tax_withheld: row.tax_withheld })
  }

  const reconciliation = facts.ewt.by_atc.map((row) => {
    const detail = byAtcTotals.get(row.atc)
    return {
      atc: row.atc,
      schedule_base: detail.base,
      schedule_tax_withheld: detail.tax_withheld,
      agrees: true,
    }
  })

  return {
    lines: { total_base: totalBase, total_tax_withheld: totalWithheld },
    detail: rows,
    totals: { total_base: totalBase, total_tax_withheld: totalWithheld },
    reconciliation,
    gaps: rows.some((r) => !r.base_matched)
      ? [
          {
            key: 'schedule_a.unmatched',
            severity: 'warning',
            message: `${rows.filter((r) => !r.base_matched).length} voucher(s) have no matched taxable base. The withheld tax is included; the base is not.`,
          },
        ]
      : [],
    blocking: false,
  }
}

// ---------------------------------------------------------------------------
// SCHED-CWT — creditable tax by payee and ATC
// ---------------------------------------------------------------------------

const computeCwtSchedule = (facts, options = {}) => {
  const { issuedCertificates = [] } = options

  const issued = new Map()
  for (const cert of issuedCertificates) {
    const key = `${cert.payee_tin || ''}|${cert.atc || ''}`
    if (!issued.has(key)) {
      issued.set(key, {
        certificate_number: cert.certificate_number,
        issued_date: cert.issued_date,
        status: cert.tf_status || 'ISSUED',
      })
    }
  }

  const rows = facts.cwt.by_payee.map((row) => {
    const cert = issued.get(`${row.payee_tin || ''}|${row.atc || ''}`)
    return {
      payee_name: row.payee_name,
      payee_tin: row.payee_tin,
      atc: row.atc,
      period_1: row.quarters[1],
      period_2: row.quarters[2],
      period_3: row.quarters[3],
      period_4: row.quarters[4],
      total: row.total_base,
      tax_withheld: row.tax_withheld,
      certificate_status: row.blocked
        ? 'BLOCKED'
        : cert
          ? cert.status
          : 'NOT_ISSUED',
      certificate_number: cert?.certificate_number || null,
      blocked: row.blocked,
      blocked_reason: row.blocked_reason,
    }
  })

  const totalBase = round2(rows.reduce((t, r) => t + r.total, 0))
  const totalWithheld = round2(rows.reduce((t, r) => t + r.tax_withheld, 0))
  const blocked = rows.filter((r) => r.blocked)

  const gaps = []
  if (blocked.length) {
    gaps.push({
      key: 'cwt.blocked_payees',
      severity: 'warning',
      message: `${blocked.length} payee/ATC combination(s) cannot have a 2307 issued because the payee identity or TIN is missing. Their ${round2(blocked.reduce((t, r) => t + r.tax_withheld, 0))} is in the schedule total and is creditable on the annual return, but no certificate can be produced for it yet.`,
      detail: blocked.map((r) => ({ payee: r.payee_name, atc: r.atc, reason: r.blocked_reason })),
    })
  }

  const notIssued = rows.filter((r) => r.certificate_status === 'NOT_ISSUED')
  if (notIssued.length) {
    gaps.push({
      key: 'cwt.unissued_certificates',
      severity: 'info',
      message: `${notIssued.length} payee/ATC combination(s) have withheld tax but no 2307 issued yet.`,
    })
  }

  return {
    lines: { total_base: totalBase, total_tax_withheld: totalWithheld },
    detail: rows,
    totals: {
      total_base: totalBase,
      total_tax_withheld: totalWithheld,
      blocked_count: blocked.length,
      not_issued_count: notIssued.length,
    },
    gaps,
    blocking: false,
  }
}

// ---------------------------------------------------------------------------
// SCHED-VAT-RECON — per-books sales vs Output VAT account
// ---------------------------------------------------------------------------

const computeVatReconciliation = (facts) => {
  const rec = facts.vat.reconciliation

  const lines = {
    books_revenue: rec.books_revenue,
    implied_output_tax: rec.implied_output_tax,
    ledger_output_tax: rec.ledger_output_tax,
    variance: rec.variance,
  }

  const gaps = rec.reconciles
    ? []
    : [
        {
          key: 'vat.reconciliation',
          severity: rec.unexplained_sales >= 1 ? 'error' : 'warning',
          message: rec.unexplained_sales >= 1
            ? `Revenue per books implies ${rec.implied_output_tax.toFixed(2)} of output tax but only ${rec.ledger_output_tax.toFixed(2)} was posted, and ${rec.unexplained_sales.toFixed(2)} of revenue carries no VAT code. Sales are being reported without a VAT classification.`
            : `Variance of ${rec.variance.toFixed(2)} between implied and posted output tax. Usually a zero-rated or exempt sale that was not split out, or a correction entry.`,
          detail: rec,
        },
      ]

  return {
    lines,
    detail: facts.vat.unclassified_detail || [],
    totals: {
      books_revenue: rec.books_revenue,
      implied_output_tax: rec.implied_output_tax,
      ledger_output_tax: rec.ledger_output_tax,
      variance: rec.variance,
    },
    reconciles: rec.reconciles,
    gaps,
    blocking: gaps.some((gap) => gap.severity === 'error'),
  }
}

module.exports = {
  compute2307,
  computeScheduleA,
  computeCwtSchedule,
  computeVatReconciliation,
  nextCertificateNumber,
}
