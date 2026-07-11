'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Make customer details & contact nullable
    await queryInterface.changeColumn('customers_information', 'ci_details', {
      type: Sequelize.TEXT('long'),
      allowNull: true,
    })

    await queryInterface.changeColumn('customers_information', 'ci_contact', {
      type: Sequelize.STRING(15),
      allowNull: true,
    })

    // Make vendor details & contact nullable
    await queryInterface.changeColumn('vendors_information', 'vi_details', {
      type: Sequelize.TEXT('long'),
      allowNull: true,
    })

    await queryInterface.changeColumn('vendors_information', 'vi_contact', {
      type: Sequelize.STRING(15),
      allowNull: true,
    })
  },

  async down(queryInterface, Sequelize) {
    // Revert to NOT NULL where possible (may fail if NULLs exist)
    await queryInterface.changeColumn('customers_information', 'ci_details', {
      type: Sequelize.TEXT('long'),
      allowNull: false,
    })

    await queryInterface.changeColumn('customers_information', 'ci_contact', {
      type: Sequelize.STRING(15),
      allowNull: false,
    })

    await queryInterface.changeColumn('vendors_information', 'vi_details', {
      type: Sequelize.TEXT('long'),
      allowNull: false,
    })

    await queryInterface.changeColumn('vendors_information', 'vi_contact', {
      type: Sequelize.STRING(15),
      allowNull: false,
    })
  },
}
