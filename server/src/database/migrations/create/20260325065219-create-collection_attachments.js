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
      ca_collection_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'collections',
          key: 'c_id'
        }
      },
      ca_file: {
        type: Sequelize.TEXT('long'),
        allowNull: false
      },
      ca_name: {
        type: Sequelize.TEXT('medium'),
        allowNull: true
      },
      ca_remarks: {
        type: Sequelize.TEXT('long'),
        allowNull: false
      },
      ca_uploaded_by: {
        type: Sequelize.STRING(300),
        allowNull: false
      },
      ca_uploaded_date: {
        type: Sequelize.STRING(30),
        allowNull: false
      }
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('collection_attachments');
  }
};
