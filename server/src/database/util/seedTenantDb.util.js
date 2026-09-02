/**
 * Run Sequelize seeders for a specific tenant database.
 *
 * Usage:
 *   npm run db:seed:tenant -- <tenant_db_name>
 */
'use strict'

require('dotenv').config()

const { execSync } = require('child_process')
const { logger } = require('../../util/logger.util')

const getTenantDbFromArgs = () => {
  const raw = process.argv.slice(2)
  const dbEq = raw.find((arg) => arg.startsWith('--db='))
  if (dbEq) return dbEq.split('=').slice(1).join('=').trim() || null

  const dbIndex = raw.findIndex((arg) => arg === '--db')
  if (dbIndex >= 0) return raw[dbIndex + 1]?.trim() || null

  return raw[0]?.trim() || null
}

;(async () => {
  const tenantDb = getTenantDbFromArgs()

  if (!tenantDb) {
    console.error(
      'Missing tenant database name.\n\nUsage: npm run db:seed:tenant -- <tenant_db_name>\n',
    )
    process.exit(1)
  }

  const originalDb = process.env._DATABASE_ADMIN
  process.env._DATABASE_ADMIN = tenantDb

  try {
    logger.info(`Running seeders for tenant DB: ${tenantDb}`)
    execSync('npx sequelize-cli db:seed:all', {
      stdio: 'inherit',
      env: process.env,
      cwd: process.cwd(),
    })
    logger.info(`Tenant seeding complete: ${tenantDb}`)
  } catch (error) {
    logger.error(`Tenant seeding failed for ${tenantDb}`, error)
    process.exitCode = 1
  } finally {
    process.env._DATABASE_ADMIN = originalDb
  }
})()
