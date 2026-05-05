'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.createTable('audit_trail', {
      at_id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      at_transaction_id: {
        type: Sequelize.STRING(120),
        allowNull: true
      },
      at_module: {
        type: Sequelize.STRING(300),
        allowNull: true
      },
      at_performed_by: {
        type: Sequelize.STRING(300),
        allowNull: true
      },
      at_created_date: {
        type: Sequelize.STRING(30),
        allowNull: true
      },
      at_created_time: {
        type: Sequelize.STRING(30),
        allowNull: true
      },
      at_action: {
        type: Sequelize.STRING(300),
        allowNull: true
      }
    });

  },

  async down (queryInterface, Sequelize) {
    /**
     * Add reverting commands here.
     *
     * Example:
     * await queryInterface.dropTable('users');
     */
  }
};
