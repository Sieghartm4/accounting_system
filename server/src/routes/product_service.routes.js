const express = require('express')
const { getProductsService, createProductService, updateProductService } = require('../controller/product_service.controller')

const productServiceRouter = express.Router()

productServiceRouter.get('/', getProductsService)
productServiceRouter.post('/', createProductService)
productServiceRouter.put('/:id', updateProductService)

module.exports = {
  productServiceRouter,
}
