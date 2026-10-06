'use strict'

/**
 * Asserts the module registry is consistent in both directions.
 *
 * A module code lives in three places that cannot share a module:
 *
 *   1. subscription/src/constants/moduleCatalog.js   - what a plan may name
 *   2. client/src/utils/routeProtection.js           - what the client can resolve
 *   3. a tenant's master_route_access.mra_name       - what the server can grant
 *
 * A code present in one and missing from another fails open: the plan can name
 * a module the server has no row for, or the client can be asked about a module
 * it has no registry entry for, and nothing is withheld. The `witholding_tax`
 * typo was exactly that - seeded into the database, absent from the client
 * registry - which is why this check exists.
 *
 * Run: node scripts/verify-module-registry.js [--tenant-db <name>]
 */

const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')

const CATALOG_PATH = path.join(ROOT, 'subscription/src/constants/moduleCatalog.js')
const CLIENT_PATH = path.join(ROOT, 'client/src/utils/routeProtection.js')

const catalog = require(CATALOG_PATH)

let fail = 0
const ok = (label, cond, extra) => {
  if (cond) {
    console.log(`  ok    ${label}`)
  } else {
    fail++
    console.log(`  FAIL  ${label}${extra !== undefined ? `  -> ${JSON.stringify(extra)}` : ''}`)
  }
}

/** Module codes declared in the client's ROUTE_CONFIG. */
const clientRegistry = () => {
  const src = fs.readFileSync(CLIENT_PATH, 'utf8')
  const block = src.match(/export const ROUTE_CONFIG\s*=\s*\{([\s\S]*?)\n\}/)
  if (!block) return null
  return [...block[1].matchAll(/^\s{2}([a-z_]+)\s*:/gm)].map((m) => m[1])
}

console.log('module registry consistency\n')

/* ---- catalog is internally coherent ---- */
const tiers = [
  ['REQUIRED', catalog.REQUIRED_MODULES],
  ['DEFAULT_ON', catalog.DEFAULT_ON_MODULES],
  ['DEFAULT_OFF', catalog.DEFAULT_OFF_MODULES],
]

const seen = new Map()
for (const [tier, list] of tiers) {
  for (const code of list) {
    if (seen.has(code)) {
      ok(`${code} appears in only one tier`, false, `also in ${seen.get(code)}`)
    } else {
      seen.set(code, tier)
    }
  }
}
ok('no module is in two tiers', !fail)

const duplicates = tiers
  .flatMap(([, list]) => list)
  .filter((code, i, arr) => arr.indexOf(code) !== i)
ok('no duplicate codes within a tier', duplicates.length === 0, duplicates)

ok(
  'UNSOLD_MODULES do not overlap sellable modules',
  catalog.UNSOLD_MODULES.every((c) => !catalog.ALL_MODULES.includes(c)),
  catalog.UNSOLD_MODULES.filter((c) => catalog.ALL_MODULES.includes(c)),
)

/* ---- default template satisfies its own rules ---- */
const template = catalog.defaultModuleTemplate()
const templateCheck = catalog.validateModules(template)
ok('default template passes validation', templateCheck.valid, templateCheck.errors)
ok(
  'default template excludes the DEFAULT_OFF modules',
  catalog.DEFAULT_OFF_MODULES.every((c) => !template.includes(c)),
)
ok(
  'default template includes every DEFAULT_ON module',
  catalog.DEFAULT_ON_MODULES.every((c) => template.includes(c)),
)
ok('default template is not empty', template.length > 0, template.length)

/* ---- validation rejects the things it should ---- */
ok('empty module list is rejected', catalog.validateModules([]).valid === false)
ok(
  'unknown module is rejected',
  catalog.validateModules([...template, 'not_a_module']).valid === false,
)
ok(
  'dropping a required module is rejected',
  catalog.validateModules(template.filter((c) => c !== 'dashboard')).valid === false,
)
ok('complete template is accepted', catalog.validateModules(template).valid === true)

const aliased = catalog.validateModules([...template, 'witholding_tax'])
ok(
  'legacy alias folds onto the canonical code',
  aliased.valid && aliased.modules.includes('withholding_tax') && !aliased.modules.includes('witholding_tax'),
  aliased.modules.filter((c) => c.includes('witholding')),
)

/* ---- client registry agrees with the catalog ---- */
const client = clientRegistry()
if (!client) {
  ok('client ROUTE_CONFIG could be parsed', false)
} else {
  const missingFromClient = catalog.ALL_MODULES.filter((c) => !client.includes(c))
  ok(
    'every catalog module exists in the client registry',
    missingFromClient.length === 0,
    missingFromClient,
  )

  const unknownToCatalog = client.filter(
    (c) =>
      !catalog.ALL_MODULES.includes(c) &&
      !catalog.UNSOLD_MODULES.includes(c) &&
      !Object.prototype.hasOwnProperty.call(catalog.LEGACY_ALIASES, c),
  )
  ok(
    'every client registry entry is known to the catalog',
    unknownToCatalog.length === 0,
    unknownToCatalog,
  )
}

/* ---- optional: cross-check a live tenant database ---- */
const tenantArg = process.argv.indexOf('--tenant-db')
const tenantDb = tenantArg !== -1 ? process.argv[tenantArg + 1] : null

if (tenantDb) {
  console.log(`\nchecking tenant database ${tenantDb}\n`)
  const dotenv = require(path.join(ROOT, 'node_modules/dotenv'))
  dotenv.config({ path: path.join(ROOT, '.env') })
  const mysql = require(path.join(ROOT, 'node_modules/mysql2/promise'))
  const { DecryptString } = require(path.join(ROOT, 'subscription/src/util/cryptography.util'))

  const checkTenant = async () => {
    const connection = await mysql.createConnection({
      host: process.env._HOST_ADMIN,
      user: process.env._USER_ADMIN,
      password: DecryptString(process.env._PASSWORD_ADMIN),
      database: tenantDb,
    })

    const [rows] = await connection.query(
      'SELECT DISTINCT mra_name FROM master_route_access',
    )
    const inDb = new Set(rows.map((r) => r.mra_name))

    const missingRows = catalog.ALL_MODULES.filter((c) => !inDb.has(c))
    ok(
      'every catalog module has a master_route_access row',
      missingRows.length === 0,
      missingRows,
    )

    const staleTypo = [...inDb].filter((c) => c === 'witholding_tax')
    ok(
      'legacy witholding_tax rows have been migrated away',
      staleTypo.length === 0,
      'run migration 20260826090000-normalize-module-codes',
    )

    await connection.end()
  }

  checkTenant().catch((e) => {
    console.error(`  FAIL  could not read ${tenantDb}: ${e.message}`)
    process.exitCode = 1
  })
}

console.log(`\n${fail === 0 ? 'all module registry checks passed' : `${fail} check(s) failed`}`)
process.exit(fail === 0 ? 0 : 1)