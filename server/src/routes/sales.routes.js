const express = require('express')
const { getSales } = require('../controller/sales.controller')

const salesRouter = express.Router()

salesRouter.get('/', getSales)

module.exports = {
  salesRouter,
}
