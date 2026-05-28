'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Change je_db_name column to allow null values
    await queryInterface.changeColumn('journal_entries', 'je_db_name', {
      type: Sequelize.STRING(300),
      allowNull: true,
    })

    // Change je_db_id column to allow null values
    await queryInterface.changeColumn('journal_entries', 'je_db_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
    })
  },

  async down(queryInterface, Sequelize) {
    // Optional: Revert columns to not allow null values if that was their original state
    await queryInterface.changeColumn('journal_entries', 'je_db_name', {
      type: Sequelize.STRING(300),
      allowNull: false,
    })

    await queryInterface.changeColumn('journal_entries', 'je_db_id', {
      type: Sequelize.INTEGER,
      allowNull: false,
    })
  },
}
