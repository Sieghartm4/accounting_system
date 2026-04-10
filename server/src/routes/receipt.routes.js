const express = require('express')
const { getReceipts, createReceipts, updateReceiptState, getAllReceipts } = require('../controller/receipt.controller')

const receiptRouter = express.Router()

receiptRouter.get('/', getReceipts)
receiptRouter.post('/', createReceipts)
receiptRouter.put('/receipt-state', updateReceiptState)
receiptRouter.get('/:receipt_id', getAllReceipts)

module.exports = {
  receiptRouter,
}
