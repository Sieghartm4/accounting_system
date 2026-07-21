const os = require('os')
const {
  checkConnection,
  SelectAll,
  Transaction,
  Query,
  Insert,
} = require('../database/util/queries.util')
const {
  formatMemoryUsage,
  formatTime,
  DataModeling,
} = require('../util/helper.util')
const { Master } = require('../database/model/Master')
const { Accounting } = require('../database/model/Accounting')
const { SQLQueryBuilder } = require('../util/helper.util')
const { getTenantPool } = require('../database/util/tenantConnection.util')
const sql = new SQLQueryBuilder()

require('dotenv').config()
require('dotenv').config()

const getTrialBalance = async (req, res, next) => {
  try {
    const { start_date, end_date } = req.query

    let dateFilter = ''
    if (start_date || end_date) {
      const conditions = []
      if (start_date) {
        conditions.push(`
          (
            (${Accounting.journal_entries.selectOptionColumns.db_name} = 'receipts' AND EXISTS (
              SELECT 1 FROM ${Accounting.receipts.tablename} r
              WHERE r.${Accounting.receipts.selectOptionColumns.id} = ${Accounting.journal_entries.selectOptionColumns.db_id}
              AND r.${Accounting.receipts.selectOptionColumns.collection_date} >= '${start_date}'
            ))
            OR (${Accounting.journal_entries.selectOptionColumns.db_name} = 'cash_disbursements' AND EXISTS (
              SELECT 1 FROM ${Accounting.cash_disbursements.tablename} cd
              WHERE cd.${Accounting.cash_disbursements.selectOptionColumns.id} = ${Accounting.journal_entries.selectOptionColumns.db_id}
              AND cd.${Accounting.cash_disbursements.selectOptionColumns.payment_date} >= '${start_date}'
            ))
            OR (${Accounting.journal_entries.selectOptionColumns.db_name} = 'sales' AND EXISTS (
              SELECT 1 FROM ${Accounting.sales.tablename} s
              WHERE s.${Accounting.sales.selectOptionColumns.id} = ${Accounting.journal_entries.selectOptionColumns.db_id}
              AND s.${Accounting.sales.selectOptionColumns.date_delivered} >= '${start_date}'
            ))
            OR (${Accounting.journal_entries.selectOptionColumns.db_name} = 'collections' AND EXISTS (
              SELECT 1 FROM ${Accounting.collections.tablename} c
              WHERE c.${Accounting.collections.selectOptionColumns.id} = ${Accounting.journal_entries.selectOptionColumns.db_id}
              AND c.${Accounting.collections.selectOptionColumns.collection_date} >= '${start_date}'
            ))
            OR (${Accounting.journal_entries.selectOptionColumns.db_name} = 'purchase' AND EXISTS (
              SELECT 1 FROM ${Accounting.purchase.tablename} p
              WHERE p.${Accounting.purchase.selectOptionColumns.id} = ${Accounting.journal_entries.selectOptionColumns.db_id}
              AND p.${Accounting.purchase.selectOptionColumns.date_delivered} >= '${start_date}'
            ))
            OR (${Accounting.journal_entries.selectOptionColumns.db_name} = 'payments' AND EXISTS (
              SELECT 1 FROM ${Accounting.payments.tablename} pay
              WHERE pay.${Accounting.payments.selectOptionColumns.id} = ${Accounting.journal_entries.selectOptionColumns.db_id}
              AND pay.${Accounting.payments.selectOptionColumns.payment_date} >= '${start_date}'
            ))
            OR (${Accounting.journal_entries.selectOptionColumns.db_name} = 'adjustments' AND EXISTS (
              SELECT 1 FROM ${Accounting.adjustments.tablename} a
              WHERE a.${Accounting.adjustments.selectOptionColumns.id} = ${Accounting.journal_entries.selectOptionColumns.db_id}
              AND a.${Accounting.adjustments.selectOptionColumns.posting_date} >= '${start_date}'
            ))
          )
        `)
      }
      if (end_date) {
        conditions.push(`
          (
            (${Accounting.journal_entries.selectOptionColumns.db_name} = 'receipts' AND EXISTS (
              SELECT 1 FROM ${Accounting.receipts.tablename} r
              WHERE r.${Accounting.receipts.selectOptionColumns.id} = ${Accounting.journal_entries.selectOptionColumns.db_id}
              AND r.${Accounting.receipts.selectOptionColumns.collection_date} <= '${end_date}'
            ))
            OR (${Accounting.journal_entries.selectOptionColumns.db_name} = 'cash_disbursements' AND EXISTS (
              SELECT 1 FROM ${Accounting.cash_disbursements.tablename} cd
              WHERE cd.${Accounting.cash_disbursements.selectOptionColumns.id} = ${Accounting.journal_entries.selectOptionColumns.db_id}
              AND cd.${Accounting.cash_disbursements.selectOptionColumns.payment_date} <= '${end_date}'
            ))
            OR (${Accounting.journal_entries.selectOptionColumns.db_name} = 'sales' AND EXISTS (
              SELECT 1 FROM ${Accounting.sales.tablename} s
              WHERE s.${Accounting.sales.selectOptionColumns.id} = ${Accounting.journal_entries.selectOptionColumns.db_id}
              AND s.${Accounting.sales.selectOptionColumns.date_delivered} <= '${end_date}'
            ))
            OR (${Accounting.journal_entries.selectOptionColumns.db_name} = 'collections' AND EXISTS (
              SELECT 1 FROM ${Accounting.collections.tablename} c
              WHERE c.${Accounting.collections.selectOptionColumns.id} = ${Accounting.journal_entries.selectOptionColumns.db_id}
              AND c.${Accounting.collections.selectOptionColumns.collection_date} <= '${end_date}'
            ))
            OR (${Accounting.journal_entries.selectOptionColumns.db_name} = 'purchase' AND EXISTS (
              SELECT 1 FROM ${Accounting.purchase.tablename} p
              WHERE p.${Accounting.purchase.selectOptionColumns.id} = ${Accounting.journal_entries.selectOptionColumns.db_id}
              AND p.${Accounting.purchase.selectOptionColumns.date_delivered} <= '${end_date}'
            ))
            OR (${Accounting.journal_entries.selectOptionColumns.db_name} = 'payments' AND EXISTS (
              SELECT 1 FROM ${Accounting.payments.tablename} pay
              WHERE pay.${Accounting.payments.selectOptionColumns.id} = ${Accounting.journal_entries.selectOptionColumns.db_id}
              AND pay.${Accounting.payments.selectOptionColumns.payment_date} <= '${end_date}'
            ))
            OR (${Accounting.journal_entries.selectOptionColumns.db_name} = 'adjustments' AND EXISTS (
              SELECT 1 FROM ${Accounting.adjustments.tablename} a
              WHERE a.${Accounting.adjustments.selectOptionColumns.id} = ${Accounting.journal_entries.selectOptionColumns.db_id}
              AND a.${Accounting.adjustments.selectOptionColumns.posting_date} <= '${end_date}'
            ))
          )
        `)
      }
      dateFilter = ` AND ${conditions.join(' AND ')}`
    }

    const trial_balance_query = `
      SELECT 
        ${Master.charts_of_accounts.selectOptionColumns.code} AS 'Account Code',
        ${Master.charts_of_accounts.selectOptionColumns.name} AS 'Account Name',
        SUM(CASE WHEN ${Accounting.journal_entries.selectOptionColumns.type} = 'DEBIT' 
              THEN ${Accounting.journal_entries.selectOptionColumns.amount} ELSE 0 END) AS DEBIT,
        SUM(CASE WHEN ${Accounting.journal_entries.selectOptionColumns.type} = 'CREDIT' 
              THEN ${Accounting.journal_entries.selectOptionColumns.amount} ELSE 0 END) AS CREDIT
      FROM ${Master.charts_of_accounts.tablename}
      LEFT JOIN ${Accounting.journal_entries.tablename}
        ON ${Accounting.journal_entries.selectOptionColumns.coa_id} = ${Master.charts_of_accounts.selectOptionColumns.id}
      WHERE ${Master.charts_of_accounts.selectOptionColumns.status} = 'ACTIVE'
        AND ${Accounting.journal_entries.selectOptionColumns.db_name} IS NOT NULL
        AND ${Accounting.journal_entries.selectOptionColumns.db_id} IS NOT NULL
        AND ${Accounting.journal_entries.selectOptionColumns.coa_id} IS NOT NULL
        ${dateFilter}
      GROUP BY
        ${Master.charts_of_accounts.selectOptionColumns.id},
        ${Master.charts_of_accounts.selectOptionColumns.code},
        ${Master.charts_of_accounts.selectOptionColumns.name}
      ORDER BY
        ${Master.charts_of_accounts.selectOptionColumns.code}
    `

    const trialBalance = await Query(trial_balance_query)
    console.log('Trial Balance Query:', trial_balance_query)
    res.status(200).json({
      success: true,
      message: 'Trial Balance retrieved successfully',
      data: trialBalance,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error fetching trial balance:', error)
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching trial balance',
      error:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Internal server error',
    })
  }
}

const getIncomeStatement = async (req, res, next) => {
  try {
    const { start_date, end_date } = req.query

    let dateFilter = ''
    if (start_date || end_date) {
      const conditions = []
      if (start_date) {
        conditions.push(`
          (
            (${Accounting.journal_entries.selectOptionColumns.db_name} = 'receipts' AND EXISTS (
              SELECT 1 FROM ${Accounting.receipts.tablename} r
              WHERE r.${Accounting.receipts.selectOptionColumns.id} = ${Accounting.journal_entries.selectOptionColumns.db_id}
              AND r.${Accounting.receipts.selectOptionColumns.collection_date} >= '${start_date}'
            ))
            OR (${Accounting.journal_entries.selectOptionColumns.db_name} = 'cash_disbursements' AND EXISTS (
              SELECT 1 FROM ${Accounting.cash_disbursements.tablename} cd
              WHERE cd.${Accounting.cash_disbursements.selectOptionColumns.id} = ${Accounting.journal_entries.selectOptionColumns.db_id}
              AND cd.${Accounting.cash_disbursements.selectOptionColumns.payment_date} >= '${start_date}'
            ))
            OR (${Accounting.journal_entries.selectOptionColumns.db_name} = 'sales' AND EXISTS (
              SELECT 1 FROM ${Accounting.sales.tablename} s
              WHERE s.${Accounting.sales.selectOptionColumns.id} = ${Accounting.journal_entries.selectOptionColumns.db_id}
              AND s.${Accounting.sales.selectOptionColumns.date_delivered} >= '${start_date}'
            ))
            OR (${Accounting.journal_entries.selectOptionColumns.db_name} = 'collections' AND EXISTS (
              SELECT 1 FROM ${Accounting.collections.tablename} c
              WHERE c.${Accounting.collections.selectOptionColumns.id} = ${Accounting.journal_entries.selectOptionColumns.db_id}
              AND c.${Accounting.collections.selectOptionColumns.collection_date} >= '${start_date}'
            ))
            OR (${Accounting.journal_entries.selectOptionColumns.db_name} = 'purchase' AND EXISTS (
              SELECT 1 FROM ${Accounting.purchase.tablename} p
              WHERE p.${Accounting.purchase.selectOptionColumns.id} = ${Accounting.journal_entries.selectOptionColumns.db_id}
              AND p.${Accounting.purchase.selectOptionColumns.date_delivered} >= '${start_date}'
            ))
            OR (${Accounting.journal_entries.selectOptionColumns.db_name} = 'payments' AND EXISTS (
              SELECT 1 FROM ${Accounting.payments.tablename} pay
              WHERE pay.${Accounting.payments.selectOptionColumns.id} = ${Accounting.journal_entries.selectOptionColumns.db_id}
              AND pay.${Accounting.payments.selectOptionColumns.payment_date} >= '${start_date}'
            ))
            OR (${Accounting.journal_entries.selectOptionColumns.db_name} = 'adjustments' AND EXISTS (
              SELECT 1 FROM ${Accounting.adjustments.tablename} a
              WHERE a.${Accounting.adjustments.selectOptionColumns.id} = ${Accounting.journal_entries.selectOptionColumns.db_id}
              AND a.${Accounting.adjustments.selectOptionColumns.posting_date} >= '${start_date}'
            ))
          )
        `)
      }
      if (end_date) {
        conditions.push(`
          (
            (${Accounting.journal_entries.selectOptionColumns.db_name} = 'receipts' AND EXISTS (
              SELECT 1 FROM ${Accounting.receipts.tablename} r
              WHERE r.${Accounting.receipts.selectOptionColumns.id} = ${Accounting.journal_entries.selectOptionColumns.db_id}
              AND r.${Accounting.receipts.selectOptionColumns.collection_date} <= '${end_date}'
            ))
            OR (${Accounting.journal_entries.selectOptionColumns.db_name} = 'cash_disbursements' AND EXISTS (
              SELECT 1 FROM ${Accounting.cash_disbursements.tablename} cd
              WHERE cd.${Accounting.cash_disbursements.selectOptionColumns.id} = ${Accounting.journal_entries.selectOptionColumns.db_id}
              AND cd.${Accounting.cash_disbursements.selectOptionColumns.payment_date} <= '${end_date}'
            ))
            OR (${Accounting.journal_entries.selectOptionColumns.db_name} = 'sales' AND EXISTS (
              SELECT 1 FROM ${Accounting.sales.tablename} s
              WHERE s.${Accounting.sales.selectOptionColumns.id} = ${Accounting.journal_entries.selectOptionColumns.db_id}
              AND s.${Accounting.sales.selectOptionColumns.date_delivered} <= '${end_date}'
            ))
            OR (${Accounting.journal_entries.selectOptionColumns.db_name} = 'collections' AND EXISTS (
              SELECT 1 FROM ${Accounting.collections.tablename} c
              WHERE c.${Accounting.collections.selectOptionColumns.id} = ${Accounting.journal_entries.selectOptionColumns.db_id}
              AND c.${Accounting.collections.selectOptionColumns.collection_date} <= '${end_date}'
            ))
            OR (${Accounting.journal_entries.selectOptionColumns.db_name} = 'purchase' AND EXISTS (
              SELECT 1 FROM ${Accounting.purchase.tablename} p
              WHERE p.${Accounting.purchase.selectOptionColumns.id} = ${Accounting.journal_entries.selectOptionColumns.db_id}
              AND p.${Accounting.purchase.selectOptionColumns.date_delivered} <= '${end_date}'
            ))
            OR (${Accounting.journal_entries.selectOptionColumns.db_name} = 'payments' AND EXISTS (
              SELECT 1 FROM ${Accounting.payments.tablename} pay
              WHERE pay.${Accounting.payments.selectOptionColumns.id} = ${Accounting.journal_entries.selectOptionColumns.db_id}
              AND pay.${Accounting.payments.selectOptionColumns.payment_date} <= '${end_date}'
            ))
            OR (${Accounting.journal_entries.selectOptionColumns.db_name} = 'adjustments' AND EXISTS (
              SELECT 1 FROM ${Accounting.adjustments.tablename} a
              WHERE a.${Accounting.adjustments.selectOptionColumns.id} = ${Accounting.journal_entries.selectOptionColumns.db_id}
              AND a.${Accounting.adjustments.selectOptionColumns.posting_date} <= '${end_date}'
            ))
          )
        `)
      }
      dateFilter = ` AND ${conditions.join(' AND ')}`
    }

    // KEY INSIGHT:
    // Use CREDIT - DEBIT for ALL accounts.
    //
    // REVENUE accounts (normal balance = CREDIT):
    //   Income from Trading: mostly CREDITs → positive ✓
    //   Sales Discounts (contra-revenue, normal balance = DEBIT): mostly DEBITs → negative ✓ (reduces revenue)
    //
    // EXPENSES accounts (normal balance = DEBIT):
    //   Regular expenses: mostly DEBITs → CREDIT - DEBIT = negative value
    //   Purchase Discounts (contra-expense, normal balance = CREDIT): mostly CREDITs → positive value
    //
    // Then on the JS side:
    //   totalRevenues = sum of revenue Current values (positives add, negatives reduce)
    //   totalExpenses = sum of expense Current values but we SUM(DEBIT - CREDIT) for normal expenses
    //
    // ACTUALLY — simplest correct approach:
    //   REVENUE  → Current = SUM(CREDIT) - SUM(DEBIT)  [positive = earned, negative = contra]
    //   EXPENSES → Current = SUM(DEBIT) - SUM(CREDIT)  [positive = spent, negative = contra/discount]
    //   totalExpenses will be net (regular expenses minus discounts like Purchase Discounts)

    const income_statement_query = `
      SELECT 
        ${Master.charts_of_accounts.selectOptionColumns.code}   AS 'Account Code',
        ${Master.charts_of_accounts.selectOptionColumns.name}   AS 'Account Name',
        ${Master.charts_of_accounts.selectOptionColumns.type}   AS 'Account Type',
        SUM(CASE WHEN ${Accounting.journal_entries.selectOptionColumns.type} = 'CREDIT' 
              THEN ${Accounting.journal_entries.selectOptionColumns.amount} ELSE 0 END) AS TotalCredit,
        SUM(CASE WHEN ${Accounting.journal_entries.selectOptionColumns.type} = 'DEBIT'  
              THEN ${Accounting.journal_entries.selectOptionColumns.amount} ELSE 0 END) AS TotalDebit,
        CASE
          WHEN ${Master.charts_of_accounts.selectOptionColumns.type} = 'REVENUE'
            THEN SUM(CASE WHEN ${Accounting.journal_entries.selectOptionColumns.type} = 'CREDIT'
                          THEN ${Accounting.journal_entries.selectOptionColumns.amount} ELSE 0 END)
               - SUM(CASE WHEN ${Accounting.journal_entries.selectOptionColumns.type} = 'DEBIT'
                          THEN ${Accounting.journal_entries.selectOptionColumns.amount} ELSE 0 END)
          WHEN ${Master.charts_of_accounts.selectOptionColumns.type} = 'EXPENSES'
            THEN SUM(CASE WHEN ${Accounting.journal_entries.selectOptionColumns.type} = 'DEBIT'
                          THEN ${Accounting.journal_entries.selectOptionColumns.amount} ELSE 0 END)
               - SUM(CASE WHEN ${Accounting.journal_entries.selectOptionColumns.type} = 'CREDIT'
                          THEN ${Accounting.journal_entries.selectOptionColumns.amount} ELSE 0 END)
        END AS Current
      FROM ${Master.charts_of_accounts.tablename}
      LEFT JOIN ${Accounting.journal_entries.tablename}
        ON ${Accounting.journal_entries.selectOptionColumns.coa_id} = ${Master.charts_of_accounts.selectOptionColumns.id}
           ${dateFilter}
      WHERE ${Master.charts_of_accounts.selectOptionColumns.status} = 'ACTIVE'
        AND ${Master.charts_of_accounts.selectOptionColumns.type} IN ('REVENUE', 'EXPENSES')
        AND ${Accounting.journal_entries.selectOptionColumns.db_name} IS NOT NULL
        AND ${Accounting.journal_entries.selectOptionColumns.db_id} IS NOT NULL
        AND ${Accounting.journal_entries.selectOptionColumns.coa_id} IS NOT NULL
      GROUP BY
        ${Master.charts_of_accounts.selectOptionColumns.id},
        ${Master.charts_of_accounts.selectOptionColumns.code},
        ${Master.charts_of_accounts.selectOptionColumns.name},
        ${Master.charts_of_accounts.selectOptionColumns.type}
      ORDER BY
        ${Master.charts_of_accounts.selectOptionColumns.type},
        ${Master.charts_of_accounts.selectOptionColumns.code}
    `

    const incomeStatement = await Query(income_statement_query)

    const revenues = incomeStatement.filter(
      (item) => item['Account Type'] === 'REVENUE',
    )
    const expenses = incomeStatement.filter(
      (item) => item['Account Type'] === 'EXPENSES',
    )

    // totalRevenues: income accounts are positive, contra-revenue (Sales Discounts) is negative
    // They naturally net together correctly
    const totalRevenues = revenues.reduce(
      (sum, item) => sum + parseFloat(item.Current || 0),
      0,
    )

    // totalExpenses: regular expense accounts are positive, contra-expense (Purchase Discounts) is negative
    // They naturally net together correctly
    const totalExpenses = expenses.reduce(
      (sum, item) => sum + parseFloat(item.Current || 0),
      0,
    )

    const netIncome = totalRevenues - totalExpenses

    res.status(200).json({
      success: true,
      message: 'Income Statement retrieved successfully',
      data: {
        revenues,
        expenses,
        totalRevenues,
        totalExpenses,
        netIncome,
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error fetching income statement:', error)
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching income statement',
      error:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Internal server error',
    })
  }
}

const getGeneralLedger = async (req, res, next) => {
  try {
    const { start_date, end_date } = req.query

    let startDate = start_date
    let endDate = end_date

    if (!start_date && !end_date) {
      const now = new Date()
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      startDate = firstDay.toISOString().split('T')[0]
      endDate = lastDay.toISOString().split('T')[0]
    }

    let dateFilter = ''
    const whereConditions = []
    if (startDate)
      whereConditions.push(
        `${Accounting.journal_entries.selectOptionColumns.date} >= '${startDate}'`,
      )
    if (endDate)
      whereConditions.push(
        `${Accounting.journal_entries.selectOptionColumns.date} <= '${endDate}'`,
      )

    // Query to get all journal entries in chronological order
    const general_ledger_query = `
      SELECT
        ${Master.charts_of_accounts.selectOptionColumns.id}                  AS coa_id,
        ${Master.charts_of_accounts.selectOptionColumns.code}                AS account_code,
        ${Master.charts_of_accounts.selectOptionColumns.name}                AS account_name,
        ${Master.charts_of_accounts.selectOptionColumns.type}                AS account_type,
        ${Accounting.journal_entries.selectOptionColumns.date}               AS posted_date,
        ${Accounting.journal_entries.selectOptionColumns.type}               AS entry_type,
        ${Accounting.journal_entries.selectOptionColumns.amount}             AS amount,
        ${Accounting.journal_entries.selectOptionColumns.responsibility_center} AS responsibility_center,
        ${Accounting.journal_entries.selectOptionColumns.db_name}            AS db_name,
        ${Accounting.journal_entries.selectOptionColumns.db_id}              AS db_id
      FROM ${Accounting.journal_entries.tablename}
      INNER JOIN ${Master.charts_of_accounts.tablename}
        ON ${Accounting.journal_entries.selectOptionColumns.coa_id} = ${Master.charts_of_accounts.selectOptionColumns.id}
      WHERE ${Master.charts_of_accounts.selectOptionColumns.status} = 'ACTIVE'
      ${whereConditions.length > 0 ? `AND ${whereConditions.join(' AND ')}` : ''}
      AND ${Accounting.journal_entries.selectOptionColumns.db_name} IS NOT NULL
      AND ${Accounting.journal_entries.selectOptionColumns.db_id} IS NOT NULL
      AND ${Accounting.journal_entries.selectOptionColumns.coa_id} IS NOT NULL
      ORDER BY
        ${Accounting.journal_entries.selectOptionColumns.db_name},
        ${Accounting.journal_entries.selectOptionColumns.db_id},
        ${Accounting.journal_entries.selectOptionColumns.date},
        ${Accounting.journal_entries.selectOptionColumns.db_id}
    `

    const rows = await Query(general_ledger_query)

    // Build chronological ledger entries grouped by source (db_name + db_id)
    let runningBalance = 0
    const ledgerEntries = []
    let prevSourceKey = null

    for (const row of rows) {
      const amount = parseFloat(row.amount || 0)

      // Update running balance
      if (row.entry_type === 'DEBIT') {
        runningBalance += amount
      } else {
        runningBalance -= amount
      }

      const sourceKey = `${row.db_name || ''}::${row.db_id || ''}`

      ledgerEntries.push({
        // show the date only on the first line of each source group
        date: prevSourceKey === sourceKey ? '' : row.posted_date,
        particulars: `${row.account_code} - ${row.account_name}`,
        account_code: row.account_code,
        account_name: row.account_name,
        account_type: row.account_type,
        debit: row.entry_type === 'DEBIT' ? amount : 0,
        credit: row.entry_type === 'CREDIT' ? amount : 0,
        balance: runningBalance,
        source: row.db_name,
        source_id: row.db_id,
        responsibility_center: row.responsibility_center || '',
      })

      prevSourceKey = sourceKey
    }

    // Calculate grand totals
    const grandTotalDebit = rows.reduce(
      (s, r) => s + (r.entry_type === 'DEBIT' ? parseFloat(r.amount || 0) : 0),
      0,
    )
    const grandTotalCredit = rows.reduce(
      (s, r) => s + (r.entry_type === 'CREDIT' ? parseFloat(r.amount || 0) : 0),
      0,
    )

    res.status(200).json({
      success: true,
      message: 'General Ledger retrieved successfully',
      data: ledgerEntries,
      grandTotalDebit,
      grandTotalCredit,
      netTotal: grandTotalDebit - grandTotalCredit,
      startDate,
      endDate,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error fetching general ledger:', error)
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching general ledger',
      error:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Internal server error',
    })
  }
}

const getBalanceSheet = async (req, res, next) => {
  try {
    const { start_date, end_date } = req.query

    let dateFilter = ''
    if (start_date || end_date) {
      const conditions = []
      if (start_date)
        conditions.push(
          `${Accounting.journal_entries.selectOptionColumns.date} >= '${start_date}'`,
        )
      if (end_date)
        conditions.push(
          `${Accounting.journal_entries.selectOptionColumns.date} <= '${end_date}'`,
        )
      dateFilter = ` AND ${conditions.join(' AND ')}`
    }

    const balance_sheet_query = `SELECT ${Master.charts_of_accounts.selectOptionColumns.code} as 'Account Code', ${Master.charts_of_accounts.selectOptionColumns.name} as 'Account Name', SUM(CASE WHEN ${Accounting.journal_entries.selectOptionColumns.type} = 'DEBIT' THEN ${Accounting.journal_entries.selectOptionColumns.amount} ELSE 0 END) - SUM(CASE WHEN ${Accounting.journal_entries.selectOptionColumns.type} = 'CREDIT' THEN ${Accounting.journal_entries.selectOptionColumns.amount} ELSE 0 END) as Current FROM ${Master.charts_of_accounts.tablename} LEFT JOIN ${Accounting.journal_entries.tablename} ON ${Accounting.journal_entries.selectOptionColumns.coa_id} = ${Master.charts_of_accounts.selectOptionColumns.id} WHERE ${Master.charts_of_accounts.selectOptionColumns.status} = 'ACTIVE' AND ${Master.charts_of_accounts.selectOptionColumns.type} IN ('ASSETS', 'LIABILITIES', 'EQUITY')${dateFilter} GROUP BY ${Master.charts_of_accounts.selectOptionColumns.id}, ${Master.charts_of_accounts.selectOptionColumns.code}, ${Master.charts_of_accounts.selectOptionColumns.name}, ${Master.charts_of_accounts.selectOptionColumns.type} ORDER BY ${Master.charts_of_accounts.selectOptionColumns.type}, ${Master.charts_of_accounts.selectOptionColumns.code}`

    const balanceSheet = await Query(balance_sheet_query)

    const income_statement_query = `
      SELECT 
        ${Master.charts_of_accounts.selectOptionColumns.type}   AS 'Account Type',
        SUM(CASE WHEN ${Accounting.journal_entries.selectOptionColumns.type} = 'CREDIT' 
              THEN ${Accounting.journal_entries.selectOptionColumns.amount} ELSE 0 END) AS TotalCredit,
        SUM(CASE WHEN ${Accounting.journal_entries.selectOptionColumns.type} = 'DEBIT'  
              THEN ${Accounting.journal_entries.selectOptionColumns.amount} ELSE 0 END) AS TotalDebit,
        CASE
          WHEN ${Master.charts_of_accounts.selectOptionColumns.type} = 'REVENUE'
            THEN SUM(CASE WHEN ${Accounting.journal_entries.selectOptionColumns.type} = 'CREDIT'
                          THEN ${Accounting.journal_entries.selectOptionColumns.amount} ELSE 0 END)
               - SUM(CASE WHEN ${Accounting.journal_entries.selectOptionColumns.type} = 'DEBIT'
                          THEN ${Accounting.journal_entries.selectOptionColumns.amount} ELSE 0 END)
          WHEN ${Master.charts_of_accounts.selectOptionColumns.type} = 'EXPENSES'
            THEN SUM(CASE WHEN ${Accounting.journal_entries.selectOptionColumns.type} = 'DEBIT'
                          THEN ${Accounting.journal_entries.selectOptionColumns.amount} ELSE 0 END)
               - SUM(CASE WHEN ${Accounting.journal_entries.selectOptionColumns.type} = 'CREDIT'
                          THEN ${Accounting.journal_entries.selectOptionColumns.amount} ELSE 0 END)
        END AS Current
      FROM ${Master.charts_of_accounts.tablename}
      LEFT JOIN ${Accounting.journal_entries.tablename}
        ON ${Accounting.journal_entries.selectOptionColumns.coa_id} = ${Master.charts_of_accounts.selectOptionColumns.id}
           ${dateFilter}
      WHERE ${Master.charts_of_accounts.selectOptionColumns.status} = 'ACTIVE'
        AND ${Master.charts_of_accounts.selectOptionColumns.type} IN ('REVENUE', 'EXPENSES')
        AND ${Accounting.journal_entries.selectOptionColumns.db_name} IS NOT NULL
        AND ${Accounting.journal_entries.selectOptionColumns.db_id} IS NOT NULL
        AND ${Accounting.journal_entries.selectOptionColumns.coa_id} IS NOT NULL
      GROUP BY
        ${Master.charts_of_accounts.selectOptionColumns.id},
        ${Master.charts_of_accounts.selectOptionColumns.type}
    `

    const incomeStatement = await Query(income_statement_query)

    const revenues = incomeStatement.filter(
      (item) => item['Account Type'] === 'REVENUE',
    )
    const expenses = incomeStatement.filter(
      (item) => item['Account Type'] === 'EXPENSES',
    )

    const totalRevenues = revenues.reduce(
      (sum, item) => sum + parseFloat(item.Current || 0),
      0,
    )
    const totalExpenses = expenses.reduce(
      (sum, item) => sum + parseFloat(item.Current || 0),
      0,
    )
    const netIncome = totalRevenues - totalExpenses

    const assets = balanceSheet.filter((item) =>
      item['Account Code'].startsWith('100'),
    )
    const liabilities = balanceSheet.filter((item) =>
      item['Account Code'].startsWith('200'),
    )
    const equity = balanceSheet.filter((item) =>
      item['Account Code'].startsWith('300'),
    )

    const updatedEquity = [...equity]
    if (netIncome !== 0) {
      updatedEquity.push({
        'Account Code': '300999',
        'Account Name': 'Current Period Net Income',
        Current: -netIncome,
      })
    }

    const totalAssets = assets.reduce(
      (sum, item) => sum + parseFloat(item.Current || 0),
      0,
    )
    const totalLiabilities = liabilities.reduce(
      (sum, item) => sum + parseFloat(item.Current || 0),
      0,
    )
    const totalEquity = updatedEquity.reduce(
      (sum, item) => sum + parseFloat(item.Current || 0),
      0,
    )

    res.status(200).json({
      success: true,
      message: 'Balance Sheet retrieved successfully',
      data: {
        assets: assets,
        liabilities: liabilities,
        equity: updatedEquity,
        totalAssets: totalAssets,
        totalLiabilities: totalLiabilities,
        totalEquity: totalEquity,
        totalLiabilitiesAndEquity: totalLiabilities + totalEquity,
        netIncome: netIncome,
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error fetching balance sheet:', error)
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching balance sheet',
      error:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Internal server error',
    })
  }
}

const getSearch = async (req, res, next) => {
  const { startDate, endDate, search, searchFields } = req.query

  const allowedRoutesParam = req.query.allowedRoutes
  const allowedRoutes = Array.isArray(allowedRoutesParam)
    ? allowedRoutesParam.flatMap((value) => String(value).split(','))
    : String(allowedRoutesParam || '')
        .split(',')
        .map((route) => route.trim().toLowerCase())
        .filter(Boolean)

  const defaultSearchRoutes = [
    'sales',
    'collections',
    'receipts',
    'purchase',
    'disbursement',
    'payments',
    'adjustments',
  ]

  const allowedSearchRoutes = new Set(
    allowedRoutes.length > 0 ? allowedRoutes : defaultSearchRoutes,
  )

  try {
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Start date and end date are required',
        timestamp: new Date().toISOString(),
      })
    }

    if (!search || search.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Search term is required',
        timestamp: new Date().toISOString(),
      })
    }

    const searchTerm = `%${search.trim()}%`
    const results = []

    if (allowedSearchRoutes.has('sales')) {
      // Enhanced Sales Query - searches across multiple fields
      const salesQuery = `
      SELECT 
        'Sales' as document_type,
        sal.${Accounting.sales.selectOptionColumns.id} as document_id,
        sal.${Accounting.sales.selectOptionColumns.id} as id,
        sal.${Accounting.sales.selectOptionColumns.document_reference} as document_reference,
        cust.${Master.customers.selectOptionColumns.name} as customer_name,
        sal.${Accounting.sales.selectOptionColumns.date_delivered} as document_date,
        sal.${Accounting.sales.selectOptionColumns.total_amount_due} as amount,
        sal.${Accounting.sales.selectOptionColumns.remarks} as remarks,
        sal.${Accounting.sales.selectOptionColumns.state} as state,
        sal.${Accounting.sales.selectOptionColumns.created_by} as created_by
      FROM ${Accounting.sales.tablename} sal
      LEFT JOIN ${Master.customers.tablename} cust ON sal.${Accounting.sales.selectOptionColumns.customer_id} = cust.${Master.customers.selectOptionColumns.id}
      WHERE (
        sal.${Accounting.sales.selectOptionColumns.document_reference} LIKE ? OR 
        cust.${Master.customers.selectOptionColumns.name} LIKE ? OR
        sal.${Accounting.sales.selectOptionColumns.remarks} LIKE ? OR
        sal.${Accounting.sales.selectOptionColumns.created_by} LIKE ? OR
        sal.${Accounting.sales.selectOptionColumns.state} LIKE ? OR
        CAST(sal.${Accounting.sales.selectOptionColumns.total_amount_due} AS CHAR) LIKE ?
      )
        AND sal.${Accounting.sales.selectOptionColumns.date_delivered} BETWEEN ? AND ?
    `

      const salesResults = await Query(salesQuery, [
        searchTerm,
        searchTerm,
        searchTerm,
        searchTerm,
        searchTerm,
        searchTerm,
        startDate,
        endDate,
      ])
      results.push(...salesResults)
    }

    if (allowedSearchRoutes.has('collections')) {
      // Enhanced Collections Query - searches across multiple fields
      const collectionsQuery = `
      SELECT 
        'Collection' as document_type,
        coll.${Accounting.collections.selectOptionColumns.id} as document_id,
        coll.${Accounting.collections.selectOptionColumns.id} as id,
        coll.${Accounting.collections.selectOptionColumns.document_reference} as document_reference,
        cust.${Master.customers.selectOptionColumns.name} as customer_name,
        coll.${Accounting.collections.selectOptionColumns.collection_date} as document_date,
        NULL as amount,
        coll.${Accounting.collections.selectOptionColumns.remarks} as remarks,
        coll.${Accounting.collections.selectOptionColumns.state} as state,
        coll.${Accounting.collections.selectOptionColumns.created_by} as created_by,
        coll.${Accounting.collections.selectOptionColumns.mode_of_payment} as mode_of_payment,
        coll.${Accounting.collections.selectOptionColumns.bank_name} as bank_name,
        coll.${Accounting.collections.selectOptionColumns.check_number} as check_number
      FROM ${Accounting.collections.tablename} coll
      LEFT JOIN ${Master.customers.tablename} cust ON coll.${Accounting.collections.selectOptionColumns.customer_id} = cust.${Master.customers.selectOptionColumns.id}
      WHERE (
        coll.${Accounting.collections.selectOptionColumns.document_reference} LIKE ? OR 
        cust.${Master.customers.selectOptionColumns.name} LIKE ? OR
        coll.${Accounting.collections.selectOptionColumns.remarks} LIKE ? OR
        coll.${Accounting.collections.selectOptionColumns.created_by} LIKE ? OR
        coll.${Accounting.collections.selectOptionColumns.state} LIKE ? OR
        coll.${Accounting.collections.selectOptionColumns.mode_of_payment} LIKE ? OR
        coll.${Accounting.collections.selectOptionColumns.bank_name} LIKE ? OR
        coll.${Accounting.collections.selectOptionColumns.check_number} LIKE ?
      )
        AND coll.${Accounting.collections.selectOptionColumns.collection_date} BETWEEN ? AND ?
    `

      const collectionsResults = await Query(collectionsQuery, [
        searchTerm,
        searchTerm,
        searchTerm,
        searchTerm,
        searchTerm,
        searchTerm,
        searchTerm,
        searchTerm,
        startDate,
        endDate,
      ])
      results.push(...collectionsResults)
    }

    if (allowedSearchRoutes.has('receipts')) {
      // Enhanced Receipts Query - searches across multiple fields
      const receiptsQuery = `
      SELECT 
        'Receipt' as document_type,
        rec.${Accounting.receipts.selectOptionColumns.id} as document_id,
        rec.${Accounting.receipts.selectOptionColumns.id} as id,
        rec.${Accounting.receipts.selectOptionColumns.document_reference} as document_reference,
        cust.${Master.customers.selectOptionColumns.name} as customer_name,
        rec.${Accounting.receipts.selectOptionColumns.collection_date} as document_date,
        rec.${Accounting.receipts.selectOptionColumns.total_amount_due} as amount,
        rec.${Accounting.receipts.selectOptionColumns.remarks} as remarks,
        rec.${Accounting.receipts.selectOptionColumns.state} as state,
        rec.${Accounting.receipts.selectOptionColumns.created_by} as created_by,
        rec.${Accounting.receipts.selectOptionColumns.mode_of_payment} as mode_of_payment,
        rec.${Accounting.receipts.selectOptionColumns.bank_name} as bank_name,
        rec.${Accounting.receipts.selectOptionColumns.check_number} as check_number
      FROM ${Accounting.receipts.tablename} rec
      LEFT JOIN ${Master.customers.tablename} cust ON rec.${Accounting.receipts.selectOptionColumns.customer_id} = cust.${Master.customers.selectOptionColumns.id}
      WHERE (
        rec.${Accounting.receipts.selectOptionColumns.document_reference} LIKE ? OR 
        cust.${Master.customers.selectOptionColumns.name} LIKE ? OR
        rec.${Accounting.receipts.selectOptionColumns.remarks} LIKE ? OR
        rec.${Accounting.receipts.selectOptionColumns.created_by} LIKE ? OR
        rec.${Accounting.receipts.selectOptionColumns.state} LIKE ? OR
        CAST(rec.${Accounting.receipts.selectOptionColumns.total_amount_due} AS CHAR) LIKE ? OR
        rec.${Accounting.receipts.selectOptionColumns.mode_of_payment} LIKE ? OR
        rec.${Accounting.receipts.selectOptionColumns.bank_name} LIKE ? OR
        rec.${Accounting.receipts.selectOptionColumns.check_number} LIKE ?
      )
        AND rec.${Accounting.receipts.selectOptionColumns.collection_date} BETWEEN ? AND ?
    `

      const receiptsResults = await Query(receiptsQuery, [
        searchTerm,
        searchTerm,
        searchTerm,
        searchTerm,
        searchTerm,
        searchTerm,
        searchTerm,
        searchTerm,
        searchTerm,
        startDate,
        endDate,
      ])
      results.push(...receiptsResults)
    }

    if (allowedSearchRoutes.has('purchase')) {
      // Enhanced Purchase Query - searches across multiple fields
      const purchaseQuery = `
      SELECT 
        'Purchase' as document_type,
        pur.${Accounting.purchase.selectOptionColumns.id} as document_id,
        pur.${Accounting.purchase.selectOptionColumns.id} as id,
        pur.${Accounting.purchase.selectOptionColumns.document_reference} as document_reference,
        vend.${Master.vendors.selectOptionColumns.name} as vendor_name,
        pur.${Accounting.purchase.selectOptionColumns.date_delivered} as document_date,
        pur.${Accounting.purchase.selectOptionColumns.total_amount_due} as amount,
        pur.${Accounting.purchase.selectOptionColumns.remarks} as remarks,
        pur.${Accounting.purchase.selectOptionColumns.state} as state,
        pur.${Accounting.purchase.selectOptionColumns.created_by} as created_by
      FROM ${Accounting.purchase.tablename} pur
      LEFT JOIN ${Master.vendors.tablename} vend ON pur.${Accounting.purchase.selectOptionColumns.vendor_id} = vend.${Master.vendors.selectOptionColumns.id}
      WHERE (
        pur.${Accounting.purchase.selectOptionColumns.document_reference} LIKE ? OR 
        vend.${Master.vendors.selectOptionColumns.name} LIKE ? OR
        pur.${Accounting.purchase.selectOptionColumns.remarks} LIKE ? OR
        pur.${Accounting.purchase.selectOptionColumns.created_by} LIKE ? OR
        pur.${Accounting.purchase.selectOptionColumns.state} LIKE ? OR
        CAST(pur.${Accounting.purchase.selectOptionColumns.total_amount_due} AS CHAR) LIKE ?
      )
        AND pur.${Accounting.purchase.selectOptionColumns.date_delivered} BETWEEN ? AND ?
    `

      const purchaseResults = await Query(purchaseQuery, [
        searchTerm,
        searchTerm,
        searchTerm,
        searchTerm,
        searchTerm,
        searchTerm,
        startDate,
        endDate,
      ])
      results.push(...purchaseResults)
    }

    if (allowedSearchRoutes.has('disbursement')) {
      // Enhanced Cash Disbursements Query - searches across multiple fields
      const cashDisbursementsQuery = `
      SELECT 
        'Cash Disbursement' as document_type,
        cd.${Accounting.cash_disbursements.selectOptionColumns.id} as document_id,
        cd.${Accounting.cash_disbursements.selectOptionColumns.id} as id,
        cd.${Accounting.cash_disbursements.selectOptionColumns.document_reference} as document_reference,
        vend.${Master.vendors.selectOptionColumns.name} as vendor_name,
        cd.${Accounting.cash_disbursements.selectOptionColumns.payment_date} as document_date,
        cd.${Accounting.cash_disbursements.selectOptionColumns.total_amount_due} as amount,
        cd.${Accounting.cash_disbursements.selectOptionColumns.remarks} as remarks,
        cd.${Accounting.cash_disbursements.selectOptionColumns.state} as state,
        cd.${Accounting.cash_disbursements.selectOptionColumns.created_by} as created_by,
        cd.${Accounting.cash_disbursements.selectOptionColumns.mode_of_payment} as mode_of_payment,
        cd.${Accounting.cash_disbursements.selectOptionColumns.bank_name} as bank_name,
        cd.${Accounting.cash_disbursements.selectOptionColumns.check_number} as check_number
      FROM ${Accounting.cash_disbursements.tablename} cd
      LEFT JOIN ${Master.vendors.tablename} vend ON cd.${Accounting.cash_disbursements.selectOptionColumns.vendor_id} = vend.${Master.vendors.selectOptionColumns.id}
      WHERE (
        cd.${Accounting.cash_disbursements.selectOptionColumns.document_reference} LIKE ? OR 
        vend.${Master.vendors.selectOptionColumns.name} LIKE ? OR
        cd.${Accounting.cash_disbursements.selectOptionColumns.remarks} LIKE ? OR
        cd.${Accounting.cash_disbursements.selectOptionColumns.created_by} LIKE ? OR
        cd.${Accounting.cash_disbursements.selectOptionColumns.state} LIKE ? OR
        CAST(cd.${Accounting.cash_disbursements.selectOptionColumns.total_amount_due} AS CHAR) LIKE ? OR
        cd.${Accounting.cash_disbursements.selectOptionColumns.mode_of_payment} LIKE ? OR
        cd.${Accounting.cash_disbursements.selectOptionColumns.bank_name} LIKE ? OR
        cd.${Accounting.cash_disbursements.selectOptionColumns.check_number} LIKE ?
      )
        AND cd.${Accounting.cash_disbursements.selectOptionColumns.payment_date} BETWEEN ? AND ?
    `

      const cashDisbursementsResults = await Query(cashDisbursementsQuery, [
        searchTerm,
        searchTerm,
        searchTerm,
        searchTerm,
        searchTerm,
        searchTerm,
        searchTerm,
        searchTerm,
        searchTerm,
        startDate,
        endDate,
      ])
      results.push(...cashDisbursementsResults)
    }

    if (allowedSearchRoutes.has('payments')) {
      // Enhanced Payments Query - searches across multiple fields
      const paymentsQuery = `
      SELECT 
        'Payment' as document_type,
        pay.${Accounting.payments.selectOptionColumns.id} as document_id,
        pay.${Accounting.payments.selectOptionColumns.id} as id,
        pay.${Accounting.payments.selectOptionColumns.document_reference} as document_reference,
        vend.${Master.vendors.selectOptionColumns.name} as vendor_name,
        pay.${Accounting.payments.selectOptionColumns.payment_date} as document_date,
        NULL as amount,
        pay.${Accounting.payments.selectOptionColumns.remarks} as remarks,
        pay.${Accounting.payments.selectOptionColumns.state} as state,
        pay.${Accounting.payments.selectOptionColumns.created_by} as created_by,
        pay.${Accounting.payments.selectOptionColumns.mode_of_payment} as mode_of_payment,
        pay.${Accounting.payments.selectOptionColumns.bank_name} as bank_name,
        pay.${Accounting.payments.selectOptionColumns.check_number} as check_number
      FROM ${Accounting.payments.tablename} pay
      LEFT JOIN ${Master.vendors.tablename} vend ON pay.${Accounting.payments.selectOptionColumns.vendor_id} = vend.${Master.vendors.selectOptionColumns.id}
      WHERE (
        pay.${Accounting.payments.selectOptionColumns.document_reference} LIKE ? OR 
        vend.${Master.vendors.selectOptionColumns.name} LIKE ? OR
        pay.${Accounting.payments.selectOptionColumns.remarks} LIKE ? OR
        pay.${Accounting.payments.selectOptionColumns.created_by} LIKE ? OR
        pay.${Accounting.payments.selectOptionColumns.state} LIKE ? OR
        pay.${Accounting.payments.selectOptionColumns.mode_of_payment} LIKE ? OR
        pay.${Accounting.payments.selectOptionColumns.bank_name} LIKE ? OR
        pay.${Accounting.payments.selectOptionColumns.check_number} LIKE ?
      )
        AND pay.${Accounting.payments.selectOptionColumns.payment_date} BETWEEN ? AND ?
    `

      const paymentsResults = await Query(paymentsQuery, [
        searchTerm,
        searchTerm,
        searchTerm,
        searchTerm,
        searchTerm,
        searchTerm,
        searchTerm,
        searchTerm,
        startDate,
        endDate,
      ])
      results.push(...paymentsResults)
    }

    if (allowedSearchRoutes.has('adjustments')) {
      // Enhanced Adjustments Query - searches across multiple fields
      const adjustmentsQuery = `
      SELECT 
        'Adjustment' as document_type,
        adj.${Accounting.adjustments.selectOptionColumns.id} as document_id,
        adj.${Accounting.adjustments.selectOptionColumns.id} as id,
        adj.${Accounting.adjustments.selectOptionColumns.document_reference} as document_reference,
        NULL as customer_name,
        NULL as vendor_name,
        adj.${Accounting.adjustments.selectOptionColumns.posting_date} as document_date,
        adj.${Accounting.adjustments.selectOptionColumns.total_amount} as amount,
        adj.${Accounting.adjustments.selectOptionColumns.remarks} as remarks,
        adj.${Accounting.adjustments.selectOptionColumns.status} as state,
        adj.${Accounting.adjustments.selectOptionColumns.created_by} as created_by
      FROM ${Accounting.adjustments.tablename} adj
      WHERE (
        adj.${Accounting.adjustments.selectOptionColumns.document_reference} LIKE ? OR
        adj.${Accounting.adjustments.selectOptionColumns.remarks} LIKE ? OR
        adj.${Accounting.adjustments.selectOptionColumns.created_by} LIKE ? OR
        adj.${Accounting.adjustments.selectOptionColumns.status} LIKE ? OR
        CAST(adj.${Accounting.adjustments.selectOptionColumns.total_amount} AS CHAR) LIKE ?
      )
        AND adj.${Accounting.adjustments.selectOptionColumns.posting_date} BETWEEN ? AND ?
    `

      const adjustmentsResults = await Query(adjustmentsQuery, [
        searchTerm,
        searchTerm,
        searchTerm,
        searchTerm,
        searchTerm,
        startDate,
        endDate,
      ])
      results.push(...adjustmentsResults)
    }

    results.sort((a, b) => new Date(b.document_date) - new Date(a.document_date))

    res.status(200).json({
      success: true,
      message: 'Search results retrieved successfully',
      data: results,
      count: results.length,
      search_term: search,
      searchable_fields: [
        'Document Reference',
        'Customer/Vendor Name',
        'Remarks',
        'Created By',
        'State',
        'Total Amount',
        'Mode of Payment',
        'Bank Name',
        'Check Number',
      ],
      date_range: {
        start_date: startDate,
        end_date: endDate,
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error performing search:', error)
    return res.status(500).json({
      success: false,
      message: 'Server error while performing search',
      error:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Internal server error',
    })
  }
}

const getStatementOfComprehensiveIncome = async (req, res, next) => {
  try {
    const { start_date, end_date } = req.query

    let dateFilter = ''
    if (start_date || end_date) {
      dateFilter =
        ' AND ' +
        Accounting.journal_entries.selectOptionColumns.date +
        ' BETWEEN ? AND ?'
    }

    // Get Income Statement data (revenues and expenses)
    const income_statement_query = `
      SELECT 
        ${Master.charts_of_accounts.selectOptionColumns.code}   AS 'Account Code',
        ${Master.charts_of_accounts.selectOptionColumns.name}   AS 'Account Name',
        ${Master.charts_of_accounts.selectOptionColumns.type}   AS 'Account Type',
        SUM(CASE WHEN ${Accounting.journal_entries.selectOptionColumns.type} = 'CREDIT' 
              THEN ${Accounting.journal_entries.selectOptionColumns.amount} ELSE 0 END) AS TotalCredit,
        SUM(CASE WHEN ${Accounting.journal_entries.selectOptionColumns.type} = 'DEBIT'  
              THEN ${Accounting.journal_entries.selectOptionColumns.amount} ELSE 0 END) AS TotalDebit,
        CASE
          WHEN ${Master.charts_of_accounts.selectOptionColumns.type} = 'REVENUE'
            THEN SUM(CASE WHEN ${Accounting.journal_entries.selectOptionColumns.type} = 'CREDIT'
                          THEN ${Accounting.journal_entries.selectOptionColumns.amount} ELSE 0 END)
               - SUM(CASE WHEN ${Accounting.journal_entries.selectOptionColumns.type} = 'DEBIT'
                          THEN ${Accounting.journal_entries.selectOptionColumns.amount} ELSE 0 END)
          WHEN ${Master.charts_of_accounts.selectOptionColumns.type} = 'EXPENSES'
            THEN SUM(CASE WHEN ${Accounting.journal_entries.selectOptionColumns.type} = 'DEBIT'
                          THEN ${Accounting.journal_entries.selectOptionColumns.amount} ELSE 0 END)
               - SUM(CASE WHEN ${Accounting.journal_entries.selectOptionColumns.type} = 'CREDIT'
                          THEN ${Accounting.journal_entries.selectOptionColumns.amount} ELSE 0 END)
        END AS Current
      FROM ${Master.charts_of_accounts.tablename}
      LEFT JOIN ${Accounting.journal_entries.tablename}
        ON ${Accounting.journal_entries.selectOptionColumns.coa_id} = ${Master.charts_of_accounts.selectOptionColumns.id}
           ${dateFilter.replace(' AND ', '')}
      WHERE ${Master.charts_of_accounts.selectOptionColumns.status} = 'ACTIVE'
        AND ${Master.charts_of_accounts.selectOptionColumns.type} IN ('REVENUE', 'EXPENSES')
      GROUP BY
        ${Master.charts_of_accounts.selectOptionColumns.id},
        ${Master.charts_of_accounts.selectOptionColumns.code},
        ${Master.charts_of_accounts.selectOptionColumns.name},
        ${Master.charts_of_accounts.selectOptionColumns.type}
      ORDER BY
        ${Master.charts_of_accounts.selectOptionColumns.type},
        ${Master.charts_of_accounts.selectOptionColumns.code}
    `

    const queryParams = []
    if (start_date && end_date) {
      queryParams.push(start_date, end_date)
    }

    const incomeStatement = await Query(income_statement_query, queryParams)

    // Separate revenues and expenses
    const revenues = incomeStatement.filter(
      (item) => item['Account Type'] === 'REVENUE',
    )
    const expenses = incomeStatement.filter(
      (item) => item['Account Type'] === 'EXPENSES',
    )

    // Calculate totals
    const totalRevenues = revenues.reduce(
      (sum, item) => sum + parseFloat(item.Current || 0),
      0,
    )
    const totalExpenses = expenses.reduce(
      (sum, item) => sum + parseFloat(item.Current || 0),
      0,
    )
    const netIncome = totalRevenues - totalExpenses

    // Get Other Comprehensive Income items (OCI) - typically revaluation accounts, unrealized gains/losses
    // These are typically EQUITY type accounts with specific codes or names containing 'OCI', 'Revaluation', 'Unrealized'
    const oci_query = `
      SELECT 
        ${Master.charts_of_accounts.selectOptionColumns.code}   AS 'Account Code',
        ${Master.charts_of_accounts.selectOptionColumns.name}   AS 'Account Name',
        SUM(CASE WHEN ${Accounting.journal_entries.selectOptionColumns.type} = 'CREDIT' 
              THEN ${Accounting.journal_entries.selectOptionColumns.amount} ELSE 0 END) AS TotalCredit,
        SUM(CASE WHEN ${Accounting.journal_entries.selectOptionColumns.type} = 'DEBIT'  
              THEN ${Accounting.journal_entries.selectOptionColumns.amount} ELSE 0 END) AS TotalDebit,
        SUM(CASE WHEN ${Accounting.journal_entries.selectOptionColumns.type} = 'CREDIT'
                  THEN ${Accounting.journal_entries.selectOptionColumns.amount} ELSE 0 END)
        - SUM(CASE WHEN ${Accounting.journal_entries.selectOptionColumns.type} = 'DEBIT'
                  THEN ${Accounting.journal_entries.selectOptionColumns.amount} ELSE 0 END) AS Current
      FROM ${Master.charts_of_accounts.tablename}
      LEFT JOIN ${Accounting.journal_entries.tablename}
        ON ${Accounting.journal_entries.selectOptionColumns.coa_id} = ${Master.charts_of_accounts.selectOptionColumns.id}
           ${dateFilter.replace(' AND ', '')}
      WHERE ${Master.charts_of_accounts.selectOptionColumns.status} = 'ACTIVE'
        AND (${Master.charts_of_accounts.selectOptionColumns.name} LIKE '%OCI%'
             OR ${Master.charts_of_accounts.selectOptionColumns.name} LIKE '%Revaluation%'
             OR ${Master.charts_of_accounts.selectOptionColumns.name} LIKE '%Unrealized%'
             OR ${Master.charts_of_accounts.selectOptionColumns.code} LIKE '35%')
      GROUP BY
        ${Master.charts_of_accounts.selectOptionColumns.id},
        ${Master.charts_of_accounts.selectOptionColumns.code},
        ${Master.charts_of_accounts.selectOptionColumns.name}
      ORDER BY
        ${Master.charts_of_accounts.selectOptionColumns.code}
    `

    const ociItems = await Query(oci_query, queryParams)
    const totalOCI = ociItems.reduce(
      (sum, item) => sum + parseFloat(item.Current || 0),
      0,
    )

    // Separate revenues into sales revenue and cost of sales
    const salesRevenue = revenues
      .filter(
        (item) =>
          !item['Account Name'].toLowerCase().includes('discount') &&
          !item['Account Name'].toLowerCase().includes('contra') &&
          !item['Account Name'].toLowerCase().includes('cost'),
      )
      .reduce((sum, item) => sum + parseFloat(item.Current || 0), 0)

    const costOfSales = revenues
      .filter(
        (item) =>
          item['Account Name'].toLowerCase().includes('cost') ||
          item['Account Name'].toLowerCase().includes('cost of'),
      )
      .reduce((sum, item) => sum + parseFloat(item.Current || 0), 0)

    const grossProfit = salesRevenue - Math.abs(costOfSales)

    // Calculate operating expenses separately
    const operatingExpenses = expenses.filter(
      (item) =>
        !item['Account Name'].toLowerCase().includes('other') &&
        !item['Account Name'].toLowerCase().includes('tax'),
    )

    const totalOperatingExpenses = operatingExpenses.reduce(
      (sum, item) => sum + parseFloat(item.Current || 0),
      0,
    )
    const operatingIncome = grossProfit - totalOperatingExpenses

    const totalComprehensiveIncome = netIncome + totalOCI

    res.status(200).json({
      success: true,
      message: 'Statement of Comprehensive Income retrieved successfully',
      data: {
        revenues: revenues,
        salesRevenue: salesRevenue,
        costOfSales: Math.abs(costOfSales),
        grossProfit: grossProfit,
        operatingExpenses: operatingExpenses,
        totalOperatingExpenses: totalOperatingExpenses,
        operatingIncome: operatingIncome,
        expenses: expenses,
        totalExpenses: totalExpenses,
        netIncome: netIncome,
        otherComprehensiveIncome: ociItems,
        totalOCI: totalOCI,
        totalComprehensiveIncome: totalComprehensiveIncome,
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error fetching statement of comprehensive income:', error)
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching statement of comprehensive income',
      error:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Internal server error',
    })
  }
}

const getBankReconciliation = async (req, res, next) => {
  try {
    const { start_date, end_date, bank_statement_balance } = req.query

    let dateFilter = ''
    if (start_date || end_date) {
      const conditions = []
      if (start_date)
        conditions.push(
          `${Accounting.journal_entries.selectOptionColumns.date} >= '${start_date}'`,
        )
      if (end_date)
        conditions.push(
          `${Accounting.journal_entries.selectOptionColumns.date} <= '${end_date}'`,
        )
      dateFilter = ` AND ${conditions.join(' AND ')}`
    }

    // Get Cash GL Balance (Account codes starting with 1010 are typically cash accounts)
    const cash_balance_query = `
      SELECT 
        ${Master.charts_of_accounts.selectOptionColumns.code} as 'Account Code',
        ${Master.charts_of_accounts.selectOptionColumns.name} as 'Account Name',
        SUM(CASE WHEN ${Accounting.journal_entries.selectOptionColumns.type} = 'DEBIT' 
              THEN ${Accounting.journal_entries.selectOptionColumns.amount} ELSE 0 END) -
        SUM(CASE WHEN ${Accounting.journal_entries.selectOptionColumns.type} = 'CREDIT' 
              THEN ${Accounting.journal_entries.selectOptionColumns.amount} ELSE 0 END) as Balance
      FROM ${Master.charts_of_accounts.tablename}
      LEFT JOIN ${Accounting.journal_entries.tablename}
        ON ${Accounting.journal_entries.selectOptionColumns.coa_id} = ${Master.charts_of_accounts.selectOptionColumns.id}
           ${dateFilter}
      WHERE ${Master.charts_of_accounts.selectOptionColumns.status} = 'ACTIVE'
        AND (${Master.charts_of_accounts.selectOptionColumns.code} LIKE '101%' OR ${Master.charts_of_accounts.selectOptionColumns.code} LIKE '102%')
      GROUP BY
        ${Master.charts_of_accounts.selectOptionColumns.id},
        ${Master.charts_of_accounts.selectOptionColumns.code},
        ${Master.charts_of_accounts.selectOptionColumns.name}
      ORDER BY ${Master.charts_of_accounts.selectOptionColumns.code}
    `

    const cashAccounts = await Query(cash_balance_query)
    const totalCashGL = cashAccounts.reduce(
      (sum, acc) => sum + parseFloat(acc.Balance || 0),
      0,
    )

    // Get Outstanding Checks (issued but not yet cleared)
    const outstanding_checks_query = `
      SELECT 
        ${Accounting.cash_disbursements.selectOptionColumns.id},
        ${Accounting.cash_disbursements.selectOptionColumns.document_reference} as 'Check Number',
        ${Accounting.cash_disbursements.selectOptionColumns.total_amount_due} as 'Amount',
        ${Accounting.cash_disbursements.selectOptionColumns.payment_date} as 'Date',
        ${Accounting.cash_disbursements.selectOptionColumns.state} as 'Status'
      FROM ${Accounting.cash_disbursements.tablename}
      WHERE ${Accounting.cash_disbursements.selectOptionColumns.state} IN ('PENDING', 'ISSUED')
        ${start_date ? `AND ${Accounting.cash_disbursements.selectOptionColumns.payment_date} >= '${start_date}'` : ''}
        ${end_date ? `AND ${Accounting.cash_disbursements.selectOptionColumns.payment_date} <= '${end_date}'` : ''}
      ORDER BY ${Accounting.cash_disbursements.selectOptionColumns.payment_date}
    `

    const outstandingChecks = await Query(outstanding_checks_query)
    const totalOutstandingChecks = outstandingChecks.reduce(
      (sum, check) => sum + parseFloat(check.Amount || 0),
      0,
    )

    // Get Deposits in Transit (recorded but not yet cleared)
    const deposits_in_transit_query = `
      SELECT 
        'Receipt' as type,
        ${Accounting.receipts.selectOptionColumns.id},
        ${Accounting.receipts.selectOptionColumns.document_reference} as 'Document Reference',
        ${Accounting.receipts.selectOptionColumns.total_amount_due} as 'Amount',
        ${Accounting.receipts.selectOptionColumns.collection_date} as 'Date',
        ${Accounting.receipts.selectOptionColumns.state} as 'Status'
      FROM ${Accounting.receipts.tablename}
      WHERE ${Accounting.receipts.selectOptionColumns.state} IN ('PENDING', 'PARTIALLY_CLEARED')
        ${start_date ? `AND ${Accounting.receipts.selectOptionColumns.collection_date} >= '${start_date}'` : ''}
        ${end_date ? `AND ${Accounting.receipts.selectOptionColumns.collection_date} <= '${end_date}'` : ''}
    `

    const depositsInTransit = await Query(deposits_in_transit_query)
    const totalDepositsInTransit = depositsInTransit.reduce(
      (sum, dep) => sum + parseFloat(dep.Amount || 0),
      0,
    )

    // Get Bank Adjustments from adjustments table (pending adjustments)
    const bank_adjustments_query = `
      SELECT 
        ${Accounting.adjustments.selectOptionColumns.id},
        ${Accounting.adjustments.selectOptionColumns.remarks} as 'Description',
        ${Accounting.adjustments.selectOptionColumns.document_reference} as 'Reference',
        ${Accounting.adjustments.selectOptionColumns.total_amount} as 'Amount',
        ${Accounting.adjustments.selectOptionColumns.posting_date} as 'Date',
        'ADJUSTMENT' as 'Type',
        ${Accounting.adjustments.selectOptionColumns.status} as 'Status'
      FROM ${Accounting.adjustments.tablename}
      WHERE ${Accounting.adjustments.selectOptionColumns.status} IN ('PENDING', 'APPROVED')
        ${start_date ? `AND ${Accounting.adjustments.selectOptionColumns.posting_date} >= '${start_date}'` : ''}
        ${end_date ? `AND ${Accounting.adjustments.selectOptionColumns.posting_date} <= '${end_date}'` : ''}
      ORDER BY ${Accounting.adjustments.selectOptionColumns.posting_date}
    `

    const bankAdjustments = await Query(bank_adjustments_query)
    const totalBankAdjustments = bankAdjustments.reduce(
      (sum, adj) => sum + parseFloat(adj.Amount || 0),
      0,
    )

    // Calculate reconciliation
    const bankStatementBalance = parseFloat(bank_statement_balance) || 0
    const adjustedCashGL =
      totalCashGL -
      totalOutstandingChecks +
      totalDepositsInTransit +
      totalBankAdjustments
    const difference = bankStatementBalance - adjustedCashGL

    res.status(200).json({
      success: true,
      message: 'Bank Reconciliation retrieved successfully',
      data: {
        summary: {
          cash_gl_balance: totalCashGL,
          bank_statement_balance: bankStatementBalance,
          adjusted_cash_balance: adjustedCashGL,
          difference: difference,
          is_reconciled: Math.abs(difference) < 0.01,
        },
        cash_accounts: cashAccounts,
        outstanding_checks: outstandingChecks,
        outstanding_checks_total: totalOutstandingChecks,
        deposits_in_transit: depositsInTransit,
        deposits_in_transit_total: totalDepositsInTransit,
        bank_adjustments: bankAdjustments,
        bank_adjustments_total: totalBankAdjustments,
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error fetching bank reconciliation:', error)
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching bank reconciliation',
      error:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Internal server error',
    })
  }
}

module.exports = {
  getTrialBalance,
  getIncomeStatement,
  getGeneralLedger,
  getBalanceSheet,
  getSearch,
  getStatementOfComprehensiveIncome,
  getBankReconciliation,
}
