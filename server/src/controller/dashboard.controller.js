const os = require('os')
const {
  checkConnection,
  SelectAll,
  Transaction,
  Query,
  Insert,
  SelectWithCondition,
} = require('../database/util/queries.util')
const {
  formatMemoryUsage,
  formatTime,
  DataModeling,
} = require('../util/helper.util')
const { Master } = require('../database/model/Master')
const { Accounting } = require('../database/model/Accounting')
const { SQLQueryBuilder } = require('../util/helper.util')
const sql = new SQLQueryBuilder()

require('dotenv').config()

const getDashboardData = async (req, res, next) => {
  try {
    const { start_date, end_date, responsibility_center } = req.query
    const responsibilityCenterFilter = responsibility_center
      ? `AND ${Accounting.journal_entries.selectOptionColumns.responsibility_center} = '${String(responsibility_center).replace(/'/g, "''")}'`
      : ''

    // Default to current month if no dates provided
    let startDate = start_date
    let endDate = end_date
    if (!start_date && !end_date) {
      const now = new Date()
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      startDate = firstDay.toISOString().split('T')[0]
      endDate = lastDay.toISOString().split('T')[0]
    }

    // Reuseable snippet to enforce complete journal entry items
    const validJeCondition = `
      AND ${Accounting.journal_entries.selectOptionColumns.db_name} IS NOT NULL
      AND ${Accounting.journal_entries.selectOptionColumns.db_id} IS NOT NULL
      AND ${Accounting.journal_entries.selectOptionColumns.coa_id} IS NOT NULL
      ${responsibilityCenterFilter}
    `

    // Date filter using EXISTS subqueries to check parent table date columns
    let dateFilter = ''
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

    // ==================== FINANCIAL HEALTH (Quick KPIs) ====================

    // Net Income / Gross Revenue - from journal entries by COA
    const net_income_query = `
      SELECT 
        SUM(CASE WHEN account_type = 'REVENUE' THEN account_balance ELSE 0 END) AS grossRevenue,
        SUM(CASE WHEN account_type = 'REVENUE' THEN account_balance ELSE 0 END) -
        SUM(CASE WHEN account_type = 'EXPENSES' THEN account_balance ELSE 0 END) AS netIncome
      FROM (
        SELECT 
          ${Master.charts_of_accounts.selectOptionColumns.type} AS account_type,
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
            ELSE 0
          END AS account_balance
        FROM ${Master.charts_of_accounts.tablename}
        LEFT JOIN ${Accounting.journal_entries.tablename}
          ON ${Accounting.journal_entries.selectOptionColumns.coa_id} = ${Master.charts_of_accounts.selectOptionColumns.id}
          ${validJeCondition} /* Enforced Null Checks */
        WHERE ${Master.charts_of_accounts.selectOptionColumns.status} = 'ACTIVE'
          AND ${Master.charts_of_accounts.selectOptionColumns.type} IN ('REVENUE', 'EXPENSES')
          ${dateFilter}
          ${approvalFilter}
        GROUP BY ${Master.charts_of_accounts.selectOptionColumns.id}, ${Master.charts_of_accounts.selectOptionColumns.type}
      ) AS account_balances
    `
    const netIncomeResult = await Query(net_income_query)
    const netIncome = parseFloat(netIncomeResult[0]?.netIncome || 0)
    const grossRevenue = parseFloat(netIncomeResult[0]?.grossRevenue || 0)
    const marginPercent =
      grossRevenue > 0 ? ((netIncome / grossRevenue) * 100).toFixed(1) : 0

    // Cash Position Breakdown - detailed calculation from journal entries by COA
    const cash_breakdown_query = `
      SELECT 
        SUM(CASE 
          WHEN ${Master.charts_of_accounts.selectOptionColumns.code} = '100-1100'
               OR ${Master.charts_of_accounts.selectOptionColumns.name} = 'Cash On Hand'
               THEN account_balance 
          ELSE 0 
        END) AS cashOnHand,
        SUM(CASE 
          WHEN ${Master.charts_of_accounts.selectOptionColumns.code} = '100-1000'
               OR ${Master.charts_of_accounts.selectOptionColumns.name} = 'Petty Cash'
               THEN account_balance 
          ELSE 0 
        END) AS pettyCash,
        SUM(CASE 
          WHEN ${Master.charts_of_accounts.selectOptionColumns.code} LIKE '100-120%'
               OR ${Master.charts_of_accounts.selectOptionColumns.name} LIKE '%Cash in Bank%'
               THEN account_balance 
          ELSE 0 
        END) AS bankAccounts,
        SUM(CASE 
          WHEN ${Master.charts_of_accounts.selectOptionColumns.code} LIKE '%check%'
               OR ${Master.charts_of_accounts.selectOptionColumns.name} LIKE '%check%'
               THEN account_balance 
          ELSE 0 
        END) AS checks
      FROM (
        SELECT 
          ${Master.charts_of_accounts.selectOptionColumns.id},
          ${Master.charts_of_accounts.selectOptionColumns.code},
          ${Master.charts_of_accounts.selectOptionColumns.name},
          COALESCE(SUM(CASE WHEN ${Accounting.journal_entries.selectOptionColumns.type} = 'DEBIT' 
                               THEN ${Accounting.journal_entries.selectOptionColumns.amount} ELSE 0 END), 0) -
          COALESCE(SUM(CASE WHEN ${Accounting.journal_entries.selectOptionColumns.type} = 'CREDIT' 
                               THEN ${Accounting.journal_entries.selectOptionColumns.amount} ELSE 0 END), 0) AS account_balance
        FROM ${Master.charts_of_accounts.tablename}
        LEFT JOIN ${Accounting.journal_entries.tablename}
          ON ${Accounting.journal_entries.selectOptionColumns.coa_id} = ${Master.charts_of_accounts.selectOptionColumns.id}
          ${validJeCondition} /* Enforced Null Checks */
        WHERE ${Master.charts_of_accounts.selectOptionColumns.status} = 'ACTIVE'
          AND ${Master.charts_of_accounts.selectOptionColumns.type} = 'Assets'
          ${dateFilter}
          ${approvalFilter}
        GROUP BY ${Master.charts_of_accounts.selectOptionColumns.id}, 
                 ${Master.charts_of_accounts.selectOptionColumns.code}, 
                 ${Master.charts_of_accounts.selectOptionColumns.name}
      ) AS account_balances
    `
    const cashBreakdownResult = await Query(cash_breakdown_query)
    const cashOnHand = parseFloat(cashBreakdownResult[0]?.cashOnHand || 0)
    const pettyCash = parseFloat(cashBreakdownResult[0]?.pettyCash || 0)
    const bankAccountsBalance = parseFloat(cashBreakdownResult[0]?.bankAccounts || 0)
    const checks = parseFloat(cashBreakdownResult[0]?.checks || 0)
    const totalCashPosition = cashOnHand + pettyCash + bankAccountsBalance + checks

    // Open AR as of the selected period end, including residual balances from prior periods.
    const receivables_query = `
      SELECT COALESCE(SUM(s.${Accounting.sales.selectOptionColumns.total_amount_due} - COALESCE(collected.amount, 0)), 0) AS totalReceivables
      FROM ${Accounting.sales.tablename} s
      LEFT JOIN (
        SELECT si.${Accounting.sales_items.selectOptionColumns.sales_id} AS sales_id,
               SUM(ci.${Accounting.collection_items.selectOptionColumns.amount}) AS amount
        FROM ${Accounting.collection_items.tablename} ci
        INNER JOIN ${Accounting.sales_items.tablename} si
          ON si.${Accounting.sales_items.selectOptionColumns.id} = ci.${Accounting.collection_items.selectOptionColumns.sales_id}
        INNER JOIN ${Accounting.collections.tablename} c
          ON c.${Accounting.collections.selectOptionColumns.id} = ci.${Accounting.collection_items.selectOptionColumns.collection_id}
        WHERE c.${Accounting.collections.selectOptionColumns.state} = 'APPROVED'
          AND c.${Accounting.collections.selectOptionColumns.collection_date} <= '${endDate}'
        GROUP BY si.${Accounting.sales_items.selectOptionColumns.sales_id}
      ) collected ON collected.sales_id = s.${Accounting.sales.selectOptionColumns.id}
      WHERE s.${Accounting.sales.selectOptionColumns.state} = 'APPROVED'
        AND s.${Accounting.sales.selectOptionColumns.date_delivered} <= '${endDate}'
        AND s.${Accounting.sales.selectOptionColumns.total_amount_due} - COALESCE(collected.amount, 0) > 0
    `
    const receivablesResult = await Query(receivables_query)
    const totalReceivables = parseFloat(receivablesResult[0]?.totalReceivables || 0)

    // Total Payables (AP) - Purchases not yet paid within date range
    const payables_query = sql
      .select([
        {
          col: `SUM(${Accounting.purchase.selectOptionColumns.total_amount_due})`,
          as: 'totalPayables',
        },
      ])
      .from(Accounting.purchase.tablename)
      .where(
        `${Accounting.purchase.selectOptionColumns.status} = 'UNPAID' OR ${Accounting.purchase.selectOptionColumns.status} = 'PARTIAL'`,
      )
      .andWhere(`${Accounting.purchase.selectOptionColumns.state} = 'APPROVED'`)
      .andWhere(
        `${Accounting.purchase.selectOptionColumns.date_delivered} >= '${startDate}'`,
      )
      .andWhere(
        `${Accounting.purchase.selectOptionColumns.date_delivered} <= '${endDate}'`,
      )
      .build()
    const payablesResult = await Query(payables_query)
    const totalPayables = parseFloat(payablesResult[0]?.totalPayables || 0)

    // ==================== CASH FLOW ACTIVITY ====================

    // Total Collections this period is an amount, not a transaction count.
    const collections_count_query = `
      SELECT COALESCE(SUM(ci.${Accounting.collection_items.selectOptionColumns.amount}), 0) AS totalCollections
      FROM ${Accounting.collections.tablename} c
      INNER JOIN ${Accounting.collection_items.tablename} ci
        ON ci.${Accounting.collection_items.selectOptionColumns.collection_id} = c.${Accounting.collections.selectOptionColumns.id}
      WHERE c.${Accounting.collections.selectOptionColumns.collection_date} >= '${startDate}'
        AND c.${Accounting.collections.selectOptionColumns.collection_date} <= '${endDate}'
        AND c.${Accounting.collections.selectOptionColumns.state} = 'APPROVED'
    `
    const collectionsCountResult = await Query(collections_count_query)
    const totalCollections = parseFloat(
      collectionsCountResult[0]?.totalCollections || 0,
    )

    // Total billed sales for collections rate calculation.
    const total_sales_count_query = sql
      .select([
        {
          col: `COALESCE(SUM(${Accounting.sales.selectOptionColumns.total_amount_due}), 0)`,
          as: 'totalSales',
        },
      ])
      .from(Accounting.sales.tablename)
      .where(`${Accounting.sales.selectOptionColumns.state} = 'APPROVED'`)
      .andWhere(
        `${Accounting.sales.selectOptionColumns.date_delivered} >= '${startDate}'`,
      )
      .andWhere(
        `${Accounting.sales.selectOptionColumns.date_delivered} <= '${endDate}'`,
      )
      .build()
    const totalSalesResult = await Query(total_sales_count_query)
    const totalSales = parseFloat(totalSalesResult[0]?.totalSales || 0)

    // Collections Rate - collected amount divided by billed amount.
    let collectionsRate = 0
    if (totalSales > 0) {
      collectionsRate = ((totalCollections / totalSales) * 100).toFixed(1)
    }

    // Debug logging
    console.log('Collections Rate Debug:', {
      totalCollections,
      totalSales,
      collectionsRate,
      startDate,
      endDate,
    })

    // Total Disbursements this period.
    const disbursements_query = sql
      .select([
        {
          col: `SUM(${Accounting.cash_disbursements.selectOptionColumns.total_amount_due})`,
          as: 'totalDisbursements',
        },
      ])
      .from(Accounting.cash_disbursements.tablename)
      .where(
        `${Accounting.cash_disbursements.selectOptionColumns.payment_date} >= '${startDate}'`,
      )
      .andWhere(
        `${Accounting.cash_disbursements.selectOptionColumns.payment_date} <= '${endDate}'`,
      )
      .andWhere(
        `${Accounting.cash_disbursements.selectOptionColumns.state} = 'APPROVED'`,
      )
      .build()
    const disbursementsResult = await Query(disbursements_query)
    const totalDisbursements = parseFloat(
      disbursementsResult[0]?.totalDisbursements || 0,
    )

    const receipts_query = `
      SELECT COALESCE(SUM(${Accounting.receipts.selectOptionColumns.total_amount_due}), 0) AS totalReceipts
      FROM ${Accounting.receipts.tablename}
      WHERE ${Accounting.receipts.selectOptionColumns.collection_date} >= '${startDate}'
        AND ${Accounting.receipts.selectOptionColumns.collection_date} <= '${endDate}'
        AND ${Accounting.receipts.selectOptionColumns.state} = 'APPROVED'
    `
    const receiptsResult = await Query(receipts_query)
    const totalReceipts = parseFloat(receiptsResult[0]?.totalReceipts || 0)

    const payments_query = `
      SELECT COALESCE(SUM(pi.${Accounting.payment_items.selectOptionColumns.amount}), 0) AS totalPayments
      FROM ${Accounting.payments.tablename} pay
      INNER JOIN ${Accounting.payment_items.tablename} pi
        ON pi.${Accounting.payment_items.selectOptionColumns.payment_id} = pay.${Accounting.payments.selectOptionColumns.id}
      WHERE pay.${Accounting.payments.selectOptionColumns.payment_date} >= '${startDate}'
        AND pay.${Accounting.payments.selectOptionColumns.payment_date} <= '${endDate}'
        AND pay.${Accounting.payments.selectOptionColumns.state} = 'APPROVED'
    `
    const paymentsResult = await Query(payments_query)
    const totalPayments = parseFloat(paymentsResult[0]?.totalPayments || 0)

    // Net cash movement includes receipts, collections, disbursements, and payments.
    const netCashMovement =
      totalReceipts + totalCollections - totalDisbursements - totalPayments

    // ==================== TRANSACTION VOLUME ====================

    // Number of Sales transactions within date range
    const sales_count_query = sql
      .select([{ col: `COUNT(*)`, as: 'salesCount' }])
      .from(Accounting.sales.tablename)
      .where(`${Accounting.sales.selectOptionColumns.state} = 'APPROVED'`)
      .andWhere(
        `${Accounting.sales.selectOptionColumns.date_delivered} >= '${startDate}'`,
      )
      .andWhere(
        `${Accounting.sales.selectOptionColumns.date_delivered} <= '${endDate}'`,
      )
      .build()
    const salesCountResult = await Query(sales_count_query)
    const salesCount = parseInt(salesCountResult[0]?.salesCount || 0)

    // Number of Purchase transactions within date range
    const purchase_count_query = sql
      .select([{ col: `COUNT(*)`, as: 'purchaseCount' }])
      .from(Accounting.purchase.tablename)
      .where(`${Accounting.purchase.selectOptionColumns.state} = 'APPROVED'`)
      .andWhere(
        `${Accounting.purchase.selectOptionColumns.date_delivered} >= '${startDate}'`,
      )
      .andWhere(
        `${Accounting.purchase.selectOptionColumns.date_delivered} <= '${endDate}'`,
      )
      .build()
    const purchaseCountResult = await Query(purchase_count_query)
    const purchaseCount = parseInt(purchaseCountResult[0]?.purchaseCount || 0)

    // Number of Cash Disbursements within date range
    const disbursement_count_query = sql
      .select([{ col: `COUNT(*)`, as: 'disbursementCount' }])
      .from(Accounting.cash_disbursements.tablename)
      .where(
        `${Accounting.cash_disbursements.selectOptionColumns.state} = 'APPROVED'`,
      )
      .andWhere(
        `${Accounting.cash_disbursements.selectOptionColumns.payment_date} >= '${startDate}'`,
      )
      .andWhere(
        `${Accounting.cash_disbursements.selectOptionColumns.payment_date} <= '${endDate}'`,
      )
      .build()
    const disbursementCountResult = await Query(disbursement_count_query)
    const disbursementCount = parseInt(
      disbursementCountResult[0]?.disbursementCount || 0,
    )

    // Number of Adjustments posted within date range
    const adjustment_count_query = sql
      .select([{ col: `COUNT(*)`, as: 'adjustmentCount' }])
      .from(Accounting.adjustments.tablename)
      .where(`${Accounting.adjustments.selectOptionColumns.status} = 'APPROVED'`)
      .andWhere(
        `${Accounting.adjustments.selectOptionColumns.posting_date} >= '${startDate}'`,
      )
      .andWhere(
        `${Accounting.adjustments.selectOptionColumns.posting_date} <= '${endDate}'`,
      )
      .build()
    const adjustmentCountResult = await Query(adjustment_count_query)
    const adjustmentCount = parseInt(adjustmentCountResult[0]?.adjustmentCount || 0)

    // ==================== ALERTS / RED FLAGS ====================

    // Trial Balance status
    const trial_balance_check_query = `
      SELECT 
        SUM(CASE WHEN ${Accounting.journal_entries.selectOptionColumns.type} = 'DEBIT' 
                 THEN ${Accounting.journal_entries.selectOptionColumns.amount} ELSE 0 END) AS totalDebit,
        SUM(CASE WHEN ${Accounting.journal_entries.selectOptionColumns.type} = 'CREDIT' 
                 THEN ${Accounting.journal_entries.selectOptionColumns.amount} ELSE 0 END) AS totalCredit
      FROM ${Accounting.journal_entries.tablename}
      WHERE 1=1 ${validJeCondition} /* Enforced Null Checks */
      ${approvalFilter}
    `
    const trialBalanceResult = await Query(trial_balance_check_query)
    const totalDebit = parseFloat(trialBalanceResult[0]?.totalDebit || 0)
    const totalCredit = parseFloat(trialBalanceResult[0]?.totalCredit || 0)
    const trialBalanceDifference = Math.abs(totalDebit - totalCredit)
    const trialBalanceBalanced = trialBalanceDifference < 0.01

    // Balance Sheet check (Assets = Liabilities + Equity)
    const balance_sheet_check_query = `
      SELECT 
        SUM(CASE WHEN account_type IN ('ASSET', 'ASSETS') THEN account_balance ELSE 0 END) AS totalAssets,
        SUM(CASE
          WHEN account_type IN ('LIABILITY', 'LIABILITIES', 'EQUITY')
            THEN account_balance
          ELSE 0
        END) AS totalLiabilitiesEquity
      FROM (
        SELECT 
          ${Master.charts_of_accounts.selectOptionColumns.type} AS account_type,
          CASE WHEN ${Master.charts_of_accounts.selectOptionColumns.type} IN ('ASSET', 'ASSETS') THEN
            SUM(CASE WHEN ${Accounting.journal_entries.selectOptionColumns.type} = 'DEBIT'
                     THEN ${Accounting.journal_entries.selectOptionColumns.amount} ELSE 0 END) -
            SUM(CASE WHEN ${Accounting.journal_entries.selectOptionColumns.type} = 'CREDIT'
                     THEN ${Accounting.journal_entries.selectOptionColumns.amount} ELSE 0 END)
          WHEN ${Master.charts_of_accounts.selectOptionColumns.type} IN ('LIABILITY', 'LIABILITIES', 'EQUITY') THEN
            SUM(CASE WHEN ${Accounting.journal_entries.selectOptionColumns.type} = 'CREDIT'
                     THEN ${Accounting.journal_entries.selectOptionColumns.amount} ELSE 0 END) -
            SUM(CASE WHEN ${Accounting.journal_entries.selectOptionColumns.type} = 'DEBIT'
                     THEN ${Accounting.journal_entries.selectOptionColumns.amount} ELSE 0 END)
          ELSE
            SUM(CASE WHEN ${Accounting.journal_entries.selectOptionColumns.type} = 'DEBIT'
                     THEN ${Accounting.journal_entries.selectOptionColumns.amount} ELSE 0 END) -
            SUM(CASE WHEN ${Accounting.journal_entries.selectOptionColumns.type} = 'CREDIT'
                     THEN ${Accounting.journal_entries.selectOptionColumns.amount} ELSE 0 END)
          END AS account_balance
        FROM ${Master.charts_of_accounts.tablename}
        LEFT JOIN ${Accounting.journal_entries.tablename}
          ON ${Accounting.journal_entries.selectOptionColumns.coa_id} = ${Master.charts_of_accounts.selectOptionColumns.id}
          ${validJeCondition} /* Enforced Null Checks */
        WHERE ${Master.charts_of_accounts.selectOptionColumns.status} = 'ACTIVE'
          ${dateFilter}
          ${approvalFilter}
        GROUP BY ${Master.charts_of_accounts.selectOptionColumns.id}, ${Master.charts_of_accounts.selectOptionColumns.type}
      ) AS account_balances
    `
    const balanceSheetResult = await Query(balance_sheet_check_query)
    const totalAssets = parseFloat(balanceSheetResult[0]?.totalAssets || 0)
    const totalLiabilitiesEquity =
      parseFloat(balanceSheetResult[0]?.totalLiabilitiesEquity || 0) + netIncome
    const balanceSheetDifference = Math.abs(totalAssets - totalLiabilitiesEquity)
    const balanceSheetBalanced = balanceSheetDifference < 0.01

    // Aging is evaluated as of today; endDate only limits the transaction population.
    const agingAsOfDate = new Date().toISOString().split('T')[0]

    // Overdue AR count and amount
    const overdue_ar_query = `
      SELECT COUNT(*) AS overdueCount, COALESCE(SUM(open_sales.open_amount), 0) AS overdueAmount
      FROM (
        SELECT COALESCE(
                 STR_TO_DATE(s.${Accounting.sales.selectOptionColumns.date_due}, '%Y-%m-%d'),
                 STR_TO_DATE(s.${Accounting.sales.selectOptionColumns.date_due}, '%m/%d/%Y'),
                 STR_TO_DATE(s.${Accounting.sales.selectOptionColumns.date_due}, '%m-%d-%Y')
               ) AS due_date,
               s.${Accounting.sales.selectOptionColumns.total_amount_due} - COALESCE(collected.amount, 0) AS open_amount
        FROM ${Accounting.sales.tablename} s
        LEFT JOIN (
          SELECT si.${Accounting.sales_items.selectOptionColumns.sales_id} AS sales_id,
                 SUM(ci.${Accounting.collection_items.selectOptionColumns.amount}) AS amount
          FROM ${Accounting.collection_items.tablename} ci
          INNER JOIN ${Accounting.sales_items.tablename} si
            ON si.${Accounting.sales_items.selectOptionColumns.id} = ci.${Accounting.collection_items.selectOptionColumns.sales_id}
          INNER JOIN ${Accounting.collections.tablename} c
            ON c.${Accounting.collections.selectOptionColumns.id} = ci.${Accounting.collection_items.selectOptionColumns.collection_id}
          WHERE c.${Accounting.collections.selectOptionColumns.state} = 'APPROVED'
            AND c.${Accounting.collections.selectOptionColumns.collection_date} <= '${endDate}'
          GROUP BY si.${Accounting.sales_items.selectOptionColumns.sales_id}
        ) collected ON collected.sales_id = s.${Accounting.sales.selectOptionColumns.id}
        WHERE s.${Accounting.sales.selectOptionColumns.state} = 'APPROVED'
          AND s.${Accounting.sales.selectOptionColumns.date_delivered} <= '${endDate}'
      ) open_sales
      WHERE open_sales.due_date < '${agingAsOfDate}'
        AND open_sales.open_amount > 0
    `
    const overdueARResult = await Query(overdue_ar_query)
    const overdueARCount = overdueARResult[0]?.overdueCount || 0
    const overdueARAmount = overdueARResult[0]?.overdueAmount || 0

    // Overdue AP count and amount
    const today = new Date().toISOString().split('T')[0]
    const overdue_ap_query = sql
      .select([
        { col: `COUNT(*)`, as: 'overdueCount' },
        {
          col: `SUM(${Accounting.purchase.selectOptionColumns.total_amount_due})`,
          as: 'overdueAmount',
        },
      ])
      .from(Accounting.purchase.tablename)
      .where(`${Accounting.purchase.selectOptionColumns.date_due} < '${today}'`)
      .andWhere(
        `(${Accounting.purchase.selectOptionColumns.status} = 'UNPAID' OR ${Accounting.purchase.selectOptionColumns.status} = 'PARTIAL')`,
      )
      .build()
    const overdueAPResult = await Query(overdue_ap_query)
    const overdueAPCount = overdueAPResult[0]?.overdueCount || 0
    const overdueAPAmount = overdueAPResult[0]?.overdueAmount || 0

    // Payments Rate - approved payments linked to each approved purchase.
    // The purchase status is retained as a fallback for legacy payment records.
    const total_purchase_count_query = `
      SELECT
        COUNT(*) AS totalPurchases,
        SUM(
          CASE WHEN p.${Accounting.purchase.selectOptionColumns.status} = 'PAID'
            OR EXISTS (
              SELECT 1
              FROM ${Accounting.payment_items.tablename} pi
              INNER JOIN ${Accounting.payments.tablename} pay
                ON pay.${Accounting.payments.selectOptionColumns.id} = pi.${Accounting.payment_items.selectOptionColumns.payment_id}
              INNER JOIN ${Accounting.purchase_items.tablename} puri
                ON puri.${Accounting.purchase_items.selectOptionColumns.id} = pi.${Accounting.payment_items.selectOptionColumns.purchase_id}
              WHERE puri.${Accounting.purchase_items.selectOptionColumns.purchase_id} = p.${Accounting.purchase.selectOptionColumns.id}
                AND pay.${Accounting.payments.selectOptionColumns.state} = 'APPROVED'
            )
          THEN 1 ELSE 0 END
        ) AS paidPurchases
      FROM ${Accounting.purchase.tablename} p
      WHERE p.${Accounting.purchase.selectOptionColumns.state} = 'APPROVED'
        AND p.${Accounting.purchase.selectOptionColumns.date_delivered} >= '${startDate}'
        AND p.${Accounting.purchase.selectOptionColumns.date_delivered} <= '${endDate}'
    `
    const totalPurchasesResult = await Query(total_purchase_count_query)
    const totalPurchases = parseFloat(totalPurchasesResult[0]?.totalPurchases || 0)
    const paidPurchases = parseFloat(totalPurchasesResult[0]?.paidPurchases || 0)

    // Payments Rate calculation
    let paymentsRate = 0
    if (totalPurchases > 0) {
      paymentsRate = ((paidPurchases / totalPurchases) * 100).toFixed(1)
    }

    // ==================== PERIOD COMPARISON TREND CHARTS ====================

    // Revenue vs Expenses trend (monthly comparison)
    const revenue_expense_trend_query = `
      SELECT 
        month,
        SUM(CASE WHEN account_type = 'REVENUE' THEN account_balance ELSE 0 END) AS revenue,
        SUM(CASE WHEN account_type = 'EXPENSES' THEN account_balance ELSE 0 END) AS expenses
      FROM (
        SELECT 
          SUBSTR(${Accounting.journal_entries.selectOptionColumns.date}, 1, 7) AS month,
          ${Master.charts_of_accounts.selectOptionColumns.type} AS account_type,
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
            ELSE 0
          END AS account_balance
        FROM ${Master.charts_of_accounts.tablename}
        LEFT JOIN ${Accounting.journal_entries.tablename}
          ON ${Accounting.journal_entries.selectOptionColumns.coa_id} = ${Master.charts_of_accounts.selectOptionColumns.id}
          ${validJeCondition} /* Enforced Null Checks */
        WHERE ${Master.charts_of_accounts.selectOptionColumns.status} = 'ACTIVE'
          ${dateFilter}
          AND ${Master.charts_of_accounts.selectOptionColumns.type} IN ('REVENUE', 'EXPENSES')
          ${approvalFilter}
        GROUP BY SUBSTR(${Accounting.journal_entries.selectOptionColumns.date}, 1, 7), 
                 ${Master.charts_of_accounts.selectOptionColumns.id},
                 ${Master.charts_of_accounts.selectOptionColumns.type}
      ) AS monthly_balances
      GROUP BY month
      ORDER BY month
    `
    const revenueExpenseTrend = await Query(revenue_expense_trend_query)

    // Cash In vs Cash Out trend (Collections vs Disbursements by month)
    const cash_flow_trend_query = `
      SELECT 
        'collection' AS type,
        SUBSTR(${Accounting.collections.selectOptionColumns.collection_date}, 1, 7) AS month,
        COALESCE(SUM(${Accounting.collection_items.selectOptionColumns.amount}), 0) AS amount
      FROM ${Accounting.collections.tablename}
      LEFT JOIN ${Accounting.collection_items.tablename}
        ON ${Accounting.collection_items.selectOptionColumns.collection_id} = ${Accounting.collections.selectOptionColumns.id}
      WHERE ${Accounting.collections.selectOptionColumns.state} = 'APPROVED'
        AND ${Accounting.collections.selectOptionColumns.collection_date} >= '${startDate}'
        AND ${Accounting.collections.selectOptionColumns.collection_date} <= '${endDate}'
      GROUP BY SUBSTR(${Accounting.collections.selectOptionColumns.collection_date}, 1, 7)
      
      UNION ALL
      
      SELECT 
        'disbursement' AS type,
        SUBSTR(${Accounting.cash_disbursements.selectOptionColumns.payment_date}, 1, 7) AS month,
        COALESCE(SUM(${Accounting.cash_disbursements.selectOptionColumns.total_amount_due}), 0) AS amount
      FROM ${Accounting.cash_disbursements.tablename}
      WHERE ${Accounting.cash_disbursements.selectOptionColumns.state} = 'APPROVED'
        AND ${Accounting.cash_disbursements.selectOptionColumns.payment_date} >= '${startDate}'
        AND ${Accounting.cash_disbursements.selectOptionColumns.payment_date} <= '${endDate}'
      GROUP BY SUBSTR(${Accounting.cash_disbursements.selectOptionColumns.payment_date}, 1, 7)
      
      ORDER BY month, type
    `
    const cashFlowTrend = await Query(cash_flow_trend_query)

    // ==================== TOP VENDOR PAYABLES DUE ====================
    const top_vendors_query = `
      SELECT 
        v.${Master.vendors.selectOptionColumns.name} AS vendorName,
        p.${Accounting.purchase.selectOptionColumns.id} AS purchaseId,
        p.${Accounting.purchase.selectOptionColumns.document_reference} AS invoiceNumber,
        p.${Accounting.purchase.selectOptionColumns.date_due} AS dueDate,
        p.${Accounting.purchase.selectOptionColumns.total_amount_due} AS amount,
        p.${Accounting.purchase.selectOptionColumns.status} AS status
      FROM ${Accounting.purchase.tablename} p
      LEFT JOIN ${Master.vendors.tablename} v ON p.${Accounting.purchase.selectOptionColumns.vendor_id} = v.${Master.vendors.selectOptionColumns.id}
      WHERE (p.${Accounting.purchase.selectOptionColumns.status} = 'UNPAID' OR p.${Accounting.purchase.selectOptionColumns.status} = 'PARTIAL')
        AND p.${Accounting.purchase.selectOptionColumns.state} = 'APPROVED'
        AND p.${Accounting.purchase.selectOptionColumns.date_delivered} >= '${startDate}'
        AND p.${Accounting.purchase.selectOptionColumns.date_delivered} <= '${endDate}'
      ORDER BY p.${Accounting.purchase.selectOptionColumns.date_due} ASC
      LIMIT 5
    `
    const topVendorsResult = await Query(
      top_vendors_query,
      [],
      [Accounting.purchase.prefix_, Master.vendors.prefix_],
    )

    // ==================== BANK RECONCILIATION STATUS ====================
    const bookBalanceExpression = `COALESCE(je_summary.book_balance, br.${Accounting.bank_reconciliation.selectOptionColumns.running_balance}, 0)`
    const bankStatementExpression = 'COALESCE(bank_summary.bank_balance, 0)'
    const bankBalanceExpression = `
      ${bankStatementExpression} +
      CASE WHEN ${bankStatementExpression} = 0 THEN 0 ELSE
        COALESCE(timing_summary.deposits_in_transit, 0) -
        COALESCE(timing_summary.outstanding_checks, 0)
      END
    `

    const bank_accounts_query = `
      SELECT
        br.${Accounting.bank_reconciliation.selectOptionColumns.id} AS id,
        br.${Accounting.bank_reconciliation.selectOptionColumns.bank_account} AS bankAccount,
        coa.${Master.charts_of_accounts.selectOptionColumns.name} AS accountName,
        COALESCE(je_summary.book_balance, br.${Accounting.bank_reconciliation.selectOptionColumns.running_balance}, 0) AS glBalance,
        ${bankBalanceExpression} AS bankBalance,
        CASE
          WHEN COALESCE(bank_summary.unmatched_count, 0) = 0
            AND ABS(
              COALESCE(je_summary.book_balance, br.${Accounting.bank_reconciliation.selectOptionColumns.running_balance}, 0) -
              ${bankBalanceExpression}
            ) < 0.01 THEN 1
          ELSE 0
        END AS reconciled,
        ABS(
          COALESCE(je_summary.book_balance, br.${Accounting.bank_reconciliation.selectOptionColumns.running_balance}, 0) -
          ${bankBalanceExpression}
        ) AS variance,
        COALESCE(bank_summary.unmatched_count, 0) AS unreconciledCount
      FROM ${Accounting.bank_reconciliation.tablename} br
      INNER JOIN ${Master.charts_of_accounts.tablename} coa
        ON br.${Accounting.bank_reconciliation.selectOptionColumns.coa_id} = coa.${Master.charts_of_accounts.selectOptionColumns.id}
      LEFT JOIN (
        SELECT
          ${Accounting.bank_reconciliation_items.selectOptionColumns.br_id} AS br_id,
          SUM(
            CASE
              WHEN COALESCE(${Accounting.bank_reconciliation_items.selectOptionColumns.details}, '') = 'error_bank'
                THEN 0
              ELSE COALESCE(${Accounting.bank_reconciliation_items.selectOptionColumns.credit}, 0) - COALESCE(${Accounting.bank_reconciliation_items.selectOptionColumns.debit}, 0)
            END
          ) AS bank_balance,
          SUM(
            CASE
              WHEN ${Accounting.bank_reconciliation_items.selectOptionColumns.ledger_id} IS NULL
                OR ${Accounting.bank_reconciliation_items.selectOptionColumns.ledger_id} = 0
                THEN 1
              ELSE 0
            END
          ) AS unmatched_count
        FROM ${Accounting.bank_reconciliation_items.tablename}
        GROUP BY ${Accounting.bank_reconciliation_items.selectOptionColumns.br_id}
      ) bank_summary
        ON bank_summary.br_id = br.${Accounting.bank_reconciliation.selectOptionColumns.id}
      LEFT JOIN (
        SELECT
          br_t.${Accounting.bank_reconciliation.selectOptionColumns.id} AS br_id,
          SUM(
            CASE
              WHEN (
                LOWER(je.${Accounting.journal_entries.selectOptionColumns.type}) = 'debit'
                AND (
                  LOWER(je.${Accounting.journal_entries.selectOptionColumns.db_name}) LIKE '%receipt%'
                  OR LOWER(je.${Accounting.journal_entries.selectOptionColumns.db_name}) LIKE '%collection%'
                )
              ) THEN COALESCE(je.${Accounting.journal_entries.selectOptionColumns.amount}, 0)
              ELSE 0
            END
          ) AS deposits_in_transit,
          SUM(
            CASE
              WHEN (
                LOWER(je.${Accounting.journal_entries.selectOptionColumns.type}) = 'credit'
                AND (
                  LOWER(je.${Accounting.journal_entries.selectOptionColumns.db_name}) LIKE '%payment%'
                  OR LOWER(je.${Accounting.journal_entries.selectOptionColumns.db_name}) LIKE '%disbursement%'
                  OR LOWER(je.${Accounting.journal_entries.selectOptionColumns.db_name}) LIKE '%receipt%'
                  OR LOWER(je.${Accounting.journal_entries.selectOptionColumns.db_name}) LIKE '%collection%'
                )
              )
              OR (
                LOWER(je.${Accounting.journal_entries.selectOptionColumns.type}) = 'debit'
                AND LOWER(je.${Accounting.journal_entries.selectOptionColumns.db_name}) LIKE '%disbursement%'
              ) THEN ABS(COALESCE(je.${Accounting.journal_entries.selectOptionColumns.amount}, 0))
              ELSE 0
            END
          ) AS outstanding_checks
        FROM ${Accounting.bank_reconciliation.tablename} br_t
        INNER JOIN ${Accounting.journal_entries.tablename} je
          ON je.${Accounting.journal_entries.selectOptionColumns.coa_id} = br_t.${Accounting.bank_reconciliation.selectOptionColumns.coa_id}
        WHERE NOT EXISTS (
          SELECT 1
          FROM ${Accounting.bank_reconciliation_items.tablename} matched_item
          WHERE matched_item.${Accounting.bank_reconciliation_items.selectOptionColumns.br_id} = br_t.${Accounting.bank_reconciliation.selectOptionColumns.id}
            AND matched_item.${Accounting.bank_reconciliation_items.selectOptionColumns.ledger_id} = je.${Accounting.journal_entries.selectOptionColumns.id}
        )
        GROUP BY br_t.${Accounting.bank_reconciliation.selectOptionColumns.id}
      ) timing_summary
        ON timing_summary.br_id = br.${Accounting.bank_reconciliation.selectOptionColumns.id}
      LEFT JOIN (
        SELECT
          ${Accounting.journal_entries.selectOptionColumns.coa_id} AS coa_id,
          SUM(
            CASE
              WHEN LOWER(${Accounting.journal_entries.selectOptionColumns.type}) = 'debit'
                THEN COALESCE(${Accounting.journal_entries.selectOptionColumns.amount}, 0)
              WHEN LOWER(${Accounting.journal_entries.selectOptionColumns.type}) = 'credit'
                THEN -COALESCE(${Accounting.journal_entries.selectOptionColumns.amount}, 0)
              ELSE 0
            END
          ) AS book_balance
        FROM ${Accounting.journal_entries.tablename}
        WHERE 1=1 ${validJeCondition}
        GROUP BY ${Accounting.journal_entries.selectOptionColumns.coa_id}
      ) je_summary
        ON je_summary.coa_id = br.${Accounting.bank_reconciliation.selectOptionColumns.coa_id}
      ORDER BY coa.${Master.charts_of_accounts.selectOptionColumns.name}
    `
    const bankAccountsResult = await Query(
      bank_accounts_query,
      [],
      [Master.charts_of_accounts.prefix_, Accounting.journal_entries.prefix_],
    )

    const bankAccounts = bankAccountsResult.map((account) => ({
      ...account,
      reconciled: Boolean(account.reconciled),
    }))

    // ==================== TAX DATA (VAT & WHT) ====================
    // Output VAT - from journal entries with COA name 'Output VAT'
    const output_vat_query = `
      SELECT 
        SUM(CASE WHEN ${Accounting.journal_entries.selectOptionColumns.type} = 'CREDIT'
                 THEN ${Accounting.journal_entries.selectOptionColumns.amount} 
                 ELSE -${Accounting.journal_entries.selectOptionColumns.amount} END) AS outputVAT
      FROM ${Accounting.journal_entries.tablename}
      INNER JOIN ${Master.charts_of_accounts.tablename}
        ON ${Accounting.journal_entries.selectOptionColumns.coa_id} = ${Master.charts_of_accounts.selectOptionColumns.id}
      WHERE ${Master.charts_of_accounts.selectOptionColumns.name} = 'Output VAT'
        ${validJeCondition}
        ${dateFilter}
        ${approvalFilter}
    `
    const outputVATResult = await Query(output_vat_query)
    const outputVAT = parseFloat(outputVATResult[0]?.outputVAT || 0)

    // Input VAT - from journal entries with COA name 'Input VAT'
    const input_vat_query = `
      SELECT 
        SUM(CASE WHEN ${Accounting.journal_entries.selectOptionColumns.type} = 'DEBIT'
                 THEN ${Accounting.journal_entries.selectOptionColumns.amount} 
                 ELSE -${Accounting.journal_entries.selectOptionColumns.amount} END) AS inputVAT
      FROM ${Accounting.journal_entries.tablename}
      INNER JOIN ${Master.charts_of_accounts.tablename}
        ON ${Accounting.journal_entries.selectOptionColumns.coa_id} = ${Master.charts_of_accounts.selectOptionColumns.id}
      WHERE ${Master.charts_of_accounts.selectOptionColumns.name} = 'Input VAT'
        ${validJeCondition}
        ${dateFilter}
        ${approvalFilter}
    `
    const inputVATResult = await Query(input_vat_query)
    const inputVAT = parseFloat(inputVATResult[0]?.inputVAT || 0)

    // Net VAT Payable - calculated as Output VAT minus Input VAT
    // Daily transactions accumulate in Output VAT (Sales) and Input VAT (Purchases)
    // VAT Payable account is only used during VAT settlement at period end
    const vatPayable = outputVAT - inputVAT

    // Withholding Tax - Expanded (200-1300) - Liability account for purchases/disbursements
    // This is the Withholding Tax Payable account for supplier withholding tax
    const wt_expanded_query = `
      SELECT 
        SUM(CASE WHEN ${Accounting.journal_entries.selectOptionColumns.type} = 'CREDIT'
                 THEN ${Accounting.journal_entries.selectOptionColumns.amount} 
                 ELSE -${Accounting.journal_entries.selectOptionColumns.amount} END) AS wtExpanded
      FROM ${Accounting.journal_entries.tablename}
      INNER JOIN ${Master.charts_of_accounts.tablename}
        ON ${Accounting.journal_entries.selectOptionColumns.coa_id} = ${Master.charts_of_accounts.selectOptionColumns.id}
      WHERE ${Master.charts_of_accounts.selectOptionColumns.name} = 'Withholding Tax - Expanded'
        ${validJeCondition}
        ${dateFilter}
        ${approvalFilter}
    `
    const wtExpandedResult = await Query(wt_expanded_query)
    // Liability credit balances are presented as positive amounts owed.
    const wtExpanded = parseFloat(wtExpandedResult[0]?.wtExpanded || 0)

    // Creditable Withholding Tax - from journal entries with COA name 'Creditable Withholding Tax'
    // For asset accounts, debit balance means asset held (positive)
    const wt_creditable_query = `
      SELECT 
        SUM(CASE WHEN ${Accounting.journal_entries.selectOptionColumns.type} = 'DEBIT'
                 THEN ${Accounting.journal_entries.selectOptionColumns.amount} 
                 ELSE -${Accounting.journal_entries.selectOptionColumns.amount} END) AS wtCreditable
      FROM ${Accounting.journal_entries.tablename}
      INNER JOIN ${Master.charts_of_accounts.tablename}
        ON ${Accounting.journal_entries.selectOptionColumns.coa_id} = ${Master.charts_of_accounts.selectOptionColumns.id}
      WHERE ${Master.charts_of_accounts.selectOptionColumns.name} = 'Creditable Withholding Tax'
        ${validJeCondition}
        ${dateFilter}
        ${approvalFilter}
    `
    const wtCreditableResult = await Query(wt_creditable_query)
    const wtCreditable = parseFloat(wtCreditableResult[0]?.wtCreditable || 0)

    // ==================== AR AGING DATA ====================
    const ar_aging_query = `
      SELECT
        COALESCE(SUM(CASE WHEN open_sales.due_date >= '${agingAsOfDate}' THEN open_sales.open_amount ELSE 0 END), 0) AS current,
        COALESCE(SUM(CASE WHEN open_sales.due_date < '${agingAsOfDate}' THEN open_sales.open_amount ELSE 0 END), 0) AS overdue_total,
        COALESCE(SUM(CASE WHEN open_sales.due_date < '${agingAsOfDate}' AND open_sales.due_date >= DATE_SUB('${agingAsOfDate}', INTERVAL 30 DAY) THEN open_sales.open_amount ELSE 0 END), 0) AS overdue_1_30,
        COALESCE(SUM(CASE WHEN open_sales.due_date < DATE_SUB('${agingAsOfDate}', INTERVAL 30 DAY) AND open_sales.due_date >= DATE_SUB('${agingAsOfDate}', INTERVAL 60 DAY) THEN open_sales.open_amount ELSE 0 END), 0) AS overdue_31_60,
        COALESCE(SUM(CASE WHEN open_sales.due_date < DATE_SUB('${agingAsOfDate}', INTERVAL 60 DAY) THEN open_sales.open_amount ELSE 0 END), 0) AS overdue_61_plus
      FROM (
        SELECT COALESCE(
                 STR_TO_DATE(s.${Accounting.sales.selectOptionColumns.date_due}, '%Y-%m-%d'),
                 STR_TO_DATE(s.${Accounting.sales.selectOptionColumns.date_due}, '%m/%d/%Y'),
                 STR_TO_DATE(s.${Accounting.sales.selectOptionColumns.date_due}, '%m-%d-%Y')
               ) AS due_date,
               s.${Accounting.sales.selectOptionColumns.total_amount_due} - COALESCE(collected.amount, 0) AS open_amount
        FROM ${Accounting.sales.tablename} s
        LEFT JOIN (
          SELECT si.${Accounting.sales_items.selectOptionColumns.sales_id} AS sales_id,
                 SUM(ci.${Accounting.collection_items.selectOptionColumns.amount}) AS amount
          FROM ${Accounting.collection_items.tablename} ci
          INNER JOIN ${Accounting.sales_items.tablename} si
            ON si.${Accounting.sales_items.selectOptionColumns.id} = ci.${Accounting.collection_items.selectOptionColumns.sales_id}
          INNER JOIN ${Accounting.collections.tablename} c
            ON c.${Accounting.collections.selectOptionColumns.id} = ci.${Accounting.collection_items.selectOptionColumns.collection_id}
          WHERE c.${Accounting.collections.selectOptionColumns.state} = 'APPROVED'
            AND c.${Accounting.collections.selectOptionColumns.collection_date} <= '${endDate}'
          GROUP BY si.${Accounting.sales_items.selectOptionColumns.sales_id}
        ) collected ON collected.sales_id = s.${Accounting.sales.selectOptionColumns.id}
        WHERE s.${Accounting.sales.selectOptionColumns.state} = 'APPROVED'
          AND s.${Accounting.sales.selectOptionColumns.date_delivered} <= '${endDate}'
      ) open_sales
      WHERE open_sales.open_amount > 0
    `
    const arAgingResult = await Query(ar_aging_query)
    const arAging = arAgingResult[0] || {
      current: 0,
      overdue_total: 0,
      overdue_1_30: 0,
      overdue_31_60: 0,
      overdue_61_plus: 0,
    }

    // Ensure all values are numbers
    arAging.current = parseFloat(arAging.current || 0)
    arAging.overdue_total = parseFloat(arAging.overdue_total || 0)
    arAging.overdue_1_30 = parseFloat(arAging.overdue_1_30 || 0)
    arAging.overdue_31_60 = parseFloat(arAging.overdue_31_60 || 0)
    arAging.overdue_61_plus = parseFloat(arAging.overdue_61_plus || 0)

    // ==================== RECENT TRANSACTIONS ====================
    const recent_transactions_query = `
      SELECT
        CASE
          WHEN ${Accounting.journal_entries.selectOptionColumns.db_name} = 'receipts' THEN 'Receipt'
          WHEN ${Accounting.journal_entries.selectOptionColumns.db_name} = 'cash_disbursements' THEN 'Disbursement'
          WHEN ${Accounting.journal_entries.selectOptionColumns.db_name} = 'sales' THEN 'Sales Invoice'
          WHEN ${Accounting.journal_entries.selectOptionColumns.db_name} = 'purchase' THEN 'Purchase'
          WHEN ${Accounting.journal_entries.selectOptionColumns.db_name} = 'payments' THEN 'Payment'
          WHEN ${Accounting.journal_entries.selectOptionColumns.db_name} = 'collections' THEN 'Collection'
          WHEN ${Accounting.journal_entries.selectOptionColumns.db_name} = 'adjustments' THEN 'Adjustment'
          ELSE ${Accounting.journal_entries.selectOptionColumns.db_name}
        END AS module,
        ${Accounting.journal_entries.selectOptionColumns.db_id} AS refNo,
        ${Accounting.journal_entries.selectOptionColumns.db_id} AS party,
        ${Accounting.journal_entries.selectOptionColumns.db_name} AS sourceModule,
        ${Accounting.journal_entries.selectOptionColumns.db_name} AS sourceRoute,
        ${Accounting.journal_entries.selectOptionColumns.responsibility_center} AS responsibilityCenter,
        ${Accounting.journal_entries.selectOptionColumns.amount} AS amount,
        ${Accounting.journal_entries.selectOptionColumns.type} AS entryType,
        CASE
          WHEN ${Accounting.journal_entries.selectOptionColumns.db_name} = 'receipts' THEN r.${Accounting.receipts.selectOptionColumns.collection_date}
          WHEN ${Accounting.journal_entries.selectOptionColumns.db_name} = 'cash_disbursements' THEN cd.${Accounting.cash_disbursements.selectOptionColumns.payment_date}
          WHEN ${Accounting.journal_entries.selectOptionColumns.db_name} = 'sales' THEN s.${Accounting.sales.selectOptionColumns.date_delivered}
          WHEN ${Accounting.journal_entries.selectOptionColumns.db_name} = 'collections' THEN c.${Accounting.collections.selectOptionColumns.collection_date}
          WHEN ${Accounting.journal_entries.selectOptionColumns.db_name} = 'purchase' THEN p.${Accounting.purchase.selectOptionColumns.date_delivered}
          WHEN ${Accounting.journal_entries.selectOptionColumns.db_name} = 'payments' THEN pay.${Accounting.payments.selectOptionColumns.payment_date}
          WHEN ${Accounting.journal_entries.selectOptionColumns.db_name} = 'adjustments' THEN a.${Accounting.adjustments.selectOptionColumns.posting_date}
          ELSE ${Accounting.journal_entries.selectOptionColumns.date}
        END AS date,
        'POSTED' AS status
      FROM ${Accounting.journal_entries.tablename}
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
      WHERE 1=1
        ${validJeCondition}
        ${dateFilter}
        ${approvalFilter}
      ORDER BY date DESC
      LIMIT 10
    `
    const recentTransactionsResult = await Query(
      recent_transactions_query,
      [],
      [Accounting.journal_entries.prefix_],
    )

    // ==================== COMBINE ALL DATA ====================

    const data = {
      fh: {
        netIncome,
        grossRevenue,
        marginPercent,
        totalCashPosition,
        totalReceivables,
        totalPayables,
        workingCapital: totalCashPosition + totalReceivables - totalPayables,
        netCashMovement,
        collectionsRate,
        paymentsRate,
        cashBreakdown: {
          cashOnHand,
          pettyCash,
          bankAccounts: bankAccountsBalance,
          checks,
        },
      },
      cf: {
        totalReceipts,
        totalCollections,
        totalDisbursements,
        totalPayments,
        netCashMovement,
      },
      tax: {
        outputVAT,
        inputVAT,
        netVATPayable: vatPayable,
        wtExpanded,
        wtCreditable,
      },
      arAging,
      topVendors: topVendorsResult,
      bankAccounts,
      recentTransactions: recentTransactionsResult,
      revenueExpenses: revenueExpenseTrend,
      financialHealth: {
        netIncome,
        totalCashPosition,
        cashBreakdown: {
          cashOnHand,
          pettyCash,
          bankAccounts: bankAccountsBalance,
          checks,
        },
        totalReceivables,
        totalPayables,
        workingCapital: totalCashPosition + totalReceivables - totalPayables,
        collectionsRate,
        paymentsRate,
      },
      cashFlowActivity: {
        totalReceipts,
        totalCollections,
        totalDisbursements,
        totalPayments,
        netCashMovement,
      },
      transactionVolume: {
        salesCount,
        purchaseCount,
        disbursementCount,
        adjustmentCount,
        totalTransactions:
          salesCount + purchaseCount + disbursementCount + adjustmentCount,
      },
      alerts: {
        trialBalance: {
          balanced: trialBalanceBalanced,
          difference: trialBalanceDifference,
          totalDebit,
          totalCredit,
        },
        balanceSheet: {
          balanced: balanceSheetBalanced,
          difference: balanceSheetDifference,
          totalAssets,
          totalLiabilitiesEquity,
        },
        overdueReceivables: {
          count: overdueARCount,
          amount: overdueARAmount,
        },
        overduePayables: {
          count: overdueAPCount,
          amount: overdueAPAmount,
        },
      },
      trends: {
        revenueVsExpenses: revenueExpenseTrend,
        cashFlow: cashFlowTrend,
      },
      period: {
        startDate,
        endDate,
      },
      timestamp: new Date(),
    }

    return res.status(200).json({
      success: true,
      message: 'Dashboard data retrieved successfully',
      data,
    })
  } catch (error) {
    console.error('Error fetching dashboard data:', error)
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching dashboard data',
      error:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Internal server error',
    })
  }
}

module.exports = {
  getDashboardData,
}
