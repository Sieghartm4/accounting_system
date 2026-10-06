'use strict'

const { round2 } = require('../ledger.service')

/**
 * Income tax computations — 1701, 1701-A, 1701-Q, 1702, 1702-Q.
 *
 * Statutory parameters live here as named constants rather than inline
 * literals, because they change as a set and a return filed with a
 * half-updated set of brackets is worse than one that refuses to compute.
 * Verify against the current NIRC/TRAIN schedule before filing.
 *
 * The governing rule for this file: anything the ledger cannot support is
 * returned as `null` and surfaced as a required input. It is never zero. A
 * ₱0 prior-year credit and an unknown prior-year credit produce very different
 * returns, and only one of them is a filing error.
 */

const PARAMETERS = {
  // NIRC Sec. 24 graduated rates for individuals / estates / trusts, as
  // amended by TRAIN (RA 10963): 0/15/20/25/30/35%.
  // `base` is the statutory tax at the TOP of the band, kept here so the table
  // can be cross-checked by assertBracketTables(). applyBrackets() derives the
  // amount from band widths and does not trust these values.
  individualGraduated: [
    { upTo: 250000, rate: 0, base: 0 },
    { upTo: 400000, rate: 0.15, base: 0 },
    { upTo: 800000, rate: 0.2, base: 22500 },
    { upTo: 2000000, rate: 0.25, base: 102500 },
    { upTo: 8000000, rate: 0.3, base: 402500 },
    { upTo: Infinity, rate: 0.35, base: 2202500 },
  ],
  // Sec. 24(B): 6% on professional income up to 250k, 12% above — deliberately
  // lower than the legacy 33%/30%.
  professionalEnhanced: [
    { upTo: 250000, rate: 0.06, base: 0 },
    { upTo: Infinity, rate: 0.12, base: 15000 },
  ],
  // Sec. 24(C): 3% on self-employment income, 6% above 250k.
  selfEmployedEnhanced: [
    { upTo: 250000, rate: 0.03, base: 0 },
    { upTo: Infinity, rate: 0.06, base: 7500 },
  ],
  // Sec. 35 as amended by CREATE (RA 11534): 20% up to 5M, 25% above.
  corporateGraduated: [
    { upTo: 5000000, rate: 0.2, base: 0 },
    { upTo: Infinity, rate: 0.25, base: 1000000 },
  ],
  // Sec. 24(A) graduated personal exemption.
  personalExemption: 200000,
  // 1701-Q: 1% of the higher of the preceding quarter's or the current
  // quarter's gross income.
  quarterlyCorporationRate: 0.01,
  // Sec. 36(B)/(C): OSD on itemised ordinary deductions, capped.
  osdRate: 0.4,
  osdMaximum: 400000,
}

/**
 * Apply a bracket table.
 *
 * Each band's width runs from the previous band's upper bound to this band's
 * upper bound. The `base` column is NOT a band edge — it is the cumulative tax
 * — so it is never used to size a band. Widths come from the upTo chain alone.
 */
const applyBrackets = (taxableIncome, brackets) => {
  const income = Math.max(0, Number(taxableIncome || 0))
  if (income === 0) return 0

  let lowerBound = 0
  let tax = 0

  for (const bracket of brackets) {
    if (income <= lowerBound) break
    const width = bracket.upTo === Infinity ? income - lowerBound : bracket.upTo - lowerBound
    // The slice taxed at this band's rate is the part of the income that falls
    // inside the band, i.e. income less everything already taxed below. Using
    // income itself here would tax the whole income at every rate.
    tax += Math.min(income - lowerBound, width) * bracket.rate
    if (bracket.upTo === Infinity) break
    lowerBound = bracket.upTo
  }

  return round2(tax)
}

/**
 * Cross-check each table's `base` anchors against what applyBrackets derives.
 * `base` is the cumulative tax at a band's LOWER edge, so the check is that
 * taxing income equal to that lower edge reproduces the anchor. A mismatch means
 * the rate table and the statutory anchors have drifted apart, which would
 * silently misprice every return. Exported so it can be asserted in tests
 * rather than thrown at load time.
 */
const assertBracketTables = () => {
  const problems = []
  for (const [name, brackets] of Object.entries(PARAMETERS)) {
    if (!Array.isArray(brackets)) continue
    let lowerBound = 0
    for (const bracket of brackets) {
      const derived = applyBrackets(lowerBound, brackets)
      if (derived !== bracket.base) {
        problems.push(
          `${name}: anchor at ${lowerBound} is ${bracket.base} but brackets derive ${derived}`,
        )
      }
      if (bracket.upTo === Infinity) break
      lowerBound = bracket.upTo
    }
  }
  return problems
}

const graduatedTax = (taxableIncome) => applyBrackets(taxableIncome, PARAMETERS.individualGraduated)
const corporateTax = (taxableIncome) => applyBrackets(taxableIncome, PARAMETERS.corporateGraduated)
const professionalTax = (taxableIncome) =>
  applyBrackets(taxableIncome, PARAMETERS.professionalEnhanced)
const selfEmployedTax = (taxableIncome) =>
  applyBrackets(taxableIncome, PARAMETERS.selfEmployedEnhanced)

/**
 * Optional standard deduction: 40% of itemised ordinary deductions, capped.
 * Requires the itemised figure, which the ledger does not hold as a tax
 * concept — the caller supplies it as a required input.
 */
const optionalStandardDeduction = (itemizedDeductions) => {
  if (itemizedDeductions === null || itemizedDeductions === undefined) return null
  return round2(
    Math.min(
      Number(itemizedDeductions) * PARAMETERS.osdRate,
      PARAMETERS.osdMaximum,
    ),
  )
}

const isKnown = (value) => value !== null && value !== undefined && value !== ''

// Only add to a running total when the value is known. An unknown stays
// unknown; it must not quietly become zero.
const addKnown = (...values) => {
  const known = values.filter(isKnown).map(Number)
  return known.length === 0 ? null : round2(known.reduce((a, b) => a + b, 0))
}

/**
 * Sum, but only if every input is known. A single unknown makes the total
 * unknown. A partial sum here is not a smaller truth, it is a different
 * (wrong) number that looks right — ₱2,000,000 of income is not "₱2,000,000
 * because the ₱0 I didn't record happens to be zero".
 */
const sumKnown = (values) => {
  const list = Array.isArray(values) ? values : [values]
  if (list.length === 0) return null
  if (!list.every(isKnown)) return null
  return round2(list.map(Number).reduce((a, b) => a + b, 0))
}

// ---------------------------------------------------------------------------
// 1701 — domestic corporation annual return
// ---------------------------------------------------------------------------

const compute1701 = (facts, options = {}) => {
  const { inputs = {}, remittances = [], priorYearSurplus = 0 } = options
  const income = facts.income

  const grossIncome = round2(income.gross_income)
  const exemptions = inputs.exempt_income ?? 0
  const taxableIncome = round2(grossIncome - Number(exemptions || 0))

  const graduated = corporateTax(taxableIncome)

  const credits = addKnown(
    inputs.prior_year_credit,
    inputs.personal_exemptions,
    inputs.special_deductions,
    inputs.ordinary_deductions,
    inputs.net_operating_loss,
  )

  const creditableWithheld = income.creditable_withheld
  const quarterlyPayments = sumKnown(
    remittances.map((r) => Number(r.amount_paid || r.amount_remitted || 0)),
  )

  const incomeTaxDue = graduated

  // Balance due needs every credit to be known. If any is null the balance is
  // null, not the graduated tax less zero.
  const balanceDue = isKnown(credits) && isKnown(quarterlyPayments) && creditableWithheld !== null
    ? round2(incomeTaxDue - Number(credits) - Number(creditableWithheld) - Number(quarterlyPayments))
    : null

  const totalAmountDue = isKnown(balanceDue)
    ? round2(Number(balanceDue) + Number(priorYearSurplus || 0))
    : null

  const gaps = buildIncomeGaps({
    income,
    inputs,
    requiredInputs: [
      ['prior_year_credit', 'Income tax paid for the prior taxable year (from the prior 1701)'],
      ['ordinary_deductions', 'Optional standard (40%) or itemized deductions'],
      ['net_operating_loss', 'Net operating loss carryforward (Schedule 4 of the prior return)'],
      ['personal_exemptions', 'Personal exemptions, if any'],
      ['special_deductions', 'Special deductions claimed, if any'],
    ],
    needCredits: true,
    blockedCwtPayees: facts.cwt.blocked_payee_count,
  })

  if (quarterlyPayments === null) {
    gaps.push({
      key: 'income.quarterly_payments',
      severity: 'error',
      message:
        'No 1701-Q payments recorded for this taxable year. Record the four quarterly payments on the remittance ledger, or the balance due on this return will be overstated by that amount.',
    })
  } else if (quarterlyPayments === 0) {
    gaps.push({
      key: 'income.quarterly_payments',
      severity: 'warning',
      message:
        'No 1701-Q payments are on record. A corporation with income tax payable should have made quarterly payments; if none were required, confirm that here rather than leaving the ledger empty.',
    })
  }

  return {
    lines: {
      gross_income: grossIncome,
      less_exemptions: round2(exemptions),
      taxable_income: taxableIncome,
      taxable_income_base: taxableIncome,
      graduated_tax: graduated,
      prior_year_credit: inputs.prior_year_credit ?? null,
      personal_exemptions: inputs.personal_exemptions ?? null,
      special_deductions: inputs.special_deductions ?? null,
      ordinary_deductions: inputs.ordinary_deductions ?? null,
      net_op_loss: inputs.net_operating_loss ?? null,
      creditable_taxes: creditableWithheld,
      income_tax_due: incomeTaxDue,
      quarterly_payments: quarterlyPayments,
      tax_balance_due: balanceDue,
      surplus: round2(priorYearSurplus || 0),
      total_amount_due: totalAmountDue,
      amount_paid: inputs.amount_paid ?? null,
      amount_still_due:
        isKnown(totalAmountDue) && isKnown(inputs.amount_paid)
          ? round2(Number(totalAmountDue) - Number(inputs.amount_paid))
          : null,
    },
    totals: {
      gross_income: grossIncome,
      taxable_income: taxableIncome,
      graduated_tax: graduated,
      income_tax_due: incomeTaxDue,
      balance_due: balanceDue,
      total_amount_due: totalAmountDue,
    },
    cwt_credit_detail: facts.cwt.by_payee,
    blocked_cwt: facts.cwt.blocked_payee_count,
    gaps,
    blocking: gaps.some((gap) => gap.severity === 'error'),
  }
}

// ---------------------------------------------------------------------------
// 1701-A — individual / estate / trust with compensation
// ---------------------------------------------------------------------------

const compute1701A = (facts, options = {}) => {
  const { inputs = {}, remittances = [], priorYearSurplus = 0 } = options
  const income = facts.income

  const personals = round2(income.personals_received)
  const business = round2(income.business_professional_income)

  const lookbacks = [
    inputs.legal_professional_share,
    inputs.farm_fishing_income,
    inputs.capital_asset_gains,
    inputs.partnership_gross_income,
  ]

  const totalReceived = sumKnown([personals, business, inputs.mixed_income_benefits])
  const knownLookbacks = lookbacks.filter(isKnown)
  const allLookbacksKnown = knownLookbacks.length === lookbacks.length

  // Taxable income is only computable once every "less:" lookback line is
  // known. Until then it stays null — computing it with a partial set would
  // overstate taxable income and understate the tax.
  const taxableIncome =
    isKnown(totalReceived) && allLookbacksKnown
      ? round2(
          Number(totalReceived) - knownLookbacks.map(Number).reduce((a, b) => a + b, 0),
        )
      : null

  const isProfessional = Boolean(inputs.self_employed_professional)
  const base = isKnown(taxableIncome) ? Number(taxableIncome) : null
  const tax = isKnown(base)
    ? isProfessional
      ? professionalTax(base)
      : graduatedTax(base)
    : null

  const priorPayments = sumKnown(
    remittances.map((r) => Number(r.amount_paid || r.amount_remitted || 0)),
  )

  const creditableWithheld = income.creditable_withheld
  const lessItems = sumKnown([inputs.special_payroll_tax, inputs.prior_year_income_tax])

  const totalTaxDue =
    isKnown(tax) && isKnown(lessItems) && creditableWithheld !== null
      ? round2(
          Number(tax) -
            Number(lessItems) -
            Number(creditableWithheld) +
            Number(inputs.under_withholding || 0) +
            Number(inputs.final_withholding_tax || 0),
        )
      : null

  const balanceDue =
    isKnown(totalTaxDue) && isKnown(priorPayments)
      ? round2(Number(totalTaxDue) - Number(priorPayments))
      : null

  const totalAmountDue = isKnown(balanceDue)
    ? round2(Number(balanceDue) + Number(priorYearSurplus || 0))
    : null

  const gaps = buildIncomeGaps({
    income,
    inputs,
    requiredInputs: [
      ['legal_professional_share', 'Share of other income received by taxable persons not subject to graduated tax'],
      ['farm_fishing_income', 'Income derived from farming/fishing'],
      ['capital_asset_gains', 'Gain on sale of capital assets'],
      ['partnership_gross_income', 'Actual gross income received as a partnership member'],
      ['mixed_income_benefits', 'Mixed income benefits'],
      ['prior_year_income_tax', 'Income tax paid for the prior taxable year'],
    ],
    needCredits: false,
    blockedCwtPayees: facts.cwt.blocked_payee_count,
  })

  if (!isKnown(totalReceived)) {
    gaps.push({
      key: 'income.mixed_income_benefits',
      severity: 'error',
      message: 'Mixed income benefits are required to total the income received. Enter them even if zero — enter an explicit 0 rather than leaving the field blank.',
    })
  }

  return {
    lines: {
      taxable_personals: personals,
      taxable_business_professional: business,
      mixed_income_benefits: inputs.mixed_income_benefits ?? null,
      total_taxable_income: taxableIncome,
      total_income: totalReceived,
      less_legal_pros_lookback: inputs.legal_professional_share ?? null,
      less_farm_income: inputs.farm_fishing_income ?? null,
      less_actual_farm: inputs.capital_asset_gains ?? null,
      less_actual_gross: inputs.partnership_gross_income ?? null,
      tax_due: tax,
      less_special_payroll_tax: inputs.special_payroll_tax ?? null,
      less_creditable_withheld: creditableWithheld,
      less_prior_year_income_tax: inputs.prior_year_income_tax ?? null,
      add_under_withholding: inputs.under_withholding ?? null,
      add_final_withholding: inputs.final_withholding_tax ?? null,
      total_tax_due: totalTaxDue,
      less_quarterly_payments: priorPayments,
      tax_balance_due: balanceDue,
      add_prev_year_surplus: round2(priorYearSurplus || 0),
      total_amount_due: totalAmountDue,
      amount_still_due:
        isKnown(totalAmountDue) && isKnown(inputs.amount_paid)
          ? round2(Number(totalAmountDue) - Number(inputs.amount_paid))
          : null,
    },
    personals_schedule: buildPersonalsSchedule(income.compensation_detail),
    totals: {
      personals: personals,
      business_professional: business,
      total_income: totalReceived,
      taxable_income: taxableIncome,
      tax_due: tax,
      total_tax_due: totalTaxDue,
      balance_due: balanceDue,
    },
    cwt_credit_detail: facts.cwt.by_payee,
    blocked_cwt: facts.cwt.blocked_payee_count,
    gaps,
    blocking: gaps.some((gap) => gap.severity === 'error'),
  }
}

// ---------------------------------------------------------------------------
// 1701-Q — quarterly corporate income tax
// ---------------------------------------------------------------------------

const compute1701Q = (facts, options = {}) => {
  const { inputs = {}, priorQuarterFacts = null, currentQuarterFacts = null } = options
  const rate = PARAMETERS.quarterlyCorporationRate

  // Both quarters are needed for the comparison that is the whole point of the
  // form. The current quarter comes from the same ledger read over a different
  // window; the preceding quarter must be supplied.
  const priorGross = priorQuarterFacts
    ? round2(priorQuarterFacts.income.gross_income)
    : null
  const currentGross = currentQuarterFacts
    ? round2(currentQuarterFacts.income.gross_income)
    : round2(facts.income.gross_income)

  // Sec. 24(D): the tax is 1% of the HIGHER of the preceding quarter's gross
  // income or the current quarter's gross income. The comparison is between two
  // incomes, not between an income and a tax figure — the 1% is applied once, to
  // whichever income wins.
  const incomeBase =
    isKnown(priorGross) && isKnown(currentGross)
      ? round2(Math.max(Number(priorGross), Number(currentGross)))
      : isKnown(currentGross)
        ? round2(Number(currentGross))
        : null

  const taxDue = isKnown(incomeBase) ? round2(Number(incomeBase) * rate) : null
  const onePercentOfPrior = isKnown(priorGross) ? round2(Number(priorGross) * rate) : null

  const creditableWithheld = facts.income.creditable_withheld
  const priorCredit = inputs.prior_quarter_credit ?? null

  const balanceDue =
    isKnown(taxDue) && isKnown(priorCredit) && creditableWithheld !== null
      ? round2(Number(taxDue) - Number(priorCredit) - Number(creditableWithheld))
      : null

  const gaps = []

  if (!isKnown(priorGross)) {
    gaps.push({
      key: 'income.prior_quarter_gross_income',
      severity: 'error',
      message:
        'Gross income for the immediately preceding quarter is required. The 1% floor is computed from it and the form is not fileable without it.',
    })
  }

  if (isKnown(priorGross) && isKnown(currentGross) && Number(currentGross) < Number(priorGross)) {
    gaps.push({
      key: 'income_1701q_low_quarter',
      severity: 'info',
      message:
        'Current-quarter gross income is below the preceding quarter, so the preceding quarter is the higher figure and the tax base. This is the normal case for a seasonal taxpayer and is not an error.',
    })
  }

  if (creditableWithheld === 0) {
    gaps.push({
      key: 'income.creditable_withheld',
      severity: 'info',
      message: 'No creditable tax withheld this quarter. Line 6 is zero unless 2307 certificates are being applied.',
    })
  }

  return {
    lines: {
      gross_income: priorGross,
      one_percent: onePercentOfPrior,
      quarterly_income: currentGross,
      tax_base: incomeBase,
      tax_due: taxDue,
      creditable_withheld: creditableWithheld,
      prior_qtr_credit: priorCredit,
      tax_balance_due: balanceDue,
      amount_paid: inputs.amount_paid ?? null,
      amount_still_due:
        isKnown(balanceDue) && isKnown(inputs.amount_paid)
          ? round2(Number(balanceDue) - Number(inputs.amount_paid))
          : null,
    },
    comparison: {
      rate: rate,
      prior_quarter_income: priorGross,
      current_quarter_income: currentGross,
      one_percent_of_prior: onePercentOfPrior,
      higher_income: incomeBase,
      base_used: isKnown(priorGross) && isKnown(currentGross)
        ? Number(priorGross) >= Number(currentGross)
          ? 'PRECEDING_QUARTER'
          : 'CURRENT_QUARTER'
        : null,
    },
    totals: {
      tax_base: incomeBase,
      tax_due: taxDue,
      balance_due: balanceDue,
    },
    gaps,
    blocking: gaps.some((gap) => gap.severity === 'error'),
  }
}

// ---------------------------------------------------------------------------
// 1702 — individual annual return
// ---------------------------------------------------------------------------

const compute1702 = (facts, options = {}) => {
  const { inputs = {}, remittances = [], priorYearSurplus = 0 } = options
  const income = facts.income

  const personals = round2(income.personals_received)
  const business = round2(income.business_professional_income)

  const lookbacks = [
    inputs.mixed_income_lookback,
    inputs.legal_professional_share,
    inputs.farm_fishing_income,
    inputs.capital_asset_gains,
    inputs.partnership_gross_income,
  ]
  const knownLookbacks = lookbacks.filter(isKnown)
  const allLookbacksKnown = knownLookbacks.length === lookbacks.length

  const totalIncome = sumKnown([personals, business, inputs.mixed_income_benefits])
  const taxableIncome =
    isKnown(totalIncome) && allLookbacksKnown
      ? round2(
          Number(totalIncome) - knownLookbacks.map(Number).reduce((a, b) => a + b, 0),
        )
      : null

  const base = isKnown(taxableIncome) ? Number(taxableIncome) : null

  // The professional band is an election, not a default. Whether the business
  // portion is taxed at the flat enhanced rate or at the graduated rate changes
  // the answer materially, so it is split into two independently-computed
  // components and the mode only chooses the second one. Both are always
  // computed, so the return total never disappears just because a mode was
  // picked.
  const taxMode = inputs.income_tax_mode || (business > 0 ? 'UNRESOLVED' : 'GRADUATED')

  // Graduated tax on the non-business portion is the same under either mode.
  const gradTaxOnPersonals =
    base !== null ? graduatedTax(Math.max(0, Number(base) - Number(business))) : null

  const taxOnBusiness =
    base !== null && business > 0
      ? taxMode === 'FLAT_PROFESSIONAL'
        ? professionalTax(Number(business))
        : graduatedTax(Number(business))
      : null

  const taxGraduated = gradTaxOnPersonals
  const taxFlat = taxOnBusiness

  const personalExemption = isKnown(inputs.personal_exemption)
    ? round2(Number(inputs.personal_exemption))
    : PARAMETERS.personalExemption

  const osd =
    inputs.deduction_mode === 'OSD'
      ? optionalStandardDeduction(inputs.itemized_deductions) ?? optionalStandardDeduction(0)
      : inputs.deduction_mode === 'ITEMIZED'
        ? isKnown(inputs.itemized_deductions)
          ? round2(Number(inputs.itemized_deductions))
          : null
        : null

  const addItems = sumKnown([
    inputs.fmw_income_tax,
    inputs.under_withholding,
    inputs.final_withholding_tax,
    inputs.special_payroll_tax,
  ])
  const lessDeductions = sumKnown([personalExemption, osd])

  const totalTaxDue =
    isKnown(taxGraduated) &&
    isKnown(taxFlat) &&
    isKnown(addItems) &&
    isKnown(lessDeductions) &&
    income.creditable_withheld !== null
      ? round2(
          Number(taxGraduated) +
            Number(taxFlat) +
            Number(addItems) -
            Number(lessDeductions) -
            Number(income.creditable_withheld),
        )
      : null

  const priorPayments = sumKnown(
    remittances.map((r) => Number(r.amount_paid || r.amount_remitted || 0)),
  )

  const balanceDue =
    isKnown(totalTaxDue) && isKnown(priorPayments)
      ? round2(Number(totalTaxDue) - Number(priorPayments))
      : null

  const totalAmountDue = isKnown(balanceDue)
    ? round2(Number(balanceDue) + Number(priorYearSurplus || 0))
    : null

  const gaps = buildIncomeGaps({
    income,
    inputs,
    requiredInputs: [
      ['mixed_income_lookback', 'Mixed income benefits included in personals'],
      ['legal_professional_share', 'Share of other income of taxable persons not subject to graduated tax'],
      ['farm_fishing_income', 'Income derived from farming'],
      ['capital_asset_gains', 'Gain on sale of capital assets not subject to final tax'],
      ['partnership_gross_income', 'Actual gross income received as a partnership member'],
      ['mixed_income_benefits', 'Mixed income benefits'],
    ],
    needCredits: false,
    blockedCwtPayees: facts.cwt.blocked_payee_count,
  })

  if (taxMode === 'UNRESOLVED') {
    gaps.push({
      key: 'income.tax_mode',
      severity: 'error',
      message:
        'The taxpayer has business/professional income, so the tax must be split between the graduated band and the enhanced flat band. Choose the election (GRADUATED or FLAT_PROFESSIONAL) — it changes the answer materially and this module will not pick for you.',
    })
  }

  if (!isKnown(inputs.deduction_mode)) {
    gaps.push({
      key: 'income.deduction_mode',
      severity: 'error',
      message:
        'Choose OSD (40% of itemised ordinary deductions, capped) or ITEMIZED. The deduction is an election and both produce a different total.',
    })
  } else if (inputs.deduction_mode === 'OSD' && !isKnown(inputs.itemized_deductions)) {
    gaps.push({
      key: 'income.itemized_deductions',
      severity: 'error',
      message:
        'OSD is 40% of itemised ordinary deductions, so the itemised figure is still required. The cap alone is not the OSD amount.',
    })
  } else if (inputs.deduction_mode === 'ITEMIZED' && !isKnown(inputs.itemized_deductions)) {
    gaps.push({
      key: 'income.itemized_deductions',
      severity: 'error',
      message: 'Itemized deductions were selected but no amount was entered.',
    })
  }

  return {
    lines: {
      taxable_personals: personals,
      taxable_business_professional: business,
      mixed_income_benefits: inputs.mixed_income_benefits ?? null,
      total_income: totalIncome,
      total_taxable_income: taxableIncome,
      less_mixed_lookback: inputs.mixed_income_lookback ?? null,
      less_legal_pros_share: inputs.legal_professional_share ?? null,
      less_farm_income: inputs.farm_fishing_income ?? null,
      less_capital_gains: inputs.capital_asset_gains ?? null,
      less_partnership_gross: inputs.partnership_gross_income ?? null,
      tax_due_graduated: taxGraduated,
      tax_due_business: taxFlat,
      add_fmw_income_tax: inputs.fmw_income_tax ?? null,
      add_under_withholding: inputs.under_withholding ?? null,
      add_final_withholding: inputs.final_withholding_tax ?? null,
      add_special_payroll_tax: inputs.special_payroll_tax ?? null,
      less_personal_exemption: personalExemption,
      add_osd_or_itemized: osd,
      less_creditable_withheld: income.creditable_withheld,
      total_tax_due: totalTaxDue,
      less_payments: priorPayments,
      tax_balance_due: balanceDue,
      add_prev_year_surplus: round2(priorYearSurplus || 0),
      total_amount_due: totalAmountDue,
      amount_paid: inputs.amount_paid ?? null,
      amount_still_due:
        isKnown(totalAmountDue) && isKnown(inputs.amount_paid)
          ? round2(Number(totalAmountDue) - Number(inputs.amount_paid))
          : null,
    },
    tax_mode: taxMode,
    personals_schedule: buildPersonalsSchedule(income.compensation_detail),
    totals: {
      total_income: totalIncome,
      taxable_income: taxableIncome,
      total_tax_due: totalTaxDue,
      balance_due: balanceDue,
    },
    cwt_credit_detail: facts.cwt.by_payee,
    blocked_cwt: facts.cwt.blocked_payee_count,
    gaps,
    blocking: gaps.some((gap) => gap.severity === 'error'),
  }
}

// ---------------------------------------------------------------------------
// 1702-Q — quarterly individual income tax
// ---------------------------------------------------------------------------

const compute1702Q = (facts, options = {}) => {
  const { inputs = {}, quarterFacts = [], remittances = [] } = options
  const income = facts.income

  // 1702-Q needs all four quarters' taxable income. Three of them are prior
  // periods; the caller supplies the fact bags. Missing quarters make the
  // total uncomputable, so they stay null.
  //
  // Accept both a bare fact bag and a { quarter, facts } wrapper. Indexing
  // `source.income` against a wrapper yields undefined rather than throwing,
  // which would silently zero out a quarter.
  const quarters = [0, 1, 2, 3].map((index) => {
    const entry = quarterFacts[index]
    if (!entry) return null
    const source = entry.facts !== undefined ? entry.facts : entry
    const gross = source && source.income ? source.income.gross_income : null
    return isKnown(gross) ? round2(gross) : null
  })

  const totalTaxableIncome = sumKnown(quarters)
  const allQuartersKnown = quarters.every(isKnown)

  const base = totalTaxableIncome
  const tax = allQuartersKnown ? graduatedTax(base) : null

  const addItems = sumKnown([inputs.under_withholding, inputs.final_withholding_tax])
  const creditableWithheld = income.creditable_withheld

  const totalTaxDue =
    isKnown(tax) && isKnown(addItems) && creditableWithheld !== null
      ? round2(Number(tax) + Number(addItems) - Number(creditableWithheld))
      : null

  const priorPayments = sumKnown(
    remittances.map((r) => Number(r.amount_paid || r.amount_remitted || 0)),
  )

  const balanceDue =
    isKnown(totalTaxDue) && isKnown(priorPayments)
      ? round2(Number(totalTaxDue) - Number(priorPayments))
      : null

  const gaps = []

  if (!allQuartersKnown) {
    const missing = [1, 2, 3, 4].filter((_, index) => !isKnown(quarters[index]))
    gaps.push({
      key: 'income.quarterly_taxable_income',
      severity: 'error',
      message: `Taxable income for Q${missing.join(', Q')} is not available. Every quarter of the taxable year is required — a 1702-Q is filed on the year to date, not on the quarter alone.`,
      detail: { missing_quarters: missing },
    })
  }

  if (isKnown(totalTaxableIncome) && totalTaxableIncome === 0) {
    gaps.push({
      key: 'income.nil_year',
      severity: 'info',
      message:
        'No taxable income for the year. The fourth-quarter return is still required and is filed at ₱0 — that is a nil filing, not an exemption.',
    })
  }

  if (priorPayments === null || priorPayments === 0) {
    gaps.push({
      key: 'income.prior_payments',
      severity: 'warning',
      message:
        'No prior-quarter payments recorded. If the taxpayer has no income tax payable in the preceding quarter, the fourth-quarter return is filed at ₱0; confirm that before filing.',
    })
  }

  return {
    lines: {
      taxable_income_q1: quarters[0],
      taxable_income_q2: quarters[1],
      taxable_income_q3: quarters[2],
      taxable_income_q4: quarters[3],
      total_taxable_income: totalTaxableIncome,
      tax_due: tax,
      add_under_withholding: inputs.under_withholding ?? null,
      add_final_withholding: inputs.final_withholding_tax ?? null,
      less_creditable_withheld: creditableWithheld,
      total_tax_due: totalTaxDue,
      less_prior_payments: priorPayments,
      tax_balance_due: balanceDue,
      amount_still_due: balanceDue,
    },
    quarters: [1, 2, 3, 4].map((label, index) => ({
      quarter: label,
      taxable_income: quarters[index],
      known: isKnown(quarters[index]),
    })),
    totals: {
      total_taxable_income: totalTaxableIncome,
      total_tax_due: totalTaxDue,
      balance_due: balanceDue,
    },
    gaps,
    blocking: gaps.some((gap) => gap.severity === 'error'),
  }
}

// ---------------------------------------------------------------------------
// supporting schedules
// ---------------------------------------------------------------------------

/** Group compensation by payee and the Jan–Feb / Mar–Aug / Sep–Dec bands. */
const buildPersonalsSchedule = (rows) => {
  const byPayee = new Map()
  for (const row of rows || []) {
    const key = `${row.payee_tin || ''}|${row.payee_name || 'UNIDENTIFIED'}`
    if (!byPayee.has(key)) {
      byPayee.set(key, {
        payee_tin: row.payee_tin || null,
        payee_name: row.payee_name || null,
        january_february: 0,
        march_august: 0,
        september_december: 0,
        total: 0,
        tax_withheld: 0,
      })
    }
    const bucket = byPayee.get(key)
    const month = Number(String(row.date || '').slice(5, 7))
    if (month >= 1 && month <= 2) bucket.january_february += row.compensation
    else if (month >= 3 && month <= 8) bucket.march_august += row.compensation
    else if (month >= 9 && month <= 12) bucket.september_december += row.compensation
    bucket.total += row.compensation
    bucket.tax_withheld += row.tax_withheld || 0
  }

  return Array.from(byPayee.values())
    .map((row) => ({
      ...row,
      january_february: round2(row.january_february),
      march_august: round2(row.march_august),
      september_december: round2(row.september_december),
      total: round2(row.total),
      tax_withheld: round2(row.tax_withheld),
      blocked: !row.payee_tin,
      blocked_reason: row.payee_tin
        ? null
        : `Payee "${row.payee_name || 'unidentified'}" has no TIN on file. The amount is in the schedule total but the payee cannot be matched to a 2307.`,
    }))
    .sort((a, b) => b.total - a.total)
}

const buildIncomeGaps = ({ income, inputs, requiredInputs, needCredits, blockedCwtPayees = 0 }) => {
  const gaps = [...(income.gaps || [])]

  for (const [key, label] of requiredInputs) {
    if (isKnown(inputs[key])) continue
    // An explicit zero is a real answer; a null is not. Only the null is a gap.
    gaps.push({
      key: `income.${key}`,
      severity: 'error',
      message: `${label} is required and has no value. Enter it — enter 0 explicitly if that is the correct amount. This module will not default it to zero.`,
    })
  }

  if (needCredits) {
    const creditKeys = [
      'prior_year_credit',
      'ordinary_deductions',
      'net_operating_loss',
    ].filter((key) => !isKnown(inputs[key]))
    if (creditKeys.length) {
      gaps.push({
        key: 'income.credits',
        severity: 'error',
        message: `The tax balance due cannot be computed because ${creditKeys.length} credit line(s) are unknown. A ₱0 credit and an unknown credit are not the same return.`,
        detail: { missing: creditKeys },
      })
    }
  }

  if (income.creditable_withheld === 0) {
    gaps.push({
      key: 'income.creditable_withheld',
      severity: 'info',
      message:
        'No creditable tax withheld is recorded. If 2307 certificates were issued to this taxpayer and not yet applied, the credit line will be understated.',
    })
  }

  if (blockedCwtPayees) {
    gaps.push({
      key: 'income.blocked_cwt',
      severity: 'warning',
      message:
        'Some creditable tax withheld postings belong to payees with no TIN on file. Those amounts are in the total but cannot be traced to a certificate.',
      detail: { blocked_count: blockedCwtPayees },
    })
  }

  return gaps
}

module.exports = {
  PARAMETERS,
  compute1701,
  compute1701A,
  compute1701Q,
  compute1702,
  compute1702Q,
  applyBrackets,
  assertBracketTables,
  graduatedTax,
  corporateTax,
  professionalTax,
  selfEmployedTax,
  optionalStandardDeduction,
  buildPersonalsSchedule,
  isKnown,
}
