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
        allowNull: true,
        references: {
          model: 'customers',
          key: 'c_id'
        }
      },
      s_document_reference: {
        type: Sequelize.STRING(120),
        allowNull: true
      },
      s_terms: {
        type: Sequelize.ENUM('DAYS', 'MONTHS', 'DURATION OF TIME'),
        allowNull: true
      },
      s_date_delivered: {
        type: Sequelize.STRING(300),
        allowNull: true
      },
      s_date_due: {
        type: Sequelize.STRING(300),
        allowNull: true
      },
      s_category: {
        type: Sequelize.STRING(120),
        allowNull: true
      },
      s_remarks: {
        type: Sequelize.TEXT('long'),
        allowNull: true
      },
      s_total_amount_due: {
        type: Sequelize.DECIMAL(18, 2),
        allowNull: true
      },
      s_status: {
        type: Sequelize.ENUM('COLLECTED', 'NOT COLLECTED', 'PARTIALLY COLLECTED'),
        allowNull: true
      },
      s_state: {
        type: Sequelize.ENUM('PREPARED BY', 'CHECKED BY', 'APPROVED BY', 'REJECTED BY'),
        allowNull: true
      },
      s_created_date: {
        type: Sequelize.STRING(30),
        allowNull: true
      },
      s_created_by: {
        type: Sequelize.STRING(300),
        allowNull: true
      }
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('sales');
  }
};
