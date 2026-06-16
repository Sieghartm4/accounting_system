'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Change cash_disbursements.cd_id to TEXT('long')
    await queryInterface.changeColumn('cash_disbursements', 'cd_id', {
      type: Sequelize.TEXT('long'),
      allowNull: false,
      primaryKey: true,
    })

    // Change receipts.r_id to TEXT('long')
    await queryInterface.changeColumn('receipts', 'r_id', {
      type: Sequelize.TEXT('long'),
      allowNull: false,
      primaryKey: true,
    })

    // Change sales.s_id to TEXT('long') (idempotent if already TEXT)
    await queryInterface.changeColumn('sales', 's_id', {
      type: Sequelize.TEXT('long'),
      allowNull: false,
      primaryKey: true,
    })

    // Change purchase.p_id to TEXT('long')
    await queryInterface.changeColumn('purchase', 'p_id', {
      type: Sequelize.TEXT('long'),
      allowNull: false,
      primaryKey: true,
    })
  },

  async down(queryInterface, Sequelize) {
    // Revert cash_disbursements.cd_id to STRING(30)
    await queryInterface.changeColumn('cash_disbursements', 'cd_id', {
      type: Sequelize.STRING(30),
      allowNull: false,
      primaryKey: true,
    })

    // Revert receipts.r_id to STRING(50)
    await queryInterface.changeColumn('receipts', 'r_id', {
      type: Sequelize.STRING(50),
      allowNull: false,
      primaryKey: true,
    })

    // Revert sales.s_id to TEXT('long') (no-op if original was TEXT)
    await queryInterface.changeColumn('sales', 's_id', {
      type: Sequelize.TEXT('long'),
      allowNull: false,
      primaryKey: true,
    })

    // Revert purchase.p_id to STRING(30)
    await queryInterface.changeColumn('purchase', 'p_id', {
      type: Sequelize.STRING(30),
      allowNull: false,
      primaryKey: true,
    })
  },
}
