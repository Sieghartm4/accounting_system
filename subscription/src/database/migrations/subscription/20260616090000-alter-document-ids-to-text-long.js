'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Change cash_disbursements.cd_id to STRING(300)
    await queryInterface.changeColumn('cash_disbursements', 'cd_id', {
      type: Sequelize.STRING(300),
      allowNull: false,
    })

    // Change receipts.r_id to STRING(300)
    await queryInterface.changeColumn('receipts', 'r_id', {
      type: Sequelize.STRING(300),
      allowNull: false,
    })

    // Change sales.s_id to STRING(300)
    await queryInterface.changeColumn('sales', 's_id', {
      type: Sequelize.STRING(300),
      allowNull: false,
    })

    // Change purchase.p_id to STRING(300)
    await queryInterface.changeColumn('purchase', 'p_id', {
      type: Sequelize.STRING(300),
      allowNull: false,
    })
  },

  async down(queryInterface, Sequelize) {
    // Revert cash_disbursements.cd_id to STRING(30)
    await queryInterface.changeColumn('cash_disbursements', 'cd_id', {
      type: Sequelize.STRING(30),
      allowNull: false,
    })

    // Revert receipts.r_id to STRING(50)
    await queryInterface.changeColumn('receipts', 'r_id', {
      type: Sequelize.STRING(50),
      allowNull: false,
    })

    // Revert sales.s_id to original type
    await queryInterface.changeColumn('sales', 's_id', {
      type: Sequelize.STRING(300),
      allowNull: false,
    })

    // Revert purchase.p_id to STRING(30)
    await queryInterface.changeColumn('purchase', 'p_id', {
      type: Sequelize.STRING(30),
      allowNull: false,
    })
  },
}
