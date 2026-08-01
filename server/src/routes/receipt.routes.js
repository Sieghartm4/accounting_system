const express = require('express')
const { auth } = require('../middlewares/auth.middleware')
const { getReceipts, createReceipts, updateReceipt, updateReceiptState, cancelReceiptState, getAllReceipts, getPrintReceipts } = require('../controller/receipt.controller')

const receiptRouter = express.Router()

receiptRouter.use(auth)
receiptRouter.get('/', getReceipts)
receiptRouter.post('/', createReceipts)

receiptRouter.put('/receipt-state', updateReceiptState)
receiptRouter.put('/cancel-state', cancelReceiptState)
receiptRouter.put('/:receipt_id', updateReceipt)
receiptRouter.get('/:receipt_id', getAllReceipts)
receiptRouter.get('/print/:receipt_id', getPrintReceipts)

module.exports = {
  receiptRouter,
}
