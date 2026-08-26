'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('subscription_plans', {
      sp_id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      sp_code: {
        type: Sequelize.STRING(255),
        allowNull: false,
        unique: true,
      },
      sp_name: {
        type: Sequelize.STRING(300),
        allowNull: false,
      },
      sp_description: {
        type: Sequelize.TEXT('long'),
        allowNull: true,
      },
      sp_status: {
        type: Sequelize.ENUM('PUBLIC', 'PRIVATE'),
        allowNull: false,
        defaultValue: 'PUBLIC',
      },
    })
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('subscription_plans')
  },
}
