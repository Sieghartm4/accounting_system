'use strict'

const { SQLQueryBuilder } = require('../util/helper.util')
const { getTenantPool } = require('../database/util/tenantConnection.util')
const { Query } = require('../database/util/queries.util')
const { Accounting } = require('../database/model/Accounting')
const { Master } = require('../database/model/Master')
const {
  FREQUENCIES,
  todayStr,
  toDateStr,
  parseDate,
  firstOccurrence,
  nextOccurrence,
  generateTemplateReference,
  generateDueRecurringJournalEntries,
  generateDueForTenant,
} = require('../util/recurringJournal.util')

const sql = new SQLQueryBuilder()

const stripPrefix = (row, prefix) => {
  const out = {}
  for (const key in row) {
    if (Object.prototype.hasOwnProperty.call(row, key)) {
      out[key.startsWith(prefix) ? key.replace(prefix, '') : key] = row[key]
    }
  }
  return out
}

const normalizeAccountKey = (value) => {
  if (value === undefined || value === null) return null
  const normalized = String(value).trim()
  return normalized === '' ? null : normalized
}

const isNumericAccountKey = (value) => {
  const normalized = normalizeAccountKey(value)
  if (normalized === null) return false
  return !Number.isNaN(Number(normalized))
}

const resolveTextAccountIds = async (connection, items) => {
  const textKeys = [
    ...new Set(
      items
        .map((i) => normalizeAccountKey(i.coa_id ?? i.account_id))
        .filter((k) => k !== null && !isNumericAccountKey(k))
        .map((k) => k.toLowerCase()),
    ),
  ]
  if (textKeys.length === 0) return {}

  const placeholders = textKeys.map(() => '?').join(',')
  const lookupSql = `SELECT ${Master.charts_of_accounts.selectOptionColumns.id} AS id,
                            ${Master.charts_of_accounts.selectOptionColumns.name} AS name,
                            ${Master.charts_of_accounts.selectOptionColumns.code} AS code
                     FROM ${Master.charts_of_accounts.tablename}
                     WHERE LOWER(${Master.charts_of_accounts.selectOptionColumns.name}) IN (${placeholders})
                        OR LOWER(${Master.charts_of_accounts.selectOptionColumns.code}) IN (${placeholders})`
  const [rows] = await connection.execute(lookupSql, [...textKeys, ...textKeys])
  const lookup = {}
  for (const row of rows) {
    if (row.name) lookup[String(row.name).trim().toLowerCase()] = row.id
    if (row.code) lookup[String(row.code).trim().toLowerCase()] = row.id
  }
  return lookup
}

const normalizeItems = async (connection, rawItems) => {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    throw new Error('At least one journal entry is required')
  }

  const accountLookup = await resolveTextAccountIds(connection, rawItems)

  const items = rawItems.map((entry, index) => {
    const debit = parseFloat(entry.debit) || 0
    const credit = parseFloat(entry.credit) || 0

    if (debit <= 0 && credit <= 0) {
      throw new Error(`Entry ${index + 1}: an amount (debit or credit) is required`)
    }
    if (debit > 0 && credit > 0) {
      throw new Error(`Entry ${index + 1}: cannot have both debit and credit`)
    }

    let accountId = normalizeAccountKey(entry.coa_id ?? entry.account_id)
    if (accountId === null) {
      throw new Error(`Entry ${index + 1}: chart of account is required`)
    }
    if (isNumericAccountKey(accountId)) {
      accountId = Number(accountId)
    } else {
      accountId = accountLookup[accountId.toLowerCase()] || null
      if (accountId === null) {
        throw new Error(
          `Entry ${index + 1}: account "${normalizeAccountKey(entry.coa_id ?? entry.account_id)}" not found`,
        )
      }
    }

    return {
      coa_id: accountId,
      responsibility_center: String(entry.responsibility_center || '').trim(),
      type: debit > 0 ? 'debit' : 'credit',
      amount: debit > 0 ? debit : credit,
    }
  })

  const totalDebit = items
    .filter((i) => i.type === 'debit')
    .reduce((sum, i) => sum + i.amount, 0)
  const totalCredit = items
    .filter((i) => i.type === 'credit')
    .reduce((sum, i) => sum + i.amount, 0)

  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    throw new Error(
      `Journal entries must be balanced. Total debits (${totalDebit.toFixed(2)}) must equal total credits (${totalCredit.toFixed(2)})`,
    )
  }

  return items
}

const normalizeTemplateHeader = (payload) => {
  const name = String(payload.name || '').trim()
  if (!name) {
    throw new Error('Template name is required')
  }

  const frequency = String(payload.frequency || 'MONTHLY').toUpperCase()
  if (!FREQUENCIES.includes(frequency)) {
    throw new Error(`Invalid frequency: ${frequency}`)
  }

  const interval = Math.max(1, parseInt(payload.interval, 10) || 1)
  const startDate = String(payload.start_date || '').trim()
  if (!startDate || !parseDate(startDate)) {
    throw new Error('A valid start date (YYYY-MM-DD) is required')
  }
  const endDate = String(payload.end_date || '').trim() || null
  if (endDate && !parseDate(endDate)) {
    throw new Error('Invalid end date (YYYY-MM-DD)')
  }
  if (endDate && parseDate(endDate).getTime() < parseDate(startDate).getTime()) {
    throw new Error('End date cannot be before start date')
  }

  const status = String(payload.status || 'ACTIVE').toUpperCase()
  if (!['ACTIVE', 'INACTIVE'].includes(status)) {
    throw new Error('Invalid status: must be ACTIVE or INACTIVE')
  }

  let day = null
  if (payload.day !== undefined && payload.day !== null && payload.day !== '') {
    day = Math.max(1, Math.min(31, parseInt(payload.day, 10) || 1))
  }

  return {
    name,
    reference: null,
    frequency,
    interval,
    day,
    start_date: startDate,
    end_date: endDate,
    status,
    remarks: String(payload.remarks || '').trim() || null,
  }
}

const writeAudit = async (connection, transactionId, action, actor) => {
  const now = new Date()
  const auditQuery = sql
    .insert(Master.audit_trail.tablename, {
      columns: Master.audit_trail.insertColumns,
      prefix: Master.audit_trail.prefix,
      isTransaction: true,
    })
    .build()
  await connection.execute(auditQuery, [
    String(transactionId),
    'RECURRING_JOURNAL',
    actor || null,
    todayStr(),
    now.toTimeString().split(' ')[0],
    action,
  ])
}

const getRecurringJournals = async (req, res, next) => {
  try {
    const { offset, limit } = req.query
    const shouldPaginate = offset !== undefined && limit !== undefined
    const offsetNum = shouldPaginate ? Math.max(0, parseInt(offset, 10) || 0) : 0
    const limitNum = shouldPaginate
      ? Math.max(1, Math.min(100, parseInt(limit, 10) || 50))
      : null

    const query = `
      SELECT j.*,
             (SELECT COUNT(*) FROM recurring_journal_items i WHERE i.rji_journal_id = j.rj_id) AS item_count,
             (SELECT COALESCE(SUM(CASE WHEN i.rji_type = 'debit' THEN i.rji_amount ELSE 0 END), 0)
                FROM recurring_journal_items i WHERE i.rji_journal_id = j.rj_id) AS total_amount
      FROM recurring_journals j`

    const orderBy = ` ORDER BY j.rj_id DESC`
    const pagination = shouldPaginate ? ` LIMIT ? OFFSET ?` : ''
    const params = shouldPaginate ? [limitNum, offsetNum] : []

    const result = await Query(
      `${query}${orderBy}${pagination}`,
      params,
      [Accounting.recurring_journals.prefix_],
    )

    res.status(200).json({
      success: true,
      message: 'Recurring journals retrieved successfully',
      data: result,
      count: result.length,
      offset: offsetNum,
      limit: limitNum,
      hasMore: shouldPaginate ? result.length === limitNum : false,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error fetching recurring journals:', error)
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching recurring journals',
      error:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Internal server error',
    })
  }
}

const getRecurringJournalById = async (req, res, next) => {
  try {
    const { journal_id } = req.params
    if (!journal_id) {
      return res.status(400).json({ success: false, message: 'Invalid journal ID provided' })
    }

    const pool = getTenantPool()
    const connection = await pool.getConnection()
    try {
      const headerQuery = sql
        .selectAll()
        .from(Accounting.recurring_journals.tablename)
        .where(Accounting.recurring_journals.selectOptionColumns.id)
        .build()
      const [headerRows] = await connection.execute(headerQuery, [journal_id])
      if (!headerRows || headerRows.length === 0) {
        return res.status(404).json({ success: false, message: 'Recurring journal not found' })
      }
      let template = stripPrefix(
        headerRows[0],
        Accounting.recurring_journals.prefix_,
      )

      const itemsQuery = `
        SELECT i.rji_id, i.rji_journal_id, i.rji_coa_id, i.rji_responsibility_center,
               i.rji_type, i.rji_amount,
               c.coa_name, c.coa_code
        FROM recurring_journal_items i
        LEFT JOIN charts_of_accounts c ON i.rji_coa_id = c.coa_id
        WHERE i.rji_journal_id = ?
        ORDER BY i.rji_id ASC`
      const [itemRows] = await connection.execute(itemsQuery, [journal_id])
      const items = (itemRows || []).map((row) => ({
        id: row.rji_id,
        coa_id: row.rji_coa_id,
        account_name: row.coa_name,
        account_code: row.coa_code,
        responsibility_center: row.rji_responsibility_center,
        type: row.rji_type,
        amount: row.rji_amount,
      }))

      const datesQuery = sql
        .selectAll()
        .from(Accounting.recurring_journal_dates.tablename)
        .where(Accounting.recurring_journal_dates.selectOptionColumns.journal_id)
        .orderByDesc(Accounting.recurring_journal_dates.selectOptionColumns.occurrence_date)
        .build()
      const [dateRows] = await connection.execute(datesQuery, [journal_id])
      const generationDates = (dateRows || []).map((row) =>
        stripPrefix(row, Accounting.recurring_journal_dates.prefix_),
      )

      res.status(200).json({
        success: true,
        message: 'Recurring journal retrieved successfully',
        data: [{ ...template, items, generation_dates: generationDates }],
        timestamp: new Date().toISOString(),
      })
    } finally {
      connection.release()
    }
  } catch (error) {
    console.error('Error fetching recurring journal:', error)
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching recurring journal',
      error:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Internal server error',
    })
  }
}

const createRecurringJournal = async (req, res, next) => {
  let connection
  try {
    const payload = req.body && req.body.data ? req.body.data : req.body
    console.log('📥 Received create payload:', payload)
    console.log('📥 Journal entries in payload:', payload.journal_entries || payload.items)
    
    const header = normalizeTemplateHeader(payload)

    connection = await getTenantPool().getConnection()
    await connection.beginTransaction()

    header.reference = await generateTemplateReference(connection)

    const items = await normalizeItems(connection, payload.journal_entries || payload.items)
    console.log('📥 Normalized items:', items)

    const headerQuery = sql
      .insert(Accounting.recurring_journals.tablename, {
        columns: Accounting.recurring_journals.insertColumns,
        prefix: Accounting.recurring_journals.prefix,
        isTransaction: true,
      })
      .build()

    const nextDue = toDateStr(firstOccurrence(header))
    const now = new Date()
    const actor = req.context?.username || 'Unknown User'

    await connection.execute(headerQuery, [
      null, // rj_id (auto-increment, but INSERT INTO ... VALUES ? with prefixed columns includes id)
      header.reference,
      header.name,
      header.frequency,
      header.interval,
      header.day,
      header.start_date,
      header.end_date,
      header.status,
      header.remarks,
      null, // last_generated_date
      nextDue, // next_due_date
      todayStr(), // created_date
      actor, // created_by
      null, // updated_date
      null, // updated_by
    ])

    const [[{ rj_id: templateId }]] = await connection.execute(
      `SELECT LAST_INSERT_ID() AS rj_id`,
    )
    const journalId = templateId

    const itemQuery = sql
      .insert(Accounting.recurring_journal_items.tablename, {
        columns: Accounting.recurring_journal_items.insertColumns,
        prefix: Accounting.recurring_journal_items.prefix,
        isTransaction: true,
      })
      .build()
    for (const item of items) {
      await connection.execute(itemQuery, [
        journalId,
        item.coa_id,
        item.responsibility_center,
        item.type,
        item.amount,
      ])
    }

    await writeAudit(
      connection,
      journalId,
      `CREATE: RECURRING JOURNAL ${header.reference} ${header.name}`,
      actor,
    )

    await connection.commit()

    res.status(201).json({
      success: true,
      message: `Recurring journal ${header.reference} created successfully`,
      data: { id: journalId, reference: header.reference, next_due_date: nextDue },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    if (connection) {
      await connection.rollback()
    }
    console.error('Error creating recurring journal:', error)
    return res.status(500).json({
      success: false,
      message:
        error.message || 'Server error while creating recurring journal',
      error:
        process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    })
  } finally {
    if (connection) connection.release()
  }
}

const updateRecurringJournal = async (req, res, next) => {
  let connection
  try {
    const { journal_id } = req.params
    if (!journal_id) {
      return res.status(400).json({ success: false, message: 'Invalid journal ID provided' })
    }

    const payload = req.body && req.body.data ? req.body.data : req.body
    const header = normalizeTemplateHeader(payload)

    connection = await getTenantPool().getConnection()
    await connection.beginTransaction()

    const items = await normalizeItems(connection, payload.journal_entries || payload.items)

    const updateQuery = sql
      .update(Accounting.recurring_journals.tablename)
      .set([
        Accounting.recurring_journals.selectOptionColumns.name,
        Accounting.recurring_journals.selectOptionColumns.frequency,
        Accounting.recurring_journals.selectOptionColumns.interval,
        Accounting.recurring_journals.selectOptionColumns.day,
        Accounting.recurring_journals.selectOptionColumns.start_date,
        Accounting.recurring_journals.selectOptionColumns.end_date,
        Accounting.recurring_journals.selectOptionColumns.status,
        Accounting.recurring_journals.selectOptionColumns.remarks,
        Accounting.recurring_journals.selectOptionColumns.next_due_date,
        Accounting.recurring_journals.selectOptionColumns.updated_date,
        Accounting.recurring_journals.selectOptionColumns.updated_by,
      ])
      .where(Accounting.recurring_journals.selectOptionColumns.id)
      .build()

    const today = new Date()
    let nextDue = null
    let cursor = firstOccurrence(header)
    let guard = 0
    while (cursor && cursor.getTime() <= today.getTime() && guard < 1000) {
      cursor = nextOccurrence(cursor, header)
      guard += 1
    }
    const endDate = parseDate(header.end_date)
    if (!cursor) {
      nextDue = null
    } else if (endDate && cursor.getTime() > endDate.getTime()) {
      nextDue = null
    } else {
      nextDue = toDateStr(cursor)
    }

    const actor = req.context?.username || 'Unknown User'
    await connection.execute(updateQuery, [
      header.name,
      header.frequency,
      header.interval,
      header.day,
      header.start_date,
      header.end_date,
      header.status,
      header.remarks,
      nextDue,
      todayStr(),
      actor,
      journal_id,
    ])

    const deleteItemsQuery = sql
      .delete(Accounting.recurring_journal_items.tablename)
      .where(Accounting.recurring_journal_items.selectOptionColumns.journal_id)
      .build()
    await connection.execute(deleteItemsQuery, [journal_id])

    const itemQuery = sql
      .insert(Accounting.recurring_journal_items.tablename, {
        columns: Accounting.recurring_journal_items.insertColumns,
        prefix: Accounting.recurring_journal_items.prefix,
        isTransaction: true,
      })
      .build()
    for (const item of items) {
      await connection.execute(itemQuery, [
        journal_id,
        item.coa_id,
        item.responsibility_center,
        item.type,
        item.amount,
      ])
    }

    const [[{ rj_reference: reference }]] = await connection.execute(
      `SELECT rj_reference FROM recurring_journals WHERE rj_id = ?`,
      [journal_id],
    )

    await writeAudit(
      connection,
      journal_id,
      `UPDATE: RECURRING JOURNAL ${reference} ${header.name}`,
      actor,
    )

    await connection.commit()

    res.status(200).json({
      success: true,
      message: `Recurring journal ${reference} updated successfully`,
      data: { id: journal_id, reference, next_due_date: nextDue },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    if (connection) {
      await connection.rollback()
    }
    console.error('Error updating recurring journal:', error)
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error while updating recurring journal',
      error:
        process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    })
  } finally {
    if (connection) connection.release()
  }
}

const deleteRecurringJournal = async (req, res, next) => {
  let connection
  try {
    const { journal_id } = req.params
    if (!journal_id) {
      return res.status(400).json({ success: false, message: 'Invalid journal ID provided' })
    }

    connection = await getTenantPool().getConnection()
    await connection.beginTransaction()

    const [[{ rj_reference: reference }]] = await connection.execute(
      `SELECT rj_reference FROM recurring_journals WHERE rj_id = ?`,
      [journal_id],
    )
    if (!reference) {
      return res.status(404).json({ success: false, message: 'Recurring journal not found' })
    }

    const deleteDatesQuery = sql
      .delete(Accounting.recurring_journal_dates.tablename)
      .where(Accounting.recurring_journal_dates.selectOptionColumns.journal_id)
      .build()
    await connection.execute(deleteDatesQuery, [journal_id])

    const deleteItemsQuery = sql
      .delete(Accounting.recurring_journal_items.tablename)
      .where(Accounting.recurring_journal_items.selectOptionColumns.journal_id)
      .build()
    await connection.execute(deleteItemsQuery, [journal_id])

    const deleteHeaderQuery = sql
      .delete(Accounting.recurring_journals.tablename)
      .where(Accounting.recurring_journals.selectOptionColumns.id)
      .build()
    await connection.execute(deleteHeaderQuery, [journal_id])

    await writeAudit(
      connection,
      journal_id,
      `DELETE: RECURRING JOURNAL ${reference}`,
      req.context?.username || 'Unknown User',
    )

    await connection.commit()

    res.status(200).json({
      success: true,
      message: `Recurring journal ${reference} deleted successfully`,
      data: { id: journal_id },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    if (connection) {
      await connection.rollback()
    }
    console.error('Error deleting recurring journal:', error)
    return res.status(500).json({
      success: false,
      message: 'Server error while deleting recurring journal',
      error:
        process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    })
  } finally {
    if (connection) connection.release()
  }
}

const generateNow = async (req, res, next) => {
  let connection
  try {
    const { journal_id } = req.params
    if (!journal_id) {
      return res.status(400).json({ success: false, message: 'Invalid journal ID provided' })
    }

    connection = await getTenantPool().getConnection()
    await connection.beginTransaction()

    const headerQuery = sql
      .selectAll()
      .from(Accounting.recurring_journals.tablename)
      .where(Accounting.recurring_journals.selectOptionColumns.id)
      .build()
    const [headerRows] = await connection.execute(headerQuery, [journal_id])
    if (!headerRows || headerRows.length === 0) {
      await connection.rollback()
      return res.status(404).json({ success: false, message: 'Recurring journal not found' })
    }
    const template = stripPrefix(headerRows[0], Accounting.recurring_journals.prefix_)
    const actor = req.context?.username || 'Unknown User'

    const generated = await generateDueRecurringJournalEntries(
      connection,
      template,
      actor,
    )

    await connection.commit()

    res.status(200).json({
      success: true,
      message: generated.length
        ? `Generated ${generated.length} adjustment(s) for ${template.reference}`
        : `No due occurrences for ${template.reference} at this time`,
      data: {
        generatedCount: generated.length,
        generated: generated,
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    if (connection) {
      await connection.rollback()
    }
    console.error('Error generating recurring journal:', error)
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error while generating recurring journal',
      error:
        process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    })
  } finally {
    if (connection) connection.release()
  }
}

const generateAllNow = async (req, res, next) => {
  try {
    const actor = req.context?.username || 'Unknown User'
    const generated = await generateDueForTenant(null, actor)

    res.status(200).json({
      success: true,
      message: generated.length
        ? `Generated ${generated.length} adjustment(s) across due recurring journals`
        : 'No due recurring journals at this time',
      data: {
        generatedCount: generated.length,
        generated: generated,
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error generating all recurring journals:', error)
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error while generating recurring journals',
      error:
        process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    })
  }
}

module.exports = {
  getRecurringJournals,
  getRecurringJournalById,
  createRecurringJournal,
  updateRecurringJournal,
  deleteRecurringJournal,
  generateNow,
  generateAllNow,
}