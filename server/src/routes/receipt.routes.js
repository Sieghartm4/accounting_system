const express = require('express')
const { getReceipts } = require('../controller/receipt.controller')

const receiptRouter = express.Router()

receiptRouter.get('/', getReceipts)

module.exports = {
  receiptRouter,
}
