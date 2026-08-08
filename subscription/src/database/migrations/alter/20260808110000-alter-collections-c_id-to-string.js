'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Drop foreign key constraints (ignore if they don't exist)
    try {
      await queryInterface.removeConstraint('collection_items', 'collection_items_ibfk_1');
    } catch (e) {
      // Constraint might not exist or have a different name
    }
    try {
      await queryInterface.removeConstraint('collection_attachments', 'collection_attachments_ibfk_1');
    } catch (e) {
      // Constraint might not exist or have a different name
    }
    
    // Change collections.c_id to STRING
    await queryInterface.changeColumn('collections', 'c_id', {
      type: Sequelize.STRING(300),
      allowNull: false
    });
    
    // Change collection_items.ci_collection_id to STRING
    await queryInterface.changeColumn('collection_items', 'ci_collection_id', {
      type: Sequelize.STRING(300),
      allowNull: false
    });
    
    // Change collection_attachments.ca_collection_id to STRING
    await queryInterface.changeColumn('collection_attachments', 'ca_collection_id', {
      type: Sequelize.STRING(300),
      allowNull: false
    });
    
    // Re-add foreign key constraints
    await queryInterface.addConstraint('collection_items', {
      fields: ['ci_collection_id'],
      type: 'foreign key',
      name: 'collection_items_ibfk_1',
      references: {
        table: 'collections',
        field: 'c_id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    });
    
    await queryInterface.addConstraint('collection_attachments', {
      fields: ['ca_collection_id'],
      type: 'foreign key',
      name: 'collection_attachments_ibfk_1',
      references: {
        table: 'collections',
        field: 'c_id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    });
  },

  async down(queryInterface, Sequelize) {
    // Drop foreign key constraints (ignore if they don't exist)
    try {
      await queryInterface.removeConstraint('collection_items', 'collection_items_ibfk_1');
    } catch (e) {
      // Constraint might not exist
    }
    try {
      await queryInterface.removeConstraint('collection_attachments', 'collection_attachments_ibfk_1');
    } catch (e) {
      // Constraint might not exist
    }
    
    // Change collection_items.ci_collection_id back to INTEGER
    await queryInterface.changeColumn('collection_items', 'ci_collection_id', {
      type: Sequelize.INTEGER,
      allowNull: false
    });
    
    // Change collection_attachments.ca_collection_id back to INTEGER
    await queryInterface.changeColumn('collection_attachments', 'ca_collection_id', {
      type: Sequelize.INTEGER,
      allowNull: false
    });
    
    // Change collections.c_id back to INTEGER
    await queryInterface.changeColumn('collections', 'c_id', {
      type: Sequelize.INTEGER,
      allowNull: false
    });
    
    // Re-add foreign key constraints
    await queryInterface.addConstraint('collection_items', {
      fields: ['ci_collection_id'],
      type: 'foreign key',
      name: 'collection_items_ibfk_1',
      references: {
        table: 'collections',
        field: 'c_id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    });
    
    await queryInterface.addConstraint('collection_attachments', {
      fields: ['ca_collection_id'],
      type: 'foreign key',
      name: 'collection_attachments_ibfk_1',
      references: {
        table: 'collections',
        field: 'c_id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    });
  }
};
