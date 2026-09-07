const express = require('express')
const {
  getTrialBalance,
  getIncomeStatement,
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

const reportsRouter = express.Router()
reportsRouter.use(validateReportQuery)

reportsRouter.get('/trial-balance', getTrialBalance)

reportsRouter.get('/income-statement', getIncomeStatement)

reportsRouter.get('/general-ledger', getGeneralLedger)

reportsRouter.get('/balance-sheet', getBalanceSheet)

reportsRouter.get(
  '/statement-of-comprehensive-income',
  getStatementOfComprehensiveIncome,
)

reportsRouter.get('/journal-entries', getJournalEntries)
reportsRouter.get('/advances', getAdvances)

reportsRouter.get('/bank-reconciliation', getBankReconciliation)

reportsRouter.get('/search', getSearch)

module.exports = {
  reportsRouter,
}
