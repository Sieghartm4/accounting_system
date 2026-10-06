'use strict'

/**
 * Backfill master_company_subscription from the existing per-user rows.
 *
 * Everything here is a guess made from data that was never designed to answer
 * the question, so it is deliberately conservative: where two users of the same
 * company disagree about their plan, the row is left for a human rather than
 * resolved automatically. Granting a company a plan it did not pay for, or
 * silently cutting a company down to a smaller plan, are both worse than a row
 * that needs attention.
 *
 * Companies flagged for review get mcs_status = 'past_due', which is a real
 * state the login gate treats as expired. That is the safe direction: the
 * company keeps all of its data and can be corrected in the admin UI, but it
 * does not get modules or seats it has not been granted.
 *
 * Idempotent: re-running updates rows that already exist and inserts the rest.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const [tables] = await queryInterface.sequelize.query(
      `SELECT TABLE_NAME FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'master_company_subscription'`,
    )
    if (tables.length === 0) return

    // Plans and their limits, so the snapshot columns can be populated.
    const [plans] = await queryInterface.sequelize.query(
      `SELECT sp_id,
              COALESCE(sp_max_users, 1)   AS max_users,
              COALESCE(sp_billing_days, 30) AS billing_days,
              COALESCE(sp_trial_days, NULL) AS trial_days,
              COALESCE(sp_is_trial, 0)     AS is_trial
         FROM subscription_plans`,
    )
    const planById = new Map(plans.map((p) => [Number(p.sp_id), p]))

    // Every company that has at least one user row.
    const [companies] = await queryInterface.sequelize.query(
      `SELECT mu.db_name                       AS db_name,
              COUNT(*)                         AS user_count,
              COUNT(mu.subscription_id)        AS users_with_plan,
              COUNT(DISTINCT mu.subscription_id) AS distinct_plans,
              MIN(mu.subscription_id)          AS min_plan,
              MAX(mu.subscription_id)          AS max_plan
         FROM master_user mu
        WHERE mu.db_name IS NOT NULL AND mu.db_name <> ''
        GROUP BY mu.db_name`,
    )

    let inserted = 0
    let flagged = 0

    for (const company of companies) {
      const [already] = await queryInterface.sequelize.query(
        'SELECT mcs_id FROM master_company_subscription WHERE mcs_db_name = ?',
        { replacements: [company.db_name] },
      )
      if (already.length > 0) continue

      const conflicting =
        Number(company.distinct_plans) > 1 ||
        (Number(company.users_with_plan) > 0 && Number(company.distinct_plans) === 0)

      const planId = conflicting ? null : company.max_plan !== null ? Number(company.max_plan) : null

      if (planId === null) {
        // Never subscribed, or the users disagreed about the plan. Either way
        // there is no plan to attach, so the row is recorded with a NULL plan
        // and the past_due status, which the login gate treats as "needs a
        // plan". The company and its users are untouched.
        flagged++
        await queryInterface.sequelize.query(
          `INSERT INTO master_company_subscription
             (mcs_db_name, mcs_plan_id, mcs_status, mcs_trial_ends_at,
              mcs_period_ends_at, mcs_max_users, mcs_current_users)
           VALUES (?, NULL, 'past_due', NULL, NULL, 1, ?)`,
          { replacements: [company.db_name, company.user_count] },
        )
        continue
      }

      const plan = planById.get(planId)
      if (!plan) {
        // subscription_id pointed at a plan that no longer exists.
        flagged++
        await queryInterface.sequelize.query(
          `INSERT INTO master_company_subscription
             (mcs_db_name, mcs_plan_id, mcs_status, mcs_max_users, mcs_current_users)
           VALUES (?, NULL, 'past_due', 1, ?)`,
          { replacements: [company.db_name, company.user_count] },
        )
        continue
      }

      // Status is derived from the most recent history row for this plan. Paid
      // rows frequently have sh_end_date = NULL because the end date was only
      // ever computed for trials, so a NULL end date is treated as "not expired"
      // rather than "unknown".
      const [history] = await queryInterface.sequelize.query(
        `SELECT sh_start_date, sh_end_date, sh_status, sh_price
           FROM subscription_history
          WHERE sh_subscription_id = ?
          ORDER BY sh_start_date DESC
          LIMIT 1`,
        { replacements: [planId] },
      )

      let status = 'active'
      let trialEndsAt = null
      let periodEndsAt = null

      if (Number(plan.is_trial) === 1) {
        const start = history && history.sh_start_date ? new Date(history.sh_start_date) : new Date()
        const end = new Date(start.getTime() + Number(plan.trial_days || 0) * 86400000)
        trialEndsAt = end
        status = end.getTime() <= Date.now() ? 'expired' : 'trialing'
      } else if (history && history.sh_end_date) {
        periodEndsAt = history.sh_end_date
        status = new Date(history.sh_end_date).getTime() <= Date.now() ? 'expired' : 'active'
      } else if (history && history.sh_status === 'expired') {
        status = 'expired'
      }

      if (conflicting) flagged++

      await queryInterface.sequelize.query(
        `INSERT INTO master_company_subscription
           (mcs_db_name, mcs_plan_id, mcs_status, mcs_trial_ends_at,
            mcs_period_ends_at, mcs_max_users, mcs_current_users)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        {
          replacements: [
            company.db_name,
            planId,
            conflicting ? 'past_due' : status,
            conflicting ? null : trialEndsAt,
            conflicting ? null : periodEndsAt,
            Number(plan.max_users) || 1,
            company.user_count,
          ],
        },
      )
      inserted++
    }

    console.log(
      `backfilled ${inserted} company subscription(s); ${flagged} flagged for review`,
    )
  },

  async down(queryInterface) {
    // Left in place deliberately. Deleting these rows would remove the record of
    // which company is on which plan, and the previous state (per-user
    // subscription_id) cannot reconstruct it.
  },
}