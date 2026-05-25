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

require('dotenv').config()

const getJournalEntries = async (req, res, next) => {
  try {
    const { start_date, end_date } = req.query

    let query = new SQLQueryBuilder()
      .select([
        Accounting.journal_entries.selectOptionColumns.id,
        Accounting.journal_entries.selectOptionColumns.db_name,
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
                          ${Master.charts_of_accounts.selectOptionColumns.name} as coa_name, 
                          ${Accounting.journal_entries.selectOptionColumns.responsibility_center}, 
                          ${Accounting.journal_entries.selectOptionColumns.type}, 
                          ${Accounting.journal_entries.selectOptionColumns.amount}, 
                          ${Accounting.journal_entries.selectOptionColumns.date} 
                   FROM ${Accounting.journal_entries.tablename} 
                   INNER JOIN ${Master.charts_of_accounts.tablename} ON ${Master.charts_of_accounts.selectOptionColumns.id} = ${Accounting.journal_entries.selectOptionColumns.coa_id}`

    if (whereConditions.length > 0) {
      sqlQuery += ` WHERE ${whereConditions.join(' AND ')}`
    }

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

module.exports = {
  getJournalEntries,
  getJournalEntriesByCoaId,
}
