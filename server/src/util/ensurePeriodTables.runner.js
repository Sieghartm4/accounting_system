'use strict'
/* Idempotent apply for accounting-period storage tables (NO trigger — locking
 * happens in the UI/front-end). Safe to re-run: CREATE ... IF NOT EXISTS and
 * index creation guarded by information_schema probes, and any legacy
 * trg_journal_*_period_lock / trg_journal_entries_* trigger is dropped.
 * Usage (server workdir, root .env injected):
 *   node --env-file="D:\5L_SYSTEMS\accounting_system\.env" src\util\ensurePeriodTables.runner.js [db ...]
 */
require('dotenv').config({
  path: 'D:\\5L_SYSTEMS\\accounting_system\\.env',
  quiet: true,
})
const mysql = require('mysql2/promise')
const { DecryptString } = require('./cryptography.util')

const connBase = () => ({
  host: process.env._HOST_ADMIN || process.env._HOST_SUBSCRIPTION2,
  user: process.env._USER_ADMIN || process.env._USER_SUBSCRIPTION2,
  password: DecryptString(
    process.env._PASSWORD_ADMIN || process.env._PASSWORD_SUBSCRIPTION2 || '',
  ),
  multipleStatements: true,
})

const dbNameOf = () =>
  process.env._DATABASE_ADMIN || process.env._DATABASE_SUBSCRIPTION2 || 'subscription2'

const DDL = [
  `CREATE TABLE IF NOT EXISTS accounting_fiscal_years (
     afy_id INT NOT NULL AUTO_INCREMENT,
     afy_code VARCHAR(20) NOT NULL,
     afy_name VARCHAR(120) NOT NULL,
     afy_start_date VARCHAR(20) NOT NULL,
     afy_end_date VARCHAR(20) NOT NULL,
     afy_status ENUM('ACTIVE','INACTIVE','ARCHIVED') NOT NULL DEFAULT 'ACTIVE',
     afy_is_current BOOLEAN NOT NULL DEFAULT FALSE,
     afy_created_date VARCHAR(30) NULL,
     afy_created_by VARCHAR(300) NULL,
     afy_updated_date VARCHAR(30) NULL,
     afy_updated_by VARCHAR(300) NULL,
     PRIMARY KEY (afy_id)
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS accounting_periods (
     ap_id INT NOT NULL AUTO_INCREMENT,
     ap_fiscal_year_id INT NOT NULL,
     ap_period VARCHAR(7) NOT NULL,
     ap_year INT NOT NULL,
     ap_month INT NOT NULL,
     ap_start_date VARCHAR(20) NOT NULL,
     ap_end_date VARCHAR(20) NOT NULL,
     ap_status ENUM('OPEN','SOFT_CLOSED','CLOSED','LOCKED') NOT NULL DEFAULT 'OPEN',
     ap_opened_date VARCHAR(30) NULL,
     ap_opened_by VARCHAR(300) NULL,
     ap_soft_closed_date VARCHAR(30) NULL,
     ap_soft_closed_by VARCHAR(300) NULL,
     ap_closed_date VARCHAR(30) NULL,
     ap_closed_by VARCHAR(300) NULL,
     ap_locked_date VARCHAR(30) NULL,
     ap_locked_by VARCHAR(300) NULL,
     ap_reopened_date VARCHAR(30) NULL,
     ap_reopened_by VARCHAR(300) NULL,
     ap_reopen_reason TEXT NULL,
     ap_created_date VARCHAR(30) NULL,
     ap_created_by VARCHAR(300) NULL,
     ap_updated_date VARCHAR(30) NULL,
     ap_updated_by VARCHAR(300) NULL,
     PRIMARY KEY (ap_id)
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
]

const ensureIndex = async (conn, table, col, name, unique) => {
  const [[{ c }]] = await conn.query(
    `SELECT COUNT(*) AS c FROM information_schema.statistics
     WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ?`,
    [table, name],
  )
  if (Number(c) > 0) return false
  await conn.query(`ALTER TABLE \`${table}\` ADD ${unique ? 'UNIQUE ' : ''}INDEX \`${name}\` (\`${col}\`)`)
  return true
}

const apply = async (database) => {
  const conn = await mysql.createConnection({ ...connBase(), database })
  try {
    for (const ddl of DDL) await conn.query(ddl)
    await ensureIndex(conn, 'accounting_periods', 'ap_period', 'uqx_accounting_periods_period', true)
    await ensureIndex(conn, 'accounting_periods', 'ap_fiscal_year_id', 'idx_accounting_periods_fiscal_year_id', false)
    await ensureIndex(conn, 'accounting_periods', 'ap_status', 'idx_accounting_periods_status', false)
    await ensureIndex(conn, 'accounting_fiscal_years', 'afy_code', 'uqx_accounting_fiscal_years_code', true)

    /* Legacy trigger cleanup — UI does the locking, so any DB trigger must go. */
    const known = [
      'trg_journal_entries_period_lock',
      'trg_journal_entries_period_lock',
      'trg_journal_entries_period_lock_old',
      'trg_accounting_periods_period_lock',
      'trg_journal_entries',
      'trg_journal_entries_before_insert',
    ]
    for (const name of known) {
      await conn.query(`DROP TRIGGER IF EXISTS \`${name}\``).catch(() => {})
    }

    const [[triggers]] = await conn.query(
      `SELECT GROUP_CONCAT(trigger_name) AS names FROM information_schema.triggers
       WHERE trigger_schema = DATABASE() AND trigger_name LIKE 'trg_%period%'`,
    )
    if (triggers && triggers.names) {
      const names = String(triggers.names).split(',')
      for (const name of names) {
        // eslint-disable-next-line no-await-in-loop
        await conn.query(`DROP TRIGGER IF EXISTS \`${name}\``).catch(() => {})
      }
    }

    const [[{ c }]] = await conn.query(
      `SELECT COUNT(*) AS c FROM information_schema.tables
       WHERE table_schema = DATABASE() AND table_name IN ('accounting_fiscal_years','accounting_periods')`,
    )
    const ok = Number(c) === 2
    const tname =
      (await (async () => {
        const [[r]] = await conn.query(
          `SELECT COUNT(*) AS c FROM information_schema.triggers WHERE trigger_schema = DATABASE() AND trigger_name LIKE 'trg_%period%'`,
        )
        return Number(r.c)
      })()) === 0
        ? 'clean'
        : 'TRIGGERS REMAIN'
    console.log(`${ok ? 'OK  ' : 'FAIL'} ${database}: tables=${Number(c) === 2 ? '2/2' : c} triggers=${tname}`)
    return ok
  } finally {
    await conn.end().catch(() => {})
  }
}

const listTenants = async () => {
  const conn = await mysql.createConnection(connBase())
  try {
    const [rows] = await conn.query(
      `SELECT DISTINCT db_name FROM master_user WHERE db_name IS NOT NULL AND db_name <> ''`,
    )
    return (rows || []).map((r) => r.db_name).filter(Boolean)
  } finally {
    await conn.end().catch(() => {})
  }
}

;(async () => {
  const argv = process.argv.slice(2)
  const targets = argv.length
    ? argv
    : [dbNameOf(), ...(await listTenants().catch(() => []))]
  const base = dbNameOf()
  const dbList = [...new Set([base, ...targets])]
  const results = []
  for (const db of dbList) results.push([db, await apply(db)])
  const bad = results.filter(([, ok]) => !ok)
  console.log(`\n=== ${results.length - bad.length}/${results.length} OK ===`)
  if (bad.length) {
    bad.forEach(([db]) => console.log(`  ❌ ${db}`))
    process.exit(1)
  }
  process.exit(0)
})().catch((e) => {
  console.error('fatal:', e.message)
  process.exit(1)
})
