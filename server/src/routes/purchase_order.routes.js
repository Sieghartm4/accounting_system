const express = require('express')
const { auth } = require('../middlewares/auth.middleware')
const {
  getPurchaseOrders,
  getPurchaseOrderById,
  createPurchaseOrder,
  updatePurchaseOrder,
} = require('../controller/purchase_order.controller')

const purchaseOrderRouter = express.Router()

purchaseOrderRouter.use(auth)

purchaseOrderRouter.get('/', getPurchaseOrders)
purchaseOrderRouter.get('/:po_id', getPurchaseOrderById)
purchaseOrderRouter.post('/', createPurchaseOrder)
purchaseOrderRouter.put('/:po_id', updatePurchaseOrder)

module.exports = {
  purchaseOrderRouter,
}
