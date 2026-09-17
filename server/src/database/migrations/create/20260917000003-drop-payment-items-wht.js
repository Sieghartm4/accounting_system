'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Drop ci_witholding_tax column from payment_items table
    const [columns] = await queryInterface.sequelize.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'payment_items' 
      AND COLUMN_NAME = 'ci_witholding_tax'
      AND TABLE_SCHEMA = DATABASE()
    `)

    if (columns.length > 0) {
      console.log('Dropping ci_witholding_tax column from payment_items')
      await queryInterface.removeColumn('payment_items', 'ci_witholding_tax')
    } else {
      console.log('ci_witholding_tax column not found in payment_items, skipping')
    }
  },

  async down(queryInterface, Sequelize) {
    // Restore ci_witholding_tax column to payment_items table
    const [columns] = await queryInterface.sequelize.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'payment_items' 
      AND COLUMN_NAME = 'ci_witholding_tax'
      AND TABLE_SCHEMA = DATABASE()
    `)

    if (columns.length === 0) {
      console.log('Restoring ci_witholding_tax column to payment_items')
      await queryInterface.addColumn('payment_items', 'ci_witholding_tax', {
        type: Sequelize.DECIMAL(18, 2),
        allowNull: true,
      })
    } else {
      console.log('ci_witholding_tax column already exists in payment_items, skipping')
    }
  },
}
