'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const columns = await queryInterface.describeTable('master_user')
    if (!columns.subscription_id) {
      await queryInterface.addColumn('master_user', 'subscription_id', {
        type: Sequelize.INTEGER,
        allowNull: true,
      })
    }
  },

  async down(queryInterface, Sequelize) {
    const columns = await queryInterface.describeTable('master_user')
    if (columns.subscription_id) {
      await queryInterface.removeColumn('master_user', 'subscription_id')
    }
  },
}
