'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('receipt_attachments', {
      ra_id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      ra_receipt_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'receipts',
          key: 'r_id'
        }
      },
      ra_file: {
        type: Sequelize.TEXT('long'),
        allowNull: false
      },
      ra_name: {
        type: Sequelize.TEXT('medium'),
        allowNull: false
      },
      ra_remarks: {
        type: Sequelize.TEXT('long'),
        allowNull: true
      },
      ra_uploaded_by: {
        type: Sequelize.STRING(300),
        allowNull: false
      },
      ra_uploaded_date: {
        type: Sequelize.STRING(30),
        allowNull: false
      }
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('receipt_attachments');
  }
};
