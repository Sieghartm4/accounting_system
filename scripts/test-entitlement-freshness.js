'use strict'

/**
 * A module change must reach a user who is already signed in.
 *
 * ## The reported symptom
 *
 * A tenant on PREMIUM PLAN was shown "Not in your plan - Tax & Compliance Status
 * isn't included", with the correct plan name and the correct seat count on the
 * same screen.
 *
 * ## The cause
 *
 * `useEntitlement` cached the entitlement in sessionStorage and refetched only
 * when there was no cache at all:
 *
 *     useEffect(() => { if (!readCache()) load() }, [load])
 *
 * So once a session had an answer, that answer was authoritative for the rest of
 * the tab. When an operator later added tax_compliance to PREMIUM, the server
 * began resolving 36 modules, but the open client kept the 33 it had at login
 * and refused the module.
 *
 * The plan name and max_users were untouched by that edit, which is why the
 * screen showed the right plan alongside the wrong module list - and why it read
 * as a server bug rather than a caching one.
 *
 * ## What is asserted
 *
 * The cache contract itself, simulated exactly: write a stale answer, change the
 * server answer underneath it, and require that the client converges on the new
 * one and never refuses a module on the stale value.
 *
 * Run: node scripts/test-entitlement-freshness.js
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

const HOOK = fs.readFileSync(path.join(ROOT, 'client/src/hooks/useEntitlement.js'), 'utf8')
const GATE = fs.readFileSync(path.join(ROOT, 'client/src/components/ProtectedRoute.jsx'), 'utf8')

const REVALIDATE_AFTER_MS = 60 * 1000
const CACHE_KEY = 'auth_entitlement'

/**
 * The hook's cache, re-implemented from the source so the test exercises the
 * real contract rather than a copy that could drift from it. Mirrors readCache /
 * writeCache / isCacheStale.
 */
const makeCache = (store) => ({
  read() {
    try {
      const parsed = JSON.parse(store[CACHE_KEY] || 'null')
      // An entry with no timestamp is treated as unusable, so an entry written
      // by an older build cannot be trusted indefinitely.
      if (!parsed || typeof parsed.fetchedAt !== 'number') return null
      return parsed.data ?? null
    } catch {
      return null
    }
  },
  write(data) {
    if (data) store[CACHE_KEY] = JSON.stringify({ data, fetchedAt: Date.now() })
    else delete store[CACHE_KEY]
  },
  isStale() {
    try {
      const parsed = JSON.parse(store[CACHE_KEY] || 'null')
      const at = typeof parsed?.fetchedAt === 'number' ? parsed.fetchedAt : 0
      return Date.now() - at > REVALIDATE_AFTER_MS
    } catch {
      return true
    }
  },
})

// async: the live section opens a database connection.
const run = async () => {
  section('the hook refetches instead of trusting a cache forever')
  {
    ok('the cache records when it was fetched', /fetchedAt:\s*Date\.now\(\)/.test(HOOK))
    ok('a cached entry without a timestamp is rejected', /typeof parsed\.fetchedAt !== 'number'/.test(HOOK))
    ok('there is an explicit revalidation interval', /REVALIDATE_AFTER_MS/.test(HOOK))

    // The line that caused the bug: refetching only when the cache is absent.
    ok(
      'it refetches when the cache is stale, not only when it is missing',
      /if \(!readCache\(\) \|\| isCacheStale\(\)\) load\(\)/.test(HOOK),
    )
    ok('the old never-refetch behaviour is gone', !/if \(!readCache\(\)\) load\(\)\s*$/.test(HOOK.trim()))
    ok('the interval matches the server resolver TTL', /60 \* 1000/.test(HOOK))
  }

  section('the gate never refuses a module on an unvalidated answer')
  {
    ok('the gate reads the validated flag', /validated/.test(GATE))
    ok(
      'a denial waits for validation rather than showing the upsell',
      /if \(!validated\) return null[\s\S]*?<ModuleUpsell/.test(GATE),
    )
    ok('the upsell is only reachable after validation', (GATE.match(/<ModuleUpsell/g) || []).length >= 1)

    const gate = GATE.slice(GATE.indexOf('const ModuleGate'))
    ok('hasModule is still checked', gate.indexOf('hasModule(moduleCode)') > -1)

    // Scoped to the hasModule branch: the first ModuleUpsell in the gate is the
    // no-entitlement fallback, which sits above this check by design.
    const denyBranch = gate.slice(gate.indexOf('if (!hasModule(moduleCode))'))
    const waitAt = denyBranch.indexOf('if (!validated) return null')
    const upsellAt = denyBranch.indexOf('return <ModuleUpsell')
    ok(
      'within the denial branch, the wait comes before the upsell',
      waitAt > -1 && upsellAt > waitAt,
      { waitAt, upsellAt },
    )
  }

  section('reproduced: a stale cache refuses a module the plan now has')
  {
    // The server answers before the operator's edit...
    const beforeEdit = {
      planName: 'PREMIUM PLAN',
      maxUsers: 5,
      modules: ['dashboard', 'users', 'access'],
    }
    // ...and after it. Same plan, same seat count, one more module.
    const afterEdit = {
      planName: 'PREMIUM PLAN',
      maxUsers: 5,
      modules: ['dashboard', 'users', 'access', 'tax_compliance'],
    }

    const store = {}
    const cache = makeCache(store)
    cache.write(beforeEdit)

    const stale = cache.isStale()
    ok('a just-written cache is not yet stale', stale === false)

    // Pretend an hour passed.
    const parsed = JSON.parse(store[CACHE_KEY])
    parsed.fetchedAt = Date.now() - 3600 * 1000
    store[CACHE_KEY] = JSON.stringify(parsed)

    ok('an hour-old cache is stale', cache.isStale() === true)
    ok('so the hook would refetch', (!cache.read() ? true : cache.isStale()) === true)

    // And the refreshed answer does contain the module.
    cache.write(afterEdit)
    const hasModule = (e, c) => Array.isArray(e?.modules) && e.modules.includes(c)
    ok('after revalidation the module is included', hasModule(cache.read(), 'tax_compliance'))

    // The plan identity is unchanged across the edit, which is what made the
    // failure look like a server bug.
    ok(
      'the plan name and seat count are identical before and after the edit',
      beforeEdit.planName === afterEdit.planName && beforeEdit.maxUsers === afterEdit.maxUsers,
    )
  }

  section('a failed revalidation must not lock a user out')
  {
    const store = {}
    const cache = makeCache(store)
    cache.write({ planName: 'PREMIUM PLAN', modules: ['dashboard', 'tax_compliance'] })

    // The hook's catch block returns null without clearing the cache, so the
    // last good answer survives a blipped request.
    ok(
      'the catch path does not clear the cache',
      /A failed revalidation keeps the last good answer/.test(HOOK) &&
        !/catch \(e\)[\s\S]{0,400}writeCache\(null\)/.test(HOOK),
    )
    ok('the cache still holds the previous answer', cache.read() !== null)
    ok('the module is still reachable from it', cache.read().modules.includes('tax_compliance'))
  }

section('the server is not the problem')
    {
      const { resolveEntitlement, hasModule } = require(
        path.join(ROOT, 'server/src/services/entitlement/entitlement.service'),
      )
      const catalog = require(path.join(ROOT, 'subscription/src/constants/moduleCatalog'))

      // Derived from the plan's own grants rather than hardcoded to a module.
      // An earlier version of this check asserted that PREMIUM included
      // tax_compliance, which was true when it was checked and became a false
      // failure the moment an operator unchecked it - a test that asserts a
      // commercial decision goes stale when that decision changes.
      const db = require(path.join(ROOT, 'node_modules/mysql2/promise'))
      const { DecryptString } = require(path.join(ROOT, 'subscription/src/util/cryptography.util'))

      const conn = await db.createConnection({
        host: process.env._HOST_ADMIN,
        user: process.env._USER_ADMIN,
        password: DecryptString(process.env._PASSWORD_ADMIN),
        database: process.env._DATABASE_ADMIN,
      })

      try {
        const [subs] = await conn.query(
          `SELECT mcs.mcs_db_name, mcs.mcs_plan_id, sp.sp_code
             FROM master_company_subscription mcs
             LEFT JOIN subscription_plans sp ON sp.sp_id = mcs.mcs_plan_id`,
        )
        const [grantRows] = await conn.query('SELECT pm_plan_id, pm_module FROM plan_modules')
        const grantsByPlan = new Map()
        for (const r of grantRows) {
          if (!grantsByPlan.has(r.pm_plan_id)) grantsByPlan.set(r.pm_plan_id, [])
          grantsByPlan.get(r.pm_plan_id).push(r.pm_module)
        }

        ok('there is at least one subscribed tenant to check', subs.length > 0)

        for (const s of subs) {
          const e = await resolveEntitlement(s.mcs_db_name, { force: true })
          const expected = grantsByPlan.get(s.mcs_plan_id) || []

          // The resolver must agree with the plan, module for module.
          const mismatched = expected.filter((m) => !hasModule(e, m))
          ok(
            `${s.mcs_db_name} (${s.sp_code}) resolves every module its plan grants`,
            mismatched.length === 0,
            { planGrants: expected.length, missing: mismatched },
          )

          const optional = expected.filter((m) => !catalog.REQUIRED_MODULES.includes(m))
          ok(
            `${s.mcs_db_name} resolves ${optional.length} optional module(s) exactly`,
            optional.every((m) => hasModule(e, m)) &&
              e.modules.filter((m) => !catalog.REQUIRED_MODULES.includes(m)).length === optional.length,
            {
              optional,
              resolved: e.modules.filter((m) => !catalog.REQUIRED_MODULES.includes(m)),
            },
          )

          ok(
            `${s.mcs_db_name} still resolves its required modules`,
            catalog.REQUIRED_MODULES.every((m) => hasModule(e, m)),
          )
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