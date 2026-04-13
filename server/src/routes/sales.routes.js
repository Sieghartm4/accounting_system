const express = require('express')
const { getSales, getAllSales, createSales, updateSalesState } = require('../controller/sales.controller')

const salesRouter = express.Router()

salesRouter.get('/', getSales)
salesRouter.get('/:id', getAllSales)
salesRouter.post('/', createSales)
salesRouter.put('/sales-state', updateSalesState)

module.exports = {
  salesRouter,
}
