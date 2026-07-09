const express = require('express')
const {
  getProductsService,
  syncProductService,
  previewProductServiceSync,
  importProductService,
  createProductService,
  updateProductService,
} = require('../controller/product_service.controller')

const productServiceRouter = express.Router()

productServiceRouter.get('/', getProductsService)
productServiceRouter.get('/sync', syncProductService)
productServiceRouter.get('/sync/preview', previewProductServiceSync)
productServiceRouter.post('/sync/import', importProductService)
productServiceRouter.post('/', createProductService)
productServiceRouter.put('/:id', updateProductService)

module.exports = {
  productServiceRouter,
}
