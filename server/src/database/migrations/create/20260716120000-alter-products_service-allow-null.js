'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn('products_service', 'ps_category', {
      type: Sequelize.STRING(120),
      allowNull: true,
    })

    await queryInterface.changeColumn('products_service', 'ps_sales_price', {
      type: Sequelize.INTEGER,
      allowNull: true,
    })

    await queryInterface.changeColumn('products_service', 'ps_purchase_price', {
      type: Sequelize.INTEGER,
      allowNull: true,
    })

    await queryInterface.changeColumn('products_service', 'ps_unit', {
      type: Sequelize.STRING(120),
      allowNull: true,
    })
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.changeColumn('products_service', 'ps_category', {
      type: Sequelize.STRING(120),
      allowNull: false,
    })

    await queryInterface.changeColumn('products_service', 'ps_sales_price', {
      type: Sequelize.INTEGER,
      allowNull: false,
    })

    await queryInterface.changeColumn('products_service', 'ps_purchase_price', {
      type: Sequelize.INTEGER,
      allowNull: false,
    })

    await queryInterface.changeColumn('products_service', 'ps_unit', {
      type: Sequelize.STRING(120),
      allowNull: false,
    })
  },
}
