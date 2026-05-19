'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('bank_reconciliation_items', {
      bri_id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      bri_br_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'bank_reconciliation',
          key: 'br_id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      bri_date: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      bri_description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      bri_reference_number: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      bri_details: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      bri_debit: {
        type: Sequelize.DECIMAL(18, 2),
        allowNull: false,
        defaultValue: 0.0,
      },
      bri_credit: {
        type: Sequelize.DECIMAL(18, 2),
        allowNull: false,
        defaultValue: 0.0,
      },
      bri_balance: {
        type: Sequelize.DECIMAL(18, 2),
        allowNull: false,
        defaultValue: 0.0,
      },
      bri_created_by: {
        type: Sequelize.STRING(300),
        allowNull: false,
      },
    })
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('bank_reconciliation_items')
  },
}
