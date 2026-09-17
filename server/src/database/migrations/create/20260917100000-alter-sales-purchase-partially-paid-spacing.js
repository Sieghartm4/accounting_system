'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Step 1: Update existing records in sales table from 'PARTIALLY_PAID' to 'PARTIALLY PAID'
    await queryInterface.sequelize.query(`
      UPDATE sales 
      SET s_status = 'PARTIALLY PAID' 
      WHERE s_status = 'PARTIALLY_PAID'
    `)

    // Step 2: Modify s_status enum in sales table to change 'PARTIALLY_PAID' to 'PARTIALLY PAID'
    await queryInterface.sequelize.query(`
      ALTER TABLE sales 
      MODIFY COLUMN s_status ENUM('UNPAID', 'PARTIALLY PAID', 'PAID', 'OVERPAID', 'REJECTED') 
      NOT NULL DEFAULT 'UNPAID'
    `)

    // Step 3: Update existing records in purchase table from 'PARTIALLY_PAID' to 'PARTIALLY PAID'
    // First, check if there are any records with PARTIALLY_PAID
    const [purchaseResults] = await queryInterface.sequelize.query(`
      SELECT COUNT(*) as count FROM purchase WHERE p_status = 'PARTIALLY_PAID'
    `)
    console.log('Purchase records with PARTIALLY_PAID:', purchaseResults[0].count)

    // Use a more robust update approach - temporarily allow NULL to avoid truncation errors
    await queryInterface.sequelize.query(`
      ALTER TABLE purchase 
      MODIFY COLUMN p_status ENUM('UNPAID', 'PARTIALLY_PAID', 'PARTIALLY PAID', 'PAID', 'OVERPAID', 'REJECTED') 
      NULL
    `)

    // Now update all records
    await queryInterface.sequelize.query(`
      UPDATE purchase 
      SET p_status = 'PARTIALLY PAID' 
      WHERE p_status = 'PARTIALLY_PAID'
    `)

    // Verify the update
    const [verifyResults] = await queryInterface.sequelize.query(`
      SELECT COUNT(*) as count FROM purchase WHERE p_status = 'PARTIALLY PAID'
    `)
    console.log('Purchase records with PARTIALLY PAID after update:', verifyResults[0].count)

    // Check if any old values remain
    const [remainingResults] = await queryInterface.sequelize.query(`
      SELECT COUNT(*) as count FROM purchase WHERE p_status = 'PARTIALLY_PAID'
    `)
    console.log('Purchase records still with PARTIALLY_PAID:', remainingResults[0].count)

    // Step 4: Modify p_status enum in purchase table to final version without PARTIALLY_PAID
    await queryInterface.sequelize.query(`
      ALTER TABLE purchase 
      MODIFY COLUMN p_status ENUM('UNPAID', 'PARTIALLY PAID', 'PAID', 'OVERPAID', 'REJECTED') 
      NOT NULL DEFAULT 'UNPAID'
    `)
  },

  async down(queryInterface, Sequelize) {
    // Step 1: Revert existing records in sales table from 'PARTIALLY PAID' to 'PARTIALLY_PAID'
    await queryInterface.sequelize.query(`
      UPDATE sales 
      SET s_status = 'PARTIALLY_PAID' 
      WHERE s_status = 'PARTIALLY PAID'
    `)

    // Step 2: Revert s_status enum in sales table to original values
    await queryInterface.sequelize.query(`
      ALTER TABLE sales 
      MODIFY COLUMN s_status ENUM('UNPAID', 'PARTIALLY_PAID', 'PAID', 'OVERPAID', 'REJECTED') 
      NOT NULL DEFAULT 'UNPAID'
    `)

    // Step 3: Revert existing records in purchase table from 'PARTIALLY PAID' to 'PARTIALLY_PAID'
    await queryInterface.sequelize.query(`
      UPDATE purchase 
      SET p_status = 'PARTIALLY_PAID' 
      WHERE p_status = 'PARTIALLY PAID'
    `)

    // Step 4: Revert p_status enum in purchase table to original values
    await queryInterface.sequelize.query(`
      ALTER TABLE purchase 
      MODIFY COLUMN p_status ENUM('UNPAID', 'PARTIALLY_PAID', 'PAID', 'OVERPAID', 'REJECTED') 
      NOT NULL DEFAULT 'UNPAID'
    `)
  },
}
