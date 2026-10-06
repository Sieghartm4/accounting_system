'use strict'

/**
 * The current company's plan, for the client.
 *
 * The client needs this to decide what to render before a page issues its first
 * request. Without it the only signal a locked-out user had was a 402 arriving
 * after the page had already mounted, which surfaced as a red "System Error"
 * toast and a half-drawn page rather than an explanation.
 *
 * Deliberately mounted ABOVE requireSubscription: a tenant whose trial has
 * lapsed must still be able to read its own state in order to pick a new plan.
 * Refusing this endpoint would leave the plan picker with nothing to render and
 * recreate the same dead end.
 *
 * Read-only, and returns no credential or tenant data - only what the client
 * already needs to draw navigation and the upgrade screen.
 */

const express = require('express')
const { resolveEntitlement, hasModule } = require('../services/entitlement/entitlement.service')
// Same catalog module the entitlement service resolves module codes against, so
// the client's view of what exists cannot drift from what the server enforces.
const catalog = require('../../../subscription/src/constants/moduleCatalog')

const entitlementRouter = express.Router()

/** Tenant database for this request, set by auth from the verified JWT. */
const tenantOf = (req) =>
  req?.session?.tenantDb ||
  req?.context?.dbName ||
  req?.session?.user?.dbName ||
  null

entitlementRouter.get('/', async (req, res) => {
  const dbName = tenantOf(req)

  if (!dbName) {
    return res.status(400).json({
      success: false,
      message: 'No tenant database is associated with this session.',
    })
  }

  try {
    const entitlement = await resolveEntitlement(dbName)

    res.status(200).json({
      success: true,
      data: {
        subscribed: entitlement.subscribed === true,
        status: entitlement.status,
        reason: entitlement.reason,
        planId: entitlement.planId,
        planCode: entitlement.planCode,
        planName: entitlement.planName,
        maxUsers: entitlement.maxUsers,
        trialEndsAt: entitlement.trialEndsAt,
        periodEndsAt: entitlement.periodEndsAt,
        // Always an array so the client never has to guard for its absence.
        modules: Array.isArray(entitlement.modules) ? entitlement.modules : [],
      },
    })
  } catch (error) {
    // Failing closed is deliberate: an unreadable entitlement must not read as
    // "everything is included".
    console.error('[entitlement] GET /entitlement failed:', error.message)
    res.status(500).json({
      success: false,
      message: 'Could not determine the current subscription.',
    })
  }
})

/**
 * Whether one module is included, for a component that only needs a yes/no.
 *
 * Kept separate from the endpoint above so a page can ask the narrow question
 * without downloading and re-deriving the whole entitlement.
 */
entitlementRouter.get('/module/:code', async (req, res) => {
  const dbName = tenantOf(req)

  if (!dbName) {
    return res.status(400).json({
      success: false,
      message: 'No tenant database is associated with this session.',
    })
  }

  try {
    const moduleCode = String(req.params.code || '').trim()
    const entitlement = await resolveEntitlement(dbName)

    res.status(200).json({
      success: true,
      data: {
        module: moduleCode,
        included: hasModule(entitlement, moduleCode),
      },
    })
  } catch (error) {
    console.error('[entitlement] GET /entitlement/module failed:', error.message)
    res.status(500).json({
      success: false,
      message: 'Could not determine module access.',
    })
  }
})

/**
 * The full catalog, so the upgrade screen can show what is available without a
 * second origin. The subscription app serves the same list; this copy exists so
 * the client needs no cross-origin request to render the upsell.
 */
entitlementRouter.get('/module-catalog', (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      required: catalog.REQUIRED_MODULES,
      defaultOn: catalog.DEFAULT_ON_MODULES,
      defaultOff: catalog.DEFAULT_OFF_MODULES,
      unsold: catalog.UNSOLD_MODULES,
      all: catalog.ALL_MODULES,
      defaultTemplate: catalog.defaultModuleTemplate(),
    },
  })
})

module.exports = { entitlementRouter }
