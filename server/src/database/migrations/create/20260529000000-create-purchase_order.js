'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('purchase_order', {
      po_id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      po_procurement_id: {
        type: Sequelize.TEXT('long'),
        allowNull: true,
      },
      po_product: {
        type: Sequelize.STRING(300),
        allowNull: false,
      },
      po_quantity: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      po_price: {
        type: Sequelize.DECIMAL(18, 2),
        allowNull: false,
        defaultValue: 0.0,
      },
      po_responsibility_center: {
        type: Sequelize.STRING(300),
        allowNull: true,
      },
      po_status: {
        type: Sequelize.ENUM('PENDING', 'APPROVED', 'REJECTED'),
        allowNull: false,
        defaultValue: 'PENDING',
      },
    })
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('purchase_order')
  },
}
