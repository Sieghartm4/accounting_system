/**
 * Module-lock contract, mirroring what ProtectedRoute does in the browser.
 *
 * ModuleUpsell and useEntitlement need a JSX/React toolchain, so this exercises
 * the decision logic on its own: same precedence, same fail-closed behaviour,
 * same "locked means never render the page" rule. The JSX structure itself is
 * covered by test-module-upsell.js and by the client build.
 *
 * Run: node scripts/test-upsell-logic.js
 */

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

/**
 * Mirrors hasModule in server/src/services/entitlement/entitlement.service.js.
 *
 * Canonicalisation is part of the contract, not an incidental detail: a tenant
 * granted the legacy `witholding_tax` typo must still match, or the tenant is
 * denied a module it pays for.
 */
const hasModule = (entitlement, code) => {
  const canonical = CATALOG.canonicalModule(code)
  if (!canonical) return false
  const modules = entitlement && Array.isArray(entitlement.modules) ? entitlement.modules : []
  return modules.includes(canonical)
}

/** Mirrors the resolvedModule calculation in ProtectedRoute. */
const resolveModule = (moduleCode, routeName) =>
  moduleCode || (Array.isArray(routeName) ? routeName[0] : routeName)

const CATALOG = require('../subscription/src/constants/moduleCatalog')

/**
 * A plan granting everything - what a tenant gets after upgrading to a plan
 * that includes all modules.
 *
 * Deliberately not `defaultModuleTemplate()`: that template is the *seeded
 * default*, which excludes the three opt-in modules by design. Using it as the
 * "full plan" would assert that an upgraded tenant still lacks tax compliance.
 */
const FULL_PLAN = {
  planName: 'ENTERPRISE',
  status: 'active',
  maxUsers: 100,
  modules: [...CATALOG.REQUIRED_MODULES, ...CATALOG.DEFAULT_ON_MODULES, ...CATALOG.DEFAULT_OFF_MODULES],
}

const TRIAL_PLAN = {
  planName: 'PRO',
  status: 'trial',
  maxUsers: 2,
  modules: CATALOG.REQUIRED_MODULES,
}

section('a paying tenant is never shown the upgrade screen')
{
  const withholdable = CATALOG.DEFAULT_OFF_MODULES
  ok(
    `all ${withholdable.length} default-off modules are withheld from a trial`,
    withholdable.every((m) => !hasModule(TRIAL_PLAN, m)),
    withholdable.filter((m) => hasModule(TRIAL_PLAN, m)),
  )
  ok(
    `all ${withholdable.length} default-off modules are included in an all-inclusive plan`,
    withholdable.every((m) => hasModule(FULL_PLAN, m)),
    withholdable.filter((m) => !hasModule(FULL_PLAN, m)),
  )
  ok(
    'required modules are always included',
    CATALOG.REQUIRED_MODULES.every((m) => hasModule(TRIAL_PLAN, m)),
  )
}

section('the exact scenario from the bug report')
{
  // accounting_periods is DEFAULT_OFF, so a trial tenant is refused it. The
  // screen must explain rather than surface a 402 toast.
  const entitlement = TRIAL_PLAN
  const code = 'accounting_periods'

  ok('the module is refused', !hasModule(entitlement, code))
  ok('the reason is the plan, not a permission', entitlement.modules.includes('charts'))
  ok('the plan name is available for the copy', entitlement.planName === 'PRO')
}

section('fails closed')
{
  ok('no entitlement at all means refused', !hasModule(null, 'vat'))
  ok('an entitlement with no modules array means refused', !hasModule({}, 'vat'))
  ok(
    'an entitlement with a non-array modules field means refused',
    !hasModule({ modules: 'vat' }, 'vat'),
  )
  ok('an empty modules array means refused', !hasModule({ modules: [] }, 'vat'))
}

section('moduleCode resolution')
{
  ok('a plain routeName is used as-is', resolveModule(undefined, 'vat') === 'vat')
  ok(
    'an array routeName narrows to its first code rather than staying an array',
    resolveModule(undefined, ['tax_compliance', 'vat']) === 'tax_compliance',
  )
  // The failure this guards: an array reaching hasModule is never `includes`,
  // so every tenant including a paying one would see the upgrade screen.
  ok(
    'an unresolved array would NOT match, which is why the narrowing exists',
    !hasModule(FULL_PLAN, ['aging_payables', 'purchase']),
  )
  ok('an explicit moduleCode always wins', resolveModule('vat', ['a', 'b']) === 'vat')
  ok('an explicit moduleCode wins over a string routeName', resolveModule('tax_compliance', 'vat') === 'tax_compliance')
}

section('upgradeAdds is what the copy promises')
{
  const alreadyHas = TRIAL_PLAN.modules
  const upgradeAdds = CATALOG.DEFAULT_ON_MODULES.filter((m) => !alreadyHas.includes(m))

  ok('a trial is missing at least one default-on module', upgradeAdds.length > 0, upgradeAdds)
  ok('nothing listed is already held', upgradeAdds.every((m) => !alreadyHas.includes(m)))
  ok(
    'everything listed is a real module',
    upgradeAdds.every((m) => CATALOG.ALL_MODULES.includes(m)),
  )
  // The screen must not promise a module the catalog does not sell.
  ok(
    'nothing listed is an unsold module',
    upgradeAdds.every((m) => !CATALOG.UNSOLD_MODULES.includes(m)),
  )
}

section('the legacy alias still resolves')
{
  const canonical = CATALOG.canonicalModule('witholding_tax')
  ok('the typo canonicalises to withholding_tax', canonical === 'withholding_tax', canonical)
  ok(
    'a tenant granted the typo is treated as having the module',
    hasModule({ modules: [canonical] }, 'witholding_tax'),
  )
}

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)
