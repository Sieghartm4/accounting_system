'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.bulkInsert('responsibility_center', [
      {
        rc_code: 'RC-001',
        rc_name: 'Default Responsibility Center',
        rc_department: 'General',
        rc_status: 'ACTIVE',
      },
      {
        rc_code: 'RC-002',
        rc_name: 'Sales Department',
        rc_department: 'Sales',
        rc_status: 'ACTIVE',
      },
    ])
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('responsibility_center', null, {})
  },
}
