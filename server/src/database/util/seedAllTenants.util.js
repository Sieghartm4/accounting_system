/**
 * Run Sequelize seeders for all tenant databases recorded in the admin DB.
 *
 * Usage:
 *   node src/database/util/seedAllTenants.util.js
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
  const database = process.env._DATABASE_ADMIN
  let password

  try {
    password = DecryptString(process.env._PASSWORD_ADMIN)
  } catch (error) {
    logger.warn('Failed to decrypt _PASSWORD_ADMIN, falling back to raw env value')
    password = process.env._PASSWORD_ADMIN
  }

  if (!host || !user || !database) {
    console.error('Missing admin DB connection environment variables')
    process.exit(1)
  }

  let connection
  try {
    connection = await mysql.createConnection({ host, user, password, database })
    const [rows] = await connection.query(
      "SELECT DISTINCT db_name FROM master_user WHERE db_name IS NOT NULL AND db_name <> ''",
    )

    if (!rows || rows.length === 0) {
      logger.info('No tenant DBs found in admin/master_user table')
      process.exit(0)
    }

    for (const row of rows) {
      const tenantDb = row.db_name
      try {
        logger.info(`Running seeders for tenant DB: ${tenantDb}`)
        execSync(`node src/database/util/seedTenantDb.util.js --db=${tenantDb}`, {
          stdio: 'inherit',
          env: process.env,
          cwd: process.cwd(),
        })
      } catch (error) {
        logger.error(`Tenant seeding failed for ${tenantDb}`, error.message || error)
        process.exitCode = 1
      }
    }

    logger.info('All tenant seeders attempted')
  } catch (error) {
    logger.error('Error fetching tenant DB list:', error)
    process.exitCode = 1
  } finally {
    if (connection) await connection.end()
  }
})()
