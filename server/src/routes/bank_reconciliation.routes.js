const express = require('express')

const {
  getBankReconciliations,

  getBankReconciliationDetail,

  createBankReconciliation,

  addBankReconciliationItem,

  updateBankReconciliationItem,

  updateBankReconciliationBalance,

  updateBankReconciliationBankStatementBalance,

  addAdjustmentBalance,

  createBankReconciliationSummary,

  getBankReconciliationSummary,

  getAdjustmentBalances,

  deleteAdjustmentBalance,

  getAvailableSummaryMonths,
} = require('../controller/bank_reconciliation.controller')

const bankReconciliationRouter = express.Router()

// Get all bank reconciliations

bankReconciliationRouter.get('/', getBankReconciliations)

// Create new bank reconciliation

bankReconciliationRouter.post('/', createBankReconciliation)

// Add item to bank reconciliation (must be before /:id routes)

bankReconciliationRouter.post('/item/add', addBankReconciliationItem)

// Update bank reconciliation item (must be before /:id routes)

bankReconciliationRouter.put('/item/:id', updateBankReconciliationItem)

// Add adjustment balance (must be before /:id routes)

bankReconciliationRouter.post('/adjustment/add', addAdjustmentBalance)

// Save bank reconciliation summary

bankReconciliationRouter.post('/summary/add', createBankReconciliationSummary)

// Get available summary months for reconciliation (must be before /:id)

bankReconciliationRouter.get('/:id/summary-months', getAvailableSummaryMonths)

// Get a bank reconciliation summary for a selected period

bankReconciliationRouter.get('/:id/summary', getBankReconciliationSummary)

// Get specific bank reconciliation with items (after item-specific routes)

bankReconciliationRouter.get('/:id', getBankReconciliationDetail)

// Get adjustment balances for a reconciliation

bankReconciliationRouter.get('/:id/adjustments', getAdjustmentBalances)

// Update bank reconciliation balance

bankReconciliationRouter.put('/:id/balance', updateBankReconciliationBalance)

// Update bank statement balance

bankReconciliationRouter.put(
  '/:id/bank_statement_balance',
  updateBankReconciliationBankStatementBalance,
)

bankReconciliationRouter.delete('/adjustment/:id', deleteAdjustmentBalance)

module.exports = { bankReconciliationRouter }
