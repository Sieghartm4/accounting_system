'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('customers', {
      c_id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      c_code: {
        type: Sequelize.STRING(20),
        allowNull: false,
        unique: true,
      },
      c_name: {
        type: Sequelize.STRING(300),
        allowNull: false,
      },
      c_category: {
        type: Sequelize.STRING(120),
        allowNull: true,
      },
      c_type: {
        type: Sequelize.STRING(120),
        allowNull: true,
      },
      c_status: {
        type: Sequelize.ENUM('ACTIVE', 'INACTIVE'),
        allowNull: false,
      },
    })
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('customers')
  },
}
