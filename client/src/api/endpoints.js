/**
 * Central registry of every API link used by the client.
 *
 * Every URL the front end connects to is defined here — nothing should build a
 * request path by hand anymore, so renaming a server route is a one-file change.
 * The builders only construct the URL string; how a caller sends the request
 * (fetch / fetchWithAuth, headers, bodies) is left untouched by this file.
 *
 * STRUCTURE OF THIS FILE
 * ======================
 *   1. BASE LINKS        — server roots: SERVER() and SUBSCRIPTION()
 *   2. API               — accounting server endpoints, grouped top-to-bottom
 *                          the way the app is arranged:
 *                            session & auth
 *                            entitlement / plan gate
 *                            realtime & notifications
 *                            access control, users, periods, audit
 *                            masters (company, COA, taxes, products...)
 *                            transaction modules (sales & AR, then AP side)
 *                            dashboard & reports (+ bank reconciliation)
 *   3. SUBSCRIPTION_API  — subscription server endpoints
 *
 * NAMING CONVENTIONS (same for every transaction module)
 * ======================================================
 *   <Module>()              -> module root        ->  /receipt
 *   <Module>ById(id)        -> one item           ->  /receipt/:id
 *   <Module>Import()        -> bulk import        ->  /receipt/import
 *   <Module>State()         -> approve/post step  ->  /receipt/receipt-state
 *   <Module>CancelState()   -> cancel step        ->  /receipt/cancel-state
 *   <Module>Print(ids)      -> batch print        ->  /receipt/print/:ids
 *
 * Anything that needs a query string is appended at the call site, exactly as
 * before: `` `${API.receipt()}?${params.toString()}` ``.
 */

// ===========================================================================
// 1. BASE LINKS
// ===========================================================================

const trimSlash = (s) => String(s || '').replace(/\/+$/, '')

/** Accounting server root (journal entries, transactions, reports, ...). */
export const SERVER = () => trimSlash(import.meta.env.VITE_SERVER_LINK || '')

/**
 * Subscription server root (plans, checkout, account registration).
 * Falls back to VITE_SUBSCRIPTION_URL:VITE_SUBSCRIPTION_PORT when
 * VITE_SUBSCRIPTION_LINK is not set — the same chain the pages used before.
 */
export const SUBSCRIPTION = () =>
  trimSlash(
    import.meta.env.VITE_SUBSCRIPTION_LINK ||
      `http://${import.meta.env.VITE_SUBSCRIPTION_URL || 'localhost'}:${
        import.meta.env.VITE_SUBSCRIPTION_PORT || '5051'
      }`,
  )

const url = (path) => `${SERVER()}${path}`
const subUrl = (path) => `${SUBSCRIPTION()}${path}`

//
//
//

// ===========================================================================
// 2. ACCOUNTING SERVER ENDPOINTS (API)
// ===========================================================================

export const API = {
  // -----------------------------------------------------------------------
  // 2.1 SESSION & AUTH
  //
  // `secureAuth*` are same-origin paths served next to the client itself;
  // `credentialsLogout` is the accounting server's own logout route.
  // -----------------------------------------------------------------------

  // Accounting server
  credentialsLogout: () => url('/credentials/logout'),

  // Same-origin (served beside the client app — no server base)
  secureAuthSession: () => '/api/auth/session',
  secureAuthRefresh: () => '/api/auth/refresh',
  secureAuthLogout: () => '/api/credentials/logout',

  // -----------------------------------------------------------------------
  // 2.2 ENTITLEMENT / PLAN GATE
  // -----------------------------------------------------------------------

  entitlement: () => url('/entitlement'),
  entitlementRefresh: () => url('/entitlement/refresh'),
  entitlementModuleCatalog: () => url('/entitlement/module-catalog'),

  // -----------------------------------------------------------------------
  // 2.3 REALTIME
  // -----------------------------------------------------------------------

  realtimeTicket: () => url('/realtime/ticket'),

  // -----------------------------------------------------------------------
  // 2.4 NOTIFICATIONS
  // -----------------------------------------------------------------------

  notifications: () => url('/notifications'),
  notificationsUnreadByModule: () => url('/notifications/unread-by-module'),
  notificationsRead: (id) => url(`/notifications/${id}/read`),
  notificationsReadByModule: () => url('/notifications/read-by-module'),
  notificationsReadAll: () => url('/notifications/read-all'),

  // -----------------------------------------------------------------------
  // 2.5 ACCESS CONTROL, USERS, PERIODS & AUDIT
  // -----------------------------------------------------------------------

  access: () => url('/access'),
  routeAccess: () => url('/route_access'),

  users: () => url('/users'),
  usersById: (id) => url(`/users/${id}`),
  userProfile: () => url('/users/profile'),

  accountingPeriods: (path) => url(`/accounting_periods${path}`),

  auditTrail: () => url('/audit-trail'),

  // -----------------------------------------------------------------------
  // 2.6 MASTERS
  //  (company profile, branches, responsibility centers, COA, taxes,
  //   product/service — the shared reference data behind every transaction)
  // -----------------------------------------------------------------------

  company: () => url('/company'),
  companyById: (id) => url(`/company/${id}`),
  companySingle: () => url('/company/single'),

  branch: () => url('/branch'),

  responsibilityCenter: () => url('/responsibility_center'),
  responsibilityCenterById: (id) => url(`/responsibility_center/${id}`),
  responsibilityCenterImport: () => url('/responsibility_center/import'),

  chartsOfAccounts: () => url('/charts_of_accounts'),
  chartsOfAccountsById: (id) => url(`/charts_of_accounts/${id}`),
  chartsOfAccountsImport: () => url('/charts_of_accounts/import'),

  vat: () => url('/vat'),
  vatById: (id) => url(`/vat/${id}`),
  vatImport: () => url('/vat/import'),

  withholdingTax: () => url('/withholding_tax'),
  withholdingTaxById: (id) => url(`/withholding_tax/${id}`),
  withholdingTaxImport: () => url('/withholding_tax/import'),

  productService: () => url('/product_service'),
  productServiceById: (id) => url(`/product_service/${id}`),
  productServiceSync: () => url('/product_service/sync'),
  productServiceSyncPreview: () => url('/product_service/sync/preview'),
  productServiceSyncImport: () => url('/product_service/sync/import'),

  // -----------------------------------------------------------------------
  // 2.7 TRANSACTION MODULES
  //  Ordered as the accounting flow runs: journal entries -> adjustments ->
  //  the AR side (receipts, sales, collections) -> the AP side (purchase,
  //  purchase orders, payments, disbursements) -> proforma & recurring.
  //  Each module follows the same sub-order: root, ById, Import, State,
  //  CancelState, Print.
  // -----------------------------------------------------------------------

  // --- Journal entries ---
  journalEntries: () => url('/journal_entries'),
  journalEntriesByCoa: (coaId) => url(`/journal_entries/coa/${coaId}`),
  journalEntriesReverse: () => url('/journal_entries/reverse'),

  // --- Adjustments ---
  adjustments: () => url('/adjustments'),
  adjustmentsById: (id) => url(`/adjustments/${id}`),
  adjustmentsState: () => url('/adjustments/adjustment-state'),
  adjustmentsCancelState: () => url('/adjustments/cancel-state'),

  // --- Cash receipts (AR) ---
  receipt: () => url('/receipt'),
  receiptById: (id) => url(`/receipt/${id}`),
  receiptState: () => url('/receipt/receipt-state'),
  receiptCancelState: () => url('/receipt/cancel-state'),
  receiptPrint: (ids) => url(`/receipt/print/${ids}`),

  // --- Sales (AR) ---
  sales: () => url('/sales'),
  salesById: (id) => url(`/sales/${id}`),
  salesState: () => url('/sales/sales-state'),
  salesCancelState: () => url('/sales/cancel-state'),
  salesPrint: (ids) => url(`/sales/print/${ids}`),

  // --- Collections (AR) ---
  collections: () => url('/collections'),
  collectionsById: (id) => url(`/collections/${id}`),
  collectionsState: () => url('/collections/collection-state'),
  collectionsCancelState: () => url('/collections/cancel-state'),
  collectionsPrint: (ids) => url(`/collections/print/${ids}`),
  collectionsSalesCollection: () => url('/collections/sales-collection'),
  collectionsSalesItemsCollection: () => url('/collections/sales-items-collection'),

  // --- Purchase (AP) ---
  purchase: () => url('/purchase'),
  purchaseById: (id) => url(`/purchase/${id}`),
  purchaseState: () => url('/purchase/purchase-state'),
  purchaseCancelState: () => url('/purchase/cancel-state'),
  purchasePrint: (ids) => url(`/purchase/print/${ids}`),

  // --- Purchase orders (AP) ---
  purchaseOrder: () => url('/purchase_order'),
  purchaseOrderById: (id) => url(`/purchase_order/${id}`),

  // --- Payments (AP) ---
  payments: () => url('/payments'),
  paymentsById: (id) => url(`/payments/${id}`),
  paymentsState: () => url('/payments/payment-state'),
  paymentsCancelState: () => url('/payments/cancel-state'),
  paymentsPrint: (ids) => url(`/payments/print/${ids}`),
  paymentsPurchasePayment: () => url('/payments/purchase-payment'),

  // --- Cash disbursements (AP) ---
  cashDisbursements: () => url('/cash_disbursements'),
  cashDisbursementsById: (id) => url(`/cash_disbursements/${id}`),
  cashDisbursementsState: () => url('/cash_disbursements/disbursement-state'),
  cashDisbursementsCancelState: () => url('/cash_disbursements/cancel-state'),
  cashDisbursementsPrint: (ids) => url(`/cash_disbursements/print/${ids}`),

  // --- Proforma entries ---
  proformaEntries: () => url('/proforma_entries'),
  proformaEntriesById: (id) => url(`/proforma_entries/${id}`),
  proformaEntriesImport: () => url('/proforma_entries/import'),

  // --- Recurring journals ---
  recurringJournals: () => url('/recurring_journals'),
  recurringJournalsById: (id) => url(`/recurring_journals/${id}`),
  recurringJournalsGenerate: (id) => url(`/recurring_journals/${id}/generate`),
  recurringJournalsGenerateAll: () => url('/recurring_journals/generate-all'),

  // -----------------------------------------------------------------------
  // 2.8 PARTNERS (customer & vendor masters + their transaction views)
  // -----------------------------------------------------------------------

  customer: () => url('/customer'),
  customerById: (id) => url(`/customer/${id}`),
  customerImport: () => url('/customer/import'),
  customerTransactions: () => url('/customer/transactions'),

  vendors: () => url('/vendors'),
  vendorsById: (id) => url(`/vendors/${id}`),
  vendorsImport: () => url('/vendors/import'),
  vendorTransactions: () => url('/vendors/transactions'),

  // -----------------------------------------------------------------------
  // 2.9 DASHBOARD & TAX COMPLIANCE
  // -----------------------------------------------------------------------

  dashboard: () => url('/dashboard'),

  taxRegistry: (path) => url(`/tax${path}`),

  taxComplianceSaveDraft: () => url('/tax-compliance/save-draft'),
  taxComplianceCalculateTax: () => url('/tax-compliance/calculate-tax'),
  taxComplianceExportPdf: () => url('/tax-compliance/export-pdf'),
  taxComplianceMarkFiled: () => url('/tax-compliance/mark-filed'),

  // -----------------------------------------------------------------------
  // 2.10 REPORTS
  // -----------------------------------------------------------------------

  reportsSearch: () => url('/reports/search'),
  reportsAdvances: () => url('/reports/advances'),
  salesAging: () => url('/sales/aging'),

  reportsJournalEntries: () => url('/reports/journal-entries'),
  reportsGeneralLedger: () => url('/reports/general-ledger'),
  reportsTrialBalance: () => url('/reports/trial-balance'),
  reportsIncomeStatement: () => url('/reports/income-statement'),
  reportsStatementOfComprehensiveIncome: () =>
    url('/reports/statement-of-comprehensive-income'),
  reportsBalanceSheet: () => url('/reports/balance-sheet'),

  // --- Bank reconciliation ---
  bankReconciliation: () => url('/bank_reconciliation'),
  bankReconciliationById: (id, suffix = '') =>
    url(`/bank_reconciliation/${id}${suffix}`),

  bankReconciliationItem: () => url('/bank_reconciliation/item'),
  bankReconciliationItemById: (id) => url(`/bank_reconciliation/item/${id}`),
  bankReconciliationItemAdd: () => url('/bank_reconciliation/item/add'),

  bankReconciliationMatch: () => url('/bank_reconciliation/match'),
  bankReconciliationMatchById: (id) => url(`/bank_reconciliation/match/${id}`),
  bankReconciliationMatchAdd: () => url('/bank_reconciliation/match/add'),
  bankReconciliationUnmatch: (bankItemId) =>
    url(`/bank_reconciliation/unmatch/${bankItemId}`),

  bankReconciliationAdjustmentById: (id) =>
    url(`/bank_reconciliation/adjustment/${id}`),
  bankReconciliationAdjustmentAdd: () =>
    url('/bank_reconciliation/adjustment/add'),

  bankReconciliationSummaryAdd: () => url('/bank_reconciliation/summary/add'),
}

// ===========================================================================
// 3. SUBSCRIPTION SERVER ENDPOINTS
// ===========================================================================

export const SUBSCRIPTION_API = {
  // --- Account / credentials ---
  credentialsLogin: () => subUrl('/credentials/login'),
  credentialsLogout: () => subUrl('/credentials/logout'),
  credentialsRegisterProgress: () => subUrl('/credentials/register-progress'),
  credentialsSubscription: () => subUrl('/credentials/subscription'),
  credentialsCheckFreeTrial: (username) =>
    subUrl(`/credentials/check-free-trial?username=${username}`),
  credentialsUsedFreeTrials: (username) =>
    subUrl(`/credentials/used-free-trials?username=${username}`),
  admin: () => subUrl('/admin'),

  // --- Plans & checkout ---
  subscriptionPlans: () => subUrl('/subscription-plans'),
  subscriptionPlansPublic: () => subUrl('/subscription-plans/public'),
  subscriptionPlansCheckout: () => subUrl('/subscription-plans/checkout'),
  subscriptionPlansPaymentDetails: (sessionId) =>
    subUrl(`/subscription-plans/payment-details/${sessionId}`),
}

export default API
