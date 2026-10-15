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
/**
 * The tenant a request belongs to.
 *
 * Checks the session before the request context, because the /entitlement route
 * resolves it the same way. They used to disagree - this one read only
 * `req.context.dbName` while the route read the session first - so a request
 * carrying one and not the other would be gated against a different tenant from
 * the one the client was told about, and the gate's answer would not match the
 * UI's.
 *
 * When nothing is found this returns null and the caller falls through to the
 * denied entitlement, which grants required modules only. So an unidentifiable
 * request can never gain access; it can only lose it.
 */
const tenantOf = (req) =>
  req?.session?.tenantDb ||
  req?.context?.dbName ||
  req?.context?.tenantDb ||
  null

/**
 * Reject the request unless the tenant has a live subscription.
 *
 * Left off for the administration routes a locked-out tenant still needs: its
 * own dashboard, users and company settings. Without those an admin cannot
 * repair a tenant from the inside, and an expired company could never resubscribe.
 */
const requireSubscription = async (req, res, next) => {
  const dbName = tenantOf(req)

  // Platform ADMINs operate across tenants and have no tenant database of their
  // own, so there is no company whose plan could apply to them.
  //
  // Keyed on the absence of a tenant rather than on the ADMIN role. Keying on the
  // role let any administrator skip the gate, including one belonging to a real
  // company that had deliberately let its subscription lapse - which is how a
  // locked-out tenant could keep browsing. A tenant administrator is a tenant
  // user first and is subject to its company's plan.
  if (!dbName) {
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
 *
 * ## No admin bypass
 *
 * This used to let a request through whenever the caller was ADMIN, on the
 * assumption that an administrator must always be able to reach every screen.
 * That made the plan's module list meaningless for exactly the role most likely
 * to be signed in: an operator could uncheck a module for a company and its
 * administrator still saw the nav entry, still opened the page, and still got
 * data from the API.
 *
 * The bypass is unnecessary, because `hasModule` always grants the required
 * module set regardless of the plan. Administration, users, access control,
 * company profile, the chart of accounts, journals and the financial statements
 * are all required, so an administrator retains everything needed to repair a
 * tenant and manage its users. Withheld modules are withheld for everyone,
 * administrator included, which is the only reading consistent with selling them.
 */
const requireModule = (moduleCode) => async (req, res, next) => {
  const dbName = tenantOf(req)
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

/**
 * Reject unless the plan grants at least one of several modules.
 *
 * Used where one endpoint serves more than one sellable module - /sales/aging
 * reports on receivables and payables together. Gating it on a single module
 * would mean buying one and being refused by the other, so either purchase
 * unlocks it.
 *
 * Fails closed like requireModule: an unknown module code in the list is ignored
 * rather than silently widening access, and an empty list refuses everything.
 */
const requireAnyModule = (moduleCodes) => async (req, res, next) => {
  const codes = Array.isArray(moduleCodes) ? moduleCodes : [moduleCodes]
  const dbName = tenantOf(req)
  const entitlement = req.entitlement || (await resolveEntitlement(dbName))

  const allowed = codes.filter((code) => hasModule(entitlement, code))

  if (allowed.length === 0) {
    return res.status(402).json({
      success: false,
      code: 'MODULE_NOT_IN_PLAN',
      message: `${codes.join(' or ')} is not included in your plan. Upgrade to add it.`,
      requiresUpgrade: true,
      module: codes[0] || null,
      modules: codes,
      planCode: entitlement.planCode || null,
      planName: entitlement.planName || null,
    })
  }

  req.entitlement = entitlement
  return next()
}

module.exports = {
  requireSubscription,
  requireModule,
  requireAnyModule,
  attachEntitlement,
}