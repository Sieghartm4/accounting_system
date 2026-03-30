'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('proforma_entries', {
      pe_id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      pe_module: {
        type: Sequelize.STRING(120),
        allowNull: false
      },
      pe_name: {
        type: Sequelize.STRING(300),
        allowNull: false
      },
      pe_coa_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'charts_of_accounts',
          key: 'coa_id'
        }
      },
      pe_t_account: {
        type: Sequelize.STRING(300),
        allowNull: false
      }
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('proforma_entries');
  }
};
