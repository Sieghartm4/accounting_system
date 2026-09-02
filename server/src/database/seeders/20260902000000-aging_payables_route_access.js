'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    // const [accessRows] = await queryInterface.sequelize.query(
    //   'SELECT ma_access_id FROM master_access',
    // )

    // for (const access of accessRows) {
    //   for (const route of ['aging_receivables', 'aging_payables']) {
    //     await queryInterface.sequelize.query(
    //       `INSERT INTO master_route_access
    //         (mra_access_id, mra_name, mra_status)
    //        SELECT ?, ?, 'Full Access'
    //        FROM DUAL
    //        WHERE NOT EXISTS (
    //          SELECT 1
    //          FROM master_route_access
    //          WHERE mra_access_id = ? AND mra_name = ?
    //        )`,
    //       {
    //         replacements: [access.ma_access_id, route, access.ma_access_id, route],
    //       },
    //     )
    //   }
    // }
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('master_route_access', {
      mra_name: ['aging_receivables', 'aging_payables'],
    })
  },
}
