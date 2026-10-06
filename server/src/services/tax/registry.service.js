'use strict'

const { Query } = require('../../database/util/queries.util')
const { FORMS, FORMS_BY_CODE, isFilable, resolveFormCode } = require('./catalog')
const {
  evaluateApplicability,
  buildFacts,
  detectConflicts,
  PROFILE_FACTS_REQUIRED_FOR_CONFIDENCE,
} = require('./applicability.service')
const { bindingProblems } = require('./computation')
const { resolvePeriod, filingDeadline } = require('./period.service')

/**
 * Form registry service — the DB-backed read path.
 *
 * Division of responsibility, because this is the part that is easy to get
 * subtly wrong:
 *
 *   The DATABASE holds which forms exist, their presentation (headers, line
 *   schema, column layout, labels, deadlines) and whether they are active. The
 *   registry can therefore be extended and retired without a code change.
 *
 *   The CODE holds the executable rules. Applicability predicates are JavaScript
 *   functions and cannot be serialized into a column, so `tfr_applicability`
 *   is a declarative MIRROR for display and audit only. Every evaluation in
 *   this file runs against the in-process catalog. Nothing here ever evaluates
 *   the mirrored JSON.
 *
 * `detectDrift` compares the two and reports divergence instead of letting the
 * mirror and the code disagree quietly at filing time.
 */

const CATALOG_REVISION = '2026.09.26'

const REGISTRY_COLUMNS = `
  tfr_id, tfr_form_code, tfr_category, tfr_title, tfr_short_title, tfr_form_revision,
  tfr_frequency, tfr_period_basis, tfr_follows_fiscal_year, tfr_computation_key,
  tfr_is_declaration, tfr_is_filable,
  tfr_deadline_day, tfr_deadline_offset_months, tfr_deadline_grace_weekend_to,
  tfr_prerequisite_forms, tfr_export_profiles, tfr_header_fields, tfr_line_schema,
  tfr_columns, tfr_applicability, tfr_notes, tfr_catalog_revision, tfr_status, tfr_synced_at
`

/**
 * Tolerant JSON column reader.
 *
 * mysql2 parses JSON columns into JS values by default, but a JSON column
 * returns a raw string on MariaDB (where JSON is an alias for LONGTEXT) and on
 * any driver configured with `jsonStrings`. Accepting both means a tenant
 * database choice cannot silently turn a line schema into the literal string
 * '[{"key":"..."}]'. A value that is already parsed passes through untouched,
 * so this is safe to call on either shape.
 */
const parseJson = (value, fallback = null) => {
  if (value === null || value === undefined) return fallback
  if (typeof value !== 'string') return value
  const trimmed = value.trim()
  if (!trimmed) return fallback
  try {
    return JSON.parse(trimmed)
  } catch {
    // Unparseable means the column holds something other than the JSON we
    // wrote. Returning the fallback keeps a corrupt cell from crashing the
    // whole registry read; the drift check is what reports the corruption.
    return fallback
  }
}

/** Map a DB row to the shape the rest of the tax module expects. */
const rowToForm = (row) => {
  if (!row) return null
  return {
    form_code: row.tfr_form_code,
    category: row.tfr_category,
    title: row.tfr_title,
    short_title: row.tfr_short_title,
    form_revision: row.tfr_form_revision,
    frequency: row.tfr_frequency,
    period_basis: row.tfr_period_basis,
    follows_fiscal_year: Boolean(row.tfr_follows_fiscal_year),
    computation_key: row.tfr_computation_key,
    is_declaration: Boolean(row.tfr_is_declaration),
    is_filable: Boolean(row.tfr_is_filable),
    deadline:
      row.tfr_deadline_day === null || row.tfr_deadline_day === undefined
        ? null
        : {
            day: row.tfr_deadline_day,
            offset_months: row.tfr_deadline_offset_months || 0,
            grace_weekend_to: row.tfr_deadline_grace_weekend_to,
          },
    prerequisite_forms: parseJson(row.tfr_prerequisite_forms, []),
    export_profiles: parseJson(row.tfr_export_profiles, []),
    header_fields: parseJson(row.tfr_header_fields, []),
    line_schema: parseJson(row.tfr_line_schema, []),
    columns: parseJson(row.tfr_columns, []),
    // Mirror only — never evaluated.
    applicability_mirror: parseJson(row.tfr_applicability, null),
    notes: row.tfr_notes || null,
    catalog_revision: row.tfr_catalog_revision,
    status: row.tfr_status,
    from_registry: true,
  }
}

/**
 * Render a catalog rule function tree into plain JSON.
 *
 * The rule fragments in the catalog are built by predicate factories, so this
 * reads the well-known marker properties off each node. Anything it does not
 * recognise becomes `{ unsupported: true }` rather than being dropped, so a
 * rule the mirror cannot express shows up as a gap in the mirror instead of
 * vanishing.
 */
const ruleToMirror = (rule, depth = 0) => {
  if (rule === null || rule === undefined) return null
  if (typeof rule !== 'object') return { literal: String(rule) }
  if (depth > 12) return { truncated: true }

  if (Array.isArray(rule.all)) return { all: rule.all.map((r) => ruleToMirror(r, depth + 1)) }
  if (Array.isArray(rule.any)) return { any: rule.any.map((r) => ruleToMirror(r, depth + 1)) }
  if (Array.isArray(rule.none)) return { none: rule.none.map((r) => ruleToMirror(r, depth + 1)) }

  const out = {}
  for (const key of ['fact', 'equals', 'in', 'not_equals', 'truthy', 'falsy', 'greater_than', 'less_than', 'not']) {
    if (rule[key] !== undefined) out[key] = rule[key]
  }
  return Object.keys(out).length ? out : { unsupported: true }
}

const toJson = (value) => JSON.stringify(value === undefined ? null : value)

/**
 * Upsert one catalog form into the registry.
 *
 * Idempotent by form_code: re-seeding updates presentation and marks
 * tfr_synced_at rather than inserting duplicates, so `db:seed:all` can be run
 * repeatedly.
 */
const syncForm = async (form, sequelize = null) => {
  const deadline = form.deadline || {}
  const payload = [
    form.category,
    form.title,
    form.short_title || null,
    form.form_revision || null,
    form.frequency,
    form.period_basis,
    Boolean(form.follows_fiscal_year),
    form.computation_key || null,
    Boolean(form.is_declaration),
    isFilable(form),
    deadline.day === undefined ? null : deadline.day,
    deadline.offset_months === undefined ? 0 : deadline.offset_months,
    deadline.grace_weekend_to === undefined ? null : deadline.grace_weekend_to,
    toJson(form.prerequisite_forms || []),
    toJson(form.export_profiles || []),
    toJson(form.header_fields || []),
    toJson(form.line_schema || []),
    toJson(form.columns || []),
    toJson(ruleToMirror(form.applicability)),
    form.notes || null,
    CATALOG_REVISION,
    'active',
  ]

  const sql = `
    INSERT INTO tax_form_registry
      (tfr_form_code, tfr_category, tfr_title, tfr_short_title, tfr_form_revision,
       tfr_frequency, tfr_period_basis, tfr_follows_fiscal_year, tfr_computation_key,
       tfr_is_declaration, tfr_is_filable,
       tfr_deadline_day, tfr_deadline_offset_months, tfr_deadline_grace_weekend_to,
       tfr_prerequisite_forms, tfr_export_profiles, tfr_header_fields, tfr_line_schema,
       tfr_columns, tfr_applicability, tfr_notes, tfr_catalog_revision, tfr_status, tfr_synced_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON DUPLICATE KEY UPDATE
      tfr_category = VALUES(tfr_category),
      tfr_title = VALUES(tfr_title),
      tfr_short_title = VALUES(tfr_short_title),
      tfr_form_revision = VALUES(tfr_form_revision),
      tfr_frequency = VALUES(tfr_frequency),
      tfr_period_basis = VALUES(tfr_period_basis),
      tfr_follows_fiscal_year = VALUES(tfr_follows_fiscal_year),
      tfr_computation_key = VALUES(tfr_computation_key),
      tfr_is_declaration = VALUES(tfr_is_declaration),
      tfr_is_filable = VALUES(tfr_is_filable),
      tfr_deadline_day = VALUES(tfr_deadline_day),
      tfr_deadline_offset_months = VALUES(tfr_deadline_offset_months),
      tfr_deadline_grace_weekend_to = VALUES(tfr_deadline_grace_weekend_to),
      tfr_prerequisite_forms = VALUES(tfr_prerequisite_forms),
      tfr_export_profiles = VALUES(tfr_export_profiles),
      tfr_header_fields = VALUES(tfr_header_fields),
      tfr_line_schema = VALUES(tfr_line_schema),
      tfr_columns = VALUES(tfr_columns),
      tfr_applicability = VALUES(tfr_applicability),
      tfr_notes = VALUES(tfr_notes),
      tfr_catalog_revision = VALUES(tfr_catalog_revision),
      tfr_status = 'active',
      tfr_synced_at = CURRENT_TIMESTAMP
  `

  if (sequelize) return sequelize.query(sql, { replacements: [form.form_code, ...payload] })
  return Query(sql, [form.form_code, ...payload])
}

/** Sync every catalog form, and retire registry rows the catalog no longer has. */
const syncAll = async (sequelize = null) => {
  if (bindingProblems.length) {
    throw new Error(
      `Refusing to seed the registry: the catalog is inconsistent. ${bindingProblems.join('; ')}`,
    )
  }

  const synced = []
  for (const form of FORMS) {
    await syncForm(form, sequelize)
    synced.push(form.form_code)
  }

  // Rows the code no longer declares are retired rather than deleted, so a
  // filing that references one keeps resolving to something.
  const placeholders = FORMS.map(() => '?').join(', ')
  const retireSql = `UPDATE tax_form_registry SET tfr_status = 'retired'
     WHERE tfr_form_code NOT IN (${placeholders}) AND tfr_status = 'active'`
  const retired = await (sequelize
    ? sequelize.query(retireSql, { replacements: FORMS.map((f) => f.form_code) })
    : Query(retireSql, FORMS.map((f) => f.form_code)))

  return {
    synced: synced.length,
    form_codes: synced,
    catalog_revision: CATALOG_REVISION,
    retired: retired ? retired.affectedRows || 0 : 0,
  }
}

// ---------------------------------------------------------------------------
// Read path
// ---------------------------------------------------------------------------

const listForms = async ({ includeRetired = false, category = null } = {}) => {
  const where = []
  const params = []
  if (!includeRetired) {
    where.push('tfr_status = ?')
    params.push('active')
  }
  if (category) {
    where.push('tfr_category = ?')
    params.push(category)
  }
  const sql = `SELECT ${REGISTRY_COLUMNS} FROM tax_form_registry
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY tfr_category, tfr_form_code`

  const rows = await Query(sql, params)
  return (Array.isArray(rows) ? rows : []).map(rowToForm)
}

const getForm = async (formCode) => {
  // Match on the registered code, not a squashed one: SCHED-A squashes to
  // SCHEDA, which matches no registry row, so every schedule form 404'd.
  const code = resolveFormCode(formCode)
  if (!code) return null
  const rows = await Query(`SELECT ${REGISTRY_COLUMNS} FROM tax_form_registry WHERE tfr_form_code = ?`, [code])
  const row = Array.isArray(rows) ? rows[0] : null
  return rowToForm(row)
}

/** The executable form for a code: always the in-process catalog. */
const getExecutableForm = (formCode) => {
  const code = resolveFormCode(formCode)
  return code ? FORMS_BY_CODE.get(code) || null : null
}

const getProfile = async (companyId) => {
  const rows = await Query(
    `SELECT txp_company_id, txp_taxpayer_type, txp_vat_registered, txp_subject_to_income_tax,
            txp_fiscal_year_end_month, txp_rdo_code, txp_rdo_name, txp_tin, txp_legal_name,
            txp_registered_address, txp_ewt_remitter, txp_withholding_agent_for_compensation,
            txp_has_creditable_withheld, txp_efps_channel, txp_confirmed_at
       FROM tax_profile WHERE txp_company_id = ?`,
    [companyId],
  )
  const row = Array.isArray(rows) ? rows[0] : null
  if (!row) return null
  return {
    company_id: row.txp_company_id,
    taxpayer_type: row.txp_taxpayer_type,
    vat_registered: row.txp_vat_registered === null ? null : Boolean(row.txp_vat_registered),
    subject_to_income_tax:
      row.txp_subject_to_income_tax === null ? null : Boolean(row.txp_subject_to_income_tax),
    fiscal_year_end_month: row.txp_fiscal_year_end_month,
    rdo_code: row.txp_rdo_code,
    rdo_name: row.txp_rdo_name,
    tin: row.txp_tin,
    legal_name: row.txp_legal_name,
    registered_address: row.txp_registered_address,
    ewt_remitter: row.txp_ewt_remitter === null ? null : Boolean(row.txp_ewt_remitter),
    withholding_agent_for_compensation:
      row.txp_withholding_agent_for_compensation === null
        ? null
        : Boolean(row.txp_withholding_agent_for_compensation),
    has_creditable_withheld:
      row.txp_has_creditable_withheld === null ? null : Boolean(row.txp_has_creditable_withheld),
    efps_channel: row.txp_efps_channel,
    confirmed_at: row.txp_confirmed_at,
  }
}

const saveProfile = async (companyId, profile, userId = null) => {
  const values = [
    profile.taxpayer_type ?? null,
    profile.vat_registered ?? null,
    profile.subject_to_income_tax ?? null,
    profile.fiscal_year_end_month ?? null,
    profile.rdo_code ?? null,
    profile.rdo_name ?? null,
    profile.tin ?? null,
    profile.legal_name ?? null,
    profile.registered_address ?? null,
    profile.ewt_remitter ?? null,
    profile.withholding_agent_for_compensation ?? null,
    profile.has_creditable_withheld ?? null,
    profile.efps_channel ?? null,
    userId,
    companyId,
  ]

  await Query(
    `INSERT INTO tax_profile
       (txp_taxpayer_type, txp_vat_registered, txp_subject_to_income_tax,
        txp_fiscal_year_end_month, txp_rdo_code, txp_rdo_name, txp_tin, txp_legal_name,
        txp_registered_address, txp_ewt_remitter, txp_withholding_agent_for_compensation,
        txp_has_creditable_withheld, txp_efps_channel, txp_confirmed_by, txp_company_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       txp_taxpayer_type = VALUES(txp_taxpayer_type),
       txp_vat_registered = VALUES(txp_vat_registered),
       txp_subject_to_income_tax = VALUES(txp_subject_to_income_tax),
       txp_fiscal_year_end_month = VALUES(txp_fiscal_year_end_month),
       txp_rdo_code = VALUES(txp_rdo_code),
       txp_rdo_name = VALUES(txp_rdo_name),
       txp_tin = VALUES(txp_tin),
       txp_legal_name = VALUES(txp_legal_name),
       txp_registered_address = VALUES(txp_registered_address),
       txp_ewt_remitter = VALUES(txp_ewt_remitter),
       txp_withholding_agent_for_compensation = VALUES(txp_withholding_agent_for_compensation),
       txp_has_creditable_withheld = VALUES(txp_has_creditable_withheld),
       txp_efps_channel = VALUES(txp_efps_channel),
       txp_confirmed_by = VALUES(txp_confirmed_by),
       txp_confirmed_at = CURRENT_TIMESTAMP`,
    values,
  )
  return getProfile(companyId)
}

// ---------------------------------------------------------------------------
// Applicability for a company
// ---------------------------------------------------------------------------

/**
 * What this taxpayer has to file, and why.
 *
 * `evidence` comes from the ledger (has_vat_postings, has_ewt_postings, ...).
 * Both are optional, and the result says which ones were supplied so a
 * "not_applicable" backed by no evidence at all is visibly weaker than one
 * backed by a full ledger read.
 */
const evaluateForCompany = async (companyId, { evidence = null, periodAnchor = null } = {}) => {
  const profile = await getProfile(companyId)
  const evaluated = evaluateApplicability(FORMS, { profile, evidence: evidence || {} })
  const conflicts = detectConflicts(evaluated.facts)

  const missingProfileFacts = PROFILE_FACTS_REQUIRED_FOR_CONFIDENCE.filter(
    (key) => !profile || profile[key] === null || profile[key] === undefined,
  )

  return {
    company_id: companyId,
    profile,
    profile_complete: missingProfileFacts.length === 0,
    missing_profile_facts: missingProfileFacts,
    evidence_supplied: Boolean(evidence),
    facts: evaluated.facts,
    conflicts,
    results: evaluated.results,
    // Nothing here is authoritative without a profile. Say so rather than
    // presenting an unconfigured taxpayer as having no obligations.
    advisory_only: !profile || missingProfileFacts.length > 0,
    catalog_revision: CATALOG_REVISION,
  }
}

/** Registry deadlines for a company across a set of forms and periods. */
const deadlinesFor = async (companyId, { year = new Date().getFullYear(), month = null } = {}) => {
  const profile = await getProfile(companyId)
  const forms = await listForms()
  const anchor = month
    ? `${year}-${String(month).padStart(2, '0')}-01`
    : `${year}-01-01`

  return forms
    .filter((form) => form.deadline)
    .map((form) => {
      const executable = getExecutableForm(form.form_code) || form
      const basis =
        form.follows_fiscal_year &&
        profile &&
        profile.fiscal_year_end_month &&
        profile.fiscal_year_end_month !== 12
          ? form.period_basis === 'CALENDAR_YEAR'
            ? 'FISCAL_YEAR'
            : 'FISCAL_QUARTER'
          : form.period_basis

      const period = resolvePeriod(basis, anchor, profile || {})
      if (!period || period.error) {
        return { form_code: form.form_code, error: period ? period.error : 'unresolvable period' }
      }
      return {
        form_code: form.form_code,
        short_title: form.short_title,
        period_label: period.label,
        period_start: period.start,
        period_end: period.end,
        deadline: filingDeadline(executable, period, profile || {}),
      }
    })
}

// ---------------------------------------------------------------------------
// Drift
// ---------------------------------------------------------------------------

/**
 * Compare the registry against the code catalog.
 *
 * A form present in one and not the other means the registry is stale: either
 * the seeder has not been run since a code change, or a row was edited directly
 * in the database. Both are reported rather than silently resolved, because
 * picking a winner would mean either ignoring a deploy or silently discarding
 * a database edit.
 */
const detectDrift = async () => {
  const rows = await listForms({ includeRetired: true })
  const byCode = new Map(rows.map((row) => [row.form_code, row]))

  const missing_in_db = []
  const missing_in_code = []
  const revision_mismatch = []
  const schema_mismatch = []

  for (const form of FORMS) {
    const row = byCode.get(form.form_code)
    if (!row) {
      missing_in_db.push(form.form_code)
      continue
    }
    if (row.status === 'retired') missing_in_db.push(`${form.form_code} (retired in registry)`)
    if (row.catalog_revision !== CATALOG_REVISION) {
      revision_mismatch.push({
        form_code: form.form_code,
        registry: row.catalog_revision,
        code: CATALOG_REVISION,
      })
    }
    const registryKeys = (row.line_schema || []).map((l) => l.key).sort()
    const codeKeys = (form.line_schema || []).map((l) => l.key).sort()
    if (JSON.stringify(registryKeys) !== JSON.stringify(codeKeys)) {
      schema_mismatch.push({
        form_code: form.form_code,
        only_in_registry: registryKeys.filter((k) => !codeKeys.includes(k)),
        only_in_code: codeKeys.filter((k) => !registryKeys.includes(k)),
      })
    }
  }

  for (const row of rows) {
    if (!FORMS_BY_CODE.has(row.form_code) && row.status === 'active') {
      missing_in_code.push(row.form_code)
    }
  }

  const inSync =
    missing_in_db.length === 0 &&
    missing_in_code.length === 0 &&
    revision_mismatch.length === 0 &&
    schema_mismatch.length === 0

  return {
    in_sync: inSync,
    catalog_revision: CATALOG_REVISION,
    missing_in_db,
    missing_in_code,
    revision_mismatch,
    schema_mismatch,
  }
}

module.exports = {
  CATALOG_REVISION,
  REGISTRY_COLUMNS,
  parseJson,
  rowToForm,
  ruleToMirror,
  syncForm,
  syncAll,
  listForms,
  getForm,
  getExecutableForm,
  getProfile,
  saveProfile,
  evaluateForCompany,
  deadlinesFor,
  detectDrift,
}
