const express = require('express')
const { getRouteAccessById, updateRouteAccess } = require('../controller/route_access.controller')

const routeAccessRouter = express.Router()

routeAccessRouter.post('/', getRouteAccessById)
routeAccessRouter.put('/', updateRouteAccess)

module.exports = {
  routeAccessRouter,
}
