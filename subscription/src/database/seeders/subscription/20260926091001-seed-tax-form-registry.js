'use strict'

/**
 * Seed the BIR form registry for a newly provisioned tenant.
 *
 * The accounting server seeds this through db:seed:all, but a tenant created
 * through the subscription app's signup path runs only the seeders in this
 * folder, and the tax registry seeder was not among them. A new tenant therefore
 * had all of the tax tables and none of the forms in them, so the tax page had
 * an empty registry to read and no plan - however generous - could make it work.
 *
 * Delegates to registry.service so the seeder and the running application cannot
 * disagree about how the registry is populated. That service reads through the
 * tenant pool, which at seeder time already points at the database under
 * creation, because createTenantDatabase sets _DATABASE_ADMIN before this runs.
 */

// Path crosses into the accounting server's app, which is a separate package.
// seeders/subscription -> seeders -> database -> src -> subscription -> root
const { syncAll, detectDrift } = require(
  '../../../../../server/src/services/tax/registry.service'
)

module.exports = {
  async up() {
    const result = await syncAll()
    console.log(
      `[tax] registry seeded for tenant: ${result.synced} forms (revision ${result.catalog_revision}), ${result.retired} retired`,
    )

    // Verify rather than trust. A seeder that reports success without checking is
    // how an empty registry reaches filing time, which is the failure this
    // seeder exists to prevent.
    const drift = await detectDrift()
    if (!drift.in_sync) {
      throw new Error(
        '[tax] tenant registry is not in sync with the catalog after seeding: ' +
          JSON.stringify(drift),
      )
    }
    console.log('[tax] tenant registry verified in sync with catalog')
  },

  async down() {
    // No-op, matching the accounting server's seeder. Filings reference forms by
    // code, so removing a registry row would leave a filed return unresolvable.
    console.log('[tax] tenant registry rows retained on rollback')
  },
}