'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('receipt_items', {
      ri_id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      ri_receipts_id: {
        type: Sequelize.STRING(50),
        allowNull: false,
        references: {
          model: 'receipts',
          key: 'r_id',
        },
      },
      ri_product_service: {
        type: Sequelize.STRING(300),
        allowNull: true,
      },
      ri_charts_of_accounts: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'charts_of_accounts',
          key: 'coa_id',
        },
      },
      ri_description: {
        type: Sequelize.TEXT('long'),
        allowNull: true,
      },
      ri_quantity: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      ri_sales_price: {
        type: Sequelize.DECIMAL(18, 2),
        allowNull: false,
      },
      ri_discount: {
        type: Sequelize.DECIMAL(18, 2),
        allowNull: false,
      },
      ri_discount_type: {
        type: Sequelize.ENUM('PERCENT', 'FIXED'),
        allowNull: false,
      },
      ri_vat: {
        type: Sequelize.DECIMAL(18, 2),
        allowNull: false,
      },
      ri_witholding_tax: {
        type: Sequelize.DECIMAL(18, 2),
        allowNull: false,
      },
      ri_responsibility_center: {
        type: Sequelize.STRING(300),
        allowNull: false,
      },
    })
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('receipt_items')
  },
}
