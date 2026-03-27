'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('cash_disbursements', {
      cd_id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      cd_vendor_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'vendors',
          key: 'v_id'
        }
      },
      cd_document_reference: {
        type: Sequelize.STRING(120),
        allowNull: true
      },
      cd_payment_date: {
        type: Sequelize.STRING(20),
        allowNull: true
      },
      cd_mode_of_payment: {
        type: Sequelize.STRING(300),
        allowNull: true
      },
      cd_bank_name: {
        type: Sequelize.STRING(300),
        allowNull: true
      },
      cd_check_number: {
        type: Sequelize.STRING(120),
        allowNull: true
      },
      cd_category: {
        type: Sequelize.STRING(120),
        allowNull: true
      },
      cd_remarks: {
        type: Sequelize.TEXT('long'),
        allowNull: true
      },
      cd_total_amount_due: {
        type: Sequelize.DECIMAL(18, 2),
        allowNull: true
      },
      cd_status: {
        type: Sequelize.ENUM('PAID', 'UNPAID', 'PARTIALLY PAID'),
        allowNull: true
      },
      cd_state: {
        type: Sequelize.ENUM('PREPARED','CHECKED','APPROVED','REJECTED','CANCELLED'),
        allowNull: true
      },
      cd_created_date: {
        type: Sequelize.STRING(30),
        allowNull: true
      },
      cd_created_by: {
        type: Sequelize.STRING(300),
        allowNull: true
      }
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('cash_disbursements');
  }
};
