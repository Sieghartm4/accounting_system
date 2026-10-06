'use strict'

const { Query } = require('../../database/util/queries.util')
const { getTenantPool } = require('../../database/util/tenantConnection.util')
const { getForm, resolveFormCode } = require('./catalog')
const { parseJson, CATALOG_REVISION } = require('./registry.service')

/**
 * Filing persistence.
 *
 * Saves a computation as a normalized filing: one `tax_filing` header, one
 * `tax_filing_line` row per catalog line, and one `tax_filing_gap` row per gap.
 * The legacy `tax_forms` JSON blob is not written here at all.
 *
 * Three rules govern everything in this file.
 *
 * 1. UNKNOWN IS NOT ZERO. A computed line that is null is written as NULL. A
 *    remittance that has not been confirmed is NULL, not 0.00. A return that
 *    silently turns "we don't know" into "zero" is a filing error that reads
 *    like a clean return, which is why the conversions below refuse to
 *    substitute a default.
 *
 * 2. TENANT SCOPING IS NOT OPTIONAL. Every read and write filters on
 *    company_id, including "get by id". A filing id from another tenant must
 *    read as not-found, not as someone else's return.
 *
 * 3. BLOCKING GAPS WARN, THEY DO NOT STOP. An error-severity gap requires an
 *    explicit acknowledgement with a reason before the filing can be marked
 *    acknowledged or filed. The reason is persisted, so "we filed it anyway"
 *    is always attributable to a person.
 */

const FILING_COLUMNS = `
  tfg_id, tfg_form_code, tfg_company_id, tfg_user_id, tfg_period_start, tfg_period_end,
  tfg_period_type, tfg_period_label, tfg_catalog_revision, tfg_status,
  tfg_has_blocking_gaps, tfg_acknowledged_by, tfg_acknowledged_at, tfg_acknowledgement_note,
  tfg_amount_paid, tfg_amount_still_due, tfg_filed_at, tfg_reference_no,
  tfg_payee_tin, tfg_payee_name, tfg_computed_at
`

/**
 * Coerce a computed value for storage without inventing a number.
 *
 * `undefined`, `null`, `''` and NaN all mean "not known" and become NULL.
 * Numeric strings are accepted because the client sends them as form values.
 * Anything else is left null rather than coerced, so a stray object cannot
 * become 0 and quietly balance a return.
 */
const toStoredNumber = (value) => {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'boolean') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

const toStoredText = (value) => {
  if (value === null || value === undefined) return null
  const s = String(value)
  return s === '' ? null : s
}

// Resolve a caller-supplied code to the exact registered `form_code`.
//
// This used to squash the code ("SCHED-A" -> "SCHEDA") and use that as both the
// lookup key and the value written to tfg_form_code / txi_form_code /
// trm_form_code. Hyphenated schedule codes match no row that way, so they were
// unfindable, and anything written under a squashed code could never be read
// back by a later exact query. Tolerating the punctuation variants is right;
// squashing the stored value was not.
const normalizeCode = (code) => resolveFormCode(code)

const rowToFiling = (row) => {
  if (!row) return null
  return {
    id: row.tfg_id,
    form_code: row.tfg_form_code,
    company_id: row.tfg_company_id,
    user_id: row.tfg_user_id,
    period_start: row.tfg_period_start,
    period_end: row.tfg_period_end,
    period_type: row.tfg_period_type,
    period_label: row.tfg_period_label,
    catalog_revision: row.tfg_catalog_revision,
    status: row.tfg_status,
    has_blocking_gaps: Boolean(row.tfg_has_blocking_gaps),
    acknowledged_by: row.tfg_acknowledged_by,
    acknowledged_at: row.tfg_acknowledged_at,
    acknowledgement_note: row.tfg_acknowledgement_note,
    amount_paid: row.tfg_amount_paid === null ? null : Number(row.tfg_amount_paid),
    amount_still_due: row.tfg_amount_still_due === null ? null : Number(row.tfg_amount_still_due),
    filed_at: row.tfg_filed_at,
    reference_no: row.tfg_reference_no,
    payee_tin: row.tfg_payee_tin,
    payee_name: row.tfg_payee_name,
    computed_at: row.tfg_computed_at,
  }
}

const rowToLine = (row) => ({
  id: row.tfl_id,
  line_key: row.tfl_line_key,
  line_number: row.tfl_line_number,
  section: row.tfl_section,
  label: row.tfl_label,
  kind: row.tfl_kind,
  emphasis: Boolean(row.tfl_emphasis),
  // DECIMAL columns come back as strings from mysql2. Kept as a string on the
  // way out too, because Number() would lose precision on large pesos values
  // and re-rounding is the one thing this module must not do.
  value: row.tfl_value === null ? null : String(row.tfl_value),
  value_text: row.tfl_value_text,
  columns: parseJson(row.tfl_columns, null),
  gap_key: row.tfl_gap_key,
  is_override: Boolean(row.tfl_is_override),
  override_note: row.tfl_override_note,
})

const rowToGap = (row) => ({
  id: row.tfp_id,
  gap_key: row.tfp_gap_key,
  severity: row.tfp_severity,
  message: row.tfp_message,
  detail: parseJson(row.tfp_detail, null),
  acknowledged: Boolean(row.tfp_acknowledged),
  acknowledged_by: row.tfp_acknowledged_by,
  acknowledged_at: row.tfp_acknowledged_at,
  acknowledgement_note: row.tfp_acknowledgement_note,
  resolved_at: row.tfp_resolved_at,
})

/** Pull the totals the header needs out of a computation's line bag. */
const totalsFromLines = (lines = {}) => {
  const pick = (...keys) => {
    for (const key of keys) {
      if (lines[key] !== undefined) return toStoredNumber(lines[key])
    }
    return null
  }
  return {
    amount_still_due: pick('amount_still_due', 'net_vat_payable_this_period', 'total_tax_due', 'tax_due'),
    amount_paid: pick('amount_paid'),
  }
}

/**
 * Build the line rows for a computation.
 *
 * The catalog line schema is the source of order, label and section, so a
 * return's shape is defined in one place. A line the computation produced but
 * the schema does not describe is still persisted, with its key and value, so
 * an unexpected computation output is visible rather than dropped.
 */
const buildLineRows = ({ filingId, companyId, formCode, form, computation, overrides }) => {
  const lines = (computation && computation.lines) || {}
  const schema = (form && form.line_schema) || []
  const rows = []
  const seen = new Set()

  for (const line of schema) {
    seen.add(line.key)
    const value = Object.prototype.hasOwnProperty.call(lines, line.key) ? lines[line.key] : null
    const override = overrides && Object.prototype.hasOwnProperty.call(overrides, line.key) ? overrides[line.key] : null
    const isOverride = override !== null && override !== undefined
    const stored = isOverride ? override.value : value
    const numeric = toStoredNumber(stored)
    const textual = toStoredText(isOverride ? override.value_text : null)

    rows.push([
      filingId,
      companyId,
      formCode,
      line.key,
      line.line === undefined ? null : line.line,
      toStoredText(line.section),
      toStoredText(line.label),
      line.kind || 'computed',
      line.emphasis ? 1 : 0,
      numeric,
      textual,
      line.columns ? JSON.stringify(line.columns) : null,
      toStoredText(line.gap_key),
      isOverride ? 1 : 0,
      isOverride ? toStoredText(override.note) : null,
    ])
  }

  for (const key of Object.keys(lines)) {
    if (seen.has(key)) continue
    const value = lines[key]
    if (value === undefined) continue
    const numeric = toStoredNumber(value)
    rows.push([
      filingId,
      companyId,
      formCode,
      key,
      null,
      null,
      toStoredText(key),
      'computed',
      0,
      numeric,
      toStoredText(value),
      null,
      null,
      0,
      null,
    ])
  }

  return rows
}

// tfl_columns and tfp_detail are JSON columns, and the values are bound as
// JSON text.
//
// Leaving the charset unspecified here is what made saves fail with "Cannot
// create a JSON value from a string with CHARACTER SET 'binary'". Two other
// fixes were tried and rejected against the live schema:
//
//   CAST(? AS JSON)  coerces a NULL parameter to NULL, so every schedule line
//                    was silently stored with its columns discarded.
//   Buffer.from(...) mysql2 sends a Buffer as explicitly binary, which is
//                    precisely the charset MySQL refuses.
//
// The fix belongs on the connection, which now declares utf8mb4 (see
// tenantConnection.util.js), so string parameters arrive as utf8mb4 text and
// MySQL can read them as a JSON document.
// tfl_columns and tfp_detail are JSON columns, bound as JSON text.
//
// mysql2 caches one prepared-statement plan per SQL text and reuses it, so the
// parameter encoding of whichever bind came FIRST on a connection is applied to
// every later bind of that same statement. When that first bind carried a NULL
// JSON column, MySQL reads the later JSON parameter as
// `CHARACTER SET 'binary` and rejects it:
//
//   Cannot create a JSON value from a string with CHARACTER SET 'binary'
//
// The behaviour is per connection, which is why it looked intermittent and why
// it tracked which form was saved first rather than anything about the data.
// Verified on cold and warm connections:
//
//   first bind on a connection is JSON     -> every later bind is fine
//   first bind on a connection is non-JSON -> every later JSON bind fails
//
// Neither a pool charset nor `multipleStatements` nor passing a Buffer changes
// it, and CAST(? AS JSON) is worse because it silently stores NULL for a NULL
// parameter, discarding every schedule's columns.
//
// Giving the JSON and non-JSON cases their own SQL text gives each its own
// cached plan, so the encoding is decided per statement rather than per
// connection and the order rows are written in stops mattering.
// Two textually distinct statements that insert the same row. They differ only
// by a trailing comment, which is what gives mysql2 a separate cached prepared
// statement for each - see the note above LINE_INSERT for why that matters.
const LINE_INSERT = `
  INSERT INTO tax_filing_line
    (tfl_filing_id, tfl_company_id, tfl_form_code, tfl_line_key, tfl_line_number, tfl_section,
     tfl_label, tfl_kind, tfl_emphasis, tfl_value, tfl_value_text, tfl_columns, tfl_gap_key,
     tfl_is_override, tfl_override_note)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`

const LINE_INSERT_JSON = `
  INSERT INTO tax_filing_line
    (tfl_filing_id, tfl_company_id, tfl_form_code, tfl_line_key, tfl_line_number, tfl_section,
     tfl_label, tfl_kind, tfl_emphasis, tfl_value, tfl_value_text, tfl_columns, tfl_gap_key,
     tfl_is_override, tfl_override_note)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) /* carries tfl_columns */
`

const GAP_INSERT = `
  INSERT INTO tax_filing_gap
    (tfp_filing_id, tfp_company_id, tfp_gap_key, tfp_severity, tfp_message, tfp_detail)
  VALUES (?, ?, ?, ?, ?, ?)
`

const GAP_INSERT_JSON = `
  INSERT INTO tax_filing_gap
    (tfp_filing_id, tfp_company_id, tfp_gap_key, tfp_severity, tfp_message, tfp_detail)
  VALUES (?, ?, ?, ?, ?, ?) /* carries tfp_detail */
`

const CERTIFICATE_INSERT = `
  INSERT INTO tax_certificate
    (tfc_filing_id, tfc_company_id, tfc_certificate_number, tfc_generation, tfc_supersedes_id,
     tfc_tax_year, tfc_payee_tin, tfc_payee_name, tfc_agent_tin, tfc_agent_name,
     tfc_agent_address, tfc_rdo_code, tfc_total_payments, tfc_total_tax_withheld,
     tfc_status, tfc_issued_at, tfc_blocked, tfc_blocked_reason, tfc_created_by)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`

const CERTIFICATE_COLUMNS = `tfc_id, tfc_filing_id, tfc_company_id, tfc_certificate_number,
     tfc_generation, tfc_supersedes_id, tfc_tax_year, tfc_payee_tin, tfc_payee_name,
     tfc_agent_tin, tfc_agent_name, tfc_agent_address, tfc_rdo_code,
     tfc_total_payments, tfc_total_tax_withheld, tfc_status, tfc_issued_at,
     tfc_blocked, tfc_blocked_reason, tfc_created_by, tfc_created_at`

const rowToCertificate = (row) => ({
  id: row.tfc_id,
  filing_id: row.tfc_filing_id,
  certificate_number: row.tfc_certificate_number,
  generation: row.tfc_generation,
  supersedes_id: row.tfc_supersedes_id,
  tax_year: row.tfc_tax_year,
  payee_tin: row.tfc_payee_tin,
  payee_name: row.tfc_payee_name,
  agent_tin: row.tfc_agent_tin,
  agent_name: row.tfc_agent_name,
  agent_address: row.tfc_agent_address,
  rdo_code: row.tfc_rdo_code,
  // Left as strings for the same reason as filing lines: DECIMAL precision.
  total_payments: row.tfc_total_payments === null ? null : String(row.tfc_total_payments),
  total_tax_withheld:
    row.tfc_total_tax_withheld === null ? null : String(row.tfc_total_tax_withheld),
  status: row.tfc_status,
  issued_at: row.tfc_issued_at,
  blocked: Boolean(row.tfc_blocked),
  blocked_reason: row.tfc_blocked_reason,
  created_by: row.tfc_created_by,
  created_at: row.tfc_created_at,
})

/**
 * Turn a 2307 computation's certificate block into persistable rows.
 *
 * Returns an empty list for every other form: a certificate only exists where
 * the computation produced one, so this is keyed off the computation rather
 * than off the form code. That keeps a new certificate-bearing form from
 * needing a code change here.
 */
const buildCertificateRows = ({
  filingId,
  companyId,
  userId,
  computation,
  agent = null,
  rdoCode = null,
}) => {
  const certificate = computation && computation.certificate
  if (!certificate) return []

  const blocked = certificate.issuable === false
  const totals = (computation && computation.totals) || (computation && computation.lines) || {}

  // A blocked certificate still gets a row. The tax really was withheld, and
  // dropping it would make "we owe this payee a certificate" invisible.
  return [
    [
      filingId,
      companyId,
      toStoredText(certificate.certificate_number),
      Number(certificate.generation) || 1,
      toStoredText(certificate.supersedes_id) || null,
      Number(certificate.tax_year) || new Date().getFullYear(),
      toStoredText(certificate.payee_tin),
      toStoredText(certificate.payee_name),
      toStoredText(agent && agent.tin),
      toStoredText(agent && agent.name),
      toStoredText(agent && agent.address),
      toStoredText(rdoCode),
      toStoredNumber(totals.total_payments),
      toStoredNumber(totals.total_tax_withheld),
      // The enum has no 'blocked' member; tfc_blocked carries that state
      // alongside the real status, so an unissuable certificate is an issued
      // row flagged blocked rather than a status the schema cannot hold.
      'issued',
      toStoredText(certificate.issued_at) || toStoredText(certificate.issue_date) || null,
      blocked ? 1 : 0,
      blocked ? toStoredText(certificate.blocked_reason) : null,
      userId === undefined || userId === null ? null : userId,
    ],
  ]
}

/**
 * Persist a computation.
 *
 * Re-running is safe and is the intended workflow: the header is matched on
 * (form, company, period, payee) and updated in place, lines and gaps are
 * replaced wholesale, and a manual override is preserved across recomputes
 * rather than being silently overwritten by a fresh computation.
 */
const saveComputation = async ({
  companyId,
  userId,
  formCode,
  period,
  computation,
  overrides = null,
  payee = null,
  // The withholding agent details that print on a 2307. Taken from the
  // company's own profile, never from the request body, so a certificate
  // cannot be issued with someone else's agent details on it.
  agent = null,
  rdoCode = null,
}) => {
  const code = normalizeCode(formCode)
  const form = getForm(code)
  if (!form) {
    const error = new Error(`Unknown tax form: ${formCode}`)
    error.code = 'UNKNOWN_FORM'
    throw error
  }
  if (!period || !period.start || !period.end) {
    const error = new Error('A filing needs a resolved period with start and end dates')
    error.code = 'PERIOD_REQUIRED'
    throw error
  }
  if (companyId === null || companyId === undefined) {
    // Never fall back to a default company. The old controller did, which
    // wrote every tenant's returns against company 1.
    const error = new Error('companyId is required')
    error.code = 'COMPANY_REQUIRED'
    throw error
  }

  const gaps = (computation && computation.gaps) || []
  const blocking = gaps.filter((g) => g.severity === 'error')
  const totals = totalsFromLines((computation && computation.lines) || {})
  const payeeTin = toStoredText(payee && payee.tin)
  // A fresh computation is always 'computed'. A filed return is never reopened
  // by a recompute (see below), and acknowledgment is its own transition.
  const status = 'computed'

  const pool = getTenantPool()
  const connection = await pool.getConnection()

  try {
    await connection.beginTransaction()

    const [existingRows] = await connection.execute(
      `SELECT tfg_id, tfg_status, tfg_acknowledgement_note FROM tax_filing
        WHERE tfg_form_code = ? AND tfg_company_id = ?
          AND tfg_period_start = ? AND tfg_period_end = ?
          AND tfg_payee_tin <=> ?
        LIMIT 1`,
      [code, companyId, period.start, period.end, payeeTin],
    )

    let filingId
    let previous = existingRows && existingRows[0]

    if (previous) {
      filingId = previous.tfg_id
      // A filed or acknowledged return is not silently reopened by a
      // recompute. The caller must explicitly re-open it, so the record of
      // what was filed survives an experiment.
      if (previous.tfg_status === 'filed' || previous.tfg_status === 'filed_with_bir') {
        await connection.rollback()
        const error = new Error(
          `Filing ${filingId} for ${code} (${period.start}..${period.end}) is already filed. Re-open it before recomputing.`,
        )
        error.code = 'ALREADY_FILED'
        error.filing_id = filingId
        throw error
      }
      await connection.execute(
        `UPDATE tax_filing
            SET tfg_status = ?,
                tfg_period_type = ?,
                tfg_period_label = ?,
                tfg_catalog_revision = ?,
                tfg_has_blocking_gaps = ?,
                tfg_amount_paid = ?,
                tfg_amount_still_due = ?,
                tfg_payee_name = ?,
                tfg_computed_at = CURRENT_TIMESTAMP,
                tfg_updated_at = CURRENT_TIMESTAMP
          WHERE tfg_id = ?`,
        [
          status,
          period.type || 'MONTH',
          toStoredText(period.label),
          toStoredText(period.catalog_revision || CATALOG_REVISION),
          blocking.length ? 1 : 0,
          totals.amount_paid,
          totals.amount_still_due,
          toStoredText(payee && payee.name),
          filingId,
        ],
      )
    } else {
      const [result] = await connection.execute(
        `INSERT INTO tax_filing
           (tfg_form_code, tfg_company_id, tfg_user_id, tfg_period_start, tfg_period_end,
            tfg_period_type, tfg_period_label, tfg_catalog_revision, tfg_status,
            tfg_has_blocking_gaps, tfg_amount_paid, tfg_amount_still_due,
            tfg_payee_tin, tfg_payee_name, tfg_computed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [
          code,
          companyId,
          userId === undefined || userId === null ? null : userId,
          period.start,
          period.end,
          period.type || 'MONTH',
          toStoredText(period.label),
          toStoredText(period.catalog_revision || CATALOG_REVISION),
          status,
          blocking.length ? 1 : 0,
          totals.amount_paid,
          totals.amount_still_due,
          payeeTin,
          toStoredText(payee && payee.name),
        ],
      )
      filingId = result.insertId
    }

    // Carry forward any unacknowledged override so a recompute does not wipe
    // a value a human entered.
    const [overrideRows] = await connection.execute(
      `SELECT tfl_line_key, tfl_value, tfl_value_text, tfl_override_note
         FROM tax_filing_line
        WHERE tfl_filing_id = ? AND tfl_is_override = 1`,
      [filingId],
    )
    // A plain object, not a Map. `{ ...someMap }` yields {} and would silently
    // discard every carried override, which is the one thing this read exists
    // to prevent.
    const carried = {}
    for (const row of overrideRows || []) {
      carried[row.tfl_line_key] = {
        value: row.tfl_value === null ? row.tfl_value_text : Number(row.tfl_value),
        note: row.tfl_override_note,
      }
    }

    await connection.execute('DELETE FROM tax_filing_line WHERE tfl_filing_id = ?', [filingId])
    await connection.execute('DELETE FROM tax_filing_gap WHERE tfp_filing_id = ?', [filingId])

    const effectiveOverrides = { ...carried, ...(overrides || {}) }
    const lineRows = buildLineRows({
      filingId,
      companyId,
      formCode: code,
      form,
      computation,
      overrides: effectiveOverrides,
    })

    // Rows keep their schema order. Each row picks the statement variant that
    // matches whether it carries a JSON document, so mysql2 compiles a separate
    // prepared statement for the JSON case and the parameter encoding no longer
    // depends on which shape this connection happened to bind first.
    for (const values of lineRows) {
      const carriesJson = values[11] !== null && values[11] !== undefined
      await connection.execute(carriesJson ? LINE_INSERT_JSON : LINE_INSERT, values)
    }

    // Same for the gap detail document.
    for (const gap of gaps) {
      const carriesJson = gap.detail !== undefined
      await connection.execute(carriesJson ? GAP_INSERT_JSON : GAP_INSERT, [
        filingId,
        companyId,
        toStoredText(gap.key) || 'unknown',
        gap.severity || 'info',
        toStoredText(gap.message),
        carriesJson ? JSON.stringify(gap.detail) : null,
      ])
    }

    // Certificates are replaced with the rest of the computation, same as lines
    // and gaps, so a recompute cannot leave a stale certificate attached to
    // figures that have since changed.
    await connection.execute('DELETE FROM tax_certificate WHERE tfc_filing_id = ?', [filingId])

    const certificateRows = buildCertificateRows({
      filingId,
      companyId,
      userId,
      computation,
      agent: agent || null,
      rdoCode: rdoCode || null,
    })
    for (const values of certificateRows) {
      await connection.execute(CERTIFICATE_INSERT, values)
    }

    await connection.commit()

    return {
      filing_id: filingId,
      form_code: code,
      is_new: !previous,
      status,
      has_blocking_gaps: blocking.length > 0,
      blocking_gap_count: blocking.length,
      requires_acknowledgement: blocking.length > 0,
      lines_written: lineRows.length,
      gaps_written: gaps.length,
      certificates_written: certificateRows.length,
      overrides_preserved: Object.keys(carried).length,
    }
  } catch (error) {
    try {
      await connection.rollback()
    } catch {
      // The connection is already unusable; the original error is the one
      // that explains the failure.
    }
    throw error
  } finally {
    connection.release()
  }
}

/**
 * Acknowledge outstanding error-severity gaps.
 *
 * A note is mandatory. This is the whole reason the module can let a filing
 * proceed despite missing data: the decision to file with a known gap is
 * recorded against a person and a timestamp, not lost.
 */
const acknowledgeGaps = async ({ companyId, userId, filingId, note, gapKeys = null }) => {
  if (!note || String(note).trim().length < 3) {
    const error = new Error('An acknowledgement reason is required')
    error.code = 'ACK_NOTE_REQUIRED'
    throw error
  }

  const pool = getTenantPool()
  const connection = await pool.getConnection()

  try {
    await connection.beginTransaction()

    const [filingRows] = await connection.execute(
      `SELECT tfg_id, tfg_status, tfg_has_blocking_gaps
         FROM tax_filing
        WHERE tfg_id = ? AND tfg_company_id = ?
        LIMIT 1`,
      [filingId, companyId],
    )
    const filing = filingRows && filingRows[0]
    if (!filing) {
      await connection.rollback()
      const error = new Error('Filing not found')
      error.code = 'NOT_FOUND'
      throw error
    }
    if (filing.tfg_status === 'filed' || filing.tfg_status === 'filed_with_bir') {
      await connection.rollback()
      const error = new Error('A filed return cannot be re-acknowledged')
      error.code = 'ALREADY_FILED'
      throw error
    }

    const params = [userId === undefined ? null : userId, note, filingId, companyId]
    let keyClause = ''
    if (Array.isArray(gapKeys) && gapKeys.length) {
      keyClause = ` AND tfp_gap_key IN (${gapKeys.map(() => '?').join(', ')})`
      params.push(...gapKeys)
    }
    const [ackResult] = await connection.execute(
      `UPDATE tax_filing_gap
          SET tfp_acknowledged = 1,
              tfp_acknowledged_by = ?,
              tfp_acknowledged_at = CURRENT_TIMESTAMP,
              tfp_acknowledgement_note = ?
        WHERE tfp_filing_id = ? AND tfp_company_id = ? AND tfp_severity = 'error'
          AND tfp_acknowledged = 0${keyClause}`,
      params,
    )

    // Recompute the flag from what is actually outstanding rather than
    // clearing it, so an acknowledgment that missed a gap is visible.
    const [openRows] = await connection.execute(
      `SELECT COUNT(*) AS open_errors FROM tax_filing_gap
        WHERE tfp_filing_id = ? AND tfp_company_id = ?
          AND tfp_severity = 'error' AND tfp_acknowledged = 0`,
      [filingId, companyId],
    )
    const openErrors = Number(openRows[0].open_errors || 0)

    await connection.execute(
      `UPDATE tax_filing
          SET tfg_has_blocking_gaps = ?,
              tfg_acknowledged_by = ?,
              tfg_acknowledged_at = CURRENT_TIMESTAMP,
              tfg_acknowledgement_note = ?,
              tfg_status = ?,
              tfg_updated_at = CURRENT_TIMESTAMP
        WHERE tfg_id = ?`,
      [openErrors > 0 ? 1 : 0, userId === undefined ? null : userId, note, openErrors > 0 ? 'computed' : 'acknowledged', filingId],
    )

    await connection.commit()

    return {
      filing_id: filingId,
      acknowledged: ackResult.affectedRows,
      remaining_blocking_gaps: openErrors,
      fully_acknowledged: openErrors === 0,
      status: openErrors > 0 ? 'computed' : 'acknowledged',
    }
  } catch (error) {
    try {
      await connection.rollback()
    } catch {
      /* original error wins */
    }
    throw error
  } finally {
    connection.release()
  }
}

const getFiling = async ({ companyId, filingId }) => {
  const rows = await Query(
    `SELECT ${FILING_COLUMNS} FROM tax_filing WHERE tfg_id = ? AND tfg_company_id = ? LIMIT 1`,
    [filingId, companyId],
  )
  const filing = rowToFiling(rows && rows[0])
  if (!filing) return null

  const [lineRows, gapRows] = await Promise.all([
    Query(
      `SELECT tfl_id, tfl_line_key, tfl_line_number, tfl_section, tfl_label, tfl_kind,
              tfl_emphasis, tfl_value, tfl_value_text, tfl_columns, tfl_gap_key,
              tfl_is_override, tfl_override_note
         FROM tax_filing_line
        WHERE tfl_filing_id = ? AND tfl_company_id = ?
        ORDER BY tfl_section, tfl_line_number, tfl_id`,
      [filingId, companyId],
    ),
    Query(
      `SELECT tfp_id, tfp_gap_key, tfp_severity, tfp_message, tfp_detail,
              tfp_acknowledged, tfp_acknowledged_by, tfp_acknowledged_at,
              tfp_acknowledgement_note, tfp_resolved_at
         FROM tax_filing_gap
        WHERE tfp_filing_id = ? AND tfp_company_id = ?
        ORDER BY tfp_severity, tfp_gap_key`,
      [filingId, companyId],
    ),
  ])

  filing.lines = (Array.isArray(lineRows) ? lineRows : []).map(rowToLine)
  filing.gaps = (Array.isArray(gapRows) ? gapRows : []).map(rowToGap)
  filing.blocking_gaps = filing.gaps.filter((g) => g.severity === 'error' && !g.acknowledged)
  return filing
}

const listFilings = async ({ companyId, formCode = null, status = null, from = null, to = null }) => {
  const where = ['tfg_company_id = ?']
  const params = [companyId]
  if (formCode) {
    where.push('tfg_form_code = ?')
    params.push(normalizeCode(formCode))
  }
  if (status) {
    where.push('tfg_status = ?')
    params.push(status)
  }
  if (from) {
    where.push('tfg_period_end >= ?')
    params.push(from)
  }
  if (to) {
    where.push('tfg_period_start <= ?')
    params.push(to)
  }
  const rows = await Query(
    `SELECT ${FILING_COLUMNS} FROM tax_filing
      WHERE ${where.join(' AND ')}
      ORDER BY tfg_period_end DESC, tfg_form_code`,
    params,
  )
  return (Array.isArray(rows) ? rows : []).map(rowToFiling)
}

/**
 * Mark a return as filed with BIR.
 *
 * Refuses while error-severity gaps are unacknowledged. This is the one place
 * the module does block, and only because the acknowledgment gate above is how
 * a filing-with-gaps stays attributable.
 */
const markFiled = async ({ companyId, userId, filingId, referenceNo = null, filedAt = null }) => {
  const rows = await Query(
    `SELECT tfg_id, tfg_status, tfg_has_blocking_gaps
       FROM tax_filing WHERE tfg_id = ? AND tfg_company_id = ? LIMIT 1`,
    [filingId, companyId],
  )
  const filing = rows && rows[0]
  if (!filing) {
    const error = new Error('Filing not found')
    error.code = 'NOT_FOUND'
    throw error
  }
  if (filing.tfg_status === 'filed' || filing.tfg_status === 'filed_with_bir') {
    return { filing_id: filingId, already_filed: true, status: filing.tfg_status }
  }

  if (Number(filing.tfg_has_blocking_gaps) > 0) {
    const error = new Error(
      'This return has unacknowledged blocking gaps. Acknowledge them with a reason before filing.',
    )
    error.code = 'UNACKNOWLEDGED_GAPS'
    error.filing_id = filingId
    throw error
  }

  const openGaps = await Query(
    `SELECT tfp_gap_key FROM tax_filing_gap
      WHERE tfp_filing_id = ? AND tfp_company_id = ?
        AND tfp_severity = 'error' AND tfp_acknowledged = 0`,
    [filingId, companyId],
  )
  if (Array.isArray(openGaps) && openGaps.length) {
    const error = new Error('This return has unacknowledged blocking gaps')
    error.code = 'UNACKNOWLEDGED_GAPS'
    error.filing_id = filingId
    error.gap_keys = openGaps.map((g) => g.tfp_gap_key)
    throw error
  }

  const result = await Query(
    `UPDATE tax_filing
        SET tfg_status = 'filed',
            tfg_reference_no = ?,
            tfg_filed_at = COALESCE(?, CURRENT_TIMESTAMP),
            tfg_user_id = COALESCE(?, tfg_user_id),
            tfg_updated_at = CURRENT_TIMESTAMP
      WHERE tfg_id = ? AND tfg_company_id = ?`,
    [toStoredText(referenceNo), toStoredText(filedAt), userId === undefined ? null : userId, filingId, companyId],
  )

  return {
    filing_id: filingId,
    already_filed: false,
    status: 'filed',
    reference_no: toStoredText(referenceNo),
    updated: result ? result.affectedRows : 0,
  }
}

// ---------------------------------------------------------------------------
// Manual inputs and remittances
// ---------------------------------------------------------------------------

/**
 * Save manual inputs.
 *
 * An input whose value is absent is written as NULL with no value column set,
 * not as 0. `tax_input` is keyed on (company, key, period) so re-entering a
 * figure updates rather than accumulates.
 */
const saveInputs = async ({ companyId, userId, formCode = null, period, inputs }) => {
  if (!period || !period.start) {
    const error = new Error('Inputs need a period start')
    error.code = 'PERIOD_REQUIRED'
    throw error
  }
  const code = formCode ? normalizeCode(formCode) : null
  const written = []

  for (const [inputKey, raw] of Object.entries(inputs || {})) {
    const entry = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : { value: raw }
    const number = toStoredNumber(entry.value)
    const text = toStoredText(entry.value_text)
    const date = toStoredText(entry.value_date)

    await Query(
      `INSERT INTO tax_input
         (txi_company_id, txi_form_code, txi_input_key, txi_period_start, txi_period_end,
          txi_value_number, txi_value_text, txi_value_date, txi_source, txi_note, txi_created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'manual', ?, ?)
       ON DUPLICATE KEY UPDATE
         txi_form_code = VALUES(txi_form_code),
         txi_period_end = VALUES(txi_period_end),
         txi_value_number = VALUES(txi_value_number),
         txi_value_text = VALUES(txi_value_text),
         txi_value_date = VALUES(txi_value_date),
         txi_source = 'manual',
         txi_note = VALUES(txi_note),
         txi_created_by = VALUES(txi_created_by)`,
      [
        companyId,
        code,
        toStoredText(inputKey),
        period.start,
        toStoredText(period.end),
        number,
        text,
        date,
        toStoredText(entry.note),
        userId === undefined ? null : userId,
      ],
    )
    written.push({ input_key: inputKey, known: number !== null || text !== null || date !== null })
  }

  return { written: written.length, inputs: written }
}

const listInputs = async ({ companyId, formCode = null, period }) => {
  const where = ['txi_company_id = ?']
  const params = [companyId]
  if (formCode) {
    where.push('txi_form_code = ?')
    params.push(normalizeCode(formCode))
  }
  if (period && period.start) {
    where.push('txi_period_start = ?')
    params.push(period.start)
  }
  const rows = await Query(
    `SELECT txi_input_key, txi_value_number, txi_value_text, txi_value_date,
            txi_source, txi_note, txi_period_start, txi_period_end
       FROM tax_input
      WHERE ${where.join(' AND ')}
      ORDER BY txi_input_key`,
    params,
  )
  const out = {}
  for (const row of Array.isArray(rows) ? rows : []) {
    out[row.txi_input_key] = {
      value: row.txi_value_number === null ? null : String(row.txi_value_number),
      value_text: row.txi_value_text,
      value_date: row.txi_value_date,
      source: row.txi_source,
      note: row.txi_note,
      period_start: row.txi_period_start,
      period_end: row.txi_period_end,
    }
  }
  return out
}

/**
 * Record a remittance.
 *
 * An unconfirmed remittance is stored with NULL amounts, so "not yet paid" is
 * distinguishable from "paid nothing". That distinction is what stops a return
 * from claiming a prior-payment credit that was never made.
 */
const saveRemittance = async ({
  companyId,
  userId,
  formCode = null,
  period,
  amountRemitted = null,
  amountPaid = null,
  overpayment = 0,
  referenceNo = null,
  payeeName = null,
  remittedAt = null,
  note = null,
}) => {
  if (!period || !period.start || !period.end) {
    const error = new Error('A remittance needs a period start and end')
    error.code = 'PERIOD_REQUIRED'
    throw error
  }
  const code = formCode ? normalizeCode(formCode) : null
  const result = await Query(
    `INSERT INTO tax_remittance
       (trm_company_id, trm_form_code, trm_period_start, trm_period_end, trm_month,
        trm_amount_remitted, trm_amount_paid, trm_overpayment, trm_payee_name,
        trm_reference_no, trm_remitted_at, trm_source, trm_note, trm_created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'manual', ?, ?)`,
    [
      companyId,
      code,
      period.start,
      period.end,
      toStoredText(period.start.slice(0, 7)),
      toStoredNumber(amountRemitted),
      toStoredNumber(amountPaid),
      toStoredNumber(overpayment) === null ? 0 : toStoredNumber(overpayment),
      toStoredText(payeeName),
      toStoredText(referenceNo),
      toStoredText(remittedAt),
      toStoredText(note),
      userId === undefined ? null : userId,
    ],
  )
  return {
    remittance_id: result ? result.insertId : null,
    confirmed: toStoredNumber(amountRemitted) !== null || toStoredNumber(amountPaid) !== null,
  }
}

const listRemittances = async ({ companyId, formCode = null, from = null, to = null }) => {
  const where = ['trm_company_id = ?']
  const params = [companyId]
  if (formCode) {
    where.push('trm_form_code = ?')
    params.push(normalizeCode(formCode))
  }
  if (from) {
    where.push('trm_period_end >= ?')
    params.push(from)
  }
  if (to) {
    where.push('trm_period_start <= ?')
    params.push(to)
  }
  const rows = await Query(
    `SELECT trm_id, trm_form_code, trm_period_start, trm_period_end, trm_month,
            trm_amount_remitted, trm_amount_paid, trm_overpayment, trm_payee_name,
            trm_reference_no, trm_remitted_at, trm_source, trm_note
       FROM tax_remittance
      WHERE ${where.join(' AND ')}
      ORDER BY trm_period_start DESC, trm_id DESC`,
    params,
  )
  return (Array.isArray(rows) ? rows : []).map((row) => ({
    id: row.trm_id,
    form_code: row.trm_form_code,
    period_start: row.trm_period_start,
    period_end: row.trm_period_end,
    month: row.trm_month,
    // Kept as strings. See rowToLine for why.
    amount_remitted: row.trm_amount_remitted === null ? null : String(row.trm_amount_remitted),
    amount_paid: row.trm_amount_paid === null ? null : String(row.trm_amount_paid),
    overpayment: row.trm_overpayment === null ? null : String(row.trm_overpayment),
    payee_name: row.trm_payee_name,
    reference_no: row.trm_reference_no,
    remitted_at: row.trm_remitted_at,
    source: row.trm_source,
    note: row.trm_note,
  }))
}

/**
 * Read certificates back.
 *
 * Scoped by company always. A filing id narrows it further but is never the
 * only filter, so a guessed filing id from another tenant returns nothing.
 */
const listCertificates = async ({ companyId, filingId = null, payeeTin = null, taxYear = null } = {}) => {
  if (companyId === null || companyId === undefined) {
    const error = new Error('companyId is required')
    error.code = 'COMPANY_REQUIRED'
    throw error
  }
  const where = ['tfc_company_id = ?']
  const params = [companyId]
  if (filingId !== null && filingId !== undefined) {
    where.push('tfc_filing_id = ?')
    params.push(filingId)
  }
  if (payeeTin) {
    where.push('tfc_payee_tin = ?')
    params.push(String(payeeTin))
  }
  if (taxYear) {
    where.push('tfc_tax_year = ?')
    params.push(Number(taxYear))
  }
  const rows = await Query(
    `SELECT ${CERTIFICATE_COLUMNS}
       FROM tax_certificate
      WHERE ${where.join(' AND ')}
      ORDER BY tfc_tax_year DESC, tfc_payee_tin, tfc_generation DESC`,
    params,
  )
  return (Array.isArray(rows) ? rows : []).map(rowToCertificate)
}

module.exports = {
  FILING_COLUMNS,
  toStoredNumber,
  toStoredText,
  normalizeCode,
  rowToFiling,
  rowToLine,
  rowToGap,
  rowToCertificate,
  buildLineRows,
  buildCertificateRows,
  totalsFromLines,
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
}
