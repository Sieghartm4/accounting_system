const express = require('express')
const { getCollections, getSalesCollection } = require('../controller/collection.controller')

const collectionRouter = express.Router()

collectionRouter.get('/', getCollections)
collectionRouter.get('/sales-collection', getSalesCollection)

module.exports = {
  collectionRouter,
}
