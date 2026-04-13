'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('payment_attachments', {
      ca_id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true
      },
      ca_payment_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'payments',
          key: 'c_id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
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
    await queryInterface.dropTable('payment_attachments');
  }
};
