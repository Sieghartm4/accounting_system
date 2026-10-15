/**
 * Module codes and their display labels, for the client.
 *
 * Mirrors subscription/src/constants/moduleCatalog.js, which is authoritative on
 * the server. This copy exists because the client cannot require() from the
 * subscription app's source tree at runtime, and a customer picking a plan has
 * to read "VAT" rather than "vat".
 *
 * The drift risk is real and is checked rather than assumed:
 * scripts/verify-module-registry.js asserts that REQUIRED_MODULES here is
 * identical to the server's list, and that every code has a label.
 */

export const REQUIRED_MODULES = [
  'dashboard',
  'users',
  'access',
  'company',
  'charts',
  'customers',
  'vendors',
  'sales',
  'collections',
  'purchase',
  'payments',
  'receipts',
  'disbursement',
  'adjustments',
  'proforma_entries',
  'journal_entries',
  'trial_balance',
  'income_statement',
  'general_ledger',
  'balance_sheet',
  'statement_of_comprehensive_income',
  'customer_transactions',
  'vendor_transactions',
]

const LABELS = {
  dashboard: 'Dashboard',
  users: 'User Management',
  access: 'Access Control',
  company: 'Company Profile',
  charts: 'Charts of Accounts',
  customers: 'Customers',
  vendors: 'Vendors',
  sales: 'Sales',
  collections: 'Collections',
  purchase: 'Purchases',
  payments: 'Payments',
  receipts: 'Receipts',
  disbursement: 'Disbursements',
  adjustments: 'Adjustments',
  proforma_entries: 'Pro-forma Entries',
  journal_entries: 'Journal Entries',
  trial_balance: 'Trial Balance',
  income_statement: 'Income Statement',
  general_ledger: 'General Ledger',
  balance_sheet: 'Balance Sheet',
  statement_of_comprehensive_income: 'Comprehensive Income',
  customer_transactions: 'Customer Transactions',
  vendor_transactions: 'Vendor Transactions',
  aging_receivables: 'Aging Receivables',
  aging_payables: 'Aging Payables',
  advances: 'Advances',
  audit_trail: 'Audit Trail',
  bank_reconciliation: 'Bank Reconciliation',
  product_service: 'Products & Services',
  purchase_order: 'Purchase Orders',
  responsibility_center: 'Responsibility Centers',
  vat: 'VAT',
  withholding_tax: 'Withholding Tax',
  tax_compliance: 'Tax Compliance (BIR Returns)',
  accounting_periods: 'Accounting Periods',
  recurring_journals: 'Recurring Journals',
}

/**
 * Human label for a module code.
 *
 * Falls back to the raw code rather than rendering blank: an unrecognised code
 * is itself the signal that this list needs updating, and hiding it would make
 * the drift invisible until someone compared it by hand.
 */
export const moduleLabel = (code) => LABELS[code] || code;