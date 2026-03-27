const express = require('express')
const { getRouteAccessById } = require('../controller/route_access.controller')

const routeAccessRouter = express.Router()

routeAccessRouter.post('/', getRouteAccessById)

module.exports = {
  routeAccessRouter,
}
