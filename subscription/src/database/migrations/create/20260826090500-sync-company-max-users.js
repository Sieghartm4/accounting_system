'use strict'

/**
 * Re-sync each company's mcs_max_users snapshot from its plan.
 *
 * The snapshot exists so the user-count check is one indexed read and so a plan
 * edit does not retroactively change a company's seat count mid-cycle. That
 * makes it a cache of the plan's limit, and a cache has to be refreshed when the
 * thing it caches changes.
 *
 * This exists because of an ordering problem found while building the feature:
 * the backfill migration ran before the seeder that populates sp_max_users, so
 * every snapshot was written as 1 (the column default) and companies on the
 * 2-seat and 5-seat plans were capped at one account. Running this after seeding
 * corrects them.
 *
 * Deliberately not a trigger: the snapshot is meant to be stable for the billing
 * period, so it is refreshed by an explicit administrative action - at signup,
 * at subscribe, at plan change, and by this migration - rather than automatically
 * whenever someone edits a plan.
 *
 * Idempotent.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const [tables] = await queryInterface.sequelize.query(
      `SELECT TABLE_NAME FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'master_company_subscription'`,
    )
    if (tables.length === 0) return

    // Only rows that actually carry a plan. A row with a NULL plan has no limit
    // to copy and stays as it is, so the login gate keeps sending it to the plan
    // page rather than silently granting seats.
    const result = await queryInterface.sequelize.query(
      `UPDATE master_company_subscription mcs
         JOIN subscription_plans sp ON sp.sp_id = mcs.mcs_plan_id
          SET mcs.mcs_max_users = sp.sp_max_users
        WHERE mcs.mcs_plan_id IS NOT NULL
          AND mcs.mcs_max_users <> sp.sp_max_users`,
    )

    const [rows] = await queryInterface.sequelize.query(
      `SELECT mcs_db_name, mcs_max_users FROM master_company_subscription
        WHERE mcs_plan_id IS NOT NULL ORDER BY mcs_db_name`,
    )
    console.log(`synced max-user snapshots for ${rows.length} company subscription(s)`)
    for (const row of rows) {
      console.log(`  ${row.mcs_db_name}: max_users=${row.mcs_max_users}`)
    }
  },

  async down(queryInterface) {
    // Nothing to revert. The previous values were wrong.
  },
}