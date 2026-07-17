'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn('vat', 'vat_sub_type', {
      type: Sequelize.ENUM(
        'Services',
        'Goods Other Than Capital Goods',
        'Capital Goods',
      ),
      allowNull: true,
    })
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.changeColumn('vat', 'vat_sub_type', {
      type: Sequelize.ENUM(
        'Services',
        'Goods Other Than Capital Goods',
        'Capital Goods',
      ),
      allowNull: false,
    })
  },
}
