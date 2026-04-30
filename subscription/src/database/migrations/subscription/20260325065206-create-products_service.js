'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('products_service', {
      ps_id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      ps_code: {
        type: Sequelize.STRING(20),
        allowNull: false
      },
      ps_name: {
        type: Sequelize.STRING(300),
        allowNull: false
      },
      ps_type: {
        type: Sequelize.ENUM("PRODUCT","SERVICE"),
        allowNull: false
      },
      ps_category: {
        type: Sequelize.STRING(120),
        allowNull: false
      },
      ps_sales_price: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      ps_purchase_price: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      ps_unit: {
        type: Sequelize.STRING(120),
        allowNull: false
      }
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('products_service');
  }
};
