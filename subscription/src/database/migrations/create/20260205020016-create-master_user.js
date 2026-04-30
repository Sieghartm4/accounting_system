'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('master_user', {
      mu_id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      mu_username: {
        type: Sequelize.STRING(300),
        allowNull: false
      },
      mu_password: {
        type: Sequelize.TEXT('long'),
        allowNull: false
      },
      db_name: {
        type: Sequelize.STRING(300),
        allowNull: false
      },
      mu_status: {
        type: Sequelize.ENUM,
        values: ['active', 'inactive'],
        allowNull: false,
        defaultValue: 'active'
      }
    });
  },

  async down(queryInterface, Sequelize) {
    /**
     * Add reverting commands here.
     *
     * Example:
     * await queryInterface.dropTable('users');
     */
    await queryInterface.dropTable('master_user');
  }
};
