/**
 * Two things the user reported, both of which only showed up in use:
 *
 *   1. A sidebar badge survived arriving at the page it was warning about, so it
 *      was indistinguishable from a badge that is stuck.
 *   2. Read and unread notifications looked alike in the header dropdown.
 *
 * There is also a bug found while building the first one: markModuleRead and
 * markAllRead both insert into notification_reads while joining notification_reads
 * as `r`, so an unqualified `nr_read_at = nr_read_at` is ambiguous and MySQL
 * rejects the statement. "Mark all read" had been failing on every click.
 */
'use strict'

const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')
const CLIENT = path.join(ROOT, 'client/src')
const SRV = path.join(ROOT, 'server/src')
const read = (p) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n')

let failed = 0
const ok = (label, pass, detail) => {
  if (!pass) failed++
  console.log('  ' + (pass ? 'ok   ' : 'FAIL ') + label + (detail && !pass ? '  -> ' + detail : ''))
}

const service = read(path.join(SRV, 'services/notification/notification.service.js'))
const controller = read(path.join(SRV, 'controller/notification.controller.js'))
const routes = read(path.join(SRV, 'routes/notification.routes.js'))
const hook = read(path.join(CLIENT, 'hooks/useNotifications.js'))
const ctx = read(path.join(CLIENT, 'components/layout/NotificationContext.jsx'))
const sidebar = read(path.join(CLIENT, 'components/layout/Sidebar.jsx'))
const list = read(path.join(CLIENT, 'components/NotificationList.jsx'))
const header = read(path.join(CLIENT, 'components/layout/Header.jsx'))

console.log('\nclearing a badge for the screen you just opened')
ok('the service can mark one module read',
  /const markModuleRead = async \(\{ companyId, userId, module, dbName \}\)/.test(service))
ok('it refuses an empty module',
  /if \(!target\) throw httpError\('module is required'/.test(service))
ok('it is scoped to the company', /nt\.\$\{n\.selectOptionColumns\.company_id\} = \?/.test(service))
ok('it skips the reader own actions, like mark-all-read',
  /actor_user_id\} <> \?/.test(service))
ok('it ignores expired rows', /expires_at\} > NOW\(\)/.test(service))
ok('it goes through the tenant guard', /await q\(sql, \[userId, userId, companyId, target, userId\], dbName\)/.test(service))

console.log('\nthe ambiguous read_at that broke "Mark all read"')
// These statements insert into notification_reads and also join it as `r`, so an
// unqualified read_at reference is ambiguous. MySQL error 1052.
const insertSelect = service.slice(
  service.indexOf('const markModuleRead'), service.indexOf('const markAllRead')) +
  service.slice(service.indexOf('const markAllRead'), service.indexOf('/**\n * Turn the document'))
ok('markModuleRead qualifies it',
  /ON DUPLICATE KEY UPDATE \$\{nr\.tablename\}\.\$\{nr\.selectOptionColumns\.read_at\}/.test(insertSelect))
ok('markAllRead qualifies it too',
  /ON DUPLICATE KEY UPDATE \$\{nr\.tablename\}\.\$\{nr\.selectOptionColumns\.read_at\}/.test(
    service.slice(service.indexOf('const markAllRead'))))
ok('no unqualified read_at self-assignment is left in either',
  !/ON DUPLICATE KEY UPDATE \$\{nr\.selectOptionColumns\.read_at\} = \$\{nr\.selectOptionColumns\.read_at\}/.test(
    insertSelect))

console.log('\nthe endpoint')
ok('the controller returns both totals, so header and sidebar agree',
  /unreadByModule: byModule/.test(controller) &&
  /Promise\.all\(\[\s*unreadCount\(\{[\s\S]{0,90}?unreadCountByModule/.test(controller))
ok('mark-all-read also clears the per-module badges',
  /data: \{ unreadCount: 0, unreadByModule: byModule \}/.test(controller),
  'otherwise the sidebar keeps numbers the header says are gone')
ok('the route exists', /notificationRouter\.post\('\/read-by-module', postMarkModuleRead\)/.test(routes))
// Strip comments first: the explanatory comment above the route also contains
// the string "/:id/read", which made a plain indexOf compare the wrong thing.
const routeLines = routes
  .split('\n')
  .filter((l) => !l.trim().startsWith('//'))
  .join('\n')
ok('it is registered before /:id/read',
  routeLines.indexOf('/read-by-module') < routeLines.indexOf('/:id/read'),
  'otherwise "read-by-module" is swallowed as an id')

console.log('\nthe three vocabularies line up')
// Server groups by `collection`; the route and the nav row are `collections`.
ok('collections is mapped to the collection module',
  /collections: 'collection'/.test(hook))
ok('there is one shared map for nav rows',
  /NAV_TO_MODULE = \{/.test(hook) && /collections: 'collection'/.test(
    hook.slice(hook.indexOf('NAV_TO_MODULE'))))
ok('recurring journals is mapped across its hyphen',
  /'recurring-journals': 'recurring_journals'/.test(hook))
ok('sidebar rows look up by module, not by route name',
  /unreadByModule\[NAV_TO_MODULE\[item\.name\] \|\| item\.name\]/.test(sidebar))
ok('group totals go through the same map',
  /unreadByModule\[NAV_TO_MODULE\[name\] \|\| name\]/.test(sidebar))
ok('the sales group lists the nav name',
  /SALES_GROUP = \['sales', 'collections'\]/.test(sidebar))

console.log('\nopening the page clears it')
ok('the provider maps the path to a module', /moduleForPath\(pathname\)/.test(ctx))
ok('it calls markModuleRead on arrival', /value\.markModuleRead\(module\)/.test(ctx))
ok('it does nothing when the module has no unread',
  /if \(count === 0\) return/.test(ctx))
// Arriving clears; staying does not. Keying the clear on the unread count made
// every notification that arrived while you were already on the screen get wiped
// on arrival, so editing a purchase produced a notification that was marked read
// within a second and the badge never appeared.
ok('a notification arriving on the current screen does NOT clear it',
  /if \(previousPath === pathname\) return/.test(ctx),
  'this is what made edits look like they produced nothing')
ok('a real navigation does clear',
  /prevPathRef\.current = pathname/.test(ctx))
ok('the memo is a Map, which is what .get/.set need',
  /useRef\(new Map\(\)\)/.test(ctx) && !/useRef\(new Set\(\)\)/.test(ctx),
  'a Set has no .get or .set; this was a crash on every mount')
ok('the clear is not keyed on the count any more',
  !/clearedRef/.test(ctx) && !/\.set\(key, count\)/.test(ctx),
  'keying on count is what cleared notifications you had not seen yet')
ok('a revisit to the same screen is still cleared',
  /arrivalRef\.current \+= 1/.test(ctx) &&
  /clearedArrivalRef\.current\.get\(key\) === arrival/.test(ctx),
  'keying on the pathname meant coming back looked like the first visit')
ok('the hook skips the request when nothing is unread',
  /if \(!unreadByModuleRef\.current\[target\]\) return/.test(hook))
ok('it takes both totals from the one response',
  /setUnreadByModule\(json\.data\.unreadByModule\)/.test(hook))
ok('the rows are updated to read too, not just the counts',
  /n\.module === target && n\.isRead === false/.test(hook))
ok('reading one item also drops its module badge',
  /const remaining = \(current\[target\.module\] \|\| 0\) - 1/.test(hook),
  'otherwise the sidebar keeps a number after the row was read')

console.log('\nread and unread are told apart at a glance')
ok('unread rows carry an accent bar', /border-l-blue-600/.test(list))
ok('read rows do not', /border-l-transparent/.test(list))
ok('unread rows are tinted', /bg-blue-50 hover:bg-blue-100/.test(list))
ok('read rows recede', /opacity-75/.test(list))
ok('unread titles are heavier', /font-extrabold text-slate-900/.test(list))
ok('read titles are lighter', /font-medium text-slate-500/.test(list))
ok('the icon is desaturated once read', /grayscale/.test(list))
ok('there is an explicit label either way',
  /bg-blue-600 px-1\.5[\s\S]{0,120}?New\s*<\/span>/.test(list) && /Read\s*<\/span>/.test(list))
// The tabs are the shell, not part of the list. When they were rendered by
// the branch that draws the rows, an empty Unread tab removed the whole bar and
// left a "Show read" button as the only way back - a dead end.
ok('the tab bar is the outer shell', /const tabBar = \(/.test(list))
ok('every state renders inside it', /const body = \(\) =>/.test(list) && /\{tabBar\}\s*\{body\(\)\}/.test(list))
ok('there are no early returns that bypass it',
  !/^  if \((loading|error|!items|visible\.length)/m.test(list),
  'an early return would hide the tabs again')
ok('the caught-up state keeps the tabs',
  /You are all caught up/.test(list) && !/Show read/.test(list.replace(/\*[^\n]*Show read[^\n]*/g, '')))
ok('both tabs carry a count',
  /Unread[\s\S]{0,400}?\{unreadCount\}/.test(list) &&
  /Read[\s\S]{0,400}?\{readCount\}/.test(list))
ok('an empty Unread tab points at Read',
  /notification\$\{readCount === 1 \? '' : 's'\} in Read\./.test(list))
// Sticky is easy to write and easy to silently defeat: position:sticky binds to
// the nearest scrolling ancestor, and overflow:hidden counts as one. An
// overflow-hidden wrapper between the bar and the real scroller means the bar
// never moves, with no error anywhere.
ok('the tab bar is sticky', /sticky top-0 z-20/.test(list))
ok('its background is opaque, or rows show through it',
  /sticky top-0 z-20[^\n]*bg-slate-50/.test(list))
ok('the shell between the bar and the scroller does not trap it',
  !/return \(\s*<div className="[^"]*overflow/.test(list),
  'an overflow-hidden ancestor would become the scrollport and freeze the bar')
ok('the dropdown actually scrolls', /max-h-\[420px\] overflow-y-auto/.test(header))
// The page is gone, so the only scroll container left is the header dropdown's.
ok('the dropdown has no overflow-hidden between the bar and its scroller',
  header.indexOf('overflow-hidden z-50') < header.indexOf('max-h-[420px]'),
  'that wrapper is outside the scroller, which is fine')
ok('the dropdown opens on Unread',
  /const \[showRead, setShowRead\] = useState\(false\)/.test(list) &&
  /showRead \? items : items\.filter\(\(n\) => n\.isRead === false\)/.test(list))
ok('being caught up is its own state, not an empty list',
  /You are all caught up/.test(list))

console.log(failed ? `\n  ${failed} failed` : '\n  badges clear on arrival and read state is visible')
process.exit(failed ? 1 : 0)