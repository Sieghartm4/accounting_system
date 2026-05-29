'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    /**
     * Add seed commands here.
     *
     * Example:
     * await queryInterface.bulkInsert('People', [{
     *   name: 'John Doe',
     *   isBetaMember: false
     * }], {});
    */
       const routes = [
      'dashboard', 'access', 'users', 'customers', 'vendors', 'charts',
      'proforma_entries', 'product_service', 'company', 'receipts',
      'disbursement', 'sales', 'collections', 'purchase', 'payments', 'adjustments', 'vat', 'witholding_tax', 'trial_balance', 'income_statement', 'general_ledger', 'balance_sheet', 'journal_entries', 'statement_of_comprehensive_income', 'bank_reconciliation', 'audit_trail', 'aging_receivables', 'customer_transactions', 'vendor_transactions', 'advances', 'purchase_order'
    ];

    const seedData = [];
    routes.forEach(route => {
      seedData.push({
        mra_access_id: 1,
        mra_name: route,
        mra_status: 'Full Access'
      });
      seedData.push({
        mra_access_id: 2,
        mra_name: route,
        mra_status: 'Full Access'
      });
    });

    await queryInterface.bulkInsert('master_route_access', seedData);
  },

  async down (queryInterface, Sequelize) {
    /**
     * Add commands to revert seed here.
     *
     * Example:
     * await queryInterface.bulkDelete('People', null, {});
     */
  }
};
