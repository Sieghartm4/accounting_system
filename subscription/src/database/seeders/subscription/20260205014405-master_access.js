'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Inserted behind an existence check on ma_access_name.
    //
    // The previous version used an unguarded bulkInsert, so every re-run of
    // db:seed:all added a second 'Admin' and a second 'User'. That matters here
    // because master_route_access is keyed by access id: duplicated roles give
    // duplicated permission rows, and a role created against a stale id grants
    // permissions the user no longer has.
    const roles = [
      { ma_access_name: 'Admin', ma_status: 'active' },
      { ma_access_name: 'User', ma_status: 'active' },
    ]

    for (const role of roles) {
      const [existing] = await queryInterface.sequelize.query(
        'SELECT ma_access_id FROM master_access WHERE ma_access_name = ?',
        { replacements: [role.ma_access_name] },
      )
      if (existing.length === 0) {
        await queryInterface.bulkInsert('master_access', [role])
      }
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('master_access', null, {});
  },
};