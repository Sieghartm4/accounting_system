'use strict'

/**
 * Default document-number sequences for freshly provisioned tenant databases.
 *
 * Server-side seeders do not run when createTenantDatabase provisions a new
 * db (it seeds only from the subscription path), so the defaults live here
 * too. Values mirror the legacy per-controller generators; every insert is
 * guarded because db:seed:all re-runs seeders.
 */
const DEFAULT_SEQUENCES = [
  ['receipts', 'CR'],
  ['disbursements', 'CD'],
  ['sales', 'SO'],
  ['collections', 'CL'],
  ['purchase', 'PO'],
  ['payments', 'PM'],
  ['adjustments', 'JV'],
]

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    for (const [module, prefix] of DEFAULT_SEQUENCES) {
      await queryInterface.sequelize.query(
        `INSERT INTO sequence_settings
          (ss_module, ss_prefix, ss_date_format, ss_padding, ss_next_sequence)
         SELECT ?, ?, 'MMDDYY', 4, 1
         FROM DUAL
         WHERE NOT EXISTS (
           SELECT 1 FROM sequence_settings WHERE ss_module = ?
         )`,
        { replacements: [module, prefix, module] },
      )
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('sequence_settings', {
      ss_module: DEFAULT_SEQUENCES.map(([module]) => module),
    })
  },
}
