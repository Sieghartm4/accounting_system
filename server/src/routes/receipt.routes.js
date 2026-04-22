const express = require('express')
const { getReceipts, createReceipts, updateReceipt, updateReceiptState, getAllReceipts } = require('../controller/receipt.controller')

const receiptRouter = express.Router()

receiptRouter.get('/', getReceipts)
receiptRouter.post('/', createReceipts)
receiptRouter.put('/:receipt_id', updateReceipt)
receiptRouter.put('/receipt-state', updateReceiptState)
receiptRouter.get('/:receipt_id', getAllReceipts)

module.exports = {
  receiptRouter,
}
