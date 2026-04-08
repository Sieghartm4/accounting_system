'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('sales', {
      s_id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      s_customer_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'customers',
          key: 'c_id'
        }
      },
      s_document_reference: {
        type: Sequelize.STRING(120),
        allowNull: false
      },
      s_terms: {
        type: Sequelize.STRING(120),
        allowNull: false
      },
      s_date_delivered: {
        type: Sequelize.STRING(300),
        allowNull: false
      },
      s_date_due: {
        type: Sequelize.STRING(300),
        allowNull: false
      },
      s_category: {
        type: Sequelize.STRING(120),
        allowNull: false
      },
      s_remarks: {
        type: Sequelize.TEXT('long'),
        allowNull: false
      },
      s_total_amount_due: {
        type: Sequelize.DECIMAL(18, 2),
        allowNull: false
      },
      s_status: {
        type: Sequelize.ENUM('PAID','UNPAID','REJECTED'),
        allowNull: false
      },
      s_state: {
        type: Sequelize.ENUM('PREPARED','CHECKED','APPROVED','REJECTED','CANCELLED'),
        allowNull: false
      },
      s_created_date: {
        type: Sequelize.STRING(30),
        allowNull: false
      },
      s_created_by: {
        type: Sequelize.STRING(300),
        allowNull: false
      }
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('sales');
  }
};
