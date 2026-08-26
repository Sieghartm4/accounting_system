'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    /**
     * Add seed commands here.
     *
     * Example:
     * await queryInterface.bulkInsert('People', [{
     *   name: 'John Doe',
     *   isBetaMember: false
     * }], {});
     */

    // Check if admin user already exists
    const [existingAdmin] = await queryInterface.sequelize.query(
      'SELECT mu_id, mu_role FROM master_user WHERE mu_username = ? AND mu_password = ?',
      {
        replacements: ['admin', 'c932aca5bb741bb371e7f7b5505d324c'],
        type: Sequelize.QueryTypes.SELECT
      }
    );

    if (existingAdmin) {
      // Admin user exists, update role to ADMIN if needed
      if (existingAdmin.mu_role !== 'ADMIN') {
        await queryInterface.sequelize.query(
          'UPDATE master_user SET mu_role = ? WHERE mu_id = ?',
          {
            replacements: ['ADMIN', existingAdmin.mu_id],
            type: Sequelize.QueryTypes.UPDATE
          }
        );
        console.log('Updated existing admin user role to ADMIN');
      } else {
        console.log('Admin user already exists with ADMIN role');
      }
    } else {
      // Admin user doesn't exist, insert new one
      await queryInterface.bulkInsert('master_user', [
        {
          mu_username: 'admin',
          mu_password: 'c932aca5bb741bb371e7f7b5505d324c',
          db_name: '',
          mu_status: 'active',
          mu_role: 'ADMIN',
          subscription_id: null,
        },
      ]);
      console.log('Created new admin user');
    }
  },

  async down(queryInterface, Sequelize) {
    /**
     * Add commands to revert seed here.
     *
     * Example:
     * await queryInterface.bulkDelete('People', null, {});
     */
    await queryInterface.bulkDelete('master_user', null, {})
  },
}
