const express = require('express')
const {
  getProductsService,
  syncProductService,
  createProductService,
  updateProductService,
} = require('../controller/product_service.controller')

const productServiceRouter = express.Router()

productServiceRouter.get('/', getProductsService)
productServiceRouter.get('/sync', syncProductService)
productServiceRouter.post('/', createProductService)
productServiceRouter.put('/:id', updateProductService)

module.exports = {
  productServiceRouter,
}
