const express = require('express')
const { getProductsService } = require('../controller/product_service.controller')

const productServiceRouter = express.Router()

productServiceRouter.get('/', getProductsService)

module.exports = {
  productServiceRouter,
}
