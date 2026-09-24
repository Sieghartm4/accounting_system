'use strict'
/**
 * Applies accounting_periods migrations to subscription2 + every tenant DB,
 * using a real Sequelize instance + queryInterface (no sequelize-cli needed).
 * Records entries in SequelizeMeta so the CLI's migrate-status stays consistent.
 *
 * Usage (from server dir, with ROOT .env in process env):
 *   node src/database/util/applyAccountingPeriods.runner.js
 */
require('dotenv').config({ path: 'D:\\5L_SYSTEMS\\accounting_system\\.env', quiet: true })
const path = require('path')
const mysql = require('mysql2/promise')
const { Sequelize } = require('sequelize')
const { DecryptString } = require('../../util/cryptography.util')
const { logger } = require('../../util/logger.util')

const MIGRATION_FILE =
  '20260922090001-create-accounting_periods.js'
const migrationPath = path.join(
  __dirname,
  '..',
  'migrations',
  'create',
  MIGRATION_FILE,
)
const migration = require(migrationPath)

const cfg = {
  host: process.env._HOST_ADMIN,
  user: process.env._USER_ADMIN,
  password: DecryptString(process.env._PASSWORD_ADMIN),
  dialect: 'mysql',
  multipleStatements: true,
}

const loadTenantDatabases = async () => {
  const conn = await mysql.createConnection({
    host: cfg.host,
    user: cfg.user,
    password: cfg.password,
    database: process.env._DATABASE_ADMIN,
    multipleStatements: true,
  })
  const [rows] = await conn.query(
    `SELECT DISTINCT db_name FROM master_user WHERE db_name IS NOT NULL AND db_name <> ''`,
  )
  await conn.end()
  return (rows || []).map((r) => r.db_name).filter(Boolean)
}

const applyToDatabase = async (database, sequelizeLog) => {
  if (!database) return { database, skipped: true }
  await applyToDbWithSequelize(database)
}

const applyToDbWithSequelize = async (database) => {
  const sequelize = new Sequelize(database, cfg.user, cfg.password, {
    host: cfg.host,
    dialect: 'mysql',
    logging: false,
    dialectOptions: { multipleStatements: true },
  })
  try {
    await sequelize.authenticate()
    const qi = sequelize.getQueryInterface()

    // create SequelizeMeta if missing
    await qi.sequelize.query(
      `CREATE TABLE IF NOT EXISTS SequelizeMeta (
         name VARCHAR(255) NOT NULL,
         PRIMARY KEY (name)
       ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      { type: 'RAW' },
    )

    const [[{ cnt }]] = await qi.sequelize.query(
      `SELECT COUNT(*) AS cnt FROM SequelizeMeta WHERE name = ?`,
      { replacements: [MIGRATION_FILE], type: 'SELECT' },
    )
    if (Number(cnt) > 0) {
      logger.info(`⏭️  ${database}: ${MIGRATION_FILE} already recorded`)
      return { database, applied: false, reason: 'already recorded' }
    }

    logger.info(`⬆️  ${database}: applying ${MIGRATION_FILE}`)
    await migration.up(qi, Sequelize)
    await qi.sequelize.query(`INSERT INTO SequelizeMeta (name) VALUES (?)`, {
      replacements: [MIGRATION_FILE],
      type: 'INSERT',
    })
    logger.info(`✅ ${database}: applied + recorded`)
    return { database, applied: true }
  } catch (error) {
    logger.error(`❌ ${database}: migration failed`, error)
    return { database, applied: false, error: error.message }
  } finally {
    await sequelize.close().catch(() => {})
  }
}

const main = async () => {
  const results = []
  // 1. base/admin DB (subscription2)
  results.push(await applyToDbWithSequelize(process.env._DATABASE_ADMIN))

  // 2. tenant DBs
  let tenants = []
  try {
    tenants = await loadTenantDatabases()
  } catch (error) {
    logger.warn('Could not enumerate tenants from base DB:', error.message)
  }
  for (const t of tenants) {
    results.push(await applyToDbWithSequelize(t))
  }

  const ok = results.filter((r) => r && r.applied)
  logger.info(`✅ Applied to ${ok.length}/${results.filter((r) => r && !r.skipped).length} databases`)
  if (results.some((r) => r && r.error)) {
    process.exitCode = 1
  }
}

main().catch((error) => {
  logger.error('Runner failed:', error)
  process.exit(1)
})
