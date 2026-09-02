'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Drop foreign key constraints on collection_items first
    try {
      await queryInterface.removeConstraint('collection_items', 'collection_items_ibfk_1')
    } catch (e) {
      console.log('Constraint collection_items_ibfk_1 not found or already removed')
    }
    try {
      await queryInterface.removeConstraint('collection_items', 'collection_items_ibfk_2')
    } catch (e) {
      console.log('Constraint collection_items_ibfk_2 not found or already removed')
    }

    // Clear existing data since the schema change makes it incompatible
    await queryInterface.bulkDelete('collection_items', {}, {})

    // Change ci_sales_id from INTEGER to STRING to match sales_items.si_id
    await queryInterface.changeColumn('collection_items', 'ci_sales_id', {
      type: Sequelize.STRING(300),
      allowNull: false,
    })

    // Re-add foreign key constraint with the new data type
    await queryInterface.addConstraint('collection_items', {
      fields: ['ci_sales_id'],
      type: 'foreign key',
      name: 'collection_items_ibfk_2',
      references: {
        table: 'sales_items',
        field: 'si_id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    })
  },

  async down(queryInterface, Sequelize) {
    // Reverse the changes
    await queryInterface.removeConstraint('collection_items', 'collection_items_ibfk_2')

    await queryInterface.changeColumn('collection_items', 'ci_sales_id', {
      type: Sequelize.INTEGER,
      allowNull: false,
    })

    await queryInterface.addConstraint('collection_items', {
      fields: ['ci_sales_id'],
      type: 'foreign key',
      name: 'collection_items_ibfk_2',
      references: {
        table: 'sales_items',
        field: 'si_id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    })
  },
}
