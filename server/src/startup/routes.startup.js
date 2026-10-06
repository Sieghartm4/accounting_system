const { auth } = require('../middlewares/auth.middleware')
const {
  requireSubscription,
  requireModule,
} = require('../middlewares/entitlement.middleware')

const { healthRouter } = require('../routes/health.routes')
const { developerRouter } = require('../routes/developer.routes')
const { entitlementRouter } = require('../routes/entitlement.routes')
const { usersRouter } = require('../routes/users.routes')
const { credentialsRouter } = require('../routes/credentials.routes')
const { accessRouter } = require('../routes/access.routes')
const { routeAccessRouter } = require('../routes/route_access.routes')
const { companyRouter } = require('../routes/company.routes')
const { cashDisbursementRouter } = require('../routes/cash_disbursement.routes')
const { receiptRouter } = require('../routes/receipt.routes')
const { salesRouter } = require('../routes/sales.routes')
const { collectionRouter } = require('../routes/collection.routes')
const { purchaseRouter } = require('../routes/purchase.routes')
const { purchaseOrderRouter } = require('../routes/purchase_order.routes')
const { paymentRouter } = require('../routes/payments.routes')
const { journalEntriesRouter } = require('../routes/journal_entries.routes')
const { chartsOfAccountsRouter } = require('../routes/charts_of_accounts.routes')
const { customerRouter } = require('../routes/customer.routes')
const { vendorRouter } = require('../routes/vendor.routes')
const { productServiceRouter } = require('../routes/product_service.routes')
const { proformaEntriesRouter } = require('../routes/proforma_entries.routes')
const { vatRouter } = require('../routes/vat.routes')
const {
  responsibilityCenterRouter,
} = require('../routes/responsibility_center.routes')
const { withholdingTaxRouter } = require('../routes/withholding_tax.routes')
const { adjustmentsRouter } = require('../routes/adjustments.routes')
const { recurringJournalsRouter } = require('../routes/recurring_journals.routes')
const { accountingPeriodsRouter } = require('../routes/accounting_periods.routes')
const { reportsRouter } = require('../routes/reports.routes')
const { dashboardRouter } = require('../routes/dashboard.routes')
const { bankReconciliationRouter } = require('../routes/bank_reconciliation.routes')
const { auditTrailRouter } = require('../routes/audit_trail.routes')
const { taxComplianceRouter } = require('../routes/tax_compliance.routes')
const { taxRouter } = require('../routes/tax.routes')

/**
 * Which plan module each mounted router belongs to.
 *
 * One table, so the whole enforcement surface can be audited by reading a single
 * list instead of chasing middleware through 25 mount points. A router absent
 * from this table is still authenticated and still subscription-checked, but its
 * module is not individually enforced - so a new router is ungated by default
 * rather than silently inheriting a neighbour's permission.
 *
 * The codes are the master_route_access names, which are also what App.jsx
 * passes to ProtectedRoute and what ProtectedAction receives as routeName, so the
 * server's view of a module and the client's cannot drift apart by accident.
 *
 * `reports` is deliberately ungated: it serves trial_balance, income_statement,
 * general_ledger, balance_sheet, statement_of_comprehensive_income and the two
 * transaction statements, all of which are required modules. Splitting it per
 * report would mean duplicating the router.
 */
const ROUTE_MODULES = [
  { path: '/users', router: 'usersRouter', module: 'users' },
  { path: '/access', router: 'accessRouter', module: 'access' },
  { path: '/route_access', router: 'routeAccessRouter', module: 'access' },
  { path: '/company', router: 'companyRouter', module: 'company' },
  { path: '/cash_disbursements', router: 'cashDisbursementRouter', module: 'disbursement' },
  { path: '/receipt', router: 'receiptRouter', module: 'receipts' },
  { path: '/sales', router: 'salesRouter', module: 'sales' },
  { path: '/collections', router: 'collectionRouter', module: 'collections' },
  { path: '/purchase', router: 'purchaseRouter', module: 'purchase' },
  { path: '/purchase_order', router: 'purchaseOrderRouter', module: 'purchase_order' },
  { path: '/payments', router: 'paymentRouter', module: 'payments' },
  { path: '/journal_entries', router: 'journalEntriesRouter', module: 'journal_entries' },
  { path: '/charts_of_accounts', router: 'chartsOfAccountsRouter', module: 'charts' },
  { path: '/customer', router: 'customerRouter', module: 'customers' },
  { path: '/vendors', router: 'vendorRouter', module: 'vendors' },
  { path: '/product_service', router: 'productServiceRouter', module: 'product_service' },
  { path: '/proforma_entries', router: 'proformaEntriesRouter', module: 'proforma_entries' },
  { path: '/vat', router: 'vatRouter', module: 'vat' },
  { path: '/responsibility_center', router: 'responsibilityCenterRouter', module: 'responsibility_center' },
  { path: '/withholding_tax', router: 'withholdingTaxRouter', module: 'withholding_tax' },
  { path: '/adjustments', router: 'adjustmentsRouter', module: 'adjustments' },
  { path: '/recurring_journals', router: 'recurringJournalsRouter', module: 'recurring_journals' },
  { path: '/accounting_periods', router: 'accountingPeriodsRouter', module: 'accounting_periods' },
  { path: '/dashboard', router: 'dashboardRouter', module: 'dashboard' },
  { path: '/bank_reconciliation', router: 'bankReconciliationRouter', module: 'bank_reconciliation' },
  { path: '/audit-trail', router: 'auditTrailRouter', module: 'audit_trail' },
  { path: '/tax-compliance', router: 'taxComplianceRouter', module: 'tax_compliance' },
  // Registry-driven tax API, mounted alongside the legacy router above rather
  // than over it, so the existing client keeps working while it is rewritten.
  { path: '/tax', router: 'taxRouter', module: 'tax_compliance' },
]

/** name -> mounted router, so the table above stays declarative. */
const ROUTERS = {
  usersRouter,
  accessRouter,
  routeAccessRouter,
  companyRouter,
  cashDisbursementRouter,
  receiptRouter,
  salesRouter,
  collectionRouter,
  purchaseRouter,
  purchaseOrderRouter,
  paymentRouter,
  journalEntriesRouter,
  chartsOfAccountsRouter,
  customerRouter,
  vendorRouter,
  productServiceRouter,
  proformaEntriesRouter,
  vatRouter,
  responsibilityCenterRouter,
  withholdingTaxRouter,
  adjustmentsRouter,
  recurringJournalsRouter,
  accountingPeriodsRouter,
  reportsRouter,
  dashboardRouter,
  bankReconciliationRouter,
  auditTrailRouter,
  taxComplianceRouter,
  taxRouter,
}

const initRoutes = (app) => {
  // Unauthenticated: the login endpoints themselves, and liveness.
  app.use('/credentials', credentialsRouter)
  app.use('/health', healthRouter)

  app.use(auth)

  // Everything below requires a verified JWT.
  //
  // /developer used to be mounted above app.use(auth), which exposed
  // GET /developer/migrations with no credential at all - it reports the
  // migration history of every database on the server. It is authenticated now.
  app.use('/developer', developerRouter)

  // Above requireSubscription on purpose: a tenant whose trial lapsed must be
  // able to read its own plan in order to choose a new one. The endpoint is
  // read-only and returns no tenant data, so it is safe to serve unconditionally.
  app.use('/entitlement', entitlementRouter)

  // A tenant with no live subscription is refused before any business route runs.
  // Login already refuses them, so this is defence in depth for a session that
  // outlives its expiry; the plan picker is served by the subscription app.
  app.use(requireSubscription)

  // Financial statements. Ungated because every report behind this router is a
  // required module; see ROUTE_MODULES.
  app.use('/reports', reportsRouter)

  for (const entry of ROUTE_MODULES) {
    const router = ROUTERS[entry.router]
    if (!router) {
      // Loud rather than silent: a typo in the table would otherwise leave a
      // whole router ungated.
      console.error(`[routes] ROUTE_MODULES references unknown router "${entry.router}"`)
      continue
    }
    app.use(entry.path, requireModule(entry.module), router)
  }
}

module.exports = { initRoutes, ROUTE_MODULES }