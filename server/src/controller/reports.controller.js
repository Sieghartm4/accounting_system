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

const getIncomeStatement = async (req, res, next) => {
  try {
    const { start_date, end_date } = req.query;

    let dateFilter = '';
    if (start_date || end_date) {
      const conditions = [];
      if (start_date) conditions.push(
        `${Accounting.journal_entries.selectOptionColumns.date} >= '${start_date}'`
      );
      if (end_date) conditions.push(
        `${Accounting.journal_entries.selectOptionColumns.date} <= '${end_date}'`
      );
      dateFilter = ` AND ${conditions.join(' AND ')}`;
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
      GROUP BY
        ${Master.charts_of_accounts.selectOptionColumns.id},
        ${Master.charts_of_accounts.selectOptionColumns.code},
        ${Master.charts_of_accounts.selectOptionColumns.name},
        ${Master.charts_of_accounts.selectOptionColumns.type}
      ORDER BY
        ${Master.charts_of_accounts.selectOptionColumns.type},
        ${Master.charts_of_accounts.selectOptionColumns.code}
    `;

    const incomeStatement = await Query(income_statement_query);

    const revenues = incomeStatement.filter(item => item['Account Type'] === 'REVENUE');
    const expenses = incomeStatement.filter(item => item['Account Type'] === 'EXPENSES');

    // totalRevenues: income accounts are positive, contra-revenue (Sales Discounts) is negative
    // They naturally net together correctly
    const totalRevenues = revenues.reduce((sum, item) => sum + parseFloat(item.Current || 0), 0);

    // totalExpenses: regular expense accounts are positive, contra-expense (Purchase Discounts) is negative
    // They naturally net together correctly
    const totalExpenses = expenses.reduce((sum, item) => sum + parseFloat(item.Current || 0), 0);

    const netIncome = totalRevenues - totalExpenses;

    res.status(200).json({
      success: true,
      message: 'Income Statement retrieved successfully',
      data: {
        revenues,
        expenses,
        totalRevenues,
        totalExpenses,
        netIncome
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error fetching income statement:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching income statement',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

const getGeneralLedger = async (req, res, next) => {
  try {
    const { start_date, end_date } = req.query;

    let startDate = start_date;
    let endDate = end_date;

    if (!start_date && !end_date) {
      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      startDate = firstDay.toISOString().split('T')[0];
      endDate = lastDay.toISOString().split('T')[0];
    }

    let dateFilter = '';
    if (startDate || endDate) {
      const conditions = [];
      if (startDate) conditions.push(`${Accounting.journal_entries.selectOptionColumns.date} >= '${startDate}'`);
      if (endDate) conditions.push(`${Accounting.journal_entries.selectOptionColumns.date} <= '${endDate}'`);
      dateFilter = ` WHERE ${conditions.join(' AND ')}`;
    }

    const general_ledger_query = `
      SELECT
        ${Accounting.journal_entries.selectOptionColumns.db_name}            AS db_name,
        ${Accounting.journal_entries.selectOptionColumns.db_id}              AS db_id,
        ${Accounting.journal_entries.selectOptionColumns.date}               AS posted_date,
        ${Accounting.journal_entries.selectOptionColumns.responsibility_center} AS responsibility_center,
        SUM(CASE WHEN ${Accounting.journal_entries.selectOptionColumns.type} = 'DEBIT'
              THEN ${Accounting.journal_entries.selectOptionColumns.amount} ELSE 0 END) AS Debit,
        SUM(CASE WHEN ${Accounting.journal_entries.selectOptionColumns.type} = 'CREDIT'
              THEN ${Accounting.journal_entries.selectOptionColumns.amount} ELSE 0 END) AS Credit
      FROM ${Accounting.journal_entries.tablename}
      ${dateFilter}
      GROUP BY
        ${Accounting.journal_entries.selectOptionColumns.db_name},
        ${Accounting.journal_entries.selectOptionColumns.db_id},
        ${Accounting.journal_entries.selectOptionColumns.date},
        ${Accounting.journal_entries.selectOptionColumns.responsibility_center}
      ORDER BY
        ${Accounting.journal_entries.selectOptionColumns.db_name},
        ${Accounting.journal_entries.selectOptionColumns.date},
        ${Accounting.journal_entries.selectOptionColumns.db_id}
    `;

    const rows = await Query(general_ledger_query);

    const grouped = {};
    for (const row of rows) {
      const section = row.db_name;
      if (!grouped[section]) grouped[section] = [];
      grouped[section].push(row);
    }

    const SECTION_ORDER = [
      'adjustments',
      'sales',
      'collections',
      'receipts',
      'purchase',
      'payments',
      'cash_disbursements',
    ];

    const SECTION_LABELS = {
      adjustments: 'JOURNAL VOUCHER / ADJUSTMENTS',
      sales: 'SALES',
      collections: 'COLLECTIONS',
      receipts: 'CASH RECEIPTS',
      purchase: 'PURCHASES',
      payments: 'PAYMENTS',
      cash_disbursements: 'CASH DISBURSEMENTS',
    };

    const allSections = [
      ...SECTION_ORDER,
      ...Object.keys(grouped).filter(k => !SECTION_ORDER.includes(k))
    ].filter(k => grouped[k]);

    const sections = allSections.map(key => ({
      section_key: key,
      section_label: SECTION_LABELS[key] || key.toUpperCase().replace(/_/g, ' '),
      transactions: grouped[key].map((row, i) => ({
        trans_no: `${key.slice(0, 2).toUpperCase()}${row.db_id}`,
        posted_date: row.posted_date,
        doc_ref: row.db_id,
        responsibility_center: row.responsibility_center || '',
        debit: parseFloat(row.Debit || 0),
        credit: parseFloat(row.Credit || 0),
      }))
    }));

    const grandTotalDebit = rows.reduce((s, r) => s + parseFloat(r.Debit || 0), 0);
    const grandTotalCredit = rows.reduce((s, r) => s + parseFloat(r.Credit || 0), 0);

    res.status(200).json({
      success: true,
      message: 'General Ledger retrieved successfully',
      data: {
        sections,
        grandTotalDebit,
        grandTotalCredit,
        netTotal: grandTotalDebit - grandTotalCredit,
      },
      startDate,
      endDate,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error fetching general ledger:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching general ledger',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

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
      GROUP BY
        ${Master.charts_of_accounts.selectOptionColumns.id},
        ${Master.charts_of_accounts.selectOptionColumns.type}
    `;

    const incomeStatement = await Query(income_statement_query);

    const revenues = incomeStatement.filter(item => item['Account Type'] === 'REVENUE');
    const expenses = incomeStatement.filter(item => item['Account Type'] === 'EXPENSES');
    
    const totalRevenues = revenues.reduce((sum, item) => sum + parseFloat(item.Current || 0), 0);
    const totalExpenses = expenses.reduce((sum, item) => sum + parseFloat(item.Current || 0), 0);
    const netIncome = totalRevenues - totalExpenses;

    const assets = balanceSheet.filter(item => item['Account Code'].startsWith('100'))
    const liabilities = balanceSheet.filter(item => item['Account Code'].startsWith('200'))
    const equity = balanceSheet.filter(item => item['Account Code'].startsWith('300'))

    const updatedEquity = [...equity];
    if (netIncome !== 0) {
      updatedEquity.push({
        'Account Code': '300999',
        'Account Name': 'Current Period Net Income',
        'Current': -netIncome
      });
    }

    const totalAssets = assets.reduce((sum, item) => sum + parseFloat(item.Current || 0), 0)
    const totalLiabilities = liabilities.reduce((sum, item) => sum + parseFloat(item.Current || 0), 0)
    const totalEquity = updatedEquity.reduce((sum, item) => sum + parseFloat(item.Current || 0), 0)

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
        netIncome: netIncome
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

const getSearch = async (req, res, next) => {
  const { startDate, endDate, search } = req.query;
  
  try {
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Start date and end date are required',
        timestamp: new Date().toISOString()
      });
    }

    if (!search || search.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Search term is required',
        timestamp: new Date().toISOString()
      });
    }

    const searchTerm = `%${search.trim()}%`;
    const results = [];

    const salesQuery = `
      SELECT 
        'Sales' as document_type,
        sal.${Accounting.sales.selectOptionColumns.id} as document_id,
        sal.${Accounting.sales.selectOptionColumns.document_reference} as document_reference,
        cust.${Master.customers.selectOptionColumns.name} as customer_name,
        sal.${Accounting.sales.selectOptionColumns.date_delivered} as document_date,
        sal.${Accounting.sales.selectOptionColumns.total_amount_due} as amount,
        sal.${Accounting.sales.selectOptionColumns.remarks} as remarks
      FROM ${Accounting.sales.tablename} sal
      LEFT JOIN ${Master.customers.tablename} cust ON sal.${Accounting.sales.selectOptionColumns.customer_id} = cust.${Master.customers.selectOptionColumns.id}
      WHERE (sal.${Accounting.sales.selectOptionColumns.document_reference} LIKE ? OR cust.${Master.customers.selectOptionColumns.name} LIKE ?)
        AND sal.${Accounting.sales.selectOptionColumns.date_delivered} BETWEEN ? AND ?
    `;
    
    const salesResults = await Query(salesQuery, [searchTerm, searchTerm, startDate, endDate]);
    results.push(...salesResults);

    const collectionsQuery = `
      SELECT 
        'Collection' as document_type,
        coll.${Accounting.collections.selectOptionColumns.id} as document_id,
        coll.${Accounting.collections.selectOptionColumns.document_reference} as document_reference,
        cust.${Master.customers.selectOptionColumns.name} as customer_name,
        coll.${Accounting.collections.selectOptionColumns.collection_date} as document_date,
        NULL as amount,
        coll.${Accounting.collections.selectOptionColumns.remarks} as remarks
      FROM ${Accounting.collections.tablename} coll
      LEFT JOIN ${Master.customers.tablename} cust ON coll.${Accounting.collections.selectOptionColumns.customer_id} = cust.${Master.customers.selectOptionColumns.id}
      WHERE (coll.${Accounting.collections.selectOptionColumns.document_reference} LIKE ? OR cust.${Master.customers.selectOptionColumns.name} LIKE ?)
        AND coll.${Accounting.collections.selectOptionColumns.collection_date} BETWEEN ? AND ?
    `;
    
    const collectionsResults = await Query(collectionsQuery, [searchTerm, searchTerm, startDate, endDate]);
    results.push(...collectionsResults);

    const receiptsQuery = `
      SELECT 
        'Receipt' as document_type,
        rec.${Accounting.receipts.selectOptionColumns.id} as document_id,
        rec.${Accounting.receipts.selectOptionColumns.document_reference} as document_reference,
        cust.${Master.customers.selectOptionColumns.name} as customer_name,
        rec.${Accounting.receipts.selectOptionColumns.collection_date} as document_date,
        rec.${Accounting.receipts.selectOptionColumns.total_amount_due} as amount,
        rec.${Accounting.receipts.selectOptionColumns.remarks} as remarks
      FROM ${Accounting.receipts.tablename} rec
      LEFT JOIN ${Master.customers.tablename} cust ON rec.${Accounting.receipts.selectOptionColumns.customer_id} = cust.${Master.customers.selectOptionColumns.id}
      WHERE (rec.${Accounting.receipts.selectOptionColumns.document_reference} LIKE ? OR cust.${Master.customers.selectOptionColumns.name} LIKE ?)
        AND rec.${Accounting.receipts.selectOptionColumns.collection_date} BETWEEN ? AND ?
    `;
    
    const receiptsResults = await Query(receiptsQuery, [searchTerm, searchTerm, startDate, endDate]);
    results.push(...receiptsResults);

    const purchaseQuery = `
      SELECT 
        'Purchase' as document_type,
        pur.${Accounting.purchase.selectOptionColumns.id} as document_id,
        pur.${Accounting.purchase.selectOptionColumns.document_reference} as document_reference,
        vend.${Master.vendors.selectOptionColumns.name} as vendor_name,
        pur.${Accounting.purchase.selectOptionColumns.date_delivered} as document_date,
        pur.${Accounting.purchase.selectOptionColumns.total_amount_due} as amount,
        pur.${Accounting.purchase.selectOptionColumns.remarks} as remarks
      FROM ${Accounting.purchase.tablename} pur
      LEFT JOIN ${Master.vendors.tablename} vend ON pur.${Accounting.purchase.selectOptionColumns.vendor_id} = vend.${Master.vendors.selectOptionColumns.id}
      WHERE (pur.${Accounting.purchase.selectOptionColumns.document_reference} LIKE ? OR vend.${Master.vendors.selectOptionColumns.name} LIKE ?)
        AND pur.${Accounting.purchase.selectOptionColumns.date_delivered} BETWEEN ? AND ?
    `;
    
    const purchaseResults = await Query(purchaseQuery, [searchTerm, searchTerm, startDate, endDate]);
    results.push(...purchaseResults);

    const cashDisbursementsQuery = `
      SELECT 
        'Cash Disbursement' as document_type,
        cd.${Accounting.cash_disbursements.selectOptionColumns.id} as document_id,
        cd.${Accounting.cash_disbursements.selectOptionColumns.document_reference} as document_reference,
        vend.${Master.vendors.selectOptionColumns.name} as vendor_name,
        cd.${Accounting.cash_disbursements.selectOptionColumns.payment_date} as document_date,
        cd.${Accounting.cash_disbursements.selectOptionColumns.total_amount_due} as amount,
        cd.${Accounting.cash_disbursements.selectOptionColumns.remarks} as remarks
      FROM ${Accounting.cash_disbursements.tablename} cd
      LEFT JOIN ${Master.vendors.tablename} vend ON cd.${Accounting.cash_disbursements.selectOptionColumns.vendor_id} = vend.${Master.vendors.selectOptionColumns.id}
      WHERE (cd.${Accounting.cash_disbursements.selectOptionColumns.document_reference} LIKE ? OR vend.${Master.vendors.selectOptionColumns.name} LIKE ?)
        AND cd.${Accounting.cash_disbursements.selectOptionColumns.payment_date} BETWEEN ? AND ?
    `;
    
    const cashDisbursementsResults = await Query(cashDisbursementsQuery, [searchTerm, searchTerm, startDate, endDate]);
    results.push(...cashDisbursementsResults);

    const paymentsQuery = `
      SELECT 
        'Payment' as document_type,
        pay.${Accounting.payments.selectOptionColumns.id} as document_id,
        pay.${Accounting.payments.selectOptionColumns.document_reference} as document_reference,
        vend.${Master.vendors.selectOptionColumns.name} as vendor_name,
        pay.${Accounting.payments.selectOptionColumns.payment_date} as document_date,
        NULL as amount,
        pay.${Accounting.payments.selectOptionColumns.remarks} as remarks
      FROM ${Accounting.payments.tablename} pay
      LEFT JOIN ${Master.vendors.tablename} vend ON pay.${Accounting.payments.selectOptionColumns.vendor_id} = vend.${Master.vendors.selectOptionColumns.id}
      WHERE (pay.${Accounting.payments.selectOptionColumns.document_reference} LIKE ? OR vend.${Master.vendors.selectOptionColumns.name} LIKE ?)
        AND pay.${Accounting.payments.selectOptionColumns.payment_date} BETWEEN ? AND ?
    `;
    
    const paymentsResults = await Query(paymentsQuery, [searchTerm, searchTerm, startDate, endDate]);
    results.push(...paymentsResults);

    const adjustmentsQuery = `
      SELECT 
        'Adjustment' as document_type,
        adj.${Accounting.adjustments.selectOptionColumns.id} as document_id,
        adj.${Accounting.adjustments.selectOptionColumns.document_reference} as document_reference,
        NULL as customer_name,
        NULL as vendor_name,
        adj.${Accounting.adjustments.selectOptionColumns.posting_date} as document_date,
        adj.${Accounting.adjustments.selectOptionColumns.total_amount} as amount,
        adj.${Accounting.adjustments.selectOptionColumns.remarks} as remarks
      FROM ${Accounting.adjustments.tablename} adj
      WHERE adj.${Accounting.adjustments.selectOptionColumns.document_reference} LIKE ?
        AND adj.${Accounting.adjustments.selectOptionColumns.posting_date} BETWEEN ? AND ?
    `;
    
    const adjustmentsResults = await Query(adjustmentsQuery, [searchTerm, startDate, endDate]);
    results.push(...adjustmentsResults);

    results.sort((a, b) => new Date(b.document_date) - new Date(a.document_date));

    res.status(200).json({
      success: true,
      message: 'Search results retrieved successfully',
      data: results,
      count: results.length,
      search_term: search,
      date_range: {
        start_date: startDate,
        end_date: endDate
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error performing search:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while performing search',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
}

module.exports = {
  getTrialBalance,
  getIncomeStatement,
  getGeneralLedger,
  getBalanceSheet,
  getSearch
}
