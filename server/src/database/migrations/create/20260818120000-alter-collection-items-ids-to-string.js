'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Drop all foreign key constraints on collection_items first
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

    // Change ci_collection_id from INTEGER to STRING to match collections.c_id
    await queryInterface.changeColumn('collection_items', 'ci_collection_id', {
      type: Sequelize.STRING(300),
      allowNull: false,
    })

    // Change ci_sales_id from INTEGER to STRING to match sales.s_id
    await queryInterface.changeColumn('collection_items', 'ci_sales_id', {
      type: Sequelize.STRING(300),
      allowNull: false,
    })

    // Re-add foreign key for ci_collection_id referencing collections.c_id
    await queryInterface.addConstraint('collection_items', {
      fields: ['ci_collection_id'],
      type: 'foreign key',
      name: 'collection_items_ibfk_1',
      references: {
        table: 'collections',
        field: 'c_id',
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    })

    // Re-add foreign key for ci_sales_id referencing sales.s_id (not sales_items.si_id)
    await queryInterface.addConstraint('collection_items', {
      fields: ['ci_sales_id'],
      type: 'foreign key',
      name: 'collection_items_ibfk_2',
      references: {
        table: 'sales',
        field: 's_id',
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    })
  },

  async down(queryInterface, Sequelize) {
    // Drop foreign key constraints
    try {
      await queryInterface.removeConstraint('collection_items', 'collection_items_ibfk_1')
    } catch (e) {
      console.log('Constraint collection_items_ibfk_1 not found')
    }
    try {
      await queryInterface.removeConstraint('collection_items', 'collection_items_ibfk_2')
    } catch (e) {
      console.log('Constraint collection_items_ibfk_2 not found')
    }

    // Clear data before reverting
    await queryInterface.bulkDelete('collection_items', {}, {})

    // Revert ci_collection_id back to INTEGER
    await queryInterface.changeColumn('collection_items', 'ci_collection_id', {
      type: Sequelize.INTEGER,
      allowNull: false,
    })

    // Revert ci_sales_id back to INTEGER
    await queryInterface.changeColumn('collection_items', 'ci_sales_id', {
      type: Sequelize.INTEGER,
      allowNull: false,
    })

    // Re-add foreign key for ci_collection_id
    await queryInterface.addConstraint('collection_items', {
      fields: ['ci_collection_id'],
      type: 'foreign key',
      name: 'collection_items_ibfk_1',
      references: {
        table: 'collections',
        field: 'c_id',
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    })

    // Re-add foreign key for ci_sales_id referencing sales_items.si_id
    await queryInterface.addConstraint('collection_items', {
      fields: ['ci_sales_id'],
      type: 'foreign key',
      name: 'collection_items_ibfk_2',
      references: {
        table: 'sales_items',
        field: 'si_id',
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    })
  }
}
