const os = require('os')
const { checkConnection, SelectAll , Transaction, Query, Insert, SelectWithCondition} = require('../database/util/queries.util')
const { formatMemoryUsage, formatTime, DataModeling } = require('../util/helper.util')
const { Master } = require('../database/model/Master')
const { Accounting } = require('../database/model/Accounting')
const { SQLQueryBuilder } = require('../util/helper.util')
const sql = new SQLQueryBuilder()

require('dotenv').config()

const getDashboardData = async (req, res, next) => {
  try {
    const { start_date, end_date } = req.query;

    // Default to current month if no dates provided
    let startDate = start_date;
    let endDate = end_date;
    if (!start_date && !end_date) {
      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      startDate = firstDay.toISOString().split('T')[0];
      endDate = lastDay.toISOString().split('T')[0];
    }

    // Reuseable snippet to enforce complete journal entry items
    const validJeCondition = `
      AND ${Accounting.journal_entries.selectOptionColumns.db_name} IS NOT NULL
      AND ${Accounting.journal_entries.selectOptionColumns.db_id} IS NOT NULL
      AND ${Accounting.journal_entries.selectOptionColumns.coa_id} IS NOT NULL
    `;

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
    `;

    // ==================== FINANCIAL HEALTH (Quick KPIs) ====================

    // Net Income - from Income Statement logic (using subquery to avoid nested aggregates)
    const net_income_query = `
      SELECT 
        SUM(CASE 
          WHEN account_type = 'REVENUE' THEN account_balance
          WHEN account_type = 'EXPENSES' THEN -account_balance
          ELSE 0
        END) AS netIncome
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
          AND (${Accounting.journal_entries.selectOptionColumns.date} >= '${startDate}' 
               OR ${Accounting.journal_entries.selectOptionColumns.date} IS NULL)
          ${approvalFilter}
        GROUP BY ${Master.charts_of_accounts.selectOptionColumns.id}, ${Master.charts_of_accounts.selectOptionColumns.type}
      ) AS account_balances
    `;
    const netIncomeResult = await Query(net_income_query);
    const netIncome = parseFloat(netIncomeResult[0]?.netIncome || 0);

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
          AND (${Accounting.journal_entries.selectOptionColumns.date} >= '${startDate}' 
               OR ${Accounting.journal_entries.selectOptionColumns.date} IS NULL)
          ${approvalFilter}
        GROUP BY ${Master.charts_of_accounts.selectOptionColumns.id}, 
                 ${Master.charts_of_accounts.selectOptionColumns.code}, 
                 ${Master.charts_of_accounts.selectOptionColumns.name}
      ) AS account_balances
    `;
    const cashBreakdownResult = await Query(cash_breakdown_query);
    const cashOnHand = parseFloat(cashBreakdownResult[0]?.cashOnHand || 0);
    const pettyCash = parseFloat(cashBreakdownResult[0]?.pettyCash || 0);
    const bankAccounts = parseFloat(cashBreakdownResult[0]?.bankAccounts || 0);
    const checks = parseFloat(cashBreakdownResult[0]?.checks || 0);
    const totalCashPosition = cashOnHand + pettyCash + bankAccounts + checks;

    // Total Receivables (AR) - Sales not yet collected
    const receivables_query = sql.select([
      { col: `SUM(${Accounting.sales.selectOptionColumns.total_amount_due})`, as: 'totalReceivables' }
    ])
    .from(Accounting.sales.tablename)
    .where(`${Accounting.sales.selectOptionColumns.status} = 'UNPAID' OR ${Accounting.sales.selectOptionColumns.status} = 'PARTIAL'`)
    .build();
    const receivablesResult = await Query(receivables_query);
    const totalReceivables = parseFloat(receivablesResult[0]?.totalReceivables || 0);

    // Total Payables (AP) - Purchases not yet paid
    const payables_query = sql.select([
      { col: `SUM(${Accounting.purchase.selectOptionColumns.total_amount_due})`, as: 'totalPayables' }
    ])
    .from(Accounting.purchase.tablename)
    .where(`${Accounting.purchase.selectOptionColumns.status} = 'UNPAID' OR ${Accounting.purchase.selectOptionColumns.status} = 'PARTIAL'`)
    .build();
    const payablesResult = await Query(payables_query);
    const totalPayables = parseFloat(payablesResult[0]?.totalPayables || 0);

    // ==================== CASH FLOW ACTIVITY ====================

    // Total Collections this period (sum from collection_items joined with collections)
    const collections_query = `
      SELECT SUM(${Accounting.collection_items.selectOptionColumns.amount}) AS totalCollections
      FROM ${Accounting.collection_items.tablename}
      JOIN ${Accounting.collections.tablename}
        ON ${Accounting.collection_items.selectOptionColumns.collection_id} = ${Accounting.collections.selectOptionColumns.id}
      WHERE ${Accounting.collections.selectOptionColumns.collection_date} >= '${startDate}'
        AND ${Accounting.collections.selectOptionColumns.collection_date} <= '${endDate}'
        AND ${Accounting.collections.selectOptionColumns.state} = 'APPROVED'
    `;
    const collectionsResult = await Query(collections_query);
    const totalCollections = parseFloat(collectionsResult[0]?.totalCollections || 0);

    // Total Disbursements this period
    const disbursements_query = sql.select([
      { col: `SUM(${Accounting.cash_disbursements.selectOptionColumns.total_amount_due})`, as: 'totalDisbursements' }
    ])
    .from(Accounting.cash_disbursements.tablename)
    .where(`${Accounting.cash_disbursements.selectOptionColumns.payment_date} >= '${startDate}'`)
    .andWhere(`${Accounting.cash_disbursements.selectOptionColumns.payment_date} <= '${endDate}'`)
    .andWhere(`${Accounting.cash_disbursements.selectOptionColumns.state} = 'APPROVED'`)
    .build();
    const disbursementsResult = await Query(disbursements_query);
    const totalDisbursements = parseFloat(disbursementsResult[0]?.totalDisbursements || 0);

    // Net Cash Movement
    const netCashMovement = totalCollections - totalDisbursements;

    // ==================== TRANSACTION VOLUME ====================

    // Number of Sales transactions
    const sales_count_query = sql.select([
      { col: `COUNT(*)`, as: 'salesCount' }
    ])
    .from(Accounting.sales.tablename)
    .where(`${Accounting.sales.selectOptionColumns.state} = 'APPROVED'`)
    .build();
    const salesCountResult = await Query(sales_count_query);
    const salesCount = parseInt(salesCountResult[0]?.salesCount || 0);

    // Number of Purchase transactions
    const purchase_count_query = sql.select([
      { col: `COUNT(*)`, as: 'purchaseCount' }
    ])
    .from(Accounting.purchase.tablename)
    .where(`${Accounting.purchase.selectOptionColumns.state} = 'APPROVED'`)
    .build();
    const purchaseCountResult = await Query(purchase_count_query);
    const purchaseCount = parseInt(purchaseCountResult[0]?.purchaseCount || 0);

    // Number of Cash Disbursements
    const disbursement_count_query = sql.select([
      { col: `COUNT(*)`, as: 'disbursementCount' }
    ])
    .from(Accounting.cash_disbursements.tablename)
    .where(`${Accounting.cash_disbursements.selectOptionColumns.state} = 'APPROVED'`)
    .build();
    const disbursementCountResult = await Query(disbursement_count_query);
    const disbursementCount = parseInt(disbursementCountResult[0]?.disbursementCount || 0);

    // Number of Adjustments posted
    const adjustment_count_query = sql.select([
      { col: `COUNT(*)`, as: 'adjustmentCount' }
    ])
    .from(Accounting.adjustments.tablename)
    .where(`${Accounting.adjustments.selectOptionColumns.status} = 'APPROVED'`)
    .build();
    const adjustmentCountResult = await Query(adjustment_count_query);
    const adjustmentCount = parseInt(adjustmentCountResult[0]?.adjustmentCount || 0);

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
    `;
    const trialBalanceResult = await Query(trial_balance_check_query);
    const totalDebit = parseFloat(trialBalanceResult[0]?.totalDebit || 0);
    const totalCredit = parseFloat(trialBalanceResult[0]?.totalCredit || 0);
    const trialBalanceDifference = Math.abs(totalDebit - totalCredit);
    const trialBalanceBalanced = trialBalanceDifference < 0.01;

    // Balance Sheet check (Assets = Liabilities + Equity)
    const balance_sheet_check_query = `
      SELECT 
        SUM(CASE WHEN account_type = 'ASSET' THEN account_balance ELSE 0 END) AS totalAssets,
        SUM(CASE WHEN account_type IN ('LIABILITY', 'EQUITY') THEN account_balance ELSE 0 END) AS totalLiabilitiesEquity
      FROM (
        SELECT 
          ${Master.charts_of_accounts.selectOptionColumns.type} AS account_type,
          SUM(CASE WHEN ${Accounting.journal_entries.selectOptionColumns.type} = 'DEBIT' 
                   THEN ${Accounting.journal_entries.selectOptionColumns.amount} ELSE 0 END) -
          SUM(CASE WHEN ${Accounting.journal_entries.selectOptionColumns.type} = 'CREDIT' 
                   THEN ${Accounting.journal_entries.selectOptionColumns.amount} ELSE 0 END) AS account_balance
        FROM ${Master.charts_of_accounts.tablename}
        LEFT JOIN ${Accounting.journal_entries.tablename}
          ON ${Accounting.journal_entries.selectOptionColumns.coa_id} = ${Master.charts_of_accounts.selectOptionColumns.id}
          ${validJeCondition} /* Enforced Null Checks */
        WHERE ${Master.charts_of_accounts.selectOptionColumns.status} = 'ACTIVE'
          ${approvalFilter}
        GROUP BY ${Master.charts_of_accounts.selectOptionColumns.id}, ${Master.charts_of_accounts.selectOptionColumns.type}
      ) AS account_balances
    `;
    const balanceSheetResult = await Query(balance_sheet_check_query);
    const totalAssets = parseFloat(balanceSheetResult[0]?.totalAssets || 0);
    const totalLiabilitiesEquity = parseFloat(balanceSheetResult[0]?.totalLiabilitiesEquity || 0);
    const balanceSheetDifference = Math.abs(totalAssets - totalLiabilitiesEquity);
    const balanceSheetBalanced = balanceSheetDifference < 0.01;

    // Overdue AR count and amount
    const today = new Date().toISOString().split('T')[0];
    const overdue_ar_query = sql.select([
      { col: `COUNT(*)`, as: 'overdueCount' },
      { col: `SUM(${Accounting.sales.selectOptionColumns.total_amount_due})`, as: 'overdueAmount' }
    ])
    .from(Accounting.sales.tablename)
    .where(`${Accounting.sales.selectOptionColumns.date_due} < '${today}'`)
    .andWhere(`(${Accounting.sales.selectOptionColumns.status} = 'UNPAID' OR ${Accounting.sales.selectOptionColumns.status} = 'PARTIAL')`)
    .build();
    const overdueARResult = await Query(overdue_ar_query);
    const overdueARCount = overdueARResult[0]?.overdueCount || 0;
    const overdueARAmount = overdueARResult[0]?.overdueAmount || 0;

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
          AND (${Accounting.journal_entries.selectOptionColumns.date} >= '${startDate}' 
               AND ${Accounting.journal_entries.selectOptionColumns.date} <= '${endDate}')
          AND ${Master.charts_of_accounts.selectOptionColumns.type} IN ('REVENUE', 'EXPENSES')
          ${approvalFilter}
        GROUP BY SUBSTR(${Accounting.journal_entries.selectOptionColumns.date}, 1, 7), 
                 ${Master.charts_of_accounts.selectOptionColumns.id},
                 ${Master.charts_of_accounts.selectOptionColumns.type}
      ) AS monthly_balances
      GROUP BY month
      ORDER BY month
    `;
    const revenueExpenseTrend = await Query(revenue_expense_trend_query);

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
        AND ((${Accounting.collections.selectOptionColumns.collection_date} >= '${startDate}' 
            AND ${Accounting.collections.selectOptionColumns.collection_date} <= '${endDate}')
        OR ${Accounting.collections.selectOptionColumns.collection_date} IS NULL)
      GROUP BY SUBSTR(${Accounting.collections.selectOptionColumns.collection_date}, 1, 7)
      
      UNION ALL
      
      SELECT 
        'disbursement' AS type,
        SUBSTR(${Accounting.cash_disbursements.selectOptionColumns.payment_date}, 1, 7) AS month,
        COALESCE(SUM(${Accounting.cash_disbursements.selectOptionColumns.total_amount_due}), 0) AS amount
      FROM ${Accounting.cash_disbursements.tablename}
      WHERE ${Accounting.cash_disbursements.selectOptionColumns.state} = 'APPROVED'
        AND ((${Accounting.cash_disbursements.selectOptionColumns.payment_date} >= '${startDate}' 
            AND ${Accounting.cash_disbursements.selectOptionColumns.payment_date} <= '${endDate}')
        OR ${Accounting.cash_disbursements.selectOptionColumns.payment_date} IS NULL)
      GROUP BY SUBSTR(${Accounting.cash_disbursements.selectOptionColumns.payment_date}, 1, 7)
      
      ORDER BY month, type
    `;
    const cashFlowTrend = await Query(cash_flow_trend_query);

    // ==================== COMBINE ALL DATA ====================

    const data = {
      financialHealth: {
        netIncome,
        totalCashPosition,
        cashBreakdown: {
          cashOnHand,
          pettyCash,
          bankAccounts,
          checks
        },
        totalReceivables,
        totalPayables,
        workingCapital: totalCashPosition + totalReceivables - totalPayables
      },
      cashFlowActivity: {
        totalCollections,
        totalDisbursements,
        netCashMovement
      },
      transactionVolume: {
        salesCount,
        purchaseCount,
        disbursementCount,
        adjustmentCount,
        totalTransactions: salesCount + purchaseCount + disbursementCount + adjustmentCount
      },
      alerts: {
        trialBalance: {
          balanced: trialBalanceBalanced,
          difference: trialBalanceDifference,
          totalDebit,
          totalCredit
        },
        balanceSheet: {
          balanced: balanceSheetBalanced,
          difference: balanceSheetDifference,
          totalAssets,
          totalLiabilitiesEquity
        },
        overdueReceivables: {
          count: overdueARCount,
          amount: overdueARAmount
        }
      },
      trends: {
        revenueVsExpenses: revenueExpenseTrend,
        cashFlow: cashFlowTrend
      },
      period: {
        startDate,
        endDate
      },
      timestamp: new Date()
    };

    return res.status(200).json({
      success: true,
      message: 'Dashboard data retrieved successfully',
      data
    });

  } catch (error) {
    console.error('Error fetching dashboard data:', error)
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching dashboard data',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    })
  }
}

module.exports = {
  getDashboardData,
}
