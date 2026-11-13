'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Item price columns were created as NUMERIC with no precision, which
    // MySQL stores as DECIMAL(10,0) — an integer that rounds values like
    // 100.93 to 101 while journal entries keep the unrounded amounts.
    await queryInterface.sequelize.query(`
      ALTER TABLE sales_items
      MODIFY COLUMN si_sales_price DECIMAL(18, 2) NOT NULL
    `)
    await queryInterface.sequelize.query(`
      ALTER TABLE receipt_items
      MODIFY COLUMN ri_sales_price DECIMAL(18, 2) NOT NULL
    `)
    await queryInterface.sequelize.query(`
      ALTER TABLE cash_disbursement_items
      MODIFY COLUMN cdi_purchase_price DECIMAL(18, 2) NOT NULL
    `)
    await queryInterface.sequelize.query(`
      ALTER TABLE purchase_items
      MODIFY COLUMN pi_purchase_price DECIMAL(18, 2) NULL
    `)
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      ALTER TABLE sales_items
      MODIFY COLUMN si_sales_price NUMERIC NOT NULL
    `)
    await queryInterface.sequelize.query(`
      ALTER TABLE receipt_items
      MODIFY COLUMN ri_sales_price NUMERIC NOT NULL
    `)
    await queryInterface.sequelize.query(`
      ALTER TABLE cash_disbursement_items
      MODIFY COLUMN cdi_purchase_price NUMERIC NOT NULL
    `)
    await queryInterface.sequelize.query(`
      ALTER TABLE purchase_items
      MODIFY COLUMN pi_purchase_price NUMERIC NULL
    `)
  },
}
