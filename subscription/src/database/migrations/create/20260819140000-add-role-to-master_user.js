'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const columns = await queryInterface.describeTable('master_user')
    if (!columns.mu_role) {
      await queryInterface.addColumn('master_user', 'mu_role', {
        type: Sequelize.ENUM('ADMIN', 'USER'),
        allowNull: false,
        defaultValue: 'USER',
        after: 'mu_status',
      })
    }
  },

  async down(queryInterface, Sequelize) {
    const columns = await queryInterface.describeTable('master_user')
    if (columns.mu_role) await queryInterface.removeColumn('master_user', 'mu_role')
  },
}
