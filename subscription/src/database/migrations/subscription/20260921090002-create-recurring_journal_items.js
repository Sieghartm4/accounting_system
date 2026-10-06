'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('recurring_journal_items', {
      rji_id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      rji_journal_id: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      rji_coa_id: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      rji_responsibility_center: {
        type: Sequelize.STRING(200),
        allowNull: true,
        defaultValue: ''
      },
      rji_type: {
        type: Sequelize.ENUM('debit', 'credit'),
        allowNull: false
      },
      rji_amount: {
        type: Sequelize.DECIMAL(18, 2),
        allowNull: false,
        defaultValue: 0
      }
    });

    await queryInterface.addIndex('recurring_journal_items', ['rji_journal_id'], {
      name: 'rji_journal_id_index'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('recurring_journal_items');
  }
};