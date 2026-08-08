'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Drop foreign key constraints (ignore if they don't exist)
    try {
      await queryInterface.removeConstraint('adjustment_attachments', 'adjustment_attachments_ibfk_1');
    } catch (e) {
      // Constraint might not exist or have a different name
    }
    
    // Change adjustments.a_id to STRING
    await queryInterface.changeColumn('adjustments', 'a_id', {
      type: Sequelize.STRING(300),
      allowNull: false
    });
    
    // Change adjustment_attachments.aa_adjustment_id to STRING
    await queryInterface.changeColumn('adjustment_attachments', 'aa_adjustment_id', {
      type: Sequelize.STRING(300),
      allowNull: false
    });
    
    // Re-add foreign key constraint
    await queryInterface.addConstraint('adjustment_attachments', {
      fields: ['aa_adjustment_id'],
      type: 'foreign key',
      name: 'adjustment_attachments_ibfk_1',
      references: {
        table: 'adjustments',
        field: 'a_id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    });
  },

  async down(queryInterface, Sequelize) {
    // Drop foreign key constraints (ignore if they don't exist)
    try {
      await queryInterface.removeConstraint('adjustment_attachments', 'adjustment_attachments_ibfk_1');
    } catch (e) {
      // Constraint might not exist
    }
    
    // Change adjustment_attachments.aa_adjustment_id back to INTEGER
    await queryInterface.changeColumn('adjustment_attachments', 'aa_adjustment_id', {
      type: Sequelize.INTEGER,
      allowNull: false
    });
    
    // Change adjustments.a_id back to INTEGER
    await queryInterface.changeColumn('adjustments', 'a_id', {
      type: Sequelize.INTEGER,
      allowNull: false
    });
    
    // Re-add foreign key constraint
    await queryInterface.addConstraint('adjustment_attachments', {
      fields: ['aa_adjustment_id'],
      type: 'foreign key',
      name: 'adjustment_attachments_ibfk_1',
      references: {
        table: 'adjustments',
        field: 'a_id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    });
  }
};
