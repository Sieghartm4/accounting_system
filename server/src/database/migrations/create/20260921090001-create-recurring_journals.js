'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('recurring_journals', {
      rj_id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      rj_reference: {
        type: Sequelize.STRING(60),
        allowNull: false,
        unique: true
      },
      rj_name: {
        type: Sequelize.STRING(200),
        allowNull: false
      },
      rj_frequency: {
        type: Sequelize.ENUM('DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY', 'QUARTERLY', 'SEMI_ANNUAL', 'ANNUAL'),
        allowNull: false,
        defaultValue: 'MONTHLY'
      },
      rj_interval: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1
      },
      rj_day: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      rj_start_date: {
        type: Sequelize.STRING(20),
        allowNull: false
      },
      rj_end_date: {
        type: Sequelize.STRING(20),
        allowNull: true
      },
      rj_status: {
        type: Sequelize.ENUM('ACTIVE', 'INACTIVE'),
        allowNull: false,
        defaultValue: 'ACTIVE'
      },
      rj_remarks: {
        type: Sequelize.TEXT('long'),
        allowNull: true
      },
      rj_last_generated_date: {
        type: Sequelize.STRING(20),
        allowNull: true
      },
      rj_next_due_date: {
        type: Sequelize.STRING(20),
        allowNull: true
      },
      rj_created_date: {
        type: Sequelize.STRING(30),
        allowNull: true
      },
      rj_created_by: {
        type: Sequelize.STRING(300),
        allowNull: true
      },
      rj_updated_date: {
        type: Sequelize.STRING(30),
        allowNull: true
      },
      rj_updated_by: {
        type: Sequelize.STRING(300),
        allowNull: true
      }
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('recurring_journals');
  }
};