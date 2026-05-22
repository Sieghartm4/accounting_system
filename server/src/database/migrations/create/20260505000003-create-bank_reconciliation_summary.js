'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('bank_reconciliation_summary', {
      brs_id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      brs_br_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'bank_reconciliation',
          key: 'br_id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      brs_start_date: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      brs_end_date: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      brs_adjusted_bank_balance: {
        type: Sequelize.DECIMAL(18, 2),
        allowNull: false,
        defaultValue: 0.0,
      },
      brs_adjusted_book_balance: {
        type: Sequelize.DECIMAL(18, 2),
        allowNull: false,
        defaultValue: 0.0,
      },
      brs_final_output: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      brs_prepared_by: {
        type: Sequelize.STRING(300),
        allowNull: false,
      },
      brs_created_date: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
    })
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('bank_reconciliation_summary')
  },
}
