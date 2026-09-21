const { Accounting } = require('../database/model/Accounting')
const { Master } = require('../database/model/Master')
const {
  getDocumentState,
  isPostedState,
  JournalLockedError,
} = require('./journalLock.util')

const A = Accounting

/**
 * Posted-document "safe edit" support.
 *
 * APPROVED / POSTED / LOCKED documents keep their journal entries immutable,
 * but certain metadata may still be corrected in place without touching the
 * books: document_reference, remarks, and attachments.
 *
 * Update controllers call assertPostedSafeEdit() before their normal editing
 * logic. When the document is NOT posted, it returns null and the controller
 * proceeds with the full update. When the document IS posted it validates that
 * only safe fields (plus attachments) changed; otherwise it throws a
 * JournalLockedError. On success it returns the list of safe header columns
 * that changed so the controller can apply applyPostedSafeEdit() and short-
 * circuit the item/journal regeneration.
 */

const MODULE_CONFIG = {
  sales: {
    label: 'Sales',
    auditModule: 'SALES',
    model: A.sales,
    headerColumns: [
      { payloadKey: 'customer_id', modelKey: 'customer_id', numeric: true },
      { payloadKey: 'document_reference', modelKey: 'document_reference', numeric: false },
      { payloadKey: 'terms', modelKey: 'terms', numeric: false },
      { payloadKey: 'date_delivered', modelKey: 'date_delivered', numeric: false },
      { payloadKey: 'date_due', modelKey: 'date_due', numeric: false },
      { payloadKey: 'remarks', modelKey: 'remarks', numeric: false },
      { payloadKey: 'total_amount_due', modelKey: 'total_amount_due', numeric: true },
    ],
    safePayloadKeys: ['document_reference', 'remarks'],
    attachments: {
      model: A.sales_attachments,
      parentKey: 'sales_id',
      payloadKey: 'attachments',
    },
    items: {
      model: A.sales_items,
      parentKey: 'sales_id',
      payloadKey: 'sales_items',
      fields: [
        ['product_id', 'product_service', false],
        ['account_id', 'charts_of_accounts', true],
        ['description', 'description', false],
        ['qty', 'quantity', true],
        ['price', 'sales_price', true],
        ['discount', 'discount', true],
        ['discount_type', 'discount_type', false],
        ['vat', 'vat', true],
        ['wtax', 'witholding_tax', true],
        ['responsibility_center', 'responsibility_center', false],
      ],
    },
  },
  purchase: {
    label: 'Purchase',
    auditModule: 'PURCHASE',
    model: A.purchase,
    headerColumns: [
      { payloadKey: 'vendor_id', modelKey: 'vendor_id', numeric: true },
      { payloadKey: 'document_reference', modelKey: 'document_reference', numeric: false },
      { payloadKey: 'terms', modelKey: 'terms', numeric: false },
      { payloadKey: 'date_delivered', modelKey: 'date_delivered', numeric: false },
      { payloadKey: 'date_due', modelKey: 'date_due', numeric: false },
      { payloadKey: 'remarks', modelKey: 'remarks', numeric: false },
      { payloadKey: 'total_amount_due', modelKey: 'total_amount_due', numeric: true },
    ],
    safePayloadKeys: ['document_reference', 'remarks'],
    attachments: {
      model: A.purchase_attachments,
      parentKey: 'purchase_id',
      payloadKey: 'attachments',
    },
    items: {
      model: A.purchase_items,
      parentKey: 'purchase_id',
      payloadKey: 'purchase_items',
      fields: [
        ['product_id', 'product_service', false],
        ['account_id', 'charts_of_accounts', true],
        ['description', 'description', false],
        ['qty', 'quantity', true],
        ['price', 'purchase_price', true],
        ['discount', 'discount', true],
        ['discount_type', 'discount_type', false],
        ['vat', 'vat', true],
        ['wtax', 'withholding_tax', true],
        ['responsibility_center', 'responsibility_center', false],
      ],
    },
  },
  receipts: {
    label: 'Receipt',
    auditModule: 'RECEIPT',
    model: A.receipts,
    headerColumns: [
      { payloadKey: 'customer_id', modelKey: 'customer_id', numeric: true },
      { payloadKey: 'document_reference', modelKey: 'document_reference', numeric: false },
      { payloadKey: 'payment_date', modelKey: 'collection_date', numeric: false },
      { payloadKey: 'mode_of_payment', modelKey: 'mode_of_payment', numeric: false },
      { payloadKey: 'bank_name', modelKey: 'bank_name', numeric: false },
      { payloadKey: 'check_number', modelKey: 'check_number', numeric: false },
      { payloadKey: 'remarks', modelKey: 'remarks', numeric: false },
      { payloadKey: 'total_amount_due', modelKey: 'total_amount_due', numeric: true },
    ],
    safePayloadKeys: ['document_reference', 'remarks'],
    attachments: {
      model: A.receipt_attachments,
      parentKey: 'receipt_id',
      payloadKey: 'attachments',
    },
    items: {
      model: A.receipt_items,
      parentKey: 'receipts_id',
      payloadKey: 'receipt_items',
      fields: [
        ['product_id', 'product_service', false],
        ['account_id', 'charts_of_accounts', true],
        ['description', 'description', false],
        ['qty', 'quantity', true],
        ['price', 'sales_price', true],
        ['discount', 'discount', true],
        ['discount_type', 'discount_type', false],
        ['vat', 'vat', true],
        ['wtax', 'withholding_tax', true],
        ['responsibility_center', 'responsibility_center', false],
      ],
    },
  },
  collections: {
    label: 'Collection',
    auditModule: 'COLLECTION',
    model: A.collections,
    headerColumns: [
      { payloadKey: 'customer_id', modelKey: 'customer_id', numeric: true },
      { payloadKey: 'document_reference', modelKey: 'document_reference', numeric: false },
      { payloadKey: 'mode_of_payment', modelKey: 'mode_of_payment', numeric: false },
      { payloadKey: 'bank_name', modelKey: 'bank_name', numeric: false },
      { payloadKey: 'check_number', modelKey: 'check_number', numeric: false },
      { payloadKey: 'collection_date', modelKey: 'collection_date', numeric: false },
      { payloadKey: 'remarks', modelKey: 'remarks', numeric: false },
    ],
    safePayloadKeys: ['document_reference', 'remarks'],
    attachments: {
      model: A.collection_attachments,
      parentKey: 'collection_id',
      payloadKey: 'attachments',
    },
    items: {
      model: A.collection_items,
      parentKey: 'collection_id',
      payloadKey: 'collection_items',
      fields: [
        ['sales_id', 'sales_id', true],
        ['amount_applied', 'amount_applied', true],
      ],
    },
  },
  cash_disbursements: {
    label: 'Cash Disbursement',
    auditModule: 'CASH DISBURSEMENT',
    model: A.cash_disbursements,
    headerColumns: [
      { payloadKey: 'vendor_id', modelKey: 'vendor_id', numeric: true },
      { payloadKey: 'document_reference', modelKey: 'document_reference', numeric: false },
      { payloadKey: 'payment_date', modelKey: 'payment_date', numeric: false },
      { payloadKey: 'mode_of_payment', modelKey: 'mode_of_payment', numeric: false },
      { payloadKey: 'bank_name', modelKey: 'bank_name', numeric: false },
      { payloadKey: 'check_number', modelKey: 'check_number', numeric: false },
      { payloadKey: 'remarks', modelKey: 'remarks', numeric: false },
      { payloadKey: 'total_amount_due', modelKey: 'total_amount_due', numeric: true },
    ],
    safePayloadKeys: ['document_reference', 'remarks'],
    attachments: {
      model: A.cash_disbursement_attachments,
      parentKey: 'cash_disburssement_id',
      payloadKey: 'attachments',
    },
    items: {
      model: A.cash_disbursement_items,
      parentKey: 'cash_disbursement_id',
      payloadKey: 'disbursement_items',
      fields: [
        ['product_id', 'product_service', false],
        ['account_id', 'charts_of_accounts', true],
        ['description', 'description', false],
        ['qty', 'quantity', true],
        ['price', 'purchase_price', true],
        ['discount', 'discount', true],
        ['discount_type', 'discount_type', false],
        ['vat', 'vat', true],
        ['wtax', 'witholding_tax', true],
        ['responsibility_center', 'responsibility_center', false],
      ],
    },
  },
  payments: {
    label: 'Payment',
    auditModule: 'PAYMENT',
    model: A.payments,
    headerColumns: [
      { payloadKey: 'vendor_id', modelKey: 'vendor_id', numeric: true },
      { payloadKey: 'document_reference', modelKey: 'document_reference', numeric: false },
      { payloadKey: 'mode_of_payment', modelKey: 'mode_of_payment', numeric: false },
      { payloadKey: 'bank_name', modelKey: 'bank_name', numeric: false },
      { payloadKey: 'check_number', modelKey: 'check_number', numeric: false },
      { payloadKey: 'payment_date', modelKey: 'payment_date', numeric: false },
      { payloadKey: 'remarks', modelKey: 'remarks', numeric: false },
    ],
    safePayloadKeys: ['document_reference', 'remarks'],
    attachments: {
      model: A.payment_attachments,
      parentKey: 'payment_id',
      payloadKey: 'attachments',
    },
    items: {
      model: A.payment_items,
      parentKey: 'payment_id',
      payloadKey: 'payment_items',
      fields: [
        ['purchase_id', 'purchase_id', true],
        ['amount_applied', 'amount_applied', true],
      ],
    },
  },
  adjustments: {
    label: 'Adjustment',
    auditModule: 'ADJUSTMENT',
    model: A.adjustments,
    headerColumns: [
      { payloadKey: 'document_reference', modelKey: 'document_reference', numeric: false },
      { payloadKey: 'posting_date', modelKey: 'posting_date', numeric: false },
      { payloadKey: 'remarks', modelKey: 'remarks', numeric: false },
      { payloadKey: 'total_amount', modelKey: 'total_amount', numeric: true },
    ],
    safePayloadKeys: ['document_reference', 'remarks'],
    attachments: {
      model: A.adjustment_attachments,
      parentKey: 'adjustment_id',
      payloadKey: 'adjustment_attachments',
    },
    items: null,
  },
}

const NUMERIC_PATTERNS = {
  DECIMAL: true,
  INTEGER: true,
  BIGINT: true,
  FLOAT: true,
  DOUBLE: true,
  TINYINT: true,
  SMALLINT: true,
}

function normalize(value) {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

function normNum(value) {
  const n = parseFloat(value)
  return Number.isFinite(n) ? n : 0
}

function normCell(value, numeric) {
  return numeric ? normNum(value) : normalize(value)
}

function cellKey(value, numeric) {
  const v = normCell(value, numeric)
  return `${numeric ? 'N' : 'S'}:${v}`
}

function compareTuples(a, b) {
  for (let i = 0; i < a.length && i < b.length; i++) {
    const av = a[i]
    const bv = b[i]
    if (av !== bv) return av < bv ? -1 : 1
  }
  return a.length - b.length
}

function tuplesEqual(left, right) {
  if (left.length !== right.length) return false
  for (let i = 0; i < left.length; i++) {
    const a = left[i]
    const b = right[i]
    if (a.length !== b.length) return false
    for (let j = 0; j < a.length; j++) if (a[j] !== b[j]) return false
  }
  return true
}

async function getCurrentHeaderRow(connection, cfg, dbId) {
  const col = cfg.model.selectOptionColumns
  const selectList = cfg.headerColumns
    .map((h) => `${col[h.modelKey]} AS ${h.modelKey}`)
    .join(', ')
  const [rows] = await connection.execute(
    `SELECT ${col.id} AS id, ${selectList} FROM ${cfg.model.tablename} WHERE ${col.id} = ? LIMIT 1`,
    [String(dbId)],
  )
  return rows[0] || null
}

function computeHeaderDiff(cfg, payload, currentRow) {
  const changedSafe = []
  const unsafeChanged = []
  for (const h of cfg.headerColumns) {
    if (!(h.payloadKey in payload)) continue
    const current = currentRow ? normCell(currentRow[h.modelKey], h.numeric) : ''
    const incoming = normCell(payload[h.payloadKey], h.numeric)
    if (current !== incoming) {
      if (cfg.safePayloadKeys.includes(h.payloadKey)) changedSafe.push(h.payloadKey)
      else unsafeChanged.push(h.payloadKey)
    }
  }
  return { changedSafe: [...new Set(changedSafe)], unsafeChanged: [...new Set(unsafeChanged)] }
}

async function itemsDiffer(connection, itemsCfg, dbId, payloadItems) {
  if (!Array.isArray(payloadItems)) return false
  const col = itemsCfg.model.selectOptionColumns
  const selectList = [
    `${col.id} AS id`,
    ...itemsCfg.fields.map(([, modelKey]) => `${col[modelKey]} AS ${modelKey}`),
  ].join(', ')
  const [rows] = await connection.execute(
    `SELECT ${selectList} FROM ${itemsCfg.model.tablename} WHERE ${col[itemsCfg.parentKey]} = ?`,
    [String(dbId)],
  )
  const dbTuples = rows
    .map((r) =>
      itemsCfg.fields.map(([, modelKey, numeric]) => cellKey(r[modelKey], numeric)),
    )
    .sort(compareTuples)
  const payloadTuples = payloadItems
    .map((item) =>
      itemsCfg.fields.map(([payloadKey, , numeric]) =>
        cellKey(item[payloadKey], numeric),
      ),
    )
    .sort(compareTuples)
  return !tuplesEqual(dbTuples, payloadTuples)
}

async function journalDiffer(connection, dbName, dbId, payloadJournal) {
  if (!Array.isArray(payloadJournal)) return false
  const col = A.journal_entries.selectOptionColumns
  const [rows] = await connection.execute(
    `SELECT ${col.coa_id} AS coa_id, ${col.responsibility_center} AS responsibility_center, ${col.type} AS type, ${col.amount} AS amount FROM ${A.journal_entries.tablename} WHERE ${col.db_name} = ? AND ${col.db_id} = ?`,
    [dbName, String(dbId)],
  )
  const dbTuples = rows
    .map((r) => [
      cellKey(r.coa_id, true),
      cellKey(r.responsibility_center, false),
      String(r.type || '').toUpperCase(),
      cellKey(r.amount, true),
    ])
    .sort(compareTuples)
  const payloadTuples = payloadJournal
    .map((entry) => {
      const debit = parseFloat(entry.debit ?? 0) || 0
      const credit = parseFloat(entry.credit ?? 0) || 0
      let type = String(entry.type || '').toUpperCase()
      if (!type) type = debit > 0 ? 'DEBIT' : 'CREDIT'
      const amount =
        entry.amount !== null && entry.amount !== undefined
          ? entry.amount
          : debit > 0
            ? debit
            : credit
      return [
        cellKey(entry.account_id, true),
        cellKey(entry.responsibility_center || '', false),
        type,
        cellKey(amount, true),
      ]
    })
    .sort(compareTuples)
  return !tuplesEqual(dbTuples, payloadTuples)
}

function locked(message, info) {
  return new JournalLockedError(message, { code: 'JOURNAL_LOCKED', ...info })
}

/**
 * Validates an update payload against a posted document.
 *
 * Returns null when the document is NOT posted (controller continues with the
 * full update path). Otherwise returns { posted, doc, changedSafe } after
 * confirming only safe fields changed.
 *
 * Throws JournalLockedError when:
 *  - any non-safe header column changed
 *  - line items changed
 *  - journal entries changed
 */
async function assertPostedSafeEdit(connection, dbName, dbId, payload) {
  const cfg = MODULE_CONFIG[dbName]
  if (!cfg) {
    throw new Error(`No posted-safe-edit configuration for '${dbName}'`)
  }

  const doc = await getDocumentState(connection, dbName, dbId)
  if (!isPostedState(doc.state)) return null

  const currentRow = await getCurrentHeaderRow(connection, cfg, dbId)
  const { changedSafe, unsafeChanged } = computeHeaderDiff(cfg, payload, currentRow)

  if (unsafeChanged.length > 0) {
    throw locked(
      `${cfg.label} ${dbId} is ${doc.state} and is LOCKED. On an approved document only remarks, attachments, and the document reference can be changed. Journal-impacting fields (${unsafeChanged.join(', ')}) are immutable. Create a reversal instead.`,
      { db_name: dbName, db_id: String(dbId), state: doc.state, blocked_fields: unsafeChanged },
    )
  }

  if (cfg.items && payload[cfg.items.payloadKey] !== undefined) {
    const different = await itemsDiffer(
      connection,
      cfg.items,
      dbId,
      payload[cfg.items.payloadKey],
    )
    if (different) {
      throw locked(
        `${cfg.label} ${dbId} is ${doc.state}; line items cannot be changed on an approved document. Create a reversal instead.`,
        { db_name: dbName, db_id: String(dbId), state: doc.state, blocked_fields: [cfg.items.payloadKey] },
      )
    }
  }

  if (payload.journal_entries !== undefined) {
    const different = await journalDiffer(connection, dbName, dbId, payload.journal_entries)
    if (different) {
      throw locked(
        `${cfg.label} ${dbId} is ${doc.state}; journal entries cannot be changed on an approved document. Create a reversal instead.`,
        { db_name: dbName, db_id: String(dbId), state: doc.state, blocked_fields: ['journal_entries'] },
      )
    }
  }

  return { posted: true, doc, changedSafe }
}

async function insertAudit(connection, cfg, dbId, changedSafe, actor) {
  const col = Master.audit_trail.selectOptionColumns
  const now = new Date()
  const ymd = now.toISOString().slice(0, 10)
  const hms = now.toTimeString().slice(0, 8)
  const safeText =
    changedSafe && changedSafe.length ? changedSafe.join(', ') : 'attachments'
  const action = `SAFE EDIT on APPROVED ${cfg.label} ${dbId}: ${safeText}`
  await connection.execute(
    `INSERT INTO ${Master.audit_trail.tablename} (${col.transaction_id}, ${col.module}, ${col.performed_by}, ${col.created_date}, ${col.created_time}, ${col.action}) VALUES (?, ?, ?, ?, ?, ?)`,
    [String(dbId), cfg.auditModule, actor || null, ymd, hms, action],
  )
}

async function syncAttachments(connection, cfg, dbId, attachments, actor) {
  const att = cfg.attachments.model.selectOptionColumns
  const attTable = cfg.attachments.model.tablename
  const parentCol = att[cfg.attachments.parentKey]
  const payloadList = Array.isArray(attachments) ? attachments : []

  const [existingRows] = await connection.execute(
    `SELECT ${att.id} AS id FROM ${attTable} WHERE ${parentCol} = ?`,
    [String(dbId)],
  )
  const existingIds = existingRows.map((r) => r.id)
  const payloadIds = payloadList
    .filter((a) => a.id !== null && a.id !== undefined)
    .map((a) => String(a.id))

  for (const id of existingIds) {
    if (!payloadIds.includes(String(id))) {
      await connection.execute(`DELETE FROM ${attTable} WHERE ${att.id} = ?`, [id])
    }
  }

  for (const a of payloadList) {
    const updater = actor || a.uploadedBy || null
    const fileVal = a.file ?? null
    const nameVal = a.fileName ?? null
    const remarksVal = a.remarks ?? null
    const dateVal = a.date ?? null
    if (a.id !== null && a.id !== undefined && payloadIds.includes(String(a.id))) {
      await connection.execute(
        `UPDATE ${attTable} SET ${att.file} = ?, ${att.name} = ?, ${att.remarks} = ?, ${att.uploaded_by} = ?, ${att.uploaded_date} = ? WHERE ${att.id} = ?`,
        [fileVal, nameVal, remarksVal, updater, dateVal, a.id],
      )
    } else {
      await connection.execute(
        `INSERT INTO ${attTable} (${parentCol}, ${att.file}, ${att.name}, ${att.remarks}, ${att.uploaded_by}, ${att.uploaded_date}) VALUES (?, ?, ?, ?, ?, ?)`,
        [String(dbId), fileVal, nameVal, remarksVal, updater, dateVal],
      )
    }
  }
}

/**
 * Applies a safe edit to a posted document inside the caller's open
 * transaction: updates only the changed safe header columns (if any), syncs
 * attachments, and writes an audit-trail row. Item and journal regeneration
 * are intentionally NOT performed.
 *
 * @param {import('mysql2/promise').PoolConnection} connection
 * @param {string} dbName
 * @param {string|number} dbId
 * @param {object} payload
 * @param {{changedSafe:string[]}} edit - result returned by assertPostedSafeEdit
 * @param {string|null} actor
 */
async function applyPostedSafeEdit(connection, dbName, dbId, payload, edit, actor) {
  const cfg = MODULE_CONFIG[dbName]
  const changedSafe = (edit && edit.changedSafe) || []

  if (changedSafe.length > 0) {
    const updateCols = cfg.model.selectOptionColumns
    const setClause = changedSafe.map((k) => `${updateCols[k]} = ?`).join(', ')
    const values = changedSafe.map((k) =>
      payload[k] === null || payload[k] === undefined ? null : payload[k],
    )
    await connection.execute(
      `UPDATE ${cfg.model.tablename} SET ${setClause} WHERE ${cfg.model.selectOptionColumns.id} = ?`,
      [...values, String(dbId)],
    )
  }

  const attKey = cfg.attachments.payloadKey
  const hasAttachmentChanges = payload[attKey] !== undefined

  if (hasAttachmentChanges) {
    await syncAttachments(connection, cfg, dbId, payload[attKey], actor)
  }

  if (changedSafe.length > 0 || hasAttachmentChanges) {
    await insertAudit(connection, cfg, dbId, changedSafe, actor)
  }
}

module.exports = {
  MODULE_CONFIG,
  assertPostedSafeEdit,
  applyPostedSafeEdit,
}