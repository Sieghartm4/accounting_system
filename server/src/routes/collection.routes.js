const express = require('express')
const { getCollections } = require('../controller/collection.controller')

const collectionRouter = express.Router()

collectionRouter.get('/', getCollections)

module.exports = {
  collectionRouter,
}
