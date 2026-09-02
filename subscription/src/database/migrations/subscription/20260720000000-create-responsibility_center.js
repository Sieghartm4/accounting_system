'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('responsibility_center', {
      rc_id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      rc_code: {
        type: Sequelize.STRING(20),
        allowNull: false,
        unique: true,
      },
      rc_name: {
        type: Sequelize.STRING(300),
        allowNull: false,
      },
      rc_department: {
        type: Sequelize.STRING(120),
        allowNull: true,
      },
      rc_status: {
        type: Sequelize.ENUM('ACTIVE', 'INACTIVE'),
        allowNull: false,
        defaultValue: 'ACTIVE',
      },
    })
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('responsibility_center')
  },
}
