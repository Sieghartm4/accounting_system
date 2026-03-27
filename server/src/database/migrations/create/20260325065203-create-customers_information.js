'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('customers_information', {
      ci_id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      ci_customer_code: {
        type: Sequelize.STRING(20),
        allowNull: true
      },
      ci_customer_name: {
        type: Sequelize.STRING(300),
        allowNull: true
      },
      ci_address: {
        type: Sequelize.TEXT('long'),
        allowNull: true
      },
      ci_tin: {
        type: Sequelize.STRING(15),
        allowNull: true
      },
      ci_details: {
        type: Sequelize.TEXT('long'),
        allowNull: true
      },
      ci_contact: {
        type: Sequelize.STRING(15),
        allowNull: true
      }
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('customers_information');
  }
};
