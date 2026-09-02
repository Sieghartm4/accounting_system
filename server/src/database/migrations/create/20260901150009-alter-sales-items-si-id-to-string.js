'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Drop foreign key constraints that reference sales_items.si_id
    try {
      await queryInterface.removeConstraint('sales_items', 'sales_items_ibfk_1')
    } catch (e) {
      console.log('Constraint sales_items_ibfk_1 not found or already removed')
    }
    try {
      await queryInterface.removeConstraint('sales_items', 'sales_items_ibfk_2')
    } catch (e) {
      console.log('Constraint sales_items_ibfk_2 not found or already removed')
    }

    // Drop foreign key constraints from collection_items that reference sales_items
    try {
      await queryInterface.removeConstraint('collection_items', 'collection_items_ibfk_2')
    } catch (e) {
      console.log('Constraint collection_items_ibfk_2 not found or already removed')
    }

    // Clear existing data since the schema change makes it incompatible
    await queryInterface.bulkDelete('sales_items', {}, {})
    await queryInterface.bulkDelete('collection_items', {}, {})

    // Change si_id from INTEGER to STRING(300) and remove autoIncrement
    await queryInterface.changeColumn('sales_items', 'si_id', {
      type: Sequelize.STRING(300),
      allowNull: false,
    })

    // Re-add foreign key constraint for si_sales_id
    await queryInterface.addConstraint('sales_items', {
      fields: ['si_sales_id'],
      type: 'foreign key',
      name: 'sales_items_ibfk_1',
      references: {
        table: 'sales',
        field: 's_id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    })

    // Re-add foreign key constraint for si_charts_of_accounts
    await queryInterface.addConstraint('sales_items', {
      fields: ['si_charts_of_accounts'],
      type: 'foreign key',
      name: 'sales_items_ibfk_2',
      references: {
        table: 'charts_of_accounts',
        field: 'coa_id',
      },
    })
  },

  async down(queryInterface, Sequelize) {
    // Reverse the changes
    await queryInterface.removeConstraint('sales_items', 'sales_items_ibfk_1')
    await queryInterface.removeConstraint('sales_items', 'sales_items_ibfk_2')
    await queryInterface.removeConstraint('collection_items', 'collection_items_ibfk_2')

    await queryInterface.changeColumn('sales_items', 'si_id', {
      type: Sequelize.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    })

    await queryInterface.addConstraint('sales_items', {
      fields: ['si_sales_id'],
      type: 'foreign key',
      name: 'sales_items_ibfk_1',
      references: {
        table: 'sales',
        field: 's_id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    })

    await queryInterface.addConstraint('sales_items', {
      fields: ['si_charts_of_accounts'],
      type: 'foreign key',
      name: 'sales_items_ibfk_2',
      references: {
        table: 'charts_of_accounts',
        field: 'coa_id',
      },
    })
  },
}
