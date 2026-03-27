'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('collections', {
      c_id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      c_customer_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'customers',
          key: 'c_id'
        }
      },
      c_document_reference: {
        type: Sequelize.STRING(120),
        allowNull: true
      },
      c_mode_of_payment: {
        type: Sequelize.ENUM('CASH', 'CHECK', 'BANK_TRANSFER', 'CARD', 'E-WALLET', 'OTHERS'),
        allowNull: true
      },
      c_bank_name: {
        type: Sequelize.STRING(300),
        allowNull: true
      },
      c_check_number: {
        type: Sequelize.TEXT('long'),
        allowNull: true
      },
      c_collection_date: {
        type: Sequelize.STRING(300),
        allowNull: true
      },
      c_remarks: {
        type: Sequelize.TEXT('long'),
        allowNull: true
      },
      c_status: {
        type: Sequelize.ENUM('COLLECTED', 'NOT COLLECTED', 'PARTIALLY COLLECTED'),
        allowNull: true
      },
      c_state: {
        type: Sequelize.ENUM('PREPARED BY', 'CHECKED BY', 'APPROVED BY', 'REJECTED BY'),
        allowNull: true
      },
      c_created_date: {
        type: Sequelize.STRING(30),
        allowNull: true
      },
      c_created_by: {
        type: Sequelize.STRING(300),
        allowNull: true
      }
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('collections');
  }
};
