'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const seedData = [
      {
        mra_access_id: 1,
        mra_name: 'responsibility_center',
        mra_status: 'Full Access',
      },
      {
        mra_access_id: 2,
        mra_name: 'responsibility_center',
        mra_status: 'Full Access',
      },
      {
        mra_access_id: 3,
        mra_name: 'responsibility_center',
        mra_status: 'Full Access',
      },
      {
        mra_access_id: 4,
        mra_name: 'responsibility_center',
        mra_status: 'Full Access',
      },
    ]

    await queryInterface.bulkInsert('master_route_access', seedData, {})
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete(
      'master_route_access',
      {
        mra_name: 'responsibility_center',
        mra_access_id: {
          [Sequelize.Op.in]: [1, 2, 3, 4],
        },
      },
      {},
    )
  },
}
