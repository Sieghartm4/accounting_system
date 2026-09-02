'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn('customers_information', 'ci_tin', {
      type: Sequelize.STRING(20),
      allowNull: false,
    })
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.changeColumn('customers_information', 'ci_tin', {
      type: Sequelize.STRING(15),
      allowNull: false,
    })
  },
}
