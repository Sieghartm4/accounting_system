'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('cash_disbursement_items', {
      cdi_id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      cdi_cash_disbursement_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'cash_disbursements',
          key: 'cd_id'
        }
      },
      cdi_product_service: {
        type: Sequelize.STRING(300),
        allowNull: true
      },
      cdi_charts_of_accounts: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'charts_of_accounts',
          key: 'coa_id'
        }
      },
      cdi_description: {
        type: Sequelize.TEXT('long'),
        allowNull: true
      },
      cdi_unit: {
        type: Sequelize.STRING(300),
        allowNull: true
      },
      cdi_quantity: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      cdi_purchase_price: {
        type: Sequelize.DECIMAL(18, 2),
        allowNull: true
      },
      cdi_discount: {
        type: Sequelize.DECIMAL(18, 2),
        allowNull: true
      },
      cdi_vat: {
        type: Sequelize.DECIMAL(18, 2),
        allowNull: true
      },
      cdi_witholding_tax: {
        type: Sequelize.DECIMAL(18, 2),
        allowNull: true
      },
      cdi_responsibility_center: {
        type: Sequelize.STRING(300),
        allowNull: true
      }
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('cash_disbursement_items');
  }
};
