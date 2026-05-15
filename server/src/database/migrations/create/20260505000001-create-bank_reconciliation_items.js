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
          model: 'chart_of_accounts', // Adjust to your actual COA table name
          key: 'coa_id'               // Adjust to your actual COA primary key
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      br_running_balance: {
        type: Sequelize.DECIMAL(18, 2),
        allowNull: false,
        defaultValue: 0.00
      },
      br_created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      br_updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('bank_reconciliation');
  }
};