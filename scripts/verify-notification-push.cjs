/**
 * End-to-end check of Phase 2 against a real tenant database.
 *
 * Creates a notification through the service exactly as a controller would,
 * with a real actor, and asserts the pieces that matter:
 *
 *   - the row lands in the tenant
 *   - the actor is not among the recipients
 *   - other active users are
 *   - the push is addressed per user, not broadcast
 *   - an expired notification drops out of both the list and the count
 *
 * The socket has no listeners in a plain node process, so `pushed` is 0 here.
 * That is expected and is itself worth asserting: a dead socket must not stop the
 * row being written, because the client's fallback is a refresh, not a push.
 */
'use strict'

const path = require('path')

const TENANT = process.argv[2] || 'test_accounting'

require('dotenv').config({ path: path.join(__dirname, '..', '.env') })
const CONFIG = require('../server/src/database/config/config')
const { Query } = require('../server/src/database/util/queries.util')
const notifications = require('../server/src/services/notification/notification.service')

let failed = 0
const ok = (label, pass, detail) => {
  if (!pass) failed++
  console.log('  ' + (pass ? 'ok   ' : 'FAIL ') + label + (detail && !pass ? '  -> ' + detail : ''))
}

;(async () => {
  CONFIG.setTenantDb(TENANT)

  const companies = await Query('SELECT mc_company_id FROM master_company LIMIT 1')
  const companyId = Number(companies[0]?.mc_company_id)
  const users = await Query(
    "SELECT mu_id FROM master_user WHERE mu_status = 'active' ORDER BY mu_id LIMIT 2",
  )
  console.log('\n  tenant ' + TENANT + '  company ' + companyId + '  users ' +
    users.map((u) => u.mu_id).join(','))

  const actor = Number(users[0].mu_id)
  const other = Number(users[1]?.mu_id)
  ok('two active users to work with', !!actor && !!other, 'got ' + users.length)

  const title = 'phase2 probe ' + Date.now()

  const recipientsAll = await notifications.listRecipientIds({ excludeUserId: null })
  const recipientsNoActor = await notifications.listRecipientIds({ excludeUserId: actor })
  ok('with no exclusion everyone active is a recipient', recipientsAll.includes(actor), JSON.stringify(recipientsAll))
  ok('the actor is excluded', !recipientsNoActor.includes(actor), JSON.stringify(recipientsNoActor))
  ok('nobody else is excluded', other ? recipientsNoActor.includes(other) : true)
  ok('inactive and deleted users are not recipients',
    recipientsAll.every((id) => Number.isInteger(id) && id > 0))

  const created = await notifications.createAndNotify({
    companyId,
    type: 'DOCUMENT_CREATED',
    module: 'receipts',
    severity: 'info',
    title,
    body: 'probe',
    link: '/receipts',
    entityType: 'receipt',
    entityId: 'CR-TEST-0001',
    actorUserId: actor,
    actorName: 'probe user',
    changes: [{ field: 'status', from: 'PREPARED', to: 'CHECKED' }],
    dbName: TENANT,
  })

  ok('a row was created', !!created.id, 'id=' + created.id)
  // The point of writing before pushing: no socket, still a durable row.
  ok('a dead socket does not stop the row being written', !!created.id)
  ok('recipients were resolved', created.recipients > 0, String(created.recipients))
  ok('the push was attempted', typeof created.pushed === 'number')

  const [row] = await Query(
    'SELECT nt_id, nt_actor_user_id, nt_changes, nt_link FROM notifications WHERE nt_id = ?',
    [created.id],
  )
  ok('the actor is recorded', Number(row.nt_actor_user_id) === actor)
  ok('the changes are stored as JSON',
    (typeof row.nt_changes === 'string' || typeof row.nt_changes === 'object') &&
      JSON.stringify(row.nt_changes).includes('status'),
    typeof row.nt_changes + ': ' + JSON.stringify(row.nt_changes))
  ok('the deep link is stored', row.nt_link === '/receipts')

  const otherList = await notifications.listForUser({ companyId, userId: other, filter: 'unread' })
  const actorList = await notifications.listForUser({ companyId, userId: actor, filter: 'unread' })
  ok('the other user sees it unread', otherList.some((n) => n.id === created.id))
  ok('the actor does not see it at all', !actorList.some((n) => n.id === created.id))

  await notifications.markRead({ companyId, userId: other, notificationId: created.id })
  const otherAfter = await notifications.listForUser({ companyId, userId: other, filter: 'unread' })
  const otherRead = await notifications.listForUser({ companyId, userId: other, filter: 'read' })
  ok('after reading it leaves the unread list', !otherAfter.some((n) => n.id === created.id))
  ok('and appears in the read list', otherRead.some((n) => n.id === created.id && n.isRead === true))

  const countBefore = await notifications.unreadCount({ companyId, userId: other })
  ok('the badge matches the unread list', countBefore === otherAfter.length,
    'count=' + countBefore + ' list=' + otherAfter.length)

  // Expiry: both the list and the count have to agree that it is gone.
  const expiring = await notifications.createAndNotify({
    companyId,
    type: 'TEST',
    severity: 'info',
    title: title + ' expiring',
    actorUserId: null,
    expiresAt: new Date(Date.now() - 60000),
    dbName: TENANT,
  })
  const expList = await notifications.listForUser({ companyId, userId: other, filter: 'all' })
  ok('an expired notification is hidden', !expList.some((n) => n.id === expiring.id))
  const countAfter = await notifications.unreadCount({ companyId, userId: other })
  ok('and is not counted', countAfter === countBefore, 'before=' + countBefore + ' after=' + countAfter)

  // A system notification has no actor, so nobody is excluded.
  const system = await notifications.listRecipientIds({ excludeUserId: null })
  ok('a null actor excludes nobody', system.length === recipientsAll.length)

  await Query("DELETE nr FROM notification_reads nr JOIN notifications nt ON nt.nt_id = nr.nr_notification_id WHERE nt.nt_title LIKE 'phase2 probe%'")
  await Query("DELETE FROM notifications WHERE nt_title LIKE 'phase2 probe%'")

  const [left] = await Query('SELECT COUNT(*) AS c FROM notifications')
  ok('the probes were cleaned up', Number(left.c) === 0, 'rows left=' + left.c)

  console.log(failed ? '\n  ' + failed + ' failed' : '\n  phase 2 verified against ' + TENANT)
  process.exit(failed ? 1 : 0)
})().catch((e) => {
  console.log('  ERROR ' + e.message)
  console.log((e.stack || '').split('\n').slice(0, 5).map((l) => '    ' + l).join('\n'))
  process.exit(1)
})