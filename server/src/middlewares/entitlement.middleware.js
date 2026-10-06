const {
  resolveEntitlement,
  hasModule,
} = require('../services/entitlement/entitlement.service')

/**
 * Server-side subscription and module enforcement.
 *
 * WHY THIS EXISTS
 *
 * Module gating was entirely client-side. ProtectedRoute and ProtectedAction read
 * `sessionStorage.auth_user.route_access`, which is a string the browser owner
 * can edit, and the only thing stopping an API call was not calling it from the
 * UI. So a tenant on a plan without tax_compliance could POST to /tax/compute
 * directly and file returns it was not entitled to.
 *
 * It is worse than that while /route_access is writable: any authenticated user
 * could PUT a master_route_access row granting themselves the module, the client
 * would then read it back as a permission, and the UI would unlock legitimately.
 * Those writes are locked to plan owners in routes.startup.js.
 *
 * FAIL CLOSED
 *
 * An unrecognised module code, a missing tenant, or a resolver failure all deny.
 * The default is refusal, because the failure mode of getting this wrong is a
 * customer reading and writing another tenant's data.
 */

/** The tenant for this request, taken only from the verified JWT. */
const tenantOf = (req) => req?.context?.dbName || req?.context?.tenantDb || null

/**
 * Reject the request unless the tenant has a live subscription.
 *
 * Left off for the administration routes a locked-out tenant still needs: its
 * own dashboard, users and company settings. Without those an admin cannot
 * repair a tenant from the inside, and an expired company could never resubscribe.
 */
const requireSubscription = async (req, res, next) => {
  const dbName = tenantOf(req)

  // Platform ADMINs operate across tenants and are not subject to one plan.
  if (req?.context?.role === 'ADMIN' || req?.context?.roles?.includes('ADMIN')) {
    return next()
  }

  const entitlement = await resolveEntitlement(dbName)

  if (!entitlement.subscribed) {
    const expired =
      entitlement.reason === 'TRIAL_EXPIRED' ||
      entitlement.reason === 'PERIOD_EXPIRED' ||
      entitlement.reason === 'EXPIRED'

    // 402 rather than 403: the request is well-formed and authenticated, but the
    // account cannot pay for it. The client's global interceptor keys off
    // requiresSubscription and routes to the plan picker.
    return res.status(402).json({
      success: false,
      code: entitlement.reason || 'NO_SUBSCRIPTION',
      message: expired
        ? 'Your subscription has ended. Please choose a plan to continue.'
        : 'This action needs an active subscription.',
      requiresSubscription: true,
      trialExpired: expired,
      planCode: entitlement.planCode || null,
      planName: entitlement.planName || null,
    })
  }

  // Available to the rest of the request so a router need not resolve twice.
  req.entitlement = entitlement
  return next()
}

/**
 * Reject the request unless the tenant's plan grants this module.
 *
 * Apply after requireSubscription, or on its own where a read-only route should
 * still be reachable to a locked-out tenant.
 */
const requireModule = (moduleCode) => async (req, res, next) => {
  const dbName = tenantOf(req)

  if (req?.context?.role === 'ADMIN' || req?.context?.roles?.includes('ADMIN')) {
    return next()
  }

  const entitlement = req.entitlement || (await resolveEntitlement(dbName))

  if (!hasModule(entitlement, moduleCode)) {
    return res.status(402).json({
      success: false,
      code: 'MODULE_NOT_IN_PLAN',
      message: `${moduleCode} is not included in your plan. Upgrade to add it.`,
      requiresUpgrade: true,
      module: moduleCode,
      planCode: entitlement.planCode || null,
      planName: entitlement.planName || null,
    })
  }

  req.entitlement = entitlement
  return next()
}

/**
 * Attach the entitlement to the request without enforcing anything.
 *
 * Used on routes that should reflect entitlement in their response - the
 * profile endpoint that feeds the client's nav - even though they do not require
 * a live subscription.
 */
const attachEntitlement = async (req, res, next) => {
  try {
    req.entitlement = await resolveEntitlement(tenantOf(req))
  } catch (error) {
    console.error('[entitlement] attach failed:', error.message)
  }
  return next()
}

module.exports = {
  requireSubscription,
  requireModule,
  attachEntitlement,
}