const express = require('express')
const { getProductsService, createProductService } = require('../controller/product_service.controller')

const productServiceRouter = express.Router()

productServiceRouter.get('/', getProductsService)
productServiceRouter.post('/', createProductService)

module.exports = {
  productServiceRouter,
}
