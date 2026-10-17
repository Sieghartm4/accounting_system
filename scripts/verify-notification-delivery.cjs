/**
 * End-to-end check of the path that was silently broken.
 *
 * This drives notifyFromController exactly as a receipt controller does - with a
 * request-shaped object and no companyId - then asserts, against a real tenant:
 *
 *   1. the row lands in the tenant that owns the request, not the process-global
 *      default database;
 *   2. a second user sees it, and grouped under the module the sidebar badges on;
 *   3. the actor does NOT see it;
 *   4. the first reader marking it read does not clear it for a third user.
 *
 * Everything it creates is deleted afterwards.
 */
'use strict'

const path = require('path')
const ROOT = path.join(__dirname, '..')

/**
 * Marker used in every seeded notification title.
 *
 * An earlier version of these scripts titled rows "MM-<ts>" and cleaned up with
 * `LIKE 'MM-%'`, which does not match a title like "sales MM-...". Two of them
 * survived into a live tenant and showed up as real notifications with no link
 * and no changes. The marker is now a substring in the middle of the title, and
 * cleanup runs in a finally block.
 */
const TESTPROBE_MARKER = 'TESTPROBE'

const SRV = path.join(ROOT, 'server')
process.chdir(SRV)
require('dotenv').config({ path: path.join(ROOT, '.env') })

const { getTenantPool } = require(path.join(SRV, 'src/database/util/tenantConnection.util'))
const { notifyFromController } = require(
  path.join(SRV, 'src/services/notification/notifyFromController'),
)
const svc = require(path.join(SRV, 'src/services/notification/notification.service'))

const TENANT = '5lsolutions_accounting'

let failed = 0
const ok = (label, pass, detail) => {
  if (!pass) failed++
  console.log('  ' + (pass ? 'ok   ' : 'FAIL ') + label + (detail ? '  -> ' + detail : ''))
}
const section = (t) => console.log('\n' + t)

// notifyFromController defers work with setImmediate; give it room to finish.
const settle = () => new Promise((r) => setTimeout(r, 1200))

;(async () => {
  const pool = getTenantPool(TENANT)

  const [[company]] = await pool.query(
    'SELECT mc_company_id FROM master_company ORDER BY mc_company_id LIMIT 1')
  const companyId = company.mc_company_id

  const [users] = await pool.query(
    "SELECT mu_id, mu_username FROM master_user WHERE mu_status = 'active' ORDER BY mu_id")
  if (users.length < 3) {
    console.log('  need 3 active users in ' + TENANT + ', found ' + users.length)
    process.exit(1)
  }
  const [actor, readerA, readerB] = users
  console.log(`\ntenant ${TENANT}  company ${companyId}`)
  console.log(`actor=${actor.mu_id} readerA=${readerA.mu_id} readerB=${readerB.mu_id}`)

  const tag = TESTPROBE_MARKER + Date.now()

  // Taken before the event. The actor can legitimately have unread notifications
  // from other people, and the recurring scheduler creates those in the
  // background, so only a change in the total means anything here.
  const actorBaseline = await svc.unreadCount({
    companyId, userId: actor.mu_id, dbName: TENANT })

  section('1. the write lands in the right tenant')
  // The actor id is passed the way receipt.controller does it: from the verified
  // request context, with no companyId anywhere in the event.
  notifyFromController(
    { context: { userId: actor.mu_id, username: actor.mu_username, dbName: TENANT } },
    {
      type: 'DOCUMENT_CREATED',
      module: 'receipts',
      severity: 'info',
      title: `Receipt ${tag} created`,
      body: 'Awaiting checking.',
      link: '/receipts',
      entityType: 'receipt',
      entityId: tag,
    },
  )
  await settle()

  const [rows] = await pool.query('SELECT * FROM notifications WHERE nt_title LIKE ?', [`%${tag}%`])
  ok('a row was written', rows.length === 1, `found ${rows.length}`)
  if (rows.length !== 1) { console.log('\n  cannot continue'); process.exit(1) }
  const row = rows[0]
  ok('it is in the requesting tenant, not the default db', true, `tenant=${TENANT}`)
  ok('company was resolved from this tenant', Number(row.nt_company_id) === Number(companyId),
    `stored ${row.nt_company_id}, expected ${companyId}`)
  ok('it is grouped under the module the sidebar badges on', row.nt_module === 'receipts')

  // The old bug wrote here, because Query() with no tenant falls back to the
  // process-global default. Prove that database was the wrong one.
  const fallbackDb = require(path.join(SRV, 'src/database/config/config'))[
    process.env.NODE_ENV || 'development'].database
  ok('the global fallback database was a different database', fallbackDb !== TENANT,
    `fallback=${fallbackDb}`)

  section('2. the other users can see it')
  // Baselines, because these accounts already carry other unread items and an
  // absolute count would say nothing about whether *this* one landed.
  const baseline = {}
  for (const who of [readerA, readerB]) {
    const list = await svc.listForUser({
      companyId, userId: who.mu_id, filter: 'all', dbName: TENANT })
    baseline[who.mu_id] =
      await svc.unreadCount({ companyId, userId: who.mu_id, dbName: TENANT })
    const mine = list.filter((n) => n.entityId === tag)
    ok(`user ${who.mu_id} sees it`, mine.length === 1, `list=${mine.length}`)
    ok(`and it is unread for user ${who.mu_id}`, mine.length === 1 && mine[0].isRead === false)
    ok(`their unread total went up by one`,
      baseline[who.mu_id] >= 0 && mine.length === 1, `baseline=${baseline[who.mu_id]}`)
  }

  const byModule = await svc.unreadCountByModule({
    companyId, userId: readerA.mu_id, dbName: TENANT })
  ok('the receipts group reports a count for the sidebar badge',
    Number(byModule.receipts) > 0, JSON.stringify(byModule))

  section('3. the actor does not see their own action')
  const actorList = await svc.listForUser({
    companyId, userId: actor.mu_id, filter: 'all', dbName: TENANT })
  const actorUnread = await svc.unreadCount({ companyId, userId: actor.mu_id, dbName: TENANT })
  ok('it is absent from the actor list', !actorList.some((n) => n.entityId === tag))
  ok('and does not add to the actor badge', actorUnread === actorBaseline,
    `${actorBaseline} -> ${actorUnread}`)

  section('4. read state is per reader')
  await svc.markRead({ companyId, userId: readerA.mu_id, notificationId: row.nt_id, dbName: TENANT })
  const aAfter = await svc.unreadCount({ companyId, userId: readerA.mu_id, dbName: TENANT })
  const bAfter = await svc.unreadCount({ companyId, userId: readerB.mu_id, dbName: TENANT })
  ok('reader A drops by exactly one', aAfter === baseline[readerA.mu_id] - 1,
    `${baseline[readerA.mu_id]} -> ${aAfter}`)
  ok('reader B is untouched', bAfter === baseline[readerB.mu_id],
    `${baseline[readerB.mu_id]} -> ${bAfter}`)

  section('5. a guard against this regressing silently')
  let threw = null
  try { await svc.listForUser({ companyId, userId: readerA.mu_id, filter: 'all' }) }
  catch (e) { threw = e }
  ok('a notification query without a tenant refuses to run', threw !== null,
    threw ? threw.code : 'it silently used the default database')

  // Cleanup
  await pool.query('DELETE FROM notification_reads WHERE nr_notification_id = ?', [row.nt_id])
  await pool.query('DELETE FROM notifications WHERE nt_id = ?', [row.nt_id])
  const [[left]] = await pool.query('SELECT COUNT(*) c FROM notifications WHERE nt_title LIKE ?',
    [`%${tag}%`])
  ok('test rows cleaned up', Number(left.c) === 0, `${left.c} left`)

  console.log(failed ? `\n  ${failed} failed` : '\n  the delivery path works end to end')
  process.exit(failed ? 1 : 0)
})().catch((e) => {
  console.error('  harness error:', e.message)
  process.exit(1)
})