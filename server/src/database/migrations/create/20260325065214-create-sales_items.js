'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('sales_items', {
      si_id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      si_sales_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'sales',
          key: 's_id'
        }
      },
      si_product_service: {
        type: Sequelize.STRING(300),
        allowNull: true
      },
      si_charts_of_accounts: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'charts_of_accounts',
          key: 'coa_id'
        }
      },
      si_description: {
        type: Sequelize.TEXT('long'),
        allowNull: false
      },
      si_unit: {
        type: Sequelize.STRING(300),
        allowNull: true
      },
      si_quantity: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      si_purchase_price: {
        type: Sequelize.DECIMAL(18, 2),
        allowNull: false
      },
      si_discount: {
        type: Sequelize.DECIMAL(18, 2),
        allowNull: false
      },
      si_vat: {
        type: Sequelize.DECIMAL(18, 2),
        allowNull: false
      },
      si_witholding_tax: {
        type: Sequelize.DECIMAL(18, 2),
        allowNull: false
      },
      si_responsibility_center: {
        type: Sequelize.STRING(300),
        allowNull: false
      }
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('sales_items');
  }
};
