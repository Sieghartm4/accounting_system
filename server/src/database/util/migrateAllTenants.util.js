/**
 * Run Sequelize migrations for all tenant databases recorded in the subscription/admin DB.
 *
 * Usage:
 *   node src/database/util/migrateAllTenants.util.js
 */
'use strict'

require('dotenv').config()
const mysql = require('mysql2/promise')
const { execSync } = require('child_process')
const { logger } = require('../../util/logger.util')
const { DecryptString } = require('../../util/cryptography.util')

;(async () => {
  const host = process.env._HOST_ADMIN
  const user = process.env._USER_ADMIN
  let password
  try {
    password = DecryptString(process.env._PASSWORD_ADMIN)
  } catch (err) {
    logger.warn('Failed to decrypt _PASSWORD_ADMIN, falling back to raw env value')
    password = process.env._PASSWORD_ADMIN
  }
  const database = process.env._DATABASE_ADMIN

  if (!host || !user || !database) {
    console.error('Missing admin DB connection environment variables')
    process.exit(1)
  }

  if (!password) {
    logger.warn('Admin DB password is empty; migrations may fail')
  }

  let connection
  try {
    connection = await mysql.createConnection({ host, user, password, database })

    // Get distinct tenant DB names from subscription/admin table
    const [rows] = await connection.query(
      `SELECT DISTINCT db_name FROM master_user WHERE db_name IS NOT NULL AND db_name <> ''`,
    )

    if (!rows || rows.length === 0) {
      logger.info('No tenant DBs found in admin/master_user table')
      process.exit(0)
    }

    for (const r of rows) {
      const tenantDb = r.db_name
      if (!tenantDb) continue

      try {
        logger.info(`📦 Running migrations for tenant DB: ${tenantDb}`)
        execSync(`node src/database/util/migrateTenantDb.util.js --db=${tenantDb}`, {
          stdio: 'inherit',
          env: process.env,
          cwd: process.cwd(),
        })
      } catch (err) {
        logger.error(
          `❌ Migration failed for tenant ${tenantDb}:`,
          err.message || err,
        )
        // continue with next tenant but mark failure
        process.exitCode = 1
      }
    }

    logger.info('✅ All tenant migrations attempted')
  } catch (error) {
    logger.error('❌ Error fetching tenant DB list:', error)
    process.exitCode = 1
  } finally {
    if (connection) await connection.end()
  }
})()
