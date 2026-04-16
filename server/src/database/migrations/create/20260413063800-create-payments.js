'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('payments', {
      c_id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true
      },
      c_vendor_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'vendors',
          key: 'v_id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      c_document_reference: {
        type: Sequelize.STRING(120),
        allowNull: true
      },
      c_mode_of_payment: {
        type: Sequelize.ENUM('CASH','CHECK','BANK_TRANSFER','CARD','E-WALLET','OTHERS'),
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
      c_payment_date: {
        type: Sequelize.STRING(300),
        allowNull: true
      },
      c_remarks: {
        type: Sequelize.TEXT('long'),
        allowNull: true
      },
      c_state: {
        type: Sequelize.ENUM('PREPARED','CHECKED','APPROVED','REJECTED'),
        allowNull: false,
        defaultValue: 'PREPARED'
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
    await queryInterface.dropTable('payments');
  }
};
