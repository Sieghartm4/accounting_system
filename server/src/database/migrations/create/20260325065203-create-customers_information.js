'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('customers_information', {
      ci_id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      ci_customer_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'customers',
          key: 'c_id',
        },
      },
      ci_address: {
        type: Sequelize.TEXT('long'),
        allowNull: false,
      },
      ci_tin: {
        type: Sequelize.STRING(15),
        allowNull: false,
      },
      ci_details: {
        type: Sequelize.TEXT('long'),
        allowNull: true,
      },
      ci_contact: {
        type: Sequelize.STRING(15),
        allowNull: true,
      },
    })
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('customers_information')
  },
}
