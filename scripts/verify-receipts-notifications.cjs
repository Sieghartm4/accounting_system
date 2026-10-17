/**
 * Phase 3: the receipts pilot, exercised end to end.
 *
 * The controllers cannot be called without an express request and a live
 * transaction, so this drives the same helper they call - notifyFromController -
 * with the same payloads, against a real tenant, and asserts the outcome a user
 * would see:
 *
 *   - the actor does not get a notification about their own action
 *   - the other user does, unread
 *   - editing an approved receipt's safe fields notifies, with the field diff
 *   - a status change carries from -> to
 *   - the document reference survives in the change list
 */
'use strict'

const path = require('path')

const TENANT = process.argv[2] || 'test_accounting'

require('dotenv').config({ path: path.join(__dirname, '..', '.env') })
const CONFIG = require('../server/src/database/config/config')
const { Query } = require('../server/src/database/util/queries.util')
const { notifyFromController } = require('../server/src/services/notification/notifyFromController')
const notifications = require('../server/src/services/notification/notification.service')

let failed = 0
const ok = (label, pass, detail) => {
  if (!pass) failed++
  console.log('  ' + (pass ? 'ok   ' : 'FAIL ') + label + (detail && !pass ? '  -> ' + detail : ''))
}

// notifyFromController queues via setImmediate, so let the loop drain.
const settle = () => new Promise((r) => setTimeout(r, 400))

;(async () => {
  CONFIG.setTenantDb(TENANT)

  const companies = await Query('SELECT mc_company_id FROM master_company LIMIT 1')
  const companyId = Number(companies[0]?.mc_company_id)
  const users = await Query(
    "SELECT mu_id, mu_username FROM master_user WHERE mu_status = 'active' ORDER BY mu_id LIMIT 2",
  )
  const actor = Number(users[0].mu_id)
  const other = Number(users[1].mu_id)
  console.log('\n  tenant ' + TENANT + '  company ' + companyId +
    '  actor ' + actor + ' (' + users[0].mu_username + ')' +
    '  other ' + other + ' (' + users[1].mu_username + ')')

  ok('two active users to work with', !!actor && !!other, String(users.length))

  const req = {
    context: { userId: actor, username: users[0].mu_username, dbName: TENANT },
  }

  // The payloads below mirror the five instrumented sites in receipt.controller.js.
  const ARROW = '\u2192'

  notifyFromController(req, {
    companyId,
    type: 'DOCUMENT_CREATED',
    module: 'receipts',
    severity: 'info',
    title: 'Receipt CR-TEST-0001 created',
    body: 'Receipt CR-TEST-0001 was created and is awaiting checking.',
    link: '/receipts',
    entityType: 'receipt',
    entityId: 'CR-TEST-0001',
  })
  await settle()

  notifyFromController(req, {
    companyId,
    type: 'DOCUMENT_UPDATED',
    module: 'receipts',
    severity: 'info',
    title: 'Receipt CR-TEST-0001 edited',
    body: 'Only safe fields were changed on an APPROVED receipt.',
    link: '/receipts',
    entityType: 'receipt',
    entityId: 'CR-TEST-0001',
    changes: ['document_reference', `Remarks: NULL ${ARROW} chased`],
  })
  await settle()

  notifyFromController(req, {
    companyId,
    type: 'STATUS_CHANGED',
    module: 'receipts',
    severity: 'info',
    title: 'Receipt CR-TEST-0001 PREPARED \u2192 CHECKED',
    body: 'The status moved to CHECKED.',
    link: '/receipts',
    entityType: 'receipt',
    entityId: 'CR-TEST-0001',
    changes: [{ field: 'state', from: 'PREPARED', to: 'CHECKED' }],
  })
  await settle()

  const actorList = await notifications.listForUser({ companyId, userId: actor, filter: 'all' })
  const otherList = await notifications.listForUser({ companyId, userId: other, filter: 'all' })
  ok('the actor sees none of their own actions', actorList.length === 0,
    'actor sees ' + actorList.length)

  ok('the other user sees all three', otherList.length === 3, 'other sees ' + otherList.length)
  const types = otherList.map((n) => n.type).sort()
  ok('the three types are what was sent',
    types.join(',') === 'DOCUMENT_CREATED,DOCUMENT_UPDATED,STATUS_CHANGED', types.join(','))

  const created = otherList.find((n) => n.type === 'DOCUMENT_CREATED')
  ok('the deep link is carried', created?.link === '/receipts')
  ok('the entity is carried', created?.entityId === 'CR-TEST-0001')
  ok('the actor name is shown to the other user', created?.actorName === users[0].mu_username)
  ok('the actor id is stored', Number(created?.actorUserId) === actor)

  const edited = otherList.find((n) => n.type === 'DOCUMENT_UPDATED')
  ok('the edit carries a structured change list', Array.isArray(edited?.changes) && edited.changes.length === 2,
    JSON.stringify(edited?.changes))
  ok('the bare field name becomes a note',
    edited?.changes?.[0]?.note === 'document_reference', JSON.stringify(edited?.changes?.[0]))
  ok('the from/to pair is split out',
    edited?.changes?.[1]?.field === 'Remarks' && edited?.changes?.[1]?.to === 'chased',
    JSON.stringify(edited?.changes?.[1]))

  const status = otherList.find((n) => n.type === 'STATUS_CHANGED')
  ok('the status change keeps from and to',
    status?.changes?.[0]?.from === 'PREPARED' && status?.changes?.[0]?.to === 'CHECKED',
    JSON.stringify(status?.changes))

  const count = await notifications.unreadCount({ companyId, userId: other })
  ok('the badge counts all three for the other user', count === 3, String(count))
  const actorCount = await notifications.unreadCount({ companyId, userId: actor })
  ok('the actor badge is zero', actorCount === 0, String(actorCount))

  // One user reading must not affect the other.
  await notifications.markRead({ companyId, userId: other, notificationId: created.id })
  const otherUnread = await notifications.unreadCount({ companyId, userId: other })
  ok('after reading one, the badge drops to two', otherUnread === 2, String(otherUnread))

  // A caller-supplied actor must not win over the session.
  notifyFromController({
    context: { userId: other, username: users[1].mu_username, dbName: TENANT },
  }, {
    companyId,
    type: 'DOCUMENT_CREATED',
    module: 'receipts',
    severity: 'info',
    title: 'Receipt CR-TEST-0002 created',
    body: 'x',
    // A spoofed identity the controller does not send.
    actorUserId: other,
    actorName: 'someone else',
    entityType: 'receipt',
    entityId: 'CR-TEST-0002',
  })
  await settle()
  const afterSpoof = await notifications.listForUser({ companyId, userId: other, filter: 'all' })
  ok('the session user is excluded, not the spoofed actor',
    !afterSpoof.some((n) => n.entityId === 'CR-TEST-0002'),
    'other should not see a notification about their own spoofed action')
  ok('the spoofed actor name was ignored',
    !afterSpoof.some((n) => n.actorName === 'someone else'))

  // A missing tenant must not write anything.
  const before = (await notifications.listForUser({ companyId, userId: other, filter: 'all' })).length
  notifyFromController({ context: { userId: actor, username: 'x' } }, {
    companyId,
    type: 'DOCUMENT_CREATED',
    module: 'receipts',
    severity: 'info',
    title: 'Receipt CR-TEST-0003 created',
    body: 'x',
    entityType: 'receipt',
    entityId: 'CR-TEST-0003',
  })
  await settle()
  const after = (await notifications.listForUser({ companyId, userId: other, filter: 'all' })).length
  ok('a request with no tenant writes nothing', after === before, before + ' -> ' + after)

  // Invalid payloads must be swallowed, not thrown back at the caller.
  let threw = false
  try {
    notifyFromController(req, { companyId, type: 'X', severity: 'info', title: '', body: '' })
    notifyFromController(req, { companyId, type: 'X', severity: 'nonsense', title: 't', body: 'b' })
    notifyFromController(req, null)
  } catch (e) {
    threw = true
  }
  await settle()
  ok('a malformed notification never throws', !threw)

  await Query("DELETE nr FROM notification_reads nr JOIN notifications nt ON nt.nt_id = nr.nr_notification_id WHERE nt.nt_entity_type = 'receipt'")
  await Query("DELETE FROM notifications WHERE nt_entity_type = 'receipt'")

  const [left] = await Query('SELECT COUNT(*) AS c FROM notifications')
  ok('the probes were cleaned up', Number(left.c) === 0, 'rows left=' + left.c)

  console.log(failed ? '\n  ' + failed + ' failed' : '\n  receipts pilot verified against ' + TENANT)
  process.exit(failed ? 1 : 0)
})().catch((e) => {
  console.log('  ERROR ' + e.message)
  console.log((e.stack || '').split('\n').slice(0, 5).map((l) => '    ' + l).join('\n'))
  process.exit(1)
})