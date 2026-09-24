'use strict'
/* Idempotent trigger-only apply (DROP-then-CREATE) using an ASCII-safe
 * Base64-encoded trigger body so no heredoc/quoting can ever corrupt it.
 * Run (server workdir, root .env injected):
 *   node --env-file="D:\5L_SYSTEMS\accounting_system\.env" src\util\ensurePeriodLock.runner.js
 */
require('dotenv').config({ path: 'D:\\5L_SYSTEMS\\accounting_system\\.env', quiet: true })
const mysql = require('mysql2/promise')
const { DecryptString } = require('./cryptography.util')

const TRIGGER_SQL_B64 =
  'Q1JFQVRFIFRSSUdHRVIgYHRyZ19qb3VybmFsX2VudHJpZXNfcGVyaW9kX2xvY2tgCkJFRk9SRSBJTlNFUlQgT04gam91cm5hbF9lbnRyaWVzCkZPUiBFQUNIIFJPVwpCRUdJTgogIERFQ0xBUkUgdl9zdGF0dXMgVkFSQ0hBUigyMCk7CgogIElGIE5FVy5qZV9kYXRlIElTIE5PVCBOVUxMIEFORCBORVcuamVfZGF0ZSA8PiAnJyBUSEVOCiAgICBTRUxFQ1QgYXBfc3RhdHVzIElOVE8gdl9zdGF0dXMKICAgIEZST00gYWNjb3VudGluZ19wZXJpb2RzCiAgICBXSEVSRSBhcF9wZXJpb2QgPSBEQVRFX0ZPUk1BVChTVFJfVE9fREFURShORVcuamVfZGF0ZSwgJyVZLSVtLSVkJyksICclWS0lbScpCiAgICBMSU1JVCAxOwogIEVORCBJRjsKCiAgSUYgdl9zdGF0dXMgSVMgTk9UIE5VTEwgQU5EIHZfc3RhdHVzIElOICgnU09GVF9DTE9TRUQnLCAnQ0xPU0VEJywgJ0xPQ0tFRCcpIFRIRU4KICAgIFNJR05BTCBTUUxTVEFURSAnNDUwMDAnCiAgICAgIFNFVCBNRVNTQUdFX1RFWFQgPSBDT05DQVQoCiAgICAgICAgJ0pvdXJuYWwgcG9zdGluZyBibG9ja2VkOiBhY2NvdW50aW5nIHBlcmlvZCAnLAogICAgICAgIERBVEVfRk9STUFUKFNUUl9UT19EQVRFKE5FVy5qZV9kYXRlLCAnJVktJW0tJWQnKSwgJyVZLSVtJyksCiAgICAgICAgJyBpcyAnLAogICAgICAgIHZfc3RhdHVzLAogICAgICAgICcuIFJlY29yZCB0aGUgdHJhbnNhY3Rpb24gaW4gYW4gb3BlbiBwZXJpb2QgaW5zdGVhZC4nCiAgICAgICk7CiAgRU5EIElGOwpFTkQ='

const apply = async (database) => {
  const conn = await mysql.createConnection({
    host: process.env._HOST_ADMIN,
    user: process.env._USER_ADMIN,
    password: DecryptString(process.env._PASSWORD_ADMIN || ''),
    database,
    multipleStatements: true,
  })
  try {
    const sql = Buffer.from(TRIGGER_SQL_B64, 'base64').toString('utf8')
    const target = 'trg_journal_entries_period_lock'
    await conn.query(`DROP TRIGGER IF EXISTS \`${target}\``)
    await conn.query(sql)
    const [[row]] = await conn.query(
      'SELECT COUNT(*) AS c FROM information_schema.triggers WHERE trigger_schema = DATABASE() AND trigger_name = ?',
      [target],
    )
    const ok = Number(row.c) === 1
    console.log(`${ok ? 'OK  ' : 'FAIL'} ${database}: trigger=${ok ? 'present' : 'MISSING'}`)
    return ok
  } finally {
    await conn.end().catch(() => {})
  }
}

;(async () => {
  const pools = process.argv.slice(2)
  const targets = pools.length ? pools : ['subscription2', 'test_accounting']
  const results = []
  for (const db of targets) results.push([db, await apply(db)])
  const bad = results.filter(([, ok]) => !ok).map(([db]) => db)
  console.log(`\n=== ${results.length - bad.length}/${results.length} triggers OK ===`)
  if (bad.length) {
    console.log(`Failed: ${bad.join(', ')}`)
    process.exit(1)
  }
  process.exit(0)
})().catch((e) => {
  console.error('fatal:', e.message)
  process.exit(1)
})
