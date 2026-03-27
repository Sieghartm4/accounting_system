'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    /**
     * Add seed commands here.
     *
     * Example:
     * await queryInterface.bulkInsert('People', [{
     *   name: 'John Doe',
     *   isBetaMember: false
     * }], {});
    */
       await queryInterface.bulkInsert('master_route_access', [
      {
        mra_access_id: 1,
        mra_name: 'dashboard',
        mra_status: 'Full Access'
      },
      {
        mra_access_id: 1,
        mra_name: 'access',
        mra_status: 'Full Access'
      },
      {
        mra_access_id: 1,
        mra_name: 'users',
        mra_status: 'Full Access'
      }
    ]);
  },

  async down (queryInterface, Sequelize) {
    /**
     * Add commands to revert seed here.
     *
     * Example:
     * await queryInterface.bulkDelete('People', null, {});
     */
  }
};
