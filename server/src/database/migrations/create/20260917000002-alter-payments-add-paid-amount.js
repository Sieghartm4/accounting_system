'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add c_paid_amount column to payments table
    await queryInterface.addColumn('payments', 'c_paid_amount', {
      type: Sequelize.DECIMAL(18, 2),
      allowNull: false,
      defaultValue: 0.00,
      comment: 'Total amount paid in this payment',
    })
  },

  async down(queryInterface, Sequelize) {
    // Remove c_paid_amount column
    await queryInterface.removeColumn('payments', 'c_paid_amount')
  },
}
