import ProtectedRoute from './components/ProtectedRoute'
import DashboardNew from './pages/dashboard/DashboardNew'
import Users from './pages/users/Users'
import Vendors from './pages/vendors/Vendors'
import VendorTransactions from './pages/vendors/VendorTransactions'
import Access from './pages/access/Access'
import Company from './pages/company/Company'
import ChartsOfAccounts from './pages/charts/Charts'
import Proforma from './pages/proforma/Proforma'
import ProductService from './pages/products/Products'
import Receipts from './pages/receipts/Receipts'
import Disbursements from './pages/disbursements/Disbursements'
import Sales from './pages/sales/Sales'
import Collections from './pages/collections/Collections'
import AgeingReceivables from './pages/aging_receivables/AgeingReceivables'
import AgeingPayables from './pages/aging_payables/AgeingPayables'
import Purchase from './pages/purchase/Purchase'
import PurchaseOrder from './pages/purchase_order/PurchaseOrder'
import Payments from './pages/payments/Payments'
import Customer from './pages/customers/Customer'
import CustomerTransactions from './pages/customers/CustomerTransactions'
import Vat from './pages/vat/Vat'
import ResponsibilityCenter from './pages/responsibility_center/ResponsibilityCenter'
import WithholdingTax from './pages/withholding_tax/WithholdingTax'
import TaxCompliance from './pages/tax_compliance/TaxCompliance'
import Adjustments from './pages/adjustments/Adjustments'
import TrialBalance from './pages/reports/TrialBalance'
import IncomeStatement from './pages/reports/IncomeStatement'
import GeneralLedger from './pages/reports/GeneralLedger'
import BalanceSheet from './pages/reports/BalanceSheet'
import JournalEntries from './pages/reports/JournalEntries'
import StatementOfComprehensiveIncome from './pages/reports/StatementOfComprehensiveIncome'
import BankReconciliation from './pages/reports/BankReconciliation'
import Advances from './pages/advances/Advances'
import AuditTrail from './pages/audit_trail/AuditTrail'

export const APP_ROUTES = [
  {
    path: 'dashboard',
    label: 'Dashboard',
    section: 'General',
    summary: 'Main dashboard showing financial overview, charts, and key metrics',
    keyElements: ['overview cards', 'charts', 'recent transactions'],
    element: (
      <ProtectedRoute routeName="dashboard">
        <DashboardNew />
      </ProtectedRoute>
    )
  },
  {
    path: 'company',
    label: 'Company',
    section: 'Masters',
    summary: 'Company settings and configuration management',
    keyElements: ['company details form', 'settings panel'],
    element: (
      <ProtectedRoute routeName="company">
        <Company />
      </ProtectedRoute>
    )
  },
  {
    path: 'charts',
    label: 'Chart of Accounts',
    section: 'Masters',
    summary: 'Chart of Accounts - manage account categories and structure',
    keyElements: ['account list', 'add account button', 'account categories'],
    element: (
      <ProtectedRoute routeName="charts">
        <ChartsOfAccounts />
      </ProtectedRoute>
    )
  },
  {
    path: 'vendors',
    label: 'Vendors',
    section: 'Masters',
    summary: 'Vendor management - add and manage supplier information',
    keyElements: ['vendor list', 'add vendor button', 'vendor details form'],
    element: (
      <ProtectedRoute routeName="vendors">
        <Vendors />
      </ProtectedRoute>
    )
  },
  {
    path: 'customers',
    label: 'Customers',
    section: 'Masters',
    summary: 'Customer management - add and manage client information',
    keyElements: ['customer list', 'add customer button', 'customer details form'],
    element: (
      <ProtectedRoute routeName="customers">
        <Customer />
      </ProtectedRoute>
    )
  },
  {
    path: 'product_service',
    label: 'Products and Services',
    section: 'Masters',
    summary: 'Products and services - manage inventory items and services',
    keyElements: ['product list', 'add product button', 'product details', 'pricing'],
    element: (
      <ProtectedRoute routeName="product_service">
        <ProductService />
      </ProtectedRoute>
    )
  },
  {
    path: 'responsibility_center',
    label: 'Responsibility Center',
    section: 'Masters',
    summary: 'Responsibility center - manage organizational cost centers',
    keyElements: ['center list', 'add center button', 'center assignments'],
    element: (
      <ProtectedRoute routeName="responsibility_center">
        <ResponsibilityCenter />
      </ProtectedRoute>
    )
  },
  {
    path: 'users',
    label: 'Users',
    section: 'Masters',
    summary: 'User management - manage system users and permissions',
    keyElements: ['user list', 'add user button', 'user roles', 'permissions'],
    element: (
      <ProtectedRoute routeName="users">
        <Users />
      </ProtectedRoute>
    )
  },
  {
    path: 'access',
    label: 'Access Control',
    section: 'Masters',
    summary: 'Access control - manage user access and permissions',
    keyElements: ['access settings', 'role management', 'permission matrix'],
    element: (
      <ProtectedRoute routeName="access">
        <Access />
      </ProtectedRoute>
    )
  },
  {
    path: 'sales',
    label: 'Sales',
    section: 'Transactions',
    summary: 'Sales management - create and manage sales invoices',
    keyElements: ['sales form', 'add line item button', 'save button', 'customer selector'],
    requiresLineItems: true,
    element: (
      <ProtectedRoute routeName="sales">
        <Sales />
      </ProtectedRoute>
    )
  },
  {
    path: 'receipts',
    label: 'Receipts',
    section: 'Transactions',
    summary: 'Receipt management - record money received from customers',
    keyElements: ['receipt form', 'amount field', 'customer selector', 'save button'],
    element: (
      <ProtectedRoute routeName="receipts">
        <Receipts />
      </ProtectedRoute>
    )
  },
  {
    path: 'disbursement',
    label: 'Cash Disbursement',
    section: 'Transactions',
    summary: 'Cash disbursement - record payments made to vendors',
    keyElements: ['disbursement form', 'vendor selector', 'amount field', 'save button'],
    requiresLineItems: true,
    element: (
      <ProtectedRoute routeName="disbursement">
        <Disbursements />
      </ProtectedRoute>
    )
  },
  {
    path: 'payments',
    label: 'Payments',
    section: 'Transactions',
    summary: 'Payment management - record payments to vendors',
    keyElements: ['payment form', 'vendor selector', 'amount field', 'save button'],
    requiresLineItems: true,
    element: (
      <ProtectedRoute routeName="payments">
        <Payments />
      </ProtectedRoute>
    )
  },
  {
    path: 'collections',
    label: 'Collections',
    section: 'Transactions',
    summary: 'Collections management - track and manage customer payments',
    keyElements: ['collections list', 'collection details', 'aging reports'],
    element: (
      <ProtectedRoute routeName="collections">
        <Collections />
      </ProtectedRoute>
    )
  },
  {
    path: 'purchase',
    label: 'Purchase',
    section: 'Transactions',
    summary: 'Purchase management - record purchases from vendors',
    keyElements: ['purchase form', 'vendor selector', 'line items', 'save button'],
    requiresLineItems: true,
    element: (
      <ProtectedRoute routeName="purchase">
        <Purchase />
      </ProtectedRoute>
    )
  },
  {
    path: 'purchase_order',
    label: 'Purchase Order',
    section: 'Transactions',
    summary: 'Purchase order management - create and manage purchase orders',
    keyElements: ['purchase order form', 'vendor selector', 'line items', 'save button'],
    element: (
      <ProtectedRoute routeName="purchase_order">
        <PurchaseOrder />
      </ProtectedRoute>
    )
  },
  {
    path: 'adjustments',
    label: 'Adjustments',
    section: 'Transactions',
    summary: 'Accounting adjustments - make correcting entries and adjustments',
    keyElements: ['adjustment form', 'account selector', 'amount field', 'save button'],
    element: (
      <ProtectedRoute routeName="adjustments">
        <Adjustments />
      </ProtectedRoute>
    )
  },
  {
    path: 'advances',
    label: 'Advances',
    section: 'Transactions',
    summary: 'Advances management - track and manage cash advances',
    keyElements: ['advances list', 'add advance button', 'advance details'],
    element: (
      <ProtectedRoute routeName={['adjustments', 'advances']}>
        <Advances />
      </ProtectedRoute>
    )
  },
  {
    path: 'proforma_entries',
    label: 'Proforma Entries',
    section: 'Transactions',
    summary: 'Proforma entries - manage preliminary accounting entries',
    keyElements: ['proforma list', 'add entry button', 'entry details'],
    element: (
      <ProtectedRoute routeName="proforma_entries">
        <Proforma />
      </ProtectedRoute>
    )
  },
  {
    path: 'customer-transactions',
    label: 'Customer Transactions',
    section: 'Transactions',
    summary: 'View transactions belonging to a customer',
    keyElements: ['customer selector', 'transaction list'],
    element: (
      <ProtectedRoute routeName="customers">
        <CustomerTransactions />
      </ProtectedRoute>
    )
  },
  {
    path: 'vendor-transactions',
    label: 'Vendor Transactions',
    section: 'Transactions',
    summary: 'View transactions belonging to a vendor',
    keyElements: ['vendor selector', 'transaction list'],
    element: (
      <ProtectedRoute routeName="vendors">
        <VendorTransactions />
      </ProtectedRoute>
    )
  },
  {
    path: 'vat',
    label: 'VAT',
    section: 'Taxes',
    summary: 'VAT management - handle value-added tax calculations and reporting',
    keyElements: ['vat settings', 'vat reports', 'tax calculations'],
    element: (
      <ProtectedRoute routeName="vat">
        <Vat />
      </ProtectedRoute>
    )
  },
  {
    path: 'witholding_tax',
    label: 'Withholding Tax',
    section: 'Taxes',
    summary: 'Withholding tax management - handle tax withholding requirements',
    keyElements: ['tax settings', 'tax reports', 'withholding calculations'],
    element: (
      <ProtectedRoute routeName="witholding_tax">
        <WithholdingTax />
      </ProtectedRoute>
    )
  },
  {
    path: 'tax-compliance',
    label: 'Tax Compliance',
    section: 'Taxes',
    summary: 'Tax compliance - comprehensive tax reporting and compliance tools',
    keyElements: ['compliance reports', 'tax summaries', 'filing status'],
    element: (
      <ProtectedRoute routeName={['tax_compliance', 'vat', 'witholding_tax']}>
        <TaxCompliance />
      </ProtectedRoute>
    )
  },
  {
    path: 'tax_compliance',
    label: 'Tax Compliance',
    section: 'Taxes',
    summary: 'Tax compliance - comprehensive tax reporting and compliance tools',
    keyElements: ['compliance reports', 'tax summaries', 'filing status'],
    element: (
      <ProtectedRoute routeName={['tax_compliance', 'vat', 'witholding_tax']}>
        <TaxCompliance />
      </ProtectedRoute>
    )
  },
  {
    path: 'trial-balance',
    label: 'Trial Balance',
    section: 'Reports',
    summary: 'Trial balance report - view account balances for financial reporting',
    keyElements: ['trial balance table', 'account balances', 'export options'],
    element: (
      <ProtectedRoute routeName="trial_balance">
        <TrialBalance />
      </ProtectedRoute>
    )
  },
  {
    path: 'income-statement',
    label: 'Income Statement',
    section: 'Reports',
    summary: 'Income statement - view profit and loss statement',
    keyElements: ['income statement table', 'revenue', 'expenses', 'net income'],
    element: (
      <ProtectedRoute routeName="income_statement">
        <IncomeStatement />
      </ProtectedRoute>
    )
  },
  {
    path: 'general-ledger',
    label: 'General Ledger',
    section: 'Reports',
    summary: 'General ledger - view all account transactions',
    keyElements: ['ledger table', 'account selector', 'transaction details'],
    element: (
      <ProtectedRoute routeName="general_ledger">
        <GeneralLedger />
      </ProtectedRoute>
    )
  },
  {
    path: 'balance-sheet',
    label: 'Balance Sheet',
    section: 'Reports',
    summary: 'Balance sheet - view assets, liabilities, and equity',
    keyElements: ['balance sheet table', 'assets', 'liabilities', 'equity'],
    element: (
      <ProtectedRoute routeName="balance_sheet">
        <BalanceSheet />
      </ProtectedRoute>
    )
  },
  {
    path: 'statement-of-comprehensive-income',
    label: 'Statement of Comprehensive Income',
    section: 'Reports',
    summary: 'Statement of comprehensive income - detailed income reporting',
    keyElements: ['comprehensive income table', 'revenue', 'expenses', 'other income'],
    element: (
      <ProtectedRoute routeName="statement_of_comprehensive_income">
        <StatementOfComprehensiveIncome />
      </ProtectedRoute>
    )
  },
  {
    path: 'journal-entries',
    label: 'Journal Entries',
    section: 'Reports',
    summary: 'Journal entries - view and manage accounting journal entries',
    keyElements: ['journal entries table', 'add entry button', 'entry details'],
    element: (
      <ProtectedRoute routeName="journal_entries">
        <JournalEntries />
      </ProtectedRoute>
    )
  },
  {
    path: 'bank-reconciliation',
    label: 'Bank Reconciliation',
    section: 'Reports',
    summary: 'Bank reconciliation - reconcile bank statements with records',
    keyElements: ['reconciliation form', 'bank statement import', 'match transactions'],
    element: (
      <ProtectedRoute routeName="bank_reconciliation">
        <BankReconciliation />
      </ProtectedRoute>
    )
  },
  {
    path: 'audit-trail',
    label: 'Audit Trail',
    section: 'Reports',
    summary: 'Audit trail - view system activity and changes log',
    keyElements: ['audit log table', 'filter options', 'activity details'],
    element: (
      <ProtectedRoute routeName="audit_trail">
        <AuditTrail />
      </ProtectedRoute>
    )
  },
  {
    path: 'aging_receivables',
    label: 'Aging Receivables',
    section: 'Reports',
    summary: 'Aging receivables report - track overdue customer payments',
    keyElements: ['aging table', 'filter options', 'customer details'],
    element: (
      <ProtectedRoute routeName="aging_receivables">
        <AgeingReceivables />
      </ProtectedRoute>
    )
  },
  {
    path: 'aging_payables',
    label: 'Aging Payables',
    section: 'Reports',
    summary: 'Aging payables report - track overdue vendor payments',
    keyElements: ['aging table', 'filter options', 'vendor details'],
    element: (
      <ProtectedRoute routeName={['aging_payables', 'purchase']}>
        <AgeingPayables />
      </ProtectedRoute>
    )
  }
]

export const buildSiteMap = () =>
  Object.fromEntries(
    APP_ROUTES.map((route) => {
      const path = route.path.startsWith('/') ? route.path : `/${route.path}`
      return [
        path,
        {
          label: route.label,
          section: route.section,
          summary: route.summary || route.label,
          keyElements: route.keyElements || [],
          requiresLineItems: route.requiresLineItems === true
        }
      ]
    })
  )