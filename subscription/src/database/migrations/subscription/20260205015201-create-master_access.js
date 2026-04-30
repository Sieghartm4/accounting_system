'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('master_access', {
      ma_access_id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      ma_access_name: {
        type: Sequelize.STRING(300),
        allowNull: false
      },
      ma_status: {
        type: Sequelize.ENUM,
        values: ['active', 'inactive', 'delete'],
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
    await queryInterface.dropTable('master_access');
  }
};
