'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add c_collected_amount column to collections table
    const [columns] = await queryInterface.sequelize.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'collections' 
      AND COLUMN_NAME = 'c_collected_amount'
      AND TABLE_SCHEMA = DATABASE()
    `)

    if (columns.length === 0) {
      await queryInterface.addColumn('collections', 'c_collected_amount', {
        type: Sequelize.DECIMAL(18, 2),
        allowNull: false,
        defaultValue: 0.00,
        comment: 'Total amount collected in this payment',
      })
    } else {
      console.log('c_collected_amount column already exists in collections, skipping')
    }
  },

  async down(queryInterface, Sequelize) {
    // Remove c_collected_amount column
    await queryInterface.removeColumn('collections', 'c_collected_amount')
  },
}
