'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('collection_items', {
      ci_id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        allowNull: false,
        autoIncrement: true,
      },
      ci_collection_id: {
        type: Sequelize.STRING(300),
        allowNull: false,
        references: {
          model: 'collections',
          key: 'c_id',
        },
      },
      ci_sales_id: {
        type: Sequelize.STRING(300),
        allowNull: false,
        references: {
          model: 'sales',
          key: 's_id',
        },
      },
      ci_amount_applied: {
        type: Sequelize.DECIMAL(18, 2),
        allowNull: false,
        comment: 'Amount applied from this collection to the sales invoice',
      },
      ci_created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        comment: 'Audit trail timestamp for when this collection item was created',
      },
    })
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('collection_items')
  },
}
