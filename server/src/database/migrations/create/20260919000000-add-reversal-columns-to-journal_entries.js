'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('journal_entries', 'je_reversal_of_db_name', {
      type: Sequelize.STRING(300),
      allowNull: true,
    })
    await queryInterface.addColumn('journal_entries', 'je_reversal_of_db_id', {
      type: Sequelize.STRING(50),
      allowNull: true,
    })
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('journal_entries', 'je_reversal_of_db_id')
    await queryInterface.removeColumn('journal_entries', 'je_reversal_of_db_name')
  },
}