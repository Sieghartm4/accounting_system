'use strict'

/**
 * The canonical list of gateable modules, and how each one behaves.
 *
 * This file is the single source of truth on the subscription side. The client
 * keeps its own copy in client/src/utils/routeProtection.js because the two are
 * separate apps that cannot share a module; `scripts/verify-module-registry.js`
 * asserts the two stay in step, and the same script asserts every code here
 * exists in a tenant's master_route_access table.
 *
 * WHY THESE THREE TIERS
 *
 * A module may be withheld from a plan only when withholding it leaves the rest
 * of the product working. That is a product judgement informed by the foreign
 * key graph, not a property of the schema alone, because a withheld module is
 * hidden and refused at the API - its tables are never dropped. Dropping them
 * is what would force an FK ordering, and it is not done on downgrade.
 *
 *   REQUIRED     Cannot be deselected by an admin. Withholding any of these
 *                either makes the tenant unmanageable (dashboard, users,
 *                access, company) or breaks a transaction another required
 *                module depends on - you cannot record a sale without a
 *                customer or a chart of accounts.
 *
 *   DEFAULT_ON   Included in the default template, deselectable.
 *
 *   DEFAULT_OFF  Excluded from the default template, but selectable. These are
 *                the modules a trial or entry plan should not carry: they are
 *                substantial and a tenant that wants them can opt in.
 *
 * CODES
 *
 * Codes are the snake_case names already stored in master_route_access.mra_name
 * and are matched against App.jsx routeName arrays and ProtectedAction
 * routeName props. Note `withholding_tax` is spelled correctly here; the
 * historical `witholding_tax` typo is migrated away by
 * 20260826090000-normalize-module-codes and kept only as a legacy alias.
 */

/** Cannot be deselected. Always granted, whatever the plan says. */
const REQUIRED_MODULES = [
  // Administration: without these a tenant cannot manage itself or its access.
  'dashboard',
  'users',
  'access',
  'company',

  // Parties and accounts. sales/purchase reference these, so they are part of
  // the same working set even though they look like separate modules.
  'charts',
  'customers',
  'vendors',

  // Transactional core.
  'sales',
  'collections',
  'purchase',
  'payments',
  'receipts',
  'disbursement',
  'adjustments',
  'proforma_entries',
  'journal_entries',

  // Statements. An accounting product that cannot show a trial balance or a
  // balance sheet is not usable, so these are required.
  'trial_balance',
  'income_statement',
  'general_ledger',
  'balance_sheet',
  'statement_of_comprehensive_income',

  // Statement drill-downs, which read the same journal data as the statements.
  'customer_transactions',
  'vendor_transactions',
]

/** In the default template, admin may deselect. */
const DEFAULT_ON_MODULES = [
  'aging_receivables',
  'aging_payables',
  'advances',
  'audit_trail',
  'bank_reconciliation',
  'product_service',
  'purchase_order',
  'responsibility_center',
  'vat',
  'withholding_tax',
]

/** Off in the default template, admin may select. */
const DEFAULT_OFF_MODULES = [
  'tax_compliance',
  'accounting_periods',
  'recurring_journals',
]

/**
 * Codes that exist in master_route_access but are not offered as plan modules.
 *
 * `fiscal_periods` and `accounting_tools` are the legacy period tools that
 * accounting_periods replaced; they stay reachable by role but are not sold as
 * separate plan items, because withholding them while accounting_periods is on
 * would be incoherent.
 */
const UNSOLD_MODULES = ['fiscal_periods', 'accounting_tools']

/**
 * Historical spellings that must keep resolving.
 *
 * A tenant created before the rename has `witholding_tax` rows. Rather than
 * leaving those tenants locked out of the module, the alias is accepted on read
 * and folded onto the canonical code.
 */
const LEGACY_ALIASES = {
  witholding_tax: 'withholding_tax',
}

const ALL_MODULES = [
  ...REQUIRED_MODULES,
  ...DEFAULT_ON_MODULES,
  ...DEFAULT_OFF_MODULES,
]

const REQUIRED_SET = new Set(REQUIRED_MODULES)
const DEFAULT_ON_SET = new Set(DEFAULT_ON_MODULES)
const DEFAULT_OFF_SET = new Set(DEFAULT_OFF_MODULES)
const ALL_SET = new Set(ALL_MODULES)
const UNSOLD_SET = new Set(UNSOLD_MODULES)

/** Modules granted by the default template when an admin creates a plan. */
const defaultModuleTemplate = () => [
  ...REQUIRED_MODULES,
  ...DEFAULT_ON_MODULES,
]

/**
 * Fold a stored or submitted code onto its canonical spelling.
 * Returns null for anything unrecognised, so callers fail closed.
 */
const canonicalModule = (code) => {
  if (code === null || code === undefined) return null
  const trimmed = String(code).trim()
  if (!trimmed) return null
  if (ALL_SET.has(trimmed)) return trimmed
  if (Object.prototype.hasOwnProperty.call(LEGACY_ALIASES, trimmed)) {
    return LEGACY_ALIASES[trimmed]
  }
  return null
}

const isRequired = (code) => REQUIRED_SET.has(canonicalModule(code))

/**
 * Validate a submitted module list.
 *
 * Rejects rather than silently drops: an admin who submits an unknown code
 * should be told, not handed a plan quietly missing something. Fails closed on
 * an empty list, so a mis-saved form cannot leave a tenant with nothing.
 */
const validateModules = (codes) => {
  const errors = []
  const canonical = []
  const seen = new Set()

  if (!Array.isArray(codes) || codes.length === 0) {
    return {
      valid: false,
      errors: ['A plan must include at least one module.'],
      modules: [],
    }
  }

  for (const raw of codes) {
    const code = canonicalModule(raw)
    if (!code) {
      errors.push(`"${raw}" is not a known module.`)
      continue
    }
    if (seen.has(code)) continue
    seen.add(code)
    canonical.push(code)
  }

  const missing = REQUIRED_MODULES.filter((code) => !seen.has(code))
  if (missing.length > 0) {
    errors.push(
      `These modules are required and cannot be removed: ${missing.join(', ')}.`,
    )
  }

  return {
    valid: errors.length === 0,
    errors,
    modules: canonical,
  }
}

module.exports = {
  REQUIRED_MODULES,
  DEFAULT_ON_MODULES,
  DEFAULT_OFF_MODULES,
  UNSOLD_MODULES,
  ALL_MODULES,
  LEGACY_ALIASES,
  defaultModuleTemplate,
  canonicalModule,
  isRequired,
  validateModules,
}