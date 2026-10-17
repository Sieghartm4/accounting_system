/**
 * The notifications schema, the read rule, and the API around it.
 *
 * The behaviour that matters is already proven against real tenant databases by
 * apply-notifications-migration.cjs, which creates a notification, has one user
 * read it, and asserts the other user still counts it. These checks guard the
 * parts that only a real database would catch by accident: that read state is a
 * join and never a column on the notification, that every read path is scoped to
 * the caller's own user, and that nothing accepts a user id from the request.
 */
'use strict'

const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')
const SERVER = path.join(ROOT, 'server/src')

let failed = 0
const ok = (label, pass, detail) => {
  if (!pass) failed++
  console.log('  ' + (pass ? 'ok   ' : 'FAIL ') + label + (detail && !pass ? '  -> ' + detail : ''))
}
const section = (t) => console.log('\n' + t)
const read = (p) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n')

const migration = read(path.join(SERVER, 'database/migrations/create/20261016120000-create-notifications.js'))
const service = read(path.join(SERVER, 'services/notification/notification.service.js'))
const controller = read(path.join(SERVER, 'controller/notification.controller.js'))
const routes = read(path.join(SERVER, 'routes/notification.routes.js'))
const startup = read(path.join(SERVER, 'startup/routes.startup.js'))
const model = read(path.join(SERVER, 'database/model/Accounting.js'))

section('read state is a join, never a column on the notification')
ok('the migration creates both tables', /createTable\('notifications'/.test(migration) && /createTable\('notification_reads'/.test(migration))
ok('notifications has no read column',
  !/nt_read\b|nt_is_read|nt_read_at/.test(migration),
  'a boolean here would make the first reader remove it for everyone')
ok('the reads table keys on the user', /nr_user_id: \{ type: Sequelize\.INTEGER, allowNull: false \}/.test(migration))
ok('the reads table keys on the notification', /nr_notification_id: \{ type: Sequelize\.INTEGER, allowNull: false \}/.test(migration))
ok('one read row per (notification, user)',
  /fields: \['nr_notification_id', 'nr_user_id'\][\s\S]{0,120}?unique: true/.test(migration))
ok('the model declares both tables', /notifications: \{/.test(model) && /notification_reads: \{/.test(model))
ok('the prefixes do not collide', /prefix_: 'nt_'/.test(model) && /prefix_: 'nr_'/.test(model))

section('the actor is optional and separate from the reader')
ok('the actor column is nullable', /nt_actor_user_id: \{ type: Sequelize\.INTEGER, allowNull: true \}/.test(migration))
ok('the migration explains why', /no human actor/.test(migration))
ok('the service keeps a null actor null', /actorUserId = null/.test(service))
ok('the service rejects a non-positive actor id', /actorUserId must be a positive integer/.test(service))

section('the dedupe key is for computed sources only')
ok('it is nullable', /nt_dedupe_key: \{ type: Sequelize\.STRING\(190\), allowNull: true \}/.test(migration))
ok('it is unique', /unique_notifications_dedupe/.test(migration))
ok('create tolerates a duplicate key', /ON DUPLICATE KEY UPDATE/.test(service))
ok('a duplicate is reported rather than silently swallowed', /duplicate: !id/.test(service))
ok('ordinary document activity leaves it unset', /dedupeKey = input\.dedupeKey \?[^:]*: null/.test(service))

section('every read query joins the reader\'s own id')
// Four, not two: the list, the badge count, the per-module badge count, and
// mark-all-read all derive read state from the same join rather than from a
// stored flag. The per-module query was added for the sidebar badges and this
// count was not updated with it.
const joins = (service.match(/^\s*LEFT JOIN \$\{nr\.tablename\}/gm) || []).length
ok('every read-state query joins the reads table', joins === 5, String(joins))
// Counted, not merely present: a reader-scoped join in only some of them is
// exactly the bug where the badge and the list disagree.
const readerScoped = (service.match(/AND r\.\$\{nr\.selectOptionColumns\.user_id\} = \?/g) || []).length
ok('every one of those joins filters on the reader id', readerScoped === 5, String(readerScoped))
ok('a join missing the reader predicate would count for everyone', readerScoped === joins)
ok('the count treats a missing read row as unread', /AND r\.\$\{nr\.selectOptionColumns\.id\} IS NULL/.test(service))

section('the list and the badge cannot disagree')
ok('both filter the same expiry rule',
  (service.match(/nt\.\$\{n\.selectOptionColumns\.expires_at\} > NOW\(\)/g) || []).length >= 2)
ok('the list reports read state from the same join',
  /isRead: row\.read_marker !== null && row\.read_marker !== undefined/.test(service))
ok('the list caps its page size', /Math\.min\(Math\.max\(Number\(limit\) \|\| 50, 1\), 200\)/.test(service))
// Located inside unreadCount, so weakening only the count query is caught. A
// check that merely finds the predicate somewhere would pass with the badge
// counting every notification in the company.
const countFn = service.slice(service.indexOf('const unreadCount'))
const countBody = countFn.slice(0, countFn.indexOf('\n}\n'))
ok('the badge counts only what this reader has not read',
  /AND r\.\$\{nr\.selectOptionColumns\.id\} IS NULL/.test(countBody))
ok('the badge is scoped to the company', /nt\.\$\{n\.selectOptionColumns\.company_id\} = \?/.test(countBody))

section('marking read is idempotent and scoped')
ok('the notification must belong to the company before it is marked',
  /WHERE \$\{n\.selectOptionColumns\.id\} = \?\s*\n\s*AND \$\{n\.selectOptionColumns\.company_id\} = \?/.test(service))
ok('a notification from another company is not found', /NOT_FOUND/.test(service))
// Located in markRead: createNotification and markAllRead also use ON DUPLICATE
// KEY, so a bare presence check would pass with markRead made non-idempotent.
const markReadFn = service.slice(service.indexOf('const markRead'), service.indexOf('const markAllRead'))
ok('marking read ignores a repeat',
  /INSERT INTO \$\{nr\.tablename\}[\s\S]*?ON DUPLICATE KEY UPDATE/.test(markReadFn))
ok('markRead reports whether it was already read', /alreadyRead/.test(markReadFn))
ok('mark-all-read only touches what this reader has not read',
  /AND r\.\$\{nr\.selectOptionColumns\.id\} IS NULL/.test(service))
ok('mark-all-read passes the reader id', /\[userId, userId, companyId\]/.test(service))

section('no caller can mark another user\'s notifications read')
ok('the read routes take no userId', !/req\.body\.userId|req\.query\.userId|req\.params\.userId/.test(controller))
ok('the user comes from the verified session', /const userId = ctx\.userId/.test(controller))
// Both guards, located: the null check and the numeric check. Removing either
// one alone must fail, so neither may be satisfied by the other being present.
const resolveUser = controller.slice(controller.indexOf('const resolveUser'), controller.indexOf('const resolveCompany'))
ok('a missing userId fails closed',
  /userId === null \|\| userId === undefined/.test(resolveUser) && /USER_REQUIRED/.test(resolveUser))
ok('the missing-id guard really returns', /throw error/.test(resolveUser))
ok('a non-numeric userId fails closed', /!Number\.isInteger\(numeric\) \|\| numeric <= 0/.test(resolveUser))
ok('neither guard falls back to a default user', !/userId = 1|\|\| 1\b/.test(resolveUser))
ok('the service is never handed a caller-supplied id',
  !/userId: req\./.test(controller) && !/userId: body\./.test(controller))

section('the company is verified, not trusted')
const companyFn = controller.slice(controller.indexOf('const resolveCompany'), controller.indexOf('/** Anything already carrying a status'))
ok('a company id is required', /COMPANY_REQUIRED/.test(companyFn))
ok('it must be a positive integer', /must be a positive integer/.test(companyFn))
// The whole statement, so appending OR 1=1 is caught. A prefix check would pass.
ok('it is checked against the tenant, exactly',
  /SELECT mc_company_id FROM master_company WHERE mc_company_id = \? LIMIT 1/.test(companyFn))
ok('the lookup cannot be widened', !/OR 1=1|OR TRUE/i.test(companyFn))
ok('an unknown company is indistinguishable from a missing one', /Unknown company for this account/.test(companyFn))

section('mounting')
ok('the router is mounted', /app\.use\('\/notifications', notificationRouter\)/.test(startup))
ok('it sits below auth',
  startup.indexOf('app.use(auth)') >= 0 && startup.indexOf('app.use(auth)') < startup.indexOf("app.use('/notifications'"))
ok('it sits above the subscription gate',
  startup.indexOf("app.use('/notifications'") > 0 &&
    startup.indexOf("app.use('/notifications'") < startup.indexOf('app.use(requireSubscription)'),
  'a lapsed tenant still needs to be told their plan lapsed')
ok('the subscription gate itself is still mounted', /app\.use\(requireSubscription\)/.test(startup))
ok('it carries no module gate of its own', !/requireModule/.test(routes))
ok('the reason is documented', /cross-cutting/.test(routes))
ok('the gate audit has a stated reason for the mount',
  read(path.join(ROOT, 'scripts/test-module-gate-audit.js')).includes("'/notifications'"))

section('routes')
ok('list', /notificationRouter\.get\('\/'/.test(routes))
ok('unread count', /notificationRouter\.get\('\/unread-count'/.test(routes))
ok('mark one read', /notificationRouter\.post\('\/:id\/read'/.test(routes))
ok('mark all read', /notificationRouter\.post\('\/read-all'/.test(routes))
// /:id/read would otherwise swallow /read-all.
ok('the static route is declared before the parameterised one',
  routes.indexOf("'/read-all'") < routes.indexOf("'/:id/read'"))

section('input is validated at the boundary')
ok('a title is required', /title is required/.test(service))
ok('the title has a length limit', /title\.length > 200/.test(service))
ok('a type is required', /type is required/.test(service))
ok('severity is restricted to the three values', /SEVERITIES = new Set\(\['info', 'warning', 'critical'\]\)/.test(service))
ok('an unknown severity is rejected', /unknown severity/.test(service))

section('read state reaches the client')
ok('the join marker is selected, not just the base columns',
  /SELECT nt\.\*, r\.\$\{nr\.selectOptionColumns\.id\} AS read_marker/.test(service),
  'SELECT nt.* alone would make isRead false for every row')
ok('isRead reads that marker', /isRead: row\.read_marker !== null/.test(service))

section('the actor is not notified about their own actions')
// The push excludes the actor. The list has to agree, or the badge would count
// notifications that were never pushed to that browser.
const listFn = service.slice(service.indexOf('const listForUser'), service.indexOf('const unreadCount'))
ok('the list excludes the reader\'s own notifications',
  /actor_user_id\} IS NULL[\s\S]{0,140}?actor_user_id\} <> \?/.test(listFn))
const countFn2 = service.slice(service.indexOf('const unreadCount'), service.indexOf('const markRead'))
ok('the badge excludes them too',
  /actor_user_id\} IS NULL[\s\S]{0,140}?actor_user_id\} <> \?/.test(countFn2))
ok('a null actor is never excluded',
  /actor_user_id\} IS NULL/.test(listFn) && /actor_user_id\} IS NULL/.test(countFn2))

section('positional parameters follow placeholder order')
// A swapped pair here returns an empty list while the count still looks right,
// which is exactly the failure this caught in review.
// The calls go through the tenant-guarded q() wrapper, not Query() directly -
// see test-notification-tenant-scope.cjs for why that matters.
const listArgs = (listFn.match(/\bq\(sql, \[([^\]]*)\]/) || [])[1]
ok('the list binds reader, company, reader',
  !!listArgs && /userId,\s*companyId,\s*userId/.test(listArgs), listArgs || 'no match')
const countArgs = (countFn2.match(/\bq\(sql, \[([^\]]*)\]/) || [])[1]
ok('the count binds reader, company, reader',
  !!countArgs && /userId,\s*companyId,\s*userId/.test(countArgs), countArgs || 'no match')

section('recipients')
ok('active users only', /mu_status = 'active'/.test(service))
ok('the actor is excluded by id, not by name', /AND mu_id <> \?/.test(service))
ok('exclusion is optional for system events',
  /excludeUserId !== null && excludeUserId !== undefined/.test(service))
ok('the row is written before the push',
  service.indexOf('const created = await createNotification(input)') < service.indexOf('pushToUsers('))
ok('a duplicate key is not pushed again',
  /created\.duplicate\) return \{ \.\.\.created, pushed: 0 \}/.test(service))
ok('the push is addressed per user',
  /pushToUsers\(input\.dbName, recipients, 'notification:new'/.test(service))

section('the client hook')
const hook = read(path.join(ROOT, 'client/src/hooks/useNotifications.js'))
ok('it exists', hook.length > 0)
ok('it takes its count from the server, never decrementing locally',
  /json\.data\?\.unreadCount/.test(hook) && !/setUnreadCount\(\(count\) => count - 1\)/.test(hook))
ok('it treats a push as an insert, not a refetch storm',
  /type !== 'notification:new'/.test(hook))
ok('a replayed push cannot duplicate a row',
  /current\.some\(\(n\) => n\.id === incoming\.id\)/.test(hook))
ok('a failed mark-read rolls back rather than lying',
  /setItems\(\(current\) =>\s*\n\s*current\.map\(\(n\) => \(n\.id === id \? \{ \.\.\.n, isRead: true \} : n\)\),\s*\n\s*\)/.test(hook) &&
    /await refresh\(\)/.test(hook))
ok('it reuses the shared realtime helper',
  /from '\.\.\/utils\/realtimeSocket'/.test(hook) && /connectRealtime\(/.test(hook))
ok('it never trusts a read flag from the push', /isRead: false/.test(hook))
ok('it resolves the company once and caches it',
  /notifications_company_id/.test(hook) && /sessionStorage\.setItem/.test(hook))

console.log(failed ? '\n  ' + failed + ' failed' : '\n  all notification core checks passed')
process.exit(failed ? 1 : 0)