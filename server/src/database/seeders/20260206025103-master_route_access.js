'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // `witholding_tax` (missing the 'h') was seeded here for a long time while
    // the client registry spelled it `withholding_tax`. Any code the client has
    // no registry entry for cannot be gated by a subscription plan, so the two
    // must agree. The legacy spelling is renamed away by migration
    // 20260826090000-normalize-module-codes rather than seeded here.
    const routes = [
      'dashboard', 'access', 'users', 'customers', 'vendors', 'charts',
      'proforma_entries', 'product_service', 'company', 'receipts',
      'disbursement', 'sales', 'collections', 'purchase', 'payments', 'adjustments', 'vat', 'withholding_tax', 'trial_balance', 'income_statement', 'general_ledger', 'balance_sheet', 'journal_entries', 'statement_of_comprehensive_income', 'bank_reconciliation', 'audit_trail', 'aging_receivables', 'customer_transactions', 'vendor_transactions', 'advances', 'purchase_order', 'responsibility_center', 'aging_payables', 'tax_compliance', 'recurring_journals', 'accounting_periods',
      // Present in existing tenants but never listed here, so a fresh tenant
      // would have been missing them entirely. Also seeded so the client
      // registry has something to resolve.
      'accounting_tools', 'fiscal_periods'
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

    for (const data of seedData) {
      const [existing] = await queryInterface.sequelize.query(
        'SELECT mra_id FROM master_route_access WHERE mra_access_id = ? AND mra_name = ?',
        { replacements: [data.mra_access_id, data.mra_name] }
      );
      if (existing.length === 0) {
        await queryInterface.bulkInsert('master_route_access', [data]);
      }
    }
  },

  async down(queryInterface, Sequelize) {
    /**
     * Add commands to revert seed here.
     *
     * Example:
     * await queryInterface.bulkDelete('People', null, {});
     */
  },
}
