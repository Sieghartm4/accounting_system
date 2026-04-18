const os = require('os')
const { checkConnection, SelectAll, Transaction, Query, Insert } = require('../database/util/queries.util')
const { formatMemoryUsage, formatTime, DataModeling } = require('../util/helper.util')
const { Master } = require('../database/model/Master')
const { Accounting } = require('../database/model/Accounting')
const { SQLQueryBuilder } = require('../util/helper.util')
const sql = new SQLQueryBuilder()
const mysql = require('mysql2/promise')
const CONFIG = require('../database/config/config')

const pool = mysql.createPool({
  host: CONFIG[process.env.NODE_ENV].host,
  user: CONFIG[process.env.NODE_ENV].username,
  password: CONFIG[process.env.NODE_ENV].password,
  database: CONFIG[process.env.NODE_ENV].database,
  multipleStatements: CONFIG[process.env.NODE_ENV].dialectOptions.multipleStatements,
})
require('dotenv').config()

// TRIAL BALANCE
const getTrialBalance = async (req, res, next) => {
  try {
    const { start_date, end_date } = req.query;
    
    let dateFilter = '';
    if (start_date || end_date) {
      const conditions = [];
      if (start_date) conditions.push(`${Accounting.journal_entries.selectOptionColumns.date} >= '${start_date}'`);
      if (end_date) conditions.push(`${Accounting.journal_entries.selectOptionColumns.date} <= '${end_date}'`);
      dateFilter = ` AND ${conditions.join(' AND ')}`;
    }

    const trial_balance_query = `SELECT ${Master.charts_of_accounts.selectOptionColumns.code} as 'Account Code', ${Master.charts_of_accounts.selectOptionColumns.name} as 'Account Name', SUM(CASE WHEN ${Accounting.journal_entries.selectOptionColumns.type} = 'DEBIT' THEN ${Accounting.journal_entries.selectOptionColumns.amount} ELSE 0 END) as DEBIT, SUM(CASE WHEN ${Accounting.journal_entries.selectOptionColumns.type} = 'CREDIT' THEN ${Accounting.journal_entries.selectOptionColumns.amount} ELSE 0 END) as CREDIT FROM ${Master.charts_of_accounts.tablename} LEFT JOIN ${Accounting.journal_entries.tablename} ON ${Accounting.journal_entries.selectOptionColumns.coa_id} = ${Master.charts_of_accounts.selectOptionColumns.id} WHERE ${Master.charts_of_accounts.selectOptionColumns.status} = 'ACTIVE'${dateFilter} GROUP BY ${Master.charts_of_accounts.selectOptionColumns.id}, ${Master.charts_of_accounts.selectOptionColumns.code}, ${Master.charts_of_accounts.selectOptionColumns.name} ORDER BY ${Master.charts_of_accounts.selectOptionColumns.code}`

    const trialBalance = await Query(trial_balance_query);
    
    res.status(200).json({
      success: true,
      message: 'Trial Balance retrieved successfully',
      data: trialBalance,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error fetching trial balance:', error)
    return res.status(500).json({ 
      success: false,
      message: 'Server error while fetching trial balance',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    })
  }
}

// INCOME STATEMENT
const getIncomeStatement = async (req, res, next) => {
  try {
    const { start_date, end_date } = req.query;
    
    let dateFilter = '';
    if (start_date || end_date) {
      const conditions = [];
      if (start_date) conditions.push(`${Accounting.journal_entries.selectOptionColumns.date} >= '${start_date}'`);
      if (end_date) conditions.push(`${Accounting.journal_entries.selectOptionColumns.date} <= '${end_date}'`);
      dateFilter = ` AND ${conditions.join(' AND ')}`;
    }

    const income_statement_query = `SELECT ${Master.charts_of_accounts.selectOptionColumns.code} as 'Account Code', ${Master.charts_of_accounts.selectOptionColumns.name} as 'Account Name', SUM(CASE WHEN ${Accounting.journal_entries.selectOptionColumns.type} = 'DEBIT' THEN ${Accounting.journal_entries.selectOptionColumns.amount} ELSE 0 END) as Current FROM ${Master.charts_of_accounts.tablename} LEFT JOIN ${Accounting.journal_entries.tablename} ON ${Accounting.journal_entries.selectOptionColumns.coa_id} = ${Master.charts_of_accounts.selectOptionColumns.id} WHERE ${Master.charts_of_accounts.selectOptionColumns.status} = 'ACTIVE' AND ${Master.charts_of_accounts.selectOptionColumns.type} IN ('REVENUE', 'EXPENSES')${dateFilter} GROUP BY ${Master.charts_of_accounts.selectOptionColumns.id}, ${Master.charts_of_accounts.selectOptionColumns.code}, ${Master.charts_of_accounts.selectOptionColumns.name}, ${Master.charts_of_accounts.selectOptionColumns.type} ORDER BY ${Master.charts_of_accounts.selectOptionColumns.type}, ${Master.charts_of_accounts.selectOptionColumns.code}`

    const incomeStatement = await Query(income_statement_query);
    
    const revenues = incomeStatement.filter(item => 
      item['Account Code'].startsWith('400') || item['Account Code'].startsWith('500') && item['Account Code'] === '500-1200'
    )
    const expenses = incomeStatement.filter(item => 
      item['Account Code'].startsWith('500') && item['Account Code'] !== '500-1200'
    )
    
    const totalRevenues = revenues.reduce((sum, item) => sum + parseFloat(item.Current || 0), 0)
    const totalExpenses = expenses.reduce((sum, item) => sum + parseFloat(item.Current || 0), 0)
    const netIncome = totalRevenues - totalExpenses
    console.log(expenses)
    res.status(200).json({
      success: true,
      message: 'Income Statement retrieved successfully',
      data: {
        revenues: revenues,
        expenses: expenses,
        totalRevenues: totalRevenues,
        totalExpenses: totalExpenses,
        netIncome: netIncome
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error fetching income statement:', error)
    return res.status(500).json({ 
      success: false,
      message: 'Server error while fetching income statement',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    })
  }
}

// GENERAL LEDGER
const getGeneralLedger = async (req, res, next) => {
  try {
    const { start_date, end_date } = req.query;
    
    let dateFilter = '';
    if (start_date || end_date) {
      const conditions = [];
      if (start_date) conditions.push(`${Accounting.journal_entries.selectOptionColumns.date} >= '${start_date}'`);
      if (end_date) conditions.push(`${Accounting.journal_entries.selectOptionColumns.date} <= '${end_date}'`);
      dateFilter = ` WHERE ${conditions.join(' AND ')}`;
    }

    const general_ledger_query = `SELECT ROW_NUMBER() OVER (ORDER BY ${Accounting.journal_entries.selectOptionColumns.date}) as 'Trans. No.', ${Accounting.journal_entries.selectOptionColumns.db_name} as 'Vendor / Customer', ${Accounting.journal_entries.selectOptionColumns.date} as 'Posted Date', ${Accounting.journal_entries.selectOptionColumns.db_id} as 'Doc Ref', SUM(CASE WHEN ${Accounting.journal_entries.selectOptionColumns.type} = 'DEBIT' THEN ${Accounting.journal_entries.selectOptionColumns.amount} ELSE 0 END) as Debit, SUM(CASE WHEN ${Accounting.journal_entries.selectOptionColumns.type} = 'CREDIT' THEN ${Accounting.journal_entries.selectOptionColumns.amount} ELSE 0 END) as Credit, ${Accounting.journal_entries.selectOptionColumns.responsibility_center} as 'Responsibility Center' FROM ${Accounting.journal_entries.tablename}${dateFilter} GROUP BY ${Accounting.journal_entries.selectOptionColumns.id}, ${Accounting.journal_entries.selectOptionColumns.db_name}, ${Accounting.journal_entries.selectOptionColumns.date}, ${Accounting.journal_entries.selectOptionColumns.db_id}, ${Accounting.journal_entries.selectOptionColumns.responsibility_center}, ${Accounting.journal_entries.selectOptionColumns.type} ORDER BY ${Accounting.journal_entries.selectOptionColumns.date}`

    const generalLedger = await Query(general_ledger_query);
    
    res.status(200).json({
      success: true,
      message: 'General Ledger retrieved successfully',
      data: generalLedger,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error fetching general ledger:', error)
    return res.status(500).json({ 
      success: false,
      message: 'Server error while fetching general ledger',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    })
  }
}

// BALANCE SHEET
const getBalanceSheet = async (req, res, next) => {
  try {
    const { start_date, end_date } = req.query;
    
    let dateFilter = '';
    if (start_date || end_date) {
      const conditions = [];
      if (start_date) conditions.push(`${Accounting.journal_entries.selectOptionColumns.date} >= '${start_date}'`);
      if (end_date) conditions.push(`${Accounting.journal_entries.selectOptionColumns.date} <= '${end_date}'`);
      dateFilter = ` AND ${conditions.join(' AND ')}`;
    }

    const balance_sheet_query = `SELECT ${Master.charts_of_accounts.selectOptionColumns.code} as 'Account Code', ${Master.charts_of_accounts.selectOptionColumns.name} as 'Account Name', SUM(CASE WHEN ${Accounting.journal_entries.selectOptionColumns.type} = 'DEBIT' THEN ${Accounting.journal_entries.selectOptionColumns.amount} ELSE 0 END) - SUM(CASE WHEN ${Accounting.journal_entries.selectOptionColumns.type} = 'CREDIT' THEN ${Accounting.journal_entries.selectOptionColumns.amount} ELSE 0 END) as Current FROM ${Master.charts_of_accounts.tablename} LEFT JOIN ${Accounting.journal_entries.tablename} ON ${Accounting.journal_entries.selectOptionColumns.coa_id} = ${Master.charts_of_accounts.selectOptionColumns.id} WHERE ${Master.charts_of_accounts.selectOptionColumns.status} = 'ACTIVE' AND ${Master.charts_of_accounts.selectOptionColumns.type} IN ('ASSETS', 'LIABILITIES', 'EQUITY')${dateFilter} GROUP BY ${Master.charts_of_accounts.selectOptionColumns.id}, ${Master.charts_of_accounts.selectOptionColumns.code}, ${Master.charts_of_accounts.selectOptionColumns.name}, ${Master.charts_of_accounts.selectOptionColumns.type} ORDER BY ${Master.charts_of_accounts.selectOptionColumns.type}, ${Master.charts_of_accounts.selectOptionColumns.code}`

    const balanceSheet = await Query(balance_sheet_query);
    
    // Separate by type
    const assets = balanceSheet.filter(item => item['Account Code'].startsWith('100'))
    const liabilities = balanceSheet.filter(item => item['Account Code'].startsWith('200'))
    const equity = balanceSheet.filter(item => item['Account Code'].startsWith('300'))
    
    const totalAssets = assets.reduce((sum, item) => sum + parseFloat(item.Current || 0), 0)
    const totalLiabilities = liabilities.reduce((sum, item) => sum + parseFloat(item.Current || 0), 0)
    const totalEquity = equity.reduce((sum, item) => sum + parseFloat(item.Current || 0), 0)
    
    res.status(200).json({
      success: true,
      message: 'Balance Sheet retrieved successfully',
      data: {
        assets: assets,
        liabilities: liabilities,
        equity: equity,
        totalAssets: totalAssets,
        totalLiabilities: totalLiabilities,
        totalEquity: totalEquity,
        totalLiabilitiesAndEquity: totalLiabilities + totalEquity
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error fetching balance sheet:', error)
    return res.status(500).json({ 
      success: false,
      message: 'Server error while fetching balance sheet',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    })
  }
}

module.exports = {
  getTrialBalance,
  getIncomeStatement,
  getGeneralLedger,
  getBalanceSheet
}
