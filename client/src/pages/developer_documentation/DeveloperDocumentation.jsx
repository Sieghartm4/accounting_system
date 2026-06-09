import React, { useState, useEffect, useMemo } from 'react'
import {
  Play,
  Pause,
  HelpCircle,
  ChevronRight,
  ChevronLeft,
  Info,
  Copy,
  Check,
  FileText,
  RefreshCw,
  Eye,
  Sliders,
  Search,
  BookOpen,
  Database,
  Code,
  Activity,
  ArrowRight,
  User,
  Shield,
  Layers,
  Terminal,
  AlertTriangle,
  ExternalLink,
  ChevronDown,
  Github,
  Tag,
  Clock,
  Settings,
  DollarSign,
  Briefcase,
  Layers3,
  CheckCircle2,
  ListFilter,
} from 'lucide-react'

// ============================================================================
// CORE DATA: NAVIGATION GROUPS & SECTIONS (Fully Mapped from DEVELOPER_GUIDE.txt)
// ============================================================================

const DOC_CATEGORIES = [
  {
    category: 'GETTING STARTED',
    items: [
      { id: 'welcome', title: 'Welcome & Overview', badge: 'Core' },
      { id: 'project-structure', title: '1. Project Structure', badge: 'Folders' },
      { id: 'auth', title: '2. Authentication & JWT', badge: 'Secure' },
    ],
  },
  {
    category: 'CORE CONCEPTS',
    items: [
      {
        id: 'posting-engine',
        title: 'The Posting Engine (DR=CR)',
        badge: 'Critical',
      },
      { id: 'journal-ledger', title: 'General Ledger Ledgering', badge: '' },
      { id: 'audit-system', title: 'Immutable Audit Trails', badge: '' },
    ],
  },
  {
    category: 'API SPECIFICATIONS',
    items: [
      { id: 'api-reference', title: '3. Complete API Specs', badge: '26 Endpoints' },
    ],
  },
  {
    category: 'INTEGRATION GUIDE',
    items: [
      {
        id: 'fe-be-mapping',
        title: '4. Frontend-to-Backend Pages',
        badge: 'Mapping',
      },
      { id: 'common-flows', title: '5. Double Entry Lifecycles', badge: 'Tracers' },
    ],
  },
  {
    category: 'DATABASE DICTIONARY',
    items: [
      { id: 'db-schema', title: '6. Complete Database Schema', badge: 'Dictionary' },
      { id: 'schema-master_access', title: 'master_access Table', badge: 'Meta' },
      { id: 'schema-master_user', title: 'master_user Table', badge: 'Users' },
      {
        id: 'schema-master_company',
        title: 'master_company Table',
        badge: 'Config',
      },
      {
        id: 'schema-master_route_access',
        title: 'master_route_access Table',
        badge: 'Permissions',
      },
      {
        id: 'schema-charts_of_accounts',
        title: 'charts_of_accounts Table',
        badge: 'Ledger',
      },
      { id: 'schema-customers', title: 'customers Table', badge: 'AR' },
      {
        id: 'schema-customers_information',
        title: 'customers_information Table',
        badge: 'AR',
      },
      { id: 'schema-vendors', title: 'vendors Table', badge: 'AP' },
      {
        id: 'schema-vendors_information',
        title: 'vendors_information Table',
        badge: 'AP',
      },
      {
        id: 'schema-products_service',
        title: 'products_service Table',
        badge: 'Items',
      },
      {
        id: 'schema-proforma_entries',
        title: 'proforma_entries Table',
        badge: 'Quotes',
      },
      {
        id: 'schema-cash_disbursements',
        title: 'cash_disbursements Table',
        badge: 'Cash',
      },
      { id: 'schema-receipts', title: 'receipts Table', badge: 'Cash' },
      { id: 'schema-sales', title: 'sales Table', badge: 'Sales' },
      { id: 'schema-collections', title: 'collections Table', badge: 'AR' },
      {
        id: 'schema-cash_disbursement_items',
        title: 'cash_disbursement_items Table',
        badge: 'Cash',
      },
      { id: 'schema-receipt_items', title: 'receipt_items Table', badge: 'Cash' },
      { id: 'schema-sales_items', title: 'sales_items Table', badge: 'Sales' },
      {
        id: 'schema-collection_items',
        title: 'collection_items Table',
        badge: 'AR',
      },
      {
        id: 'schema-cash_disbursement_attachments',
        title: 'cash_disbursement_attachments Table',
        badge: 'Files',
      },
      {
        id: 'schema-receipt_attachments',
        title: 'receipt_attachments Table',
        badge: 'Files',
      },
      {
        id: 'schema-sales_attachments',
        title: 'sales_attachments Table',
        badge: 'Files',
      },
      {
        id: 'schema-collection_attachments',
        title: 'collection_attachments Table',
        badge: 'Files',
      },
      {
        id: 'schema-journal_entries',
        title: 'journal_entries Table',
        badge: 'Ledger',
      },
      { id: 'schema-purchase', title: 'purchase Table', badge: 'Purchase' },
      {
        id: 'schema-purchase_items',
        title: 'purchase_items Table',
        badge: 'Purchase',
      },
      {
        id: 'schema-purchase_attachments',
        title: 'purchase_attachments Table',
        badge: 'Files',
      },
      { id: 'schema-payments', title: 'payments Table', badge: 'AP' },
      { id: 'schema-payment_items', title: 'payment_items Table', badge: 'AP' },
      {
        id: 'schema-payment_attachments',
        title: 'payment_attachments Table',
        badge: 'Files',
      },
      { id: 'schema-adjustments', title: 'adjustments Table', badge: 'Journal' },
      {
        id: 'schema-adjustment_attachments',
        title: 'adjustment_attachments Table',
        badge: 'Files',
      },
      { id: 'schema-vat', title: 'vat Table', badge: 'Tax' },
      { id: 'schema-withholding_tax', title: 'withholding_tax Table', badge: 'Tax' },
      { id: 'schema-audit_trail', title: 'audit_trail Table', badge: 'Audit' },
      {
        id: 'schema-bank_reconciliation',
        title: 'bank_reconciliation Table',
        badge: 'Reconcile',
      },
      {
        id: 'schema-bank_reconciliation_items',
        title: 'bank_reconciliation_items Table',
        badge: 'Reconcile',
      },
      {
        id: 'schema-adjustment_balance',
        title: 'adjustment_balance Table',
        badge: 'Balance',
      },
      {
        id: 'schema-bank_reconciliation_summary',
        title: 'bank_reconciliation_summary Table',
        badge: 'Reconcile',
      },
      { id: 'schema-purchase_order', title: 'purchase_order Table', badge: 'PO' },
    ],
  },
  {
    category: 'REST PATTERNS',
    items: [
      { id: 'api-patterns', title: '7. Request/Response Rules', badge: 'JSON' },
      { id: 'error-handling', title: '8. Error Status Mappings', badge: 'HTTP' },
      { id: 'dev-patterns', title: '9. Developer Extensions', badge: 'Tutorial' },
      { id: 'quick-reference', title: '10. SQL Cheat Sheet', badge: 'SQL' },
    ],
  },
  {
    category: 'INTERACTIVE UTILITIES',
    items: [
      {
        id: 'tool-flowchart',
        title: 'Interactive Flowchart Map',
        badge: 'Flow',
        isUtility: true,
      },
      {
        id: 'tool-sandbox',
        title: 'Live Sandbox Playground',
        badge: 'Simulator',
        isUtility: true,
      },
    ],
  },
]

// ============================================================================
// FLOWCHART NODES & CONNECTIONS
// ============================================================================

const nodes = {
  sales: {
    id: 'sales',
    label: 'Sales Invoice',
    x: 100,
    y: 110,
    type: 'input',
    color: 'indigo',
    desc: 'Creates sales invoices, recognizing Revenue & AR balance on credit.',
    endpoint: 'POST /sales',
    debits: [
      {
        account: '1100 - Accounts Receivable',
        desc: 'Total invoice net + tax + VAT',
      },
    ],
    credits: [
      {
        account: '4000 - Sales Revenue',
        desc: 'Sum of item sales prices (excluding taxes)',
      },
    ],
    outputs: ['Invoice Document (PDF)', 'sales record', 'sales_items records'],
    dbTable: 'sales / sales_items',
  },
  collections: {
    id: 'collections',
    label: 'Collections',
    x: 100,
    y: 220,
    type: 'input',
    color: 'indigo',
    desc: 'Customer cash payments applied directly to reduce outstanding AR.',
    endpoint: 'POST /collections',
    debits: [
      { account: '1000 - Cash in Bank', desc: 'Total payment amount cleared' },
    ],
    credits: [
      {
        account: '1100 - Accounts Receivable',
        desc: 'Customer balance settlement reduction',
      },
    ],
    outputs: ['Collection Receipt (PDF)', 'collections record', 'collection_items'],
    dbTable: 'collections / collection_items',
  },
  arsub: {
    id: 'arsub',
    label: 'AR Subledger',
    x: 300,
    y: 165,
    type: 'subledger',
    color: 'cyan',
    desc: 'Tracks individual customer invoices, payments, and outstanding aging balances.',
    endpoint: 'GET /customers/:id (Transactions)',
    debits: [
      { account: 'Customer Balance (Debit)', desc: 'Tracks running owed amounts' },
    ],
    credits: [],
    outputs: ['Customer Statement', 'Unpaid Invoice List'],
    dbTable: 'customers',
  },
  purchase: {
    id: 'purchase',
    label: 'Purchase Invoice',
    x: 100,
    y: 350,
    type: 'input',
    color: 'amber',
    desc: 'Creates vendor purchase invoices, recognizing Expenses/Inventory & AP balance.',
    endpoint: 'POST /purchase',
    debits: [
      {
        account: '5000+ - Expense / Inventory',
        desc: 'Direct product/service cost mappings',
      },
    ],
    credits: [
      { account: '2000 - Accounts Payable', desc: 'Total liability to vendor' },
    ],
    outputs: ['purchase record', 'purchase_items records'],
    dbTable: 'purchase / purchase_items',
  },
  payments: {
    id: 'payments',
    label: 'Vendor Payments',
    x: 100,
    y: 460,
    type: 'input',
    color: 'amber',
    desc: 'Disburses company cash to reduce outstanding accounts payable.',
    endpoint: 'POST /payments',
    debits: [
      {
        account: '2000 - Accounts Payable',
        desc: 'Reduces outstanding liability to vendor',
      },
    ],
    credits: [{ account: '1000 - Cash in Bank', desc: 'Reduces cash holdings' }],
    outputs: ['Payment Voucher (PDF)', 'payments record', 'payment_items'],
    dbTable: 'payments / payment_items',
  },
  apsub: {
    id: 'apsub',
    label: 'AP Subledger',
    x: 300,
    y: 405,
    type: 'subledger',
    color: 'orange',
    desc: 'Tracks individual vendor liabilities, aging schedules, and payment obligations.',
    endpoint: 'GET /vendor/:id (Transactions)',
    debits: [],
    credits: [
      { account: 'Vendor Liability (Credit)', desc: 'Tracks running owed amounts' },
    ],
    outputs: ['Vendor Statement', 'Aging Reports'],
    dbTable: 'vendors',
  },
  receipts: {
    id: 'receipts',
    label: 'Direct Receipts',
    x: 300,
    y: 260,
    type: 'cash',
    color: 'emerald',
    desc: 'Direct cash income bypassing the invoice/AR cycle (e.g. cash sale, bank interest).',
    endpoint: 'POST /receipt',
    debits: [{ account: '1000 - Cash in Bank', desc: 'Direct cash increase' }],
    credits: [
      {
        account: '4500+ - Non-Operating Revenue / Other Income',
        desc: 'Direct revenue stream recognition',
      },
    ],
    outputs: ['receipt record'],
    dbTable: 'receipts',
  },
  disbursements: {
    id: 'disbursements',
    label: 'Direct Disbursements',
    x: 300,
    y: 510,
    type: 'cash',
    color: 'rose',
    desc: 'Instant cash outflows bypassing the purchase/AP cycle (e.g. bank fee, direct utilities).',
    endpoint: 'POST /cash_disbursements',
    debits: [
      {
        account: '5100+ - Category Expense Account',
        desc: 'Direct operational expense mapping',
      },
    ],
    credits: [
      { account: '1000 - Cash in Bank', desc: 'Reduces cash holdings directly' },
    ],
    outputs: ['cash_disbursements record'],
    dbTable: 'cash_disbursements',
  },
  adjustments: {
    id: 'adjustments',
    label: 'Adjustments / JEs',
    x: 300,
    y: 590,
    type: 'core',
    color: 'purple',
    desc: 'Manual adjusting entries (accruals, depreciation) entered by accountants.',
    endpoint: 'POST /adjustments',
    debits: [
      {
        account: 'Any Custom COA (Debit)',
        desc: 'Manual correction or accrued debit balance',
      },
    ],
    credits: [
      {
        account: 'Any Custom COA (Credit)',
        desc: 'Manual correction or accrued credit balance',
      },
    ],
    outputs: ['adjustments record', 'adjustment_items'],
    dbTable: 'adjustments / adjustment_items',
  },
  posting: {
    id: 'posting',
    label: 'Posting Engine',
    x: 520,
    y: 350,
    type: 'core',
    color: 'blue',
    desc: 'The critical processing middleware. Validates DR=CR transactions, computes totals, and writes immutable records to both JEs and audits.',
    endpoint: 'PUT /sales/sales-state (or equivalents)',
    debits: [],
    credits: [],
    outputs: ['Calculated Taxable Totals', 'DR=CR Balancing Validations'],
    dbTable: 'Middleware Processing Logic',
  },
  audit: {
    id: 'audit',
    label: 'Audit Trail Ledger',
    x: 520,
    y: 500,
    type: 'utility',
    color: 'slate',
    desc: 'Irreversible tamper-proof records of every completed accounting state update and creation event.',
    endpoint: 'GET /audit_trail',
    debits: [],
    credits: [],
    outputs: ['Audit Log Output', 'Change comparison files'],
    dbTable: 'audit_trail',
  },
  gl: {
    id: 'gl',
    label: 'General Ledger (GL)',
    x: 720,
    y: 350,
    type: 'core',
    color: 'blue',
    desc: 'The Single Source of Truth for system state. Aggregates all validated transaction lines as journal entries.',
    endpoint: 'GET /journal_entries',
    debits: [
      {
        account: 'All Debit lines from source',
        desc: 'Aggregated in journal_entries',
      },
    ],
    credits: [
      {
        account: 'All Credit lines from source',
        desc: 'Aggregated in journal_entries',
      },
    ],
    outputs: ['Full GL Query Engine'],
    dbTable: 'journal_entries',
  },
  tb: {
    id: 'tb',
    label: 'Trial Balance (TB)',
    x: 920,
    y: 165,
    type: 'report',
    color: 'teal',
    desc: 'Verifies the ultimate accounting rule: sum of all debits equals sum of all credits.',
    endpoint: 'GET /reports/trial-balance',
    debits: [],
    credits: [],
    outputs: ['Trial Balance Report PDF / HTML Excel'],
    dbTable: 'journal_entries [aggregated]',
  },
  is: {
    id: 'is',
    label: 'Income Statement',
    x: 920,
    y: 260,
    type: 'report',
    color: 'teal',
    desc: 'Calculates operational performance over a period: Revenues - Expenses = Net Income.',
    endpoint: 'GET /reports/income-statement',
    debits: [],
    credits: [],
    outputs: ['P&L Document / Net Income Key'],
    dbTable: 'journal_entries [filtered on Revenue/Expense]',
  },
  bs: {
    id: 'bs',
    label: 'Balance Sheet',
    x: 920,
    y: 350,
    type: 'report',
    color: 'teal',
    desc: 'Represents the fundamental equation: Assets = Liabilities + Equity at an exact point in time.',
    endpoint: 'GET /reports/balance-sheet',
    debits: [],
    credits: [],
    outputs: ['Balance Sheet Report Snapshot'],
    dbTable: 'journal_entries [filtered on Asset/Liability/Equity]',
  },
  bankrecon: {
    id: 'bankrecon',
    label: 'Bank Reconciliation',
    x: 920,
    y: 500,
    type: 'utility',
    color: 'purple',
    desc: 'Matches internally tracked cash journal records against raw, uploaded external bank statement items.',
    endpoint: 'GET /bank_reconciliation',
    debits: [],
    credits: [],
    outputs: ['Reconciled Statement', 'Difference Log'],
    dbTable: 'bank_reconciliation / bank_reconciliation_items',
  },
  bankstatement: {
    id: 'bankstatement',
    label: 'Bank Statement',
    x: 720,
    y: 590,
    type: 'external',
    color: 'slate',
    desc: 'Raw external transaction statement sourced from actual financial institutions.',
    endpoint: 'External Input / Statement Import',
    debits: [],
    credits: [],
    outputs: ['Import File (CSV)'],
    dbTable: 'Uploaded document logs',
  },
}

const connections = [
  // Sales & Collections
  { from: 'sales', to: 'arsub', label: 'creates', type: 'subledger' },
  { from: 'sales', to: 'posting', label: 'journal lines', type: 'direct' },
  { from: 'collections', to: 'arsub', label: 'applies to', type: 'subledger' },
  { from: 'collections', to: 'posting', label: 'journal lines', type: 'direct' },
  { from: 'arsub', to: 'gl', label: 'posting updates', type: 'ledger' },

  // Purchases & Payments
  { from: 'purchase', to: 'apsub', label: 'creates', type: 'subledger' },
  { from: 'purchase', to: 'posting', label: 'journal lines', type: 'direct' },
  { from: 'payments', to: 'apsub', label: 'applies to', type: 'subledger' },
  { from: 'payments', to: 'posting', label: 'journal lines', type: 'direct' },
  { from: 'apsub', to: 'gl', label: 'posting updates', type: 'ledger' },

  // Direct cash / Adj
  { from: 'receipts', to: 'posting', label: 'journal lines', type: 'direct' },
  { from: 'disbursements', to: 'posting', label: 'journal lines', type: 'direct' },
  { from: 'adjustments', to: 'posting', label: 'journal lines', type: 'direct' },

  // Processing & Ledger Core
  { from: 'posting', to: 'gl', label: 'posts to', type: 'ledger' },
  { from: 'posting', to: 'audit', label: 'writes', type: 'utility' },

  // Reporting Outputs
  { from: 'gl', to: 'tb', label: 'balances', type: 'report' },
  { from: 'gl', to: 'is', label: 'revenues/expenses', type: 'report' },
  { from: 'gl', to: 'bs', label: 'ending values', type: 'report' },

  // Reconciliation
  { from: 'gl', to: 'bankrecon', label: 'cash ledger', type: 'utility' },
  {
    from: 'bankstatement',
    to: 'bankrecon',
    label: 'external matches',
    type: 'utility',
  },
]

const scenarioFlows = {
  sales_cycle: {
    name: 'Sales to Collections Cycle',
    desc: 'Trace customer credit purchases creating a receivable, and subsequently collecting payment.',
    nodes: [
      'sales',
      'arsub',
      'posting',
      'gl',
      'collections',
      'gl',
      'tb',
      'is',
      'bs',
    ],
    edges: [
      { from: 'sales', to: 'arsub' },
      { from: 'sales', to: 'posting' },
      { from: 'posting', to: 'gl' },
      { from: 'collections', to: 'arsub' },
      { from: 'collections', to: 'posting' },
      { from: 'arsub', to: 'gl' },
      { from: 'gl', to: 'tb' },
      { from: 'gl', to: 'is' },
      { from: 'gl', to: 'bs' },
    ],
    explanation: [
      'Step 1: Sales invoice is generated. It creates a PENDING record in the database and registers customer balance in the AR subledger.',
      'Step 2: Admin approves the invoice. Journal lines (Debit Accounts Receivable 1100, Credit Revenue 4000) go to the Posting Engine.',
      'Step 3: The Posting Engine validates calculations and records the initial credit balance to the General Ledger (journal_entries).',
      "Step 4: Customer sends payment. This collection is recorded, applying directly to lower the customer's AR subledger balance.",
      'Step 5: Collection approval triggers DR Cash 1000, CR AR 1100, which updates the General Ledger, settling the AR balance.',
      'Step 6: Real-time accounting queries update the Trial Balance, Income Statement, and Balance Sheet instantly.',
    ],
  },
  purchase_cycle: {
    name: 'Purchase to Payout Cycle',
    desc: 'Log an incoming vendor invoice for credit purchases, and track vendor payout.',
    nodes: [
      'purchase',
      'apsub',
      'posting',
      'gl',
      'payments',
      'gl',
      'tb',
      'is',
      'bs',
    ],
    edges: [
      { from: 'purchase', to: 'apsub' },
      { from: 'purchase', to: 'posting' },
      { from: 'posting', to: 'gl' },
      { from: 'payments', to: 'apsub' },
      { from: 'payments', to: 'posting' },
      { from: 'apsub', to: 'gl' },
      { from: 'gl', to: 'tb' },
      { from: 'gl', to: 'is' },
      { from: 'gl', to: 'bs' },
    ],
    explanation: [
      'Step 1: Receive a vendor purchase invoice. This establishes the liability inside the Accounts Payable (AP) subledger.',
      'Step 2: Associated expense/inventory debit lines and credit lines go directly into the Posting Engine for approval.',
      'Step 3: Posting writes the approved entries (DR Expense/Asset, CR AP 2000) to the General Ledger.',
      'Step 4: Later, vendor payments are generated (Debit Accounts Payable 2000, Credit Cash 1000) to settle invoices.',
      'Step 5: The payment is marked as completed in the AP subledger and verified through the Posting Engine to update JEs.',
      'Step 6: Net Income decreases and cash drops dynamically across all accounting output reports.',
    ],
  },
  direct_cash_cycle: {
    name: 'Direct Cash Flows (No Credit)',
    desc: 'Review immediate cash events like direct receipts and disbursements that bypass subledgers.',
    nodes: ['receipts', 'disbursements', 'posting', 'gl', 'tb', 'is', 'bs'],
    edges: [
      { from: 'receipts', to: 'posting' },
      { from: 'disbursements', to: 'posting' },
      { from: 'posting', to: 'gl' },
      { from: 'gl', to: 'tb' },
      { from: 'gl', to: 'is' },
      { from: 'gl', to: 'bs' },
    ],
    explanation: [
      'Direct Cash transactions do not require customer AR or vendor AP subledgers, simplifying processing speed.',
      'Receipts (like interest earned or cash sales) directly route journal lines straight to the Posting Engine.',
      'Disbursements (like bank fees or direct utility costs) write expense debits and cash credits straight to the Posting Engine.',
      'The engine commits these entries to journal_entries immediately on approval, triggering instant updates across all report panels.',
    ],
  },
  report_cycle: {
    name: 'Trial Balance & Financial Reports',
    desc: 'How general ledger entries aggregate to build validation checks and standard statement views.',
    nodes: ['adjustments', 'posting', 'gl', 'tb', 'is', 'bs'],
    edges: [
      { from: 'adjustments', to: 'posting' },
      { from: 'posting', to: 'gl' },
      { from: 'gl', to: 'tb' },
      { from: 'gl', to: 'is' },
      { from: 'gl', to: 'bs' },
    ],
    explanation: [
      'Step 1: End of period adjusting journal entries (accruals, depreciation) are entered by accountants and validated.',
      'Step 2: Posting writes manual adjust details straight to the immutable General Ledger (journal_entries).',
      'Step 3: Trial Balance pulls entire coa, validating that global Debits matches global Credits perfectly.',
      'Step 4: Income Statement queries all EXPENSE and REVENUE codes from journal_entries to compute bottom line.',
      'Step 5: Balance Sheet aggregates ASSETS, LIABILITIES, and EQUITY to check that Assets = Liabilities + Equity.',
    ],
  },
}

// Raw Text Documentation conforming to custom accounting styles (Sourced from DEVELOPER_GUIDE.txt)
const documents = [
  {
    id: 'welcome',
    title: 'Accounting System Architecture Overview',
    category: 'GETTING STARTED',
    isHome: true,
    content: '',
  },
  {
    id: 'project-structure',
    title: '1. Project Directory Structure',
    category: 'GETTING STARTED',
    content: `### Directory Architecture
The directory structure establishes a separation of concerns between our Node Express controllers and the responsive React front-end page tables.

\`\`\`bash
Backend:
  server/
    ├─ src/
    │  ├─ controller/          [26 controller files - all business logic]
    │  ├─ routes/              [26 route files - URL mappings]
    │  ├─ database/            [Database connection & utilities]
    │  │  ├─ util/queries.js   [Query() function for DB access]
    │  │  └─ model/            [Schema definitions]
    │  ├─ util/helper.util.js  [SQLQueryBuilder & DataModeling]
    │  ├─ middlewares/         [Authentication, error handling]
    │  └─ startup/             [Initialization]
    └─ server.js              [Express app entry]

Frontend:
  client/
    ├─ src/
    │  ├─ pages/               [React pages by module]
    │  │  ├─ sales/            [Sales invoice management]
    │  │  ├─ collections/      [AR collections]
    │  │  ├─ purchase/         [Purchase orders & invoices]
    │  │  ├─ payments/         [AP payments]
    │  │  ├─ receipts/         [Customer receipts]
    │  │  ├─ disbursements/    [Vendor disbursements]
    │  │  ├─ reports/          [Financial reports]
    │  │  ├─ adjustments/      [GL adjustments]
    │  │  ├─ customers/        [Customer master]
    │  │  ├─ vendors/          [Vendor master]
    │  │  └─ [... other pages]
    │  ├─ components/          [Reusable components]
    │  │  ├─ DynamicTable.jsx
    │  │  ├─ DynamicToast.jsx
    │  │  ├─ ProtectedRoute.jsx
    │  │  └─ RightSideModal.jsx
    │  ├─ utils/
    │  │  ├─ api.js            [API utility - fetch wrapper, auth]
    │  │  ├─ generateXXXPDF.js [PDF generation utilities]
    │  │  └─ routeProtection.js
    │  ├─ App.jsx              [Main router]
    │  └─ main.jsx
    └─ [configuration files]
\`\`\`

### Global Key Utilities
* **Query(sql, params, prefixes, tenantPool)**: Primary safe query function execution tool featuring parameter binding.
* **SQLQueryBuilder**: Helper used to programmatically assemble multi-variable \`WHERE\` loops.
* **DataModeling()**: Clean utility wrapper that formats raw SQL outputs, stripping database prefixes from returned object keys.`,
  },
  {
    id: 'auth',
    title: '2. Authentication & Authorization',
    category: 'GETTING STARTED',
    content: `### JWT Session Flow
The application implements strict session-less token authentication.

1. User submits credentials to \`POST /credentials\`
2. Server validates and returns a compact Signed JWT containing client metadata and authorization profile.
3. Client stores token in \`localStorage.getItem('token')\`
4. Subsequent requests include header: \`Authorization: Bearer <token>\`
5. Token expires → 401 response → Client redirects to login page.

### Public Routes (NO Authentication Required)
* \`POST /credentials\` (login)
* \`GET /health\`
* \`GET /access\`, \`/company\`, \`/customers\`, \`/vendors\`, \`/product_service\`
* \`GET /charts_of_accounts\`, \`/vat\`, \`/withholding_tax\`, \`/proforma_entries\`
* \`GET /journal_entries\`, \`/adjustments\`, \`/reports/*\`
* \`GET /audit_trail\`

### Secure Routes (Auth Required)
* All \`/sales\` endpoints
* All \`/receipt\` endpoints
* All \`/purchase\` endpoints
* All \`/payments\` endpoints
* All \`/collections\` endpoints
* All \`/cash_disbursements\` endpoints
* All \`/purchase_order\` endpoints
* All \`/users\` endpoints
* All \`/route_access\` endpoints

### Authorization Levels
* Stored in \`master_route_access\` table
* Checked via \`user.access_id\`
* Additional role-based checks in some endpoints`,
  },
  {
    id: 'posting-engine',
    title: 'The Posting Engine Middleware (DR=CR)',
    category: 'CORE CONCEPTS',
    content: `### Double-Entry Engine Validation
The Posting Engine validates that the central ledger maintains perfect balance: 

$$\\sum \\text{Debits} = \\sum \\text{Credits}$$

It computes VAT tax rates, handles withholding tax (WHT) calculations, and writes immutable journal entries only when state-change endpoints transition from \`PENDING\` to \`APPROVED\`.

### Ledger Post Rules
* No transaction posts direct lines while in a \`PENDING\` state.
* Subledgers (\`AP Subledger\`, \`AR Subledger\`) aggregate balances to provide subledger reports.
* Once a transaction state changes to \`APPROVED\`, its balance transforms into balanced General Ledger lines.`,
  },
  {
    id: 'journal-ledger',
    title: 'General Ledger and Double-Entry Records',
    category: 'CORE CONCEPTS',
    content: `### General Ledger Model
All reports (\`Trial Balance\`, \`Income Statement\`, \`Balance Sheet\`) extract values directly from the main \`journal_entries\` table. 

This single-source-of-truth strategy guarantees that reporting is decoupled from the state, fields, or configurations of raw transaction documents (such as sales orders or vendor receipts).`,
  },
  {
    id: 'audit-system',
    title: 'Immutable Audit Trail Ledgering',
    category: 'CORE CONCEPTS',
    content: `### Compliance Auditing
For compliance and system traceability, any modifications, status updates, or draft updates write detailed rows into \`audit_trail\`.

* **Irreversible History:** Deleting an approved item is prohibited; it requires a balancing manual Adjustment Journal Entry instead.
* **Trace Details:** Keeps full records of \`changed_fields\` as raw JSON values for detailed change inspections.`,
  },
  {
    id: 'api-reference',
    title: '3. Complete API Specifications',
    category: 'API SPECIFICATIONS',
    content: `### AUTHENTICATION & SYSTEM

#### \`POST /credentials\` (login)
* **Request Payload:**
\`\`\`json
{
  "username": "john_doe",
  "password": "password123"
}
\`\`\`
* **Response (Success):**
\`\`\`json
{
  "success": true,
  "data": {
    "token": "eyJhbGc...",
    "user": {
      "id": 1,
      "fullname": "John Doe",
      "username": "john_doe",
      "access_id": 2
    }
  }
}
\`\`\`

#### \`POST /credentials/logout\`
* **Purpose:** Invalidates Bearer JWT Token.

---

### TRANSACTIONS - SALES

#### \`GET /sales\`
* **Query Params:** \`offset=0\`, \`limit=50\`, \`dateFrom=YYYY-MM-DD\`, \`dateTo=YYYY-MM-DD\`

#### \`POST /sales\`
* **Request Payload:**
\`\`\`json
{
  "customer_id": 5,
  "document_reference": "INV-2024-001",
  "terms": "NET_30",
  "date_delivered": "2024-06-08",
  "date_due": "2024-07-08",
  "remarks": "Standard order",
  "items": [
    {
      "product_service": 12,
      "charts_of_accounts": 45,
      "quantity": 10,
      "sales_price": 100,
      "discount": 5,
      "discountType": "PERCENT",
      "vatRate": 12,
      "whtRate": 3,
      "responsibility_center": "SALES_DEPT"
    }
  ],
  "created_by": "john_doe"
}
\`\`\`

#### \`PUT /sales/sales-state\`
* **Request Payload:**
\`\`\`json
{
  "updates": [
    {
      "id": 125,
      "state": "APPROVED",
      "checked_by": "manager_id",
      "approved_by": "controller_id"
    }
  ]
}
\`\`\`

---

### TRANSACTIONS - COLLECTIONS (AR Settlement)

#### \`POST /collections\`
* **Request Payload:**
\`\`\`json
{
  "customer_id": 5,
  "document_reference": "COL-2024-001",
  "collection_date": "2024-06-15",
  "mode_of_payment": "BANK_TRANSFER",
  "bank_name": "Bank of America",
  "check_number": "CHK12345",
  "items": [
    {
      "sale_id": 125,
      "amount": 1136.40
    }
  ],
  "created_by": "john_doe"
}
\`\`\`

---

### TRANSACTIONS - PURCHASES (AP)

#### \`POST /purchase\`
* **Request Payload:**
\`\`\`json
{
  "vendor_id": 10,
  "document_reference": "PO-2024-001",
  "purchase_order_id": 1,
  "terms": "NET_30",
  "date_received": "2024-06-08",
  "date_due": "2024-07-08",
  "items": [
    {
      "product_service": 12,
      "charts_of_accounts": 50,
      "quantity": 5,
      "purchase_price": 50,
      "discount": 10,
      "discountType": "PERCENT",
      "vatRate": 12,
      "whtRate": 3,
      "responsibility_center": "PROCUREMENT"
    }
  ],
  "created_by": "jane_doe"
}
\`\`\`

---

### TRANSACTIONS - PAYMENTS (AP Settlement)

#### \`POST /payments\`
* **Request Payload:**
\`\`\`json
{
  "vendor_id": 10,
  "document_reference": "PMT-2024-001",
  "payment_date": "2024-06-22",
  "mode_of_payment": "CHECK",
  "bank_name": "Bank of America",
  "check_number": "CHK54321",
  "items": [
    {
      "purchase_id": 75,
      "amount": 234.80
    }
  ],
  "created_by": "controller"
}
\`\`\`

---

### TRANSACTIONS - MANUAL JOURNAL ADJUSTMENTS

#### \`POST /adjustments\`
* **Request Payload:**
\`\`\`json
{
  "document_reference": "ADJ-2024-001",
  "adjustment_date": "2024-06-30",
  "remarks": "Month-end accrual",
  "items": [
    {
      "charts_of_accounts": 60,
      "debit_amount": 0,
      "credit_amount": 1000.00,
      "responsibility_center": "ACCOUNTING"
    },
    {
      "charts_of_accounts": 65,
      "debit_amount": 1000.00,
      "credit_amount": 0,
      "responsibility_center": "ACCOUNTING"
    }
  ],
  "created_by": "accountant"
}
\`\`\`

---

### FINANCIAL REPORTS API

#### \`GET /reports/trial-balance\`
* **Query Parameters:** \`start_date=YYYY-MM-DD\`, \`end_date=YYYY-MM-DD\`
* **Response Details:** Returns accounts aggregated with running Debit/Credit totals, proving balancing ledgers.`,
  },
  {
    id: 'fe-be-mapping',
    title: '4. Frontend-to-Backend Page Mapping',
    category: 'INTEGRATION GUIDE',
    content: `### Sales Module Pages
* **Frontend Path:** \`client/src/pages/sales/Sales.jsx\` (Table list) & \`SalesForm.jsx\` (Detail Form)
* **Backend Trigger:** \`GET /sales\` loads columns, \`POST /sales\` handles creation, and \`PUT /sales/sales-state\` completes approval ledger write loops.

### Collections Module Pages
* **Frontend Path:** \`client/src/pages/collections/Collections.jsx\`
* **Backend Trigger:** Loads unpaid billing selections via \`GET /collections/sales-collection\`, creates collection records with \`POST /collections\`, and posts Debit Cash, Credit AR via \`PUT /collections/collection-state\`.

### Purchase Module Pages
* **Frontend Path:** \`client/src/pages/purchase/Purchase.jsx\`
* **Backend Trigger:** \`GET /purchase\` loads bills, \`POST /purchase\` logs vendor liability draft, and \`PUT /purchase/purchase-state\` approves items.

### Payments Module Pages
* **Frontend Path:** \`client/src/pages/payments/Payments.jsx\`
* **Backend Trigger:** Loads outstanding purchases via \`GET /payments/purchase-payment\`, creates payouts with \`POST /payments\`, and post DR AP, CR Cash via \`PUT /payments/payment-state\`.

### Reports Pages
* **Frontend Path:** \`client/src/pages/reports/TrialBalance.jsx\`, \`IncomeStatement.jsx\`, \`BalanceSheet.jsx\`
* **Backend Trigger:** Queries \`GET /reports/trial-balance\`, \`GET /reports/income-statement\`, and \`GET /reports/balance-sheet\` respectively.`,
  },
  {
    id: 'common-flows',
    title: '5. Double Entry Lifecycles & Flows',
    category: 'INTEGRATION GUIDE',
    content: `### FLOW 1: Sales Invoice & Customer AR Settlement

#### Step 1: Create Invoice
* User adds draft. Backend runs \`createSales()\` inserting header as \`PENDING\`. No ledger entries are compiled yet.

#### Step 2: Approve Invoice
* Trigger approval state update:
  - CREDIT \`4000\` (Sales Revenue) ➔ **$1,035.50**
  - CREDIT \`2150\` (VAT Payable) ➔ **$114.00**
  - DEBIT \`1150\` (WHT Asset) ➔ **$28.50**
  - DEBIT \`1100\` (Accounts Receivable) ➔ **$1,136.40** *(Total Net receivable)*

#### Step 3: Collection Receipt
* Customer settles balance. Receipt registered as draft under PENDING.

#### Step 4: Collection Approval
* Approving writes AR settlement lines:
  - DEBIT \`1000\` (Cash in Bank) ➔ **$1,136.40**
  - CREDIT \`1100\` (Accounts Receivable) ➔ **$1,136.40** *(Clears the outstanding AR balance to zero)*

---

### FLOW 2: Purchase & Vendor Bill Payment

#### Step 1: Record Bill
* Purchase invoice draft established under PENDING state.

#### Step 2: Approve Bill
* Writes AP liabilities to the central ledger:
  - DEBIT \`5000\` (Expenses) ➔ **$225.00**
  - CREDIT \`2000\` (Accounts Payable) ➔ **$234.80**

#### Step 3: Issue Payment
* payment is approved:
  - DEBIT \`2000\` (Accounts Payable) ➔ **$234.80**
  - CREDIT \`1000\` (Cash in Bank) ➔ **$234.80**`,
  },
  {
    id: 'db-schema',
    title: '6. Complete Database Schema Spec',
    category: 'DATABASE DICTIONARY',
    content: `### Complete Table Reference from Create Migrations

This section lists every table created by the migrations under \`server/src/database/migrations/create\`.
Each entry includes the table name and the key role it plays in the accounting system.

#### Master / Security Tables
* \`master_access\`: Permission metadata for route and module access.
* \`master_user\`: User account credentials, profile, and access assignment.
* \`master_company\`: Company profile and tenant configuration data.
* \`master_route_access\`: Route-level authorization mappings between user access profiles and protected pages.

#### Core Ledger & Configuration Tables
* \`charts_of_accounts\`: Chart of accounts definitions (Assets, Liabilities, Equity, Revenue, Expense).
* \`customers\`: Customer master data used by sales and collections flows.
* \`customers_information\`: Extended customer details, contact, and address metadata.
* \`vendors\`: Vendor master data used by purchase and payments flows.
* \`vendors_information\`: Extended vendor contact and classification data.
* \`products_service\`: Product and service catalog used for invoice itemization.
* \`proforma_entries\`: Proforma invoice records and draft quote references.

#### Cash, Receipts, and Collections Tables
* \`cash_disbursements\`: Direct cash expense transactions outside the AP cycle.
* \`receipts\`: Direct cash receipts and cash sale records outside the AR cycle.
* \`sales\`: Sales invoices and customer billing documents.
* \`collections\`: Cash collections against outstanding accounts receivable.
* \`cash_disbursement_items\`: Line items for cash disbursements.
* \`receipt_items\`: Line items for direct receipts.
* \`sales_items\`: Sales invoice line items, tax calculations, and revenue mapping.
* \`collection_items\`: Itemized collection allocations to invoices.

#### Attachment and Document Storage Tables
* \`cash_disbursement_attachments\`: File attachments for cash disbursements.
* \`receipt_attachments\`: File attachments for receipts.
* \`sales_attachments\`: File attachments for sales invoices.
* \`collection_attachments\`: File attachments for collection receipts.
* \`purchase_attachments\`: File attachments for purchase invoices.

#### Procurement and Payables Tables
* \`purchase\`: Vendor purchase invoices and draft AP documents.
* \`purchase_items\`: Line items for purchase invoices.
* \`payments\`: Vendor payment transactions and payout drafts.
* \`payment_items\`: Lines for vendor payments and cash application.

#### Adjustments, Tax, and Reconciliation Tables
* \`adjustments\`: Manual journal adjustment entries and correction batches.
* \`adjustment_attachments\`: Supporting documentation for adjustments.
* \`vat\`: VAT rate records and VAT posting configuration.
* \`withholding_tax\`: Withholding tax rates and calculation definitions.
* \`purchase_order\`: Purchase orders and vendor order tracking.

#### Ledger, Audit, and Reporting Tables
* \`journal_entries\`: The central double-entry ledger recording all debit and credit lines.
* \`audit_trail\`: Immutable audit records for every approved transaction update.
* \`bank_reconciliation\`: Bank reconciliation header records.
* \`bank_reconciliation_items\`: Bank statement line matching records.
* \`adjustment_balance\`: Adjustment balance summaries used for closing and reclassification.
* \`bank_reconciliation_summary\`: Reconciliation totals and variance summary records.

### Migration patch notes
* \`update-journal_entries\`: Schema update migration for \`journal_entries\` table structure.
* \`add-bank_statement_balance-to-bank_reconciliation\`: Schema update that extends \`bank_reconciliation\` with bank statement balance tracking.

> The above list aligns all created migration files with the physical tables they define and the key data areas they populate.
`,
  },
  {
    id: 'api-patterns',
    title: '7. Request & Response Patterns',
    category: 'REST PATTERNS',
    content: `### Standard Success JSON Structure
\`\`\`json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": [
    { "id": 1, "name": "Record A" }
  ],
  "count": 1,
  "offset": 0,
  "limit": 50,
  "hasMore": false,
  "timestamp": "2026-06-09T15:00:00Z"
}
\`\`\`

### Pagination Standards
All listing arrays support paging queries:
* \`offset\`: default \`0\`
* \`limit\`: default \`50\` (maximum \`100\`)

### Special Filter Syntax
* **Inclusive dates:** \`dateFrom\` & \`dateTo\` (Inclusive, YYYY-MM-DD).
* **Document print outputs:** \`GET /sales/print/:id?copyType=internal|customer\``,
  },
  {
    id: 'error-handling',
    title: '8. Standard Error Status Mappings',
    category: 'REST PATTERNS',
    content: `### HTTP Error Codes used in LedgerFlow

* **400 Bad Request:** Missing/Malformed request parameters.
* **401 Unauthorized:** Invalid JWT token or token has expired (\`code: TOKEN_EXPIRED\`).
* **403 Forbidden:** Authenticated user profile lacks route privileges.
* **404 Not Found:** Resource requested does not exist.
* **422 Unprocessable Entity:** Business rule violation (e.g., customer ID does not exist).
* **500 Internal Server Error:** Unexpected database exceptions.

### Example JSON: Validation Failure (422)
\`\`\`json
{
  "success": false,
  "message": "Validation failed",
  "validation_errors": {
    "customer_id": "Customer with id 999 does not exist",
    "date_due": "Must be after date_delivered"
  },
  "timestamp": "2026-06-09T15:05:00Z"
}
\`\`\``,
  },
  {
    id: 'dev-patterns',
    title: '9. Developer Extensions Tutorial',
    category: 'REST PATTERNS',
    content: `### Adding a New Commission Transaction Type

#### Step 1: Commission DB Controller (Express backend)
\`\`\`javascript
exports.createCommission = async (req, res) => {
  const { salesman_id, commission_date, amount } = req.body;
  
  // Validation checks
  if (!salesman_id || !amount) {
    return res.status(400).json({ success: false, message: "Salesman and amount are required" });
  }

  const sql = 'INSERT INTO commissions (salesman_id, commission_date, amount, state) VALUES (?, ?, ?, ?)';
  await Query(sql, [salesman_id, commission_date, amount, 'PENDING']);
  
  res.status(201).json({ success: true, message: "Commission recorded!" });
};
\`\`\`

#### Step 2: Route Approvals Configuration
When commission is approved, write Debit Expense, Credit Payable to ledger:
\`\`\`javascript
exports.approveCommission = async (req, res) => {
  const { id } = req.body;
  await Query("UPDATE commissions SET state = 'APPROVED' WHERE id = ?", [id]);
  
  // Post DR/CR Ledger entries
  await Query("INSERT INTO journal_entries (db_name, db_id, coa_id, type, amount) VALUES ('COMMISSION', ?, 55, 'DEBIT', ?)", [id, amount]);
  await Query("INSERT INTO journal_entries (db_name, db_id, coa_id, type, amount) VALUES ('COMMISSION', ?, 25, 'CREDIT', ?)", [id, amount]);
};
\`\`\``,
  },
  {
    id: 'quick-reference',
    title: '10. SQL Debugging Cheat Sheet',
    category: 'REST PATTERNS',
    content: `### Common SQL Queries for Debugging and Audits

#### Find all unposted transactions
\`\`\`sql
SELECT * FROM sales WHERE state = 'PENDING' ORDER BY created_date DESC;
\`\`\`

#### Verify Trial Balance equations balance
\`\`\`sql
SELECT 
  SUM(CASE WHEN type = 'DEBIT' THEN amount ELSE 0 END) as total_debits,
  SUM(CASE WHEN type = 'CREDIT' THEN amount ELSE 0 END) as total_credits
FROM journal_entries
WHERE date BETWEEN '2026-06-01' AND '2026-06-30';
\`\`\`

#### Find Accounts Receivable (AR) balance for a specific customer
\`\`\`sql
SELECT SUM(amount) as ar_balance
FROM journal_entries
WHERE coa_id = 10 AND db_name IN ('SALES', 'COLLECTION')
  AND date <= '2026-06-30';
\`\`\``,
  },
]

// Mock database tables for layout reference
const schemaTables = [
  {
    name: 'master_access',
    desc: 'Defines route and module access permissions for user profiles.',
    columns: [
      { name: 'id', type: 'INT', key: 'PK', notes: 'Auto Increment' },
      {
        name: 'route_name',
        type: 'VARCHAR(100)',
        key: '',
        notes: 'Route identifier used by the app',
      },
      {
        name: 'permission_code',
        type: 'VARCHAR(50)',
        key: '',
        notes: 'Permission label for access control',
      },
      {
        name: 'description',
        type: 'VARCHAR(200)',
        key: '',
        notes: 'Route access description',
      },
    ],
  },
  {
    name: 'master_user',
    desc: 'Stores registered user profiles and their assigned access roles.',
    columns: [
      { name: 'id', type: 'INT', key: 'PK', notes: 'Auto Increment' },
      {
        name: 'username',
        type: 'VARCHAR(100)',
        key: 'Unique',
        notes: 'Login username',
      },
      {
        name: 'fullname',
        type: 'VARCHAR(150)',
        key: '',
        notes: 'User display name',
      },
      {
        name: 'access_id',
        type: 'INT',
        key: 'FK',
        notes: 'Link to master_access profile',
      },
      {
        name: 'status',
        type: 'VARCHAR(20)',
        key: '',
        notes: 'ACTIVE / INACTIVE / SUSPENDED',
      },
    ],
  },
  {
    name: 'master_company',
    desc: 'Company profile and tenant configuration storage.',
    columns: [
      { name: 'id', type: 'INT', key: 'PK', notes: 'Auto Increment' },
      {
        name: 'company_name',
        type: 'VARCHAR(200)',
        key: '',
        notes: 'Registered company name',
      },
      {
        name: 'tax_id',
        type: 'VARCHAR(50)',
        key: '',
        notes: 'Tax or registration number',
      },
      {
        name: 'address',
        type: 'VARCHAR(300)',
        key: '',
        notes: 'Primary company address',
      },
    ],
  },
  {
    name: 'master_route_access',
    desc: 'Maps access profiles to protected application routes.',
    columns: [
      { name: 'id', type: 'INT', key: 'PK', notes: 'Auto Increment' },
      {
        name: 'access_id',
        type: 'INT',
        key: 'FK',
        notes: 'Links to master_access profile',
      },
      {
        name: 'route_name',
        type: 'VARCHAR(100)',
        key: '',
        notes: 'Protected route identifier',
      },
      { name: 'can_view', type: 'BOOLEAN', key: '', notes: 'View permission flag' },
    ],
  },
  {
    name: 'charts_of_accounts',
    desc: 'Ledger account definitions for double-entry postings.',
    columns: [
      { name: 'id', type: 'INT', key: 'PK', notes: 'Auto Increment' },
      {
        name: 'code',
        type: 'VARCHAR(20)',
        key: 'Unique',
        notes: "e.g., '1000', '1100', '4000'",
      },
      { name: 'name', type: 'VARCHAR(100)', key: '', notes: 'Account title' },
      {
        name: 'type',
        type: 'ENUM',
        key: '',
        notes: 'ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE',
      },
    ],
  },
  {
    name: 'customers',
    desc: 'Customer master records for AR and sales processing.',
    columns: [
      { name: 'id', type: 'INT', key: 'PK', notes: 'Auto Increment' },
      { name: 'code', type: 'VARCHAR(50)', key: 'Unique', notes: 'Customer code' },
      {
        name: 'name',
        type: 'VARCHAR(200)',
        key: '',
        notes: 'Customer business name',
      },
      { name: 'status', type: 'VARCHAR(30)', key: '', notes: 'ACTIVE / DORMANT' },
    ],
  },
  {
    name: 'customers_information',
    desc: 'Extended customer contact and billing details.',
    columns: [
      { name: 'id', type: 'INT', key: 'PK', notes: 'Auto Increment' },
      {
        name: 'customer_id',
        type: 'INT',
        key: 'FK',
        notes: 'Links to customers.id',
      },
      {
        name: 'contact_person',
        type: 'VARCHAR(150)',
        key: '',
        notes: 'Primary contact name',
      },
      {
        name: 'email',
        type: 'VARCHAR(150)',
        key: '',
        notes: 'Contact email address',
      },
    ],
  },
  {
    name: 'vendors',
    desc: 'Vendor master records for purchase and payment workflows.',
    columns: [
      { name: 'id', type: 'INT', key: 'PK', notes: 'Auto Increment' },
      { name: 'code', type: 'VARCHAR(50)', key: 'Unique', notes: 'Vendor code' },
      { name: 'name', type: 'VARCHAR(200)', key: '', notes: 'Vendor name' },
      { name: 'status', type: 'VARCHAR(30)', key: '', notes: 'ACTIVE / SUSPENDED' },
    ],
  },
  {
    name: 'vendors_information',
    desc: 'Supplemental vendor contact and classification data.',
    columns: [
      { name: 'id', type: 'INT', key: 'PK', notes: 'Auto Increment' },
      { name: 'vendor_id', type: 'INT', key: 'FK', notes: 'Links to vendors.id' },
      {
        name: 'contact_person',
        type: 'VARCHAR(150)',
        key: '',
        notes: 'Primary contact',
      },
      { name: 'phone', type: 'VARCHAR(50)', key: '', notes: 'Vendor phone number' },
    ],
  },
  {
    name: 'products_service',
    desc: 'Product and service catalog entries used for invoicing.',
    columns: [
      { name: 'id', type: 'INT', key: 'PK', notes: 'Auto Increment' },
      {
        name: 'code',
        type: 'VARCHAR(50)',
        key: 'Unique',
        notes: 'SKU or service code',
      },
      {
        name: 'description',
        type: 'VARCHAR(200)',
        key: '',
        notes: 'Description of item',
      },
      {
        name: 'price',
        type: 'DECIMAL(15,2)',
        key: '',
        notes: 'Standard unit price',
      },
    ],
  },
  {
    name: 'proforma_entries',
    desc: 'Draft quote and proforma invoice records before formal sales posting.',
    columns: [
      { name: 'id', type: 'INT', key: 'PK', notes: 'Auto Increment' },
      { name: 'customer_id', type: 'INT', key: 'FK', notes: 'Linked customer' },
      {
        name: 'reference',
        type: 'VARCHAR(100)',
        key: 'Unique',
        notes: 'Proforma code',
      },
      { name: 'total_amount', type: 'DECIMAL(15,2)', key: '', notes: 'Quote total' },
    ],
  },
  {
    name: 'cash_disbursements',
    desc: 'Direct cash expense records outside the purchase/AP cycle.',
    columns: [
      { name: 'id', type: 'INT', key: 'PK', notes: 'Auto Increment' },
      {
        name: 'description',
        type: 'VARCHAR(250)',
        key: '',
        notes: 'Expense description',
      },
      { name: 'amount', type: 'DECIMAL(15,2)', key: '', notes: 'Disbursed amount' },
      { name: 'state', type: 'VARCHAR(30)', key: '', notes: 'PENDING / APPROVED' },
    ],
  },
  {
    name: 'receipts',
    desc: 'Direct receipt records for cash inflows not tied to invoices.',
    columns: [
      { name: 'id', type: 'INT', key: 'PK', notes: 'Auto Increment' },
      {
        name: 'customer_id',
        type: 'INT',
        key: 'FK',
        notes: 'Linked customer optionally',
      },
      { name: 'amount', type: 'DECIMAL(15,2)', key: '', notes: 'Receipt amount' },
      { name: 'payment_date', type: 'DATE', key: '', notes: 'Collection date' },
    ],
  },
  {
    name: 'sales',
    desc: 'Sales invoice headers and customer billing documents.',
    columns: [
      { name: 'id', type: 'INT', key: 'PK', notes: 'Auto Increment' },
      {
        name: 'customer_id',
        type: 'INT',
        key: 'FK',
        notes: 'Linked customer record',
      },
      {
        name: 'document_reference',
        type: 'VARCHAR(100)',
        key: 'Unique',
        notes: 'Invoice code',
      },
      {
        name: 'total_amount_due',
        type: 'DECIMAL(15,2)',
        key: '',
        notes: 'Invoice total',
      },
      {
        name: 'state',
        type: 'VARCHAR(30)',
        key: '',
        notes: 'PENDING / APPROVED / PAID',
      },
    ],
  },
  {
    name: 'collections',
    desc: 'Customer collection records that settle accounts receivable.',
    columns: [
      { name: 'id', type: 'INT', key: 'PK', notes: 'Auto Increment' },
      { name: 'sales_id', type: 'INT', key: 'FK', notes: 'Linked sales invoice' },
      { name: 'amount', type: 'DECIMAL(15,2)', key: '', notes: 'Collected amount' },
      { name: 'collection_date', type: 'DATE', key: '', notes: 'Cash receipt date' },
    ],
  },
  {
    name: 'cash_disbursement_items',
    desc: 'Line items for cash disbursement transactions.',
    columns: [
      { name: 'id', type: 'INT', key: 'PK', notes: 'Auto Increment' },
      {
        name: 'cash_disbursement_id',
        type: 'INT',
        key: 'FK',
        notes: 'Parent record reference',
      },
      { name: 'coa_id', type: 'INT', key: 'FK', notes: 'Ledger account posted to' },
      { name: 'amount', type: 'DECIMAL(15,2)', key: '', notes: 'Line amount' },
    ],
  },
  {
    name: 'receipt_items',
    desc: 'Line items for cash receipts.',
    columns: [
      { name: 'id', type: 'INT', key: 'PK', notes: 'Auto Increment' },
      { name: 'receipt_id', type: 'INT', key: 'FK', notes: 'Parent receipt record' },
      { name: 'coa_id', type: 'INT', key: 'FK', notes: 'Ledger posting reference' },
      { name: 'amount', type: 'DECIMAL(15,2)', key: '', notes: 'Item amount' },
    ],
  },
  {
    name: 'sales_items',
    desc: 'Sales invoice line items and tax calculation details.',
    columns: [
      { name: 'id', type: 'INT', key: 'PK', notes: 'Auto Increment' },
      { name: 'sales_id', type: 'INT', key: 'FK', notes: 'Parent sales invoice' },
      {
        name: 'product_service_id',
        type: 'INT',
        key: 'FK',
        notes: 'Referenced product or service',
      },
      { name: 'gross', type: 'DECIMAL(15,2)', key: '', notes: 'Line gross amount' },
      { name: 'vat', type: 'DECIMAL(15,2)', key: '', notes: 'VAT amount' },
      { name: 'net', type: 'DECIMAL(15,2)', key: '', notes: 'Net line value' },
    ],
  },
  {
    name: 'collection_items',
    desc: 'Allocated amounts of collections against specific invoices.',
    columns: [
      { name: 'id', type: 'INT', key: 'PK', notes: 'Auto Increment' },
      {
        name: 'collection_id',
        type: 'INT',
        key: 'FK',
        notes: 'Parent collection entry',
      },
      { name: 'sales_id', type: 'INT', key: 'FK', notes: 'Assigned sales invoice' },
      { name: 'amount', type: 'DECIMAL(15,2)', key: '', notes: 'Applied amount' },
    ],
  },
  {
    name: 'cash_disbursement_attachments',
    desc: 'Document attachments for cash disbursement records.',
    columns: [
      { name: 'id', type: 'INT', key: 'PK', notes: 'Auto Increment' },
      {
        name: 'cash_disbursement_id',
        type: 'INT',
        key: 'FK',
        notes: 'Linked cash disbursement',
      },
      {
        name: 'file_path',
        type: 'VARCHAR(250)',
        key: '',
        notes: 'Attachment location',
      },
      { name: 'uploaded_at', type: 'DATETIME', key: '', notes: 'Upload timestamp' },
    ],
  },
  {
    name: 'receipt_attachments',
    desc: 'Attachment files for receipt records.',
    columns: [
      { name: 'id', type: 'INT', key: 'PK', notes: 'Auto Increment' },
      { name: 'receipt_id', type: 'INT', key: 'FK', notes: 'Linked receipt' },
      {
        name: 'file_path',
        type: 'VARCHAR(250)',
        key: '',
        notes: 'Attachment location',
      },
      { name: 'uploaded_at', type: 'DATETIME', key: '', notes: 'Upload timestamp' },
    ],
  },
  {
    name: 'sales_attachments',
    desc: 'Attached documents for sales invoices.',
    columns: [
      { name: 'id', type: 'INT', key: 'PK', notes: 'Auto Increment' },
      { name: 'sales_id', type: 'INT', key: 'FK', notes: 'Linked sales invoice' },
      {
        name: 'file_path',
        type: 'VARCHAR(250)',
        key: '',
        notes: 'Stored attachment path',
      },
      { name: 'uploaded_at', type: 'DATETIME', key: '', notes: 'Upload timestamp' },
    ],
  },
  {
    name: 'collection_attachments',
    desc: 'Attachment records for collection receipts.',
    columns: [
      { name: 'id', type: 'INT', key: 'PK', notes: 'Auto Increment' },
      {
        name: 'collection_id',
        type: 'INT',
        key: 'FK',
        notes: 'Linked collection record',
      },
      { name: 'file_path', type: 'VARCHAR(250)', key: '', notes: 'Attachment path' },
      { name: 'uploaded_at', type: 'DATETIME', key: '', notes: 'Upload timestamp' },
    ],
  },
  {
    name: 'journal_entries',
    desc: 'Central double-entry ledger table for all approved financial transactions.',
    columns: [
      { name: 'id', type: 'INT', key: 'PK', notes: 'Auto Increment' },
      {
        name: 'db_name',
        type: 'VARCHAR(50)',
        key: '',
        notes: 'Origin identifier such as SALES or PURCHASE',
      },
      {
        name: 'db_id',
        type: 'INT',
        key: '',
        notes: 'Foreign reference to source transaction',
      },
      {
        name: 'coa_id',
        type: 'INT',
        key: 'FK',
        notes: 'Linked charts_of_accounts entry',
      },
      { name: 'type', type: 'VARCHAR(10)', key: '', notes: 'DEBIT / CREDIT' },
      { name: 'amount', type: 'DECIMAL(15,2)', key: '', notes: 'Posted value' },
      { name: 'date', type: 'DATE', key: '', notes: 'Ledger posting date' },
    ],
  },
  {
    name: 'purchase',
    desc: 'Vendor purchase invoices and purchase order fulfillment records.',
    columns: [
      { name: 'id', type: 'INT', key: 'PK', notes: 'Auto Increment' },
      { name: 'vendor_id', type: 'INT', key: 'FK', notes: 'Linked vendor record' },
      {
        name: 'document_reference',
        type: 'VARCHAR(100)',
        key: 'Unique',
        notes: 'Purchase invoice code',
      },
      {
        name: 'total_amount_due',
        type: 'DECIMAL(15,2)',
        key: '',
        notes: 'Amount owed to vendor',
      },
      {
        name: 'state',
        type: 'VARCHAR(30)',
        key: '',
        notes: 'PENDING / APPROVED / PAID',
      },
    ],
  },
  {
    name: 'purchase_items',
    desc: 'Line items for purchase invoices.',
    columns: [
      { name: 'id', type: 'INT', key: 'PK', notes: 'Auto Increment' },
      {
        name: 'purchase_id',
        type: 'INT',
        key: 'FK',
        notes: 'Parent purchase invoice',
      },
      {
        name: 'product_service_id',
        type: 'INT',
        key: 'FK',
        notes: 'Referenced product or service',
      },
      { name: 'amount', type: 'DECIMAL(15,2)', key: '', notes: 'Line amount' },
    ],
  },
  {
    name: 'purchase_attachments',
    desc: 'Attachments for purchase invoices and supporting documents.',
    columns: [
      { name: 'id', type: 'INT', key: 'PK', notes: 'Auto Increment' },
      {
        name: 'purchase_id',
        type: 'INT',
        key: 'FK',
        notes: 'Linked purchase record',
      },
      {
        name: 'file_path',
        type: 'VARCHAR(250)',
        key: '',
        notes: 'Attachment location',
      },
      { name: 'uploaded_at', type: 'DATETIME', key: '', notes: 'Upload timestamp' },
    ],
  },
  {
    name: 'payments',
    desc: 'Vendor payments and payout transactions.',
    columns: [
      { name: 'id', type: 'INT', key: 'PK', notes: 'Auto Increment' },
      { name: 'vendor_id', type: 'INT', key: 'FK', notes: 'Linked vendor' },
      { name: 'amount', type: 'DECIMAL(15,2)', key: '', notes: 'Payment amount' },
      {
        name: 'payment_date',
        type: 'DATE',
        key: '',
        notes: 'Date payment was made',
      },
    ],
  },
  {
    name: 'payment_items',
    desc: 'Line items for vendor payments applied against purchase invoices.',
    columns: [
      { name: 'id', type: 'INT', key: 'PK', notes: 'Auto Increment' },
      { name: 'payment_id', type: 'INT', key: 'FK', notes: 'Linked payment record' },
      {
        name: 'purchase_id',
        type: 'INT',
        key: 'FK',
        notes: 'Applied purchase invoice',
      },
      { name: 'amount', type: 'DECIMAL(15,2)', key: '', notes: 'Amount applied' },
    ],
  },
  {
    name: 'payment_attachments',
    desc: 'Attachments for vendor payment transactions.',
    columns: [
      { name: 'id', type: 'INT', key: 'PK', notes: 'Auto Increment' },
      { name: 'payment_id', type: 'INT', key: 'FK', notes: 'Linked payment record' },
      {
        name: 'file_path',
        type: 'VARCHAR(250)',
        key: '',
        notes: 'Attachment location',
      },
      { name: 'uploaded_at', type: 'DATETIME', key: '', notes: 'Upload timestamp' },
    ],
  },
  {
    name: 'adjustments',
    desc: 'Manual journal adjustments for accruals, corrections, and reclassifications.',
    columns: [
      { name: 'id', type: 'INT', key: 'PK', notes: 'Auto Increment' },
      {
        name: 'reference',
        type: 'VARCHAR(100)',
        key: 'Unique',
        notes: 'Adjustment code',
      },
      {
        name: 'reason',
        type: 'VARCHAR(250)',
        key: '',
        notes: 'Adjustment description',
      },
      {
        name: 'amount',
        type: 'DECIMAL(15,2)',
        key: '',
        notes: 'Total adjustment impact',
      },
    ],
  },
  {
    name: 'adjustment_attachments',
    desc: 'Supporting documentation for adjustment entries.',
    columns: [
      { name: 'id', type: 'INT', key: 'PK', notes: 'Auto Increment' },
      {
        name: 'adjustment_id',
        type: 'INT',
        key: 'FK',
        notes: 'Linked adjustment record',
      },
      { name: 'file_path', type: 'VARCHAR(250)', key: '', notes: 'Attachment path' },
      { name: 'uploaded_at', type: 'DATETIME', key: '', notes: 'Upload timestamp' },
    ],
  },
  {
    name: 'vat',
    desc: 'VAT tax rate definitions and configuration.',
    columns: [
      { name: 'id', type: 'INT', key: 'PK', notes: 'Auto Increment' },
      { name: 'rate', type: 'DECIMAL(5,2)', key: '', notes: 'VAT percentage' },
      {
        name: 'description',
        type: 'VARCHAR(150)',
        key: '',
        notes: 'Rate description',
      },
      { name: 'status', type: 'VARCHAR(20)', key: '', notes: 'ACTIVE / INACTIVE' },
    ],
  },
  {
    name: 'withholding_tax',
    desc: 'Withholding tax rate definitions and calculation metadata.',
    columns: [
      { name: 'id', type: 'INT', key: 'PK', notes: 'Auto Increment' },
      {
        name: 'rate',
        type: 'DECIMAL(5,2)',
        key: '',
        notes: 'Withholding percentage rate',
      },
      {
        name: 'description',
        type: 'VARCHAR(150)',
        key: '',
        notes: 'Tax description',
      },
      {
        name: 'applies_to',
        type: 'VARCHAR(100)',
        key: '',
        notes: 'Applies to sales or purchases',
      },
    ],
  },
  {
    name: 'audit_trail',
    desc: 'Immutable audit history capturing transaction state changes.',
    columns: [
      { name: 'id', type: 'INT', key: 'PK', notes: 'Auto Increment' },
      {
        name: 'entity_name',
        type: 'VARCHAR(100)',
        key: '',
        notes: 'Source entity type',
      },
      { name: 'entity_id', type: 'INT', key: '', notes: 'Source record identifier' },
      {
        name: 'changed_by',
        type: 'INT',
        key: '',
        notes: 'User who made the change',
      },
      {
        name: 'change_payload',
        type: 'JSON',
        key: '',
        notes: 'Serialized change details',
      },
    ],
  },
  {
    name: 'bank_reconciliation',
    desc: 'Bank reconciliation header records for external bank statement matching.',
    columns: [
      { name: 'id', type: 'INT', key: 'PK', notes: 'Auto Increment' },
      {
        name: 'statement_date',
        type: 'DATE',
        key: '',
        notes: 'Bank statement date',
      },
      {
        name: 'bank_statement_balance',
        type: 'DECIMAL(15,2)',
        key: '',
        notes: 'External closing balance',
      },
      {
        name: 'reconciled_at',
        type: 'DATETIME',
        key: '',
        notes: 'Completion timestamp',
      },
    ],
  },
  {
    name: 'bank_reconciliation_items',
    desc: 'Matched bank statement line items tied to reconciliation cycles.',
    columns: [
      { name: 'id', type: 'INT', key: 'PK', notes: 'Auto Increment' },
      {
        name: 'bank_reconciliation_id',
        type: 'INT',
        key: 'FK',
        notes: 'Parent reconciliation record',
      },
      {
        name: 'reference',
        type: 'VARCHAR(150)',
        key: '',
        notes: 'Statement line description',
      },
      { name: 'amount', type: 'DECIMAL(15,2)', key: '', notes: 'Matched amount' },
    ],
  },
  {
    name: 'adjustment_balance',
    desc: 'Balance summary entries for adjustment posting validation.',
    columns: [
      { name: 'id', type: 'INT', key: 'PK', notes: 'Auto Increment' },
      { name: 'adjustment_id', type: 'INT', key: 'FK', notes: 'Linked adjustment' },
      {
        name: 'balance_before',
        type: 'DECIMAL(15,2)',
        key: '',
        notes: 'Balance prior to adjustment',
      },
      {
        name: 'balance_after',
        type: 'DECIMAL(15,2)',
        key: '',
        notes: 'Balance after adjustment',
      },
    ],
  },
  {
    name: 'bank_reconciliation_summary',
    desc: 'Summary totals and variance results for reconciliation cycles.',
    columns: [
      { name: 'id', type: 'INT', key: 'PK', notes: 'Auto Increment' },
      {
        name: 'bank_reconciliation_id',
        type: 'INT',
        key: 'FK',
        notes: 'Parent bank reconciliation record',
      },
      {
        name: 'total_matched',
        type: 'DECIMAL(15,2)',
        key: '',
        notes: 'Total matched amount',
      },
      {
        name: 'variance',
        type: 'DECIMAL(15,2)',
        key: '',
        notes: 'Difference between internal and bank balance',
      },
    ],
  },
  {
    name: 'purchase_order',
    desc: 'Purchase order headers for procurement workflows.',
    columns: [
      { name: 'id', type: 'INT', key: 'PK', notes: 'Auto Increment' },
      { name: 'vendor_id', type: 'INT', key: 'FK', notes: 'Linked vendor record' },
      {
        name: 'order_reference',
        type: 'VARCHAR(100)',
        key: 'Unique',
        notes: 'Purchase order number',
      },
      {
        name: 'total_amount',
        type: 'DECIMAL(15,2)',
        key: '',
        notes: 'Order total value',
      },
    ],
  },
]
export default function App() {
  const [selectedDocId, setSelectedDocId] = useState('welcome')
  const [searchQuery, setSearchQuery] = useState('')
  const [copiedText, setCopiedText] = useState('')

  // Flowchart Visualizer States
  const [selectedNodeId, setSelectedNodeId] = useState('sales')
  const [activeScenario, setActiveScenario] = useState('sales_cycle')
  const [isPlaying, setIsPlaying] = useState(true)
  const [stepIndex, setStepIndex] = useState(0)

  // Playground States
  const [traceStep, setTraceStep] = useState(0) // 0: Config -> 1: Posted -> 2: Approved -> 3: Paid
  const [sandboxQty, setSandboxQty] = useState(12)
  const [sandboxPrice, setSandboxPrice] = useState(150)
  const [sandboxVatRate, setSandboxVatRate] = useState(12)
  const [sandboxWhtRate, setSandboxWhtRate] = useState(3)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [sandboxResponse, setSandboxResponse] = useState(null)

  // Computations for the Sandbox Playground
  const computedGross = useMemo(
    () => sandboxQty * sandboxPrice,
    [sandboxQty, sandboxPrice],
  )
  const computedVat = useMemo(
    () => computedGross * (sandboxVatRate / 100),
    [computedGross, sandboxVatRate],
  )
  const computedWht = useMemo(
    () => computedGross * (sandboxWhtRate / 100),
    [computedGross, sandboxWhtRate],
  )
  const computedNet = useMemo(
    () => computedGross + computedVat - computedWht,
    [computedGross, computedVat, computedWht],
  )

  // Check if a node is currently active in the selected scenario steps
  const isNodeHighlighted = (id) => {
    const currentScenario = scenarioFlows[activeScenario]
    return currentScenario ? currentScenario.nodes.includes(id) : false
  }

  // Check if connection is currently active in selected scenario
  const isConnectionHighlighted = (from, to) => {
    const currentScenario = scenarioFlows[activeScenario]
    return currentScenario
      ? currentScenario.edges.some((edge) => edge.from === from && edge.to === to)
      : false
  }

  // Autoplay scenario runner for flowchart
  useEffect(() => {
    let interval = null
    if (isPlaying && selectedDocId === 'tool-flowchart') {
      interval = setInterval(() => {
        setStepIndex(
          (prev) => (prev + 1) % scenarioFlows[activeScenario].explanation.length,
        )
      }, 5500)
    }
    return () => clearInterval(interval)
  }, [isPlaying, activeScenario, selectedDocId])

  const handleCopyCode = (codeText) => {
    navigator.clipboard.writeText(codeText)
    setCopiedText('Copied!')
    setTimeout(() => setCopiedText(''), 2000)
  }

  const handleScenarioChange = (key) => {
    setActiveScenario(key)
    setStepIndex(0)
  }

  // Search filter across documents and schemas
  const filteredNavGroups = useMemo(() => {
    if (!searchQuery) return DOC_CATEGORIES
    const query = searchQuery.toLowerCase()
    return DOC_CATEGORIES.map((group) => {
      const filteredItems = group.items.filter(
        (item) =>
          item.title.toLowerCase().includes(query) ||
          item.id.toLowerCase().includes(query),
      )
      return { ...group, items: filteredItems }
    }).filter((group) => group.items.length > 0)
  }, [searchQuery])

  const selectedNode = nodes[selectedNodeId] || nodes.sales

  // Process and POST mock Sandbox API Call
  const triggerSandboxPost = () => {
    setIsSubmitting(true)
    setTimeout(() => {
      setSandboxResponse({
        success: true,
        message: 'Invoice recorded under PENDING state in DB.',
        timestamp: '2026-06-09T15:52:00Z',
        data: {
          invoice_id: Math.floor(Math.random() * 900) + 101,
          document_reference: 'INV-2026-MOCK',
          gross_amount: computedGross.toFixed(2),
          calculated_vat: computedVat.toFixed(2),
          withholding_tax_withheld: computedWht.toFixed(2),
          total_receivable_due: computedNet.toFixed(2),
          state: 'PENDING',
          db_operations: [
            `INSERT INTO sales (customer_id, doc_ref, total_amount_due, state) VALUES (5, 'INV-2026-MOCK', ${computedNet.toFixed(2)}, 'PENDING')`,
            `INSERT INTO sales_items (product_service, gross, vat, wht, net) VALUES (12, ${computedGross.toFixed(2)}, ${computedVat.toFixed(2)}, ${computedWht.toFixed(2)}, ${computedNet.toFixed(2)})`,
          ],
          system_message:
            'Pending transactions will NOT generate general ledger entries until APPROVED.',
        },
      })
      setIsSubmitting(false)
      setTraceStep(1) // progress to posted draft
    }, 1000)
  }

  const triggerSandboxApprove = () => {
    if (!sandboxResponse) return
    setSandboxResponse((prev) => ({
      ...prev,
      message:
        'Invoice Approved. Double entry posted successfully to General Ledger.',
      data: {
        ...prev.data,
        state: 'APPROVED',
        generated_journal_entries: 4,
        ledger_entries: [
          {
            type: 'DEBIT',
            coa_id: 11,
            coa_code: '1100',
            coa_name: 'Accounts Receivable',
            amount: computedNet.toFixed(2),
          },
          {
            type: 'CREDIT',
            coa_id: 45,
            coa_code: '4000',
            coa_name: 'Sales Revenue',
            amount: computedGross.toFixed(2),
          },
          {
            type: 'CREDIT',
            coa_id: 25,
            coa_code: '2150',
            coa_name: 'VAT Payable',
            amount: computedVat.toFixed(2),
          },
          {
            type: 'DEBIT',
            coa_id: 15,
            coa_code: '1150',
            coa_name: 'Withholding Taxes Asset',
            amount: computedWht.toFixed(2),
          },
        ],
        db_operations: [
          `UPDATE sales SET state = 'APPROVED' WHERE id = ${prev.data.invoice_id}`,
          `INSERT INTO journal_entries (db_name, db_id, coa_id, type, amount, date) VALUES ('SALES', ${prev.data.invoice_id}, 11, 'DEBIT', ${computedNet.toFixed(2)}, NOW())`,
          `INSERT INTO journal_entries (db_name, db_id, coa_id, type, amount, date) VALUES ('SALES', ${prev.data.invoice_id}, 45, 'CREDIT', ${computedGross.toFixed(2)}, NOW())`,
          `INSERT INTO journal_entries (db_name, db_id, coa_id, type, amount, date) VALUES ('SALES', ${prev.data.invoice_id}, 25, 'CREDIT', ${computedVat.toFixed(2)}, NOW())`,
          `INSERT INTO journal_entries (db_name, db_id, coa_id, type, amount, date) VALUES ('SALES', ${prev.data.invoice_id}, 15, 'DEBIT', ${computedWht.toFixed(2)}, NOW())`,
        ],
      },
    }))
    setTraceStep(2) // progress to ledger entries created
  }

  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-100 flex flex-col font-sans selection:bg-sky-500 selection:text-white">
      {/* Custom Styles to guarantee smooth SVG animations inside iframe previews */}
      <style>{`
        @keyframes flowDash {
          to {
            stroke-dashoffset: -30;
          }
        }
        .flow-dash-active {
          stroke-dasharray: 6, 8;
          animation: flowDash 0.8s linear infinite;
        }
        .animate-pulse-cyan {
          animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: .4; }
        }
      `}</style>

      {/* ======================================================================
          TOP NAVIGATION HEADER (Accounting Brand System)
          ====================================================================== */}
      <header className="sticky top-0 z-50 flex h-16 items-center justify-between border-b border-slate-800 bg-[#0b0f19]/95 px-6 backdrop-blur-md">
        {/* Brand details */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-sky-400 to-indigo-500 text-slate-950 font-black shadow-lg shadow-sky-500/10">
            DR
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-bold text-slate-100 tracking-tight">
                LedgerFlow
              </span>
              <span className="text-xs font-semibold text-sky-400 tracking-wider bg-sky-400/10 border border-sky-400/20 px-2 py-0.5 rounded-full">
                Developer Center
              </span>
            </div>
          </div>
        </div>

        {/* Header Search Input Bar & Version indicators */}
        <div className="flex items-center gap-6">
          <div className="relative hidden md:block w-72">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search API endpoints & schemas..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 bg-slate-900/50 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-sky-500 placeholder-slate-500"
            />
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-mono text-slate-500">v1.2.0</span>
            <a
              href="#github"
              className="text-slate-400 hover:text-white transition-colors"
              title="GitHub Docs"
            >
              <Github size={18} />
            </a>
          </div>
        </div>
      </header>

      {/* ======================================================================
          MAIN CONTAINER WITH INTEGRATED LEFT SIDEBAR
          ====================================================================== */}
      <div className="flex-grow flex">
        {/* LEFT DOCUMENTATION SIDEBAR */}
        <aside className="w-64 border-r border-slate-800/60 bg-[#0b0f19] hidden lg:flex flex-col shrink-0 sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto p-6">
          <nav className="space-y-8">
            {filteredNavGroups.map((group) => (
              <div key={group.category} className="space-y-2">
                <h4 className="text-[10px] font-bold text-slate-400 tracking-widest uppercase font-mono">
                  {group.category}
                </h4>
                <ul className="space-y-1">
                  {group.items.map((item) => {
                    const isSelected = selectedDocId === item.id
                    return (
                      <li key={item.id}>
                        <button
                          onClick={() => {
                            setSelectedDocId(item.id)
                            if (item.id === 'tool-flowchart') {
                              setSelectedNodeId('sales')
                            }
                          }}
                          className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center justify-between ${
                            isSelected
                              ? 'bg-sky-500/10 text-sky-400 border border-sky-400/10'
                              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
                          }`}
                        >
                          <span className="truncate">{item.title}</span>
                          {item.badge && (
                            <span
                              className={`text-[8px] px-1.5 py-0.5 rounded-full uppercase tracking-wider font-bold shrink-0 ${
                                item.badge === 'NEW' ||
                                item.badge === 'UPDATED' ||
                                item.badge === 'Interactive'
                                  ? 'bg-pink-500/10 text-pink-400 border border-pink-500/20'
                                  : 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
                              }`}
                            >
                              {item.badge}
                            </span>
                          )}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
          </nav>
        </aside>

        {/* CENTRAL DOCUMENTATION AREA */}
        <main className="flex-grow flex flex-col p-6 lg:p-12 max-w-6xl mx-auto w-full overflow-x-hidden">
          {/* ==================================================================
              CASE 1: WELCOME / OVERVIEW PAGE (Dashboard grid)
              ================================================================== */}
          {selectedDocId === 'welcome' && (
            <div className="space-y-12">
              {/* Feature Introduction Banner */}
              <div className="space-y-4">
                <span className="text-xs font-semibold text-sky-400 uppercase tracking-widest font-mono">
                  DEVELOPER DOCUMENTATION & PLATFORM SETUP
                </span>
                <h1 className="text-4xl font-extrabold text-white tracking-tight">
                  LedgerFlow Dev Center
                </h1>
                <p className="text-base text-slate-400 max-w-3xl leading-relaxed">
                  Welcome to the LedgerFlow developer hub. Our robust, real-time
                  double-entry posting middleware aggregates subledgers, enforces
                  strict balance controls, and offers interactive APIs for seamless
                  accounting integrations.
                </p>
              </div>

              {/* Styled Grid Cards mirroring premium Tailwind dashboard layout */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Interactive Flowchart Card Link */}
                <div
                  onClick={() => {
                    setSelectedDocId('tool-flowchart')
                    setSelectedNodeId('sales')
                  }}
                  className="bg-[#121826] border border-slate-800 rounded-2xl p-5 hover:border-sky-500/50 cursor-pointer transition-all flex flex-col justify-between group"
                >
                  <div className="space-y-3">
                    <div className="flex justify-between items-start">
                      <div className="h-10 w-10 bg-sky-500/10 rounded-lg flex items-center justify-center text-sky-400">
                        <Activity size={20} />
                      </div>
                      <span className="text-[9px] bg-sky-500/10 text-sky-400 border border-sky-500/20 px-2 py-0.5 rounded-full font-bold">
                        Interactive
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-white group-hover:text-sky-400 transition-colors">
                      Flowchart Visualizer
                    </h3>
                    <p className="text-[11px] text-slate-400 leading-normal">
                      Launch the fully animated visual diagram to trace real-time
                      transaction postings, ledger updates, and balance statements.
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-800/60 text-[10px] text-sky-400 font-semibold flex items-center gap-1.5">
                    Launch Flowchart <ArrowRight size={10} />
                  </div>
                </div>

                {/* API Sandbox Card Link */}
                <div
                  onClick={() => setSelectedDocId('tool-sandbox')}
                  className="bg-[#121826] border border-slate-800 rounded-2xl p-5 hover:border-sky-500/50 cursor-pointer transition-all flex flex-col justify-between group"
                >
                  <div className="space-y-3">
                    <div className="flex justify-between items-start">
                      <div className="h-10 w-10 bg-pink-500/10 rounded-lg flex items-center justify-center text-pink-400">
                        <Terminal size={20} />
                      </div>
                      <span className="text-[9px] bg-pink-500/10 text-pink-400 border border-pink-500/20 px-2 py-0.5 rounded-full font-bold">
                        Simulator
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-white group-hover:text-sky-400 transition-colors">
                      API Sandbox Playground
                    </h3>
                    <p className="text-[11px] text-slate-400 leading-normal">
                      Post mock transaction payloads, compute VAT and withholding
                      taxes, and track real-time changes inside simulated database
                      records.
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-800/60 text-[10px] text-pink-400 font-semibold flex items-center gap-1.5">
                    Open Sandbox <ArrowRight size={10} />
                  </div>
                </div>

                {/* DB Dictionary Card Link */}
                <div
                  onClick={() => setSelectedDocId('schema-je')}
                  className="bg-[#121826] border border-slate-800 rounded-2xl p-5 hover:border-sky-500/50 cursor-pointer transition-all flex flex-col justify-between group"
                >
                  <div className="space-y-3">
                    <div className="flex justify-between items-start">
                      <div className="h-10 w-10 bg-teal-500/10 rounded-lg flex items-center justify-center text-teal-400">
                        <Database size={20} />
                      </div>
                      <span className="text-[9px] bg-teal-500/10 text-teal-400 border border-teal-500/20 px-2 py-0.5 rounded-full font-bold">
                        Data Model
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-white group-hover:text-sky-400 transition-colors">
                      Database Schemas
                    </h3>
                    <p className="text-[11px] text-slate-400 leading-normal">
                      Inspect table models for charts_of_accounts, journal_entries,
                      and subledgers with explicit PK/FK relational mappings.
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-800/60 text-[10px] text-teal-400 font-semibold flex items-center gap-1.5">
                    Browse Tables <ArrowRight size={10} />
                  </div>
                </div>

                {/* Posting Engine Card Link */}
                <div
                  onClick={() => setSelectedDocId('posting-engine')}
                  className="bg-[#121826] border border-slate-800 rounded-2xl p-5 hover:border-sky-500/50 cursor-pointer transition-all flex flex-col justify-between group"
                >
                  <div className="space-y-3">
                    <div className="flex justify-between items-start">
                      <div className="h-10 w-10 bg-indigo-500/10 rounded-lg flex items-center justify-center text-indigo-400">
                        <Settings size={20} />
                      </div>
                      <span className="text-[9px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded-full font-bold">
                        Concept
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-white group-hover:text-sky-400 transition-colors">
                      Posting Middleware
                    </h3>
                    <p className="text-[11px] text-slate-400 leading-normal">
                      Learn how our ledger verifies balancing double-entry
                      transactions during state changes to keep accounts
                      synchronized.
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-800/60 text-[10px] text-indigo-400 font-semibold flex items-center gap-1.5">
                    Read Core Spec <ArrowRight size={10} />
                  </div>
                </div>
              </div>

              {/* LATEST UPDATES ARCHITECTURE */}
              <div className="space-y-6 pt-6 border-t border-slate-800/80">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-bold text-white">
                    Latest Update Releases
                  </h2>
                  <button
                    onClick={() => setSelectedDocId('project-structure')}
                    className="text-xs font-semibold text-sky-400 hover:text-sky-300 flex items-center gap-1.5"
                  >
                    View File Directories <ArrowRight size={14} />
                  </button>
                </div>

                <div className="space-y-8 bg-[#121826]/45 p-6 rounded-2xl border border-slate-800/60">
                  <div className="flex gap-4 relative">
                    <div className="flex flex-col items-center">
                      <div className="h-6 w-6 rounded-full bg-sky-500/15 border-2 border-sky-400 flex items-center justify-center">
                        <div className="h-2 w-2 rounded-full bg-sky-400 animate-pulse-cyan" />
                      </div>
                      <div className="w-0.5 flex-grow bg-slate-800 my-2" />
                    </div>
                    <div className="space-y-1.5 pb-2">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-mono text-slate-400">
                          June 2026 Release
                        </span>
                        <span className="px-2 py-0.5 bg-sky-500/10 text-sky-400 border border-sky-400/20 rounded text-[9px] font-bold font-mono">
                          v1.2.0
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-slate-100">
                        Performance Refactoring and Statement Aggregations
                      </h4>
                      <p className="text-xs text-slate-400 max-w-4xl leading-relaxed">
                        Refactored financial statement queries to compile reports
                        dynamically using optimized General Ledger grouping.
                        Pre-computed VAT inputs and withholding credits are verified
                        directly before any state transition updates commit.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className="h-6 w-6 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center">
                        <div className="h-2 w-2 rounded-full bg-slate-500" />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-mono text-slate-400">
                          May 2026 Release
                        </span>
                        <span className="px-2 py-0.5 bg-slate-855 text-slate-400 border border-slate-800 rounded text-[9px] font-bold font-mono">
                          v1.1.0
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-slate-100">
                        Immutable Audit Trail Middleware Integration
                      </h4>
                      <p className="text-xs text-slate-400 max-w-4xl leading-relaxed">
                        Added audit tracking modules to Express controller files.
                        Deletion is restricted for posted ledger segments, and all
                        status transitions are preserved inside JSON-based audit logs
                        for strict accounting compliance.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ==================================================================
              CASE 2: DATABASE COA/JE TABLES
              ================================================================== */}
          {selectedDocId.startsWith('schema-') && (
            <div className="space-y-6">
              {(() => {
                const tableName = selectedDocId
                  .replace('schema-', '')
                  .replace('-', '_')
                const table = schemaTables.find(
                  (t) => t.name === tableName || t.name.startsWith(tableName),
                )
                if (!table)
                  return (
                    <div className="text-slate-400">
                      Schema database table not found.
                    </div>
                  )

                return (
                  <div className="space-y-6">
                    <div className="border-b border-slate-800 pb-4">
                      <span className="text-xs font-mono font-bold uppercase tracking-widest text-sky-400">
                        DATABASE SPECIFICATIONS
                      </span>
                      <h2 className="text-3xl font-extrabold text-white mt-1 font-mono">
                        Table: {table.name}
                      </h2>
                      <p className="text-sm text-slate-400 mt-2">{table.desc}</p>
                    </div>

                    <div className="bg-[#121826] border border-slate-800 rounded-xl overflow-hidden shadow-xl">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-slate-850 bg-slate-900 text-slate-400 text-[10px] font-mono tracking-wider uppercase">
                            <th className="p-4">Col Name</th>
                            <th className="p-4">Type</th>
                            <th className="p-4 text-center">Key Constraints</th>
                            <th className="p-4">Schema Definition Notes</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/50">
                          {table.columns.map((col) => (
                            <tr key={col.name} className="hover:bg-slate-850/10">
                              <td className="p-4 font-mono font-bold text-slate-200">
                                {col.name}
                              </td>
                              <td className="p-4 font-mono text-[11px] text-slate-400">
                                {col.type}
                              </td>
                              <td className="p-4 text-center">
                                {col.key && (
                                  <span
                                    className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                                      col.key === 'PK'
                                        ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                        : 'bg-sky-500/10 text-sky-400 border border-sky-400/20'
                                    }`}
                                  >
                                    {col.key}
                                  </span>
                                )}
                              </td>
                              <td className="p-4 text-slate-400">{col.notes}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Relational Mapping Rules */}
                    <div className="bg-[#121826]/30 border border-slate-800 p-5 rounded-xl text-xs space-y-2">
                      <h4 className="font-bold text-white flex items-center gap-1.5">
                        <Info size={14} className="text-sky-400" /> Database
                        Relational Integrity Rules
                      </h4>
                      <p className="text-slate-400 leading-relaxed">
                        Ledger transactions leverage strict multi-tenant scopes to
                        safeguard system partitions. Double-entry validations require
                        that each transaction balances exactly before JEs commit,
                        ensuring the ledger is never out of sync.
                      </p>
                    </div>
                  </div>
                )
              })()}
            </div>
          )}

          {/* ==================================================================
              CASE 3: INTERACTIVE FLOWCHART UTILITY
              ================================================================== */}
          {selectedDocId === 'tool-flowchart' && (
            <div className="space-y-6 animate-fadeIn">
              {/* Header Title details */}
              <div className="border-b border-slate-800 pb-4">
                <span className="text-xs font-mono font-bold uppercase tracking-widest text-sky-400">
                  DEVELOPER UTILITY ENGINE
                </span>
                <h2 className="text-3xl font-extrabold text-white mt-1">
                  Interactive System Flowchart Map
                </h2>
                <p className="text-sm text-slate-400 mt-2">
                  Trace subledgers, posting validations, database tables, and dual
                  general ledger updates through real-time path simulations.
                </p>
              </div>

              {/* Dynamic Scenario bar */}
              <div className="bg-[#121826] border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-bold text-sky-400 tracking-widest block font-mono">
                    ACTIVE TRACE WALKTHROUGH
                  </span>
                  <h3 className="text-sm font-bold text-white">
                    Scenario Path:{' '}
                    <span className="text-sky-400">
                      {scenarioFlows[activeScenario].name}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
                    {scenarioFlows[activeScenario].explanation[stepIndex]}
                  </p>
                </div>

                <div className="flex items-center gap-3 bg-slate-950 p-2.5 rounded-xl border border-slate-850 shrink-0 self-stretch md:self-auto justify-between md:justify-start">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() =>
                        setStepIndex(
                          (prev) =>
                            (prev -
                              1 +
                              scenarioFlows[activeScenario].explanation.length) %
                            scenarioFlows[activeScenario].explanation.length,
                        )
                      }
                      className="p-1 text-slate-400 hover:text-white hover:bg-slate-900 rounded transition-colors"
                      title="Previous Step"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <button
                      onClick={() => setIsPlaying(!isPlaying)}
                      className="bg-sky-500 hover:bg-sky-400 text-slate-950 p-1.5 rounded-full transition-all"
                      title={
                        isPlaying ? 'Pause autoplay loop' : 'Start autoplay loop'
                      }
                    >
                      {isPlaying ? (
                        <Pause size={14} fill="currentColor" />
                      ) : (
                        <Play size={14} fill="currentColor" />
                      )}
                    </button>
                    <button
                      onClick={() =>
                        setStepIndex(
                          (prev) =>
                            (prev + 1) %
                            scenarioFlows[activeScenario].explanation.length,
                        )
                      }
                      className="p-1 text-slate-400 hover:text-white hover:bg-slate-900 rounded transition-colors"
                      title="Next Step"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                  <span className="text-xs font-mono text-slate-400 border-l border-slate-850 pl-3">
                    {stepIndex + 1}/
                    {scenarioFlows[activeScenario].explanation.length}
                  </span>
                </div>
              </div>

              {/* Grid split for visual mapping & inspectors */}
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
                {/* Visual Flow diagram container */}
                <div className="xl:col-span-8 bg-[#0c1220] border border-slate-800 rounded-2xl p-4 flex justify-center items-center overflow-auto min-h-[500px] relative">
                  <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1.5px,transparent_1.5px)] [background-size:20px_20px] opacity-35 pointer-events-none" />

                  <svg
                    viewBox="0 0 1060 670"
                    className="w-full max-w-[1060px] aspect-[1060/670] z-10 select-none relative"
                  >
                    <defs>
                      <marker
                        id="arrow"
                        viewBox="0 0 10 10"
                        refX="24"
                        refY="5"
                        markerWidth="6"
                        markerHeight="6"
                        orient="auto-start-reverse"
                      >
                        <path d="M 0 1.5 L 10 5 L 0 8.5 z" fill="#334155" />
                      </marker>
                      <marker
                        id="arrow-active"
                        viewBox="0 0 10 10"
                        refX="24"
                        refY="5"
                        markerWidth="7"
                        markerHeight="7"
                        orient="auto-start-reverse"
                      >
                        <path d="M 0 1 L 10 5 L 0 9 z" fill="#06b6d4" />
                      </marker>
                    </defs>

                    {/* Visual Connections drawing */}
                    {connections.map((conn, idx) => {
                      const origin = nodes[conn.from]
                      const dest = nodes[conn.to]
                      if (!origin || !dest) return null

                      const isHighlighted = isConnectionHighlighted(
                        conn.from,
                        conn.to,
                      )

                      const deltaX = dest.x - origin.x
                      const controlX1 = origin.x + deltaX * 0.45
                      const controlX2 = origin.x + deltaX * 0.55
                      const pathData = `M ${origin.x} ${origin.y} C ${controlX1} ${origin.y}, ${controlX2} ${dest.y}, ${dest.x} ${dest.y}`

                      return (
                        <g key={`connection-${idx}`}>
                          {/* Wide touch path */}
                          <path
                            d={pathData}
                            fill="none"
                            stroke="transparent"
                            strokeWidth="16"
                            className="cursor-pointer"
                            onClick={() => setSelectedNodeId(conn.from)}
                          />
                          {/* Baseline Connection */}
                          <path
                            d={pathData}
                            fill="none"
                            stroke={isHighlighted ? '#06b6d4' : '#1e293b'}
                            strokeWidth={isHighlighted ? '3' : '2'}
                            markerEnd={
                              isHighlighted ? 'url(#arrow-active)' : 'url(#arrow)'
                            }
                            className="transition-all duration-300"
                          />
                          {/* Pulsing Dash Layer (Native CSS class driven animation) */}
                          {isHighlighted && isPlaying && (
                            <path
                              d={pathData}
                              fill="none"
                              stroke="#22d3ee"
                              strokeWidth="3"
                              className="flow-dash-active"
                            />
                          )}
                          {isHighlighted && (
                            <foreignObject
                              x={(origin.x + dest.x) / 2 - 55}
                              y={(origin.y + dest.y) / 2 - 12}
                              width="110"
                              height="24"
                            >
                              <div className="text-[9px] text-center font-bold font-mono text-cyan-400 bg-[#080d1a] border border-cyan-500/30 px-1 py-0.5 rounded shadow-lg backdrop-blur-sm truncate">
                                {conn.label}
                              </div>
                            </foreignObject>
                          )}
                        </g>
                      )
                    })}

                    {/* Nodes Render */}
                    {Object.keys(nodes).map((key) => {
                      const node = nodes[key]
                      const isSelected = selectedNodeId === key
                      const isActive = isNodeHighlighted(key)

                      let borderStroke = 'stroke-slate-800'
                      let glowRing = 'opacity-0'

                      if (isActive) {
                        borderStroke = 'stroke-sky-500'
                        glowRing = 'opacity-100'
                      }
                      if (isSelected) {
                        borderStroke = 'stroke-amber-400 stroke-2'
                      }

                      let typeBadgeColor = 'text-slate-500'
                      if (node.type === 'input') typeBadgeColor = 'text-indigo-400'
                      else if (node.type === 'subledger')
                        typeBadgeColor = 'text-cyan-400'
                      else if (node.type === 'core') typeBadgeColor = 'text-blue-400'
                      else if (node.type === 'report')
                        typeBadgeColor = 'text-teal-400'

                      return (
                        <g
                          key={key}
                          transform={`translate(${node.x - 75}, ${node.y - 32})`}
                          className="cursor-pointer"
                          onClick={() => setSelectedNodeId(key)}
                        >
                          <rect
                            width="150"
                            height="64"
                            rx="10"
                            className={`fill-none stroke-sky-500/20 stroke-[5px] blur-md transition-all duration-300 ${glowRing}`}
                          />
                          {isSelected && (
                            <rect
                              width="150"
                              height="64"
                              rx="10"
                              className="fill-none stroke-amber-400/30 stroke-[6px] blur-sm"
                            />
                          )}

                          <rect
                            width="150"
                            height="64"
                            rx="10"
                            className={`fill-slate-900 ${borderStroke} stroke-[1.5px] transition-colors`}
                          />

                          <circle
                            cx="15"
                            cy="18"
                            r="4"
                            className={
                              isActive
                                ? 'fill-sky-400 animate-pulse-cyan'
                                : 'fill-slate-700'
                            }
                          />

                          <text
                            x="135"
                            y="18"
                            textAnchor="end"
                            className={`text-[8px] font-bold font-mono tracking-widest uppercase ${typeBadgeColor}`}
                          >
                            {node.type}
                          </text>
                          <text
                            x="75"
                            y="38"
                            textAnchor="middle"
                            className="text-xs font-bold fill-white tracking-wide"
                          >
                            {node.label}
                          </text>
                          <text
                            x="75"
                            y="51"
                            textAnchor="middle"
                            className="text-[8px] font-medium fill-slate-400 font-mono"
                          >
                            {node.endpoint}
                          </text>
                        </g>
                      )
                    })}
                  </svg>
                </div>

                {/* Subledger Details panel */}
                <div className="xl:col-span-4 bg-[#121826] border border-slate-800 rounded-2xl p-5 space-y-4">
                  <div className="border-b border-slate-800 pb-2">
                    <span className="text-[10px] font-mono tracking-wider font-bold text-sky-400 uppercase block">
                      NODE INSPECTOR
                    </span>
                    <h4 className="text-base font-bold text-white mt-1">
                      {selectedNode.label}
                    </h4>
                  </div>

                  <p className="text-xs text-slate-300 bg-slate-950/80 p-3 rounded-lg border border-slate-850 leading-relaxed italic">
                    "{selectedNode.desc}"
                  </p>

                  <div className="text-xs space-y-1">
                    <span className="text-[10px] font-bold text-slate-500 uppercase font-mono block">
                      DB TARGETS
                    </span>
                    <span className="font-mono bg-slate-950 px-2.5 py-1 rounded text-cyan-400 block border border-slate-850">
                      {selectedNode.dbTable}
                    </span>
                  </div>

                  {/* Posting Template Mappings */}
                  {selectedNode.debits &&
                  (selectedNode.debits.length > 0 ||
                    selectedNode.credits.length > 0) ? (
                    <div className="space-y-3 pt-2">
                      <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider block">
                        LEDGER posting setup
                      </span>

                      <div className="bg-slate-950 rounded-lg p-3 space-y-3 border border-slate-850">
                        <div>
                          <span className="text-[8px] font-bold font-mono text-emerald-400 block uppercase tracking-wider mb-1">
                            DEBIT SIDE (DR)
                          </span>
                          {selectedNode.debits.length > 0 ? (
                            selectedNode.debits.map((d, index) => (
                              <div
                                key={index}
                                className="text-[11px] border-l-2 border-emerald-500 pl-2"
                              >
                                <span className="font-bold text-slate-200 block">
                                  {d.account}
                                </span>
                                <span className="text-[10px] text-slate-500">
                                  {d.desc}
                                </span>
                              </div>
                            ))
                          ) : (
                            <span className="text-[10px] text-slate-500 pl-2 block">
                              Direct subledger pipeline update
                            </span>
                          )}
                        </div>
                        <div className="border-t border-slate-900" />
                        <div>
                          <span className="text-[8px] font-bold font-mono text-rose-400 block uppercase tracking-wider mb-1">
                            CREDIT SIDE (CR)
                          </span>
                          {selectedNode.credits.map((c, index) => (
                            <div
                              key={index}
                              className="text-[11px] border-l-2 border-rose-500 pl-2"
                            >
                              <span className="font-bold text-slate-200 block">
                                {c.account}
                              </span>
                              <span className="text-[10px] text-slate-500">
                                {c.desc}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <span className="text-[11px] text-slate-500 italic block">
                      No manual ledger adjustments. Sourced from approval
                      transactions.
                    </span>
                  )}

                  {/* Bottom Picker buttons */}
                  <div className="pt-2">
                    <span className="text-[10px] font-mono text-slate-400 font-bold block mb-2">
                      FLOW SCENARIOS RUNNER
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      {Object.keys(scenarioFlows).map((key) => (
                        <button
                          key={key}
                          onClick={() => handleScenarioChange(key)}
                          className={`px-2 py-1.5 rounded text-[10px] font-bold text-center truncate transition-all ${
                            activeScenario === key
                              ? 'bg-sky-500 text-slate-950'
                              : 'bg-slate-900 text-slate-300 hover:bg-slate-850'
                          }`}
                        >
                          {scenarioFlows[key].name}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ==================================================================
              CASE 4: LIVE SANDBOX PLAYGROUND
              ================================================================== */}
          {selectedDocId === 'tool-sandbox' && (
            <div className="space-y-6 animate-fadeIn">
              {/* Header Titles */}
              <div className="border-b border-slate-800 pb-4">
                <span className="text-xs font-mono font-bold uppercase tracking-widest text-sky-400">
                  INTERACTIVE SANDBOX ENVIRONMENT
                </span>
                <h2 className="text-3xl font-extrabold text-white mt-1">
                  Live Endpoint Playground
                </h2>
                <p className="text-sm text-slate-400 mt-2">
                  Simulate live transactional postings. Adjust quantities, values, or
                  tax rates to verify calculations, dynamic sql query outputs, and
                  balancing general ledger offsets.
                </p>
              </div>

              {/* Grid split sandbox workbench */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Simulated variables control card */}
                <div className="lg:col-span-4 bg-[#121826] border border-slate-800 rounded-xl p-5 space-y-4">
                  <h3 className="text-xs font-bold text-slate-200 tracking-wider uppercase border-b border-slate-800 pb-2">
                    1. Configure Post Data
                  </h3>

                  <div className="space-y-1 text-xs">
                    <label className="text-slate-400 block font-semibold">
                      Mock Client Profile
                    </label>
                    <select className="w-full p-2 bg-slate-950 border border-slate-800 rounded text-slate-200 text-xs font-mono">
                      <option>CUST-001 - ABC Corporation</option>
                      <option>CUST-002 - Acme Group Holdings</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="space-y-1">
                      <label className="text-slate-400 block font-semibold">
                        Bill Quantity
                      </label>
                      <input
                        type="number"
                        value={sandboxQty}
                        onChange={(e) =>
                          setSandboxQty(Math.max(1, parseInt(e.target.value) || 0))
                        }
                        className="w-full p-2 bg-slate-950 border border-slate-800 rounded text-slate-200 font-mono text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-slate-400 block font-semibold">
                        Unit Price ($)
                      </label>
                      <input
                        type="number"
                        value={sandboxPrice}
                        onChange={(e) =>
                          setSandboxPrice(Math.max(1, parseInt(e.target.value) || 0))
                        }
                        className="w-full p-2 bg-slate-950 border border-slate-800 rounded text-slate-200 font-mono text-xs"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="space-y-1">
                      <label className="text-slate-400 block font-semibold">
                        VAT Percentage (%)
                      </label>
                      <input
                        type="number"
                        value={sandboxVatRate}
                        onChange={(e) =>
                          setSandboxVatRate(
                            Math.max(0, parseInt(e.target.value) || 0),
                          )
                        }
                        className="w-full p-2 bg-slate-950 border border-slate-800 rounded text-slate-200 font-mono text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-slate-400 block font-semibold">
                        WHT Deduct (%)
                      </label>
                      <input
                        type="number"
                        value={sandboxWhtRate}
                        onChange={(e) =>
                          setSandboxWhtRate(
                            Math.max(0, parseInt(e.target.value) || 0),
                          )
                        }
                        className="w-full p-2 bg-slate-950 border border-slate-800 rounded text-slate-200 font-mono text-xs"
                      />
                    </div>
                  </div>

                  {/* Calculated metrics sheet */}
                  <div className="bg-slate-950 rounded-lg p-3 border border-slate-850 font-mono text-[11px] space-y-2">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Gross Goods:</span>
                      <span className="font-bold text-slate-300">
                        ${computedGross.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">VAT Total (+):</span>
                      <span className="font-bold text-slate-300">
                        ${computedVat.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Withholding (-):</span>
                      <span className="font-bold text-slate-300">
                        ${computedWht.toFixed(2)}
                      </span>
                    </div>
                    <div className="border-t border-slate-900/65" />
                    <div className="flex justify-between text-xs text-sky-400 font-bold">
                      <span>Total Invoice Due:</span>
                      <span>${computedNet.toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Post button */}
                  <button
                    onClick={triggerSandboxPost}
                    disabled={isSubmitting}
                    className="w-full py-2.5 bg-gradient-to-tr from-sky-600 to-sky-500 hover:from-sky-500 hover:to-sky-400 disabled:from-slate-800 disabled:to-slate-800 text-white font-bold text-xs rounded-lg shadow-lg flex items-center justify-center gap-2 transition-all"
                  >
                    {isSubmitting ? (
                      <>
                        <RefreshCw className="animate-spin" size={14} />
                        <span>Posting Draft...</span>
                      </>
                    ) : (
                      <>
                        <Terminal size={14} />
                        <span>POST Draft Sales Order</span>
                      </>
                    )}
                  </button>

                  {/* Reset button */}
                  {traceStep > 0 && (
                    <button
                      onClick={() => {
                        setTraceStep(0)
                        setSandboxResponse(null)
                      }}
                      className="w-full py-1.5 bg-slate-950 hover:bg-slate-900 border border-slate-800/80 text-slate-400 hover:text-white transition-all text-xs font-mono"
                    >
                      Clear Playground
                    </button>
                  )}
                </div>

                {/* API Response Display console */}
                <div className="lg:col-span-8 bg-[#121826] border border-slate-800 rounded-xl p-5 flex flex-col justify-between min-h-[420px]">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <h4 className="text-xs font-bold text-slate-200 tracking-widest uppercase flex items-center gap-2 font-mono">
                        <Terminal size={14} className="text-sky-400" /> API RESPONSE
                        CONSOLE
                      </h4>
                      <span className="text-[10px] font-mono text-slate-500">
                        {sandboxResponse ? 'Status: 201 Created' : 'Idle'}
                      </span>
                    </div>

                    {sandboxResponse ? (
                      <div className="space-y-4 font-mono text-xs">
                        {/* Interactive Response block */}
                        <div className="bg-slate-950 p-4 rounded-lg border border-slate-855 text-emerald-400 overflow-x-auto relative">
                          <button
                            onClick={() =>
                              handleCopyCode(
                                JSON.stringify(sandboxResponse, null, 2),
                              )
                            }
                            className="absolute right-2 top-2 text-[10px] text-slate-500 hover:text-white"
                          >
                            Copy
                          </button>
                          <pre>
                            <code>{JSON.stringify(sandboxResponse, null, 2)}</code>
                          </pre>
                        </div>

                        {/* Query outputs details */}
                        <div className="space-y-1.5">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block font-mono">
                            Simulated DB Write Statements
                          </span>
                          <div className="bg-slate-950/80 p-3 rounded border border-slate-850 text-slate-300 text-[11px] leading-relaxed">
                            {sandboxResponse.data.db_operations.map((op, i) => (
                              <div
                                key={i}
                                className="flex gap-2 text-[10px] py-1 border-l-2 border-sky-400 pl-2"
                              >
                                <span className="text-slate-500 font-bold shrink-0">
                                  [{i + 1}]
                                </span>
                                <span className="text-slate-200">{op}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-24 text-xs text-slate-500 space-y-3">
                        <Code className="mx-auto text-slate-700" size={32} />
                        <p className="max-w-md mx-auto leading-relaxed">
                          Configure your quantities and rates on the left parameter
                          block and click "POST Draft" to inspect database
                          operations.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Balancing Post Approvals widget */}
                  {traceStep === 1 && (
                    <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 mt-4 flex flex-col md:flex-row items-center justify-between gap-4">
                      <div className="space-y-1 text-xs text-slate-300">
                        <span className="font-bold text-amber-400 flex items-center gap-1">
                          <AlertTriangle size={12} /> Double Entry Pending
                          Verification
                        </span>
                        <p className="text-[11px] leading-relaxed">
                          Your draft has successfully saved, but has not yet posted
                          any ledger entries. Trigger approval state-change to post
                          double entry.
                        </p>
                      </div>
                      <button
                        onClick={triggerSandboxApprove}
                        className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-lg shrink-0 shadow-lg shadow-emerald-500/10 flex items-center gap-1"
                      >
                        <CheckCircle2 size={12} /> Approve and Post
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ==================================================================
              CASE 5: DYNAMIC TEXT ARTICLES (Conforming to Custom Accounting Styles)
              ================================================================== */}
          {!selectedDocId.startsWith('schema-') &&
            selectedDocId !== 'welcome' &&
            selectedDocId !== 'tool-flowchart' &&
            selectedDocId !== 'tool-sandbox' && (
              <div className="space-y-6">
                {(() => {
                  const doc = documents.find((d) => d.id === selectedDocId)
                  if (!doc)
                    return (
                      <div className="text-slate-400">
                        Section details not found.
                      </div>
                    )

                  return (
                    <article className="prose prose-invert max-w-none">
                      {/* Header meta */}
                      <div className="border-b border-slate-800 pb-4">
                        <span className="text-xs font-mono font-bold uppercase tracking-widest text-sky-400">
                          {doc.category}
                        </span>
                        <h2 className="text-3xl font-extrabold text-white mt-1 font-mono">
                          {doc.title}
                        </h2>
                      </div>

                      {/* Formatted body contents parser */}
                      <div className="space-y-6 pt-4 text-slate-300 text-sm leading-relaxed whitespace-pre-line">
                        {doc.content.split('###').map((block, bIdx) => {
                          if (bIdx === 0 && !block.startsWith(' '))
                            return (
                              <p key={bIdx} className="leading-relaxed">
                                {block}
                              </p>
                            )

                          const lines = block.split('\n')
                          const header = lines[0].trim()
                          const body = lines.slice(1).join('\n')

                          return (
                            <div key={bIdx} className="space-y-3">
                              {header && (
                                <h3 className="text-base font-bold text-sky-300 mt-6 mb-2 font-mono">
                                  {header}
                                </h3>
                              )}

                              {body.includes('```') ? (
                                body.split('```').map((segment, cIdx) => {
                                  if (cIdx % 2 !== 0) {
                                    const langSplit = segment.split('\n')
                                    const lang = langSplit[0]
                                    const code = langSplit.slice(1).join('\n')
                                    return (
                                      <div
                                        key={cIdx}
                                        className="relative bg-slate-900 border border-slate-800 rounded-lg overflow-hidden font-mono text-xs my-3"
                                      >
                                        <div className="bg-slate-950 px-4 py-2 border-b border-slate-850 flex justify-between items-center text-[10px] text-slate-400 uppercase">
                                          <span>{lang || 'CODE'}</span>
                                          <button
                                            onClick={() => handleCopyCode(code)}
                                            className="text-sky-400 hover:text-sky-300 flex items-center gap-1 text-[9px] font-sans font-semibold"
                                          >
                                            <Copy size={10} />{' '}
                                            {copiedText || 'Copy Code'}
                                          </button>
                                        </div>
                                        <pre className="p-4 overflow-x-auto text-slate-300">
                                          <code>{code}</code>
                                        </pre>
                                      </div>
                                    )
                                  }
                                  return (
                                    <p
                                      key={cIdx}
                                      className="whitespace-pre-line leading-relaxed"
                                    >
                                      {segment}
                                    </p>
                                  )
                                })
                              ) : (
                                <p className="whitespace-pre-line leading-relaxed">
                                  {body}
                                </p>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </article>
                  )
                })()}
              </div>
            )}
        </main>
      </div>
    </div>
  )
}
