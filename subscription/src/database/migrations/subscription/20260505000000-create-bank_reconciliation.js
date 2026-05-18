'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('bank_reconciliation', {
      br_id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true
      },
      br_bank_account: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      br_coa_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'charts_of_accounts',
          key: 'coa_id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      br_running_balance: {
        type: Sequelize.DECIMAL(18, 2),
        allowNull: false,
        defaultValue: 0.00
      }
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('bank_reconciliation');
  }
};