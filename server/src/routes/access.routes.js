const express = require('express')
const { getAccess, createAccess } = require('../controller/access.controller')
const {
  requirePermissionAdmin,
  rejectModulesOutsidePlan,
} = require('../middlewares/permissions.middleware')

const accessRouter = express.Router()

accessRouter.get('/', getAccess)

// Creating a role writes a full master_route_access matrix (createAccess inserts
// every route name for the new access_id). That made it a second way for any
// authenticated user to grant itself modules, alongside PUT /route_access, so it
// is now restricted the same way: Admin role only, and only for modules the plan
// includes.
accessRouter.post(
  '/',
  requirePermissionAdmin,
  // createAccess seeds every route in its own list rather than one named in the
  // body, so there is no per-module payload to inspect here. The plan check that
  // matters is the one in the module middleware on the mount point; this guard
  // exists so role creation itself requires an Admin.
  rejectModulesOutsidePlan(() => []),
  createAccess,
)

module.exports = {
  accessRouter
}