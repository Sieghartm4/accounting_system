const express = require('express')
const {
  getCustomers,
  getCustomerTransactions,
  createCustomer,
  updateCustomer,
} = require('../controller/customer.controller')

const customerRouter = express.Router()

customerRouter.get('/transactions', getCustomerTransactions)
customerRouter.get('/', getCustomers)
customerRouter.post('/', createCustomer)
customerRouter.put('/:id', updateCustomer)

module.exports = {
  customerRouter,
}
