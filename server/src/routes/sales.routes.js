const express = require('express')
const { auth } = require('../middlewares/auth.middleware')
const {
  getSales,
  getAllSales,
  createSales,
  updateSalesState,
  cancelSalesState,
  updateSale,
  getPrintSales,
} = require('../controller/sales.controller')

const salesRouter = express.Router()

salesRouter.use(auth) // Apply auth middleware to all sales routes
salesRouter.get('/', getSales)

salesRouter.get('/print/:sales_id', getPrintSales)
salesRouter.get('/:id', getAllSales)
salesRouter.post('/', createSales)
salesRouter.put('/sales-state', updateSalesState)
salesRouter.put('/cancel-state', cancelSalesState)
salesRouter.put('/:sales_id', updateSale)

module.exports = {
  salesRouter,
}
