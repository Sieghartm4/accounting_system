const express = require('express')
const { getCollections, getSalesCollection, getSalesItemsCollection, createCollection } = require('../controller/collection.controller')

const collectionRouter = express.Router()

collectionRouter.get('/', getCollections)
collectionRouter.get('/sales-collection', getSalesCollection)
collectionRouter.get('/sales-items-collection', getSalesItemsCollection)
collectionRouter.post('/', createCollection)

module.exports = {
  collectionRouter,
}
