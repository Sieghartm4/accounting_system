'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const columns = await queryInterface.describeTable('bank_reconciliation_items')

    if (!columns.bri_ledger_id) {
      await queryInterface.addColumn('bank_reconciliation_items', 'bri_ledger_id', {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'journal_entries',
          key: 'je_id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      })
    }
  },

  async down(queryInterface) {
    const columns = await queryInterface.describeTable('bank_reconciliation_items')

    if (columns.bri_ledger_id) {
      await queryInterface.removeColumn('bank_reconciliation_items', 'bri_ledger_id')
    }
  },
}
