const express = require('express')
const { 
  getTrialBalance, 
  getIncomeStatement, 
  getGeneralLedger, 
  getBalanceSheet 
} = require('../controller/reports.controller')

const reportsRouter = express.Router()

// Trial Balance
reportsRouter.get('/trial-balance', getTrialBalance)

// Income Statement  
reportsRouter.get('/income-statement', getIncomeStatement)

// General Ledger
reportsRouter.get('/general-ledger', getGeneralLedger)

// Balance Sheet
reportsRouter.get('/balance-sheet', getBalanceSheet)

module.exports = {
  reportsRouter,
}
