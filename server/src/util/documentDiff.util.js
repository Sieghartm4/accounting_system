const { MODULE_CONFIG } = require('./postedSafeEdit.util')
const { Accounting } = require('../database/model/Accounting')

// Money helpers: compare currency values at centavo precision so floating
// point noise never turns into a false "change" in the audit trail.
const cents = (value) => {
  const n = parseFloat(value)
  return Number.isFinite(n) ? Math.round(n * 100) : 0
}

const moneyEqual = (a, b) => cents(a) === cents(b)

// Generic numeric key: rounds to 4 decimals (enough for quantities and money,
// kills binary float noise such as 0.30000000000000004).
const numericKey = (value) => {
  const n = parseFloat(value)
  return Number.isFinite(n) ? String(Math.round(n * 10000) / 10000) : '0'
}

const textValue = (value) =>
  value === null || value === undefined ? '' : String(value).trim()

const cellKey = (value, numeric) =>
  numeric ? `N:${numericKey(value)}` : `S:${textValue(value)}`

const compareTuples = (a, b) => {
  for (let i = 0; i < a.length && i < b.length; i++) {
    if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1
  }
  return a.length - b.length
}

const tuplesEqual = (left, right) => {
  if (left.length !== right.length) return false
  for (let i = 0; i < left.length; i++) {
    const a = left[i]
    const b = right[i]
    if (a.length !== b.length) return false
    for (let j = 0; j < a.length; j++) if (a[j] !== b[j]) return false
  }
  return true
}

// Compares the stored line items against the submitted ones as an unordered
// set, ignoring row ids so a payload that simply re-sends the same items is
// treated as unchanged.
const itemsEquivalent = (dbRows, payloadItems, fields) => {
  if (!Array.isArray(payloadItems)) return true
  const rows = Array.isArray(dbRows) ? dbRows : []

  const dbTuples = rows
    .map((row) =>
      fields.map(([, modelKey, numeric]) => cellKey(row[modelKey], numeric)),
    )
    .sort(compareTuples)

  const payloadTuples = payloadItems
    .map((item) =>
      fields.map(([payloadKey, , numeric]) =>
        cellKey(item[payloadKey], numeric),
      ),
    )
    .sort(compareTuples)

  return tuplesEqual(dbTuples, payloadTuples)
}

const journalEntryType = (entry) => {
  const explicit = String(entry.type || '').toUpperCase()
  if (explicit) return explicit
  const debit = parseFloat(entry.debit ?? 0) || 0
  return debit > 0 ? 'DEBIT' : 'CREDIT'
}

const journalEntryAmount = (entry) => {
  if (entry.amount !== null && entry.amount !== undefined) return entry.amount
  const debit = parseFloat(entry.debit ?? 0) || 0
  const credit = parseFloat(entry.credit ?? 0) || 0
  return debit > 0 ? debit : credit
}

// Compares stored journal rows against submitted entries as an unordered set
// using account + responsibility center + type + centavo amount. Row ids and
// ordering are intentionally ignored.
const journalsEquivalent = (dbRows, payloadEntries) => {
  if (!Array.isArray(payloadEntries)) return true
  const rows = Array.isArray(dbRows) ? dbRows : []

  const dbTuples = rows
    .map((row) => [
      numericKey(row.account_id ?? row.coa_id),
      textValue(row.responsibility_center),
      String(row.type || '').toUpperCase(),
      String(cents(row.amount)),
    ])
    .sort(compareTuples)

  const payloadTuples = payloadEntries
    .map((entry) => [
      numericKey(entry.account_id),
      textValue(entry.responsibility_center),
      journalEntryType(entry),
      String(cents(journalEntryAmount(entry))),
    ])
    .sort(compareTuples)

  return tuplesEqual(dbTuples, payloadTuples)
}

// Convenience wrapper for a full document update: did the submitted items and
// journal entries match what is already stored?
const isDocumentUnchanged = ({ itemsSame, journalsSame }) =>
  Boolean(itemsSame && journalsSame)

const itemsEquivalentForModule = (moduleKey, dbRows, payloadItems) => {
  const cfg = MODULE_CONFIG[moduleKey]
  if (!cfg || !cfg.items) return true
  return itemsEquivalent(dbRows, payloadItems, cfg.items.fields)
}

const loadItemRows = async (connection, moduleKey, dbId) => {
  const cfg = MODULE_CONFIG[moduleKey]
  if (!cfg || !cfg.items) return []
  const col = cfg.items.model.selectOptionColumns
  const selectList = [
    `${col.id} AS id`,
    ...cfg.items.fields.map(([, modelKey]) => `${col[modelKey]} AS ${modelKey}`),
  ].join(', ')
  const [rows] = await connection.execute(
    `SELECT ${selectList} FROM ${cfg.items.model.tablename} WHERE ${col[cfg.items.parentKey]} = ?`,
    [String(dbId)],
  )
  return rows
}

const loadJournalRows = async (connection, dbName, dbId) => {
  const col = Accounting.journal_entries.selectOptionColumns
  const [rows] = await connection.execute(
    `SELECT ${col.coa_id} AS account_id, ${col.responsibility_center} AS responsibility_center, ${col.type} AS type, ${col.amount} AS amount FROM ${Accounting.journal_entries.tablename} WHERE ${col.db_name} = ? AND ${col.db_id} = ?`,
    [dbName, String(dbId)],
  )
  return rows
}

// Loads the stored document directly from the tenant DB and compares it with
// the submitted payload. Controllers use this to decide whether an update is a
// genuine edit or just the client re-sending hydrated values.
const itemsEquivalentFromDb = async (
  connection,
  moduleKey,
  dbId,
  payloadItems,
) => {
  if (!Array.isArray(payloadItems)) return true
  const cfg = MODULE_CONFIG[moduleKey]
  if (!cfg || !cfg.items) return true
  const rows = await loadItemRows(connection, moduleKey, dbId)
  return itemsEquivalent(rows, payloadItems, cfg.items.fields)
}

const journalsEquivalentFromDb = async (
  connection,
  dbName,
  dbId,
  payloadEntries,
) => {
  if (!Array.isArray(payloadEntries)) return true
  const rows = await loadJournalRows(connection, dbName, dbId)
  return journalsEquivalent(rows, payloadEntries)
}

module.exports = {
  cents,
  moneyEqual,
  numericKey,
  textValue,
  itemsEquivalent,
  itemsEquivalentForModule,
  journalsEquivalent,
  isDocumentUnchanged,
  loadItemRows,
  loadJournalRows,
  itemsEquivalentFromDb,
  journalsEquivalentFromDb,
}
