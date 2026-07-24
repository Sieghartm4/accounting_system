const os = require('os')
const {
  checkConnection,
  SelectAll,
  Query,
} = require('../database/util/queries.util')
const {
  formatMemoryUsage,
  formatTime,
  DataModeling,
  SQLQueryBuilder,
} = require('../util/helper.util')
const { Accounting } = require('../database/model/Accounting')
const { Master } = require('../database/model/Master')
const { getTenantPool } = require('../database/util/tenantConnection.util')
const { broadcastUpdates } = require('../startup/socket.startup')

const sql = new SQLQueryBuilder()

require('dotenv').config()

const getJournalEntries = async (req, res, next) => {
  try {
    const { start_date, end_date } = req.query

    let query = new SQLQueryBuilder()
      .select([
        Accounting.journal_entries.selectOptionColumns.id,
        Accounting.journal_entries.selectOptionColumns.db_name,
        Accounting.journal_entries.selectOptionColumns.db_id,
        `${Master.charts_of_accounts.selectOptionColumns.name} as coa_name`,
        Accounting.journal_entries.selectOptionColumns.responsibility_center,
        Accounting.journal_entries.selectOptionColumns.type,
        Accounting.journal_entries.selectOptionColumns.amount,
        Accounting.journal_entries.selectOptionColumns.date,
      ])
      .from(Accounting.journal_entries.tablename)
      .innerJoin(
        Master.charts_of_accounts.tablename,
        Master.charts_of_accounts.selectOptionColumns.id,
        Accounting.journal_entries.selectOptionColumns.coa_id,
        '=',
      )
      .where(Master.charts_of_accounts.selectOptionColumns.status)
      .orderBy(Accounting.journal_entries.selectOptionColumns.date, 'DESC')

    // Simple date filtering test
    let whereConditions = []
    let values = []

    if (start_date) {
      whereConditions.push(
        `${Accounting.journal_entries.selectOptionColumns.date} >= ?`,
      )
      values.push(start_date)
    }
    if (end_date) {
      whereConditions.push(
        `${Accounting.journal_entries.selectOptionColumns.date} <= ?`,
      )
      values.push(end_date)
    }

    // Build manual SQL query
    let sqlQuery = `SELECT ${Accounting.journal_entries.selectOptionColumns.id}, 
                          ${Accounting.journal_entries.selectOptionColumns.db_name}, 
                          ${Accounting.journal_entries.selectOptionColumns.db_id}, 
                          ${Master.charts_of_accounts.selectOptionColumns.name} as coa_name, 
                          ${Accounting.journal_entries.selectOptionColumns.responsibility_center}, 
                          ${Accounting.journal_entries.selectOptionColumns.type}, 
                          ${Accounting.journal_entries.selectOptionColumns.amount}, 
                          CASE
                            WHEN ${Accounting.journal_entries.selectOptionColumns.db_name} = 'receipts' THEN r.${Accounting.receipts.selectOptionColumns.collection_date}
                            WHEN ${Accounting.journal_entries.selectOptionColumns.db_name} = 'cash_disbursements' THEN cd.${Accounting.cash_disbursements.selectOptionColumns.payment_date}
                            WHEN ${Accounting.journal_entries.selectOptionColumns.db_name} = 'sales' THEN s.${Accounting.sales.selectOptionColumns.date_delivered}
                            WHEN ${Accounting.journal_entries.selectOptionColumns.db_name} = 'collections' THEN c.${Accounting.collections.selectOptionColumns.collection_date}
                            WHEN ${Accounting.journal_entries.selectOptionColumns.db_name} = 'purchase' THEN p.${Accounting.purchase.selectOptionColumns.date_delivered}
                            WHEN ${Accounting.journal_entries.selectOptionColumns.db_name} = 'payments' THEN pay.${Accounting.payments.selectOptionColumns.payment_date}
                            WHEN ${Accounting.journal_entries.selectOptionColumns.db_name} = 'adjustments' THEN a.${Accounting.adjustments.selectOptionColumns.posting_date}
                            ELSE ${Accounting.journal_entries.selectOptionColumns.date}
                          END as date
                   FROM ${Accounting.journal_entries.tablename} 
                   INNER JOIN ${Master.charts_of_accounts.tablename} ON ${Master.charts_of_accounts.selectOptionColumns.id} = ${Accounting.journal_entries.selectOptionColumns.coa_id}
                   LEFT JOIN ${Accounting.receipts.tablename} r
                     ON ${Accounting.journal_entries.selectOptionColumns.db_name} = 'receipts'
                     AND r.${Accounting.receipts.selectOptionColumns.id} = ${Accounting.journal_entries.selectOptionColumns.db_id}
                   LEFT JOIN ${Accounting.cash_disbursements.tablename} cd
                     ON ${Accounting.journal_entries.selectOptionColumns.db_name} = 'cash_disbursements'
                     AND cd.${Accounting.cash_disbursements.selectOptionColumns.id} = ${Accounting.journal_entries.selectOptionColumns.db_id}
                   LEFT JOIN ${Accounting.sales.tablename} s
                     ON ${Accounting.journal_entries.selectOptionColumns.db_name} = 'sales'
                     AND s.${Accounting.sales.selectOptionColumns.id} = ${Accounting.journal_entries.selectOptionColumns.db_id}
                   LEFT JOIN ${Accounting.collections.tablename} c
                     ON ${Accounting.journal_entries.selectOptionColumns.db_name} = 'collections'
                     AND c.${Accounting.collections.selectOptionColumns.id} = ${Accounting.journal_entries.selectOptionColumns.db_id}
                   LEFT JOIN ${Accounting.purchase.tablename} p
                     ON ${Accounting.journal_entries.selectOptionColumns.db_name} = 'purchase'
                     AND p.${Accounting.purchase.selectOptionColumns.id} = ${Accounting.journal_entries.selectOptionColumns.db_id}
                   LEFT JOIN ${Accounting.payments.tablename} pay
                     ON ${Accounting.journal_entries.selectOptionColumns.db_name} = 'payments'
                     AND pay.${Accounting.payments.selectOptionColumns.id} = ${Accounting.journal_entries.selectOptionColumns.db_id}
                   LEFT JOIN ${Accounting.adjustments.tablename} a
                     ON ${Accounting.journal_entries.selectOptionColumns.db_name} = 'adjustments'
                     AND a.${Accounting.adjustments.selectOptionColumns.id} = ${Accounting.journal_entries.selectOptionColumns.db_id}
                   WHERE ${Accounting.journal_entries.selectOptionColumns.db_name} IS NOT NULL
                   AND ${Accounting.journal_entries.selectOptionColumns.db_id} IS NOT NULL
                   AND ${Accounting.journal_entries.selectOptionColumns.coa_id} IS NOT NULL`
    
    // Approval filter - only include journal entries from approved documents
    const approvalFilter = `
      AND (
        (${Accounting.journal_entries.selectOptionColumns.db_name} = 'receipts' AND EXISTS (
          SELECT 1 FROM ${Accounting.receipts.tablename} r
          WHERE r.${Accounting.receipts.selectOptionColumns.id} = ${Accounting.journal_entries.selectOptionColumns.db_id}
          AND r.${Accounting.receipts.selectOptionColumns.state} = 'APPROVED'
        ))
        OR (${Accounting.journal_entries.selectOptionColumns.db_name} = 'cash_disbursements' AND EXISTS (
          SELECT 1 FROM ${Accounting.cash_disbursements.tablename} cd
          WHERE cd.${Accounting.cash_disbursements.selectOptionColumns.id} = ${Accounting.journal_entries.selectOptionColumns.db_id}
          AND cd.${Accounting.cash_disbursements.selectOptionColumns.state} = 'APPROVED'
        ))
        OR (${Accounting.journal_entries.selectOptionColumns.db_name} = 'sales' AND EXISTS (
          SELECT 1 FROM ${Accounting.sales.tablename} s
          WHERE s.${Accounting.sales.selectOptionColumns.id} = ${Accounting.journal_entries.selectOptionColumns.db_id}
          AND s.${Accounting.sales.selectOptionColumns.state} = 'APPROVED'
        ))
        OR (${Accounting.journal_entries.selectOptionColumns.db_name} = 'collections' AND EXISTS (
          SELECT 1 FROM ${Accounting.collections.tablename} c
          WHERE c.${Accounting.collections.selectOptionColumns.id} = ${Accounting.journal_entries.selectOptionColumns.db_id}
          AND c.${Accounting.collections.selectOptionColumns.state} = 'APPROVED'
        ))
        OR (${Accounting.journal_entries.selectOptionColumns.db_name} = 'purchase' AND EXISTS (
          SELECT 1 FROM ${Accounting.purchase.tablename} p
          WHERE p.${Accounting.purchase.selectOptionColumns.id} = ${Accounting.journal_entries.selectOptionColumns.db_id}
          AND p.${Accounting.purchase.selectOptionColumns.state} = 'APPROVED'
        ))
        OR (${Accounting.journal_entries.selectOptionColumns.db_name} = 'payments' AND EXISTS (
          SELECT 1 FROM ${Accounting.payments.tablename} pay
          WHERE pay.${Accounting.payments.selectOptionColumns.id} = ${Accounting.journal_entries.selectOptionColumns.db_id}
          AND pay.${Accounting.payments.selectOptionColumns.state} = 'APPROVED'
        ))
        OR (${Accounting.journal_entries.selectOptionColumns.db_name} = 'adjustments' AND EXISTS (
          SELECT 1 FROM ${Accounting.adjustments.tablename} a
          WHERE a.${Accounting.adjustments.selectOptionColumns.id} = ${Accounting.journal_entries.selectOptionColumns.db_id}
          AND a.${Accounting.adjustments.selectOptionColumns.status} = 'APPROVED'
        ))
      )
    `
    
    if (whereConditions.length > 0) {
      sqlQuery += ` AND ${whereConditions.join(' AND ')}`
    }
    
    sqlQuery += approvalFilter

    sqlQuery += ` ORDER BY ${Accounting.journal_entries.selectOptionColumns.date} DESC`

    console.log('SQL Query:', sqlQuery)
    console.log('Values:', values)
    console.log('Start date:', start_date)
    console.log('End date:', end_date)

    const journalEntries = await Query(
      sqlQuery,
      values,
      Accounting.journal_entries.prefix_,
    )

    console.log(journalEntries)
    res.status(200).json({
      success: true,
      message: 'Journal entries retrieved successfully',
      data: journalEntries,
      count: journalEntries.length,
      startDate: start_date,
      endDate: end_date,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error fetching journal entries:', error)
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching journal entries',
      error:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Internal server error',
    })
  }
}

const getAdvances = async (req, res, next) => {
  try {
    const { start_date, end_date, offset, limit } = req.query
    const shouldPaginate = offset !== undefined && limit !== undefined
    const offsetNum = shouldPaginate ? Math.max(0, parseInt(offset) || 0) : 0
    const limitNum = shouldPaginate
      ? Math.max(1, Math.min(500, parseInt(limit) || 50))
      : null

    const whereConditions = [
      `(${Accounting.journal_entries.selectOptionColumns.db_name} IS NULL OR ${Accounting.journal_entries.selectOptionColumns.db_name} = '' OR ${Accounting.journal_entries.selectOptionColumns.db_id} IS NULL OR ${Accounting.journal_entries.selectOptionColumns.db_id} = '')`,
    ]
    const values = []

    if (start_date) {
      whereConditions.push(
        `${Accounting.journal_entries.selectOptionColumns.date} >= ?`,
      )
      values.push(start_date)
    }
    if (end_date) {
      whereConditions.push(
        `${Accounting.journal_entries.selectOptionColumns.date} <= ?`,
      )
      values.push(end_date)
    }

    let sqlQuery = `SELECT ${Accounting.journal_entries.selectOptionColumns.id}, 
                          ${Master.charts_of_accounts.selectOptionColumns.name} as coa_name, 
                          ${Accounting.journal_entries.selectOptionColumns.responsibility_center}, 
                          ${Accounting.journal_entries.selectOptionColumns.type}, 
                          ${Accounting.journal_entries.selectOptionColumns.amount}, 
                          ${Accounting.journal_entries.selectOptionColumns.date} 
                   FROM ${Accounting.journal_entries.tablename} 
                   INNER JOIN ${Master.charts_of_accounts.tablename} ON ${Master.charts_of_accounts.selectOptionColumns.id} = ${Accounting.journal_entries.selectOptionColumns.coa_id} 
                   WHERE ${whereConditions.join(' AND ')} 
                   ORDER BY ${Accounting.journal_entries.selectOptionColumns.id} DESC`

    const queryValues = shouldPaginate ? [...values, limitNum, offsetNum] : values
    if (shouldPaginate) {
      sqlQuery += '\n                   LIMIT ? OFFSET ?'
    }

    const advances = await Query(sqlQuery, queryValues, [
      Accounting.journal_entries.prefix_,
      Master.charts_of_accounts.prefix_,
    ])

    res.status(200).json({
      success: true,
      message: 'Advances retrieved successfully',
      data: advances,
      count: advances.length,
      offset: offsetNum,
      limit: limitNum,
      hasMore: shouldPaginate ? advances.length === limitNum : false,
      startDate: start_date,
      endDate: end_date,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error fetching advances:', error)
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching advances',
      error:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Internal server error',
    })
  }
}

const getJournalEntriesByCoaId = async (req, res, next) => {
  try {
    const { coa_id } = req.params
    const { start_date, end_date } = req.query

    console.log('=== getJournalEntriesByCoaId Debug ===')
    console.log('COA ID from params:', coa_id)
    console.log('Start Date:', start_date)
    console.log('End Date:', end_date)

    if (!coa_id) {
      return res.status(400).json({
        success: false,
        message: 'Chart of Accounts ID is required',
      })
    }

    const coaIdNum = Number(coa_id)
    console.log('Converted COA ID:', coaIdNum, 'Type:', typeof coaIdNum)

    if (!Number.isInteger(coaIdNum) || coaIdNum <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid Chart of Accounts ID',
      })
    }

    let whereConditions = [
      `${Accounting.journal_entries.selectOptionColumns.coa_id} = ?`,
    ]
    let values = [coaIdNum]

    console.log('Initial where condition:', whereConditions[0])
    console.log('Initial values:', values)

    const dateColumn = `DATE(${Accounting.journal_entries.selectOptionColumns.date})`

    if (start_date) {
      whereConditions.push(`${dateColumn} >= ?`)
      values.push(start_date)
    }
    if (end_date) {
      whereConditions.push(`${dateColumn} <= ?`)
      values.push(end_date)
    }

    const sqlQuery = `SELECT ${Accounting.journal_entries.selectOptionColumns.id}, 
                          ${Accounting.journal_entries.selectOptionColumns.db_name}, 
                          ${Accounting.journal_entries.selectOptionColumns.db_id},
                          ${Accounting.journal_entries.selectOptionColumns.coa_id},
                          ${Master.charts_of_accounts.selectOptionColumns.name} as coa_name, 
                          ${Master.charts_of_accounts.selectOptionColumns.code} as coa_code,
                          ${Accounting.journal_entries.selectOptionColumns.responsibility_center}, 
                          ${Accounting.journal_entries.selectOptionColumns.type}, 
                          ${Accounting.journal_entries.selectOptionColumns.amount}, 
                          ${Accounting.journal_entries.selectOptionColumns.date} 
                   FROM ${Accounting.journal_entries.tablename} 
                   INNER JOIN ${Master.charts_of_accounts.tablename} ON ${Master.charts_of_accounts.selectOptionColumns.id} = ${Accounting.journal_entries.selectOptionColumns.coa_id}
                   WHERE ${whereConditions.join(' AND ')}
                   ORDER BY ${Accounting.journal_entries.selectOptionColumns.date} ASC`

    console.log('SQL Query:', sqlQuery)
    console.log('Query values:', values)
    console.log('Prefixes used:', [
      Accounting.journal_entries.prefix_,
      Master.charts_of_accounts.prefix_,
    ])

    const journalEntries = await Query(sqlQuery, values, [
      Accounting.journal_entries.prefix_,
      Master.charts_of_accounts.prefix_,
    ])

    console.log(
      `Fetched ${journalEntries.length} journal entries for COA ID ${coaIdNum}`,
    )
    // console.log('Raw result:', JSON.stringify(journalEntries, null, 2))

    let totalDebit = 0
    let totalCredit = 0
    journalEntries.forEach((entry) => {
      if (entry.type && entry.type.toLowerCase() === 'debit') {
        totalDebit += parseFloat(entry.amount) || 0
      } else if (entry.type && entry.type.toLowerCase() === 'credit') {
        totalCredit += parseFloat(entry.amount) || 0
      }
    })

    res.status(200).json({
      success: true,
      message: 'Journal entries retrieved successfully',
      data: journalEntries,
      count: journalEntries.length,
      summary: {
        totalDebit,
        totalCredit,
        net: totalDebit - totalCredit,
      },
      coaId: coaIdNum,
      startDate: start_date,
      endDate: end_date,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error fetching journal entries by COA ID:', error)
    console.error('Error stack:', error.stack)
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching journal entries',
      error:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Internal server error',
    })
  }
}

const createJournalEntries = async (req, res, next) => {
  let connection
  try {
    // normalize payload: accept array body, { entries: [...] } or single object
    let payload = []
    if (Array.isArray(req.body)) payload = req.body
    else if (req.body && Array.isArray(req.body.entries)) payload = req.body.entries
    else if (req.body && req.body.entries) payload = [req.body.entries]
    else if (req.body && Object.keys(req.body).length > 0) payload = [req.body]

    console.log('Received payload for creating journal entries:', req.body)
    if (!payload || payload.length === 0) {
      console.log('No journal entry data provided')
      return res.status(400).json({
        success: false,
        message: 'No journal entry data provided',
      })
    }

    connection = await getTenantPool().getConnection()
    await connection.beginTransaction()

    const results = []

    for (const entry of payload) {
      // 🟢 ADDED: Parse and validate amount right away. If it's 0, skip this item entirely.
      const parsedAmount = entry.amount != null ? parseFloat(entry.amount) : 0
      if (parsedAmount === 0) {
        console.log('Skipping entry with zero amount:', entry)
        continue // Skips COA resolution and DB insertion, moving to the next item
      }

      let coaId = parseInt(entry.coa_id)
      if (!Number.isInteger(coaId)) {
        const [coaRows] = await connection.execute(
          `SELECT ${Master.charts_of_accounts.selectOptionColumns.id} AS id FROM ${Master.charts_of_accounts.tablename}
           WHERE ${Master.charts_of_accounts.selectOptionColumns.name} = ?
           OR ${Master.charts_of_accounts.selectOptionColumns.code} = ?
           LIMIT 1`,
          [entry.coa_id, entry.coa_id],
        )

        if (coaRows.length > 0) {
          coaId = coaRows[0].id
        } else {
          await connection.rollback()
          console.log(
            `Unable to resolve coa_id from charts of accounts: ${entry.coa_id}`,
          )
          return res.status(400).json({
            success: false,
            message: `Unable to resolve coa_id from charts of accounts: ${entry.coa_id}`,
          })
        }
      }

      const mainQuery = sql
        .insert(Accounting.journal_entries.tablename, {
          columns: Accounting.journal_entries.insertColumns,
          prefix: Accounting.journal_entries.prefix,
          isTransaction: true,
        })
        .build()

      const mainValues = [
        entry.db_name || null,
        parseInt(entry.db_id) || null,
        coaId || null,
        entry.responsibility_center || null,
        entry.type || null,
        parsedAmount, // 🟢 UPDATED: Reused the already parsedAmount variable here
        entry.date || new Date().toISOString().split('T')[0],
      ]

      const [mainResult] = await connection.execute(mainQuery, mainValues)
      results.push({ id: mainResult.insertId || null, values: mainValues })
    }

    await connection.commit()

    // 🟢 ADDED: Broadcast socket event for journal entries creation
    if (results.length > 0) {
      broadcastUpdates(
        { journal_entries: results, count: results.length },
        'journal_entries_created',
      )
    }

    return res.status(201).json({
      success: true,
      message: 'Journal entries created successfully',
      count: results.length,
      data: results,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error creating journal entries:', error)
    if (connection) {
      try {
        await connection.rollback()
      } catch (rbErr) {
        console.error('Rollback error:', rbErr)
      }
    }
    return res.status(500).json({
      success: false,
      message: 'Server error while creating journal entries',
      error:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Internal server error',
    })
  } finally {
    if (connection) connection.release()
  }
}

module.exports = {
  getJournalEntries,
  getAdvances,
  getJournalEntriesByCoaId,
  createJournalEntries,
}
