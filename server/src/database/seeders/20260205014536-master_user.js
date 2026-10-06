'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    const masterUser = [
      {
        mu_fullname: 'Admin',
        mu_username: 'admin',
        mu_password: '21232f297a57a5a743894a0e4a801fc3',
        mu_access_id: 1,
        mu_email: null,
        mu_status: 'active'
      }
    ];

    for (const user of masterUser) {
      const [existing] = await queryInterface.sequelize.query(
        'SELECT mu_id FROM master_user WHERE mu_username = ?',
        { replacements: [user.mu_username] }
      );
      if (existing.length === 0) {
        await queryInterface.bulkInsert('master_user', [user]);
      }
    }
  },

  async down (queryInterface, Sequelize) {
    /**
     * Add commands to revert seed here.
     *
     * Example:
     * await queryInterface.bulkDelete('People', null, {});
     */
    await queryInterface.bulkDelete('master_user', null, {});
  }
};
