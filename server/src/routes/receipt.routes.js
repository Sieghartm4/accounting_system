const express = require('express')
const { getReceipts, createReceipts } = require('../controller/receipt.controller')

const receiptRouter = express.Router()

receiptRouter.get('/', getReceipts)
receiptRouter.post('/', createReceipts)

module.exports = {
  receiptRouter,
}
