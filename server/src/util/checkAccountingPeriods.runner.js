'use strict'
// Check whether accounting_fiscal_years / accounting_periods exist (and the
// trigger) on the base DB + all tenants, using the app's own working pool
// layer. Usage (server workdir, root .env injected):
//   node --env-file="D:\\5L_SYSTEMS\\accounting_system\\.env" src/util/checkAccountingPeriods.runner.js
require('dotenv').config({ path: path.join(__dirname, '..', '..', '..', '..', '.env'), quiet: true })
const path = require('path')
const mysql = require('mysql2/promise')
const { DecryptString } = require('../util/cryptography.util')

const cfg = {
  host: process.env._HOST_ADMIN,
  user: process.env._USER_ADMIN,
  password: DecryptString(process.env._PASSWORD_ADMIN),
  database: process.env._DATABASE_ADMIN,
}

const checkOne = async (db) => {
  const conn = await mysql.createConnection({
    host: cfg.host,
    user: cfg.user,
    password: cfg.password,
    database: db,
    multipleStatements: true,
  })
  try {
    const [tables] = await conn.query(
      `SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name IN ('accounting_fiscal_years','accounting_periods')`,
    )
    const [trg] = await conn.query(
      `SELECT COUNT(*) AS n FROM information_schema.triggers WHERE trigger_schema = DATABASE() AND trigger_name = 'trg_journal_entries_period_lock'`,
    )
    return {
      db,
      tables: Number(tables[0].n),
      trigger: Number(trg[0].n),
    }
  } finally {
    await conn.end()
  }
}

const main = async () => {
  const out = [await checkOne(cfg.database)]
  const base = await mysql.createConnection({
    host: cfg.host,
    user: cfg.user,
    password: cfg.password,
    database: cfg.database,
  })
  try {
    const [rows] = await base.query(
      `SELECT DISTINCT db_name AS db FROM master_user WHERE db_name IS NOT NULL AND db_name <> ''`,
    )
    for (const r of rows || []) {
      const db = r.db
      if (!db || db === cfg.database) continue
      try {
        out.push(await checkOne(db))
      } catch (e) {
        out.push({ db, tables: -1, trigger: -1, error: e.message })
      }
    }
  } finally {
    await base.end()
  }
  console.table(out)
  const missing = out.filter((r) => r.tables !== 2 || r.trigger !== 1)
  if (missing.length) {
    console.log(`\n⚠️  Missing on ${missing.length} DB(s):`)
    missing.forEach((m) =>
      console.log(`   - ${m.db} (tables=${m.tables}, trigger=${m.trigger})${m.error ? ' ' + m.error : ''}`),
    )
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
