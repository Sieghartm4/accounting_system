'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('receipt_items', {
      ri_id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      ri_receipts_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'receipts',
          key: 'r_id'
        }
      },
      ri_product_service: {
        type: Sequelize.STRING(300),
        allowNull: true
      },
      ri_charts_of_accounts: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'charts_of_accounts',
          key: 'coa_id'
        }
      },
      ri_description: {
        type: Sequelize.TEXT('long'),
        allowNull: true
      },
      ri_unit: {
        type: Sequelize.STRING(300),
        allowNull: true
      },
      ri_quantity: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      ri_sales_price: {
        type: Sequelize.DECIMAL(18, 2),
        allowNull: true
      },
      ri_discount: {
        type: Sequelize.DECIMAL(18, 2),
        allowNull: true
      },
      ri_vat: {
        type: Sequelize.DECIMAL(18, 2),
        allowNull: true
      },
      ri_witholding_tax: {
        type: Sequelize.DECIMAL(18, 2),
        allowNull: true
      },
      ri_responsibility_center: {
        type: Sequelize.STRING(300),
        allowNull: true
      }
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('receipt_items');
  }
};
