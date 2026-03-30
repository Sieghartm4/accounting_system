'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('vendors', {
      v_id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      v_code: {
        type: Sequelize.STRING(20),
        allowNull: false
      },
      v_name: {
        type: Sequelize.STRING(300),
        allowNull: false
      },
      v_category: {
        type: Sequelize.STRING(120),
        allowNull: false
      },
      v_type: {
        type: Sequelize.STRING(120),
        allowNull: false
      },
      v_status: {
        type: Sequelize.ENUM("ACTIVE","INACTIVE"),
        allowNull: false
      }
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('vendors');
  }
};
