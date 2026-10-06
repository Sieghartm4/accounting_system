const { resolveEntitlement, hasModule } = require('../services/entitlement/entitlement.service')
const catalog = require('../../../subscription/src/constants/moduleCatalog')

/**
 * Permission to change permissions.
 *
 * `PUT /route_access` and `POST /access` decide what every user in the tenant
 * can do. Leaving them open to any authenticated caller meant a tenant could
 * grant itself any module: write a master_route_access row, and the client -
 * which reads permissions from sessionStorage - would then show the module as
 * unlocked. That made plan-based module gating advisory, because the tenant
 * controlled its own entitlements.
 *
 * Two rules close it:
 *
 *   1. Only an Admin-role access level may edit permissions. A tenant that
 *      upgrades its plan still cannot let a normal user rewrite the matrix.
 *
 *   2. Even an Admin may only grant modules the plan actually includes. Without
 *      this, an Admin-role user on a plan without tax_compliance could grant
 *      themselves the row, and rule 1 alone would not help - the plan is what
 *      must bound what is grantable.
 *
 * Required modules are always grantable, since every plan carries them.
 *
 * Platform ADMINs (the subscription app's operators, who have no tenant) are
 * exempt so support can repair a tenant.
 */
const requirePermissionAdmin = async (req, res, next) => {
  const isPlatformAdmin =
    req?.context?.role === 'ADMIN' || req?.context?.roles?.includes('ADMIN')
  if (isPlatformAdmin) return next()

  const dbName = req?.context?.dbName || req?.context?.tenantDb || null

  // Read the caller's access level from the tenant database. The JWT carries a
  // userId but not an access_id, so this is a lookup rather than a claim.
  const { Query } = require('../database/util/queries.util')
  const { Master } = require('../database/model/Master')

  let rows
  try {
    rows = await Query(
      `SELECT mu.${Master.master_user.selectOptionColumns.access} AS access_name
         FROM ${Master.master_user.tablename} mu
        WHERE mu.${Master.master_user.selectOptionColumns.id} = ?
        LIMIT 1`,
      [req?.context?.userId],
      [Master.master_user.prefix_],
      null,
      dbName,
    )
  } catch (error) {
    console.error('[permissions] could not read caller access level:', error.message)
    return res.status(500).json({
      success: false,
      message: 'Could not verify permission to change access settings',
    })
  }

  const accessName = rows && rows[0] ? String(rows[0].access_name || '') : ''
  if (!/^admin$/i.test(accessName)) {
    return res.status(403).json({
      success: false,
      message:
        'Only an administrator can change access settings. Ask your administrator to make this change.',
      code: 'NOT_ACCESS_ADMIN',
    })
  }

  const entitlement = await resolveEntitlement(dbName)
  req.entitlement = entitlement
  return next()
}

/**
 * Reject a grant for a module the company's plan does not include.
 *
 * Applied to the body rather than as blanket middleware because the module
 * codes only appear once the payload is parsed. Reports the first offender
 * rather than silently dropping it, so an admin is not left believing a module
 * was granted when it was not.
 */
const rejectModulesOutsidePlan = (extractCodes) => async (req, res, next) => {
  const entitlement = req.entitlement || (await resolveEntitlement(
    req?.context?.dbName || req?.context?.tenantDb || null,
  ))

  const codes = typeof extractCodes === 'function' ? extractCodes(req) : []
  const offending = []

  for (const raw of codes) {
    const canonical = catalog.canonicalModule(raw)
    // A code the catalog does not know cannot be verified against the plan, so
    // it is refused rather than allowed on the assumption it is harmless.
    if (!canonical || !hasModule(entitlement, canonical)) {
      offending.push(raw)
    }
  }

  if (offending.length > 0) {
    return res.status(402).json({
      success: false,
      code: 'MODULE_NOT_IN_PLAN',
      message: `These modules are not in your plan and cannot be granted: ${offending.join(', ')}. Upgrade your plan to include them.`,
      requiresUpgrade: true,
      modules: offending,
      planCode: entitlement.planCode || null,
      planName: entitlement.planName || null,
    })
  }

  return next()
}

/** Pull module codes out of a master_route_access update payload. */
const codesFromRouteAccessUpdates = (req) => {
  const updates = Array.isArray(req.body?.updates) ? req.body.updates : []
  return updates
    .map((u) => u.name || u.route_name || u.routeName)
    .filter(Boolean)
}

/** Pull module codes out of a route_access creation payload. */
const codesFromRouteAccessCreate = (req) => {
  const body = req.body || {}
  const single = body.name || body.route_name || body.routeName
  if (single) return [single]
  if (Array.isArray(body.routes)) {
    return body.routes.map((r) => (typeof r === 'string' ? r : r?.name)).filter(Boolean)
  }
  return []
}

module.exports = {
  requirePermissionAdmin,
  rejectModulesOutsidePlan,
  codesFromRouteAccessUpdates,
  codesFromRouteAccessCreate,
}