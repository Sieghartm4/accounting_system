'use strict'

/**
 * Percentage tax computations - BIR Form 2551-Q.
 *
 * ## What percentage tax is
 *
 * NIRC Sec. 237 imposes 1% on the gross sales, receipts or revenues of persons
 * who are NOT registered as VAT-registered taxpayers. It is the substitute for
 * VAT, not an addition to it: a taxpayer covered by RA 10963 files 2550-Q and
 * owes no percentage tax, and a taxpayer outside it files 2551-Q and owes no
 * VAT. Filing both over the same gross receipts is the classic double filing.
 *
 * ## VERIFICATION REQUIRED BEFORE FILING
 *
 * The rate (1%), the filing window (within 10 days of the close of the quarter,
 * Sec. 237(D)) and the de minimis thresholds are statutory and changeable. They
 * are implemented here from the general rule rather than from a BIR
 * publication, so they must be checked against current BIR guidance before any
 * return produced here is filed.
 *
 * Specifically to confirm:
 *   - the de minimis thresholds (1,500 per month / 20,000 per quarter) and
 *     whether they still apply
 *   - whether "gross receipts" means receipts inclusive or exclusive of VAT for
 *     a taxpayer registered on only some of its activities
 *   - the treatment of receipts that are exempt from percentage tax
 *
 * The rate is defined once, as PERCENTAGE_TAX_RATE, and used for every figure
 * on the return, so a correction is one edit here and not one per line.
 */

const { round2 } = require('../ledger.service')

/** Sec. 237 rate. See the verification note above before filing. */
const PERCENTAGE_TAX_RATE = 0.01

/**
 * Receipts excluded from the base.
 *
 * The return asks for these separately rather than expecting them to be
 * excluded automatically: whether a receipt is subject to percentage tax
 * depends on the taxpayer's own registration status for that line of business,
 * which a ledger tag cannot reliably infer. Defaulting them to zero and
 * letting the accountant enter the figure keeps a wrongly-reduced base visible
 * on the form instead of silently biasing the tax down.
 */
const DEFAULT_EXEMPT_RECEIPTS = 0

const compute2551Q = (facts, options = {}) => {
  const { priorQuarterCredit = 0, amountPaid = 0 } = options

  // Gross receipts come from the same revenue accounts the VAT reconciliation
  // uses. For a non-VAT-registered taxpayer there is no output-tax tagging to
  // distinguish vatable from exempt, so revenue per books is the closest
  // honest starting point - and the exempt line is where the difference is
  // recorded.
  const grossReceipts = Number(facts?.books_revenue ?? facts?.gross_receipts ?? 0)
  const exemptReceipts = Number(options.exemptReceipts ?? DEFAULT_EXEMPT_RECEIPTS)

  const taxableReceipts = round2(grossReceipts - exemptReceipts)
  const percentageTaxDue = round2(taxableReceipts * PERCENTAGE_TAX_RATE)

  const credit = Number(priorQuarterCredit || 0)
  const balanceDue = round2(percentageTaxDue - credit)
  const stillDue = round2(balanceDue - amountPaid)

  const gaps = []

  // A VAT-registered taxpayer filing this return has already remitted the VAT
  // on the same receipts. This is raised as an error rather than a warning
  // because filing both is a real and common mistake, not a theoretical one.
  if (facts?.vat_registered === true) {
    gaps.push({
      key: 'pct.vat_registered_conflict',
      severity: 'error',
      message:
        'This taxpayer is VAT-registered, so percentage tax does not apply and no 2551-Q is due. Filing 2551-Q alongside 2550-Q would remit tax twice on the same receipts. Check the taxpayer profile.',
    })
  }

  // Only warn when the status is genuinely unknown. An explicit `false` is a
  // real answer - it means the taxpayer is NOT VAT-registered, which is exactly
  // who pays percentage tax - so testing it for truthiness would warn on the
  // very taxpayers this return exists for.
  if (facts?.vat_registered === null || facts?.vat_registered === undefined) {
    gaps.push({
      key: 'pct.vat_registered_unknown',
      severity: 'warning',
      message:
        'VAT registration status is not recorded on the taxpayer profile, so applicability could not be confirmed. Percentage tax applies only to taxpayers NOT registered as VAT-registered.',
    })
  }

  if (grossReceipts === 0) {
    gaps.push({
      key: 'pct.gross_receipts',
      severity: 'error',
      message:
        'No gross sales or receipts were found in the ledger for this quarter. A 2551-Q with a nil base is only correct if the taxpayer genuinely had no receipts - if sales exist but are posted to accounts not tagged as revenue, the return would understate the tax.',
      detail: { gross_receipts: round2(grossReceipts) },
    })
  }

  if (taxableReceipts < 0) {
    gaps.push({
      key: 'pct.negative_taxable_receipts',
      severity: 'error',
      message:
        'Receipts excluded from percentage tax exceed total gross receipts, giving a negative taxable base. Check the figure entered on the exempt line.',
      detail: {
        gross_receipts: round2(grossReceipts),
        exempt_receipts: round2(exemptReceipts),
        taxable_receipts: taxableReceipts,
      },
    })
  }

  // The de minimis is stated as a threshold, not applied silently: an accountant
  // should see that the quarter fell under it rather than find a nil return.
  const DE_MINIMIS_QUARTERLY = 20000
  if (taxableReceipts > 0 && taxableReceipts <= DE_MINIMIS_QUARTERLY) {
    gaps.push({
      key: 'pct.deminimis',
      severity: 'info',
      message: `Taxable receipts for the quarter are ₱${taxableReceipts.toLocaleString()}, at or below the ₱${DE_MINIMIS_QUARTERLY.toLocaleString()} de minimis. Verify that the threshold still applies before filing a nil return.`,
      detail: { taxable_receipts: taxableReceipts, de_minimis: DE_MINIMIS_QUARTERLY },
    })
  }

  return {
    lines: {
      gross_receipts: round2(grossReceipts),
      exempt_receipts: round2(exemptReceipts),
      taxable_receipts: taxableReceipts,
      percentage_rate: PERCENTAGE_TAX_RATE,
      percentage_tax_due: percentageTaxDue,
      prior_quarter_credit: round2(credit),
      percentage_tax_balance: balanceDue,
      amount_paid: round2(amountPaid),
      amount_still_due: stillDue,
    },
    // Percentage tax is not split by month for filing: 2551-Q is a single
    // quarterly return. No columns are declared, so the quarter must be read
    // from the ledger across all three months rather than from one.
    columns: {},
    gaps,
  }
}

module.exports = {
  compute2551Q,
  PERCENTAGE_TAX_RATE,
}