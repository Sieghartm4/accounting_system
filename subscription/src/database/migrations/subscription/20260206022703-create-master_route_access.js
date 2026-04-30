'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.createTable('master_route_access', {
      mra_id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      mra_access_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'master_access',
          key: 'ma_access_id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      mra_name: {
        type: Sequelize.STRING(300),
        allowNull: false
      },
      mra_status: {
        type: Sequelize.STRING(300),
        allowNull: false,
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
    await queryInterface.dropTable('master_route_access');
  }
};
