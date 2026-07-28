const express = require('express')
const {
  getCustomers,
  getCustomerTransactions,
  createCustomer,
  updateCustomer,
  importCustomers,
} = require('../controller/customer.controller')

const customerRouter = express.Router()

customerRouter.get('/transactions', getCustomerTransactions)
customerRouter.get('/', getCustomers)
customerRouter.post('/', createCustomer)
customerRouter.put('/:id', updateCustomer)
customerRouter.post('/import', importCustomers)

module.exports = {
  customerRouter,
}
