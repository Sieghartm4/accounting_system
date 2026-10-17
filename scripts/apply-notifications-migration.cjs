/**
 * Runs the notifications migration against a real tenant database.
 *
 * The sequelize CLI path cannot be used here: it loads config.js from server/,
 * where there is no .env, so DecryptString gets no key and the CLI aborts before
 * it reads a single migration. That is a pre-existing environment quirk, not a
 * problem with the migration.
 *
 * So this drives the migration's own up() through a real Sequelize
 * QueryInterface pointed at a real tenant. That tests the actual SQL - types,
 * enum values, JSON column, the named indexes and the tableExists guard - rather
 * than asserting on strings.
 *
 * Usage: node scripts/apply-notifications-migration.cjs <tenantDb> [--undo]
 */
'use strict'

const path = require('path')

require('dotenv').config({ path: path.join(__dirname, '..', '.env') })
const sequelizeLib = require('sequelize')
const { Sequelize, DataTypes } = sequelizeLib

// sequelize-cli hands migrations a namespace whose `literal` is a function. The
// v6 class does not carry it as a static, so it is attached here rather than
// changing the migration to avoid a helper it shares with every other migration.
const MigrationSequelize = Sequelize
MigrationSequelize.literal = sequelizeLib.literal
const { DecryptString } = require('../server/src/util/cryptography.util')

const tenantDb = process.argv[2]
const undo = process.argv.includes('--undo')
if (!tenantDb) {
  console.log('  usage: node apply-notifications-migration.cjs <tenantDb> [--undo]')
  process.exit(1)
}

const q = (s) => (s || '').trim()
let failed = 0
const ok = (label, pass, detail) => {
  if (!pass) failed++
  console.log('  ' + (pass ? 'ok   ' : 'FAIL ') + label + (detail && !pass ? '  -> ' + detail : ''))
}

const migration = require('../server/src/database/migrations/create/20261016120000-create-notifications.js')

;(async () => {
  const sequelize = new Sequelize(tenantDb, process.env._USER_ADMIN, DecryptString(process.env._PASSWORD_ADMIN), {
    host: process.env._HOST_ADMIN,
    port: Number(process.env._PORT_ADMIN || 3306),
    dialect: 'mysql',
    logging: false,
  })

  const qi = sequelize.getQueryInterface()

  console.log('\n  applying to ' + tenantDb)
  await migration.up(qi, MigrationSequelize)

  const [tables] = await sequelize.query(
    `SELECT table_name AS t FROM information_schema.tables
      WHERE table_schema = ? AND table_name IN ('notifications','notification_reads')`,
    { replacements: [tenantDb] },
  )
  const names = tables.map((r) => r.t)
  ok('notifications table exists', names.includes('notifications'), names.join(','))
  ok('notification_reads table exists', names.includes('notification_reads'), names.join(','))

  const [cols] = await sequelize.query(
    `SELECT column_name AS c, data_type AS d, column_type AS ct, is_nullable AS nul
       FROM information_schema.columns WHERE table_schema = ? AND table_name = 'notifications'`,
    { replacements: [tenantDb] },
  )
  const byName = Object.fromEntries(cols.map((c) => [c.c, c]))
  const expect = {
    nt_id: 'int',
    nt_company_id: 'int',
    nt_type: 'varchar',
    nt_module: 'varchar',
    nt_severity: 'enum',
    nt_title: 'varchar',
    nt_body: 'longtext',
    nt_link: 'varchar',
    nt_entity_type: 'varchar',
    nt_entity_id: 'varchar',
    nt_actor_user_id: 'int',
    nt_actor_name: 'varchar',
    nt_changes: 'json',
    nt_dedupe_key: 'varchar',
    nt_created_at: 'datetime',
    nt_expires_at: 'datetime',
  }
  for (const [name, type] of Object.entries(expect)) {
    ok('column ' + name + ' is ' + type, byName[name]?.d === type, 'got ' + byName[name]?.d)
  }
  ok('the actor column is nullable', byName.nt_actor_user_id?.nul === 'YES')
  ok('the dedupe key is nullable', byName.nt_dedupe_key?.nul === 'YES')
  ok('the expiry is nullable', byName.nt_expires_at?.nul === 'YES')
  ok('the severity enum has all three values',
    /'info'.*'warning'.*'critical'/.test(byName.nt_severity?.ct || ''),
    byName.nt_severity?.ct)

  const [rcols] = await sequelize.query(
    `SELECT column_name AS c, data_type AS d, is_nullable AS nul
       FROM information_schema.columns WHERE table_schema = ? AND table_name = 'notification_reads'`,
    { replacements: [tenantDb] },
  )
  const rByName = Object.fromEntries(rcols.map((c) => [c.c, c]))
  for (const [name, type] of Object.entries({
    nr_id: 'int',
    nr_notification_id: 'int',
    nr_company_id: 'int',
    nr_user_id: 'int',
    nr_read_at: 'datetime',
  })) {
    ok('read column ' + name + ' is ' + type, rByName[name]?.d === type, 'got ' + rByName[name]?.d)
  }
  ok('nr_user_id is not null', rByName.nr_user_id?.nul === 'NO')

  // The unique key is what makes marking read idempotent.
  const [idx] = await sequelize.query(
    `SELECT index_name AS i, non_unique AS nu FROM information_schema.statistics
      WHERE table_schema = ? AND table_name = 'notification_reads'`,
    { replacements: [tenantDb] },
  )
  const uniq = Object.fromEntries(idx.map((r) => [r.i, r.nu]))
  ok('unique_notification_read exists', 'unique_notification_read' in uniq)
  ok('it is unique', uniq.unique_notification_read === 0)

  const [nidx] = await sequelize.query(
    `SELECT index_name AS i, non_unique AS nu FROM information_schema.statistics
      WHERE table_schema = ? AND table_name = 'notifications'`,
    { replacements: [tenantDb] },
  )
  const nUniq = Object.fromEntries(nidx.map((r) => [r.i, r.nu]))
  ok('unique_notifications_dedupe exists', 'unique_notifications_dedupe' in nUniq)
  ok('the dedupe key is unique', nUniq.unique_notifications_dedupe === 0)

  // Re-running must be safe: the guards are the point.
  console.log('\n  re-running up() to prove it is idempotent')
  await migration.up(qi, DataTypes)
  const [again] = await sequelize.query(
    `SELECT COUNT(*) AS c FROM information_schema.statistics
      WHERE table_schema = ? AND table_name = 'notifications' AND index_name = 'idx_notifications_company'`,
    { replacements: [tenantDb] },
  )
  ok('the index was not added twice', Number(again[0].c) === 1, 'rows=' + again[0].c)

  // The behaviour the whole design rests on. Only meaningful on a real tenant:
  // some schemas in this MySQL instance match the naming pattern but carry no
  // master_company, so there is nothing to create a notification for.
  console.log('\n  per-user read independence')
  const [hasCompany] = await sequelize.query(
    `SELECT COUNT(*) AS c FROM information_schema.tables
      WHERE table_schema = ? AND table_name = 'master_company'`,
    { replacements: [tenantDb] },
  )
  if (!Number(hasCompany[0].c)) {
    console.log('  SKIP   ' + tenantDb + ' has no master_company; not a tenant schema')
  } else {
    const [users] = await sequelize.query('SELECT mu_id FROM master_user ORDER BY mu_id LIMIT 2')
    if (users.length < 2) {
      console.log('  SKIP   needs two users in this tenant')
    } else {
    const u1 = users[0].mu_id
    const u2 = users[1].mu_id
    await sequelize.query('DELETE FROM notifications WHERE nt_title = ?', { replacements: ['phase1 probe'] })
    await sequelize.query(
      `INSERT INTO notifications (nt_company_id, nt_type, nt_severity, nt_title)
       SELECT mc_company_id, 'TEST', 'info', 'phase1 probe' FROM master_company LIMIT 1`,
    )
    // INSERT ... SELECT does not always carry an insertId through the driver, so
    // the row is looked up by its unique probe title instead of trusting it.
    const [probeRows] = await sequelize.query(
      'SELECT nt_id FROM notifications WHERE nt_title = ? LIMIT 1',
      { replacements: ['phase1 probe'] },
    )
    const nid = probeRows?.[0]?.nt_id
    ok('a notification was created', !!nid, 'id=' + nid)
    if (!nid) {
      await sequelize.close()
      console.log(failed ? '\n  ' + failed + ' failed' : '\n  migration verified')
      process.exit(failed ? 1 : 0)
    }

    await sequelize.query(
      `INSERT INTO notification_reads (nr_notification_id, nr_company_id, nr_user_id)
       VALUES (?, (SELECT nt_company_id FROM notifications WHERE nt_id = ?), ?)
       ON DUPLICATE KEY UPDATE nr_read_at = nr_read_at`,
      { replacements: [nid, nid, u1] },
    )

    const unreadFor = async (uid) => {
      const [r] = await sequelize.query(
        `SELECT COUNT(*) AS c FROM notifications nt
          LEFT JOIN notification_reads r
            ON r.nr_notification_id = nt.nt_id AND r.nr_user_id = ?
          WHERE r.nr_id IS NULL`,
        { replacements: [uid] },
      )
      return Number(r[0].c)
    }

    const u1Unread = await unreadFor(u1)
    const u2Unread = await unreadFor(u2)
    ok('the reader no longer counts it', u1Unread === 0, 'u1 unread=' + u1Unread)
    ok('the other user still counts it', u2Unread >= 1, 'u2 unread=' + u2Unread)

    // A second mark-read must not create a duplicate row.
    await sequelize.query(
      `INSERT INTO notification_reads (nr_notification_id, nr_company_id, nr_user_id)
       VALUES (?, (SELECT nt_company_id FROM notifications WHERE nt_id = ?), ?)
       ON DUPLICATE KEY UPDATE nr_read_at = nr_read_at`,
      { replacements: [nid, nid, u1] },
    )
    const [rows] = await sequelize.query(
      'SELECT COUNT(*) AS c FROM notification_reads WHERE nr_notification_id = ? AND nr_user_id = ?',
      { replacements: [nid, u1] },
    )
    ok('marking read twice is idempotent', Number(rows[0].c) === 1, 'rows=' + rows[0].c)

    await sequelize.query('DELETE FROM notification_reads WHERE nr_notification_id = ?', { replacements: [nid] })
    await sequelize.query('DELETE FROM notifications WHERE nt_id = ?', { replacements: [nid] })
    }
  }

  if (undo) {
    console.log('\n  undo')
    await migration.down(qi, MigrationSequelize)
    const [after] = await sequelize.query(
      `SELECT COUNT(*) AS c FROM information_schema.tables
        WHERE table_schema = ? AND table_name IN ('notifications','notification_reads')`,
      { replacements: [tenantDb] },
    )
    ok('both tables dropped', Number(after[0].c) === 0)
  }

  await sequelize.close()
  console.log(failed ? '\n  ' + failed + ' failed' : '\n  migration verified against ' + tenantDb)
  process.exit(failed ? 1 : 0)
})().catch((e) => {
  console.log('  ERROR ' + e.message)
  console.log(e.stack?.split('\n').slice(0, 4).map((l) => '    ' + l).join('\n'))
  process.exit(1)
})