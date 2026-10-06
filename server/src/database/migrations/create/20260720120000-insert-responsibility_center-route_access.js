'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // const seedData = [
    //   {
    //     mra_access_id: 1,
    //     mra_name: 'responsibility_center',
    //     mra_status: 'Full Access',
    //   },
    //   {
    //     mra_access_id: 2,
    //     mra_name: 'responsibility_center',
    //     mra_status: 'Full Access',
    //   },
    //   {
    //     mra_access_id: 3,
    //     mra_name: 'responsibility_center',
    //     mra_status: 'Full Access',
    //   },
    //   {
    //     mra_access_id: 4,
    //     mra_name: 'responsibility_center',
    //     mra_status: 'Full Access',
    //   },
    // ]

    // await queryInterface.bulkInsert('master_route_access', seedData, {})
  },

  async down(queryInterface, Sequelize) {
    // Deletes by name only. The previous filter also listed mra_access_id values
    // for roles this seed never wrote to, so the rollback depended on ids up()
    // never inserted. The row is identified by name, so removing every copy is
    // correct and cannot touch an unrelated route.
    await queryInterface.bulkDelete(
      'master_route_access',
      {
        mra_name: 'responsibility_center',
      },
      {},
    )
  },
}
