const express = require('express')
const { getSales, createSales, updateSalesState } = require('../controller/sales.controller')

const salesRouter = express.Router()

salesRouter.get('/', getSales)
salesRouter.post('/', createSales)
salesRouter.put('/sales-state', updateSalesState)

module.exports = {
  salesRouter,
}
