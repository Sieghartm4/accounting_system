'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.bulkInsert('subscription_plan_items', [
      {
        spi_id: 26,
        spi_subscription_plan_id: 1,
        spi_display_order: 1,
        spi_details: '7',
        spi_type: 'BILLING_CYCLE',
      },
      {
        spi_id: 27,
        spi_subscription_plan_id: 1,
        spi_display_order: 2,
        spi_details: '0',
        spi_type: 'PRICE',
      },
      {
        spi_id: 28,
        spi_subscription_plan_id: 1,
        spi_display_order: 3,
        spi_details: '1',
        spi_type: 'USERS',
      },
      {
        spi_id: 29,
        spi_subscription_plan_id: 1,
        spi_display_order: 4,
        spi_details: '7 days free trial',
        spi_type: 'FEATURES',
      },
      {
        spi_id: 30,
        spi_subscription_plan_id: 2,
        spi_display_order: 1,
        spi_details: '30',
        spi_type: 'BILLING_CYCLE',
      },
      {
        spi_id: 31,
        spi_subscription_plan_id: 2,
        spi_display_order: 2,
        spi_details: '4999',
        spi_type: 'PRICE',
      },
      {
        spi_id: 32,
        spi_subscription_plan_id: 2,
        spi_display_order: 3,
        spi_details: 'All Modules included',
        spi_type: 'MODULES',
      },
      {
        spi_id: 33,
        spi_subscription_plan_id: 2,
        spi_display_order: 4,
        spi_details: '2',
        spi_type: 'USERS',
      },
      {
        spi_id: 34,
        spi_subscription_plan_id: 3,
        spi_display_order: 1,
        spi_details: '30',
        spi_type: 'BILLING_CYCLE',
      },
      {
        spi_id: 35,
        spi_subscription_plan_id: 3,
        spi_display_order: 2,
        spi_details: '9999',
        spi_type: 'PRICE',
      },
      {
        spi_id: 36,
        spi_subscription_plan_id: 3,
        spi_display_order: 3,
        spi_details: '5',
        spi_type: 'USERS',
      },
      {
        spi_id: 37,
        spi_subscription_plan_id: 3,
        spi_display_order: 4,
        spi_details: 'All modules',
        spi_type: 'FEATURES',
      },
      {
        spi_id: 38,
        spi_subscription_plan_id: 3,
        spi_display_order: 5,
        spi_details: 'Additional modules included',
        spi_type: 'FEATURES',
      },
      {
        spi_id: 39,
        spi_subscription_plan_id: 4,
        spi_display_order: 1,
        spi_details: '365',
        spi_type: 'BILLING_CYCLE',
      },
      {
        spi_id: 40,
        spi_subscription_plan_id: 4,
        spi_display_order: 2,
        spi_details: '0',
        spi_type: 'PRICE',
      },
      {
        spi_id: 41,
        spi_subscription_plan_id: 4,
        spi_display_order: 3,
        spi_details: '1000',
        spi_type: 'USERS',
      },
    ]);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('subscription_plan_items', null, {});
  }
};
