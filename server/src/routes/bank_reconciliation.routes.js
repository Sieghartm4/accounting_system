const express = require('express')

const {
  getBankReconciliations,
  getBankReconciliationDetail,
  getBankReconciliationAdjustments,
  createBankReconciliation,
  addBankReconciliationItem,
  addBankReconciliationAdjustment,
  updateBankReconciliationItem,
  updateBankReconciliationBalance,
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

// Add adjustment journal entry for a bank reconciliation
bankReconciliationRouter.post('/:id/adjustment/add', addBankReconciliationAdjustment)

// Fetch adjustment journal entries for a bank reconciliation
bankReconciliationRouter.get('/:id/adjustments', getBankReconciliationAdjustments)

// Get specific bank reconciliation with items (after item-specific routes)
bankReconciliationRouter.get('/:id', getBankReconciliationDetail)

// Update bank reconciliation balance
bankReconciliationRouter.put('/:id/balance', updateBankReconciliationBalance)

module.exports = { bankReconciliationRouter }
