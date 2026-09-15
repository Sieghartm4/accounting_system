'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Check if ci_witholding_tax column exists before dropping
    const [columns] = await queryInterface.sequelize.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'collection_items' 
      AND COLUMN_NAME = 'ci_witholding_tax'
      AND TABLE_SCHEMA = DATABASE()
    `)

    if (columns.length > 0) {
      console.log('Found ci_witholding_tax column, dropping it')
      await queryInterface.removeColumn('collection_items', 'ci_witholding_tax')
    } else {
      console.log('ci_witholding_tax column not found, skipping')
    }
  },

  async down(queryInterface, Sequelize) {
    // Re-add the column for rollback
    await queryInterface.addColumn('collection_items', 'ci_witholding_tax', {
      type: Sequelize.DECIMAL(18, 2),
      allowNull: false,
      defaultValue: 0.00,
    })
  },
}
