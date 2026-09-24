'use strict'
/* Trigger-only, fully idempotent reapply for the journal posting period lock.
 * Run (server workdir, root .env injected):
 *   node src/util/ensurePeriodLockTrigger.runner.js
 */
require('dotenv').config({ path: 'D:\\5L_SYSTEMS\\accounting_system\\.env', quiet: true })
const mysql = require('mysql2/promise')
const { DecryptString } = require('./cryptography.util')

const TRIGGER_NAME = 'trg_journal_entries_period_lock'

const base = {
  host: process.env._HOST_ADMIN,
  user: process.env._USER_ADMIN,
  password: DecryptString(process.env._PASSWORD_ADMIN || ''),
}

const q = String.raw`
DROP TRIGGER IF EXISTS ` + '`' + TRIGGER_NAME + '`' + String.raw`;
CREATE TRIGGER ` + '`' + TRIGGER_NAME + '`' + String.raw`
BEFORE INSERT ON journal_entries
FOR EACH ROW
BEGIN
  DECLARE v_period_status VARCHAR(20);

  IF NEW.je_date IS NOT NULL AND NEW.je_date <> '' THEN
    SELECT ap_status INTO v_period_status
    FROM accounting_periods
    WHERE ap_period = DATE_FORMAT(STR_TO_DATE(NEW.je_date, '%Y-%m-%d'), '%Y-%m')
    LIMIT 1;

    IF v_period_status IS NOT NULL AND v_period_status IN ('SOFT_CLOSED', 'CLOSED', 'LOCKED') THEN
      SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = CONCAT(
          'Journal posting blocked: accounting period ',
          DATE_FORMAT(STR_TO_DATE(NEW.je_date, '%Y-%m-%d'), '%Y-%m'),
          ' is ',
          v_period_status,
          '. Record the transaction in an open period instead.'
        );
    END IF;
  END IF;
END`;

const run = async (database) => {
  const conn = await mysql.createConnection({ ...base, database, multipleStatements: true })
  try {
    await conn.query('DROP TRIGGER IF EXISTS `' + TRIGGER_NAME + '`')
    await conn.query(q)
    const [[trg]] = await conn.query(
      'SELECT COUNT(*) AS c FROM information_schema.triggers WHERE trigger_schema = DATABASE() AND trigger_name = ?',
      [TRIGGER_NAME],
    )
    console.log('OK ' + database + ': trigger=' + (Number(trg.c) === 1 ? 'present' : 'MISSING'))
    return Number(trg.c) === 1
  } finally {
    await conn.end().catch(() => {})
  }
}

;(async () => {
  const dbs = ['subscription2', 'test_accounting']
  const results = []
  for (const db of dbs) results.push([db, await run(db)])
  const bad = results.filter(([, ok]) => !ok)
  console.log('=== ' + (results.length - bad.length) + '/' + results.length + ' triggers OK ===')
  if (bad.length) process.exit(1)
})().catch((e) => {
  console.error('fatal:', e.message)
  process.exit(1)
})
