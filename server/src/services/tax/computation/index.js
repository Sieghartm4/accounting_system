'use strict'

const { FORMS_BY_CODE, FORMS, getForm: getCatalogForm } = require('../catalog')
const { collectTaxFacts } = require('../ledger.service')
const { resolvePeriod, filingDeadline, monthsInPeriod, lastDayOfMonth } = require('../period.service')
const vat = require('./vat')
const withholding = require('./withholding')
const income = require('./income')
const certificate = require('./certificate')

/**
 * Computation dispatcher.
 *
 * The catalog owns WHAT a return is: form code, period basis, deadline, line
 * schema. This module owns HOW the numbers are produced. The binding is a table
 * of computation_key -> function, and the invariant is that a form in the
 * catalog with no binding here is a hard error, not a form that quietly returns
 * zeros at runtime.
 *
 * That check is the reason this dispatcher exists. The previous implementation
 * resolved a form through a hardcoded string in a switch with a fallthrough
 * default, so an unknown form code produced a plausible-looking empty return
 * instead of an error.
 */

const COMPUTATIONS = {
  VAT_2550M: vat.compute2550M,
  VAT_2550Q: vat.compute2550Q,
  EWT_0619E: withholding.compute0619E,
  EWT_1601E: withholding.compute1601E,
  EWT_1601C: withholding.compute1601C,
  EWT_1601EQ: withholding.compute1601EQ,
  EWT_1604C: withholding.compute1604,
  EWT_1604E: withholding.compute1604,
  EWT_SCHEDULE_A: certificate.computeScheduleA,
  INCOME_1701: income.compute1701,
  INCOME_1701A: income.compute1701A,
  INCOME_1701Q: income.compute1701Q,
  INCOME_1702: income.compute1702,
  INCOME_1702Q: income.compute1702Q,
  CERTIFICATE_2307: certificate.compute2307,
  CWT_SCHEDULE: certificate.computeCwtSchedule,
  VAT_RECONCILIATION: certificate.computeVatReconciliation,
}

/**
 * Computations that cannot be satisfied by one period read, because they
 * aggregate across periods. The dispatcher gathers the extra reads itself so a
 * quarter can never be assembled from a mix of windows.
 */
const MULTI_PERIOD_COMPUTATIONS = new Set([
  'EWT_1601C',
  'INCOME_1701Q',
  'INCOME_1702Q',
])

/** Keyed payee + tax year rather than by a filing period. */
const CREDENTIAL_COMPUTATIONS = new Set(['CERTIFICATE_2307'])

/**
 * Load-time binding check, in both directions: every catalog form must have an
 * implementation, and every implementation must belong to a catalog form.
 */
const verifyBindings = () => {
  const problems = []
  for (const form of FORMS) {
    if (!form.computation_key) {
      problems.push(`${form.form_code}: no computation_key`)
      continue
    }
    if (typeof COMPUTATIONS[form.computation_key] !== 'function') {
      problems.push(
        `${form.form_code}: computation_key "${form.computation_key}" has no implementation`,
      )
    }
  }
  for (const key of Object.keys(COMPUTATIONS)) {
    if (!FORMS.some((form) => form.computation_key === key)) {
      problems.push(`computation_key "${key}" is implemented but no catalog form uses it`)
    }
  }
  return problems
}

const bindingProblems = verifyBindings()

/**
 * Look up a form, tolerating the punctuation variants clients send. BIR form
 * codes are written 2550M, 2550-M and 2550 M interchangeably, and all three
 * mean the same return.
 */
const getForm = (formCode) => {
  const raw = String(formCode || '').trim()
  if (!raw) return null
  const direct = getCatalogForm(raw)
  if (direct) return direct
  const squashed = raw.toUpperCase().replace(/[\s\-_]/g, '')
  return FORMS_BY_CODE.get(squashed) || null
}

const toQuery = (period) => ({ start_date: period.start, end_date: period.end })

/**
 * The effective period basis for a taxpayer.
 *
 * The catalog stores the default (calendar) basis. Forms flagged
 * `follows_fiscal_year` switch to the fiscal basis when the profile declares a
 * non-December year end, because income tax is reported over the taxpayer's
 * fiscal year. VAT and withholding do not carry that flag: their periods are
 * fixed by the calendar regardless of the accounting year.
 */
const effectiveBasis = (form, profile = {}) => {
  const fiscalEnd = Number(profile.fiscal_year_end_month)
  const onFiscalYear = Number.isFinite(fiscalEnd) && fiscalEnd >= 1 && fiscalEnd <= 12 && fiscalEnd !== 12

  if (!onFiscalYear || !form.follows_fiscal_year) return form.period_basis
  if (form.period_basis === 'CALENDAR_YEAR') return 'FISCAL_YEAR'
  if (form.period_basis === 'CALENDAR_QUARTER') return 'FISCAL_QUARTER'
  return form.period_basis
}

/**
 * Turn a caller-supplied period selector into a resolved period for this form.
 *
 * The selector is a date anchor, because that is the only unambiguous input
 * across calendar and fiscal bases: "2026-03-15" means a different quarter for
 * a taxpayer whose year ends in June, and the basis comes from the catalog and
 * the profile rather than from the caller guessing.
 */
const resolveFormPeriod = (form, selector = {}, profile = {}) => {
  const basis = effectiveBasis(form, profile)
  const anchor =
    selector.anchor ||
    (selector.year
      ? `${selector.year}-${String(selector.month || 1).padStart(2, '0')}-01`
      : null)

  if (!anchor) {
    return { error: `Form ${form.form_code} needs a period anchor (YYYY-MM-DD) or a year.` }
  }

  const period = resolvePeriod(basis, anchor, profile)
  if (period.error) return { error: period.error }
  return { period, basis }
}

const pad2 = (n) => String(n).padStart(2, '0')

/**
 * The four quarters of the year the given period sits in.
 *
 * Built from the twelve months of that year rather than by repeatedly resolving
 * single quarters, so the list is always exactly four entries and always ends
 * on the real last day of the year.
 */
const quartersOfYear = (form, period, profile = {}) => {
  const basis = effectiveBasis(form, profile)
  const onFiscalYear = basis === 'FISCAL_QUARTER' || basis === 'FISCAL_YEAR'

  // The twelve months must come from the YEAR basis. Resolving the year's
  // months through the quarter basis would return three and silently drop the
  // other three quarters.
  const yearBasis = basis === 'FISCAL_QUARTER' ? 'FISCAL_YEAR' : 'CALENDAR_YEAR'

  const yearMonths = onFiscalYear
    ? monthsInPeriod(resolvePeriod(yearBasis, `${period.year}-01-01`, profile))
    : Array.from({ length: 12 }, (_, i) => `${period.year}-${pad2(i + 1)}`)

  if (yearMonths.length !== 12) {
    // A basis that did not yield twelve months is a metadata defect; returning
    // a short list would silently under-report the year.
    return []
  }

  const quarters = []
  for (let i = 0; i < 12; i += 3) {
    const slice = yearMonths.slice(i, i + 3)
    const [ly, lm] = slice[2].split('-').map(Number)
    quarters.push({
      period_type: 'QUARTER',
      start: `${slice[0]}-01`,
      end: `${ly}-${pad2(lm)}-${pad2(lastDayOfMonth(ly, lm - 1))}`,
      months: slice,
      year: period.year,
      quarter: i / 3 + 1,
      label: `Q${i / 3 + 1} ${onFiscalYear ? `FY${period.year}` : period.year}`,
      fiscal: onFiscalYear,
    })
  }
  return quarters
}

/**
 * The period immediately before the one being filed.
 *
 * Derived from the month BEFORE the period's first month, then resolved through
 * the same basis. Taking the period's own first month and re-resolving it
 * returns the same period, not the one before it — which for a quarterly form
 * would compare the quarter against itself.
 */
const precedingPeriod = (form, period, profile = {}) => {
  const months = monthsInPeriod(period)
  if (!months.length) return null

  const [firstYear, firstMonth] = months[0].split('-').map(Number)
  if (!Number.isFinite(firstYear) || !Number.isFinite(firstMonth)) return null

  // Step back one month, rolling the year over at January.
  const prevYear = firstMonth === 1 ? firstYear - 1 : firstYear
  const prevMonth = firstMonth === 1 ? 12 : firstMonth - 1

  const candidate = resolvePeriod(
    effectiveBasis(form, profile),
    `${prevYear}-${pad2(prevMonth)}-01`,
    profile,
  )
  return candidate && !candidate.error ? candidate : null
}

/**
 * Gather the fact bags a computation needs.
 *
 * Every bag is read through the same approval filter and account matching, so
 * an aggregate can never mix approved and unapproved documents.
 */
const collectFactsFor = async (form, period, options = {}) => {
  const { profile = {} } = options
  const key = form.computation_key

  if (key === 'INCOME_1701Q') {
    // The preceding quarter must be a real read. Reusing the current quarter's
    // facts here would reduce the form to "1% of this quarter".
    const prior = precedingPeriod(form, period, profile)
    return {
      period,
      facts: await collectTaxFacts(toQuery(period)),
      currentQuarterFacts: await collectTaxFacts(toQuery(period)),
      priorQuarterFacts: prior ? await collectTaxFacts(toQuery(prior)) : null,
      precedingPeriod: prior,
    }
  }

  if (key === 'INCOME_1702Q') {
    // 1702-Q reports the year to date, so every quarter of the year is needed.
    const quarters = quartersOfYear(form, period, profile)
    const bags = []
    for (const q of quarters) bags.push({ quarter: q, facts: await collectTaxFacts(toQuery(q)) })
    return {
      period,
      facts: bags.length ? bags[bags.length - 1].facts : await collectTaxFacts(toQuery(period)),
      // compute1702Q indexes these positionally and reads `bag.income`
      // directly, so it wants bare fact bags, not the { quarter, facts }
      // wrappers. Passing the wrappers made `source.income` undefined and
      // every 1702-Q run failed as COMPUTATION_FAILED. The periods travel
      // separately in quarterPeriods for gap messages and traceability.
      quarterFacts: bags.map((bag) => bag.facts),
      quarterPeriods: quarters,
    }
  }

  if (key === 'EWT_1601C') {
    // The consolidation reads the filed 1601-E monthlies, which are filing
    // records supplied by the caller, plus the ledger for the variance check.
    const months = monthsInPeriod(period)
    const parts = []
    for (const month of months) {
      const monthPeriod = resolvePeriod(form.period_basis, `${month}-01`, profile)
      if (monthPeriod && !monthPeriod.error) {
      parts.push({ month, period: monthPeriod, facts: await collectTaxFacts(toQuery(monthPeriod)) })
      }
    }
    return { period, facts: await collectTaxFacts(toQuery(period)), parts }
  }

  return { period, facts: await collectTaxFacts(toQuery(period)) }
}

/**
 * Compute one form.
 *
 * @param {string} formCode
 * @param {object} selector   { anchor: 'YYYY-MM-DD' } or { year, month }
 * @param {object} options    { profile, inputs, remittances, filedMonthlies,
 *                              payee, existingCertificates, issuedCertificates,
 *                              taxYear }
 */
const computeForm = async (formCode, selector = {}, options = {}) => {
  const form = getForm(formCode)
  if (!form) {
    return {
      ok: false,
      error: 'UNKNOWN_FORM',
      message: `"${formCode}" is not in the tax form registry.`,
      available: FORMS.map((f) => f.form_code),
    }
  }

  if (bindingProblems.length) {
    return {
      ok: false,
      error: 'BINDING_DEFECT',
      message: 'The tax form registry is inconsistent, so no computation was attempted.',
      detail: bindingProblems,
    }
  }

  const profile = options.profile || {}
  const { period, error } = resolveFormPeriod(form, selector, profile)
  if (error) {
    return { ok: false, error: 'BAD_PERIOD', form_code: form.form_code, message: error }
  }

  const compute = COMPUTATIONS[form.computation_key]
  const gathered = await collectFactsFor(form, period, { profile })
  const facts = options.facts || gathered.facts

  const taxYear = CREDENTIAL_COMPUTATIONS.has(form.computation_key)
    ? Number(options.taxYear || period.year)
    : period.year

  let result
  try {
    result = compute(facts, {
      inputs: options.inputs || {},
      remittances: options.remittances || [],
      filedMonthlies: options.filedMonthlies || [],
      existingCertificates: options.existingCertificates || [],
      // SCHED-CWT reconciles the ledger against certificates already issued, so
      // it reads `issuedCertificates` while 2307 reads `existingCertificates`.
      // Defaulting one from the other means a caller that has the certificate
      // list does not have to know which form wants which name, and a caller
      // that supplies neither still gets a real (empty) reconciliation rather
      // than an undefined.
      issuedCertificates: options.issuedCertificates || options.existingCertificates || [],
      payeeTin: (options.payee && options.payee.tin) || options.payeeTin || null,
      payeeName: (options.payee && options.payee.name) || options.payeeName || null,
      taxYear,
      period,
      // An explicitly supplied fact bag wins over the ledger read. A taxpayer
      // that filed an earlier quarter in another system, or a caller replaying
      // a known period, must not have that period silently re-read and summed
      // in. Absent an override these are the gathered ledger facts.
      currentQuarterFacts: options.currentQuarterFacts || gathered.currentQuarterFacts || null,
      priorQuarterFacts:
        'priorQuarterFacts' in options ? options.priorQuarterFacts : gathered.priorQuarterFacts || null,
      precedingPeriod: options.precedingPeriod || gathered.precedingPeriod || null,
      quarterFacts: 'quarterFacts' in options ? options.quarterFacts : gathered.quarterFacts || null,
    })
  } catch (error) {
    // A throw is a code defect and must not be reported as a filing result. The
    // caller needs to know the computation never ran.
    return {
      ok: false,
      error: 'COMPUTATION_FAILED',
      form_code: form.form_code,
      message: `The ${form.form_code} computation threw before producing a result: ${error.message}`,
      detail: { stack: error.stack },
    }
  }

  // Provenance: which ledger accounts produced each printed figure. Carried on
  // the result rather than only the response so a saved filing stays auditable
  // later, and so the UI can link a line straight to its general-ledger detail
  // the way Trial Balance already does. Each fact group contributes its own
  // dotted paths, so this stays open as more groups gain a trace.
  result.trace = { ...(result.trace || {}), ...((facts && facts.vat && facts.vat.trace) || {}) }

  return {
    ok: true,
    form,
    period,
    deadline: filingDeadline(form, period, profile),
    result,
    blocking: Boolean(result.blocking),
    gaps: result.gaps || [],
  }
}

module.exports = {
  COMPUTATIONS,
  MULTI_PERIOD_COMPUTATIONS,
  CREDENTIAL_COMPUTATIONS,
  bindingProblems,
  verifyBindings,
  getForm,
  resolveFormPeriod,
  quartersOfYear,
  precedingPeriod,
  collectFactsFor,
  computeForm,
}
