'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('adjustment_balance', {
      ab_id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      ab_br_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'bank_reconciliation',
          key: 'br_id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      ab_date: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      ab_type: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      ab_description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      ab_amount: {
        type: Sequelize.DECIMAL(18, 2),
        allowNull: false,
        defaultValue: 0.0,
      },
      ab_side: {
        type: Sequelize.ENUM('BANK', 'BOOK'),
        allowNull: false,
      },
      ab_created_by: {
        type: Sequelize.STRING(300),
        allowNull: false,
      },
    })
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('adjustment_balance')
  },
}
