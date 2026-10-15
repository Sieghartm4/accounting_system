'use strict'

/**
 * No route may serve a module's data to a tenant whose plan excludes it.
 *
 * ## What the audit found
 *
 * The client gate and the per-router `requireModule` were both believed to cover
 * every module. They did not. Three endpoints served sellable-module data with
 * no plan check at all:
 *
 *   GET /reports/advances             -> the `advances` module
 *   GET /reports/bank-reconciliation  -> the `bank_reconciliation` module
 *   GET /reports/search?allowedRoutes=... -> any module, by name
 *
 * The reports router is mounted ungated on the stated reasoning that "every
 * report behind it is a required module". That was never true: two of its
 * endpoints are not. Any of the three could be called directly with curl - no
 * browser, no client gate, nothing to click past.
 *
 * The third is the worst. `getSearch` took the set of modules to search from the
 * query string and used it as the scope, so a caller chose its own blast radius.
 *
 * This test asserts the structural invariant - every sellable module either has
 * a gated route or is unreachable - and specifically re-checks the three that
 * were open, so they cannot be reopened by an edit to an unrelated line.
 *
 * Run: node scripts/test-module-gate-audit.js
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

const STARTUP = fs.readFileSync(
  path.join(ROOT, 'server/src/startup/routes.startup.js'),
  'utf8',
)
const catalog = require(path.join(ROOT, 'subscription/src/constants/moduleCatalog'))

const run = async () => {
  const gatedRouters = new Set([...STARTUP.matchAll(/router:\s*'(\w+)'/g)].map((m) => m[1]))
  const directMounts = [...STARTUP.matchAll(/app\.use\('([^']+)',\s*(\w+)\)/g)].map((m) => ({
    path: m[1],
    router: m[2],
  }))

  section('every sellable module is covered by a gated route')
  {
    const gatedModules = new Set(
      [...STARTUP.matchAll(/module:\s*'([a-z_]+)'/g)].map((m) => m[1]),
    )
    // A module is also covered when its gate is applied per route inside a
    // router rather than in the mount table - which is how advances and aging
    // are gated, on a router mounted for another module.
    // Gates take three shapes: requireModule('x') inline, requireAnyModule(['x',...])
    // spanning lines, or a named const. Scan the whole file for a quoted module
    // code that sits inside one of those calls.
    const routerDir0 = path.join(ROOT, 'server/src/routes')
    for (const file of fs.readdirSync(routerDir0)) {
      if (!file.endsWith('.routes.js')) continue
      const src = fs.readFileSync(path.join(routerDir0, file), 'utf8')
      for (const call of src.matchAll(/require(?:Any)?Module\(\s*(\[[\s\S]{0,200}?\]|[\s\S]{0,80}?)\)/g)) {
        for (const code of call[1].matchAll(/'([a-z_]+)'/g)) {
          gatedModules.add(code[1])
        }
      }
    }

    const sellable = catalog.ALL_MODULES.filter((m) => !catalog.REQUIRED_MODULES.includes(m))

    const ungated = sellable.filter((m) => !gatedModules.has(m))
    ok(
      `all ${sellable.length} sellable modules are gated somewhere`,
      ungated.length === 0,
      ungated,
    )

    // Required modules need no gate: they are granted to every tenant.
    const required = catalog.REQUIRED_MODULES.filter((m) => !gatedModules.has(m))
    console.log(
      `  (${required.length} required module(s) have no gate, which is correct: they cannot be withheld)`,
    )
  }

  section('no router is mounted without either a gate or a stated reason')
  {
    for (const mount of directMounts) {
      // Each ungated mount must be justified. Anything else is a hole waiting
      // to be widened, which is exactly what happened to /reports.
      const reasons = {
        '/credentials': 'login and logout only; no company data',
        '/health': 'liveness only',
        '/developer': 'platform diagnostics, role-gated inside the router',
        '/entitlement': 'reads the caller own plan; no company data',
        '/reports': 'per-route gates inside the router',
      }
      ok(`${mount.path} has a documented reason for being ungated`, Boolean(reasons[mount.path]), mount.path)
    }
  }

  section('no gated router smuggles another module through a sub-path')
  {
    // ROUTE_MODULES gates whole routers. A sub-path that serves a different
    // sellable module inherits the wrong gate, which is how /sales/aging served
    // aging data to a tenant that had not bought it.
    const routerDir = path.join(ROOT, 'server/src/routes')
    const gateByBase = new Map(
      [...STARTUP.matchAll(/path:\s*'([^']+)',\s*router:\s*'\w+Router',\s*module:\s*'([a-z_]+)'/g)].map(
        (m) => [m[1].replace(/^\//, ''), m[2]],
      ),
    )

    const token = (s) => String(s).replace(/[^a-z0-9]/gi, '').toLowerCase()
    const offenders = []

    // A route is gated when something matching /^require[A-Z]/ sits between the
    // path and the handler - either requireModule('x') inline or a named gate
    // held in a const. Matching only the inline form would report every named
    // gate as ungated.
    const routeRe =
      /\.\s*(?:get|post|put|delete)\(\s*\n?\s*'([^']+)'\s*,([\s\S]{0,120}?)\n/g

    for (const file of fs.readdirSync(routerDir)) {
      const m = file.match(/^(.+)\.routes\.js$/)
      if (!m) continue
      const base = m[1].replace(/_/g, '')
      const module = gateByBase.get(base)
      if (!module) continue // ungated routers are audited on their own terms

      const src = fs.readFileSync(path.join(routerDir, file), 'utf8')

      for (const [, p, afterPath] of src.matchAll(routeRe)) {
        // Continue past any gate expressions to reach the handler.
        const handler = afterPath.split(',').pop()
        const hasGate = /require[A-Z]\w*/.test(afterPath)
        if (hasGate) continue

        for (const seg of p.replace(/^\//, '').split('/').filter(Boolean)) {
          const ts = token(seg)
          if (!ts) continue // an empty segment matches everything
          for (const candidate of catalog.ALL_MODULES) {
            if (catalog.REQUIRED_MODULES.includes(candidate)) continue
            if (candidate === module) continue
            const tm = token(candidate)
            // Exact, or a segment long enough to be a deliberate abbreviation
            // of the module name ("aging" -> "aging_receivables").
            if (ts === tm || (ts.length >= 4 && tm.includes(ts))) {
              offenders.push(
                `/${base} ${p} (gate ${module}, handler ${String(handler).trim().slice(0, 30)}) serves ${candidate}`,
              )
            }
          }
        }
      }
    }

    const unique = [...new Set(offenders)]
    ok(
      'no gated sub-path serves a different sellable module',
      unique.length === 0,
      unique,
    )
  }

  section('the known bypasses are individually closed')
  {
    const sales = fs.readFileSync(path.join(ROOT, 'server/src/routes/sales.routes.js'), 'utf8')
    ok(
      'sales aging carries its own gate',
      /salesRouter\.get\('\/aging',\s*require[A-Z]\w*,/.test(sales),
      sales.match(/salesRouter\.get\('\/aging'[^\n]*/)?.[0],
    )
    ok('the reason aging needs a separate gate is documented', /Aging is sold separately from sales/.test(sales))

    const reports = fs.readFileSync(path.join(ROOT, 'server/src/routes/reports.routes.js'), 'utf8')
    ok('reports advances carries its own gate', /reportsRouter\.get\('\/advances',\s*requireModule\('advances'\)/.test(reports))
    ok(
      'reports bank-reconciliation carries its own gate',
      /reportsRouter\.get\(\s*\n?\s*'\/bank-reconciliation',\s*\n?\s*requireModule\('bank_reconciliation'\)/.test(reports),
    )
  }

  section('the reports router gates its sellable endpoints individually')
  {
    const reports = fs.readFileSync(
      path.join(ROOT, 'server/src/routes/reports.routes.js'),
      'utf8',
    )

    ok('advances is gated', /'\/advances',\s*requireModule\('advances'\)/.test(reports))
    ok(
      'bank reconciliation is gated',
      /'\/bank-reconciliation',\s*\n?\s*requireModule\('bank_reconciliation'\)/.test(reports),
    )

    // Ungated paths are those whose handler comes straight after the path. The gate
    // is detected from the captured tail rather than a negative lookahead: a
    // lookahead after `\s*` backtracks and matches anyway. The tail is captured
    // greedily across lines because a gate is often on the next line.
    const ungatedPaths = [
      ...reports.matchAll(/reportsRouter\.get\(\s*\n?\s*'([^']+)'\s*,([\s\S]{0,140})/g),
    ]
      .filter((m) => !/requireModule\(|requireAnyModule\(|require[A-Z]\w*/.test(m[2]))
      .map((m) => m[1])
    const map = {
      '/trial-balance': 'trial_balance',
      '/income-statement': 'income_statement',
      '/general-ledger': 'general_ledger',
      '/balance-sheet': 'balance_sheet',
      '/journal-entries': 'journal_entries',
      '/statement-of-comprehensive-income': 'statement_of_comprehensive_income',
      // Not gated by a module, but the controller intersects the requested scope
      // with the plan. Asserted separately below.
      '/search': null,
    }
    for (const p of ungatedPaths) {
      if (p === '/search') continue
      const mod = map[p]
      ok(
        `${p} maps to a required module, so leaving it ungated is safe`,
        mod !== undefined && catalog.REQUIRED_MODULES.includes(mod),
        mod,
      )
    }
    ok(
      'no sellable report is left ungated',
      ungatedPaths.every((p) => p === '/search' || catalog.REQUIRED_MODULES.includes(map[p] || '')),
      ungatedPaths,
    )
    ok('exactly two routes carry a module gate', (reports.match(/requireModule\('/g) || []).length === 2)
  }

  section('search cannot be used to widen its own scope')
  {
    const controller = fs.readFileSync(
      path.join(ROOT, 'server/src/controller/reports.controller.js'),
      'utf8',
    )
    const search = controller.slice(controller.indexOf('const getSearch = async'))

    ok('it resolves the tenant entitlement', /resolveEntitlement\(tenantDb\)/.test(search))
    ok(
      'the requested scope is treated as a suggestion',
      /requestedRoutes\s*=/.test(search) &&
        /allowedSearchRoutes = new Set\(\s*\n?\s*entitledModules === null[\s\S]{0,200}requestedRoutes\.filter\(\(route\) => entitledModules\.includes\(route\)\)/.test(search),
    )
    ok('requested routes are intersected with the plan', /entitledModules\.includes\(route\)/.test(search))
    ok(
      'an unreadable plan fails closed rather than searching everything',
      /entitledModules = \[\][\s\S]{0,400}requestedRoutes\.filter/.test(search),
    )
    ok(
      'a plan with nothing searchable is refused with an upgrade hint',
      /NO_SEARCHABLE_MODULES/.test(search) && /requiresUpgrade/.test(search),
    )
  }

  section('no role can bypass the module gate')
  {
    const mw = fs.readFileSync(
      path.join(ROOT, 'server/src/middlewares/entitlement.middleware.js'),
      'utf8',
    )
    const req = mw.slice(mw.indexOf('const requireModule'))
    ok('requireModule has no role-based early return', !/role === 'ADMIN'/.test(req))
    ok('requireModule always consults the entitlement', /resolveEntitlement\(dbName\)/.test(req))
    ok('the reason the bypass was removed is documented', /No admin bypass/.test(mw))
  }

  section('platform diagnostics are not readable by tenants')
  {
    const dev = fs.readFileSync(
      path.join(ROOT, 'server/src/routes/developer.routes.js'),
      'utf8',
    )
    ok('migrations is behind a guard', /requirePlatformAdmin/.test(dev))
    ok('the guard refuses a request that has a tenant', /if \(tenantDb\)[\s\S]{0,200}403/.test(dev))
    ok('the reason is documented', /platform-level diagnostic/.test(dev))
  }

section('live: the gate matches the plan exactly, at every role')
    {
      const { requireModule, requireAnyModule } = require(
        path.join(ROOT, 'server/src/middlewares/entitlement.middleware'),
      )
      const { resolveEntitlement } = require(
        path.join(ROOT, 'server/src/services/entitlement/entitlement.service'),
      )

      // Built the way the auth middleware builds it: the JWT payload is spread
      // onto req.context and the session carries the tenant too. Passing only
      // one of the two makes the gate read an unidentifiable request and deny
      // everything, which looks like a working gate while testing nothing.
      const call = async (guard, role, tenant) => {
        let status = null
        const res = { status(s) { status = s; return this }, json() { return this } }
        await guard(
          { session: { tenantDb: tenant }, context: { dbName: tenant, role, username: 'u' } },
          res,
          () => { status = 200 },
        )
        return status
      }

      const sellable = catalog.ALL_MODULES.filter((m) => !catalog.REQUIRED_MODULES.includes(m))

      for (const tenant of ['facebook_accounting', '5lsolutions_accounting']) {
        const entitlement = await resolveEntitlement(tenant, { force: true })

        for (const role of ['ADMIN', 'USER']) {
          const wrong = []
          for (const mod of sellable) {
            const status = await call(requireModule(mod), role, tenant)
            const entitled = entitlement.modules.includes(mod)
            if (entitled && status !== 200) wrong.push(`${mod}/${role} entitled but ${status}`)
            if (!entitled && status !== 402) wrong.push(`${mod}/${role} withheld but ${status}`)
          }
          ok(
            `${tenant} ${role}: every sellable module matches the plan`,
            wrong.length === 0,
            wrong,
          )
        }

        // Required modules must never be refused, or the gate is simply broken.
        const requiredStatus = await call(requireModule('trial_balance'), 'ADMIN', tenant)
        ok(`${tenant}: a required module is still served`, requiredStatus === 200, requiredStatus)

        // One endpoint serves both aging modules, so either purchase unlocks it.
        const agingStatus = await call(
          requireAnyModule(['aging_receivables', 'aging_payables']),
          'ADMIN',
          tenant,
        )
        const hasAging =
          entitlement.modules.includes('aging_receivables') ||
          entitlement.modules.includes('aging_payables')
        ok(
          `${tenant}: aging is allowed exactly when an aging module is held`,
          agingStatus === (hasAging ? 200 : 402),
          agingStatus,
        )
      }

      // An unidentifiable request must lose access, never gain it.
      let status = null
      const res = { status(s) { status = s; return this }, json() { return this } }
      await requireModule('vat')({ session: {}, context: {} }, res, () => { status = 200 })
      ok('a request with no tenant is refused a sellable module', status === 402, status)
    }

    console.log(`\n${pass} passed, ${fail} failed`)
    process.exit(fail === 0 ? 0 : 1)
  }

run().catch((error) => {
  console.error('\nTEST CRASHED:', error)
  process.exit(2)
})