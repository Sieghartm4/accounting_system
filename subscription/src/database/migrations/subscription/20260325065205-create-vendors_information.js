'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('vendors_information', {
      vi_id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      vi_vendor_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'vendors',
          key: 'v_id',
        },
      },
      vi_address: {
        type: Sequelize.TEXT('long'),
        allowNull: false,
      },
      vi_tin: {
        type: Sequelize.STRING(15),
        allowNull: false,
      },
      vi_details: {
        type: Sequelize.TEXT('long'),
        allowNull: true,
      },
      vi_contact: {
        type: Sequelize.STRING(15),
        allowNull: true,
      },
    })
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('vendors_information')
  },
}
