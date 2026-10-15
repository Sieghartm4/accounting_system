'use strict'

/**
 * Writes the row that actually grants a company its modules.
 *
 * ## Why this exists
 *
 * `master_user.subscription_id` is the legacy, per-user pointer. It is NOT what
 * authorisation reads. The accounting server resolves entitlement from
 * `master_company_subscription`, keyed by `mcs_db_name`, because a plan applies
 * to a company rather than to one login:
 *
 *   - a company has several users, each with their own login
 *   - `master_user.db_name` is legitimately non-unique (facebook_accounting has
 *     two users), so it cannot carry a UNIQUE constraint
 *   - seat caps and module locks are company-level requirements
 *
 * Nothing created that row. `register` wrote only `master_user`, and
 * `updateSubscription` updated only `master_user`. So a brand new company had no
 * entitlement row at all and resolved as `NO_SUBSCRIPTION_ROW` - required
 * modules only, every sellable module locked, regardless of which plan the
 * customer paid for.
 *
 * Both entry points now go through this function so there is one place that
 * knows the shape of the row and how the trial and period dates are derived.
 */

const { Query } = require('../database/util/queries.util')

/**
 * Query runner against the admin database.
 *
 * Defaults to the same pool `Query` uses everywhere else in this app, but is
 * injectable so the behaviour can be tested without touching live data. Every
 * statement is parameterised - db_name and plan ids are user-influenced and
 * must never be interpolated into SQL.
 */
const defaultAdminQuery = (sql, params = []) => Query(sql, params)

/**
 * Compute the trial and period end dates for a newly attached plan.
 *
 * A trial plan gets a trial end date only. A paid plan gets a period end date.
 * Both are left NULL otherwise, and the resolver treats a plan with no end date
 * at all as open-ended - reading NULL as expired would lock out paying
 * customers whose history row never had an end date.
 */
const deriveDates = (plan, now = new Date()) => {
  const addDays = (days) => {
    const d = new Date(now)
    d.setDate(d.getDate() + Number(days))
    return d
  }

  const isTrial = plan.sp_is_trial === 1 || plan.sp_is_trial === true

  if (isTrial && plan.sp_trial_days) {
    // Trial only. sp_billing_days applies to the period that follows, not to the
    // trial itself.
    return { trialEndsAt: addDays(plan.sp_trial_days), periodEndsAt: null }
  }

  if (plan.sp_billing_days) {
    return { trialEndsAt: null, periodEndsAt: addDays(plan.sp_billing_days) }
  }

  // No trial flag, no trial days and no billing days: open-ended.
  return { trialEndsAt: null, periodEndsAt: null }
}

/**
 * Attach a plan to a company, creating or replacing the entitlement row.
 *
 * Idempotent on db_name: calling it again for the same company updates the plan
 * in place rather than adding a second row. `mcs_db_name` carries a UNIQUE
 * constraint, so a plain second INSERT would fail - which is the behaviour that
 * makes this safe to call from both signup and plan-picking.
 *
 * @param {object}   deps
 * @param {function} deps.adminQuery  parameterized query against the admin DB
 * @param {number|null} planId  plan to attach, or null to record "no plan"
 * @param {string}   dbName    tenant database name, e.g. 'acme_accounting'
 * @param {number}   [currentUsers] seat count; the creator is included
 * @returns {Promise<{created: boolean, planId: number|null}>}
 */
const assignCompanyPlan = async ({
  adminQuery = defaultAdminQuery,
  planId,
  dbName,
  currentUsers = 1,
}) => {
  if (!dbName) throw new Error('assignCompanyPlan requires dbName')

  let plan = null
  if (planId !== null && planId !== undefined) {
    const rows = await adminQuery(
      `SELECT sp_id, sp_code, sp_name, sp_max_users, sp_trial_days,
              sp_billing_days, sp_is_trial, sp_price_minor
         FROM subscription_plans WHERE sp_id = ?`,
      [planId],
    )
    if (!rows || rows.length === 0) {
      // Refusing is deliberate: attaching a plan that does not exist would leave
      // the company entitled to nothing with no visible reason why.
      throw new Error(`Plan ${planId} does not exist`)
    }
    plan = rows[0]
  }

  const { trialEndsAt, periodEndsAt } = plan ? deriveDates(plan) : {}
  const status = plan ? 'active' : 'none'
  const maxUsers = plan ? Number(plan.sp_max_users) || 0 : 0

  // The whole result set, not the first row: destructuring here would give the
  // row, whose .length is undefined, so the update branch could never be taken
  // and every call would INSERT - failing on the UNIQUE(mcs_db_name) constraint
  // for any company that already had a row.
  const existing = await adminQuery(
    'SELECT mcs_id FROM master_company_subscription WHERE mcs_db_name = ?',
    [dbName],
  )

  if (Array.isArray(existing) && existing.length > 0) {
    await adminQuery(
      `UPDATE master_company_subscription
          SET mcs_plan_id = ?, mcs_status = ?, mcs_trial_ends_at = ?,
              mcs_period_ends_at = ?, mcs_max_users = ?, mcs_updated_at = NOW()
        WHERE mcs_db_name = ?`,
      [planId ?? null, status, trialEndsAt ?? null, periodEndsAt ?? null, maxUsers, dbName],
    )
    return { created: false, planId: planId ?? null }
  }

  await adminQuery(
    `INSERT INTO master_company_subscription
       (mcs_db_name, mcs_plan_id, mcs_status, mcs_trial_ends_at,
        mcs_period_ends_at, mcs_max_users, mcs_current_users, mcs_created_at, mcs_updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
    [
      dbName,
      planId ?? null,
      status,
      trialEndsAt ?? null,
      periodEndsAt ?? null,
      maxUsers,
      Math.max(Number(currentUsers) || 0, 0),
    ],
  )

  return { created: true, planId: planId ?? null }
}

module.exports = { assignCompanyPlan, deriveDates }
