'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.createTable('master_company', {
      mc_company_id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      mc_company_name: {
        type: Sequelize.STRING(300),
        allowNull: false
      },
      mc_owner_name: {
        type: Sequelize.STRING(300),
        allowNull: false
      },
      mc_logo: {
        type: Sequelize.TEXT('long'),
        allowNull: false
      },
      mc_address: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      mc_tin: {
        type: Sequelize.STRING(50),
        allowNull: false
      },
      mc_website: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      mc_email: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      mc_phone: {
        type: Sequelize.STRING(20),
        allowNull: true
      },
      mc_status: {
        type: Sequelize.ENUM('active', 'inactive', 'delete'),
        allowNull: false
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
