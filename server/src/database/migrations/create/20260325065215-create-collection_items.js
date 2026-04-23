'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('collection_items', {
      ci_id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      ci_collection_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'collections',
          key: 'c_id'
        }
      },
      ci_sales_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'sales_items',
          key: 'si_id'
        }
      },
      ci_amount: {
        type: Sequelize.DECIMAL(18, 2),
        allowNull: false
      },
      ci_witholding_tax: {
        type: Sequelize.DECIMAL(18, 2),
        allowNull: false
      }
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('collection_items');
  }
};
