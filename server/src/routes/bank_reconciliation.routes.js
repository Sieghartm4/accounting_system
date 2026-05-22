const express = require('express')



const {

  getBankReconciliations,

  getBankReconciliationDetail,

  createBankReconciliation,

  addBankReconciliationItem,

  updateBankReconciliationItem,

  updateBankReconciliationBalance,

  addAdjustmentBalance,

  getAdjustmentBalances,

  deleteAdjustmentBalance,

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





// Get specific bank reconciliation with items (after item-specific routes)

bankReconciliationRouter.get('/:id', getBankReconciliationDetail)



// Get adjustment balances for a reconciliation

bankReconciliationRouter.get('/:id/adjustments', getAdjustmentBalances)



// Update bank reconciliation balance

bankReconciliationRouter.put('/:id/balance', updateBankReconciliationBalance)



// Delete adjustment balance

bankReconciliationRouter.delete('/adjustment/:id', deleteAdjustmentBalance)



module.exports = { bankReconciliationRouter }

