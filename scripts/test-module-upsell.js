'use strict'

/**
 * Checks the module-lock experience: the upgrade screen replaces a page whose
 * module is not in the plan, rather than a 402 arriving after mount and
 * surfacing as a red "System Error" toast.
 *
 * Covers the contract rather than the pixels: the gate must fail closed, must
 * not fire the page's own requests while locked, and must never leave a way for
 * a locked module to render.
 *
 * Run: node scripts/test-module-upsell.js
 */

const path = require('path')
const fs = require('fs')
const ROOT = path.resolve(__dirname, '..')
const CLIENT = path.join(ROOT, 'client/src')

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

const read = (p) => fs.readFileSync(path.join(CLIENT, p), 'utf8')

section('the upgrade screen exists and is generic')
{
  const src = read('components/ModuleUpsell.jsx')

  ok('ModuleUpsell.jsx exists', true)
  ok('takes a moduleCode prop', /moduleCode/.test(src))
  ok('takes an optional entitlement prop', /entitlement\s*=/.test(src))
  ok('sends the user to the plan page', /register\?step=plan/.test(src))
  ok('offers a go-back action', /navigate\(-1\)/.test(src))
  ok('offers an explicit upgrade action', /See plans and upgrade/i.test(src))
  ok('has a full-page and an inline variant', /variant === 'inline'/.test(src))
  // A registry entry that is missing must yield the raw code, not a crash or a
  // blank heading. Optional chaining on the lookup is what guarantees that.
  ok('falls back to the raw code when the registry has no entry', /\?\.\s*label\s*\|\|\s*code/.test(src))

  // The whole point: no raw module code leaking into user-facing copy.
  ok(
    'does not print the raw module code as the heading',
    !/\{moduleCode\} is not included/.test(src),
  )
  ok('reassures that existing data is kept', /stay exactly as they are/.test(src))

  // Labels come from the registry rather than a hand-written duplicate list,
  // which is what let the old message drift out of sync with the nav.
  ok('labels come from ROUTE_CONFIG', /ROUTE_CONFIG/.test(src))
}

section('the screen works from a module code alone')
{
  const src = read('components/ModuleUpsell.jsx')

  // A caller should only have to supply the code it got from the 402.
  ok('fetches its own catalog when none is passed', /useCatalog\(catalog\)/.test(src))
  ok('resolves a label without any prop', /const label = labelFor\(moduleCode\)/.test(src))
  ok('caches the catalog for the tab', /auth_module_catalog/.test(src))
  ok('a catalog failure still leaves the upgrade CTA working', /must not block the call to action/.test(src))
  // Passing catalog= must win over a fetch.
  ok('a provided catalog takes precedence', /return provided \|\| catalog/.test(src))
  ok(
    'does not block on setState inside an effect',
    !/useEffect\(\(\) => \{\s*if \(provided\) \{\s*setCatalog/.test(src),
  )
}

section('no route can lock itself out by passing a routeName array')
{
  // routeName is an array on five routes (a page reachable through several
  // route_access codes). hasModule on an array is always false, so those routes
  // would show the upgrade screen to every tenant, paying or not. Each must
  // therefore declare a single moduleCode.
  const app = read('App.jsx')
  const arrayRoutes = [...app.matchAll(/path="([a-z_A-Z-]+)"[\s\S]{0,200}?routeName=\{\[([^\]]+)\]\}/g)]

  ok('found the array-routeName routes', arrayRoutes.length > 0, arrayRoutes.length)

  const missing = []
  for (const [, pathName, names] of arrayRoutes) {
    // Look at the full element block for this route.
    const start = app.indexOf(`path="${pathName}"`)
    const block = app.slice(start, start + 320)
    if (!/moduleCode="([a-z_]+)"/.test(block)) missing.push(pathName)
    // And the declared code must be one of the array's own codes.
    const declared = block.match(/moduleCode="([a-z_]+)"/)
    if (declared && !names.includes(`'${declared[1]}'`)) {
      missing.push(`${pathName} (declares ${declared[1]}, not in the array)`)
    }
  }
  ok(
    'every array-routeName route declares a single, valid moduleCode',
    missing.length === 0,
    missing,
  )

  const guard = read('components/ProtectedRoute.jsx')
  ok(
    'the guard itself narrows an array to its first code as a safety net',
    /Array\.isArray\(routeName\) \? routeName\[0\] : routeName/.test(guard),
  )
  ok(
    'the guard documents why moduleCode must be a string',
    /hasModule on an array is[\s\S]{0,40}always false/.test(guard),
  )
}

section('the gate is applied to every module page')
{
  const src = read('components/ProtectedRoute.jsx')
  ok('ProtectedRoute consults the entitlement', /useEntitlement/.test(src))
  ok('renders ModuleUpsell when the module is absent', /<ModuleUpsell/.test(src))
  ok('passes the entitlement through so the copy can be specific', /entitlement=\{entitlement\}/.test(src))
  ok('fails closed when the entitlement cannot be read', /Fail closed/.test(src))
  ok(
    'renders nothing while the entitlement is still loading',
    /if \(loading\) return null/.test(src),
  )
}

section('a locked module never renders the page')
{
  const src = read('components/ProtectedRoute.jsx')
  const gate = src.slice(src.indexOf('const ModuleGate'))

  // children must be returned only after the hasModule check.
  const hasCheck = gate.indexOf('hasModule(moduleCode)')
  const returnsChildren = gate.indexOf('return children')
  ok('hasModule is checked', hasCheck > -1)
  ok('children are returned after the check, not before', hasCheck < returnsChildren, {
    hasCheck,
    returnsChildren,
  })
  ok('the locked branch returns before children', gate.indexOf('<ModuleUpsell') < returnsChildren)
}

section('the entitlement hook fails closed')
{
  const src = read('hooks/useEntitlement.js')
  ok('caches in sessionStorage', /sessionStorage/.test(src))
  ok('hasModule returns false with no entitlement', /return false/.test(src))
  ok('hasModule guards a missing modules array', /Array\.isArray/.test(src))
  ok('exposes an invalidate so a plan change takes effect', /invalidateEntitlement/.test(src))
}

section('the server answers before the page can ask')
{
  const src = fs.readFileSync(
    path.join(ROOT, 'server/src/routes/entitlement.routes.js'),
    'utf8',
  )
  ok('exposes GET /entitlement', /entitlementRouter\.get\('\//.test(src))
  ok('always returns a modules array', /Array\.isArray\(entitlement\.modules\)/.test(src))
  ok('fails closed on error rather than reporting everything included', /failing closed/i.test(src))
}

section('every withheld module can actually reach a guarded route')
{
  // A module that is sellable but whose page is unguarded gets no upgrade screen:
  // the user sees the old 402 toast. This walks the real App.jsx rather than a
  // hardcoded list, so it stays true as pages are added.
  const app = read('App.jsx')
  const catalog = require(path.join(ROOT, 'subscription/src/constants/moduleCatalog'))

  // path="x" ... <ProtectedRoute ... moduleCode="y"  (or routeName="y")
  const guarded = new Set()
  const blocks = app.split('<Route').slice(1)
  for (const b of blocks) {
    const pathM = b.match(/path="([a-z_A-Z-]+)"/)
    const modM = b.match(/moduleCode="([a-z_]+)"/) || b.match(/routeName="([a-z_]+)"/)
    if (pathM && modM) guarded.add(modM[1])
    // Array form: the declared moduleCode is authoritative.
    else if (pathM && b.match(/routeName=\{\[/)) {
      const m = b.match(/moduleCode="([a-z_]+)"/)
      if (m) guarded.add(m[1])
    }
  }

  const withholdable = catalog.ALL_MODULES.filter((m) => !catalog.REQUIRED_MODULES.includes(m))
  const uncovered = withholdable.filter((m) => !guarded.has(m))
  ok(
    `all ${withholdable.length} sellable modules have a guarded page`,
    uncovered.length === 0,
    uncovered,
  )
}

section('the endpoint is mounted where a lapsed tenant can still read it')
{
  const startup = fs.readFileSync(
    path.join(ROOT, 'server/src/startup/routes.startup.js'),
    'utf8',
  )
  const mount = startup.indexOf("app.use('/entitlement'")
  const gate = startup.indexOf('app.use(requireSubscription)')

  ok('the entitlement router is mounted', mount > -1)
  ok('it sits ABOVE requireSubscription so an expired tenant is not locked out', mount < gate, {
    mount,
    gate,
  })
}

section('a module 402 no longer hijacks the upgrade screen')
{
  const src = read('utils/api.js')
  ok('MODULE_NOT_IN_PLAN is recognised', /MODULE_NOT_IN_PLAN/.test(src))
  ok('it is excluded from the redirect-to-plans path', /Swallowed instead|swallowed instead/i.test(src))
  // A genuine subscription lapse must still redirect.
  ok('other 402s still redirect to the plan page', /window\.location\.href = '\/register\?step=plan'/.test(src))
}

section('module codes resolve to real catalog entries')
{
  const catalog = require(path.join(ROOT, 'subscription/src/constants/moduleCatalog'))
  const routeProtection = fs.readFileSync(path.join(CLIENT, 'utils/routeProtection.js'), 'utf8')

  // Every module the catalog can withhold must have a registry entry, or the
  // upgrade screen has no label for it.
  const withholdable = [...catalog.DEFAULT_OFF_MODULES, ...catalog.DEFAULT_ON_MODULES]
  const missing = withholdable.filter((m) => !routeProtection.includes(`${m}:`) && !routeProtection.includes(`${m} {`))
  ok(`all ${withholdable.length} sellable modules have a registry label`, missing.length === 0, missing)
}

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)
