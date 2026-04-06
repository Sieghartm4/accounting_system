const express = require('express')
const { getSales, createSales } = require('../controller/sales.controller')

const salesRouter = express.Router()

salesRouter.get('/', getSales)
salesRouter.post('/', createSales)

module.exports = {
  salesRouter,
}
