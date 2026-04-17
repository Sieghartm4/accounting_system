'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('vat', {
      vat_id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      vat_code: {
        type: Sequelize.STRING(10),
        allowNull: false,
        unique: true
      },
      vat_name: {
        type: Sequelize.STRING(300),
        allowNull: false
      },
      vat_rate: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: false
      },
      vat_type: {
        type: Sequelize.ENUM('Zero-rated', 'Vatable', 'Exempt'),
        allowNull: false
      },
      vat_sub_type: {
        type: Sequelize.ENUM('Services', 'Goods Other Than Capital Goods', 'Capital Goods'),
        allowNull: false
      },
      vat_description: {
        type: Sequelize.TEXT('long'),
        allowNull: false
      },
      vat_status: {
        type: Sequelize.ENUM('ACTIVE', 'INACTIVE'),
        allowNull: false
      }
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('vat');
  }
};
