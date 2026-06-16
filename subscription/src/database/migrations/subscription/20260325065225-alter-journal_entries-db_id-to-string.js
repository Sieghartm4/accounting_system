'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn('journal_entries', 'je_db_id', {
      type: Sequelize.STRING(50),
      allowNull: true,
    })
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.changeColumn('journal_entries', 'je_db_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
    })
  },
}
