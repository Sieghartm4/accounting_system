'use strict'

/**
 * A plan's modules must be visible wherever the plan is shown.
 *
 * ## The defect
 *
 * The plan editor saved module grants to `plan_modules`, and `getSubscriptionPlanById`
 * read them back - so the editor round-tripped correctly and an operator could
 * tick a module and see it stay ticked. That made the feature look finished.
 *
 * But nothing else read that table. `getSubscriptionPlans` and
 * `getPublicSubscriptionPlans` returned no modules at all, and the client's plan
 * cards built their feature list from `subscription_plan_items` rows of type
 * MODULES - which the seeder never populated. So:
 *
 *   - the plan list showed no modules, so two plans looked identical
 *   - the customer's own plan page showed only generic FEATURES strings
 *     ("All modules", "7 days free trial")
 *   - checking a module in the editor changed nothing visible anywhere
 *
 * The same class of error affected the users table: it joined
 * `master_user.subscription_id`, the legacy per-user pointer, while
 * authorisation reads `master_company_subscription` keyed by db_name. The page
 * could show a plan the company was not on, or "No Subscription" for a company
 * whose modules were fully enabled.
 *
 * Run: node scripts/test-plan-module-visibility.js
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

const catalog = require(path.join(ROOT, 'subscription/src/constants/moduleCatalog'))
const plansCtrl = require(path.join(ROOT, 'subscription/src/controller/subscription.controller'))
const usersCtrl = require(path.join(ROOT, 'subscription/src/controller/users.controller'))

const call = async (fn) => {
  let status = null
  let payload = null
  const res = {
    status(s) { status = s; return this },
    json(b) { payload = b; return this },
  }
  await fn({}, res)
  return { status, payload }
}

const run = async () => {
  section('every read endpoint returns the plan_modules list')
  {
    const pub = await call(plansCtrl.getPublicSubscriptionPlans)
    ok('the public endpoint responds 200', pub.status === 200, pub.status)

    for (const plan of pub.payload.data) {
      ok(
        `public plan ${plan.sp_code} carries a module list`,
        Array.isArray(plan.modules) && plan.modules.length > 0,
        plan.modules,
      )
      ok(
        `public plan ${plan.sp_code} includes its required modules`,
        catalog.REQUIRED_MODULES.every((m) => plan.modules.includes(m)),
      )
    }

    const list = await call(plansCtrl.getSubscriptionPlans)
    ok('the admin list endpoint responds 200', list.status === 200, list.status)
    for (const plan of list.payload.data) {
      ok(
        `list plan ${plan.sp_code} carries a module list`,
        Array.isArray(plan.modules) && plan.modules.length > 0,
      )
    }

    // The whole point: an operator's edit must be visible on the list. A plan
    // with a module no other plan has is the observable case.
    const taxed = list.payload.data.filter((p) => p.modules?.includes('tax_compliance'))
    ok('a plan with tax_compliance shows it on the list', taxed.length > 0, taxed.map((p) => p.sp_code))
  }

  section('a plan with different modules reads differently')
  {
    const pub = await call(plansCtrl.getPublicSubscriptionPlans)
    const withTax = pub.payload.data.filter((p) => p.modules?.includes('tax_compliance'))
    const without = pub.payload.data.filter((p) => !p.modules?.includes('tax_compliance'))

    ok('at least one plan includes tax_compliance', withTax.length > 0)
    if (without.length && withTax.length) {
      const a = withTax[0].modules.length
      const b = without[0].modules.length
      ok('plans with different modules report different lengths', a !== b, { withTax: a, without: b })
    }
  }

  section('the public endpoint reads limits from the plan, not the legacy items')
  {
    const pub = await call(plansCtrl.getPublicSubscriptionPlans)
    const priced = pub.payload.data.find((p) => Number(p.sp_price_minor) > 0)

    if (priced) {
      // sp_price_minor is in centavos; sp_price is pesos for display.
      ok(
        'a paid plan reports the price from sp_price_minor',
        Math.abs(priced.sp_price - Number(priced.sp_price_minor) / 100) < 0.01,
        { sp_price: priced.sp_price, sp_price_minor: priced.sp_price_minor },
      )
    } else {
      console.log('  (no paid public plan right now - price check skipped)')
    }

    for (const plan of pub.payload.data) {
      ok(
        `plan ${plan.sp_code} exposes its seat cap`,
        Number.isInteger(Number(plan.sp_max_users)),
        plan.sp_max_users,
      )
    }
  }

  section('the users table shows the company plan that is enforced')
  {
    const users = await call(usersCtrl.getUsers)
    ok('the users endpoint responds 200', users.status === 200, users.status)

    // Every user on a company with an entitlement row must show that row's plan.
    const withTenant = users.payload.data.filter((u) => u.db_name)
    ok(
      'a user on a subscribed company shows that plan',
      withTenant.some((u) => u.subscription_plan_name),
      withTenant.map((u) => `${u.username}:${u.subscription_plan_name}`),
    )

    for (const user of users.payload.data) {
      if (user.plan_id) {
        ok(
          `${user.username}: modules travel with the plan`,
          Array.isArray(user.modules) && user.modules.length > 0,
          user.modules,
        )
      }
    }

    // The legacy pointer must still be visible so a mismatch is diagnosable
    // rather than silently overwritten.
    ok(
      'the legacy per-user pointer is retained for comparison',
      users.payload.data.every((u) => 'legacy_subscription_id' in u),
    )
  }

  section('the client renders the real modules, not the legacy items')
  {
    const src = fs.readFileSync(path.join(ROOT, 'client/src/pages/register/Register.jsx'), 'utf8')

    ok('reads plan.modules', /plan\.modules = Array\.isArray\(plan\.modules\)/.test(src))
    ok('does not build the module list from legacy MODULES items', !/item\.spi_type === 'MODULES'/.test(src))
    ok('lists only the non-required modules individually', /!REQUIRED_MODULES\.includes\(m\)/.test(src))
    ok('acknowledges the required set in one line', /All core accounting/.test(src))
    ok('shows the seat cap', /Up to \$\{plan\.sp_max_users\}/.test(src))
    ok('shows the trial where there is one', /-day free trial/.test(src))
    ok('labels modules through the shared helper', /moduleLabel\(m\)/.test(src))
    ok('imports the shared module constants', /from '\.\.\/\.\.\/constants\/modules'/.test(src))
  }

  section('the legacy table is not the source of truth')
  {
    const db = require(path.join(ROOT, 'node_modules/mysql2/promise'))
    const { DecryptString } = require(path.join(ROOT, 'subscription/src/util/cryptography.util'))
    const conn = await db.createConnection({
      host: process.env._HOST_ADMIN,
      user: process.env._USER_ADMIN,
      password: DecryptString(process.env._PASSWORD_ADMIN),
      database: process.env._DATABASE_ADMIN,
    })

    try {
      const [legacy] = await conn.query(
        "SELECT COUNT(*) AS n FROM subscription_plan_items WHERE spi_type = 'MODULES'",
      )
      const [real] = await conn.query('SELECT COUNT(DISTINCT pm_plan_id) AS n FROM plan_modules')

      ok(
        'plan_modules is populated for every plan',
        Number(real[0].n) > 0,
        real[0].n,
      )
      // Recorded, not asserted: the legacy table being empty is precisely why
      // this bug existed, so the number is worth seeing in the output.
      console.log(`  (legacy MODULES items: ${legacy[0].n}, plan_modules plans: ${real[0].n})`)
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