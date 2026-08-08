'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Drop foreign key constraints (ignore if they don't exist)
    try {
      await queryInterface.removeConstraint('payment_items', 'payment_items_ibfk_1');
    } catch (e) {
      // Constraint might not exist or have a different name
    }
    try {
      await queryInterface.removeConstraint('payment_attachments', 'payment_attachments_ibfk_1');
    } catch (e) {
      // Constraint might not exist or have a different name
    }
    
    // Change payments.c_id to STRING
    await queryInterface.changeColumn('payments', 'c_id', {
      type: Sequelize.STRING(300),
      allowNull: false
    });
    
    // Change payment_items.ci_payment_id to STRING
    await queryInterface.changeColumn('payment_items', 'ci_payment_id', {
      type: Sequelize.STRING(300),
      allowNull: false
    });
    
    // Change payment_attachments.ca_payment_id to STRING
    await queryInterface.changeColumn('payment_attachments', 'ca_payment_id', {
      type: Sequelize.STRING(300),
      allowNull: false
    });
    
    // Re-add foreign key constraints
    await queryInterface.addConstraint('payment_items', {
      fields: ['ci_payment_id'],
      type: 'foreign key',
      name: 'payment_items_ibfk_1',
      references: {
        table: 'payments',
        field: 'c_id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    });
    
    await queryInterface.addConstraint('payment_attachments', {
      fields: ['ca_payment_id'],
      type: 'foreign key',
      name: 'payment_attachments_ibfk_1',
      references: {
        table: 'payments',
        field: 'c_id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    });
  },

  async down(queryInterface, Sequelize) {
    // Drop foreign key constraints (ignore if they don't exist)
    try {
      await queryInterface.removeConstraint('payment_items', 'payment_items_ibfk_1');
    } catch (e) {
      // Constraint might not exist
    }
    try {
      await queryInterface.removeConstraint('payment_attachments', 'payment_attachments_ibfk_1');
    } catch (e) {
      // Constraint might not exist
    }
    
    // Change payment_items.ci_payment_id back to INTEGER
    await queryInterface.changeColumn('payment_items', 'ci_payment_id', {
      type: Sequelize.INTEGER,
      allowNull: false
    });
    
    // Change payment_attachments.ca_payment_id back to INTEGER
    await queryInterface.changeColumn('payment_attachments', 'ca_payment_id', {
      type: Sequelize.INTEGER,
      allowNull: false
    });
    
    // Change payments.c_id back to INTEGER
    await queryInterface.changeColumn('payments', 'c_id', {
      type: Sequelize.INTEGER,
      allowNull: false
    });
    
    // Re-add foreign key constraints
    await queryInterface.addConstraint('payment_items', {
      fields: ['ci_payment_id'],
      type: 'foreign key',
      name: 'payment_items_ibfk_1',
      references: {
        table: 'payments',
        field: 'c_id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    });
    
    await queryInterface.addConstraint('payment_attachments', {
      fields: ['ca_payment_id'],
      type: 'foreign key',
      name: 'payment_attachments_ibfk_1',
      references: {
        table: 'payments',
        field: 'c_id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    });
  }
};
