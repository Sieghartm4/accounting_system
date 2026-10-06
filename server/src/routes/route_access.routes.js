const express = require('express')
const {
  getRouteAccessById,
  updateRouteAccess,
} = require('../controller/route_access.controller')
const {
  requirePermissionAdmin,
  rejectModulesOutsidePlan,
  codesFromRouteAccessUpdates,
  codesFromRouteAccessCreate,
} = require('../middlewares/permissions.middleware')

const routeAccessRouter = express.Router()

// Reading the permission matrix is an ordinary authenticated read and stays open
// to the tenant's own users, because the access screen shows it to anyone who
// can reach it.
//
// Writing it is different: these two routes decide what every user in the tenant
// can do, and they were previously reachable by any authenticated caller, which
// let a tenant grant itself a module its plan excluded. Both now require an
// Admin-role access level, and both refuse to grant a module outside the plan.
routeAccessRouter.post(
  '/',
  requirePermissionAdmin,
  rejectModulesOutsidePlan(codesFromRouteAccessCreate),
  getRouteAccessById,
)

routeAccessRouter.put(
  '/',
  requirePermissionAdmin,
  rejectModulesOutsidePlan(codesFromRouteAccessUpdates),
  updateRouteAccess,
)

module.exports = {
  routeAccessRouter,
}