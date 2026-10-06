'use strict'

/**
 * End-to-end checks for company-level subscription enforcement.
 *
 * Drives the real entitlement resolvers against the live admin database and
 * mutates a scratch row in master_company_subscription, so trial expiry,
 * upgrade, downgrade and the seat cap are exercised against the actual queries
 * rather than a mock of them.
 *
 * The scratch company is created under a reserved db_name that no real tenant
 * uses, and is removed at the end.
 *
 * Run: node scripts/test-entitlements.js
 */

const path = require('path')
const ROOT = path.resolve(__dirname, '..')

require(path.join(ROOT, 'node_modules/dotenv')).config({ path: path.join(ROOT, '.env') })

const { adminQuery, adminExecute, closeAdminPool } = require(
  path.join(ROOT, 'server/src/database/util/adminDb.util'),
)
const serverEntitlement = require(
  path.join(ROOT, 'server/src/services/entitlement/entitlement.service'),
)
const subscriptionEntitlement = require(
  path.join(ROOT, 'subscription/src/services/entitlement.service'),
)
const catalog = require(
  path.join(ROOT, 'subscription/src/constants/moduleCatalog'),
)

const SCRATCH_DB = 'zz_entitlement_test_scratch'
const SCRATCH_USER = 'zz_entitlement_test_user'

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
const section = (title) => console.log(`\n${title}\n`)

const daysFromNow = (n) => new Date(Date.now() + n * 86400000)
const daysAgo = (n) => new Date(Date.now() - n * 86400000)

/** Plans available for the test, by code. */
const plansByCode = async () => {
  const rows = await adminQuery(
    'SELECT sp_id, sp_code, sp_max_users, sp_billing_days, sp_trial_days, sp_is_trial FROM subscription_plans',
  )
  return new Map(rows.map((r) => [r.sp_code, r]))
}

const upsertScratch = async ({ planId, status, trialEndsAt, periodEndsAt, maxUsers }) => {
  await adminExecute('DELETE FROM master_company_subscription WHERE mcs_db_name = ?', [SCRATCH_DB])
  await adminExecute(
    `INSERT INTO master_company_subscription
       (mcs_db_name, mcs_plan_id, mcs_status, mcs_trial_ends_at, mcs_period_ends_at, mcs_max_users, mcs_current_users)
     VALUES (?, ?, ?, ?, ?, ?, 0)`,
    [SCRATCH_DB, planId, status, trialEndsAt, periodEndsAt, maxUsers],
  )
}

const cleanup = async () => {
  await adminExecute('DELETE FROM master_company_subscription WHERE mcs_db_name = ?', [SCRATCH_DB])
  await adminExecute('DELETE FROM master_user WHERE mu_username = ?', [SCRATCH_USER]).catch(() => {})
}

const main = async () => {
  const plans = await plansByCode()
  const basic = plans.get('34444')
  const pro = plans.get('PRO')

  ok('seeded plans expose max_users', basic && pro && basic.sp_max_users > 0 && pro.sp_max_users > 0)
  ok('the free trial plan declares trial days', basic && Number(basic.sp_trial_days) > 0, basic && basic.sp_trial_days)

  /* ---------------- never subscribed ---------------- */
  section('a company with no subscription row')
  {
    await adminExecute('DELETE FROM master_company_subscription WHERE mcs_db_name = ?', [SCRATCH_DB])
    const e = await serverEntitlement.resolveEntitlement(SCRATCH_DB, { force: true })
    ok('is not subscribed', e.subscribed === false)
    ok('reports NO_SUBSCRIPTION_ROW', e.reason === 'NO_SUBSCRIPTION_ROW', e.reason)
    ok('may still reach its dashboard', serverEntitlement.hasModule(e, 'dashboard') === true)
    ok('may not reach tax', serverEntitlement.hasModule(e, 'tax_compliance') === false)
    ok('cannot add users', serverEntitlement.canAddUser(e, 0).allowed === false)

    const s = await subscriptionEntitlement.resolveEntitlement(SCRATCH_DB)
    ok('both servers agree it is not subscribed', s.subscribed === false)
  }

  /* ---------------- trial in progress ---------------- */
  section('a trial with time left on it')
  {
    await upsertScratch({
      planId: basic.sp_id,
      status: 'trialing',
      trialEndsAt: daysFromNow(7),
      periodEndsAt: null,
      maxUsers: 1,
    })
    const e = await serverEntitlement.resolveEntitlement(SCRATCH_DB, { force: true })
    ok('is subscribed', e.subscribed === true, e.reason)
    ok('status is trialing', e.status === 'trialing', e.status)
    ok('seat cap comes from the snapshot', e.maxUsers === 1, e.maxUsers)
    ok('trial modules are excluded', serverEntitlement.hasModule(e, 'tax_compliance') === false)
    ok('required modules are present', serverEntitlement.hasModule(e, 'dashboard') === true)

    const s = await subscriptionEntitlement.resolveEntitlement(SCRATCH_DB)
    ok('subscription server agrees it may log in', s.subscribed === true)
  }

  /* ---------------- trial expired ---------------- */
  section('a trial that has just ended')
  {
    // One minute past the end, which a midnight cron would not have noticed yet.
    await upsertScratch({
      planId: basic.sp_id,
      status: 'trialing',
      trialEndsAt: new Date(Date.now() - 60 * 1000),
      periodEndsAt: null,
      maxUsers: 1,
    })
    const e = await serverEntitlement.resolveEntitlement(SCRATCH_DB, { force: true })
    ok('is refused', e.subscribed === false)
    ok('reports TRIAL_EXPIRED', e.reason === 'TRIAL_EXPIRED', e.reason)
    ok('still knows which plan it had', e.planCode === basic.sp_code, e.planCode)

    const s = await subscriptionEntitlement.resolveEntitlement(SCRATCH_DB)
    ok('login would be refused', s.subscribed === false)
    ok('login reports TRIAL_EXPIRED', s.reason === 'TRIAL_EXPIRED', s.reason)
    ok('the plan row was not deleted', (await adminQuery(
      'SELECT COUNT(*) AS n FROM master_company_subscription WHERE mcs_db_name = ?', [SCRATCH_DB],
    ))[0].n === '1')
  }

  /* ---------------- expired but flagged active ---------------- */
  section('an expired trial whose status flag still says trialing')
  {
    await upsertScratch({
      planId: basic.sp_id,
      status: 'trialing',
      trialEndsAt: daysAgo(3),
      periodEndsAt: null,
      maxUsers: 1,
    })
    const e = await serverEntitlement.resolveEntitlement(SCRATCH_DB, { force: true })
    ok(
      'the date wins over the stale status flag',
      e.subscribed === false && e.reason === 'TRIAL_EXPIRED',
      { subscribed: e.subscribed, reason: e.reason },
    )
  }

  /* ---------------- upgrade adds modules ---------------- */
  section('upgrading from the trial plan to PRO')
  {
    await upsertScratch({
      planId: basic.sp_id,
      status: 'trialing',
      trialEndsAt: daysFromNow(7),
      periodEndsAt: null,
      maxUsers: basic.sp_max_users,
    })
    const before = await serverEntitlement.resolveEntitlement(SCRATCH_DB, { force: true })
    const beforeCount = before.modules.length

    // Give the PRO plan the tax module, then move the company onto it.
    await adminExecute(
      `INSERT IGNORE INTO plan_modules (pm_plan_id, pm_module) VALUES (?, 'tax_compliance')`,
      [pro.sp_id],
    )
    await upsertScratch({
      planId: pro.sp_id,
      status: 'active',
      trialEndsAt: null,
      periodEndsAt: daysFromNow(30),
      maxUsers: pro.sp_max_users,
    })
    const after = await serverEntitlement.resolveEntitlement(SCRATCH_DB, { force: true })

    ok('the new plan is reported', after.planCode === pro.sp_code, after.planCode)
    ok('seat cap followed the upgrade', after.maxUsers === pro.sp_max_users, after.maxUsers)
    ok(
      'the newly included module is now permitted',
      serverEntitlement.hasModule(after, 'tax_compliance') === true,
    )
    ok('module count did not shrink', after.modules.length >= beforeCount, {
      before: beforeCount,
      after: after.modules.length,
    })
  }

  /* ---------------- downgrade removes modules ---------------- */
  section('downgrading back to the trial plan')
  {
    await upsertScratch({
      planId: basic.sp_id,
      status: 'active',
      trialEndsAt: null,
      periodEndsAt: daysFromNow(30),
      maxUsers: basic.sp_max_users,
    })
    const e = await serverEntitlement.resolveEntitlement(SCRATCH_DB, { force: true })
    ok('the module is withdrawn again', serverEntitlement.hasModule(e, 'tax_compliance') === false)
    ok('required modules survive the downgrade', serverEntitlement.hasModule(e, 'dashboard') === true)
    ok('the company still has access', e.subscribed === true)
  }

  /* ---------------- seat cap, creator included ---------------- */
  section('seat cap counts the company creator')
  {
    await upsertScratch({
      planId: pro.sp_id,
      status: 'active',
      trialEndsAt: null,
      periodEndsAt: daysFromNow(30),
      maxUsers: 2,
    })
    const e = await serverEntitlement.resolveEntitlement(SCRATCH_DB, { force: true })
    ok('first account (the creator) is allowed', serverEntitlement.canAddUser(e, 0).allowed === true)
    ok('second account is allowed at a cap of 2', serverEntitlement.canAddUser(e, 1).allowed === true)
    ok('third account is refused', serverEntitlement.canAddUser(e, 2).allowed === false)
    ok(
      'the refusal explains the cap',
      serverEntitlement.canAddUser(e, 2).maxUsers === 2 &&
        serverEntitlement.canAddUser(e, 2).currentUsers === 2,
      serverEntitlement.canAddUser(e, 2),
    )
  }

  section('a company already over cap after a downgrade')
  {
    // 5 users left over from a bigger plan; the new cap is 2. Existing users
    // keep working, new ones are refused rather than the company being cut off.
    await upsertScratch({
      planId: basic.sp_id,
      status: 'active',
      trialEndsAt: null,
      periodEndsAt: daysFromNow(30),
      maxUsers: 1,
    })
    const e = await serverEntitlement.resolveEntitlement(SCRATCH_DB, { force: true })
    ok('the company is still active', e.subscribed === true)
    ok('new signups are refused', serverEntitlement.canAddUser(e, 5).allowed === false)
    ok('the refusal reports the overage', serverEntitlement.canAddUser(e, 5).currentUsers === 5)
  }

  /* ---------------- unknown codes fail closed ---------------- */
  section('unknown module codes')
  {
    const e = await serverEntitlement.resolveEntitlement(SCRATCH_DB, { force: true })
    ok('an unknown code is denied', serverEntitlement.hasModule(e, 'not_a_module') === false)
    ok('a null code is denied', serverEntitlement.hasModule(e, null) === false)
    ok('an empty code is denied', serverEntitlement.hasModule(e, '') === false)
    ok(
      'the legacy alias resolves to the canonical code',
      serverEntitlement.hasModule(e, 'witholding_tax') ===
        serverEntitlement.hasModule(e, 'withholding_tax'),
    )
  }

  /* ---------------- past_due ---------------- */
  section('a company flagged past due')
  {
    await upsertScratch({
      planId: pro.sp_id,
      status: 'past_due',
      trialEndsAt: null,
      periodEndsAt: null,
      maxUsers: 5,
    })
    const e = await serverEntitlement.resolveEntitlement(SCRATCH_DB, { force: true })
    ok('is refused', e.subscribed === false)
    ok('reports PAST_DUE', e.reason === 'PAST_DUE', e.reason)

    // An open-ended paid subscription: no end date at all. Paid rows in the
    // live data have sh_end_date = NULL, and reading that as expired would lock
    // out every paying customer.
    await upsertScratch({
      planId: pro.sp_id,
      status: 'active',
      trialEndsAt: null,
      periodEndsAt: null,
      maxUsers: 5,
    })
    const open = await serverEntitlement.resolveEntitlement(SCRATCH_DB, { force: true })
    ok('an open-ended paid subscription is allowed', open.subscribed === true, open.reason)
  }

  /* ---------------- catalog integrity ---------------- */
  section('module catalog')
  {
    ok('no plan may be empty', catalog.validateModules([]).valid === false)
    ok(
      'a required module cannot be dropped',
      catalog.validateModules(catalog.DEFAULT_ON_MODULES).valid === false,
    )
    ok(
      'the default template is valid',
      catalog.validateModules(catalog.defaultModuleTemplate()).valid === true,
    )
    ok(
      'the default template excludes tax and the period tools',
      catalog.DEFAULT_OFF_MODULES.every((m) => !catalog.defaultModuleTemplate().includes(m)),
    )
  }

  await cleanup()
  await closeAdminPool()

  console.log(`\n${pass} passed, ${fail} failed`)
  process.exit(fail === 0 ? 0 : 1)
}

main().catch(async (error) => {
  console.error('\nTEST CRASHED:', error)
  try {
    await cleanup()
    await closeAdminPool()
  } catch (e) {
    /* best effort */
  }
  process.exit(2)
})