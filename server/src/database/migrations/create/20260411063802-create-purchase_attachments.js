'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('purchase_attachments', {
      pa_id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      pa_purchase_id: {
        type: Sequelize.STRING(30),
        allowNull: false,
        references: {
          model: 'purchase',
          key: 'p_id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      pa_file: {
        type: Sequelize.TEXT('long'),
        allowNull: true,
      },
      pa_name: {
        type: Sequelize.STRING(300),
        allowNull: true,
      },
      pa_remarks: {
        type: Sequelize.TEXT('long'),
        allowNull: true,
      },
      pa_uploaded_by: {
        type: Sequelize.STRING(300),
        allowNull: true,
      },
      pa_uploaded_date: {
        type: Sequelize.STRING(30),
        allowNull: true,
      },
    })
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('purchase_attachments')
  },
}
