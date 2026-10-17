/**
 * A real edit notification, end to end.
 *
 * Two reports came out of this:
 *
 *   1. Notifications titled "sales MM-..." and "receipts MM-..." in a live
 *      tenant, with no link and no changes, so they could not be opened and
 *      said nothing about what had happened. Those were leftover rows from an
 *      earlier version of the verification scripts: the titles carried the
 *      marker in the middle ("sales MM-<ts>") while the cleanup matched it as a
 *      prefix (LIKE 'MM-%'), and one script threw before it could delete.
 *      Fixed here by making the marker a shared constant and always cleaning up.
 *
 *   2. The underlying question they raised: does a genuine DOCUMENT_UPDATED
 *      notification actually say what was edited, and does clicking it go
 *      anywhere? Nothing had ever produced one in a real tenant, so this drives
 *      the real helper with the audit strings the receipt controller builds and
 *      then reads it back the way the list endpoint does.
 */
'use strict'

const path = require('path')
const ROOT = path.join(__dirname, '..')
const SRV = path.join(ROOT, 'server')
process.chdir(SRV)
require('dotenv').config({ path: path.join(ROOT, '.env') })

const { getTenantPool } = require(path.join(SRV, 'src/database/util/tenantConnection.util'))
const { notifyFromController } = require(
  path.join(SRV, 'src/services/notification/notifyFromController'),
)
const svc = require(path.join(SRV, 'src/services/notification/notification.service'))

const TENANT = '5lsolutions_accounting'
const MARKER = 'EDITPROBE'

let failed = 0
const ok = (label, pass, detail) => {
  if (!pass) failed++
  console.log('  ' + (pass ? 'ok   ' : 'FAIL ') + label + (detail ? '  -> ' + detail : ''))
}
const settle = () => new Promise((r) => setTimeout(r, 1200))

;(async () => {
  const pool = getTenantPool(TENANT)
  const [[company]] = await pool.query(
    'SELECT mc_company_id FROM master_company ORDER BY mc_company_id LIMIT 1')
  const companyId = company.mc_company_id
  const [users] = await pool.query(
    "SELECT mu_id FROM master_user WHERE mu_status='active' ORDER BY mu_id LIMIT 2")
  const [actor, reader] = users
  const tag = MARKER + '-' + Date.now()
  const where = 'nt_title LIKE ?'
  const like = `%${tag}%`

  // The exact shape receipt.controller emits for an update: `Field: a -> b`.
  const auditChanges = [
    'Doc Ref: CR-OLD → CR-101626-0002',
    'Partner Name: San Miguel → San Miguel Foods',
    'Total Amount: 12000.00 → 13500.00',
    'Added new attachment: Receipt Scan',
  ]

  try {
    console.log('\nthe edit produces a row')
    notifyFromController(
      { context: { userId: actor.mu_id, username: 'editor', dbName: TENANT } },
      {
        type: 'DOCUMENT_UPDATED',
        module: 'receipts',
        severity: 'info',
        title: `Receipt CR-101626-0002 edited [${tag}]`,
        body: `${auditChanges.length} change(s) were made to this receipt.`,
        link: '/receipts',
        entityType: 'receipt',
        entityId: 'CR-101626-0002',
        changes: auditChanges,
      },
    )
    await settle()

    const [rows] = await pool.query(`SELECT * FROM notifications WHERE ${where}`, [like])
    ok('a row was written', rows.length === 1, `found ${rows.length}`)
    if (rows.length !== 1) throw new Error('cannot continue')
    const row = rows[0]

    console.log('\nit can be opened')
    ok('it carries a link', typeof row.nt_link === 'string' && row.nt_link.length > 0,
      'link=' + JSON.stringify(row.nt_link))
    // A module route alone opens the list, where the document is one of many
    // rows. The header search already opens a document with `?id=`, and a
    // notification about a specific document has to land in the same place.
    ok('the link opens the document, not the list',
      /^\/receipts\?id=.+/.test(row.nt_link || ''), 'link=' + JSON.stringify(row.nt_link))
    ok('it still points at the module that owns it',
      String(row.nt_link || '').startsWith('/receipts'))
    // The decisive check: whatever id the link carries has to be a receipt that
    // exists, or the page fetches nothing and the notification opens an error.
    const linkedId = decodeURIComponent(String(row.nt_link || '').split('?id=')[1] || '')
    const [hits] = await pool.query('SELECT r_id FROM receipts WHERE r_id = ? LIMIT 1', [linkedId])
    ok('that id is a receipt that actually exists', hits.length === 1,
      'id=' + JSON.stringify(linkedId))
    ok('and it is the document the notification is about',
      hits.length === 1 && String(hits[0].r_id) === String(row.nt_entity_id),
      `linked=${hits[0] && hits[0].r_id} entity=${row.nt_entity_id}`)
    ok('and it names the document it is about', row.nt_entity_id === 'CR-101626-0002')

    console.log('\nit says what was edited')
    ok('changes are stored', row.nt_changes !== null)
    ok('they come back as an array, not a JSON string',
      Array.isArray(row.nt_changes), 'typeof=' + typeof row.nt_changes)
    ok('every field that changed is present', Array.isArray(row.nt_changes) &&
      row.nt_changes.length === auditChanges.length,
      Array.isArray(row.nt_changes) ? String(row.nt_changes.length) : 'not an array')

    const parsed = row.nt_changes || []
    const fields = parsed.filter((c) => c.field).map((c) => c.field)
    ok('the audit fields were parsed into labelled entries',
      fields.includes('Doc Ref') && fields.includes('Total Amount'),
      JSON.stringify(fields))
    ok('a before/after pair was captured',
      parsed.some((c) => c.field === 'Total Amount' && c.from === '12000.00' && c.to === '13500.00'),
      JSON.stringify(parsed.find((c) => c.field === 'Total Amount')))
    // An entry with no arrow (an attachment) carries no before/after, so it must
    // not render as two empty boxes.
    ok('an entry with no before/after becomes a note',
      parsed.some((c) => c.note && c.note.includes('attachment')),
      JSON.stringify(parsed.find((c) => c.note)))

    console.log('\nit reaches the list the same way')
    const listed = await svc.listForUser({ companyId, userId: reader.mu_id, filter: 'all', dbName: TENANT })
    const mine = listed.find((n) => n.entityId === 'CR-101626-0002')
    ok('the reader sees it', !!mine)
    ok('with its link intact', mine && /\?id=/.test(mine.link || ''), mine && mine.link)
    ok('and its changes intact', mine && Array.isArray(mine.changes) && mine.changes.length === 4,
      mine ? JSON.stringify(mine.changes).slice(0, 90) : 'not found')
    ok('and it is unread for them', mine && mine.isRead === false)
    ok('the body summarises the change count', mine && /change\(s\)/.test(mine.body || ''))

    const byModule = await svc.unreadCountByModule({ companyId, userId: reader.mu_id, dbName: TENANT })
    ok('it lands on the receipts badge', Number(byModule.receipts) > 0, JSON.stringify(byModule))
  } finally {
    // Always, even if an assertion threw - that is how two rows survived before.
    const [d1] = await pool.query(
      'DELETE nr FROM notification_reads nr JOIN notifications nt ON nt.nt_id = nr.nr_notification_id WHERE nt.nt_title LIKE ?',
      [like])
    const [d2] = await pool.query(`DELETE FROM notifications WHERE ${where}`, [like])
    const [left] = await pool.query(`SELECT COUNT(*) c FROM notifications WHERE ${where}`, [like])
    console.log(`\n  cleaned up ${d2.affectedRows} row(s) + ${d1.affectedRows} read receipt(s); remaining=${left[0].c}`)
    ok('no test rows left behind', Number(left[0].c) === 0)
  }

  console.log(failed ? `\n  ${failed} failed` : '\n  a real edit notification is complete and openable')
  process.exit(failed ? 1 : 0)
})().catch((e) => {
  console.error('  harness error:', e.message)
  process.exit(1)
})