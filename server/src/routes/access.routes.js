const express = require('express')
const { getAccess, createAccess } = require('../controller/access.controller')

const accessRouter = express.Router()

accessRouter.get('/', getAccess)
accessRouter.post('/', createAccess)

module.exports = {
  accessRouter
}
