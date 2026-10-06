'use strict'

/**
 * Give subscription_plans the limits a plan actually needs, as real columns.
 *
 * Until now a plan carried no limits at all: days and user counts were stored
 * as free text in subscription_plan_items.spi_details behind an ENUM key
 * (spi_type = 'USERS' / 'BILLING_CYCLE'), which cannot be compared in a
 * constraint, indexed, or used in a COUNT without parsing a string.
 *
 * Days and user caps are single numbers, so they belong in columns. Modules stay
 * in a separate table because they are a set (plan_modules).
 *
 * sp_price_minor is in centavos rather than pesos. The seeded values were 4999
 * and 9999 meaning PHP 4,999 and PHP 9,999, which is indistinguishable from
 * 49.99 and 99.99 once read as a DECIMAL.
 *
 * sp_max_users counts the company creator, so a value of 2 means the creator
 * plus one more account.
 *
 * Every column is added behind a describeTable guard so this is safe to re-run
 * against a database where a previous attempt partially applied.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const columns = await queryInterface.describeTable('subscription_plans')

    const additions = [
      // Number of user accounts allowed under the plan, including the company
      // creator. 1 means the creator only.
      ['sp_max_users', {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 1,
      }],
      // Length of the free trial in days. NULL means this plan has no trial,
      // which is distinct from a trial of zero days.
      ['sp_trial_days', {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: true,
      }],
      // Paid period length in days. Drives mcs_period_ends_at.
      ['sp_billing_days', {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 30,
      }],
      // Price in centavos.
      ['sp_price_minor', {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
      }],
      // Marks the plan a new registration can start on without payment.
      ['sp_is_trial', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      }],
    ]

    for (const [name, definition] of additions) {
      if (!columns[name]) {
        await queryInterface.addColumn('subscription_plans', name, definition)
      }
    }

    const after = await queryInterface.describeTable('subscription_plans')
    if (!after.sp_created_at) {
      await queryInterface.addColumn('subscription_plans', 'sp_created_at', {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      })
    }
    if (!after.sp_updated_at) {
      await queryInterface.addColumn('subscription_plans', 'sp_updated_at', {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'),
      })
    }
  },

  async down(queryInterface) {
    const columns = await queryInterface.describeTable('subscription_plans')
    for (const name of [
      'sp_updated_at',
      'sp_created_at',
      'sp_is_trial',
      'sp_price_minor',
      'sp_billing_days',
      'sp_trial_days',
      'sp_max_users',
    ]) {
      if (columns[name]) {
        await queryInterface.removeColumn('subscription_plans', name)
      }
    }
  },
}