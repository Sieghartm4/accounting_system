'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('cash_disbursement_attachments', {
      a_id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      a_cash_disburssement_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'cash_disbursements',
          key: 'cd_id'
        }
      },
      a_file: {
        type: Sequelize.TEXT('long'),
        allowNull: true
      },
      a_name: {
        type: Sequelize.STRING(300),
        allowNull: true
      },
      a_remarks: {
        type: Sequelize.TEXT('long'),
        allowNull: true
      },
      a_uploaded_by: {
        type: Sequelize.STRING(300),
        allowNull: true
      },
      a_uploaded_date: {
        type: Sequelize.STRING(30),
        allowNull: true
      }
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('cash_disbursement_attachments');
  }
};
