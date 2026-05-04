'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('purchase', {
      p_id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true
      },
      p_vendor_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'vendors',
          key: 'v_id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      p_document_reference: {
        type: Sequelize.STRING(120),
        allowNull: true
      },
      p_terms: {
        type: Sequelize.TEXT('long'),
        allowNull: true
      },
      p_date_delivered: {
        type: Sequelize.STRING(300),
        allowNull: true
      },
      p_date_due: {
        type: Sequelize.STRING(300),
        allowNull: true
      },
      p_remarks: {
        type: Sequelize.TEXT('long'),
        allowNull: true
      },
      p_total_amount_due: {
        type: Sequelize.DECIMAL(18, 2),
        allowNull: true
      },
      p_status: {
        type: Sequelize.ENUM('PAID','UNPAID','REJECTED'),
        allowNull: false,
        defaultValue: 'UNPAID'
      },
      p_state: {
        type: Sequelize.ENUM('PREPARED', 'CHECKED', 'APPROVED', 'REJECTED'),
        allowNull: false,
        defaultValue: 'PREPARED'
      },
      p_created_date: {
        type: Sequelize.STRING(30),
        allowNull: false
      },
      p_created_by: {
        type: Sequelize.STRING(300),
        allowNull: false
      },
      p_checked_by: {
        type: Sequelize.STRING(300),
        allowNull: true
      },
      p_approved_by: {
        type: Sequelize.STRING(300),
        allowNull: true
      }
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('purchase');
  }
};
