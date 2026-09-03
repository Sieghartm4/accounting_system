'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('payment_items', {
      ci_id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      ci_payment_id: {
        type: Sequelize.STRING(300),
        allowNull: false,
        references: {
          model: 'payments',
          key: 'p_id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      ci_purchase_id: {
        type: Sequelize.STRING(300),
        allowNull: true,
        references: {
          model: 'purchase_items',
          key: 'pi_id',
        },
      },
      ci_amount: {
        type: Sequelize.NUMERIC,
        allowNull: false,
      },
      ci_witholding_tax: {
        type: Sequelize.DECIMAL(18, 2),
        allowNull: true,
      },
    })
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('payment_items')
  },
}
