'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('receipts', {
      r_id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      r_customer_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'customers',
          key: 'c_id'
        }
      },
      r_document_reference: {
        type: Sequelize.STRING(120),
        allowNull: true
      },
      r_collection_date: {
        type: Sequelize.STRING(20),
        allowNull: false
      },
      r_mode_of_payment: {
        type: Sequelize.STRING(300),
        allowNull: false
      },
      r_bank_name: {
        type: Sequelize.STRING(300),
        allowNull: true
      },
      r_check_number: {
        type: Sequelize.STRING(120),
        allowNull: true
      },
      r_remarks: {
        type: Sequelize.TEXT('long'),
        allowNull: true
      },
      r_total_amount_due: {
        type: Sequelize.DECIMAL(18, 2),
        allowNull: false
      },
      r_status: {
        type: Sequelize.ENUM('COLLECTED', 'NOT COLLECTED', 'PARTIALLY COLLECTED'),
        allowNull: false
      },
      r_state: {
        type: Sequelize.ENUM('PREPARED','CHECKED','APPROVED','REJECTED','CANCELLED'),
        allowNull: false
      },
      r_created_date: {
        type: Sequelize.STRING(30),
        allowNull: false
      },
      r_created_by: {
        type: Sequelize.STRING(300),
        allowNull: false
      }
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('receipts');
  }
};
