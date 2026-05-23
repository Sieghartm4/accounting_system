/**
 * Run Sequelize migrations for a specific tenant database.
 *
 * Usage:
 *   npm run db:migrate:tenant -- <tenant_db_name>
 *
 * Example:
 *   npm run db:migrate:tenant -- 5lsolutions_accounting
 */
'use strict'

require('dotenv').config()

const { execSync } = require('child_process')
const { logger } = require('../../util/logger.util')

const getTenantDbFromArgs = () => {
  const raw = process.argv.slice(2)
  if (raw.length === 0) return null

  // Support:
  //  - "dbName"
  //  - "--db=dbName"
  //  - "--db", "dbName"
  const dbEq = raw.find((a) => a.startsWith('--db='))
  if (dbEq) return dbEq.split('=').slice(1).join('=').trim() || null

  const dbIndex = raw.findIndex((a) => a === '--db')
  if (dbIndex >= 0) return raw[dbIndex + 1]?.trim() || null

  // fallback: first positional argument
  return raw[0]?.trim() || null
}

;(async () => {
  const tenantDb = getTenantDbFromArgs()

  if (!tenantDb) {
    // Keep this plain console output (this script is used from CLI).
    // eslint-disable-next-line no-console
    console.error(
      "Missing tenant database name.\n\nUsage: npm run db:migrate:tenant -- <tenant_db_name>\nExample: npm run db:migrate:tenant -- 5lsolutions_accounting\n",
    )
    process.exit(1)
  }

  const originalDb = process.env._DATABASE_ADMIN
  process.env._DATABASE_ADMIN = tenantDb

  try {
    logger.info(`📦 Running migrations for tenant DB: ${tenantDb}`)

    execSync('npx sequelize-cli db:migrate', {
      stdio: 'inherit',
      env: process.env,
      cwd: process.cwd(),
    })

    logger.info(`🔄 Generating models for tenant DB: ${tenantDb}`)
    execSync('node src/database/util/generateModels.util.js', {
      stdio: 'inherit',
      env: process.env,
      cwd: process.cwd(),
    })

    logger.info(`✅ Tenant migrations complete: ${tenantDb}`)
  } catch (error) {
    logger.error(`❌ Tenant migration failed for ${tenantDb}`, error)
    process.exitCode = 1
  } finally {
    process.env._DATABASE_ADMIN = originalDb
  }
})()

