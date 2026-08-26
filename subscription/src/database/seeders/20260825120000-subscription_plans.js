'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.bulkInsert('subscription_plans', [
      {
        sp_id: 1,
        sp_code: '34444',
        sp_name: 'BASIC PLAN',
        sp_description: 'basic plan',
        sp_status: 'PUBLIC',
      },
      {
        sp_id: 2,
        sp_code: 'PRO',
        sp_name: 'PROFESIONAL PLAN',
        sp_description: 'For ambitious companies ready to grow',
        sp_status: 'PUBLIC',
      },
      {
        sp_id: 3,
        sp_code: 'PREMIUM',
        sp_name: 'PREMIUM PLAN',
        sp_description: 'For premium company who wants to indulge deeper into improving their workflow',
        sp_status: 'PUBLIC',
      },
      {
        sp_id: 4,
        sp_code: '5L',
        sp_name: '5Lsolutions',
        sp_description: 'dubis gut genug',
        sp_status: 'PRIVATE',
      },
    ]);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('subscription_plans', null, {});
  }
};
