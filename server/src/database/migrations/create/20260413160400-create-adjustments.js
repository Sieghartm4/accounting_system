'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('adjustments', {
      a_id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      a_document_reference: {
        type: Sequelize.STRING(120),
        allowNull: true
      },
      a_posting_date: {
        type: Sequelize.STRING(300),
        allowNull: true
      },
      a_remarks: {
        type: Sequelize.TEXT('long'),
        allowNull: true
      },
      a_status: {
        type: Sequelize.ENUM('PREPARED', 'CHECKED', 'APPROVED', 'REJECTED'),
        allowNull: true
      },
      a_total_amount: {
        type: Sequelize.DECIMAL(18, 2),
        allowNull: true
      },
      a_created_date: {
        type: Sequelize.STRING(30),
        allowNull: true
      },
      a_created_by: {
        type: Sequelize.STRING(300),
        allowNull: true
      }
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('adjustments');
  }
};
