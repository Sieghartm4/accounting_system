'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add c_collected_amount column to collections table
    await queryInterface.addColumn('collections', 'c_collected_amount', {
      type: Sequelize.DECIMAL(18, 2),
      allowNull: false,
      defaultValue: 0.00,
      comment: 'Total amount collected in this payment',
    })
  },

  async down(queryInterface, Sequelize) {
    // Remove c_collected_amount column
    await queryInterface.removeColumn('collections', 'c_collected_amount')
  },
}
