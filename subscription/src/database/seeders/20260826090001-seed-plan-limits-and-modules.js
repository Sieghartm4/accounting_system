'use strict'

/**
 * Give the existing seeded plans real limits, and grant each one its modules.
 *
 * The four plans in 20260825120000-subscription_plans.js predate the limit
 * columns, so they would otherwise all default to 1 user / 30 days. The values
 * here are taken from what subscription_plan_items already said, so nothing
 * about the commercial intent changes:
 *
 *   1 BASIC PLAN     price 0     cycle 7      users 1   -> the free trial
 *   2 PROFESIONAL    price 4999  cycle 30     users 2
 *   3 PREMIUM        price 9999  cycle 30     users 5
 *   4 5Lsolutions    price 0     cycle 365    users 1000  (PRIVATE)
 *
 * Modules are granted from the default template, which deliberately excludes
 * tax_compliance, accounting_periods and recurring_journals. Those are the
 * modules a trial or entry plan should not carry, and an admin can add them to
 * any plan from the plan builder.
 *
 * Idempotent: existing rows are updated rather than duplicated, and
 * plan_modules has a unique key so re-running cannot double-grant.
 */
const catalog = require('../../../src/constants/moduleCatalog')

module.exports = {
  async up(queryInterface, Sequelize) {
    const [hasModules] = await queryInterface.sequelize.query(
      `SELECT TABLE_NAME FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'plan_modules'`,
    )
    if (hasModules.length === 0) {
      console.log('plan_modules not present; skipping module grants')
      return
    }

    // sp_id -> { max_users, trial_days, billing_days, price_minor, is_trial }
    const LIMITS = {
      1: { max_users: 1, trial_days: 7, billing_days: 7, price_minor: 0, is_trial: 1 },
      2: { max_users: 2, trial_days: null, billing_days: 30, price_minor: 499900, is_trial: 0 },
      3: { max_users: 5, trial_days: null, billing_days: 30, price_minor: 999900, is_trial: 0 },
      4: { max_users: 1000, trial_days: null, billing_days: 365, price_minor: 0, is_trial: 0 },
    }

    const [existingPlans] = await queryInterface.sequelize.query(
      'SELECT sp_id FROM subscription_plans',
    )
    const planIds = new Set(existingPlans.map((p) => Number(p.sp_id)))

    for (const [rawId, limit] of Object.entries(LIMITS)) {
      const id = Number(rawId)
      if (!planIds.has(id)) continue

      await queryInterface.sequelize.query(
        `UPDATE subscription_plans
            SET sp_max_users = ?, sp_trial_days = ?, sp_billing_days = ?,
                sp_price_minor = ?, sp_is_trial = ?
          WHERE sp_id = ?`,
        {
          replacements: [
            limit.max_users,
            limit.trial_days,
            limit.billing_days,
            limit.price_minor,
            limit.is_trial,
            id,
          ],
        },
      )
    }

    // Grant the default module set to every plan that has no modules yet. An
    // existing plan keeps whatever an admin has already chosen.
    const template = catalog.defaultModuleTemplate()
    for (const id of planIds) {
      const [current] = await queryInterface.sequelize.query(
        'SELECT COUNT(*) AS n FROM plan_modules WHERE pm_plan_id = ?',
        { replacements: [id] },
      )
      if (Number(current[0].n) > 0) continue

      for (const code of template) {
        await queryInterface.sequelize.query(
          `INSERT IGNORE INTO plan_modules (pm_plan_id, pm_module)
           VALUES (?, ?)`,
          { replacements: [id, code] },
        )
      }
      console.log(`granted ${template.length} modules to plan ${id}`)
    }
  },

  async down(queryInterface) {
    // Plan limits are left as they are: reverting would strip a live company's
    // seat allowance. Module grants are equally left, since removing them would
    // lock a paying tenant out of modules it is using.
  },
}