const express = require('express')
const { getCustomers, createCustomer } = require('../controller/customer.controller')

const customerRouter = express.Router()

customerRouter.get('/', getCustomers)
customerRouter.post('/', createCustomer)

module.exports = {
  customerRouter,
}
