'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Step 1: Drop any existing foreign key constraint on ci_purchase_id
    // First, try to drop the expected constraint name
    try {
      await queryInterface.sequelize.query(`
        ALTER TABLE payment_items 
        DROP FOREIGN KEY payment_items_ci_purchase_id_foreign
      `)
    } catch (error) {
      // If that fails, the constraint might have a different name
      // Try to find and drop it dynamically
      console.log('Expected foreign key not found, checking for actual constraint name...')
      const [constraints] = await queryInterface.sequelize.query(`
        SELECT CONSTRAINT_NAME 
        FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
        WHERE TABLE_NAME = 'payment_items' 
        AND COLUMN_NAME = 'ci_purchase_id' 
        AND CONSTRAINT_SCHEMA = DATABASE()
        AND REFERENCED_TABLE_NAME IS NOT NULL
      `)
      
      if (constraints.length > 0) {
        const constraintName = constraints[0].CONSTRAINT_NAME
        console.log(`Found foreign key constraint: ${constraintName}`)
        await queryInterface.sequelize.query(`
          ALTER TABLE payment_items 
          DROP FOREIGN KEY ${constraintName}
        `)
      }
    }

    // Step 2: Modify ci_purchase_id to reference purchases table instead of purchase_items
    await queryInterface.sequelize.query(`
      ALTER TABLE payment_items 
      MODIFY COLUMN ci_purchase_id VARCHAR(300) NOT NULL
    `)

    // Step 3: Add the new foreign key constraint pointing to purchase table
    await queryInterface.sequelize.query(`
      ALTER TABLE payment_items 
      ADD CONSTRAINT payment_items_ci_purchase_id_foreign 
      FOREIGN KEY (ci_purchase_id) REFERENCES purchase(p_id)
    `)

    // Step 4: Check if ci_amount column exists, rename it to ci_amount_applied
    const [columns] = await queryInterface.sequelize.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'payment_items' 
      AND COLUMN_NAME = 'ci_amount'
      AND TABLE_SCHEMA = DATABASE()
    `)

    if (columns.length > 0) {
      console.log('Found ci_amount column, renaming to ci_amount_applied')
      await queryInterface.renameColumn('payment_items', 'ci_amount', 'ci_amount_applied')
    } else {
      console.log('ci_amount column not found, checking if ci_amount_applied already exists')
      const [existingColumns] = await queryInterface.sequelize.query(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_NAME = 'payment_items' 
        AND COLUMN_NAME = 'ci_amount_applied'
        AND TABLE_SCHEMA = DATABASE()
      `)
      
      if (existingColumns.length === 0) {
        console.log('ci_amount_applied not found either, adding the column')
        await queryInterface.addColumn('payment_items', 'ci_amount_applied', {
          type: Sequelize.DECIMAL(18, 2),
          allowNull: false,
          defaultValue: 0.00,
        })
      }
    }

    // Step 5: Change ci_amount_applied type to DECIMAL(18, 2) if it exists
    await queryInterface.sequelize.query(`
      ALTER TABLE payment_items 
      MODIFY COLUMN ci_amount_applied DECIMAL(18, 2) NOT NULL
    `)

    // Step 6: Add ci_created_at for audit trail
    const [timestampColumns] = await queryInterface.sequelize.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'payment_items' 
      AND COLUMN_NAME = 'ci_created_at'
      AND TABLE_SCHEMA = DATABASE()
    `)

    if (timestampColumns.length === 0) {
      await queryInterface.addColumn('payment_items', 'ci_created_at', {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      })
    }
  },

  async down(queryInterface, Sequelize) {
    // Step 1: Remove ci_created_at
    await queryInterface.removeColumn('payment_items', 'ci_created_at')

    // Step 2: Rename ci_amount_applied back to ci_amount if it exists
    const [columns] = await queryInterface.sequelize.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'payment_items' 
      AND COLUMN_NAME = 'ci_amount_applied'
      AND TABLE_SCHEMA = DATABASE()
    `)

    if (columns.length > 0) {
      await queryInterface.renameColumn('payment_items', 'ci_amount_applied', 'ci_amount')
      
      // Revert ci_amount type to NUMERIC
      await queryInterface.sequelize.query(`
        ALTER TABLE payment_items 
        MODIFY COLUMN ci_amount NUMERIC NOT NULL
      `)
    }

    // Step 3: Drop the new foreign key constraint
    try {
      await queryInterface.sequelize.query(`
        ALTER TABLE payment_items 
        DROP FOREIGN KEY payment_items_ci_purchase_id_foreign
      `)
    } catch (error) {
      // If that fails, try to find and drop it dynamically
      const [constraints] = await queryInterface.sequelize.query(`
        SELECT CONSTRAINT_NAME 
        FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
        WHERE TABLE_NAME = 'payment_items' 
        AND COLUMN_NAME = 'ci_purchase_id' 
        AND CONSTRAINT_SCHEMA = DATABASE()
        AND REFERENCED_TABLE_NAME IS NOT NULL
      `)
      
      if (constraints.length > 0) {
        const constraintName = constraints[0].CONSTRAINT_NAME
        await queryInterface.sequelize.query(`
          ALTER TABLE payment_items 
          DROP FOREIGN KEY ${constraintName}
        `)
      }
    }

    // Step 4: Revert ci_purchase_id to reference purchase_items table
    await queryInterface.sequelize.query(`
      ALTER TABLE payment_items 
      MODIFY COLUMN ci_purchase_id VARCHAR(300) NOT NULL
    `)

    // Step 5: Add the original foreign key constraint pointing to purchase_items table
    await queryInterface.sequelize.query(`
      ALTER TABLE payment_items 
      ADD CONSTRAINT payment_items_ci_purchase_id_foreign 
      FOREIGN KEY (ci_purchase_id) REFERENCES purchase_items(pi_id)
    `)
  },
}
