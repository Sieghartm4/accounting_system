'use strict'
/**
 * Apply the accounting_periods migration (tables + trigger) to the base DB
 * and every tenant DB, using the app's own Sequelize + decrypted config.
 * Records applied file in SequelizeMeta so sequelize-cli status stays consistent.
 *
 * Run: node --env-file="..\\..\\.env" applyAccountingPeriods.runner.js
 *      (or inject root .env manually -- crypto needs _ENCRYPTION_*)
 */
require('dotenv').config({ quiet: true })
const path = require('path')
const { Sequelize } = require('sequelize')
const { getDatabaseConfig, getTenantPool } = require('../src/database/config/config')
const { DecryptString } = require('../src/util/cryptography.util')

const MIGRATION_FILE = '20260922090001-create-accounting_periods.js'
const migration = require(path.join(
  __dirname,
  '..',
  'src',
  'database',
  'migrations',
  'create',
  MIGRATION_FILE,
))

const metaTable = 'SequelizeMeta'

const applyToDb = async (database, options) => {
  const cfg = await getDatabaseConfig(options?.username || database)
  const sequelize = new Sequelize(
    cfg.database,
    cfg.username,
    cfg.password,
    {
      host: cfg.host,
      dialect: cfg.dialect || 'mysql',
      logging: false,
      dialectOptions: cfg.dialectOptions,
    },
  )
  try {
    await sequelize.authenticate()
  } catch (error) {
    console.error(`✗ Cannot connect ${database}:`, error.message)
    return { database, applied: false, reason: error.message }
  }

  const qi = sequelize.getQueryInterface()
  try {
    // ensure meta table
    await qi.createTable(metaTable, {
      name: { type: Sequelize.STRING(255), primaryKey: true, allowNull: false },
    }).catch(() => {})

    const [rows] = await sequelize.query(
      `SELECT COUNT(*) AS c FROM ${metaTable} WHERE name = ?`,
      { replacements: [MIGRATION_FILE] },
    )
    if (Number(rows[0].c) > 0) {
      console.log(`⏭️  ${database}: already applied`)
      await sequelize.close()
      return { database, applied: false, reason: 'already applied' }
    }

    await migration.up(qi, Sequelize)
    await sequelize.query(
      `INSERT INTO ${metaTable} (name, createdAt, updatedAt) VALUES (?, NOW(), NOW())`,
      { replacements: [MIGRATION_FILE] },
    )
    console.log(`✅ ${database}: accounting_periods applied`)
    await sequelize.close()
    return { database, applied: true }
  } catch (error) {
    console.error(`✗ Migration failed ${database}:`, error.message)
    await sequelize.close().catch(() => {})
    return { database, applied: false, reason: error.message }
  }
}

const listTenantDbs = async () => {
  const base = await getDatabaseConfig(process.env._DATABASE_ADMIN)
  const sequelize = new Sequelize(base.database, base.username, base.password, {
    host: base.host,
    dialect: base.dialect || 'mysql',
    logging: false,
  })
  try {
    const [rows] = await sequelize.query(
      `SELECT DISTINCT db_name FROM master_user WHERE db_name IS NOT NULL AND db_name <> ''`,
    )
    await sequelize.close()
    return rows.map((r) => r.db_name)
  } catch (error) {
    console.error('✗ Cannot list tenants:', error.message)
    await sequelize.close().catch(() => {})
    return []
  }
}

;(async () => {
  const results = []
  results.push(await applyToDb(process.env._DATABASE_ADMIN))
  const tenants = await listTenantDbs()
  for (const t of tenants) {
    results.push(await applyToDb(t))
  }
  const ok = results.filter((r) => r.applied).length
  console.log(`\n=== Done. ${ok}/${results.length} databases applied accounting_periods ===`)
  process.exit(results.some((r) => r.applied === false && r.reason !== 'already applied') ? 1 : 0)
})()
