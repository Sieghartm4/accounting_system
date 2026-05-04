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
        allowNull: false,
        references: {
          model: 'vendors',
          key: 'v_id'
        }
      },
      cd_document_reference: {
        type: Sequelize.STRING(120),
        allowNull: false
      },
      cd_payment_date: {
        type: Sequelize.STRING(20),
        allowNull: false
      },
      cd_mode_of_payment: {
        type: Sequelize.STRING(300),
        allowNull: false
      },
      cd_bank_name: {
        type: Sequelize.STRING(300),
        allowNull: true
      },
      cd_check_number: {
        type: Sequelize.STRING(120),
        allowNull: true
      },
      cd_remarks: {
        type: Sequelize.TEXT('long'),
        allowNull: true
      },
      cd_total_amount_due: {
        type: Sequelize.DECIMAL(18, 2),
        allowNull: false
      },
      cd_state: {
        type: Sequelize.ENUM('PREPARED','CHECKED','APPROVED','REJECTED','CANCELLED'),
        allowNull: false
      },
      cd_created_date: {
        type: Sequelize.STRING(30),
        allowNull: false
      },
      cd_created_by: {
        type: Sequelize.STRING(300),
        allowNull: false
      },
      cd_checked_by: {
        type: Sequelize.STRING(300),
        allowNull: true
      },
      cd_approved_by: {
        type: Sequelize.STRING(300),
        allowNull: true
      }
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('cash_disbursements');
  }
};
