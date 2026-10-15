const express = require('express')
const { auth } = require('../middlewares/auth.middleware')
const { requireAnyModule } = require('../middlewares/entitlement.middleware')
const {
  getSales,
  getAllSales,
  createSales,
  updateSalesState,
  cancelSalesState,
  updateSale,
  getPrintSales,
  getAgingReceivables,
} = require('../controller/sales.controller')

const salesRouter = express.Router()

salesRouter.use(auth) // Apply auth middleware to all sales routes
salesRouter.get('/', getSales)

/**
 * Aging is sold separately from sales.
 *
 * This router is mounted behind the `sales` module gate, so before this line a
 * tenant without the `aging_receivables` module could still read aging data by
 * calling /sales/aging directly - the client nav and the route gate stop nothing
 * when the request is made by hand.
 *
 * Either aging module unlocks it: the endpoint is one report over both
 * receivables and payables, and treating them as two independent gates would
 * mean buying one and being refused by the other. Hence requireAnyModule rather
 * than a single requireModule.
 */
const requireAgingModule = requireAnyModule([
  'aging_receivables',
  'aging_payables',
])

salesRouter.get('/aging', requireAgingModule, getAgingReceivables)
salesRouter.get('/print/:sales_id', getPrintSales)
salesRouter.get('/:id', getAllSales)
salesRouter.post('/', createSales)
salesRouter.put('/sales-state', updateSalesState)
salesRouter.put('/cancel-state', cancelSalesState)
salesRouter.put('/:sales_id', updateSale)

module.exports = {
  salesRouter,
}
