'use strict'

/**
 * Resolves what a company is entitled to, for the subscription server.
 *
 * This is the admin application's copy of server/src/services/entitlement/.
 * The two are separate Node apps with their own package.json and their own
 * database pools - the accounting server talks to a tenant database per request,
 * this one talks to the admin database - so the resolution cannot be shared by
 * require(). Keeping two copies is only tolerable while they are provably the
 * same, which scripts/verify-module-registry.js checks: both import
 * subscription/src/constants/moduleCatalog, so the module vocabulary cannot drift
 * even though the code around it is duplicated.
 *
 * The accounting server's copy additionally serves the API guard, so it caches.
 * This copy is only used at login and at subscribe - a handful of calls per
 * session - so it deliberately does not cache and always reads current state.
 * A user whose trial expired a second ago must not get in on a stale answer.
 *
 * Expiry is decided from the timestamps rather than the stored status flag.
 * expire_subscriptions() runs at midnight and only reconciles the flag, so
 * trusting it would leave up to 24 hours of access after a trial ends.
 */

const { Query } = require('../database/util/queries.util')
const catalog = require('../constants/moduleCatalog')

/** Statuses that mean the company may use the tenant right now. */
const isActiveStatus = (status) =>
  status === 'active' || status === 'trialing'

/**
 * Resolve a company's entitlement.
 *
 * @param {string} dbName tenant database name, e.g. 'acme_accounting'
 * @returns {Promise<object>} entitlement; never null, never throws
 */
const resolveEntitlement = async (dbName) => {
  const denied = (reason) => ({
    subscribed: false,
    status: 'none',
    reason,
    planId: null,
    planCode: null,
    planName: null,
    maxUsers: 0,
    trialEndsAt: null,
    periodEndsAt: null,
    modules: [...catalog.REQUIRED_MODULES],
  })

  if (!dbName || typeof dbName !== 'string') return denied('NO_TENANT')

  let rows
  try {
    rows = await Query(
      `SELECT mcs.mcs_plan_id, mcs.mcs_status,
              mcs.mcs_trial_ends_at, mcs.mcs_period_ends_at, mcs.mcs_max_users,
              sp.sp_code AS plan_code, sp.sp_name AS plan_name,
              sp.sp_trial_days, sp.sp_billing_days, sp.sp_price_minor,
              sp.sp_is_trial
         FROM master_company_subscription mcs
         LEFT JOIN subscription_plans sp ON sp.sp_id = mcs.mcs_plan_id
        WHERE mcs.mcs_db_name = ?
        LIMIT 1`,
      [dbName],
    )
  } catch (error) {
    console.error(`[entitlement] resolve failed for ${dbName}:`, error.message)
    return denied('RESOLUTION_FAILED')
  }

  const row = rows && rows[0]
  if (!row) return denied('NO_SUBSCRIPTION_ROW')

  // A row with no plan is a company that has never subscribed. It is not the
  // same as a lapsed one, and the client shows a different message for each.
  if (row.mcs_plan_id === null) return denied('NO_SUBSCRIPTION')

  const trialEndsAt = row.mcs_trial_ends_at ? new Date(row.mcs_trial_ends_at) : null
  const periodEndsAt = row.mcs_period_ends_at ? new Date(row.mcs_period_ends_at) : null
  const at = Date.now()

  const trialExpired = trialEndsAt !== null && trialEndsAt.getTime() <= at
  const periodExpired = periodEndsAt !== null && periodEndsAt.getTime() <= at

  let reason = null
  let status = String(row.mcs_status || 'none')

  if (trialExpired) {
    reason = 'TRIAL_EXPIRED'
  } else if (periodExpired) {
    reason = 'PERIOD_EXPIRED'
  } else if (status === 'past_due') {
    reason = 'PAST_DUE'
  } else if (status === 'cancelled') {
    reason = 'CANCELLED'
  } else if (status === 'expired') {
    reason = 'EXPIRED'
  } else if (!isActiveStatus(status)) {
    reason = 'INACTIVE'
  }

  if (reason !== null) {
    // A company we are turning away still gets the required modules in the
    // object it is handed, so anything that renders the plan-picker page can
    // describe what it would be buying. Access itself is refused by the caller.
    return {
      subscribed: false,
      status: reason === 'TRIAL_EXPIRED' || reason === 'PERIOD_EXPIRED' ? 'expired' : status,
      reason,
      planId: Number(row.mcs_plan_id),
      planCode: row.plan_code || null,
      planName: row.plan_name || null,
      maxUsers: Number(row.mcs_max_users) || 0,
      trialEndsAt,
      periodEndsAt,
      modules: [...catalog.REQUIRED_MODULES],
    }
  }

  let modules = []
  try {
    const moduleRows = await Query(
      'SELECT pm_module FROM plan_modules WHERE pm_plan_id = ?',
      [row.mcs_plan_id],
    )
    const granted = (moduleRows || [])
      .map((m) => catalog.canonicalModule(m.pm_module))
      .filter(Boolean)
    // Required modules are unioned in unconditionally, so a mis-seeded plan can
    // never lock a tenant out of its own dashboard or user administration.
    modules = [...new Set([...catalog.REQUIRED_MODULES, ...granted])]
  } catch (error) {
    console.error(`[entitlement] module load failed for ${dbName}:`, error.message)
    modules = [...catalog.REQUIRED_MODULES]
  }

  return {
    subscribed: true,
    status,
    reason: null,
    planId: Number(row.mcs_plan_id),
    planCode: row.plan_code || null,
    planName: row.plan_name || null,
    maxUsers: Number(row.mcs_max_users) || 0,
    trialDays: row.sp_trial_days === null ? null : Number(row.sp_trial_days),
    billingDays: Number(row.sp_billing_days) || 30,
    priceMinor: Number(row.sp_price_minor) || 0,
    isTrial: Number(row.sp_is_trial) === 1,
    trialEndsAt,
    periodEndsAt,
    modules,
  }
}

module.exports = { resolveEntitlement }