'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('bank_reconciliation_items', {
      bri_id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true
      },
      bri_br_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'bank_reconciliation',
          key: 'br_id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      bri_type: {
        type: Sequelize.STRING(50),
        allowNull: false
      },
      bri_reference: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      bri_description: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      bri_date: {
        type: Sequelize.DATE,
        allowNull: false
      },
      bri_amount: {
        type: Sequelize.DECIMAL(18, 2),
        allowNull: false,
        defaultValue: 0.00
      },
      bri_status: {
        type: Sequelize.STRING(50),
        allowNull: false,
        defaultValue: 'PENDING'
      },
      bri_created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      bri_updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('bank_reconciliation_items');
  }
};
