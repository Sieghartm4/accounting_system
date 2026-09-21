const { Accounting } = require('../database/model/Accounting')

/**
 * Accounting lifecycle control:
 *
 *   PREPARED
 *      ↓
 *   CHECKED
 *      ↓
 *   APPROVED / POSTED   ← posted (immutable from this point on)
 *      ↓
 *   LOCKED
 *
 * Once a document is posted, its journal entries are IMMUTABLE. Edits,
 * deletions, replacements, and amount/date/account changes are prohibited.
 * Corrections must be recorded as REVERSALS / ADJUSTING ENTRIES against the
 * posted transaction rather than by mutating the original journal rows.
 */

const POSTED_STATES = ['APPROVED', 'POSTED', 'LOCKED']

const IMMUTABLE_STATES = ['APPROVED', 'POSTED', 'LOCKED', 'CANCELLED', 'REJECTED', 'VOID']

const DOCUMENT_DEFINITIONS = {
  sales: { model: Accounting.sales, stateColumn: 'state', label: 'Sales' },
  purchase: { model: Accounting.purchase, stateColumn: 'state', label: 'Purchase' },
  receipts: { model: Accounting.receipts, stateColumn: 'state', label: 'Receipt' },
  collections: {
    model: Accounting.collections,
    stateColumn: 'state',
    label: 'Collection',
  },
  cash_disbursements: {
    model: Accounting.cash_disbursements,
    stateColumn: 'state',
    label: 'Cash Disbursement',
  },
  payments: { model: Accounting.payments, stateColumn: 'state', label: 'Payment' },
  adjustments: {
    model: Accounting.adjustments,
    stateColumn: 'status',
    label: 'Adjustment',
  },
}

class JournalLockedError extends Error {
  constructor(message, info = {}) {
    super(message)
    this.name = 'JournalLockedError'
    this.code = 'JOURNAL_LOCKED'
    this.statusCode = 409
    Object.assign(this, info)
  }
}

class JournalSourceNotFoundError extends Error {
  constructor(message, info = {}) {
    super(message)
    this.name = 'JournalSourceNotFoundError'
    this.code = 'JOURNAL_SOURCE_NOT_FOUND'
    this.statusCode = 404
    Object.assign(this, info)
  }
}

/**
 * @param {string|null|undefined} state
 * @returns {boolean} true when the document lifecycle state is posted/locked
 */
function isPostedState(state) {
  if (!state) return false
  return POSTED_STATES.includes(String(state).toUpperCase())
}

/**
 * Resolves the current lifecycle state of a source document.
 *
 * @param {import('mysql2/promise').PoolConnection} connection
 * @param {string} dbName - journal_entries.je_db_name value
 * @param {string|number} dbId - journal_entries.je_db_id value
 * @returns {Promise<{db_name:string, db_id:string, state:string, editable:boolean, document_reference:string|null}>}
 */
async function getDocumentState(connection, dbName, dbId) {
  const def = DOCUMENT_DEFINITIONS[dbName]
  if (!def) {
    throw new JournalSourceNotFoundError(
      `Unsupported journal source type: ${dbName}`,
      { db_name: dbName, db_id: String(dbId) },
    )
  }

  const col = def.model.selectOptionColumns
  const stateCol = col[def.stateColumn]
  const idCol = col.id

  const hasDocumentReference =
    Object.prototype.hasOwnProperty.call(col, 'document_reference')

  const docRefSelect = hasDocumentReference
    ? `, ${col.document_reference} AS document_reference`
    : ', NULL AS document_reference'

  const [rows] = await connection.execute(
    `SELECT ${idCol} AS id, ${stateCol} AS state${docRefSelect} FROM ${def.model.tablename} WHERE ${idCol} = ? LIMIT 1`,
    [String(dbId)],
  )

  if (!rows || rows.length === 0) {
    throw new JournalSourceNotFoundError(
      `${def.label} document ${dbId} does not exist`,
      { db_name: dbName, db_id: String(dbId) },
    )
  }

  const state = rows[0].state || null

  return {
    db_name: dbName,
    db_id: String(dbId),
    state,
    editable: isEditableDocumentState(state),
    document_reference: rows[0].document_reference || null,
  }
}

/**
 * @param {string|null} state
 * @returns {boolean} true while the document may still have its journal rows changed
 */
function isEditableDocumentState(state) {
  if (!state) return true
  return !IMMUTABLE_STATES.includes(String(state).toUpperCase())
}

/**
 * Throws a JournalLockedError when the source document is posted/locked.
 * Used by every document update path so that posted journal entries can never
 * be regenerated, deleted, replaced, or have their amount/date/account changed.
 */
async function assertEditableDocument(connection, dbName, dbId) {
  const doc = await getDocumentState(connection, dbName, dbId)

  if (!doc.editable) {
    throw new JournalLockedError(
      `${doc.db_name.toUpperCase()} ${doc.db_id} is ${doc.state} and is LOCKED. ` +
        `Journal entries of approved/posted transactions are immutable. ` +
        `Create a REVERSAL / adjusting entry instead of editing this document.`,
      {
        db_name: doc.db_name,
        db_id: doc.db_id,
        state: doc.state,
        document_reference: doc.document_reference,
      },
    )
  }

  return doc
}

/**
 * Throws when the source document is NOT posted. Used by the reversal flow to
 * guarantee only approved/posted transactions can be reversed.
 */
async function assertPostedDocument(connection, dbName, dbId) {
  const doc = await getDocumentState(connection, dbName, dbId)

  if (!isPostedState(doc.state)) {
    throw new JournalLockedError(
      `${doc.db_name.toUpperCase()} ${doc.db_id} is ${doc.state} and cannot be reversed. ` +
        `Only APPROVED/POSTED transactions can be reversed.`,
      {
        db_name: doc.db_name,
        db_id: doc.db_id,
        state: doc.state,
        document_reference: doc.document_reference,
        statusCode: 400,
        code: 'JOURNAL_NOT_POSTED',
      },
    )
  }

  return doc
}

/**
 * Express helper: writes the canonical JSON body for a journal-lock error,
 * or returns null (caller should keep its own handling) when the error is not
 * a journal-lock guard error.
 */
function sendJournalLockError(res, error) {
  if (error instanceof JournalLockedError) {
    res.status(error.statusCode || 409).json({
      success: false,
      message: error.message,
      code: error.code,
      db_name: error.db_name,
      db_id: error.db_id,
      state: error.state,
      timestamp: new Date().toISOString(),
    })
    return true
  }

  if (error instanceof JournalSourceNotFoundError) {
    res.status(error.statusCode || 404).json({
      success: false,
      message: error.message,
      code: error.code,
      db_name: error.db_name,
      db_id: error.db_id,
      timestamp: new Date().toISOString(),
    })
    return true
  }

  return false
}

module.exports = {
  isPostedState,
  isEditableDocumentState,
  getDocumentState,
  assertEditableDocument,
  assertPostedDocument,
  sendJournalLockError,
  JournalLockedError,
  JournalSourceNotFoundError,
  POSTED_STATES,
  IMMUTABLE_STATES,
  DOCUMENT_DEFINITIONS,
}