'use strict'
/**
 * Idempotent apply of the accounting-periods schema + journal-lock trigger to
 * the base DB and every tenant DB. Uses raw SQL only (no sequelize-cli, no
 * migration.up()) so it is safe to re-run: all CREATE are guarded by
 * information_schema probes / IF NOT EXISTS / DROP-then-CREATE for the trigger.
 *
 * Bypasses the migration file entirely because its trigger SQL proved unreliable
 * on disk. The trigger is defined inline here in ASCII-clean form.
 *
 * Usage (server workdir, root .env injected):
 *   node --env-file="D:\5L_SYSTEMS\accounting_system\.env" src\util\applyAccountingPeriods.runner.js
 */
const path = require('path')
const mysql = require('mysql2/promise')
let DecryptString

;(async () => {
  require('dotenv').config({
    path: 'D:\\5L_SYSTEMS\\accounting_system\\.env',
    quiet: true,
  })
  // eslint-disable-next-line global-require
  ;({ DecryptString } = require('./cryptography.util'))

  const base = {
    host: process.env._HOST_ADMIN,
    user: process.env._USER_ADMIN,
    password: DecryptString(process.env._PASSWORD_ADMIN || ''),
    database: process.env._DATABASE_ADMIN,
  }
  if (!base.host || !base.database) throw new Error('Missing admin env (host/database)')

  const TRIGGER_NAME = 'trg_journal_entries_period_lock'

  const PERIOD_DDL = [
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
    const [[row]] = await conn.query(
      `SELECT COUNT(*) AS c FROM information_schema.statistics
       WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ?`,
      [table, name],
    )
    if (Number(row.c) > 0) return false
    const uniq = unique ? 'UNIQUE ' : ''
    await conn.query(
      `ALTER TABLE \`${table}\` ADD ${uniq}INDEX \`${name}\` (\`${col}\`)`,
    )
    return true
  }

  const TRIGGER_SQL = [
    `DROP TRIGGER IF EXISTS \`${TRIGGER_NAME}\``,
    `CREATE TRIGGER \`${TRIGGER_NAME}\`
     BEFORE INSERT ON journal_entries
     FOR EACH ROW
     BEGIN
       DECLARE v_period_status VARCHAR(20) DEFAULT NULLTransform;
       IF NEW.je_date IS NOT NULL AND NEW.je_date != '' THEN
         SELECT ap_status INTO v_period_status
         FROM accounting_periods
         WHERE ap_period = DATE_FORMAT(STR_TO_DATE(NEW.je_date, '%Y-%m-%d'), '%Y-%m')
         LIMIT 1;
       END IF;
       IF v_period_status IS NOT NULL AND v_period_status IN ('SOFT_CLOSED','CLOSED','LOCKED') THEN
         SIGNAL SQLSTATE '45000'
           SET MESSAGE_TEXT = CONCAT(
             'Journal posting blocked: accounting period ',
             DATE_FORMAT(STR_TO_DATE(NEW.je_date, '%Y-%m-%d'), '%Y-%m'),
             ' is ',
             v_period_status,
             '. Post to an open period instead.'
           );
       END IF;
     END`,
  ]

  // Raw version (no backslash mangles): single-line safe body
  const TRIGGER_SQL_RAW =
    'DROP TRIGGER IF EXISTS `' + TRIGGER_NAME + '`'
  const TRIGGER_CREATE =
    'CREATE TRIGGER `' + TRIGGER_NAME + '` BEFORE INSERT ON journal_entries ' +
    'FOR EACH ROW BEGIN ' +
    'DECLARE v_period_status VARCHAR(20) DEFAULT NULL; ' +
    'IF NEW.je_date IS NOT NULL AND NEW.je_date != \'\' THEN ' +
    'SELECT ap_status INTO v_period_status FROM accounting_periods ' +
    'WHERE ap_period = DATE_FORMAT(STR_TO_DATE(NEW.je_date, \'%Y-%m-%d\'), \'%Y-%m\') ' +
    'LIMIT 1; ' +
    'END IF; ' +
    'IF v_period_status IS NOT NULL AND v_period_status IN (\'SOFT_CLOSED\',\'CLOSED\',\'LOCKED\') THEN ' +
    'SIGNAL SQLSTATE \'45000\' SET MESSAGE_TEXT = CONCAT(' +
    '\'Journal posting blocked: accounting period \',' +
    'DATE_FORMAT(STR_TO_DATE(NEW.je_date, \'%Y-%m-%d\'), \'%Y-%m\'),' +
    '\' is \',v_period_status,' +
    '\'. Post to an open period instead.\'); ' +
    'END IF; ' +
    'END'

  const applyOne = async (database) => {
    const cfg = { ...base, database, multipleStatements: true }
    const conn = await mysql.createConnection(cfg)
    try {
      for (const ddl of PERIOD_DDL) await conn.query(ddl)

      // fiscal year code unique (idempotent)
      await ensureIndex(conn, 'accounting_fiscal_years', 'afy_code', 'uqx_accounting_fiscal_years_code', true)
      // periods: period unique + status + fiscal year id indexes
      await ensureIndex(conn, 'accounting_periods', 'ap_period', 'uqx_accounting_periods_period', true)
      await ensureIndex(conn, 'accounting_periods', 'ap_status', 'idx_accounting_periods_status', false)
      await ensureIndex(conn, 'accounting_periods', 'ap_fiscal_year_id', 'idx_accounting_periods_fiscal_year_id', false)

      // Trigger: drop then recreate = always latest, idempotent
      await conn.query(TRIGGER_SQL_RAW)
      await conn.query(TRIGGER_CREATE)

      // Record in SequelizeMeta (idempotent)
      await conn.query(
        `CREATE TABLE IF NOT EXISTS SequelizeMeta (
           name VARCHAR(255) NOT NULL PRIMARY KEY,
           createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
           updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
         )`,
      )
      const MIGRATION_NAME = '20260922090001-create-accounting_periods.js'
      await conn.query('INSERT IGNORE INTO SequelizeMeta (name) VALUES (?)', [MIGRATION_NAME])

      const [[trg]] = await conn.query(
        `SELECT COUNT(*) AS c FROM information_schema.triggers
         WHERE trigger_schema = DATABASE() AND trigger_name = ?`,
        [TRIGGER_NAME],
      )
      console.log(`✅ ${database}: tables+trigger OK (trigger=${Number(trg.c) === 1 ? 'present' : 'MISSING'})`)
      return { database, ok: true, trigger: Number(trg.c) }
    } catch (error) {
      console.error(`❌ ${database}: ${error.message}`)
      return { database, ok: false, error: error.message }
    } finally {
      await conn.end().catch(() => {})
    }
  }

  const listTenants = async () => {
    const conn = await mysql.createConnection({ ...base, multipleStatements: true })
    try {
      const conn0 = await mysql.createConnection({ ...base, database: base.database, multipleStatements: true })
      const [rows] = await conn0.query(
        `SELECT DISTINCT db_name FROM master_user WHERE db_name IS NOT NULL AND db_name <> ''`,
      )
      await conn0.end()
      return (rows || []).map((r) => r.db_name).filter(Boolean)
    } finally {
      await conn.end().catch(() => {})
    }
  }

  const bases = process.argv.slice(2)
  const targets = bases.length ? bases : [base.database, ...(await listTenants())]
  console.log(`Targets: ${targets.join(', ')}`)
  const results = []
  for (const db of targets) results.push(await applyOne(db))
  const ok = results.filter((r) => r.ok).length
  const bad = results.filter((r) => !r.ok)
  console.log(`\n=== ${ok} OK, ${bad.length} failed ===`)
  if (bad.length) {
    bad.forEach((r) => console.log(`  ❌ ${r.database}: ${r.error}`))
    process.exit(1)
  }
  process.exit(0)
})().catch((e) => {
  console.error('Runner fatal:', e)
  process.exit(1)
})
