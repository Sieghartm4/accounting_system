'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    const masterAccess = [
      {
        ma_access_name: 'Admin',
        ma_status: 'active'
      },
      {
        ma_access_name: 'User',
        ma_status: 'active'
      }
    ];

    for (const access of masterAccess) {
      const [existing] = await queryInterface.sequelize.query(
        'SELECT ma_access_id FROM master_access WHERE ma_access_name = ?',
        { replacements: [access.ma_access_name] }
      );
      if (existing.length === 0) {
        await queryInterface.bulkInsert('master_access', [access]);
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
    await queryInterface.bulkDelete('master_access', null, {});
  }
};
