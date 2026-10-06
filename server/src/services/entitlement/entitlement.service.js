'use strict'

/**
 * Resolves what a company is entitled to, from the admin database.
 *
 * This is the single place that answers "may this tenant use module X, and how
 * many accounts does it get". Everything else - the login gate, the user cap,
 * the API guard - reads from here, so there is one interpretation of a
 * subscription rather than four.
 *
 * WHY THE CACHE IS KEYED ON dbName
 *
 * server/src/database/config/config.js keeps the current tenant in a
 * process-level mutable (`setTenantDb`). Two concurrent requests for different
 * tenants overwrite each other's value, so anything cached there would leak one
 * company's entitlement into another's request. The cache here is keyed by an
 * explicit dbName argument and never reads that global, so it cannot.
 *
 * WHY EXPIRY IS DECIDED HERE
 *
 * The nightly expire_subscriptions() procedure only reconciles the stored status
 * flag. If that flag were the authority, a trial could run for up to 24 hours
 * past its end. Access is therefore decided by comparing the end timestamps
 * against the current time on every resolve, and the stored status is treated as
 * an input rather than the answer.
 */

const { adminQuery } = require('../../database/util/adminDb.util')
// The catalog lives in the subscription app, which is a separate package with
// its own package.json. Reaching across apps with a relative path is the only
// option available; scripts/verify-module-registry.js asserts the two copies of
// the registry (this one and client/src/utils/routeProtection.js) stay in step,
// which is what makes the crossing tolerable.
const catalog = require('../../../../subscription/src/constants/moduleCatalog')

/** How long a resolved entitlement stays valid. */
const CACHE_TTL_MS = 60 * 1000

/** company -> { expiresAt, entitlement } */
const cache = new Map()

/** Companies whose entitlement changed since the last resolve, cleared on read. */
const dirty = new Set()

const now = () => Date.now()

/** Drop the cached entitlement for a company, or for all of them. */
const invalidate = (dbName) => {
  if (dbName) {
    dirty.add(dbName)
    cache.delete(dbName)
    return
  }
  dirty.clear()
  cache.clear()
}

/**
 * A company with no resolvable subscription.
 *
 * The module set is the required set and nothing else. That is deliberate: a
 * tenant we know nothing about still has to reach its dashboard, users and
 * company settings, otherwise an admin cannot repair it from the inside. Every
 * non-required module fails closed.
 */
const DENIED = Object.freeze({
  subscribed: false,
  status: 'none',
  reason: 'NO_SUBSCRIPTION',
  planCode: null,
  planId: null,
  maxUsers: 0,
  trialEndsAt: null,
  periodEndsAt: null,
  modules: Object.freeze([...catalog.REQUIRED_MODULES]),
})

const loadEntitlement = async (dbName) => {
  const rows = await adminQuery(
    `SELECT mcs.mcs_db_name, mcs.mcs_plan_id, mcs.mcs_status,
            mcs.mcs_trial_ends_at, mcs.mcs_period_ends_at, mcs.mcs_max_users,
            sp.sp_code AS plan_code, sp.sp_name AS plan_name
       FROM master_company_subscription mcs
       LEFT JOIN subscription_plans sp ON sp.sp_id = mcs.mcs_plan_id
      WHERE mcs.mcs_db_name = ?
      LIMIT 1`,
    [dbName],
  )

  const row = rows && rows[0]
  if (!row) return { ...DENIED, reason: 'NO_SUBSCRIPTION_ROW' }

  // Expiry is decided from the timestamps, not from mcs_status, so a stale
  // status flag cannot keep a lapsed tenant inside.
  const trialEndsAt = row.mcs_trial_ends_at ? new Date(row.mcs_trial_ends_at) : null
  const periodEndsAt = row.mcs_period_ends_at ? new Date(row.mcs_period_ends_at) : null
  const at = now()

  const trialExpired = trialEndsAt !== null && trialEndsAt.getTime() <= at
  const periodExpired = periodEndsAt !== null && periodEndsAt.getTime() <= at

  let status = String(row.mcs_status || 'none')
  let reason = null

  if (row.mcs_plan_id === null) {
    // Recorded but never subscribed.
    status = 'none'
    reason = 'NO_SUBSCRIPTION'
  } else if (trialExpired) {
    status = 'expired'
    reason = 'TRIAL_EXPIRED'
  } else if (periodExpired) {
    status = 'expired'
    reason = 'PERIOD_EXPIRED'
  } else if (status === 'past_due') {
    reason = 'PAST_DUE'
  } else if (status === 'cancelled') {
    reason = 'CANCELLED'
  } else if (status === 'expired') {
    reason = 'EXPIRED'
  }

  // A plan with no end date at all is treated as open-ended. Paid subscriptions
  // in the live data have sh_end_date = NULL because the end date was only ever
  // computed for trials, and reading NULL as "expired" would lock out paying
  // customers.
  const active = reason === null
  const subscribed = active

  let modules = []
  if (subscribed && row.mcs_plan_id !== null) {
    const moduleRows = await adminQuery(
      'SELECT pm_module FROM plan_modules WHERE pm_plan_id = ?',
      [row.mcs_plan_id],
    )
    const granted = (moduleRows || []).map((m) => catalog.canonicalModule(m.pm_module)).filter(Boolean)
    // Required modules are granted regardless of what plan_modules says, so a
    // mis-seeded plan cannot lock a tenant out of its own administration.
    modules = [...new Set([...catalog.REQUIRED_MODULES, ...granted])]
  } else {
    modules = [...catalog.REQUIRED_MODULES]
  }

  return {
    subscribed,
    status,
    reason,
    planId: row.mcs_plan_id === null ? null : Number(row.mcs_plan_id),
    planCode: row.plan_code || null,
    planName: row.plan_name || null,
    // The snapshot on the subscription row, not the plan's current value, so a
    // plan edit does not retroactively change a company's seat count mid-cycle.
    maxUsers: Number(row.mcs_max_users) || 0,
    trialEndsAt,
    periodEndsAt,
    modules,
    dbName: row.mcs_db_name,
  }
}

/**
 * Resolve a company's entitlement, from cache when fresh.
 *
 * @param {string} dbName tenant database name, e.g. 'acme_accounting'
 * @param {{ force?: boolean }} [options] force a reload, used right after a
 *        plan change or a subscribe so an upgrade takes effect immediately.
 */
const resolveEntitlement = async (dbName, options = {}) => {
  if (!dbName || typeof dbName !== 'string') return { ...DENIED, reason: 'NO_TENANT' }

  const force = options.force === true
  if (force) cache.delete(dbName)

  const hit = cache.get(dbName)
  if (!force && hit && hit.expiresAt > now()) {
    return hit.entitlement
  }

  let entitlement
  try {
    entitlement = await loadEntitlement(dbName)
  } catch (error) {
    // Fail closed. A database hiccup must not read as "everything permitted".
    console.error(`[entitlement] failed to resolve ${dbName}:`, error.message)
    return { ...DENIED, reason: 'RESOLUTION_FAILED', error: error.message }
  }

  cache.set(dbName, { entitlement, expiresAt: now() + CACHE_TTL_MS })
  dirty.delete(dbName)
  return entitlement
}

/** True when the company may use the module. Unknown codes fail closed. */
const hasModule = (entitlement, moduleCode) => {
  const canonical = catalog.canonicalModule(moduleCode)
  if (!canonical) return false
  const modules = entitlement && Array.isArray(entitlement.modules) ? entitlement.modules : []
  return modules.includes(canonical)
}

/**
 * Whether the company may add another user account.
 *
 * The creator counts toward the cap, so a plan with max_users = 2 permits the
 * creator plus one more. `currentCount` is the number of active users in the
 * tenant's own master_user table, passed in because counting requires opening the
 * tenant database and this module has no business doing that.
 */
const canAddUser = (entitlement, currentCount) => {
  if (!entitlement || !entitlement.subscribed) {
    return { allowed: false, reason: entitlement ? entitlement.reason : 'NO_SUBSCRIPTION' }
  }
  const cap = Number(entitlement.maxUsers) || 0
  const current = Number(currentCount) || 0
  if (current >= cap) {
    return {
      allowed: false,
      reason: 'USER_LIMIT_REACHED',
      currentUsers: current,
      maxUsers: cap,
    }
  }
  return { allowed: true, currentUsers: current, maxUsers: cap }
}

module.exports = {
  resolveEntitlement,
  hasModule,
  canAddUser,
  invalidate,
  DENIED,
  CACHE_TTL_MS,
}