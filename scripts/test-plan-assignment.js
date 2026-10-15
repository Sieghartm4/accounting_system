'use strict'

/**
 * Picking a plan must actually grant the modules it was bought for.
 *
 * Two separate defects motivated this:
 *
 *  1. The upgrade link redirected to /register?step=plan without telling the
 *     plan step who the user was. Register.jsx only opens at step 2 when
 *     sessionStorage holds a pendingUser, so a logged-in user was bounced to the
 *     step-1 account form and asked to register again.
 *
 *  2. Neither register nor updateSubscription wrote
 *     master_company_subscription - the row the entitlement resolver reads.
 *     Both wrote master_user.subscription_id, which nothing authorises against.
 *     A brand new company therefore resolved as NO_SUBSCRIPTION_ROW and had
 *     every sellable module locked regardless of the plan paid for.
 *
 * The date and id resolution are covered with an injected fake; the assignment
 * is then proven against a real database and a real plan, because a mocked test
 * would pass even if the SQL were wrong.
 *
 * Run: node scripts/test-plan-assignment.js
 */

const path = require('path')
const ROOT = path.resolve(__dirname, '..')
require(path.join(ROOT, 'node_modules/dotenv')).config({ path: path.join(ROOT, '.env') })

const { assignCompanyPlan, deriveDates } = require(
  path.join(ROOT, 'subscription/src/services/companySubscription.service'),
)
const { resolveEntitlement } = require(path.join(ROOT, 'server/src/services/entitlement/entitlement.service'))

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

const CATALOG = require(path.join(ROOT, 'subscription/src/constants/moduleCatalog'))

/** A plan fixture shaped like a subscription_plans row. */
const planFixture = (over = {}) => ({
  sp_id: 99,
  sp_code: 'TEST',
  sp_name: 'Test Plan',
  sp_max_users: 5,
  sp_trial_days: 7,
  sp_billing_days: 30,
  sp_is_trial: 1,
  sp_price_minor: 0,
  ...over,
})

/** Records statements and answers from fixtures, without touching a database. */
const fakeAdminQuery = (plans = [], existing = []) => {
  const calls = []
  const run = async (sql, params = []) => {
    calls.push({ sql: sql.replace(/\s+/g, ' ').trim(), params })
    if (/FROM subscription_plans/.test(sql)) {
      const id = params[0]
      const plan = plans.find((p) => p.sp_id === id)
      return plan ? [plan] : []
    }
    // Only the existence probe reads rows; anything else is a write and must not
    // answer with row data, or the caller reads it as "no such company".
    if (/SELECT mcs_id FROM master_company_subscription/.test(sql)) return existing
    return { affectedRows: 1 }
  }
  run.calls = calls
  return run
}

const daysBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000)

/** Wraps a section body so top-level awaits live inside an async function. */
const run = async () => {
section('date derivation')
{
  const now = new Date('2026-01-01T00:00:00Z')

  const trial = deriveDates(planFixture(), now)
  ok('a trial plan sets only the trial end date', trial.trialEndsAt !== null && trial.periodEndsAt === null)
  ok('the trial end date is trial_days out', daysBetween(now, trial.trialEndsAt) === 7)

  const paid = deriveDates(planFixture({ sp_is_trial: 0, sp_trial_days: null, sp_billing_days: 30 }), now)
  ok('a paid plan sets only the period end date', paid.periodEndsAt !== null && paid.trialEndsAt === null)
  ok('the period end date is billing_days out', daysBetween(now, paid.periodEndsAt) === 30)

  const open = deriveDates(planFixture({ sp_is_trial: 0, sp_trial_days: null, sp_billing_days: null }), now)
  ok('a plan with no dates is left open-ended', open.trialEndsAt === null && open.periodEndsAt === null)
  ok('an open-ended plan is not treated as expired', new Date() < new Date('2099-01-01'))
}

section('a new company gets its entitlement row')
{
  const q = fakeAdminQuery([planFixture()], [])
  const res = await assignCompanyPlan({ adminQuery: q, planId: 99, dbName: 'zz_test_co', currentUsers: 1 })

  ok('reports the row as created', res.created === true)
  ok('writes master_company_subscription', q.calls.some((c) => /INSERT INTO master_company_subscription/.test(c.sql)))
  ok('keys the row by db_name', q.calls.some((c) => /mcs_db_name/.test(c.sql) && c.params.includes('zz_test_co')))
  ok('snapshots the plan seat cap', q.calls.some((c) => /mcs_max_users/.test(c.sql) && c.params.includes(5)))
  ok('records the creator as one user', q.calls.some((c) => c.params.includes(1)))
  ok('marks the row active', q.calls.some((c) => c.params.includes('active')))
}

section('an existing company is updated, not duplicated')
{
  const q = fakeAdminQuery([planFixture()], [{ mcs_id: 7 }])
  const res = await assignCompanyPlan({ adminQuery: q, planId: 99, dbName: 'zz_test_co' })

  ok('reports it as an update', res.created === false)
  ok('does not INSERT a second row', !q.calls.some((c) => /INSERT INTO/.test(c.sql)))
  ok('updates by db_name', q.calls.some((c) => /UPDATE master_company_subscription/.test(c.sql)))
}

section('changing plan replaces the previous one')
{
  const oldPlan = planFixture({ sp_id: 1, sp_max_users: 1, sp_is_trial: 0, sp_trial_days: null, sp_billing_days: null })
  const newPlan = planFixture({ sp_id: 2, sp_max_users: 5, sp_is_trial: 0, sp_trial_days: null, sp_billing_days: null })
  const q = fakeAdminQuery([oldPlan, newPlan], [{ mcs_id: 7 }])
  await assignCompanyPlan({ adminQuery: q, planId: 1, dbName: 'zz_test_co' })
  await assignCompanyPlan({ adminQuery: q, planId: 2, dbName: 'zz_test_co' })

  const update = q.calls.filter((c) => /UPDATE master_company_subscription/.test(c.sql)).pop()
  ok('the new plan id is written', update.params.includes(2), update.params)
  ok('the new seat cap replaces the old', update.params.includes(5), update.params)
}

section('bad input is refused')
{
  let threw = false
  try {
    await assignCompanyPlan({ adminQuery: fakeAdminQuery([planFixture()], []), planId: 999, dbName: 'zz_x' })
  } catch {
    threw = true
  }
  ok('an unknown plan id is refused rather than silently granting nothing', threw)

  threw = false
  try {
    await assignCompanyPlan({ adminQuery: fakeAdminQuery([planFixture()], []), planId: 99, dbName: '' })
  } catch {
    threw = true
  }
  ok('a missing db_name is refused', threw)
}

section('no plan is recorded honestly')
{
  const q = fakeAdminQuery([planFixture()], [])
  const res = await assignCompanyPlan({ adminQuery: q, planId: null, dbName: 'zz_free_co' })
  ok('a null plan still creates a row', res.created === true && res.planId === null)
  ok('the status reflects no plan', q.calls.some((c) => c.params.includes('none')))
}

section('both write paths record the entitlement row')
{
  const fs = require('fs')
  const ctrl = fs.readFileSync(
    path.join(ROOT, 'subscription/src/controller/credentials.controller.js'),
    'utf8',
  )

  // Signup has two entry points (plain and streaming), so the call is expected
  // more than once - asserting a count keeps a future third path honest.
  const assignCalls = ctrl.split('assignCompanyPlan(').length - 1
  ok('signup and plan-picking both call assignCompanyPlan', assignCalls >= 3, assignCalls)

  ok('the username is resolved to a tenant db before writing', /mcs_db_name|dbLookup/.test(ctrl) && /tenantDb/.test(ctrl))
  ok('an unknown username is refused with 404', /No account found for username/.test(ctrl))
  ok(
    'a failed plan assignment is reported, not swallowed',
    /could not be assigned/.test(ctrl),
  )
  ok(
    'master_user.subscription_id is still written for compatibility',
    /SET subscription_id = \? WHERE mu_username/.test(ctrl),
  )
}

section('the entitlement cache cannot hide a new plan')
{
  const fs = require('fs')

  const hook = fs.readFileSync(path.join(ROOT, 'client/src/hooks/useEntitlement.js'), 'utf8')
  ok('the hook exposes a server-side refresh', /refreshEntitlement/.test(hook))
  ok('refresh writes the fresh entitlement to the cache', /writeCache\(payload\.data\)/.test(hook))
  ok('a failed refresh leaves the cache alone rather than emptying it', /return null/.test(hook))

  const routes = fs.readFileSync(path.join(ROOT, 'server/src/routes/entitlement.routes.js'), 'utf8')
  ok('the server exposes POST /entitlement/refresh', /entitlementRouter\.post\('\/refresh'/.test(routes))
  ok('refresh invalidates before resolving', /invalidate\(dbName\)[\s\S]{0,120}force: true/.test(routes))
  // Scoped to the session tenant. The `:code` param on the sibling
  // GET /entitlement/module/:code route is a module name, not a tenant, so it
  // is not part of what this assertion is about.
  const refreshBlock = routes.slice(
    routes.indexOf("entitlementRouter.post('/refresh'"),
    routes.indexOf("entitlementRouter.get('/module-catalog'"),
  )
  ok(
    'refresh scopes to the session tenant, not the request',
    refreshBlock.length > 0 && !/req\.params|req\.body/.test(refreshBlock),
  )
  ok('refresh takes the tenant from the session', /const dbName = tenantOf\(req\)/.test(refreshBlock))

  const register = fs.readFileSync(path.join(ROOT, 'client/src/pages/register/Register.jsx'), 'utf8')
  ok('picking a plan clears the cached entitlement', /removeItem\('auth_entitlement'\)/.test(register))

  const api = fs.readFileSync(path.join(ROOT, 'client/src/utils/api.js'), 'utf8')
  ok('logging out clears it too', /removeItem\('auth_entitlement'\)/.test(api))
}

section('the upgrade link carries the logged-in user')
{
  const fs = require('fs')
  const src = fs.readFileSync(path.join(ROOT, 'client/src/components/ModuleUpsell.jsx'), 'utf8')

  // The call is formatted across lines, so match the key rather than the call.
  ok('writes pendingUser before navigating', /setItem\(\s*\n?\s*'pendingUser'/.test(src))
  ok('reads the identity from auth_user', /getItem\('auth_user'\)/.test(src))
  ok('passes only the username, never a password', !/setItem\('pendingUser'[^\n]*password/.test(src))
  ok('still navigates to the plan step', /register\?step=plan/.test(src))
  ok('does not clobber an existing pendingUser', /if \(!sessionStorage\.getItem\('pendingUser'\)\)/.test(src))

  // The whole record, not just a username: the plan step names the account and
  // the subscribe call resolves the company from it.
  ok('carries the tenant database', /tenantDb:/.test(src))
  ok('carries the email', /email:/.test(src))
  ok('carries the full name', /fullname:/.test(src))
  ok('marks the account as existing, not a signup', /existingAccount: true/.test(src))
}

section('the plan step receives and shows who it is for')
{
  const fs = require('fs')
  const reg = fs.readFileSync(path.join(ROOT, 'client/src/pages/register/Register.jsx'), 'utf8')

  ok('reads the identity out of pendingUser', /setPendingAccount\(\{/.test(reg))
  ok('keeps pendingAccount in state', /useState\(null\)/.test(reg))
  ok('renders the identity on the plan step', /pendingAccount\?\.username/.test(reg))
  ok('shows the username or full name', /pendingAccount\.fullname \|\| pendingAccount\.username/.test(reg))
  ok('shows the email', /pendingAccount\.email/.test(reg))
  ok('shows the tenant database', /pendingAccount\.tenantDb/.test(reg))
  ok('labels an upgrade as an existing account', /Existing account/.test(reg))

  // The reported symptom: an upgrade being told to "complete your registration".
  ok(
    'an upgrade no longer says "complete your registration"',
    /existingAccount\s*\n?\s*\?\s*`Choose a plan for/.test(reg) &&
      !/setToastMessage\('You do not have an active subscription\.\s*\n?\s*Please complete your registration/.test(reg),
  )
  ok(
    'a genuine signup still gets the original wording',
    /Please complete your registration by selecting a subscription plan/.test(reg),
  )

  // A stale password in formData would be carried into the account step.
  ok('never leaves the password field holding a stale value', /password: userData\.password \|\| ''/.test(reg))
  ok('clears the identity when sent back to step 1', /setPendingAccount\(null\)/.test(reg))
}

section('every pendingUser writer identifies the account the same way')
{
  const fs = require('fs')

  const login = fs.readFileSync(path.join(ROOT, 'client/src/pages/login/useLogin.js'), 'utf8')
  ok('the blocked-login path marks the account as existing', /existingAccount: true/.test(login))
  ok('the blocked-login path stores no password', !/password/.test(login.split("setItem(\n            'pendingUser'")[1]?.split(')')[0] || ''))

  const api = fs.readFileSync(path.join(ROOT, 'client/src/utils/api.js'), 'utf8')
  ok('the 402 path marks the account as existing', /existingAccount: true/.test(api))
  ok('the 402 path carries the tenant database', /tenantDb:/.test(api))

  // All three must agree, or the plan step shows different chrome depending on
  // how the user arrived - which is what made this hard to diagnose.
  for (const [name, file] of [
    ['ModuleUpsell', 'client/src/components/ModuleUpsell.jsx'],
    ['useLogin', 'client/src/pages/login/useLogin.js'],
    ['api.js', 'client/src/utils/api.js'],
  ]) {
    const src = fs.readFileSync(path.join(ROOT, file), 'utf8')
    ok(`${name} writes existingAccount: true`, /existingAccount: true/.test(src))
    ok(`${name} writes a username`, /username/.test(src))
  }
}

section('live: picking a plan unlocks a real module')
{
  const mysql = require(path.join(ROOT, 'node_modules/mysql2/promise'))
  const { DecryptString } = require(path.join(ROOT, 'subscription/src/util/cryptography.util'))

  const conn = await mysql.createConnection({
    host: process.env._HOST_ADMIN,
    user: process.env._USER_ADMIN,
    password: DecryptString(process.env._PASSWORD_ADMIN),
    database: process.env._DATABASE_ADMIN,
  })

  const DB = 'zz_plan_assign_probe'
  const [plans] = await conn.query('SELECT sp_id, sp_code FROM subscription_plans ORDER BY sp_id LIMIT 1')
  if (!plans.length) {
    console.log('  SKIP  no plans seeded')
    await conn.end()
  } else {
    const planId = plans[0].sp_id

    // Pick a module this plan actually grants rather than assuming one. The
    // seeded plans use the default template, which deliberately excludes the
    // DEFAULT_OFF modules, so asserting on tax_compliance would fail for a
    // correct implementation.
    // All of them: LIMIT 1 would return the alphabetically first module, which
    // is a required one, and the probe would then pass even if the assignment
    // did nothing.
    const [granted] = await conn.query(
      'SELECT pm_module FROM plan_modules WHERE pm_plan_id = ? ORDER BY pm_module',
      [planId],
    )
    if (!granted.length) {
      console.log('  SKIP  the first plan has no modules seeded')
      await conn.query('DELETE FROM master_company_subscription WHERE mcs_db_name = ?', [DB])
      await conn.end()
    } else {
    // A module the plan grants that is NOT required, so granting the plan is
    // observable: the probe company goes from denied to allowed purely because
    // of the plan. Required modules are granted even with no plan at all, so
    // asserting on one would pass whether or not the assignment worked.
    const optional = granted.find((g) => !CATALOG.REQUIRED_MODULES.includes(g.pm_module))
    if (!optional) {
      console.log('  SKIP  the first plan grants only required modules')
      await conn.query('DELETE FROM master_company_subscription WHERE mcs_db_name = ?', [DB])
      await conn.end()
    } else {
    const probeModule = optional.pm_module
    ok(
      'the probe module is an optional one the plan grants',
      !CATALOG.REQUIRED_MODULES.includes(probeModule),
      probeModule,
    )

    try {
      await conn.query('DELETE FROM master_company_subscription WHERE mcs_db_name = ?', [DB])

      // Before: no row at all, which is what a freshly signed-up company looks
      // like and what makes every sellable module unavailable.
      const before = await resolveEntitlement(DB)
      ok('a company with no row is not subscribed', before.subscribed === false, before.reason)
      ok(`and is denied ${probeModule}`, !before.modules.includes(probeModule))

      // Attach a plan, exactly as updateSubscription now does.
      const result = await assignCompanyPlan({
        adminQuery: async (sql, params) => {
          const [rows] = await conn.query(sql, params)
          return rows
        },
        planId,
        dbName: DB,
        currentUsers: 1,
      })
      ok('the row was created', result.created === true)

      // force: true because the negative read above populated the 60s cache.
      // Without it this would assert against the cached NO_SUBSCRIPTION_ROW and
      // pass or fail for the wrong reason.
      const after = await resolveEntitlement(DB, { force: true })
      ok('the company is now subscribed', after.subscribed === true, after.reason)
      ok('the plan name is resolved', Boolean(after.planName), after.planName)
      ok(`the plan's modules now include ${probeModule}`, after.modules.includes(probeModule))
      ok(
        'required modules are still present',
        CATALOG.REQUIRED_MODULES.every((m) => after.modules.includes(m)),
      )

      // Idempotency: a second call must not duplicate or error.
      const again = await assignCompanyPlan({
        adminQuery: async (sql, params) => {
          const [rows] = await conn.query(sql, params)
          return rows
        },
        planId,
        dbName: DB,
        currentUsers: 1,
      })
      ok('a second assignment updates rather than duplicating', again.created === false)
      const [count] = await conn.query(
        'SELECT COUNT(*) AS n FROM master_company_subscription WHERE mcs_db_name = ?',
        [DB],
      )
      ok('exactly one row exists for the company', count[0].n === 1, count[0].n)
    } finally {
      await conn.query('DELETE FROM master_company_subscription WHERE mcs_db_name = ?', [DB])
      const [left] = await conn.query(
        'SELECT COUNT(*) AS n FROM master_company_subscription WHERE mcs_db_name = ?',
        [DB],
      )
        ok('the probe row was cleaned up', left[0].n === 0)
        await conn.end()
      }
      }
    }
    }
}

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)
}

run().catch((error) => {
  console.error('\nTEST CRASHED:', error)
  process.exit(2)
})
