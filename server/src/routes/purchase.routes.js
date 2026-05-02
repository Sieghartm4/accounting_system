const express = require('express')
const { auth } = require('../middlewares/auth.middleware')
const { getPurchase, getAllPurchase, createPurchase, updatePurchase, updatePurchaseState, getPrintPurchases } = require('../controller/purchase.controller')

const purchaseRouter = express.Router()

purchaseRouter.use(auth) // Apply auth middleware to all purchase routes
purchaseRouter.get('/', getPurchase)
purchaseRouter.get('/print/:purchase_id', getPrintPurchases)
purchaseRouter.get('/:id', getAllPurchase)
purchaseRouter.post('/', createPurchase)
purchaseRouter.put('/purchase-state', updatePurchaseState)
purchaseRouter.put('/:purchase_id', updatePurchase)

module.exports = {
  purchaseRouter,
}
