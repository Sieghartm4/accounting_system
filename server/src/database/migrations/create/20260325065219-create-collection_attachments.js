'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('collection_attachments', {
      ca_id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      ca_sales_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'receipts',
          key: 'r_id'
        }
      },
      ca_file: {
        type: Sequelize.TEXT('long'),
        allowNull: true
      },
      ca_name: {
        type: Sequelize.STRING(300),
        allowNull: true
      },
      ca_remarks: {
        type: Sequelize.TEXT('long'),
        allowNull: true
      },
      ca_uploaded_by: {
        type: Sequelize.STRING(300),
        allowNull: true
      },
      ca_uploaded_date: {
        type: Sequelize.STRING(30),
        allowNull: true
      }
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('collection_attachments');
  }
};
