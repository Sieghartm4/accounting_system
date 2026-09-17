'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add c_paid_amount column to payments table
    const [columns] = await queryInterface.sequelize.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'payments' 
      AND COLUMN_NAME = 'c_paid_amount'
      AND TABLE_SCHEMA = DATABASE()
    `)

    if (columns.length === 0) {
      await queryInterface.addColumn('payments', 'c_paid_amount', {
        type: Sequelize.DECIMAL(18, 2),
        allowNull: false,
        defaultValue: 0.00,
        comment: 'Total amount paid in this payment',
      })
    } else {
      console.log('c_paid_amount column already exists in payments, skipping')
    }
  },

  async down(queryInterface, Sequelize) {
    // Remove c_paid_amount column
    await queryInterface.removeColumn('payments', 'c_paid_amount')
  },
}
