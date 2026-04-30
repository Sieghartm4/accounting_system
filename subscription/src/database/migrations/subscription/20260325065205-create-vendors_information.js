'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('vendors_information', {
      vi_id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      vi_vendor_code: {
        type: Sequelize.STRING(120),
        allowNull: false
      },
      vi_vendor_name: {
        type: Sequelize.STRING(300),
        allowNull: false
      },
      vi_address: {
        type: Sequelize.TEXT('long'),
        allowNull: false
      },
      vi_tin: {
        type: Sequelize.STRING(15),
        allowNull: false
      },
      vi_details: {
        type: Sequelize.TEXT('long'),
        allowNull: false
      },
      vi_contact: {
        type: Sequelize.STRING(15),
        allowNull: false
      }
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('vendors_information');
  }
};
