'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    // Inserted one at a time behind an existence check on sp_code.
    //
    // The previous version used a single bulkInsert with explicit sp_id values,
    // which fails with a validation error on any database that already has these
    // rows. Because seeders run in filename order, that failure stopped every
    // later seeder - including the plan limits and module grants - from ever
    // running. Checking sp_code makes the set re-runnable, which is what
    // db:seed:all needs to be safe to call again.
    const plans = [
      {
        sp_code: '34444',
        sp_name: 'BASIC PLAN',
        sp_description: 'basic plan',
        sp_status: 'PUBLIC',
      },
      {
        sp_code: 'PRO',
        sp_name: 'PROFESIONAL PLAN',
        sp_description: 'For ambitious companies ready to grow',
        sp_status: 'PUBLIC',
      },
      {
        sp_code: 'PREMIUM',
        sp_name: 'PREMIUM PLAN',
        sp_description: 'For premium company who wants to indulge deeper into improving their workflow',
        sp_status: 'PUBLIC',
      },
      {
        sp_code: '5L',
        sp_name: '5Lsolutions',
        sp_description: 'dubis gut genug',
        sp_status: 'PRIVATE',
      },
    ]

    for (const plan of plans) {
      const [existing] = await queryInterface.sequelize.query(
        'SELECT sp_id FROM subscription_plans WHERE sp_code = ?',
        { replacements: [plan.sp_code] },
      )
      if (existing.length === 0) {
        await queryInterface.bulkInsert('subscription_plans', [plan])
      }
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('subscription_plans', null, {});
  },
};