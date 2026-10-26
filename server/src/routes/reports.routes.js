const express = require('express')
const {
  getTrialBalance,
  getIncomeStatement,
  getCashFlowStatement,
  getGeneralLedger,
  getBalanceSheet,
  getSearch,
  getStatementOfComprehensiveIncome,
  getBankReconciliation,
} = require('../controller/reports.controller')
const {
  getJournalEntries,
  getAdvances,
} = require('../controller/journal_entries.controller')
const {
  validateReportQuery,
} = require('../middlewares/reportQueryValidation.middleware')
const { requireModule } = require('../middlewares/entitlement.middleware')

/**
 * Reports.
 *
 * This router is mounted ungated in routes.startup.js, on the reasoning that
 * "every report behind it is a required module". That was wrong, and it was a
 * real bypass: `/reports/advances` and `/reports/bank-reconciliation` serve
 * data for two SELLABLE modules, so a tenant that had not bought either could
 * read it by calling the endpoint directly, no client involved.
 *
 * So the gating is per route rather than per router. The financial statements
 * stay ungated because trial balance, income statement, general ledger, balance
 * sheet, journal entries and comprehensive income are all required modules and
 * are therefore granted to every tenant regardless of plan - gating them would
 * add a check that can never refuse.
 *
 * `/search` cannot be gated by a single module: it spans modules by design. It
 * is filtered by entitlement inside the controller instead, because the set of
 * routes it searches is taken from the query string and a client must not be
 * able to widen its own scope. See getSearch.
 */
const reportsRouter = express.Router()
reportsRouter.use(validateReportQuery)

// --- Required-module reports: always available ---

reportsRouter.get('/trial-balance', getTrialBalance)

reportsRouter.get('/income-statement', getIncomeStatement)

reportsRouter.get('/cash-flow-statement', getCashFlowStatement)

reportsRouter.get('/general-ledger', getGeneralLedger)

reportsRouter.get('/balance-sheet', getBalanceSheet)

reportsRouter.get(
  '/statement-of-comprehensive-income',
  getStatementOfComprehensiveIncome,
)

reportsRouter.get('/journal-entries', getJournalEntries)

// --- Sellable-module reports: refused unless the plan includes them ---

reportsRouter.get('/advances', requireModule('advances'), getAdvances)

reportsRouter.get(
  '/bank-reconciliation',
  requireModule('bank_reconciliation'),
  getBankReconciliation,
)

// Cross-module. Scope is narrowed to the plan inside the controller.
reportsRouter.get('/search', getSearch)

module.exports = {
  reportsRouter,
}