'use strict'
/**
 * Idempotent per-DB accounting-periods setup, run through the app's OWN
 * mysql2 + DecryptString stack (no sequelize-cli process boundary).
 * Ensures: accounting_fiscal_years + accounting_periods tables exist, the
 * fail-open BEFORE INSERT trigger on journal_entries exists, and the migration
 * file is recorded in SequelizeMeta so migrate:status stays consistent.
 *
 * Run (server workdir, root .env injected):
 *   node --env-file="D:\5L_SYSTEMS\accounting_system\.env" \
 *        src/util/fixAccountingPeriods.runner.js [dbNames...]
 */
require('dotenv').config({ quiet: true })
const mysql = require('mysql2/promise')
const { DecryptString } = require('./cryptography.util')

const MIGRATION_NAME = '20260922090001-create-accounting_periods.js'

const TRIGGER_NAME = 'trg_journal_entries_period_lock'
const TRIGGER_SQL = `
CREATE TRIGGER \`${TRIGGER_NAME}\`
BEFORE INSERT ON journal_entries
FOR EACH ROW
BEGIN
  DECLARE v_period_status VARCHAR(32) DEFAULT NULL;

  IF NEW.je_date IS NOT NULL AND NEW.je_date != '' THEN
    SELECT ap_status INTO v_period_status
    FROM accounting_periods
    WHERE ap_period = DATE_FORMAT(STR_TO_DATE(NEW.je_date, '%Y-%m-%d'), '%Y-%m')
    LIMIT 1;

    IF v_period_status IS NOT NULL
       AND v_period_status IN ('SOFT_CLOSED', 'CLOSED', 'LOCKED') THEN
      SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = CONCAT(
          'Journal posting blocked: accounting period ',
          DATE_FORMAT(STR_TO_DATE(NEW.je_date, '%Y-%m-%d'), '%Y-%m'),
          ' is ',
          v_period_status,
          '. Post to an open period or reopen this period.'
        );
    END IF;
  END IF;
END
`

const baseCfg = () => ({
  host: process.env._HOST_ADMIN,
  user: process.env._USER_ADMIN,
  password: DecryptString(process.env._PASSWORD_ADMIN),
  database: process.env._DATABASE_ADMIN,
  multipleStatements: true,
})

const listTenants = async () => {
  const cfg = baseCfg()
  const conn = await mysql.createConnection(cfg)
  try {
    const [rows] = await conn.query(
      'SELECT DISTINCT db_name FROM master_user WHERE db_name IS NOT NULL AND db_name <> \'\'',
    )
    return (rows || []).map((r) => r.db_name).filter(Boolean)
  } finally {
    await conn.end()
  }
}

const ensureDatabase = async (dbName, log = true) => {
  const cfg = { ...baseCfg(), database: dbName }
  const conn = await mysql.createConnection(cfg)
  try {
    // 1. Ensure meta table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS SequelizeMeta (
        name VARCHAR(255) NOT NULL PRIMARY KEY,
        createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB
    `)

    // 2. Ensure tables
    for (const ddl of [
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
         PRIMARY KEY (afy_id),
         UNIQUE KEY uqx_accounting_fiscal_years_code (afy_code)
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
         PRIMARY KEY (ap_id),
         UNIQUE KEY uqx_accounting_periods_period (ap_period),
         KEY idx_accounting_periods_fiscal_year_id (ap_fiscal_year_id),
         KEY idx_accounting_periods_status (ap_status),
         CONSTRAINT fk_accounting_periods_fiscal_year
           FOREIGN KEY (ap_fiscal_year_id) REFERENCES accounting_fiscal_years (afy_id)
           ON DELETE CASCADE
       ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    ]) {
      await conn.query(ddl)
    }

    // 3. Ensure trigger (drop + recreate = idempotent, always latest)
    await conn.query(`DROP TRIGGER IF EXISTS \`${TRIGGER_NAME}\``)
    await conn.query(TRIGGER_SQL)

    // 4. Record migration meta (idempotent)
    await conn.query(
      `INSERT IGNORE INTO SequelizeMeta (name, createdAt, updatedAt) VALUES (?, NOW(), NOW())`,
      [MIGRATION_NAME],
    )

    const [[tbl]] = await conn.query(
      `SELECT COUNT(*) AS c FROM information_schema.tables
       WHERE table_schema = DATABASE() AND table_name IN ('accounting_fiscal_years','accounting_periods')`,
    )
    const [[trg]] = await conn.query(
      `SELECT COUNT(*) AS c FROM information_schema.triggers
       WHERE trigger_schema = DATABASE() AND trigger_name = ?`,
      [TRIGGER_NAME],
    )
    if (log) {
      console.log(`✅ ${dbName}: tables=${tbl.c}, trigger=${Number(trg.c) === 1 ? 'OK' : 'MISSING'}`)
    }
    return { dbName, tables: tbl.c, trigger: Number(trg.c) }
  } finally {
    await conn.end()
  }
}

const main = async () => {
  const targets = process.argv.slice(2)
  const all = targets.length ? targets : [baseCfg().database, ...(await listTenants())]
  const out = []
  for (const db of all) {
    try {
      out.push(await ensureDatabase(db))
    } catch (e) {
      console.error(`❌ ${db}: ${e.message}`)
      out.push({ dbName: db, tables: -1, trigger: -1 })
    }
  }
  console.log(`\n=== ${out.filter((o) => o.triggger === 1).length}/${out.length} triggers OK ===`)
  if (out.some((o) => o.trigger !== 1)) process.exitCode = 1
}

main().catch((e) => {
  console.error('Runner fatal:', e)
  process.exit(1)
})
