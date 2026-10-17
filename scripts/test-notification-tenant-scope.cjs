/**
 * Tenant scoping in the notification subsystem.
 *
 * These three bugs all produced the same symptom - a receipt was saved, no
 * notification appeared, and nothing was logged as an error - so they are easy
 * to reintroduce and hard to notice. Each is pinned here against the source,
 * because the failure mode is silence rather than a crash.
 *
 * The background: `Query(sql, params, prefixes, tenantPool, tenantDb)` resolves
 * its database from the last two arguments. Omit them and it does not error; it
 * falls back to getTenantPool() with no name, which is the process-global default
 * (`subscription`). Every statement therefore succeeded against the wrong
 * database.
 */
'use strict'

const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')
const SRV = path.join(ROOT, 'server/src')
const read = (p) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n')

let failed = 0
const ok = (label, pass, detail) => {
  if (!pass) failed++
  console.log('  ' + (pass ? 'ok   ' : 'FAIL ') + label + (detail && !pass ? '  -> ' + detail : ''))
}

const service = read(path.join(SRV, 'services/notification/notification.service.js'))
const helper = read(path.join(SRV, 'services/notification/notifyFromController.js'))
const controller = read(path.join(SRV, 'controller/notification.controller.js'))

console.log('\nevery notification statement targets a named tenant')

// The wrapper is the whole point: it refuses rather than defaulting.
ok('the tenant-guarded wrapper exists',
  /const q = async \(sql, params, dbName\)/.test(service) &&
  /throw httpError\('dbName is required for notification queries'/.test(service),
  'a missing tenant must be loud, not silent')
ok('it forwards the tenant as Query\'s last argument',
  /return Query\(sql, params, null, null, dbName\)/.test(service))

// Any bare Query() in the service is a statement that will silently hit the
// wrong database, because none of them passes a tenant.
const bare = (service.match(/await Query\(/g) || []).length
ok('the service has no un-tenanted statements', bare === 0, `${bare} bare Query() calls`)

const guarded = (service.match(/await q\(/g) || []).length
ok('all its statements go through the wrapper', guarded >= 8, `${guarded} sites`)

console.log('\nevery exported function can be given the tenant')
for (const fn of ['listForUser', 'unreadCount', 'unreadCountByModule', 'markRead', 'markAllRead']) {
  const m = service.match(new RegExp(`const ${fn} = async \\(\\{([^}]*)\\}\\)`))
  ok(`${fn} accepts dbName`, m !== null && /\bdbName\b/.test(m[1]), m ? m[1] : 'not found')
}

console.log('\nthe recipient lookup only uses columns that exist')
// master_user is (mu_id, mu_fullname, mu_username, mu_password, mu_access_id,
// mu_status, mu_email). There is no db_name column, so the original
// `AND db_name = ?` threw "Unknown column" on every notification.
const recipientBlock = service.slice(
  service.indexOf('const listRecipientIds'),
  service.indexOf('const createAndNotify'))
ok('it does not filter on a db_name column',
  !/\bdb_name\b/.test(recipientBlock),
  'master_user has no db_name column; this throws and is swallowed')
ok('it still excludes the actor', /mu_id <> \?/.test(recipientBlock))
ok('it still filters to active users', /mu_status = 'active'/.test(recipientBlock))
ok('it queries the tenant', /await q\(sql, params, dbName\)/.test(recipientBlock))

console.log('\nthe controller threads the tenant through')
for (const call of [
  'listForUser({ companyId, userId: user.userId, filter, limit, dbName: user.dbName })',
  'unreadCount({ companyId, userId: user.userId, dbName: user.dbName })',
  'unreadCountByModule({ companyId, userId: user.userId, dbName: user.dbName })',
  'markAllRead({ companyId, userId: user.dbName ? user.dbName : user.userId })',
]) {
  if (call.includes('markAllRead')) continue
  ok(`passes dbName to ${call.split('(')[0]}`, controller.includes(call))
}
ok('passes dbName to markRead',
  /markRead\(\{[\s\S]{0,160}?dbName: user\.dbName/.test(controller))
ok('passes dbName to markAllRead',
  /markAllRead\(\{ companyId, userId: user\.userId, dbName: user\.dbName \}\)/.test(controller))
ok('resolveUser surfaces the tenant',
  /username: ctx\.username \|\| null, dbName: ctx\.dbName \|\| null/.test(controller))
// The company check itself ran against the default database, so a valid company
// looked unknown and every read returned COMPANY_NOT_FOUND.
ok('resolveCompany verifies against the caller tenant',
  /SELECT mc_company_id FROM master_company WHERE mc_company_id = \? LIMIT 1`[\s\S]{0,120}?req\.context\?\.dbName/.test(controller))

console.log('\nthe deferred helper resolves the company in the right tenant')
ok('resolveCompanyId takes the tenant', /const resolveCompanyId = async \(event, dbName\)/.test(helper))
ok('it queries master_company with it',
  /SELECT mc_company_id FROM master_company[\s\S]{0,160}?dbName,/.test(helper))
ok('it is deterministic rather than a bare LIMIT 1',
  /ORDER BY mc_company_id LIMIT 1/.test(helper))
ok('the call site passes the tenant',
  /resolveCompanyId\(event, dbName\)/.test(helper))
ok('a skip names the tenant, so the log is actionable',
  /could not resolve companyId for tenant \$\{dbName\}/.test(helper))

console.log(failed ? `\n  ${failed} failed` : '\n  tenant scoping is enforced')
process.exit(failed ? 1 : 0)