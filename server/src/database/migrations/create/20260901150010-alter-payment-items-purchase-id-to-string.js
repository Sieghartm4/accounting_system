'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Drop foreign key constraints on payment_items first
    try {
      await queryInterface.removeConstraint('payment_items', 'payment_items_ibfk_1')
    } catch (e) {
      console.log('Constraint payment_items_ibfk_1 not found or already removed')
    }
    try {
      await queryInterface.removeConstraint('payment_items', 'payment_items_ibfk_2')
    } catch (e) {
      console.log('Constraint payment_items_ibfk_2 not found or already removed')
    }

    // Clear existing data since the schema change makes it incompatible
    await queryInterface.bulkDelete('payment_items', {}, {})

    // Change ci_purchase_id from INTEGER to STRING to match purchase_items.pi_id
    await queryInterface.changeColumn('payment_items', 'ci_purchase_id', {
      type: Sequelize.STRING(300),
      allowNull: true,
    })

    // Re-add foreign key constraint with the new data type
    await queryInterface.addConstraint('payment_items', {
      fields: ['ci_purchase_id'],
      type: 'foreign key',
      name: 'payment_items_ibfk_2',
      references: {
        table: 'purchase_items',
        field: 'pi_id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    })
  },

  async down(queryInterface, Sequelize) {
    // Reverse the changes
    await queryInterface.removeConstraint('payment_items', 'payment_items_ibfk_2')

    await queryInterface.changeColumn('payment_items', 'ci_purchase_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
    })

    await queryInterface.addConstraint('payment_items', {
      fields: ['ci_purchase_id'],
      type: 'foreign key',
      name: 'payment_items_ibfk_2',
      references: {
        table: 'purchase_items',
        field: 'pi_id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    })
  },
}
