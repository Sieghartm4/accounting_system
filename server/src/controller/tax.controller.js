'use strict'

const { Query } = require('../database/util/queries.util')
const { computeForm } = require('../services/tax/computation')
const { resolvePeriod } = require('../services/tax/period.service')
const {
  listForms,
  getForm,
  getExecutableForm,
  getProfile,
  saveProfile,
  evaluateForCompany,
  deadlinesFor,
  detectDrift,
  CATALOG_REVISION,
} = require('../services/tax/registry.service')
const {
  saveComputation,
  acknowledgeGaps,
  getFiling,
  listFilings,
  markFiled,
  saveInputs,
  listInputs,
  saveRemittance,
  listRemittances,
  listCertificates,
  normalizeCode,
} = require('../services/tax/filing.service')

/**
 * Registry-driven tax compliance API.
 *
 * The client is thin by design: it asks what forms exist, what applies, and
 * what the numbers are, and renders the answer. Every line label, section,
 * column layout and deadline comes from the registry, so adding a form or
 * changing a return's shape is a catalog edit plus a re-seed, not a client
 * release.
 *
 * On identity, deliberately strict:
 *
 *   The JWT carries userId, username and dbName. It does NOT carry a company
 *   id, and `master_company` holds more than one company per tenant, so the
 *   company is an explicit parameter that is verified to exist in this tenant
 *   before use. There is deliberately no fallback: the previous controller
 *   used `req.company?.id || 1`, which silently filed every tenant's returns
 *   against company 1. A missing or unknown company is a 400, never a default.
 */

const ok = (res, data, status = 200) => res.status(status).json({ success: true, data })

const fail = (res, status, code, message, extra = {}) =>
  res.status(status).json({ success: false, code, message, ...extra })

/** Map a service error code onto an HTTP status. */
const statusForCode = (code) => {
  switch (code) {
    case 'UNKNOWN_FORM':
    case 'PERIOD_REQUIRED':
    case 'COMPANY_REQUIRED':
    case 'ACK_NOTE_REQUIRED':
    case 'INVALID_PERIOD':
      return 400
    case 'NOT_FOUND':
      return 404
    case 'ALREADY_FILED':
    case 'UNACKNOWLEDGED_GAPS':
      return 409
    default:
      return 500
  }
}

/**
 * Resolve the acting user from req.context.
 *
 * Fails closed. A default of user 1 would attribute another person's filing to
 * the wrong user, and the acknowledgement trail depends on this being right.
 */
const resolveUser = (req) => {
  const ctx = req.context || {}
  const userId = ctx.userId
  if (userId === null || userId === undefined) {
    const error = new Error('Authenticated user id missing from the request context')
    error.code = 'USER_REQUIRED'
    error.status = 401
    throw error
  }
  return { userId: Number(userId), username: ctx.username || null }
}

/**
 * Resolve and verify the company for this request.
 *
 * `master_company` can hold several companies in one tenant, so the id is
 * checked against the tenant rather than trusted. Verifying it here is what
 * keeps a caller from writing another company's return by guessing an id.
 */
const resolveCompany = async (req, explicitId) => {
  const raw = explicitId
  if (raw === null || raw === undefined || raw === '') {
    const error = new Error(
      'companyId is required. The authenticated token does not identify a company.',
    )
    error.code = 'COMPANY_REQUIRED'
    error.status = 400
    throw error
  }
  const companyId = Number(raw)
  if (!Number.isInteger(companyId) || companyId <= 0) {
    const error = new Error('companyId must be a positive integer')
    error.code = 'COMPANY_REQUIRED'
    error.status = 400
    throw error
  }

  const rows = await Query(
    `SELECT mc_company_id, mc_company_name, mc_tin, mc_address, mc_status
       FROM master_company
      WHERE mc_company_id = ?
      LIMIT 1`,
    [companyId],
  )
  const row = Array.isArray(rows) ? rows[0] : null
  if (!row) {
    // Same response as a missing company, so this cannot be used to probe
    // which company ids exist in a tenant.
    const error = new Error('Unknown company for this account')
    error.code = 'COMPANY_NOT_FOUND'
    error.status = 404
    throw error
  }
  return {
    companyId,
    company: {
      id: row.mc_company_id,
      name: row.mc_company_name,
      tin: row.mc_tin,
      address: row.mc_address,
      status: row.mc_status,
    },
  }
}

/** Standard error funnel. Anything not already a service error is a 500. */
const handle = (res, error) => {
  if (error && error.status) {
    return fail(res, error.status, error.code, error.message)
  }
  if (error && error.code) {
    const status = statusForCode(error.code)
    return fail(res, status, error.code, error.message, {
      filing_id: error.filing_id,
      gap_keys: error.gap_keys,
    })
  }
  // eslint-disable-next-line no-console
  console.error('tax.controller: unhandled error', error)
  return fail(res, 500, 'INTERNAL', error.message || 'Unexpected error')
}

/** The company id can arrive in a query, a param or the body. */
const pickCompanyId = (req) =>
  (req.query && req.query.companyId) ||
  (req.params && req.params.companyId) ||
  (req.body && req.body.companyId) ||
  null

// ---------------------------------------------------------------------------
// Registry / metadata — the thin client's source of truth
// ---------------------------------------------------------------------------

const getRegistry = async (req, res) => {
  try {
    const forms = await listForms({ includeRetired: req.query.includeRetired === 'true' })
    return ok(res, {
      catalog_revision: CATALOG_REVISION,
      count: forms.length,
      forms: forms.map((form) => ({
        form_code: form.form_code,
        category: form.category,
        title: form.title,
        short_title: form.short_title,
        form_revision: form.form_revision,
        frequency: form.frequency,
        period_basis: form.period_basis,
        follows_fiscal_year: form.follows_fiscal_year,
        is_declaration: form.is_declaration,
        is_filable: form.is_filable,
        deadline: form.deadline,
        prerequisite_forms: form.prerequisite_forms,
        export_profiles: form.export_profiles,
        header_fields: form.header_fields,
        line_schema: form.line_schema,
        columns: form.columns,
        notes: form.notes,
        status: form.status,
      })),
    })
  } catch (error) {
    return handle(res, error)
  }
}

const getOneForm = async (req, res) => {
  try {
    const code = normalizeCode(req.params.formCode)
    const form = await getForm(code)
    if (!form) return fail(res, 404, 'UNKNOWN_FORM', `No form registered with code ${code}`)

    // The executable rules stay server-side; the mirror is returned so an
    // operator can see what was recorded at seed time next to what the code
    // actually evaluates.
    const executable = getExecutableForm(code)
    return ok(res, {
      ...form,
      computation_key: executable ? executable.computation_key : null,
      applicability_is_evaluated_in_code: true,
    })
  } catch (error) {
    return handle(res, error)
  }
}

const getRegistryDrift = async (req, res) => {
  try {
    const drift = await detectDrift()
    // Not an error: a drifted registry is a legitimate state to observe. The
    // status code says so rather than pretending everything is fine.
    return ok(res, drift, drift.in_sync ? 200 : 409)
  } catch (error) {
    return handle(res, error)
  }
}

// ---------------------------------------------------------------------------
// Applicability and deadlines
// ---------------------------------------------------------------------------

const getApplicability = async (req, res) => {
  try {
    const { companyId } = await resolveCompany(req, pickCompanyId(req))
    const result = await evaluateForCompany(companyId, {
      evidence: req.query.evidence ? JSON.parse(req.query.evidence) : null,
    })
    return ok(res, result)
  } catch (error) {
    return handle(res, error)
  }
}

const getDeadlines = async (req, res) => {
  try {
    const { companyId } = await resolveCompany(req, pickCompanyId(req))
    const year = req.query.year ? Number(req.query.year) : new Date().getFullYear()
    const month = req.query.month ? Number(req.query.month) : null
    const deadlines = await deadlinesFor(companyId, { year, month })
    return ok(res, { company_id: companyId, year, month, deadlines })
  } catch (error) {
    return handle(res, error)
  }
}

// ---------------------------------------------------------------------------
// Taxpayer profile
// ---------------------------------------------------------------------------

const readProfile = async (req, res) => {
  try {
    const { companyId } = await resolveCompany(req, pickCompanyId(req))
    const profile = await getProfile(companyId)
    return ok(res, { company_id: companyId, profile })
  } catch (error) {
    return handle(res, error)
  }
}

const writeProfile = async (req, res) => {
  try {
    const { userId } = resolveUser(req)
    const { companyId } = await resolveCompany(req, pickCompanyId(req))
    const profile = await saveProfile(companyId, req.body || {}, userId)
    return ok(res, { company_id: companyId, profile })
  } catch (error) {
    return handle(res, error)
  }
}

// ---------------------------------------------------------------------------
// Compute and file
// ---------------------------------------------------------------------------

/** Resolve the period for a form, honouring the taxpayer's fiscal year. */
const resolveFormPeriod = async ({ companyId, formCode, year, month, anchor }) => {
  const form = getExecutableForm(formCode)
  if (!form) {
    const error = new Error(`Unknown tax form: ${formCode}`)
    error.code = 'UNKNOWN_FORM'
    throw error
  }
  const profile = await getProfile(companyId)

  const basis =
    form.follows_fiscal_year &&
    profile &&
    profile.fiscal_year_end_month &&
    profile.fiscal_year_end_month !== 12
      ? form.period_basis === 'CALENDAR_YEAR'
        ? 'FISCAL_YEAR'
        : 'FISCAL_QUARTER'
      : form.period_basis

  // resolvePeriod takes a single YYYY-MM-DD anchor, not a {year, month} pair.
  // An explicit anchor wins; otherwise anchor to the first day of the month,
  // or the first day of the year when no month was given.
  const anchorDate = anchor
    ? String(anchor)
    : `${Number(year) || new Date().getFullYear()}-${String(month || 1).padStart(2, '0')}-01`
  const period = resolvePeriod(basis, anchorDate, profile || {})
  if (!period || period.error) {
    const error = new Error(
      `Cannot resolve a ${basis} period: ${(period && period.error) || 'unknown reason'}`,
    )
    error.code = 'INVALID_PERIOD'
    throw error
  }
  return { form, profile, period: { ...period, type: period.type, label: period.label } }
}

/**
 * Compute a form.
 *
 * Read-only by default. `save: true` persists the result, which is a
 * deliberate opt-in so a client can preview a return without creating filing
 * rows as a side effect of a page load.
 */
const postCompute = async (req, res) => {
  try {
    const user = resolveUser(req)
    const { companyId, company: companyRow } = await resolveCompany(req, pickCompanyId(req))
    const body = req.body || {}
    const formCode = normalizeCode(body.formCode)
    const shouldSave = body.save === true || body.save === 'true'

    const { form, profile, period } = await resolveFormPeriod({
      companyId,
      formCode,
      year: body.year,
      month: body.month,
      anchor: body.startDate || body.anchor, // Use startDate as anchor if provided
    })

    const options = {
      profile: profile || {},
      inputs: body.inputs || {},
      filedMonthlies: body.filedMonthlies || [],
      existingCertificates: body.existingCertificates || [],
      issuedCertificates: body.issuedCertificates || body.existingCertificates || [],
      remittances: [],
      payee: body.payee || null,
      taxYear: body.taxYear,
    }

    // Prior-period remittances are the taxpayer's own records, so they are read
    // rather than trusted from the request body.
    if (body.includeRemittances !== false) {
      options.remittances = await listRemittances({ companyId, formCode, to: period.start })
    }

    const computed = await computeForm(formCode, { year: body.year, month: body.month, anchor: body.startDate || body.anchor }, options)
    if (!computed.ok) {
      // A computation that could not run is not a filing result. Report it as
      // a conflict so the client distinguishes it from a form with no tax due.
      return fail(res, 409, computed.error ? computed.error.code : 'COMPUTATION_FAILED',
        computed.error ? computed.error.message : 'The form could not be computed', {
          form_code: formCode,
        })
    }

    const payload = {
      form_code: form.form_code,
      catalog_revision: CATALOG_REVISION,
      period,
      result: computed.result,
    }

    if (!shouldSave) {
      return ok(res, { ...payload, saved: false })
    }

    const saved = await saveComputation({
      companyId,
      userId: user.userId,
      formCode,
      period,
      computation: computed.result,
      overrides: body.overrides || null,
      payee: body.payee || null,
      // Agent identity comes from the tenant's own company record, so a 2307
      // can never carry another company's withholding agent on its face.
      agent: {
        tin: companyRow.tin,
        name: companyRow.name,
        address: companyRow.address,
      },
      rdoCode: (profile && profile.rdo_code) || null,
    })

    return ok(res, { ...payload, saved: true, filing: saved })
  } catch (error) {
    return handle(res, error)
  }
}

const getFilings = async (req, res) => {
  try {
    const { companyId } = await resolveCompany(req, pickCompanyId(req))
    const filings = await listFilings({
      companyId,
      formCode: req.query.formCode || null,
      status: req.query.status || null,
      from: req.query.from || null,
      to: req.query.to || null,
    })
    return ok(res, { company_id: companyId, count: filings.length, filings })
  } catch (error) {
    return handle(res, error)
  }
}

const getFilingById = async (req, res) => {
  try {
    const { companyId } = await resolveCompany(req, pickCompanyId(req))
    const filing = await getFiling({ companyId, filingId: Number(req.params.filingId) })
    if (!filing) return fail(res, 404, 'NOT_FOUND', 'Filing not found')
    const form = getExecutableForm(filing.form_code)
    return ok(res, { filing, form: form ? { form_code: form.form_code, title: form.title, short_title: form.short_title } : null })
  } catch (error) {
    return handle(res, error)
  }
}

/**
 * Acknowledge blocking gaps.
 *
 * The one endpoint that exists purely to make "filed with known gaps"
 * attributable: a reason is mandatory and is stored against the filing.
 */
const postAcknowledge = async (req, res) => {
  try {
    const user = resolveUser(req)
    const { companyId } = await resolveCompany(req, pickCompanyId(req))
    const body = req.body || {}
    const result = await acknowledgeGaps({
      companyId,
      userId: user.userId,
      filingId: Number(req.params.filingId),
      note: body.note,
      gapKeys: body.gapKeys || null,
    })
    return ok(res, result)
  } catch (error) {
    return handle(res, error)
  }
}

const postMarkFiled = async (req, res) => {
  try {
    const user = resolveUser(req)
    const { companyId } = await resolveCompany(req, pickCompanyId(req))
    const body = req.body || {}
    const result = await markFiled({
      companyId,
      userId: user.userId,
      filingId: Number(req.params.filingId),
      referenceNo: body.referenceNo || null,
      filedAt: body.filedAt || null,
    })
    return ok(res, result)
  } catch (error) {
    return handle(res, error)
  }
}

// ---------------------------------------------------------------------------
// Inputs and remittances
// ---------------------------------------------------------------------------

const getInputs = async (req, res) => {
  try {
    const { companyId } = await resolveCompany(req, pickCompanyId(req))
    const inputs = await listInputs({
      companyId,
      formCode: req.query.formCode || null,
      period: req.query.periodStart ? { start: req.query.periodStart } : null,
    })
    return ok(res, { company_id: companyId, inputs })
  } catch (error) {
    return handle(res, error)
  }
}

const putInputs = async (req, res) => {
  try {
    const user = resolveUser(req)
    const { companyId } = await resolveCompany(req, pickCompanyId(req))
    const body = req.body || {}
    const result = await saveInputs({
      companyId,
      userId: user.userId,
      formCode: body.formCode || null,
      period: { start: body.periodStart, end: body.periodEnd || body.periodStart },
      inputs: body.inputs || {},
    })
    return ok(res, result)
  } catch (error) {
    return handle(res, error)
  }
}

const getRemittances = async (req, res) => {
  try {
    const { companyId } = await resolveCompany(req, pickCompanyId(req))
    const remittances = await listRemittances({
      companyId,
      formCode: req.query.formCode || null,
      from: req.query.from || null,
      to: req.query.to || null,
    })
    return ok(res, { company_id: companyId, count: remittances.length, remittances })
  } catch (error) {
    return handle(res, error)
  }
}

const postRemittance = async (req, res) => {
  try {
    const user = resolveUser(req)
    const { companyId } = await resolveCompany(req, pickCompanyId(req))
    const body = req.body || {}
    const result = await saveRemittance({
      companyId,
      userId: user.userId,
      formCode: body.formCode || null,
      period: { start: body.periodStart, end: body.periodEnd },
      amountRemitted: body.amountRemitted,
      amountPaid: body.amountPaid,
      overpayment: body.overpayment,
      referenceNo: body.referenceNo,
      payeeName: body.payeeName,
      remittedAt: body.remittedAt,
      note: body.note,
    })
    return ok(res, result, 201)
  } catch (error) {
    return handle(res, error)
  }
}

const getCertificates = async (req, res) => {
  try {
    const { companyId } = await resolveCompany(req, pickCompanyId(req))
    const certificates = await listCertificates({
      companyId,
      filingId: req.query.filingId ? Number(req.query.filingId) : null,
      payeeTin: req.query.payeeTin || null,
      taxYear: req.query.taxYear ? Number(req.query.taxYear) : null,
    })
    // The payee-facing question "did I get my certificate?" needs the latest
    // generation only, which is what a payee is actually entitled to hold.
    const latestByKey = new Map()
    for (const cert of certificates) {
      const key = `${cert.tax_year}|${cert.payee_tin}`
      const held = latestByKey.get(key)
      if (!held || cert.generation > held.generation) latestByKey.set(key, cert)
    }
    return ok(res, {
      company_id: companyId,
      count: certificates.length,
      latest: Array.from(latestByKey.values()),
      certificates,
    })
  } catch (error) {
    return handle(res, error)
  }
}

module.exports = {
  // identity helpers, exported for the routes file and for tests
  resolveUser,
  resolveCompany,
  pickCompanyId,
  getRegistry,
  getOneForm,
  getRegistryDrift,
  getApplicability,
  getDeadlines,
  readProfile,
  writeProfile,
  postCompute,
  getFilings,
  getFilingById,
  postAcknowledge,
  postMarkFiled,
  getInputs,
  putInputs,
  getRemittances,
  postRemittance,
  getCertificates,
}
