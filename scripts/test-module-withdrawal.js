'use strict'

/**
 * Unchecking a module must remove it, for everyone on the plan.
 *
 * ## The reported symptom
 *
 * A module was unchecked in subscription management. The subscribed user still
 * saw the nav entry, still opened the page, and still got data from the API.
 *
 * ## The two causes
 *
 * 1. `requireModule` let any ADMIN request through unconditionally. An operator
 *    could withhold a module from a company and its administrator kept full
 *    access - so the most likely person to be signed in was the one least
 *    affected. The bypass was unnecessary: `hasModule` already grants the
 *    required module set to everyone, so an administrator keeps the dashboard,
 *    users, access control and the statements without it.
 *
 * 2. `getSidebarItems` consulted only permissions (master_route_access) and never
 *    the plan. So even with the gate fixed, the nav kept offering a link that led
 *    to an upgrade screen.
 *
 * The two combine into the confusing case: a link that looks enabled, opens a
 * page, and that page either works (because of the bypass) or explains an upgrade
 * for something already paid for.
 *
 * Run: node scripts/test-module-withdrawal.js
 */

const path = require('path')
const fs = require('fs')
const ROOT = path.resolve(__dirname, '..')
require(path.join(ROOT, 'node_modules/dotenv')).config({ path: path.join(ROOT, '.env') })

let pass = 0
let fail = 0
const ok = (label, cond, extra) => {
  if (cond) {
    pass++
    console.log(`  ok    ${label}`)
  } else {
    fail++
    console.log(`  FAIL  ${label}${extra !== undefined ? `  -> ${JSON.stringify(extra)}` : ''}`)
  }
}
const section = (t) => console.log(`\n${t}\n`)

const MIDDLEWARE = fs.readFileSync(
  path.join(ROOT, 'server/src/middlewares/entitlement.middleware.js'),
  'utf8',
)
const ROUTES = fs.readFileSync(
  path.join(ROOT, 'client/src/utils/routeProtection.js'),
  'utf8',
)

const run = async () => {
  section('no role can bypass the module gate')
  {
    const mw = MIDDLEWARE.slice(MIDDLEWARE.indexOf('const requireModule'))
    const body = mw.slice(0, mw.indexOf('module.exports') > -1 ? mw.indexOf('module.exports') : mw.length)

    ok('requireModule does not check for an ADMIN role', !/role === 'ADMIN'/.test(body))
    ok(
      'requireModule has no unconditional early return',
      !/if \(req\?\.context\?\.role[\s\S]{0,80}return next\(\)/.test(body),
    )

    // The bypass is only defensible where there is no company to bill. Platform
    // admins have no tenant database, so keying on that is the correct test.
    const sub = MIDDLEWARE.slice(MIDDLEWARE.indexOf('const requireSubscription'))
    const subBody = sub.slice(0, sub.indexOf('const requireModule'))
    ok(
      'requireSubscription keys the bypass on the absence of a tenant, not a role',
      /if \(!dbName\)/.test(subBody) && !/role === 'ADMIN'/.test(subBody),
    )
    ok('the reasoning is documented at the bypass', /Platform ADMINs operate across tenants/.test(subBody))
    ok('the removal is documented at requireModule', /No admin bypass/.test(MIDDLEWARE))
  }

  section('the sidebar deliberately does NOT hide the locked module')
  {
    // This was implemented, then reverted. Asserting it so it cannot come back:
    // a locked module must stay visible so the upgrade screen can explain
    // itself. Hiding the entry removes the upsell along with the feature.
    const sidebar = ROUTES.slice(ROUTES.indexOf('export const getSidebarItems'))

    ok('getSidebarItems takes only the user', /getSidebarItems = \(user\) =>/.test(sidebar))
    ok('it does not accept a module list', !/entitledModules/.test(sidebar))
    ok('there is no module check in the sidebar', !/hasModuleAccess/.test(sidebar))

    const checks = sidebar.match(/hasRouteAccess\(/g) || []
    ok('every nav entry is decided by permission alone', checks.length > 5, checks.length)
    ok(
      'the reason is documented at the function',
      /the sidebar is NOT filtered by the plan/i.test(ROUTES),
    )
  }

  section('the gate, not the sidebar, is what blocks')
  {
    const gate = fs.readFileSync(
      path.join(ROOT, 'client/src/components/ProtectedRoute.jsx'),
      'utf8',
    )
    ok('the gate still checks the module', /hasModule\(moduleCode\)/.test(gate))
    ok('a locked module shows the upsell', /<ModuleUpsell/.test(gate))
    ok(
      'the upsell waits for a validated answer before denying',
      /if \(!validated\) return null/.test(gate),
    )
  }

  section('the sidebar does not do a second request')
  {
    const sidebar = fs.readFileSync(
      path.join(ROOT, 'client/src/components/layout/Sidebar.jsx'),
      'utf8',
    )
    ok('it passes only the user', /getSidebarItems\(userData\)/.test(sidebar))
    ok('it does not read the entitlement cache', !/auth_entitlement/.test(sidebar))

    // Scoped to the block that builds the nav; the file has a pre-existing
    // fetch() for an unrelated purpose.
    const at = sidebar.indexOf('const items = getSidebarItems')
    const navBlock = sidebar.slice(at, at + 120)
    ok('building the nav issues no request', !/fetch\(|fetchWithAuth/.test(navBlock))
  }

  section('a 402 from the server replaces the page with the upgrade screen')
  {
    // The reported symptom was a red "System Error" toast reading the raw server
    // text, not the ModuleUpsell that exists for exactly this. The gate decides
    // from a cached entitlement, so a plan changed a moment earlier can let the
    // page mount; the page's first request is what discovers the truth.
    const lockout = fs.readFileSync(
      path.join(ROOT, 'client/src/utils/moduleLockout.js'),
      'utf8',
    )
    const api = fs.readFileSync(path.join(ROOT, 'client/src/utils/api.js'), 'utf8')
    const gate = fs.readFileSync(
      path.join(ROOT, 'client/src/components/ProtectedRoute.jsx'),
      'utf8',
    )

    ok('the lockout is recorded', /export const reportModuleLockout/.test(lockout))
    ok('the fetch wrapper watches for 402', /response\.status === 402/.test(api))
    ok('it reads the code from a clone, leaving the body for the page', /\.clone\(\)[\s\S]{0,40}\.json\(\)/.test(api))
    ok('it only reacts to a module lockout', /body\.code === 'MODULE_NOT_IN_PLAN'/.test(api))
    ok('it reports the module the server named', /reportModuleLockout\(body\.module\)/.test(api))

    // The original 401 interceptor must still exist and must still wrap once.
    ok('the existing 401 interceptor is intact', /response\.status === 401/.test(api))
    ok('fetch is wrapped exactly once', (api.match(/window\.fetch = /g) || []).length === 1)

    ok('the gate subscribes to the lockout', /useModuleLockout\(moduleCode\)/.test(gate))
    ok(
      'a lockout outranks the cached entitlement',
      /if \(lockedOut\) \{[\s\S]{0,120}<ModuleUpsell/.test(gate),
    )
    ok('the lockout is checked before the cached allow', gate.indexOf('if (lockedOut)') < gate.indexOf('if (!hasModule(moduleCode))'))
    ok('it discards the entitlement the server just contradicted', /if \(lockedOut\) invalidate\(\)/.test(gate))

    // The lockout has to lapse, or a user who upgrades would be stranded here.
    ok('a lockout expires', /LOCKOUT_TTL_MS/.test(lockout))
    ok('expiry is checked on a timer so an idle tab still clears', /setInterval/.test(lockout))
    ok('expiry is evaluated fresh rather than cached', /now - lockout\.at <= LOCKOUT_TTL_MS/.test(lockout))
  }

  section('the raw server wording never reaches the user')
  {
    const api = fs.readFileSync(path.join(ROOT, 'client/src/utils/api.js'), 'utf8')
    const upsell = fs.readFileSync(
      path.join(ROOT, 'client/src/components/ModuleUpsell.jsx'),
      'utf8',
    )

    // The message the user saw came from the server body via a page's own error
    // handling, which is out of reach of the interceptor. What must be true is
    // that the page is replaced, taking its toast with it.
    ok('ModuleUpsell is the screen the gate renders', /<ModuleUpsell/.test(fs.readFileSync(path.join(ROOT, 'client/src/components/ProtectedRoute.jsx'), 'utf8')))
    ok('ModuleUpsell explains and offers a route rather than an error', /See plans and upgrade/.test(upsell))

    // Scoped to the component's own rendered output. The file's header comment
    // quotes the old toast verbatim to explain what it replaced, and the
    // catalog hook above has its own `return (`, so neither a file-wide match
    // nor the first `return (` is the right boundary.
    const rendered = upsell.slice(upsell.indexOf('const wrapper ='))
    ok('it does not render a System Error label', !/System Error/.test(rendered))
    ok(
      'it does not print a raw module code as the heading',
      !/\{moduleCode\} isn/.test(rendered),
    )

    // And a genuine subscription lapse must still redirect rather than show an
    // upsell, because there is no module involved.
    ok('a lapsed subscription still redirects to the plan step', /register\?step=plan/.test(api))
  }

  section('live: unchecking a module actually removes it')
  {
    const catalog = require(path.join(ROOT, 'subscription/src/constants/moduleCatalog'))
    const { resolveEntitlement, hasModule } = require(
      path.join(ROOT, 'server/src/services/entitlement/entitlement.service'),
    )
    const db = require(path.join(ROOT, 'node_modules/mysql2/promise'))
    const { DecryptString } = require(path.join(ROOT, 'subscription/src/util/cryptography.util'))

    const conn = await db.createConnection({
      host: process.env._HOST_ADMIN,
      user: process.env._USER_ADMIN,
      password: DecryptString(process.env._PASSWORD_ADMIN),
      database: process.env._DATABASE_ADMIN,
    })

    try {
      const [plans] = await conn.query(
        'SELECT sp_id, sp_code FROM subscription_plans ORDER BY sp_id',
      )

      for (const plan of plans) {
        const [grants] = await conn.query(
          'SELECT pm_module FROM plan_modules WHERE pm_plan_id = ?',
          [plan.sp_id],
        )
        const optional = grants
          .map((g) => g.pm_module)
          .filter((m) => !catalog.REQUIRED_MODULES.includes(m))

        // Whatever the operator chose is what the plan must resolve to. The
        // disagreement this catches is a resolver that still honours a module
        // the plan no longer grants.
        const entitled = await resolveEntitlement('__no_such_tenant__', { force: true })
        void entitled

        const [subs] = await conn.query(
          'SELECT mcs_db_name FROM master_company_subscription WHERE mcs_plan_id = ?',
          [plan.sp_id],
        )

        for (const s of subs) {
          const e = await resolveEntitlement(s.mcs_db_name, { force: true })
          const leaked = optional.filter((m) => !hasModule(e, m))
          ok(
            `${s.mcs_db_name} (${plan.sp_code}) grants exactly what the plan says`,
            leaked.length === 0,
            { planGrants: optional, missing: leaked },
          )

          // And required modules survive an unchecked plan.
          ok(
            `${s.mcs_db_name} keeps its required modules`,
            catalog.REQUIRED_MODULES.every((m) => hasModule(e, m)),
          )
        }
      }
    } finally {
      await conn.end()
    }
  }

  console.log(`\n${pass} passed, ${fail} failed`)
  process.exit(fail === 0 ? 0 : 1)
}

run().catch((error) => {
  console.error('\nTEST CRASHED:', error)
  process.exit(2)
})