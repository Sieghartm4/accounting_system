'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('purchase_items', {
      pi_id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      pi_purchase_id: {
        type: Sequelize.STRING(300),
        allowNull: false,
        references: {
          model: 'purchase',
          key: 'p_id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      pi_product_service: {
        type: Sequelize.STRING(300),
        allowNull: true,
      },
      pi_charts_of_accounts: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'charts_of_accounts',
          key: 'coa_id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      pi_description: {
        type: Sequelize.TEXT('long'),
        allowNull: true,
      },
      pi_quantity: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      pi_purchase_price: {
        type: Sequelize.NUMERIC,
        allowNull: true,
      },
      pi_discount: {
        type: Sequelize.DECIMAL(18, 2),
        allowNull: true,
      },
      pi_discount_type: {
        type: Sequelize.ENUM('PERCENT', 'FIXED'),
        allowNull: true,
      },
      pi_vat: {
        type: Sequelize.DECIMAL(18, 2),
        allowNull: true,
      },
      pi_witholding_tax: {
        type: Sequelize.DECIMAL(18, 2),
        allowNull: true,
      },
      pi_responsibility_center: {
        type: Sequelize.STRING(300),
        allowNull: true,
      },
    })
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('purchase_items')
  },
}
