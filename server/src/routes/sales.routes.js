const express = require('express')
const { auth } = require('../middlewares/auth.middleware')
const { getSales, getAllSales, createSales, updateSalesState, updateSale } = require('../controller/sales.controller')

const salesRouter = express.Router()

salesRouter.use(auth) // Apply auth middleware to all sales routes
salesRouter.get('/', getSales)

salesRouter.get('/:id', getAllSales)
salesRouter.post('/', createSales)
salesRouter.put('/sales-state', updateSalesState)
salesRouter.put('/:sales_id', updateSale)


module.exports = {
  salesRouter,
}
