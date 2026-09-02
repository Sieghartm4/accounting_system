'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Drop foreign key constraints that reference purchase_items.pi_id
    try {
      await queryInterface.removeConstraint('purchase_items', 'purchase_items_ibfk_1')
    } catch (e) {
      console.log('Constraint purchase_items_ibfk_1 not found or already removed')
    }
    try {
      await queryInterface.removeConstraint('purchase_items', 'purchase_items_ibfk_2')
    } catch (e) {
      console.log('Constraint purchase_items_ibfk_2 not found or already removed')
    }

    // Drop foreign key constraints from payment_items that reference purchase_items
    try {
      await queryInterface.removeConstraint('payment_items', 'payment_items_ibfk_2')
    } catch (e) {
      console.log('Constraint payment_items_ibfk_2 not found or already removed')
    }

    // Clear existing data since the schema change makes it incompatible
    await queryInterface.bulkDelete('purchase_items', {}, {})
    await queryInterface.bulkDelete('payment_items', {}, {})

    // Change pi_id from INTEGER to STRING(300) and remove autoIncrement
    await queryInterface.changeColumn('purchase_items', 'pi_id', {
      type: Sequelize.STRING(300),
      allowNull: false,
    })

    // Re-add foreign key constraint for pi_purchase_id
    await queryInterface.addConstraint('purchase_items', {
      fields: ['pi_purchase_id'],
      type: 'foreign key',
      name: 'purchase_items_ibfk_1',
      references: {
        table: 'purchase',
        field: 'p_id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    })

    // Re-add foreign key constraint for pi_charts_of_accounts
    await queryInterface.addConstraint('purchase_items', {
      fields: ['pi_charts_of_accounts'],
      type: 'foreign key',
      name: 'purchase_items_ibfk_2',
      references: {
        table: 'charts_of_accounts',
        field: 'coa_id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    })
  },

  async down(queryInterface, Sequelize) {
    // Reverse the changes
    await queryInterface.removeConstraint('purchase_items', 'purchase_items_ibfk_1')
    await queryInterface.removeConstraint('purchase_items', 'purchase_items_ibfk_2')
    await queryInterface.removeConstraint('payment_items', 'payment_items_ibfk_2')

    await queryInterface.changeColumn('purchase_items', 'pi_id', {
      type: Sequelize.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    })

    await queryInterface.addConstraint('purchase_items', {
      fields: ['pi_purchase_id'],
      type: 'foreign key',
      name: 'purchase_items_ibfk_1',
      references: {
        table: 'purchase',
        field: 'p_id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    })

    await queryInterface.addConstraint('purchase_items', {
      fields: ['pi_charts_of_accounts'],
      type: 'foreign key',
      name: 'purchase_items_ibfk_2',
      references: {
        table: 'charts_of_accounts',
        field: 'coa_id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    })
  },
}
