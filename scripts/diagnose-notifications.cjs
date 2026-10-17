/**
 * Why receipts were producing no notifications.
 *
 * Hypothesis: the notification service calls Query() without a tenant pool, so
 * every read and write lands on getTenantPool()'s process-global fallback rather
 * than the tenant that owns the receipt. That is both why user 2 saw nothing and
 * why it would be non-deterministic under concurrent tenants.
 *
 * This checks three things:
 *   1. does getTenantPool() with no argument even pick a tenant?
 *   2. do notification rows exist in any tenant database?
 *   3. does master_user carry the db_name the recipient query filters on?
 */
'use strict'

process.chdir(require('path').join(__dirname, '..', 'server'))
require('dotenv').config({ path: '../.env' })

const SRV = require('path').join(__dirname, '..', 'server')
const { getTenantPool } = require(SRV + '/src/database/util/tenantConnection.util')

const dbs = [
  'accounting_system', 'facebook_accounting', '5lsolutions_accounting',
  'sample_accounting', 'yabaiyabai07_accounting', 'test_accounting',
]

;(async () => {
  console.log('\n1. what does getTenantPool() pick with no argument?')
  try {
    const pool = getTenantPool()
    const cfg = require(SRV + '/src/config/config.util')
    console.log('   override      :', cfg.getTenantDbOverride ? cfg.getTenantDbOverride() : '(no override)')
    console.log('   default db    :', cfg[process.env.NODE_ENV || 'development'].database)
    console.log('   -> pool resolved without a tenant argument')
  } catch (e) {
    console.log('   ERROR', e.message)
  }

  console.log('\n2. where do notification rows actually live?')
  let total = 0
  for (const db of dbs) {
    let pool
    try { pool = getTenantPool(db) } catch { continue }
    try {
      const [t] = await pool.query(
        `SELECT COUNT(*) c FROM information_schema.tables
          WHERE table_schema = ? AND table_name = 'notifications'`, [db])
      if (!t[0].c) { console.log(`   ${db.padEnd(24)} (no notifications table)`); continue }
      const [[r]] = await pool.query('SELECT COUNT(*) c FROM notifications')
      total += Number(r.c)
      console.log(`   ${db.padEnd(24)} ${String(r.c).padStart(3)} row(s)`)
    } catch (e) {
      console.log(`   ${db.padEnd(24)} ERROR ${e.message.slice(0, 60)}`)
    }
  }
  console.log(`   total rows across all tenants: ${total}`)

  console.log('\n3. does master_user.db_name match the recipient filter?')
  for (const db of dbs.slice(1)) {
    let pool
    try { pool = getTenantPool(db) } catch { continue }
    try {
      const [[t]] = await pool.query(
        `SELECT COUNT(*) c FROM information_schema.tables
          WHERE table_schema = ? AND table_name = 'master_user'`, [db])
      if (!t.c) { console.log(`   ${db.padEnd(24)} (no master_user)`); continue }
      const [[r]] = await pool.query(
        `SELECT COUNT(*) total,
                SUM(CASE WHEN mu_status = 'active' THEN 1 ELSE 0 END) active,
                SUM(CASE WHEN mu_db_name = ? THEN 1 ELSE 0 END) matching
           FROM master_user`, [db])
      console.log(`   ${db.padEnd(24)} total=${r.total} active=${r.active || 0} db_name='${db}'=${r.matching || 0}`)
    } catch (e) {
      console.log(`   ${db.padEnd(24)} ERROR ${e.message.slice(0, 60)}`)
    }
  }

  console.log('\n4. companies per tenant (the LIMIT 1 fallback picks an arbitrary one)')
  for (const db of dbs.slice(1)) {
    let pool
    try { pool = getTenantPool(db) } catch { continue }
    try {
      const [[r]] = await pool.query('SELECT COUNT(*) c FROM master_company')
      console.log(`   ${db.padEnd(24)} ${r.c} company(ies)`)
    } catch (e) {
      console.log(`   ${db.padEnd(24)} ERROR ${e.message.slice(0, 60)}`)
    }
  }
  process.exit(0)
})()