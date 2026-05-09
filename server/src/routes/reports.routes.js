const express = require('express')
const { 
  getTrialBalance, 
  getIncomeStatement, 
  getGeneralLedger, 
  getBalanceSheet,
  getSearch
} = require('../controller/reports.controller')
const { getJournalEntries } = require('../controller/journal_entries.controller')

const reportsRouter = express.Router()

reportsRouter.get('/trial-balance', getTrialBalance)
 
reportsRouter.get('/income-statement', getIncomeStatement)

reportsRouter.get('/general-ledger', getGeneralLedger)

reportsRouter.get('/balance-sheet', getBalanceSheet)

reportsRouter.get('/journal-entries', getJournalEntries)

reportsRouter.get('/search', getSearch)

module.exports = {
  reportsRouter,
}
