'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('sales_attachments', {
      sa_id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      sa_sales_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'sales',
          key: 's_id'
        }
      },
      sa_file: {
        type: Sequelize.TEXT('long'),
        allowNull: true
      },
      sa_name: {
        type: Sequelize.STRING(300),
        allowNull: true
      },
      sa_remarks: {
        type: Sequelize.TEXT('long'),
        allowNull: true
      },
      sa_uploaded_by: {
        type: Sequelize.STRING(300),
        allowNull: true
      },
      sa_uploaded_date: {
        type: Sequelize.STRING(30),
        allowNull: true
      }
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('sales_attachments');
  }
};
