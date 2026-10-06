'use strict'

/**
 * Seed the DB-backed form registry from the code catalog.
 *
 * Idempotent: `syncAll` upserts by form_code and retires rows the catalog no
 * longer declares, so this can be re-run on every deploy. The seeder delegates
 * to registry.service so the seeder and any admin re-sync path cannot drift
 * apart in behaviour.
 *
 * Run with: npx sequelize-cli db:seed:all
 * or directly: node src/database/seeders/20260926091001-seed-tax-form-registry.js
 */

const { syncAll, detectDrift } = require('../../services/tax/registry.service')

module.exports = {
  async up(queryInterface) {
    // Deliberately no sequelize handle passed in. syncAll() would otherwise
    // write through the CLI connection while detectDrift() reads back through
    // the tenant pool, and if those ever resolve to different databases the
    // verification would report the whole registry as missing. Both now go
    // through the same queries.util path, so the seeder and the running
    // application cannot disagree about which database the registry lives in.
    const result = await syncAll()
    console.log(
      `[tax] registry seeded: ${result.synced} forms (revision ${result.catalog_revision}), ${result.retired} retired`,
    )

    // Re-read and confirm. A seeder that reports success without verifying is
    // how a stale registry survives to filing time.
    const drift = await detectDrift()
    if (!drift.in_sync) {
      throw new Error(
        '[tax] registry is not in sync with the catalog after seeding: ' + JSON.stringify(drift),
      )
    }
    console.log('[tax] registry verified in sync with catalog')
  },

  async down() {
    // Deliberately no-op. Retiring a form must not erase the registry row,
    // because filings reference forms by code and a deleted registry row would
    // leave a filed return unresolvable. Use syncAll() to retire instead.
    console.log('[tax] registry rows retained on rollback; re-sync to restore catalog state')
  },
}
