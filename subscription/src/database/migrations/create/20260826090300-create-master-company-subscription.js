'use strict'

/**
 * One subscription per company.
 *
 * Subscription state was previously keyed sh_mu_id -> master_user.mu_id, which
 * is per user. But master_user.db_name is the company, and a company legitimately
 * has several users: in the live data, db_name 'facebook_accounting' is mapped
 * to both 'lols' and 'charles', each with its own subscription_id. Neither user
 * owns the company, so neither can be the thing a plan is attached to. Both the
 * user cap and the module lock are properties of the company, not of a user, so
 * there has to be a company-level row to attach them to.
 *
 * UNIQUE (mcs_db_name) is the constraint that makes this work. It cannot live on
 * master_user.db_name, because that column is legitimately non-unique - one row
 * per user, many users per company.
 *
 * mcs_max_users is a snapshot of the plan's limit rather than a join through
 * plan_modules. The user-count check runs on every user-creation attempt, so it
 * should be a single indexed read; the snapshot also keeps the cap stable for the
 * period if a plan is edited mid-cycle.
 *
 * Expiry is enforced by comparing mcs_period_ends_at at login. The nightly
 * expire_subscriptions() procedure only reconciles the status flag, because a
 * midnight cron leaves up to 24 hours of access after a trial ends.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const [existing] = await queryInterface.sequelize.query(
      `SELECT TABLE_NAME FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'master_company_subscription'`,
    )
    if (existing.length > 0) return

    await queryInterface.createTable('master_company_subscription', {
      mcs_id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      // The tenant database name, e.g. 'acme_accounting'. One row per company.
      mcs_db_name: {
        type: Sequelize.STRING(300),
        allowNull: false,
      },
      mcs_plan_id: {
        type: Sequelize.INTEGER,
        // Nullable: NULL means "never subscribed", which is a real state - the
        // login gate sends those companies to the plan page. Distinct from
        // having a plan that has since expired.
        allowNull: true,
        references: {
          model: 'subscription_plans',
          key: 'sp_id',
        },
        // RESTRICT, not CASCADE: deleting a plan that companies are still on
        // would silently strip their entitlements. Retire a plan instead.
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      mcs_status: {
        type: Sequelize.ENUM('trialing', 'active', 'past_due', 'expired', 'cancelled'),
        allowNull: false,
        defaultValue: 'trialing',
      },
      // Set when a trial starts and never cleared by a cron, so an expired trial
      // is still readable for display and audit.
      mcs_trial_ends_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      // Paid period end. Compared against NOW() at login to decide access.
      mcs_period_ends_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      // Snapshot of the plan's user cap, including the company creator.
      mcs_max_users: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 1,
      },
      // Number of accounts currently provisioned, kept for the admin list so it
      // does not have to open every tenant database to render.
      mcs_current_users: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
      },
      mcs_created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      mcs_updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'),
      },
    })

    await queryInterface.addIndex('master_company_subscription', {
      fields: ['mcs_db_name'],
      unique: true,
      name: 'unique_company_subscription',
    })
    await queryInterface.addIndex('master_company_subscription', ['mcs_plan_id'])
    await queryInterface.addIndex('master_company_subscription', {
      fields: ['mcs_status', 'mcs_period_ends_at'],
      name: 'idx_company_subscription_expiry',
    })
  },

  async down(queryInterface) {
    const [existing] = await queryInterface.sequelize.query(
      `SELECT TABLE_NAME FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'master_company_subscription'`,
    )
    if (existing.length > 0) {
      await queryInterface.dropTable('master_company_subscription')
    }
  },
}