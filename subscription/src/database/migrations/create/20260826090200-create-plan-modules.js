'use strict'

/**
 * Normalised module entitlements per plan.
 *
 * Modules used to be a single free-text row: spi_type = 'MODULES' with
 * spi_details = 'All Modules included'. Nothing could verify it, nothing could
 * index it, and no code ever read it. A plan listing the modules it grants is a
 * set, so it belongs in a table with one row per module.
 *
 * pm_module holds the same snake_case codes stored in master_route_access
 * (see subscription/src/constants/moduleCatalog.js). The unique constraint is
 * what makes "grant a module twice" impossible.
 *
 * This table lives in the admin database next to subscription_plans, so the
 * foreign key is legal. No equivalent table is created in any tenant database:
 * MySQL cannot express a foreign key across databases, which is exactly why
 * entitlement is resolved from here at request time rather than replicated into
 * each tenant.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const [existing] = await queryInterface.sequelize.query(
      `SELECT TABLE_NAME FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'plan_modules'`,
    )
    if (existing.length > 0) return

    await queryInterface.createTable('plan_modules', {
      pm_id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      pm_plan_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'subscription_plans',
          key: 'sp_id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      pm_module: {
        type: Sequelize.STRING(100),
        allowNull: false,
        comment: 'Module code, matching master_route_access.mra_name',
      },
      pm_created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    })

    await queryInterface.addIndex('plan_modules', ['pm_plan_id'])
    await queryInterface.addIndex('plan_modules', ['pm_module'])
    await queryInterface.addIndex('plan_modules', {
      fields: ['pm_plan_id', 'pm_module'],
      unique: true,
      name: 'unique_plan_module',
    })
  },

  async down(queryInterface) {
    const [existing] = await queryInterface.sequelize.query(
      `SELECT TABLE_NAME FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'plan_modules'`,
    )
    if (existing.length > 0) {
      await queryInterface.dropTable('plan_modules')
    }
  },
}