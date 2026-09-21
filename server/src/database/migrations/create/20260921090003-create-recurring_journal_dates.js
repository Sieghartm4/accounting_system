'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('recurring_journal_dates', {
      rjd_id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      rjd_journal_id: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      rjd_occurrence_date: {
        type: Sequelize.STRING(20),
        allowNull: false
      },
      rjd_adjustment_id: {
        type: Sequelize.STRING(300),
        allowNull: true
      },
      rjd_generated_date: {
        type: Sequelize.STRING(30),
        allowNull: true
      },
      rjd_generated_by: {
        type: Sequelize.STRING(300),
        allowNull: true
      }
    });

    await queryInterface.addIndex(
      'recurring_journal_dates',
      ['rjd_journal_id', 'rjd_occurrence_date'],
      {
        name: 'rjd_journal_occurrence_unique',
        unique: true
      }
    );
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('recurring_journal_dates');
  }
};