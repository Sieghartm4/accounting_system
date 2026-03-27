'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('charts_of_accounts', {
      coa_id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      coa_code: {
        type: Sequelize.STRING(20),
        allowNull: true
      },
      coa_name: {
        type: Sequelize.STRING(300),
        allowNull: true
      },
      coa_type: {
        type: Sequelize.ENUM('ASSETS', 'LIABILITIES', 'EQUITY', 'REVENUE', 'EXPENSES'),
        allowNull: true
      },
      coa_description: {
        type: Sequelize.TEXT('long'),
        allowNull: true
      },
      coa_status: {
        type: Sequelize.ENUM("ACTIVE","INACTIVE"),
        allowNull: true
      }
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('charts_of_accounts');
  }
};
