'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('subscription_plan_items', {
      spi_id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      spi_subscription_plan_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'subscription_plans',
          key: 'sp_id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      spi_type: {
        type: Sequelize.ENUM('BILLING_CYCLE', 'PRICE', 'MODULES', 'FEATURES', 'USERS'),
        allowNull: false,
        comment: 'Type of plan item: BILLING_CYCLE (duration/period like Monthly, Annual, 7 days), PRICE (amount like 29.00), MODULES (modules included), FEATURES (feature details), USERS (number of users)',
      },
      spi_details: {
        type: Sequelize.TEXT('long'),
        allowNull: false,
        comment: 'Details based on type: period for BILLING_CYCLE, amount for PRICE, module list for MODULES, feature description for FEATURES, user count for USERS',
      },
      spi_display_order: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: 0,
        comment: 'Order in which to display items in the plan',
      },
    })
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('subscription_plan_items')
  },
}
