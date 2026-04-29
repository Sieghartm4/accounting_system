const express = require('express')
const { auth } = require('../middlewares/auth.middleware')
const { getCollections, getAllCollections, getSalesCollection, getSalesItemsCollection, createCollection, updateCollectionState } = require('../controller/collection.controller')

const collectionRouter = express.Router()

collectionRouter.use(auth) // Apply auth middleware to all collection routes
collectionRouter.get('/', getCollections)
collectionRouter.get('/sales-collection', getSalesCollection)
collectionRouter.get('/sales-items-collection', getSalesItemsCollection)
collectionRouter.get('/:collection_id', getAllCollections)
collectionRouter.post('/', createCollection)
collectionRouter.put('/collection-state', updateCollectionState)

module.exports = {
  collectionRouter,
}
