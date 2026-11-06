'use strict'

/**
 * Default document-number sequences, one per transaction module.
 *
 * The values mirror what the per-controller generators have always produced
 * (PREFIX-MMDDYY-0004), so a company that never opens the Masters sequence
 * editor keeps ids that read exactly like before. `db:seed:all` re-runs every
 * seeder, so every insert is guarded.
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
