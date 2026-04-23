const express = require('express')
const { getPurchase, getAllPurchase, createPurchase, updatePurchase, updatePurchaseState } = require('../controller/purchase.controller')

const purchaseRouter = express.Router()

purchaseRouter.get('/', getPurchase)
purchaseRouter.get('/:id', getAllPurchase)
purchaseRouter.post('/', createPurchase)
purchaseRouter.put('/:purchase_id', updatePurchase)
purchaseRouter.put('/purchase-state', updatePurchaseState)

module.exports = {
  purchaseRouter,
}
