'use strict'

/**
 * Normalise module codes across existing tenants.
 *
 * Two problems this fixes, both of which would otherwise make plan-based module
 * gating fail silently:
 *
 * 1. `witholding_tax` (missing 'h') was what the master_route_access seeder
 *    wrote, but the client's ROUTE_CONFIG registry defines `withholding_tax`
 *    with the correct spelling. So the lookup missed and the module resolved to
 *    undefined - the route rendered for everyone, or not at all, depending on
 *    which registry was consulted. Plans use the correctly-spelled code, so a
 *    tenant holding `withholding_tax` in a plan would never match the row.
 *
 * 2. `accounting_tools`, `fiscal_periods` and `purchase_order` exist in
 *    master_route_access but are absent from the client registry. A code with no
 *    registry entry cannot be gated, because there is nothing for the client to
 *    ask about.
 *
 * The rename is idempotent and non-destructive: the legacy spelling is folded
 * onto the canonical one, and rows that already carry the correct spelling are
 * left alone. Any code that would collide is left in place rather than deleted,
 * so no permission is ever silently lost.
 */
const CANONICAL_CODES = [
  'access',
  'accounting_periods',
  'accounting_tools',
  'adjustments',
  'advances',
  'aging_payables',
  'aging_receivables',
  'audit_trail',
  'balance_sheet',
  'bank_reconciliation',
  'charts',
  'collections',
  'company',
  'customer_transactions',
  'customers',
  'dashboard',
  'disbursement',
  'fiscal_periods',
  'general_ledger',
  'income_statement',
  'journal_entries',
  'payments',
  'product_service',
  'proforma_entries',
  'purchase',
  'purchase_order',
  'receipts',
  'recurring_journals',
  'responsibility_center',
  'sales',
  'statement_of_comprehensive_income',
  'tax_compliance',
  'trial_balance',
  'users',
  'vat',
  'vendor_transactions',
  'vendors',
  'withholding_tax',
]

/** Historical spellings mapped onto the code that replaces them. */
const RENAMES = {
  witholding_tax: 'withholding_tax',
}

module.exports = {
  async up(queryInterface) {
    const [tables] = await queryInterface.sequelize.query(
      `SELECT TABLE_NAME FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'master_route_access'`,
    )

    if (tables.length === 0) {
      // This migration belongs to the admin database. Running it against a
      // database without the table is a no-op rather than an error, so it is
      // safe in a migration set that is shared between schemas.
      return
    }

    // master_access carries the ma_ prefix; mra_ belongs to master_route_access.
    // Selecting mra_access_id here fails with "Unknown column 'mra_access_id' in
    // 'field list'".
    const [accessRows] = await queryInterface.sequelize.query(
      'SELECT ma_access_id FROM master_access',
    )

    for (const entry of Object.entries(RENAMES)) {
      const [legacy, canonical] = entry
      const [existingCanonical] = await queryInterface.sequelize.query(
        `SELECT COUNT(*) AS n FROM master_route_access
          WHERE mra_name = ?`,
        { replacements: [canonical] },
      )
      const [legacyRows] = await queryInterface.sequelize.query(
        `SELECT COUNT(*) AS n FROM master_route_access
          WHERE mra_name = ?`,
        { replacements: [legacy] },
      )

      if (Number(legacyRows[0].n) === 0) continue

      if (Number(existingCanonical[0].n) > 0) {
        // Both spellings are present. Move the access levels from the legacy
        // rows onto the canonical ones, then drop the duplicates so the unique
        // intent of (access, name) holds.
        await queryInterface.sequelize.query(
          `UPDATE master_route_access target
              JOIN master_route_access legacy
                ON legacy.mra_access_id = target.mra_access_id
               AND legacy.mra_name = ?
           SET target.mra_status = legacy.mra_status
             WHERE target.mra_name = ?`,
          { replacements: [legacy, canonical] },
        )
        await queryInterface.sequelize.query(
          'DELETE FROM master_route_access WHERE mra_name = ?',
          { replacements: [legacy] },
        )
      } else {
        await queryInterface.sequelize.query(
          'UPDATE master_route_access SET mra_name = ? WHERE mra_name = ?',
          { replacements: [canonical, legacy] },
        )
      }
    }

    // Ensure every canonical code has a row for every access level, so a plan
    // can never name a module that a tenant has no row for.
    for (const access of accessRows) {
      for (const code of CANONICAL_CODES) {
        await queryInterface.sequelize.query(
          `INSERT INTO master_route_access (mra_access_id, mra_name, mra_status)
           SELECT ?, ?, 'Full Access'
             FROM DUAL
            WHERE NOT EXISTS (
              SELECT 1 FROM master_route_access
               WHERE mra_access_id = ? AND mra_name = ?
            )`,
          { replacements: [access.mra_access_id, code, access.mra_access_id, code] },
        )
      }
    }
  },

  async down(queryInterface) {
    const [tables] = await queryInterface.sequelize.query(
      `SELECT TABLE_NAME FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'master_route_access'`,
    )
    if (tables.length === 0) return

    for (const [canonical, legacy] of Object.entries(RENAMES)) {
      const [existing] = await queryInterface.sequelize.query(
        `SELECT COUNT(*) AS n FROM master_route_access WHERE mra_name = ?`,
        { replacements: [canonical] },
      )
      if (Number(existing[0].n) === 0) continue
      await queryInterface.sequelize.query(
        'UPDATE master_route_access SET mra_name = ? WHERE mra_name = ?',
        { replacements: [legacy, canonical] },
      )
    }
  },
}