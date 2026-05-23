'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('bank_reconciliation', 'br_bank_statement_balance', {
      type: Sequelize.DECIMAL(18, 2),
      allowNull: false,
      defaultValue: 0.0,
    })
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('bank_reconciliation', 'br_bank_statement_balance')
  },
}

