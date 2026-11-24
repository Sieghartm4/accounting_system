const express = require('express')
const { auth } = require('../middlewares/auth.middleware')
const { requireAnyModule } = require('../middlewares/entitlement.middleware')
const { getPurchase, getAllPurchase, createPurchase, updatePurchase, updatePurchaseState, cancelPurchaseState, getPrintPurchases, getAgingPayables } = require('../controller/purchase.controller')

const purchaseRouter = express.Router()

purchaseRouter.use(auth) // Apply auth middleware to all purchase routes
purchaseRouter.get('/', getPurchase)
purchaseRouter.get('/print/:purchase_id', getPrintPurchases)

/**
 * Aging payables endpoint - similar to aging receivables
 * Protected by the aging_payables or aging_receivables module gate
 */
const requireAgingModule = requireAnyModule([
  'aging_payables',
  'aging_receivables',
])

purchaseRouter.get('/aging', requireAgingModule, getAgingPayables)
purchaseRouter.get('/:id', getAllPurchase)
purchaseRouter.post('/', createPurchase)
purchaseRouter.put('/purchase-state', updatePurchaseState)
purchaseRouter.put('/cancel-state', cancelPurchaseState)
purchaseRouter.put('/:purchase_id', updatePurchase)

module.exports = {
  purchaseRouter,
}
