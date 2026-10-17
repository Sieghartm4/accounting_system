/**
 * Phase 4: the two surfaces.
 *
 * The header bell and the notifications page show the same data, so the risk
 * here is drift - one gets wired to the hook directly and opens its own socket,
 * and the sidebar badge disagrees with the header for a moment after a push.
 *
 * These checks pin the shape: one provider, one socket, one list component, and
 * a page that is permission filtered rather than module gated.
 */
'use strict'

const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')
const CLIENT = path.join(ROOT, 'client/src')
const SERVER = path.join(ROOT, 'server/src')
const read = (p) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n')

let failed = 0
const ok = (label, pass, detail) => {
  if (!pass) failed++
  console.log('  ' + (pass ? 'ok   ' : 'FAIL ') + label + (detail && !pass ? '  -> ' + detail : ''))
}
const section = (t) => console.log('\n' + t)

const layout = read(path.join(CLIENT, 'components/layout/Layout.jsx'))
const header = read(path.join(CLIENT, 'components/layout/Header.jsx'))
const sidebar = read(path.join(CLIENT, 'components/layout/Sidebar.jsx'))
const ctx = read(path.join(CLIENT, 'components/layout/NotificationContext.jsx'))
const list = read(path.join(CLIENT, 'components/NotificationList.jsx'))
const app = read(path.join(CLIENT, 'App.jsx'))
const routes = read(path.join(CLIENT, 'utils/routeProtection.js'))
const seeder = read(path.join(SERVER, 'database/seeders/20260206025103-master_route_access.js'))

section('one notification state for the whole shell')
ok('the provider is mounted in the layout', /<NotificationProvider>/.test(layout))
ok('it wraps the sidebar and the header',
  layout.indexOf('<NotificationProvider>') < layout.indexOf('<Sidebar') &&
  layout.indexOf('</NotificationProvider>') > layout.indexOf('<Header'))
ok('the provider is where the hook is called', /useNotifications\(\)/.test(ctx))

// One hook call in the whole client. Three would mean three sockets and three
// fetches, and a moment where the two badges disagree.
const hookCallers = []
const walk = (dir) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full)
    else if (/\.(jsx|js)$/.test(entry.name)) {
      const src = read(full)
      if (/useNotifications\(\)/.test(src)) hookCallers.push(path.relative(CLIENT, full))
    }
  }
}
walk(CLIENT)
ok('exactly one file calls the hook', hookCallers.length === 1, hookCallers.join(', '))
ok('and it is the provider',
  (hookCallers[0] || '').replace(/\\/g, '/') === 'components/layout/NotificationContext.jsx')
ok('the header reads the context', /useNotificationsState\(\)/.test(header) && !/useNotifications\(\)/.test(header))
ok('the sidebar reads the context', /useNotificationsState\(\)/.test(sidebar) && !/useNotifications\(\)/.test(sidebar))
ok('the context falls back safely outside a provider',
  /value \|\| \{[\s\S]*unreadCount: 0/.test(ctx))

section('the header bell')
ok('the static button is gone',
  !/bg-red-600 rounded-full border-2 border-white"><\/span><\/button>\s*<div className="h-8 w-px/.test(header),
  'the hard-coded dot showed on every account')
ok('the badge shows the server count', /unreadCount > 0 && \(/.test(header))
ok('it caps at 99+', /unreadCount > 99 \? '99\+'/.test(header))
ok('it uses tabular figures so it does not jitter', /tabular-nums/.test(header))
ok('it has an accessible label carrying the count', /aria-label=\{`Notifications\$\{unreadCount/.test(header))
ok('the dropdown closes on outside click', /bellRef\.current && !bellRef\.current\.contains\(e\.target\)/.test(header))
// "View all" was removed on request. The dropdown is a triage surface: the
// Unread/Read tabs, the per-item badges and the sidebar counts are how you find
// things, and a link out to a separate page was a third way to do the same job.
ok('the dropdown no longer links out to a separate page',
  !/navigate\('\/notifications'\)/.test(header) && !/View all/.test(header))
ok('it still marks items read and follows their document',
  /if \(item\.link\) navigate\(item\.link\)/.test(list),
  'the deep link is how a notification is actioned')
ok('it renders the shared list', /<NotificationList/.test(header))

section('the sidebar badge')
ok('the nav link accepts a badge', /\{ to, icon: Icon, children, badge \}/.test(sidebar))
ok('the count is suppressed when collapsed, where it is unreadable',
  /badge > 0 && !isCollapsed/.test(sidebar) && /badge > 0 && isCollapsed/.test(sidebar))
ok('it caps at 99+', /badge > 99 \? '99\+'/.test(sidebar))
// There is no notifications nav row to badge any more - the counts live on the
// screens the notifications are about. Bell stays imported for the group pills.
ok('Bell is in the existing icon import, not a duplicate one',
  (sidebar.match(/from 'lucide-react'/g) || []).length === 1 && /^  Bell,$/m.test(sidebar))
ok('no nav row is special-cased for notifications',
  !/item\.name === 'notifications' \? Bell/.test(sidebar))

section('both surfaces share one list')
ok('the dropdown is the compact form', /compact\b/.test(header))
ok('read state is never decided in the component',
  !/item\.isRead = |setIsRead/.test(list) && /const unread = item\.isRead === false/.test(list))
ok('clicking marks read before navigating',
  /if \(!item\.isRead\) \{[\s\S]{0,200}?await onMarkRead\(item\.id\)/.test(list) &&
    /if \(item\.link\) navigate\(item\.link\)/.test(list))
ok('the change list renders from -> to', /line-through/.test(list) && /{'\u200b-&rarr;'|'rarr'/.test(list) || /&rarr;/.test(list))
ok('an empty change list is handled', /!Array\.isArray\(changes\) \|\| changes\.length === 0/.test(list))
ok('relative time degrades on a bad value', /Number\.isNaN\(then\)/.test(list))

section('there is no notifications page')
// Removed on request. These are here so it cannot creep back in as an
// unreachable route, a route_access row granting nothing, or a nav entry.
ok('no route is registered', !/path="notifications?"/.test(app))
ok('the page component is not imported', !/pages\/notifications/.test(app))
ok('the import is gone entirely', !/from '\.\/pages\/notifications/.test(app))
ok('no route config entry remains',
  !/notifications:\s*\{\s*\n\s*name: 'notifications'/.test(routes))
ok('and nothing pushes it into nav',
  !/ROUTE_CONFIG\.notifications/.test(routes) && !/hasRouteAccess\('notifications'/.test(routes))
ok('the reason it went is documented where the route used to be',
  /There is no notifications page/.test(app))
ok('the seeder no longer grants a route to nothing',
  !/'notifications',/.test(seeder))
ok('the seeder explains why',
  /'notifications' used to be seeded here for a standalone page/.test(seeder))
ok('the migration that granted it is deleted',
  !fs.existsSync(path.join(SERVER,
    'database/migrations/create/20261016130000-grant-notifications-route-access.js')))
section('the surfaces can report their own state')
ok('the dropdown passes the same handlers',
  /onRefresh=\{refreshNotifications\}/.test(header) && /onMarkAllRead=\{markAllRead\}/.test(header))

console.log(failed ? '\n  ' + failed + ' failed' : '\n  all notification surface checks passed')
process.exit(failed ? 1 : 0)
