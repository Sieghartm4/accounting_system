'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('journal_entries', {
      je_id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      je_db_name: {
        type: Sequelize.STRING(300),
        allowNull: false
      },
      je_db_id: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      je_coa_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'charts_of_accounts',
          key: 'coa_id'
        }
      },
      je_responsibility_center: {
        type: Sequelize.STRING(300),
        allowNull: false
      },
      je_type: {
        type: Sequelize.ENUM('DEBIT', 'CREDIT'),
        allowNull: false
      },
      je_amount: {
        type: Sequelize.DECIMAL(18, 2),
        allowNull: false
      },
      je_date: {
        type: Sequelize.STRING(30),
        allowNull: false
      }
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('journal_entries');
  }
};
