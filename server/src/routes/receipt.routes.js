const express = require('express')
const { auth } = require('../middlewares/auth.middleware')
const { getReceipts, createReceipts, updateReceipt, updateReceiptState, getAllReceipts } = require('../controller/receipt.controller')

const receiptRouter = express.Router()

receiptRouter.use(auth) // Apply auth middleware to all receipt routes
receiptRouter.get('/', getReceipts)
receiptRouter.post('/', createReceipts)
receiptRouter.put('/receipt-state', updateReceiptState)
receiptRouter.put('/:receipt_id', updateReceipt)
receiptRouter.get('/:receipt_id', getAllReceipts)

module.exports = {
  receiptRouter,
}
