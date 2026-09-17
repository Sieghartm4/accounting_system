'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Step 1: Add s_paid_amount column to track running total paid
    const [columns] = await queryInterface.sequelize.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'sales' 
      AND COLUMN_NAME = 's_paid_amount'
      AND TABLE_SCHEMA = DATABASE()
    `)

    if (columns.length === 0) {
      await queryInterface.addColumn('sales', 's_paid_amount', {
        type: Sequelize.DECIMAL(18, 2),
        allowNull: false,
        defaultValue: 0.00,
        comment: 'Running total of payments applied to this invoice',
      })
    } else {
      console.log('s_paid_amount column already exists in sales, skipping')
    }

    // Step 2: Add new enum values to s_status
    // Note: MySQL doesn't support adding enum values directly, so we need to modify the column
    await queryInterface.sequelize.query(`
      ALTER TABLE sales 
      MODIFY COLUMN s_status ENUM('UNPAID', 'PARTIALLY_PAID', 'PAID', 'OVERPAID', 'REJECTED') 
      NOT NULL DEFAULT 'UNPAID'
    `)
  },

  async down(queryInterface, Sequelize) {
    // Step 1: Revert to original enum values
    await queryInterface.sequelize.query(`
      ALTER TABLE sales 
      MODIFY COLUMN s_status ENUM('PAID', 'UNPAID', 'REJECTED') 
      NOT NULL DEFAULT 'UNPAID'
    `)

    // Step 2: Remove s_paid_amount column
    await queryInterface.removeColumn('sales', 's_paid_amount')
  },
}
