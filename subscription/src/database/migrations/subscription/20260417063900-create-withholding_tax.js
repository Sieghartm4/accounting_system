'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('withholding_tax', {
      wt_id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      wt_code: {
        type: Sequelize.STRING(20),
        allowNull: false,
        unique: true
      },
      wt_name: {
        type: Sequelize.STRING(300),
        allowNull: false
      },
      wt_rate: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: false
      },
      wt_tax_account: {
        type: Sequelize.STRING(200),
        allowNull: false
      },
      wt_description: {
        type: Sequelize.TEXT('long'),
        allowNull: true
      },
      wt_status: {
        type: Sequelize.ENUM('ACTIVE', 'INACTIVE'),
        allowNull: false,
        defaultValue: 'ACTIVE'
      }
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('withholding_tax');
  }
};
