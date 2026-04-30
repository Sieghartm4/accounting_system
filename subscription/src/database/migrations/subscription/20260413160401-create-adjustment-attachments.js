'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('adjustment_attachments', {
      aa_id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      aa_adjustment_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'adjustments',
          key: 'a_id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      aa_file: {
        type: Sequelize.TEXT('long'),
        allowNull: true
      },
      aa_name: {
        type: Sequelize.STRING(300),
        allowNull: true
      },
      aa_remarks: {
        type: Sequelize.TEXT('long'),
        allowNull: true
      },
      aa_uploaded_by: {
        type: Sequelize.STRING(300),
        allowNull: true
      },
      aa_uploaded_date: {
        type: Sequelize.STRING(30),
        allowNull: true
      }
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('adjustment_attachments');
  }
};
