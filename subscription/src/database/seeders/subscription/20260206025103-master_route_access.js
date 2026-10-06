'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Kept in step with subscription/src/constants/moduleCatalog.js. A module
    // missing here has no master_route_access row, so a subscription plan can
    // name it but nothing can grant or withhold it - gating fails open.
    //
    // `witholding_tax` was seeded here (missing the 'h') while the client
    // registry spelled it `withholding_tax`, so a plan could never match it.
    const routes = [
      'dashboard',
      'access',
      'users',
      'customers',
      'vendors',
      'charts',
      'proforma_entries',
      'product_service',
      'company',
      'receipts',
      'disbursement',
      'sales',
      'collections',
      'purchase',
      'payments',
      'adjustments',
      'vat',
      'withholding_tax',
      'trial_balance',
      'income_statement',
      'general_ledger',
      'balance_sheet',
      'journal_entries',
      'statement_of_comprehensive_income',
      'bank_reconciliation',
      'audit_trail',
      'aging_receivables',
      'customer_transactions',
      'vendor_transactions',
      'advances',
      'purchase_order',
      'responsibility_center',
      'aging_payables',
      'tax_compliance',
      'recurring_journals',
      'accounting_periods',
      'accounting_tools',
      'fiscal_periods',
    ]

    // Inserted one row at a time behind an existence check. `db:seed:all`
    // re-runs every seeder on each call, so an unguarded bulkInsert adds a
    // duplicate row per access level every time a tenant is re-seeded.
    for (const route of routes) {
      for (const accessId of [1, 2]) {
        const [existing] = await queryInterface.sequelize.query(
          'SELECT mra_id FROM master_route_access WHERE mra_access_id = ? AND mra_name = ?',
          { replacements: [accessId, route] },
        )
        if (existing.length === 0) {
          await queryInterface.bulkInsert('master_route_access', [
            {
              mra_access_id: accessId,
              mra_name: route,
              mra_status: 'Full Access',
            },
          ])
        }
      }
    }
  },

  async down(queryInterface, Sequelize) {
    /**
     * Add seed commands here.
     *
     * Example:
     * await queryInterface.bulkDelete('People', null, {});
     */
  },
}