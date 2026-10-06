'use strict'

/**
 * Display copy and legacy values for the seeded plans.
 *
 * The limits that actually drive behaviour (max users, trial days, billing days)
 * live in subscription_plans columns, and the modules live in plan_modules. This
 * seeder keeps subscription_plan_items populated because the pricing UI still
 * reads it for display, and because the historical USERS / BILLING_CYCLE /
 * PRICE rows are what the earlier backfill read.
 *
 * Inserted one row at a time behind an existence check: db:seed:all re-runs
 * every seeder, and the original bulkInsert created duplicates on each call.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const [plans] = await queryInterface.sequelize.query(
      'SELECT sp_id, sp_code FROM subscription_plans',
    )
    const byCode = new Map(plans.map((p) => [p.sp_code, Number(p.sp_id)]))

    // plan code -> items, in display order
    const ITEMS = {
      '34444': [
        { spi_type: 'BILLING_CYCLE', spi_details: '7' },
        { spi_type: 'PRICE', spi_details: '0' },
        { spi_type: 'USERS', spi_details: '1' },
        { spi_type: 'FEATURES', spi_details: '7 days free trial' },
      ],
      PRO: [
        { spi_type: 'BILLING_CYCLE', spi_details: '30' },
        { spi_type: 'PRICE', spi_details: '4999' },
        { spi_type: 'MODULES', spi_details: 'All Modules included' },
        { spi_type: 'USERS', spi_details: '2' },
      ],
      PREMIUM: [
        { spi_type: 'BILLING_CYCLE', spi_details: '30' },
        { spi_type: 'PRICE', spi_details: '9999' },
        { spi_type: 'USERS', spi_details: '5' },
        { spi_type: 'FEATURES', spi_details: 'All modules' },
        { spi_type: 'FEATURES', spi_details: 'Additional modules included' },
      ],
      '5L': [
        { spi_type: 'BILLING_CYCLE', spi_details: '365' },
        { spi_type: 'PRICE', spi_details: '0' },
        { spi_type: 'USERS', spi_details: '1000' },
      ],
    }

    for (const [code, items] of Object.entries(ITEMS)) {
      const planId = byCode.get(code)
      if (!planId) continue

      for (const [index, item] of items.entries()) {
        const [existing] = await queryInterface.sequelize.query(
          `SELECT spi_id FROM subscription_plan_items
            WHERE spi_subscription_plan_id = ? AND spi_type = ? AND spi_display_order = ?`,
          { replacements: [planId, item.spi_type, index + 1] },
        )
        if (existing.length === 0) {
          await queryInterface.bulkInsert('subscription_plan_items', [
            {
              spi_subscription_plan_id: planId,
              spi_display_order: index + 1,
              spi_details: item.spi_details,
              spi_type: item.spi_type,
            },
          ])
        }
      }
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('subscription_plan_items', null, {});
  },
};