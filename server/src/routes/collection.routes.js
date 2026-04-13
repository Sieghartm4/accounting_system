const express = require('express')
const { getCollections, getAllCollections, getSalesCollection, getSalesItemsCollection, createCollection, updateCollectionState } = require('../controller/collection.controller')

const collectionRouter = express.Router()

collectionRouter.get('/', getCollections)
collectionRouter.get('/sales-collection', getSalesCollection)
collectionRouter.get('/sales-items-collection', getSalesItemsCollection)
collectionRouter.get('/:collection_id', getAllCollections)
collectionRouter.post('/', createCollection)
collectionRouter.put('/collection-state', updateCollectionState)

module.exports = {
  collectionRouter,
}
