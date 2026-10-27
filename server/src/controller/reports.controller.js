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
// Used to narrow /search to the modules the tenant's plan actually includes.
const {
  resolveEntitlement,
} = require('../services/entitlement/entitlement.service')
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
        ${approvalFilter}
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
        ${approvalFilter}
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
    })
  }
}

const getCashFlowStatement = async (req, res, next) => {
  // Direct-method cash flow statement.
  //
  // Every approved journal document that touches a cash/bank account is read
  // with ALL of its lines (cash lines + counter lines). Cash-family lines give
  // the real movement of cash; the document's counter lines explain where that
  // money came from / went to and classify the flow:
  //
  //   OPERATING (default) - revenue/expense/working-capital counter accounts
  //   INVESTING           - purchase/disposal of equipment & noncurrent assets
  //   FINANCING           - equity and loan / advance-from accounts
  //   INTERNAL            - cash-to-cash transfers (excluded from totals)
  //
  // Because flows come from actual journal lines, contra or credit-balanced
  // expense accounts cannot distort rows, and openingCash + netChange ties
  // back to closingCash (the trial balance of the cash family at period end).
  try {
    const { start_date, end_date } = req.query

    const je = Accounting.journal_entries.selectOptionColumns
    const coa = Master.charts_of_accounts.selectOptionColumns
    const round2 = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100

    // Source documents that carry the finance date of their journals.
    // (adjustments is approved via status; every other module uses state.)
    const DOC_SOURCES = [
      ['receipts', Accounting.receipts, 'collection_date'],
      ['cash_disbursements', Accounting.cash_disbursements, 'payment_date'],
      ['sales', Accounting.sales, 'date_delivered'],
      ['collections', Accounting.collections, 'collection_date'],
      ['purchase', Accounting.purchase, 'date_delivered'],
      ['payments', Accounting.payments, 'payment_date'],
      ['adjustments', Accounting.adjustments, 'posting_date'],
    ]

    const docDateCondition = (op) =>
      '(' +
      DOC_SOURCES.map(
        ([dbName, model, dateKey]) => `(${je.db_name} = '${dbName}' AND EXISTS (
              SELECT 1 FROM ${model.tablename} d
              WHERE d.${model.selectOptionColumns.id} = ${je.db_id}
                AND d.${model.selectOptionColumns[dateKey]} ${op} ?))`,
      ).join(' OR ') +
      ')'

    const docApprovalCondition = () =>
      '(' +
      DOC_SOURCES.map(
        ([dbName, model]) => `(${je.db_name} = '${dbName}' AND EXISTS (
              SELECT 1 FROM ${model.tablename} d
              WHERE d.${model.selectOptionColumns.id} = ${je.db_id}
                AND d.${
                  model.selectOptionColumns[
                    dbName === 'adjustments' ? 'status' : 'state'
                  ]
                } = 'APPROVED'))`,
      ).join(' OR ') +
      ')'

    // ── 1. Identify the cash/bank account family ──
    const cashAccounts = await Query(
      `SELECT ${coa.id} AS id, ${coa.code} AS code, ${coa.name} AS name
         FROM ${Master.charts_of_accounts.tablename}
        WHERE ${coa.status} = 'ACTIVE'
          AND ${coa.type} = 'ASSETS'
          AND (LOWER(${coa.name}) LIKE '%cash%' OR LOWER(${coa.name}) LIKE '%bank%')
        ORDER BY ${coa.code}`
    )

    const emptySection = { rows: [], totalInflows: 0, totalOutflows: 0, net: 0 }
    const emptyData = {
      openingCash: 0,
      closingCash: 0,
      netChange: 0,
      operating: emptySection,
      investing: emptySection,
      financing: emptySection,
      internalTransfers: { rows: [], total: 0 },
      cashAccounts: [],
    }

    if (!cashAccounts || cashAccounts.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'Cash Flow Statement retrieved successfully',
        data: emptyData,
        timestamp: new Date().toISOString(),
      })
    }

    const cashIdSet = new Set(cashAccounts.map((a) => Number(a.id)))
    const cashIds = cashAccounts.map((a) => a.id)

    // ── 2. Opening cash balance (cash-family movement before start_date) ──
    let openingCash = 0
    if (start_date) {
      const openingSql = `
        SELECT COALESCE(SUM(CASE WHEN je.${je.type} = 'DEBIT'
                                  THEN je.${je.amount}
                                  ELSE -je.${je.amount} END), 0) AS net
          FROM ${Accounting.journal_entries.tablename} je
         WHERE je.${je.coa_id} IN (?)
           AND (${docDateCondition('<')})
           AND (${docApprovalCondition()})
      `
      const openingRows = await Query(openingSql, [
        cashIds,
        ...DOC_SOURCES.map(() => start_date),
      ])
      openingCash = parseFloat(openingRows?.[0]?.net) || 0
    }

    // ── 3. All lines of documents that touch cash in the period ──
    let linesSql = `
      SELECT je.${je.db_name} AS db_name,
             je.${je.db_id} AS db_id,
             je.${je.coa_id} AS coa_id,
             je.${je.type} AS entry_type,
             je.${je.amount} AS amount,
             ${coa.code} AS code,
             ${coa.name} AS name,
             ${coa.type} AS coa_type
        FROM ${Accounting.journal_entries.tablename} je
        JOIN ${Master.charts_of_accounts.tablename}
          ON ${coa.id} = je.${je.coa_id}
       WHERE je.${je.db_name} IS NOT NULL
         AND je.${je.db_id} IS NOT NULL
         AND je.${je.coa_id} IS NOT NULL
         AND EXISTS (
           SELECT 1 FROM ${Accounting.journal_entries.tablename} je2
            WHERE je2.${je.db_name} = je.${je.db_name}
              AND je2.${je.db_id} = je.${je.db_id}
              AND je2.${je.coa_id} IN (?))
    `
    const lineParams = [cashIds]
    if (start_date) {
      linesSql += `\n  AND (${docDateCondition('>=')})`
      lineParams.push(...DOC_SOURCES.map(() => start_date))
    }
    if (end_date) {
      linesSql += `\n  AND (${docDateCondition('<=')})`
      lineParams.push(...DOC_SOURCES.map(() => end_date))
    }
    linesSql += `\n  AND (${docApprovalCondition()})`

    const lines = await Query(linesSql, lineParams)

    // Lookup for classification + row labels
    const coaInfo = new Map()
    for (const line of lines || []) {
      const id = Number(line.coa_id)
      if (!coaInfo.has(id)) {
        coaInfo.set(id, { code: line.code, name: line.name, type: line.coa_type })
      }
    }

    // ── 4. Classification ──
    const investingTerms = [
      'office equipment',
      'tools and equipment',
      'furniture and fixtures',
      'transportation equipment',
      'accumulated depreciation',
      'building',
      'land',
      'noncurrent asset',
    ]
    const financingTerms = [
      'loan',
      'borrowings',
      'notes payable',
      'advances from',
      'retained earnings',
      'noncurrent liability',
    ]

    const classifyCounter = (info, coaId) => {
      if (cashIdSet.has(Number(coaId))) return 'INTERNAL'
      if (info && info.type === 'EQUITY') return 'FINANCING'
      const name = String(info?.name || '').toLowerCase()
      if (financingTerms.some((term) => name.includes(term))) return 'FINANCING'
      if (investingTerms.some((term) => name.includes(term))) return 'INVESTING'
      return 'OPERATING'
    }

    // ── 5. Group lines per document, then attribute cash flow per counter ──
    const sections = {
      OPERATING: new Map(),
      INVESTING: new Map(),
      FINANCING: new Map(),
      INTERNAL: new Map(),
    }

    const docs = new Map()
    for (const line of lines || []) {
      const docKey = `${line.db_name}:${line.db_id}`
      let doc = docs.get(docKey)
      if (!doc) {
        doc = { cashNet: 0, counters: new Map(), cashByCoa: new Map() }
        docs.set(docKey, doc)
      }
      const value = parseFloat(line.amount) || 0
      const signed = line.entry_type === 'DEBIT' ? value : -value
      const coaId = Number(line.coa_id)
      if (cashIdSet.has(coaId)) {
        doc.cashNet += signed
        doc.cashByCoa.set(coaId, (doc.cashByCoa.get(coaId) || 0) + signed)
      } else {
        doc.counters.set(coaId, (doc.counters.get(coaId) || 0) + signed)
      }
    }

    for (const doc of docs.values()) {
      // Pure cash-to-cash transfer (deposit, withdrawal, top-up made by moving
      // money between cash/bank accounts): at least two distinct cash accounts,
      // no non-cash counter lines. Emit per-account movements under INTERNAL.
      if (doc.counters.size === 0 && doc.cashByCoa.size >= 2) {
        for (const [rowCoaId, cashSigned] of doc.cashByCoa) {
          if (Math.abs(cashSigned) <= 0.005) continue
          const info = coaInfo.get(rowCoaId)
          let row = sections.INTERNAL.get(rowCoaId)
          if (!row) {
            row = {
              code: info?.code || '',
              name: info?.name || 'Unknown account',
              inflow: 0,
              outflow: 0,
            }
            sections.INTERNAL.set(rowCoaId, row)
          }
          if (cashSigned >= 0) row.inflow += cashSigned
          else row.outflow += -cashSigned
        }
        continue
      }

      let explained = 0
      for (const [rowCoaId, counterNet] of doc.counters) {
        // Cash change attributed to this counter account
        const cashDelta = -counterNet
        explained += cashDelta

        const info = coaInfo.get(rowCoaId)
        const section = classifyCounter(info, rowCoaId)
        let row = sections[section].get(rowCoaId)
        if (!row) {
          row = {
            code: info?.code || '',
            name: info?.name || 'Unknown account',
            inflow: 0,
            outflow: 0,
          }
          sections[section].set(rowCoaId, row)
        }
        if (cashDelta >= 0) row.inflow += cashDelta
        else row.outflow += -cashDelta
      }

      // Malformed/partial documents: attribute the leftover to Operating.
      const residual = doc.cashNet - explained
      if (Math.abs(residual) > 0.005) {
        let residualRow = sections.OPERATING.get('RESIDUAL')
        if (!residualRow) {
          residualRow = {
            code: '',
            name: 'Other cash movements (unclassified)',
            inflow: 0,
            outflow: 0,
          }
          sections.OPERATING.set('RESIDUAL', residualRow)
        }
        if (residual >= 0) residualRow.inflow += residual
        else residualRow.outflow += -residual
      }
    }

    // ── 6. Build response sections ──
    const buildSection = (map) => {
      const rows = [...map.values()]
        .filter((row) => round2(row.inflow + row.outflow) !== 0)
        .map((row) => ({
          code: row.code,
          name: row.name,
          inflow: round2(row.inflow),
          outflow: round2(row.outflow),
          net: round2(row.inflow - row.outflow),
        }))
        .sort((a, b) => String(a.code).localeCompare(String(b.code)))

      const totalInflows = round2(rows.reduce((sum, r) => sum + r.inflow, 0))
      const totalOutflows = round2(rows.reduce((sum, r) => sum + r.outflow, 0))
      return { rows, totalInflows, totalOutflows, net: round2(totalInflows - totalOutflows) }
    }

    const operating = buildSection(sections.OPERATING)
    const investing = buildSection(sections.INVESTING)
    const financing = buildSection(sections.FINANCING)
    const internal = buildSection(sections.INTERNAL)

    const netChange = round2(operating.net + investing.net + financing.net)
    const closingCash = round2(openingCash + netChange)

    // ── 7. Canonical captions (BASIC view / DIRECT caption grouping) ──
    const typeByCode = new Map()
    for (const info of coaInfo.values()) typeByCode.set(info.code, info.type)
    const lower = (text) => String(text || '').toLowerCase()

    const CAP_OTHER_OPERATING = 'Other operating cash movements'
    const canonicalOperatingCaption = (row) => {
      const name = lower(row.name)
      const type = typeByCode.get(row.code) || ''
      if (row.name === 'Other cash movements (unclassified)') return CAP_OTHER_OPERATING
      if (/contra|discount/.test(name)) return CAP_OTHER_OPERATING
      if (type === 'REVENUE' || name.includes('receivable'))
        return 'Cash collections from customers'
      if (/(salaries|wages|payroll|compensation|13th|bonus|hazard pay|overtime)/.test(name))
        return 'Cash paid to and benefits paid on behalf of employees'
      if (name.includes('interest')) return 'Interest paid'
      if (/(tax|permit|duty|levy|license|licensing)/.test(name)) return 'Taxes and licenses paid'
      if (
        /(rent|lease|utilities|utility|supplies|fuel|gasoline|diesel|oil|insurance|freight|shipping|repairs and maintenance|professional fees|legal|audit|consulting|advertising|marketing|promotion|subscriptions|memberships|bank charges|service charge|delivery|courier|commission|meals|representation|communications|telephone|internet|electricity|water bill|printing|photocopy|travel|parking|toll)/.test(
          name,
        ) ||
        type === 'EXPENSES'
      )
        return 'Cash paid to suppliers and for services'
      return CAP_OTHER_OPERATING
    }

    const CAP_INVEST_IN = 'Purchase of long-term assets and investments'
    const CAP_INVEST_OUT = 'Cash proceeds from sale of long-term assets and investments'
    const canonicalInvestingCaption = (row) =>
      row.net >= 0 ? CAP_INVEST_OUT : CAP_INVEST_IN

    const CAP_FIN_EQUITY_IN = "Owner's capital contributions"
    const CAP_FIN_EQUITY_OUT = "Owner's withdrawals and dividends paid"
    const CAP_FIN_DEBT_IN = 'Proceeds from long-term debt and borrowings'
    const CAP_FIN_DEBT_OUT = 'Repayments of long-term debt'
    const canonicalFinancingCaption = (row) => {
      const isEquity = (typeByCode.get(row.code) || '') === 'EQUITY'
      if (row.net >= 0) return isEquity ? CAP_FIN_EQUITY_IN : CAP_FIN_DEBT_IN
      return isEquity ? CAP_FIN_EQUITY_OUT : CAP_FIN_DEBT_OUT
    }

    const buildCaptions = (sectionRows, captionFn) => {
      const map = new Map()
      for (const row of sectionRows) {
        const caption = captionFn(row)
        let group = map.get(caption)
        if (!group) {
          group = { caption, rows: [], totalInflows: 0, totalOutflows: 0, net: 0 }
          map.set(caption, group)
        }
        group.rows.push(row)
        group.totalInflows = round2(group.totalInflows + row.inflow)
        group.totalOutflows = round2(group.totalOutflows + row.outflow)
        group.net = round2(group.net + row.net)
      }
      return [...map.values()]
    }

    const captions = {
      operating: buildCaptions(operating.rows, canonicalOperatingCaption),
      investing: buildCaptions(investing.rows, canonicalInvestingCaption),
      financing: buildCaptions(financing.rows, canonicalFinancingCaption),
    }

    // ── 8. Indirect-method operating figures (net income → cash flows) ──
    // Net income needs ALL approved documents of the period (cash-touching or
    // not), while working-capital movements read cumulative account balances
    // just before start and at period end.
    const indirect = {
      netIncome: 0,
      addBacks: [],
      workingCapital: [],
      operatingNet: 0,
    }
    if (start_date && end_date) {
      const periodBothCondition = `${docDateCondition('>=')} AND ${docDateCondition('<=')}`

      const niSql = `
        SELECT
          COALESCE(SUM(CASE WHEN c.${coa.type} = 'REVENUE' THEN pc.net ELSE 0 END), 0) AS revenueNet,
          COALESCE(SUM(CASE WHEN c.${coa.type} = 'EXPENSES' AND LOWER(c.${coa.name}) LIKE '%depreciation%' THEN pc.net ELSE 0 END), 0) AS depreciationNet,
          COALESCE(SUM(CASE WHEN c.${coa.type} = 'EXPENSES' AND LOWER(c.${coa.name}) LIKE '%amortization%' THEN pc.net ELSE 0 END), 0) AS amortizationNet,
          COALESCE(SUM(CASE WHEN c.${coa.type} = 'EXPENSES' AND LOWER(c.${coa.name}) NOT LIKE '%depreciation%' AND LOWER(c.${coa.name}) NOT LIKE '%amortization%' THEN pc.net ELSE 0 END), 0) AS otherExpenseNet
          FROM (
            SELECT j.${je.coa_id} AS coa_id,
                   SUM(CASE WHEN j.${je.type} = 'DEBIT' THEN j.${je.amount} ELSE -j.${je.amount} END) AS net
              FROM ${Accounting.journal_entries.tablename} j
             WHERE ${periodBothCondition}
               AND (${docApprovalCondition()})
             GROUP BY j.${je.coa_id}
          ) pc
          JOIN ${Master.charts_of_accounts.tablename} c ON c.${coa.id} = pc.coa_id
         WHERE c.${coa.type} IN ('REVENUE', 'EXPENSES')
      `
      const niRows = await Query(niSql, [
        ...DOC_SOURCES.map(() => start_date),
        ...DOC_SOURCES.map(() => end_date),
      ])
      const revenueNet = parseFloat(niRows?.[0]?.revenueNet || 0)
      const depreciationNet = parseFloat(niRows?.[0]?.depreciationNet || 0)
      const amortizationNet = parseFloat(niRows?.[0]?.amortizationNet || 0)
      const otherExpenseNet = parseFloat(niRows?.[0]?.otherExpenseNet || 0)

      // Stored sign convention: revenue credits make revenueNet negative.
      const netIncome = round2(-revenueNet - (depreciationNet + amortizationNet + otherExpenseNet))
      indirect.netIncome = netIncome
      if (depreciationNet > 0.005)
        indirect.addBacks.push({ label: 'Add back: Depreciation', amount: round2(depreciationNet) })
      if (amortizationNet > 0.005)
        indirect.addBacks.push({ label: 'Add back: Amortization', amount: round2(amortizationNet) })

      const balanceGroupsSql = (op) => `
        SELECT
          COALESCE(SUM(CASE WHEN LOWER(c.${coa.name}) LIKE '%receivable%' THEN t.net ELSE 0 END), 0) AS receivables,
          COALESCE(SUM(CASE WHEN LOWER(c.${coa.name}) LIKE '%inventory%' THEN t.net ELSE 0 END), 0) AS inventories,
          COALESCE(SUM(CASE WHEN LOWER(c.${coa.name}) LIKE '%prepaid%' THEN t.net ELSE 0 END), 0) AS prepaid,
          COALESCE(SUM(CASE WHEN c.${coa.type} = 'LIABILITIES'
                             AND (LOWER(c.${coa.name}) LIKE '%payable%' OR LOWER(c.${coa.name}) LIKE '%accrued%')
                             AND LOWER(c.${coa.name}) NOT LIKE '%loan%'
                             AND LOWER(c.${coa.name}) NOT LIKE '%notes payable%'
                             AND LOWER(c.${coa.name}) NOT LIKE '%noncurrent%'
                           THEN t.net ELSE 0 END), 0) AS payables
          FROM (
            SELECT j.${je.coa_id} AS coa_id,
                   SUM(CASE WHEN j.${je.type} = 'DEBIT' THEN j.${je.amount} ELSE -j.${je.amount} END) AS net
              FROM ${Accounting.journal_entries.tablename} j
             WHERE ${docDateCondition(op)}
               AND (${docApprovalCondition()})
             GROUP BY j.${je.coa_id}
          ) t
          JOIN ${Master.charts_of_accounts.tablename} c ON c.${coa.id} = t.coa_id
      `

      const [startBalances, endBalances] = await Promise.all([
        Query(balanceGroupsSql('<'), DOC_SOURCES.map(() => start_date)),
        Query(balanceGroupsSql('<='), DOC_SOURCES.map(() => end_date)),
      ])

      // Sign convention for working-capital rows: a source of cash is positive.
      // Assets growing = cash out (negative), liabilities growing = cash in (positive).
      const wcGroups = [
        { key: 'receivables', label: 'Trade receivables', assetLike: true },
        { key: 'inventories', label: 'Inventories', assetLike: true },
        { key: 'prepaid', label: 'Prepaid expenses', assetLike: true },
        { key: 'payables', label: 'Trade and accrued payables', assetLike: false },
      ]
      for (const g of wcGroups) {
        const startVal = parseFloat(startBalances?.[0]?.[g.key] || 0)
        const endVal = parseFloat(endBalances?.[0]?.[g.key] || 0)
        // Account-net sign convention: asset debits positive, liability credits
        // negative. effect = -(end - start) works for both via signed deltas.
        const effect = round2(-(endVal - startVal))
        if (Math.abs(effect) > 0.005) {
          indirect.workingCapital.push({
            label: `Changes in ${g.label.toLowerCase()}`,
            amount: effect,
          })
        }
      }

      indirect.operatingNet = round2(
        netIncome +
          indirect.addBacks.reduce((sum, item) => sum + item.amount, 0) +
          indirect.workingCapital.reduce((sum, item) => sum + item.amount, 0),
      )
    }

    res.status(200).json({
      success: true,
      message: 'Cash Flow Statement retrieved successfully',
      data: {
        openingCash: round2(openingCash),
        closingCash,
        netChange,
        operating,
        investing,
        financing,
        captions,
        indirect,
        internalTransfers: { rows: internal.rows, total: internal.net },
        cashAccounts: cashAccounts.map((a) => ({ code: a.code, name: a.name })),
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error fetching cash flow statement:', error)
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching cash flow statement',
    })
  }
}


const getGeneralLedger = async (req, res, next) => {
  try {
    const { start_date, end_date, account_code, amount, type } = req.query

    let startDate = start_date
    let endDate = end_date

    // Only set default dates if no dates AND no filter parameters are provided
    if (!start_date && !end_date && !account_code && !amount && !type) {
      const now = new Date()
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      startDate = firstDay.toISOString().split('T')[0]
      endDate = lastDay.toISOString().split('T')[0]
    }

    let dateFilter = ''
    const whereConditions = []
    if (startDate || endDate) {
      const conditions = []
      if (startDate) {
        conditions.push(`
          (
            (${Accounting.journal_entries.selectOptionColumns.db_name} = 'receipts' AND EXISTS (
              SELECT 1 FROM ${Accounting.receipts.tablename} r
              WHERE r.${Accounting.receipts.selectOptionColumns.id} = ${Accounting.journal_entries.selectOptionColumns.db_id}
              AND r.${Accounting.receipts.selectOptionColumns.collection_date} >= '${startDate}'
            ))
            OR (${Accounting.journal_entries.selectOptionColumns.db_name} = 'cash_disbursements' AND EXISTS (
              SELECT 1 FROM ${Accounting.cash_disbursements.tablename} cd
              WHERE cd.${Accounting.cash_disbursements.selectOptionColumns.id} = ${Accounting.journal_entries.selectOptionColumns.db_id}
              AND cd.${Accounting.cash_disbursements.selectOptionColumns.payment_date} >= '${startDate}'
            ))
            OR (${Accounting.journal_entries.selectOptionColumns.db_name} = 'sales' AND EXISTS (
              SELECT 1 FROM ${Accounting.sales.tablename} s
              WHERE s.${Accounting.sales.selectOptionColumns.id} = ${Accounting.journal_entries.selectOptionColumns.db_id}
              AND s.${Accounting.sales.selectOptionColumns.date_delivered} >= '${startDate}'
            ))
            OR (${Accounting.journal_entries.selectOptionColumns.db_name} = 'collections' AND EXISTS (
              SELECT 1 FROM ${Accounting.collections.tablename} c
              WHERE c.${Accounting.collections.selectOptionColumns.id} = ${Accounting.journal_entries.selectOptionColumns.db_id}
              AND c.${Accounting.collections.selectOptionColumns.collection_date} >= '${startDate}'
            ))
            OR (${Accounting.journal_entries.selectOptionColumns.db_name} = 'purchase' AND EXISTS (
              SELECT 1 FROM ${Accounting.purchase.tablename} p
              WHERE p.${Accounting.purchase.selectOptionColumns.id} = ${Accounting.journal_entries.selectOptionColumns.db_id}
              AND p.${Accounting.purchase.selectOptionColumns.date_delivered} >= '${startDate}'
            ))
            OR (${Accounting.journal_entries.selectOptionColumns.db_name} = 'payments' AND EXISTS (
              SELECT 1 FROM ${Accounting.payments.tablename} pay
              WHERE pay.${Accounting.payments.selectOptionColumns.id} = ${Accounting.journal_entries.selectOptionColumns.db_id}
              AND pay.${Accounting.payments.selectOptionColumns.payment_date} >= '${startDate}'
            ))
            OR (${Accounting.journal_entries.selectOptionColumns.db_name} = 'adjustments' AND EXISTS (
              SELECT 1 FROM ${Accounting.adjustments.tablename} a
              WHERE a.${Accounting.adjustments.selectOptionColumns.id} = ${Accounting.journal_entries.selectOptionColumns.db_id}
              AND a.${Accounting.adjustments.selectOptionColumns.posting_date} >= '${startDate}'
            ))
          )
        `)
      }
      if (endDate) {
        conditions.push(`
          (
            (${Accounting.journal_entries.selectOptionColumns.db_name} = 'receipts' AND EXISTS (
              SELECT 1 FROM ${Accounting.receipts.tablename} r
              WHERE r.${Accounting.receipts.selectOptionColumns.id} = ${Accounting.journal_entries.selectOptionColumns.db_id}
              AND r.${Accounting.receipts.selectOptionColumns.collection_date} <= '${endDate}'
            ))
            OR (${Accounting.journal_entries.selectOptionColumns.db_name} = 'cash_disbursements' AND EXISTS (
              SELECT 1 FROM ${Accounting.cash_disbursements.tablename} cd
              WHERE cd.${Accounting.cash_disbursements.selectOptionColumns.id} = ${Accounting.journal_entries.selectOptionColumns.db_id}
              AND cd.${Accounting.cash_disbursements.selectOptionColumns.payment_date} <= '${endDate}'
            ))
            OR (${Accounting.journal_entries.selectOptionColumns.db_name} = 'sales' AND EXISTS (
              SELECT 1 FROM ${Accounting.sales.tablename} s
              WHERE s.${Accounting.sales.selectOptionColumns.id} = ${Accounting.journal_entries.selectOptionColumns.db_id}
              AND s.${Accounting.sales.selectOptionColumns.date_delivered} <= '${endDate}'
            ))
            OR (${Accounting.journal_entries.selectOptionColumns.db_name} = 'collections' AND EXISTS (
              SELECT 1 FROM ${Accounting.collections.tablename} c
              WHERE c.${Accounting.collections.selectOptionColumns.id} = ${Accounting.journal_entries.selectOptionColumns.db_id}
              AND c.${Accounting.collections.selectOptionColumns.collection_date} <= '${endDate}'
            ))
            OR (${Accounting.journal_entries.selectOptionColumns.db_name} = 'purchase' AND EXISTS (
              SELECT 1 FROM ${Accounting.purchase.tablename} p
              WHERE p.${Accounting.purchase.selectOptionColumns.id} = ${Accounting.journal_entries.selectOptionColumns.db_id}
              AND p.${Accounting.purchase.selectOptionColumns.date_delivered} <= '${endDate}'
            ))
            OR (${Accounting.journal_entries.selectOptionColumns.db_name} = 'payments' AND EXISTS (
              SELECT 1 FROM ${Accounting.payments.tablename} pay
              WHERE pay.${Accounting.payments.selectOptionColumns.id} = ${Accounting.journal_entries.selectOptionColumns.db_id}
              AND pay.${Accounting.payments.selectOptionColumns.payment_date} <= '${endDate}'
            ))
            OR (${Accounting.journal_entries.selectOptionColumns.db_name} = 'adjustments' AND EXISTS (
              SELECT 1 FROM ${Accounting.adjustments.tablename} a
              WHERE a.${Accounting.adjustments.selectOptionColumns.id} = ${Accounting.journal_entries.selectOptionColumns.db_id}
              AND a.${Accounting.adjustments.selectOptionColumns.posting_date} <= '${endDate}'
            ))
          )
        `)
      }
      dateFilter = ` AND ${conditions.join(' AND ')}`
    }

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

    // Query to get all journal entries in chronological order
    const general_ledger_query = `
      SELECT
        ${Master.charts_of_accounts.selectOptionColumns.id}                  AS coa_id,
        ${Master.charts_of_accounts.selectOptionColumns.code}                AS account_code,
        ${Master.charts_of_accounts.selectOptionColumns.name}                AS account_name,
        ${Master.charts_of_accounts.selectOptionColumns.type}                AS account_type,
        CASE
          WHEN ${Accounting.journal_entries.selectOptionColumns.db_name} = 'receipts' THEN r.${Accounting.receipts.selectOptionColumns.collection_date}
          WHEN ${Accounting.journal_entries.selectOptionColumns.db_name} = 'cash_disbursements' THEN cd.${Accounting.cash_disbursements.selectOptionColumns.payment_date}
          WHEN ${Accounting.journal_entries.selectOptionColumns.db_name} = 'sales' THEN s.${Accounting.sales.selectOptionColumns.date_delivered}
          WHEN ${Accounting.journal_entries.selectOptionColumns.db_name} = 'collections' THEN c.${Accounting.collections.selectOptionColumns.collection_date}
          WHEN ${Accounting.journal_entries.selectOptionColumns.db_name} = 'purchase' THEN p.${Accounting.purchase.selectOptionColumns.date_delivered}
          WHEN ${Accounting.journal_entries.selectOptionColumns.db_name} = 'payments' THEN pay.${Accounting.payments.selectOptionColumns.payment_date}
          WHEN ${Accounting.journal_entries.selectOptionColumns.db_name} = 'adjustments' THEN a.${Accounting.adjustments.selectOptionColumns.posting_date}
          ELSE ${Accounting.journal_entries.selectOptionColumns.date}
        END AS posted_date,
        CASE
          WHEN ${Accounting.journal_entries.selectOptionColumns.db_name} = 'receipts' THEN r.${Accounting.receipts.selectOptionColumns.id}
          WHEN ${Accounting.journal_entries.selectOptionColumns.db_name} = 'cash_disbursements' THEN cd.${Accounting.cash_disbursements.selectOptionColumns.id}
          WHEN ${Accounting.journal_entries.selectOptionColumns.db_name} = 'sales' THEN s.${Accounting.sales.selectOptionColumns.id}
          WHEN ${Accounting.journal_entries.selectOptionColumns.db_name} = 'collections' THEN c.${Accounting.collections.selectOptionColumns.id}
          WHEN ${Accounting.journal_entries.selectOptionColumns.db_name} = 'purchase' THEN p.${Accounting.purchase.selectOptionColumns.id}
          WHEN ${Accounting.journal_entries.selectOptionColumns.db_name} = 'payments' THEN pay.${Accounting.payments.selectOptionColumns.id}
          WHEN ${Accounting.journal_entries.selectOptionColumns.db_name} = 'adjustments' THEN a.${Accounting.adjustments.selectOptionColumns.id}
          ELSE NULL
        END AS parent_id,
        ${Accounting.journal_entries.selectOptionColumns.type}               AS entry_type,
        ${Accounting.journal_entries.selectOptionColumns.amount}             AS amount,
        ${Accounting.journal_entries.selectOptionColumns.responsibility_center} AS responsibility_center,
        ${Accounting.journal_entries.selectOptionColumns.db_name}            AS db_name,
        ${Accounting.journal_entries.selectOptionColumns.db_id}              AS db_id
      FROM ${Accounting.journal_entries.tablename}
      INNER JOIN ${Master.charts_of_accounts.tablename}
        ON ${Accounting.journal_entries.selectOptionColumns.coa_id} = ${Master.charts_of_accounts.selectOptionColumns.id}
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
      WHERE ${Master.charts_of_accounts.selectOptionColumns.status} = 'ACTIVE'
      ${dateFilter}
      ${approvalFilter}
      ${account_code ? `AND ${Master.charts_of_accounts.selectOptionColumns.code} = '${account_code}'` : ''}
      ${type ? `AND ${Accounting.journal_entries.selectOptionColumns.type} = '${type.toUpperCase()}'` : ''}
      AND ${Accounting.journal_entries.selectOptionColumns.db_name} IS NOT NULL
      AND ${Accounting.journal_entries.selectOptionColumns.db_id} IS NOT NULL
      AND ${Accounting.journal_entries.selectOptionColumns.coa_id} IS NOT NULL
      ORDER BY
        ${Accounting.journal_entries.selectOptionColumns.db_name},
        ${Accounting.journal_entries.selectOptionColumns.db_id},
        posted_date,
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

      // Convert db_name to readable transaction type
      const transactionTypeMap = {
        receipts: 'Receipt',
        cash_disbursements: 'Cash Disbursement',
        sales: 'Sales',
        collections: 'Collection',
        purchase: 'Purchase',
        payments: 'Payment',
        adjustments: 'Adjustment',
      }
      const transactionType = transactionTypeMap[row.db_name] || row.db_name

      ledgerEntries.push({
        // show the date only on the first line of each source group
        date: prevSourceKey === sourceKey ? '' : row.posted_date,
        parent_id: prevSourceKey === sourceKey ? '' : row.parent_id,
        particulars: `${row.account_code} - ${row.account_name}`,
        account_code: row.account_code,
        account_name: row.account_name,
        account_type: row.account_type,
        debit: row.entry_type === 'DEBIT' ? amount : 0,
        credit: row.entry_type === 'CREDIT' ? amount : 0,
        balance: runningBalance,
        source: row.db_name,
        source_id: row.db_id,
        transaction_type: transactionType,
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
    })
  }
}

const getBalanceSheet = async (req, res, next) => {
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

    const balance_sheet_query = `SELECT ${Master.charts_of_accounts.selectOptionColumns.code} as 'Account Code', ${Master.charts_of_accounts.selectOptionColumns.name} as 'Account Name', CASE WHEN ${Master.charts_of_accounts.selectOptionColumns.type} = 'ASSETS' THEN SUM(CASE WHEN ${Accounting.journal_entries.selectOptionColumns.type} = 'DEBIT' THEN ${Accounting.journal_entries.selectOptionColumns.amount} ELSE 0 END) - SUM(CASE WHEN ${Accounting.journal_entries.selectOptionColumns.type} = 'CREDIT' THEN ${Accounting.journal_entries.selectOptionColumns.amount} ELSE 0 END) ELSE SUM(CASE WHEN ${Accounting.journal_entries.selectOptionColumns.type} = 'CREDIT' THEN ${Accounting.journal_entries.selectOptionColumns.amount} ELSE 0 END) - SUM(CASE WHEN ${Accounting.journal_entries.selectOptionColumns.type} = 'DEBIT' THEN ${Accounting.journal_entries.selectOptionColumns.amount} ELSE 0 END) END as Current FROM ${Master.charts_of_accounts.tablename} LEFT JOIN ${Accounting.journal_entries.tablename} ON ${Accounting.journal_entries.selectOptionColumns.coa_id} = ${Master.charts_of_accounts.selectOptionColumns.id} WHERE ${Master.charts_of_accounts.selectOptionColumns.status} = 'ACTIVE' AND ${Master.charts_of_accounts.selectOptionColumns.type} IN ('ASSETS', 'LIABILITIES', 'EQUITY')${dateFilter}${approvalFilter} GROUP BY ${Master.charts_of_accounts.selectOptionColumns.id}, ${Master.charts_of_accounts.selectOptionColumns.code}, ${Master.charts_of_accounts.selectOptionColumns.name}, ${Master.charts_of_accounts.selectOptionColumns.type} ORDER BY ${Master.charts_of_accounts.selectOptionColumns.type}, ${Master.charts_of_accounts.selectOptionColumns.code}`

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
        ${approvalFilter}
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
        Current: netIncome,
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

  // The requested scope is a suggestion, never the decision.
  //
  // This parameter arrives in the query string, so before it was intersected with
  // the tenant's plan a user could ask for any module by name - including
  // withholding_tax, tax_compliance or bank_reconciliation - and read data for a
  // module their company had not bought. The nav and the route gate both stop
  // that in the browser; nothing stopped a direct request.
  const requestedRoutes =
    allowedRoutes.length > 0 ? allowedRoutes : defaultSearchRoutes

  let entitledModules = null
  let entitlementError = null
  try {
    const tenantDb =
      req?.session?.tenantDb || req?.context?.dbName || req?.session?.user?.dbName || null
    if (tenantDb) {
      const entitlement = await resolveEntitlement(tenantDb)
      entitledModules = entitlement.subscribed ? entitlement.modules : []
    }
  } catch (error) {
    // Fail closed. If the plan cannot be read, searching nothing is the safe
    // answer; searching everything is the unsafe one.
    entitlementError = error
    entitledModules = []
  }

  const allowedSearchRoutes = new Set(
    entitledModules === null
      ? // No tenant on the request (unit test, internal call). Keep the
        // requested scope rather than silently returning nothing.
        requestedRoutes
      : requestedRoutes.filter((route) => entitledModules.includes(route)),
  )

  if (entitledModules !== null && allowedSearchRoutes.size === 0) {
    return res.status(402).json({
      success: false,
      code: 'NO_SEARCHABLE_MODULES',
      message:
        'No modules available to search are included in your plan. Upgrade to search across your transactions.',
      requiresUpgrade: true,
    })
  }

  // Treat empty strings as undefined for date filtering
  const effectiveStartDate = startDate && startDate.trim() !== '' ? startDate : null
  const effectiveEndDate = endDate && endDate.trim() !== '' ? endDate : null

  try {
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
        sal.${Accounting.sales.selectOptionColumns.id} LIKE ? OR
        sal.${Accounting.sales.selectOptionColumns.document_reference} LIKE ? OR 
        cust.${Master.customers.selectOptionColumns.name} LIKE ? OR
        sal.${Accounting.sales.selectOptionColumns.remarks} LIKE ? OR
        sal.${Accounting.sales.selectOptionColumns.created_by} LIKE ? OR
        sal.${Accounting.sales.selectOptionColumns.state} LIKE ? OR
        CAST(sal.${Accounting.sales.selectOptionColumns.total_amount_due} AS CHAR) LIKE ?
      )
        ${effectiveStartDate && effectiveEndDate ? `AND sal.${Accounting.sales.selectOptionColumns.date_delivered} BETWEEN ? AND ?` : ''}
    `

      const salesParams = [
        searchTerm,
        searchTerm,
        searchTerm,
        searchTerm,
        searchTerm,
        searchTerm,
        searchTerm,
      ]
      if (effectiveStartDate && effectiveEndDate) {
        salesParams.push(effectiveStartDate, effectiveEndDate)
      }
      const salesResults = await Query(salesQuery, salesParams)
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
        coll.${Accounting.collections.selectOptionColumns.id} LIKE ? OR
        coll.${Accounting.collections.selectOptionColumns.document_reference} LIKE ? OR 
        cust.${Master.customers.selectOptionColumns.name} LIKE ? OR
        coll.${Accounting.collections.selectOptionColumns.remarks} LIKE ? OR
        coll.${Accounting.collections.selectOptionColumns.created_by} LIKE ? OR
        coll.${Accounting.collections.selectOptionColumns.state} LIKE ? OR
        coll.${Accounting.collections.selectOptionColumns.mode_of_payment} LIKE ? OR
        coll.${Accounting.collections.selectOptionColumns.bank_name} LIKE ? OR
        coll.${Accounting.collections.selectOptionColumns.check_number} LIKE ?
      )
        ${effectiveStartDate && effectiveEndDate ? `AND coll.${Accounting.collections.selectOptionColumns.collection_date} BETWEEN ? AND ?` : ''}
    `

      const collectionsParams = [
        searchTerm,
        searchTerm,
        searchTerm,
        searchTerm,
        searchTerm,
        searchTerm,
        searchTerm,
        searchTerm,
        searchTerm,
      ]
      if (effectiveStartDate && effectiveEndDate) {
        collectionsParams.push(effectiveStartDate, effectiveEndDate)
      }
      const collectionsResults = await Query(collectionsQuery, collectionsParams)
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
        rec.${Accounting.receipts.selectOptionColumns.id} LIKE ? OR
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
        ${effectiveStartDate && effectiveEndDate ? `AND rec.${Accounting.receipts.selectOptionColumns.collection_date} BETWEEN ? AND ?` : ''}
    `

      const receiptsParams = [
        searchTerm,
        searchTerm,
        searchTerm,
        searchTerm,
        searchTerm,
        searchTerm,
        searchTerm,
        searchTerm,
        searchTerm,
        searchTerm,
      ]
      if (effectiveStartDate && effectiveEndDate) {
        receiptsParams.push(effectiveStartDate, effectiveEndDate)
      }
      const receiptsResults = await Query(receiptsQuery, receiptsParams)
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
        pur.${Accounting.purchase.selectOptionColumns.id} LIKE ? OR
        pur.${Accounting.purchase.selectOptionColumns.document_reference} LIKE ? OR 
        vend.${Master.vendors.selectOptionColumns.name} LIKE ? OR
        pur.${Accounting.purchase.selectOptionColumns.remarks} LIKE ? OR
        pur.${Accounting.purchase.selectOptionColumns.created_by} LIKE ? OR
        pur.${Accounting.purchase.selectOptionColumns.state} LIKE ? OR
        CAST(pur.${Accounting.purchase.selectOptionColumns.total_amount_due} AS CHAR) LIKE ?
      )
        ${effectiveStartDate && effectiveEndDate ? `AND pur.${Accounting.purchase.selectOptionColumns.date_delivered} BETWEEN ? AND ?` : ''}
    `

      const purchaseParams = [
        searchTerm,
        searchTerm,
        searchTerm,
        searchTerm,
        searchTerm,
        searchTerm,
        searchTerm,
      ]
      if (effectiveStartDate && effectiveEndDate) {
        purchaseParams.push(effectiveStartDate, effectiveEndDate)
      }
      const purchaseResults = await Query(purchaseQuery, purchaseParams)
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
        cd.${Accounting.cash_disbursements.selectOptionColumns.id} LIKE ? OR
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
        ${effectiveStartDate && effectiveEndDate ? `AND cd.${Accounting.cash_disbursements.selectOptionColumns.payment_date} BETWEEN ? AND ?` : ''}
    `

      const cashDisbursementsParams = [
        searchTerm,
        searchTerm,
        searchTerm,
        searchTerm,
        searchTerm,
        searchTerm,
        searchTerm,
        searchTerm,
        searchTerm,
        searchTerm,
      ]
      if (effectiveStartDate && effectiveEndDate) {
        cashDisbursementsParams.push(effectiveStartDate, effectiveEndDate)
      }
      const cashDisbursementsResults = await Query(
        cashDisbursementsQuery,
        cashDisbursementsParams,
      )
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
        pay.${Accounting.payments.selectOptionColumns.id} LIKE ? OR
        pay.${Accounting.payments.selectOptionColumns.document_reference} LIKE ? OR 
        vend.${Master.vendors.selectOptionColumns.name} LIKE ? OR
        pay.${Accounting.payments.selectOptionColumns.remarks} LIKE ? OR
        pay.${Accounting.payments.selectOptionColumns.created_by} LIKE ? OR
        pay.${Accounting.payments.selectOptionColumns.state} LIKE ? OR
        pay.${Accounting.payments.selectOptionColumns.mode_of_payment} LIKE ? OR
        pay.${Accounting.payments.selectOptionColumns.bank_name} LIKE ? OR
        pay.${Accounting.payments.selectOptionColumns.check_number} LIKE ?
      )
        ${effectiveStartDate && effectiveEndDate ? `AND pay.${Accounting.payments.selectOptionColumns.payment_date} BETWEEN ? AND ?` : ''}
    `

      const paymentsParams = [
        searchTerm,
        searchTerm,
        searchTerm,
        searchTerm,
        searchTerm,
        searchTerm,
        searchTerm,
        searchTerm,
        searchTerm,
      ]
      if (effectiveStartDate && effectiveEndDate) {
        paymentsParams.push(effectiveStartDate, effectiveEndDate)
      }
      const paymentsResults = await Query(paymentsQuery, paymentsParams)
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
        adj.${Accounting.adjustments.selectOptionColumns.id} LIKE ? OR
        adj.${Accounting.adjustments.selectOptionColumns.document_reference} LIKE ? OR
        adj.${Accounting.adjustments.selectOptionColumns.remarks} LIKE ? OR
        adj.${Accounting.adjustments.selectOptionColumns.created_by} LIKE ? OR
        adj.${Accounting.adjustments.selectOptionColumns.status} LIKE ? OR
        CAST(adj.${Accounting.adjustments.selectOptionColumns.total_amount} AS CHAR) LIKE ?
      )
        ${effectiveStartDate && effectiveEndDate ? `AND adj.${Accounting.adjustments.selectOptionColumns.posting_date} BETWEEN ? AND ?` : ''}
    `

      const adjustmentsParams = [
        searchTerm,
        searchTerm,
        searchTerm,
        searchTerm,
        searchTerm,
        searchTerm,
      ]
      if (effectiveStartDate && effectiveEndDate) {
        adjustmentsParams.push(effectiveStartDate, effectiveEndDate)
      }
      const adjustmentsResults = await Query(adjustmentsQuery, adjustmentsParams)
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
             ${dateFilter}
        WHERE ${Master.charts_of_accounts.selectOptionColumns.status} = 'ACTIVE'
          AND ${Master.charts_of_accounts.selectOptionColumns.type} IN ('REVENUE', 'EXPENSES')
        ${approvalFilter}
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
             ${dateFilter}
        WHERE ${Master.charts_of_accounts.selectOptionColumns.status} = 'ACTIVE'
          AND (${Master.charts_of_accounts.selectOptionColumns.name} LIKE '%OCI%'
             OR ${Master.charts_of_accounts.selectOptionColumns.name} LIKE '%Revaluation%'
             OR ${Master.charts_of_accounts.selectOptionColumns.name} LIKE '%Unrealized%'
             OR ${Master.charts_of_accounts.selectOptionColumns.code} LIKE '35%')
        ${approvalFilter}
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
        ${approvalFilter}
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
    })
  }
}

module.exports = {
  getTrialBalance,
  getIncomeStatement,
  getCashFlowStatement,
  getGeneralLedger,
  getBalanceSheet,
  getSearch,
  getStatementOfComprehensiveIncome,
  getBankReconciliation,
}
