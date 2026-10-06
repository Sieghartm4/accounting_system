'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('payment_items', {
      ci_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      ci_payment_id: {
        type: Sequelize.STRING(300),
        allowNull: false,
        references: {
          model: 'payments',
          key: 'c_id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      ci_purchase_id: {
        type: Sequelize.STRING(300),
        allowNull: true,
        references: {
          model: 'purchase',
          key: 'p_id',
        },
      },
      ci_amount_applied: {
        type: Sequelize.DECIMAL(18, 2),
        allowNull: false,
        comment: 'Amount applied from this payment to the purchase invoice',
      },
      ci_created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        comment: 'Audit trail timestamp for when this payment item was created',
      },
    })
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('payment_items')
  },
}
