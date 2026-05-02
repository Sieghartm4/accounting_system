const express = require('express')
const { auth } = require('../middlewares/auth.middleware')
const { getSales, getAllSales, createSales, updateSalesState, updateSale, getPrintSales } = require('../controller/sales.controller')

const salesRouter = express.Router()

salesRouter.use(auth) // Apply auth middleware to all sales routes
salesRouter.get('/', getSales)

salesRouter.get('/:id', getAllSales)
salesRouter.post('/', createSales)
salesRouter.put('/sales-state', updateSalesState)
salesRouter.put('/:sales_id', updateSale)
salesRouter.get('/print/:sales_id', getPrintSales)


module.exports = {
  salesRouter,
}
