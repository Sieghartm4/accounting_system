const express = require('express')
const {
  getProductsService,
  syncProductService,
  previewProductServiceSync,
  importProductService,
  importProductServiceCatalog,
  createProductService,
  updateProductService,
} = require('../controller/product_service.controller')

const productServiceRouter = express.Router()

productServiceRouter.get('/', getProductsService)
productServiceRouter.get('/sync', syncProductService)
productServiceRouter.get('/sync/preview', previewProductServiceSync)
productServiceRouter.post('/sync/import', importProductService)
productServiceRouter.post('/import', importProductServiceCatalog)
productServiceRouter.post('/', createProductService)
productServiceRouter.put('/:id', updateProductService)

module.exports = {
  productServiceRouter,
}
