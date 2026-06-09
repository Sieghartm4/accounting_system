import { useState, useEffect, useRef } from 'react'

const SECTIONS = [
  {
    part: '1',
    title: 'Getting Started',
    icon: 'ti-home',
    subsections: [
      { id: '1.1', title: 'What this system does' },
      { id: '1.2', title: 'Login & Register' },
      { id: '1.3', title: 'Dashboard' },
      { id: '1.4', title: 'Search & header tools' },
      { id: '1.5', title: 'User access & permissions' },
    ],
  },
  {
    part: '2',
    title: 'Administration',
    icon: 'ti-settings',
    subsections: [
      { id: '2.1', title: 'Company Management' },
      { id: '2.2', title: 'Access Control' },
      { id: '2.3', title: 'User Management' },
      { id: '2.4', title: 'Charts of Accounts' },
      { id: '2.5', title: 'Products & Services' },
      { id: '2.6', title: 'Proforma Entries' },
    ],
  },
  {
    part: '3',
    title: 'Customers & Vendors',
    icon: 'ti-users',
    subsections: [
      { id: '3.1', title: 'Customer Management' },
      { id: '3.2', title: 'Customer Transactions' },
      { id: '3.3', title: 'Vendor Management' },
      { id: '3.4', title: 'Vendor Transactions' },
    ],
  },
  {
    part: '4',
    title: 'Tax',
    icon: 'ti-receipt-tax',
    subsections: [
      { id: '4.1', title: 'VAT Management' },
      { id: '4.2', title: 'Withholding Tax' },
    ],
  },
  {
    part: '5',
    title: 'Cash Transactions',
    icon: 'ti-cash',
    subsections: [
      { id: '5.1', title: 'Receipts' },
      { id: '5.2', title: 'Disbursements' },
    ],
  },
  {
    part: '6',
    title: 'Sales Cycle',
    icon: 'ti-trending-up',
    subsections: [
      { id: '6.1', title: 'Sales (Invoices)' },
      { id: '6.2', title: 'Collections' },
      { id: '6.3', title: 'Aging Receivables' },
    ],
  },
  {
    part: '7',
    title: 'Purchase Cycle',
    icon: 'ti-shopping-cart',
    subsections: [
      { id: '7.1', title: 'Purchase (Vendor Invoices)' },
      { id: '7.2', title: 'Purchase Orders' },
      { id: '7.3', title: 'Payments' },
    ],
  },
  {
    part: '8',
    title: 'Adjustments',
    icon: 'ti-adjustments',
    subsections: [
      { id: '8.1', title: 'Adjustments' },
      { id: '8.2', title: 'Advances' },
    ],
  },
  {
    part: '9',
    title: 'Reports',
    icon: 'ti-chart-bar',
    subsections: [
      { id: '9.1', title: 'Trial Balance' },
      { id: '9.2', title: 'Income Statement' },
      { id: '9.3', title: 'General Ledger' },
      { id: '9.4', title: 'Balance Sheet' },
      { id: '9.5', title: 'Comprehensive Income' },
      { id: '9.6', title: 'Journal Entries' },
      { id: '9.7', title: 'Bank Reconciliation' },
      { id: '9.8', title: 'Audit Trail' },
    ],
  },
  {
    part: '10',
    title: 'Tips & Reference',
    icon: 'ti-bulb',
    subsections: [
      { id: '10.1', title: 'Key transaction flows' },
      { id: '10.2', title: 'Filters & date search' },
      { id: '10.3', title: 'User actions per page' },
      { id: '10.4', title: 'Automation & posting' },
      { id: '10.5', title: 'General tips' },
    ],
  },
]

const DOC_CONTENT = {
  1.1: {
    title: 'What this system does',
    body: 'This is a business accounting system accessible through a web browser. It helps you record and track money coming in, money going out, tax records, and financial reports.',
    bullets: [
      {
        icon: 'ti-arrow-down-circle',
        label: 'Money coming in',
        desc: 'Sales, receipts, and customer payments',
      },
      {
        icon: 'ti-arrow-up-circle',
        label: 'Money going out',
        desc: 'Purchases, disbursements, and vendor payments',
      },
      {
        icon: 'ti-file-invoice',
        label: 'Tax records',
        desc: 'VAT and withholding tax',
      },
      {
        icon: 'ti-chart-line',
        label: 'Financial reports',
        desc: 'Trial balance, income statement, balance sheet, and more',
      },
    ],
    note: 'Some pages handle cash directly (no invoice needed). Other pages manage the full invoice-and-payment cycle. Reports pull everything together so you can check the accuracy and health of your books at any time.',
  },
  1.2: {
    title: 'Login & Register',
    body: 'Sign in to access only the pages your account is permitted to use. If registration is enabled by your administrator, new accounts can be created from the Register page.',
    steps: [
      { label: 'Go to the login page', desc: 'Enter your username and password.' },
      {
        label: 'Sign in',
        desc: 'On success you are taken to the Dashboard. The system loads only your permitted pages.',
      },
      {
        label: 'Forgot password?',
        desc: 'Contact your administrator — there is no self-service reset.',
      },
      {
        label: 'New account',
        desc: 'Use the Register page if enabled. Fill in name, email, and password, then sign in.',
      },
    ],
  },
  1.3: {
    title: 'Dashboard',
    body: 'The Dashboard is the first page you see after login. It gives you a snapshot of where the business stands right now without running a full report.',
    bullets: [
      {
        icon: 'ti-coin',
        label: 'Key financial totals',
        desc: 'Cash balances, outstanding invoices, and more',
      },
      {
        icon: 'ti-clock',
        label: 'Recent activity',
        desc: 'Latest transactions across all modules',
      },
      {
        icon: 'ti-layout-dashboard',
        label: 'Quick links',
        desc: 'Jump directly to the pages you use most',
      },
    ],
  },
  1.4: {
    title: 'Search & header tools',
    body: 'A search box in the top header bar is available on every page. It searches across multiple modules at once.',
    steps: [
      {
        label: 'Type a keyword',
        desc: 'Customer name, reference number, or description.',
      },
      { label: 'Set a date range', desc: 'Select a start date and an end date.' },
      { label: 'Press Enter or click Search', desc: 'Results appear immediately.' },
      {
        label: 'Review results',
        desc: 'Results include sales invoices, collections, receipts, purchases, disbursements, and adjustments.',
      },
      {
        label: 'Click any result',
        desc: "Opens that record's detail page directly.",
      },
    ],
    note: 'Useful when you remember a reference number or name but are not sure which module it belongs to.',
  },
  1.5: {
    title: 'User access & permissions',
    body: 'Not every user sees every page. The system checks your role and shows only what you are allowed to use.',
    bullets: [
      {
        icon: 'ti-eye-off',
        label: 'Hidden pages',
        desc: 'If a page is missing from the menu, you do not have permission. Ask your administrator.',
      },
      {
        icon: 'ti-ban',
        label: 'Hidden actions',
        desc: 'Approve, delete, and edit buttons may be hidden depending on your role.',
      },
      {
        icon: 'ti-shield',
        label: 'Role-based control',
        desc: 'Administrators manage these settings in Access Control (section 2.2).',
      },
    ],
  },
  2.1: {
    title: 'Company Management',
    body: 'Store and update your company details. These appear on all printed documents such as invoices, receipts, and payments.',
    bullets: [
      {
        icon: 'ti-building',
        label: 'View settings',
        desc: 'Name, address, tax ID, logo, and more.',
      },
      {
        icon: 'ti-edit',
        label: 'Edit & save',
        desc: 'Updated details appear on newly printed documents immediately.',
      },
    ],
    note: 'Typical user: Administrator or accounting manager.',
  },
  2.2: {
    title: 'Access Control',
    body: 'Define which pages and actions each user role can access. Changes take effect the next time the affected user logs in or refreshes.',
    bullets: [
      {
        icon: 'ti-list-check',
        label: 'View access rules',
        desc: 'See current permissions per role.',
      },
      {
        icon: 'ti-toggle-right',
        label: 'Grant or remove access',
        desc: 'Control create, edit, approve, delete, and print per page.',
      },
      {
        icon: 'ti-user-check',
        label: 'Assign roles',
        desc: 'Attach roles to individual user accounts.',
      },
    ],
    warning:
      'Be careful when removing access — users lose the ability to see or act on those pages immediately.',
  },
  2.3: {
    title: 'User Management',
    body: 'Create and manage user accounts for everyone who needs to use the system.',
    bullets: [
      {
        icon: 'ti-users',
        label: 'View all accounts',
        desc: 'See the full list of users.',
      },
      {
        icon: 'ti-user-plus',
        label: 'Create users',
        desc: 'Set name, email, password, and role.',
      },
      {
        icon: 'ti-user-edit',
        label: 'Edit users',
        desc: 'Update details or change a role.',
      },
      {
        icon: 'ti-user-off',
        label: 'Deactivate accounts',
        desc: 'Remove access for users who no longer need it.',
      },
    ],
  },
  2.4: {
    title: 'Charts of Accounts (COA)',
    body: 'The master list of every financial account category used in the system. All accounting entries must be mapped to an account from this list.',
    bullets: [
      {
        icon: 'ti-building-bank',
        label: 'Assets',
        desc: 'What the business owns — cash, receivables, inventory.',
      },
      {
        icon: 'ti-credit-card',
        label: 'Liabilities',
        desc: 'What the business owes — payables, loans.',
      },
      {
        icon: 'ti-user-dollar',
        label: 'Equity',
        desc: "Owner's share of the business.",
      },
      {
        icon: 'ti-trending-up',
        label: 'Revenue',
        desc: 'Income from sales and services.',
      },
      {
        icon: 'ti-trending-down',
        label: 'Expenses',
        desc: 'Costs of running the business.',
      },
    ],
    warning:
      'Changing an account type after transactions have been posted can affect your reports. Consult your accountant before making changes.',
  },
  2.5: {
    title: 'Products & Services',
    body: 'Maintain the catalog of products and services your business sells or buys. These items appear as line items on invoices, purchase orders, and receipts.',
    bullets: [
      {
        icon: 'ti-box',
        label: 'View the catalog',
        desc: 'See all products and services in one place.',
      },
      {
        icon: 'ti-plus',
        label: 'Add new items',
        desc: 'Include name, code/SKU, description, unit price, VAT rate, and linked account.',
      },
      {
        icon: 'ti-edit',
        label: 'Edit items',
        desc: 'Update prices, descriptions, or tax settings as needed.',
      },
      {
        icon: 'ti-lock',
        label: 'Deactivate items',
        desc: 'Remove items that are no longer offered without deleting history.',
      },
    ],
    steps: [
      {
        label: 'Item name and code (SKU)',
        desc: 'Unique identifier for the product or service.',
      },
      {
        label: 'Description',
        desc: 'A clear description used on invoices and orders.',
      },
      { label: 'Unit price', desc: 'Selling price that auto-fills documents.' },
      {
        label: 'VAT rate',
        desc: 'Tax rate applied automatically if the item is taxable.',
      },
      {
        label: 'Inventory account',
        desc: 'Link the item to its inventory account if stock is tracked.',
      },
    ],
    note: 'When you add a product to a sales invoice or purchase, the system pulls in the price, tax rate, and computes the line total automatically. If inventory tracking is enabled, sales reduce stock quantities and purchases increase them.',
  },
  2.6: {
    title: 'Proforma Entries',
    body: 'Create draft invoices (estimates or quotations) for customers before issuing a final invoice. Proforma records do not affect the books.',
    bullets: [
      {
        icon: 'ti-file-text',
        label: 'Create a draft',
        desc: 'Build a proforma invoice for customer approval.',
      },
      {
        icon: 'ti-pencil',
        label: 'Edit before conversion',
        desc: 'Make changes until the customer approves the details.',
      },
      {
        icon: 'ti-check',
        label: 'Convert to sales',
        desc: 'Turn the proforma into a standard sales invoice when approved.',
      },
      {
        icon: 'ti-printer',
        label: 'Print or download',
        desc: 'Share a professional document with the customer.',
      },
    ],
    steps: [
      { label: 'Customer name', desc: 'Choose the customer for the estimate.' },
      {
        label: 'Date and reference',
        desc: 'Record the proforma date and reference number.',
      },
      { label: 'Line items', desc: 'Add products, services, quantity, and price.' },
      {
        label: 'Notes or terms',
        desc: 'Add payment or delivery terms for the customer.',
      },
    ],
    note: 'Proforma entries do NOT create journal entries or affect account balances until they are converted to a Sales invoice and approved. After conversion, they become a standard sales invoice and follow the normal sales posting process.',
  },
  3.1: {
    title: 'Customer Management',
    body: 'Store and maintain records for all customers your business sells to.',
    bullets: [
      {
        icon: 'ti-address-book',
        label: 'Contact details',
        desc: 'Name, email, phone, billing address.',
      },
      {
        icon: 'ti-id',
        label: 'Tax ID (TIN)',
        desc: 'Used on VAT-registered documents.',
      },
      { icon: 'ti-clock', label: 'Payment terms', desc: 'E.g., 30 days net.' },
      {
        icon: 'ti-currency-dollar',
        label: 'Credit limit',
        desc: 'Optional ceiling on outstanding balance.',
      },
    ],
    note: 'New customers immediately become available for selection on Sales, Collections, and Receipt pages. Customer balances update automatically whenever invoices are posted and payments are received.',
  },
  3.2: {
    title: 'Customer Transactions',
    body: 'See the complete financial history for one or all customers — sales invoices, collections, and receipts.',
    bullets: [
      {
        icon: 'ti-filter',
        label: 'Filter by date or type',
        desc: 'Narrow results by document type or date range.',
      },
      {
        icon: 'ti-file-search',
        label: 'Open any record',
        desc: 'Click a row to view the full document detail.',
      },
      {
        icon: 'ti-alert-circle',
        label: 'Outstanding balances',
        desc: 'Quickly check how much a customer still owes.',
      },
    ],
    note: 'Useful for answering customer queries or reviewing payment history before extending credit.',
  },
  3.3: {
    title: 'Vendor Management',
    body: 'Store and maintain records for all suppliers and vendors your business buys from.',
    bullets: [
      {
        icon: 'ti-address-book',
        label: 'Contact details',
        desc: 'Name, email, phone, and address.',
      },
      {
        icon: 'ti-id',
        label: 'Tax ID (TIN)',
        desc: 'Used on VAT-registered documents.',
      },
      { icon: 'ti-clock', label: 'Payment terms', desc: 'E.g., 60 days net.' },
      {
        icon: 'ti-building-bank',
        label: 'Bank details',
        desc: 'For vendor payment processing.',
      },
    ],
    note: 'New vendors are available immediately on Purchase, Payments, and Disbursement pages. Vendor balances update automatically whenever purchase invoices are posted and payments are made.',
  },
  3.4: {
    title: 'Vendor Transactions',
    body: 'See the complete financial history for one or all vendors — purchase invoices, payments, and disbursements.',
    bullets: [
      {
        icon: 'ti-filter',
        label: 'Filter records',
        desc: 'By vendor name, date range, or document type.',
      },
      {
        icon: 'ti-file-search',
        label: 'Open any record',
        desc: 'Click to see full document detail.',
      },
      {
        icon: 'ti-alert-circle',
        label: 'Payable balances',
        desc: 'Check how much you owe before making a payment run.',
      },
    ],
  },
  4.1: {
    title: 'VAT Management',
    body: 'Manage VAT (Value Added Tax) settings and view VAT-related records across sales and purchases.',
    bullets: [
      {
        icon: 'ti-percentage',
        label: 'VAT rates',
        desc: 'View and configure the rates used across the system.',
      },
      {
        icon: 'ti-receipt',
        label: 'Output tax',
        desc: 'VAT collected on sales invoices.',
      },
      {
        icon: 'ti-receipt-refund',
        label: 'Input tax',
        desc: 'VAT paid on purchase invoices.',
      },
      {
        icon: 'ti-file-check',
        label: 'Automatic posting',
        desc: 'VAT amounts post to VAT Payable or VAT Creditable accounts automatically.',
      },
    ],
    note: 'Set up correct VAT rates before you start creating invoices. Incorrect VAT rates will require adjustment entries later.',
  },
  4.2: {
    title: 'Withholding Tax',
    body: 'Record and track withholding taxes deducted from supplier payments or collected from customers.',
    bullets: [
      {
        icon: 'ti-file-invoice',
        label: 'View withholding entries',
        desc: 'See tax entries linked to purchases or payments.',
      },
      {
        icon: 'ti-plus',
        label: 'Add withholding details',
        desc: 'Attach tax details to a payment or purchase record.',
      },
      {
        icon: 'ti-chart-pie',
        label: 'Compliance summaries',
        desc: 'Generate reports for withholding tax compliance.',
      },
    ],
    note: 'When you pay a vendor and are required to withhold tax, the amount posts to a Withholding Tax Payable account. The vendor receives the net amount, and the withheld tax is remitted to the tax authority separately.',
  },
  5.1: {
    title: 'Receipts',
    body: 'Record cash or check received by the business without a sales invoice. Use for direct cash sales, miscellaneous income, donations, or any money received that does not go through the sales invoice cycle.',
    bullets: [
      {
        icon: 'ti-cash',
        label: 'Create a receipt',
        desc: 'Record cash or check received directly.',
      },
      {
        icon: 'ti-user-circle',
        label: 'Optional customer',
        desc: 'Leave blank for non-customer cash receipts.',
      },
      {
        icon: 'ti-building-bank',
        label: 'Select account',
        desc: 'Choose the bank or cash account receiving the funds.',
      },
      {
        icon: 'ti-list-check',
        label: 'Attach support',
        desc: 'Upload supporting files like scanned vouchers.',
      },
    ],
    posting: {
      debit: 'Cash / Bank account (increases your cash balance)',
      credit: 'Income / Revenue account (or AR if applied to a customer invoice)',
    },
    note: 'Only approved / posted receipts affect the books. Draft receipts do not appear in reports.',
  },
  5.2: {
    title: 'Disbursements',
    body: 'Record cash or check paid out by the business without a purchase invoice. Use for petty cash payments, miscellaneous expenses, or any direct cash payment that does not go through the purchase invoice cycle.',
    bullets: [
      {
        icon: 'ti-cash-off',
        label: 'Create a disbursement',
        desc: 'Record direct cash payments quickly.',
      },
      {
        icon: 'ti-user-circle',
        label: 'Payee / vendor',
        desc: 'Enter the name of the recipient.',
      },
      {
        icon: 'ti-category',
        label: 'Expense account',
        desc: 'Choose the account for the expense.',
      },
      {
        icon: 'ti-paperclip',
        label: 'Attach files',
        desc: 'Upload supporting documents like supplier receipts.',
      },
    ],
    posting: {
      debit: 'Expense or Asset account (records what the money was spent on)',
      credit: 'Cash / Bank account (decreases your cash balance)',
    },
    note: 'Disbursements are for direct cash payments. If you have a vendor invoice that needs to go through the approval process, use the Purchase page (section 7.1) instead.',
  },
  6.1: {
    title: 'Sales (Invoices)',
    body: 'Create and manage customer sales invoices. When you sell something to a customer on credit (they will pay later), you record it here first.',
    steps: [
      {
        label: 'Create a new sales invoice',
        desc: 'Start with a prepared or draft document.',
      },
      { label: 'Submit for checking', desc: 'Review the invoice before approval.' },
      {
        label: 'Approve and post',
        desc: 'An authorized user posts it to the books.',
      },
      {
        label: 'Record customer payment',
        desc: 'Use Collections (section 6.2) when payment arrives.',
      },
    ],
    bullets: [
      {
        icon: 'ti-file-text',
        label: 'Preview before approval',
        desc: 'See customer and internal copies.',
      },
      {
        icon: 'ti-discount',
        label: 'Discounts',
        desc: 'Apply discounts per line if needed.',
      },
      {
        icon: 'ti-calendar',
        label: 'Due date',
        desc: 'Set payment terms and due date.',
      },
      {
        icon: 'ti-attachment',
        label: 'Attachments',
        desc: 'Attach delivery or approval documents.',
      },
    ],
    posting: {
      debit: 'Accounts Receivable (AR) — the customer now owes you this amount',
      credit: 'Revenue account + VAT Payable account',
    },
    note: 'Posting creates AR and revenue records, and may reduce inventory if stock tracking is enabled.',
  },
  6.2: {
    title: 'Collections (Customer Payments)',
    body: "Record a payment received from a customer and apply it to one or more outstanding sales invoices. This clears the customer's debt.",
    steps: [
      { label: 'Customer sends payment', desc: 'Cash, check, or bank transfer.' },
      { label: 'Create a collection record', desc: 'Select the customer.' },
      {
        label: 'Choose which invoices to settle',
        desc: 'Apply the payment to one or multiple invoices.',
      },
      {
        label: 'Save and approve',
        desc: 'Invoice balances are reduced immediately.',
      },
    ],
    posting: {
      debit: 'Cash / Bank account (your cash goes up)',
      credit: 'Accounts Receivable (AR) — customer balance goes down',
    },
    note: 'If the payment exceeds the invoice total, the excess becomes a credit balance or advance for the customer.',
  },
  6.3: {
    title: 'Aging Receivables',
    body: 'A report-style page that shows all unpaid customer invoices grouped by how overdue they are. Use this to know which customers need to be followed up for payment.',
    bullets: [
      { icon: 'ti-circle-check', label: 'Current', desc: 'Invoices not yet due.' },
      {
        icon: 'ti-clock',
        label: '1–30 days overdue',
        desc: 'Recently past due invoices.',
      },
      {
        icon: 'ti-alert-triangle',
        label: '31–60 days overdue',
        desc: 'Invoices starting to age.',
      },
      {
        icon: 'ti-alert-circle',
        label: '61–90 days overdue',
        desc: 'Older unpaid invoices.',
      },
      {
        icon: 'ti-circle-x',
        label: 'Over 90 days overdue',
        desc: 'Long-term overdue receivables.',
      },
    ],
    note: 'The system groups posted sales invoices that are not fully collected by due date. Use this page to prioritize collection calls, identify long overdue customers, and support credit limit decisions.',
  },
  7.1: {
    title: 'Purchase (Vendor Invoices)',
    body: 'Record vendor invoices for goods or services received. Use this page when a supplier invoice has arrived and you need to capture what you owe.',
    steps: [
      {
        label: 'Receive a vendor invoice',
        desc: 'Check the supplier invoice details.',
      },
      { label: 'Create a purchase record', desc: 'Status: Draft / Prepared.' },
      { label: 'Reviewer checks details', desc: 'Status: Checked.' },
      { label: 'Approve and post', desc: 'Status: Approved / Posted.' },
      {
        label: 'Pay the vendor',
        desc: 'Record the payment in Payments (section 7.3).',
      },
    ],
    bullets: [
      {
        icon: 'ti-file-invoice',
        label: 'Vendor invoice details',
        desc: 'Vendor, invoice date, due date, and reference number.',
      },
      {
        icon: 'ti-list',
        label: 'Line items',
        desc: 'Describe each cost, quantity, and account.',
      },
      {
        icon: 'ti-receipt',
        label: 'VAT handling',
        desc: 'VAT is computed per line if applicable.',
      },
      {
        icon: 'ti-paperclip',
        label: 'Attach files',
        desc: 'Upload supplier invoice scans for support.',
      },
    ],
    posting: {
      debit: 'Expense account or Inventory account (the cost is recorded)',
      credit: 'Accounts Payable (AP) — you now owe the vendor this amount',
    },
    note: 'Approving a purchase creates the AP record and posts the expense or inventory cost to the General Ledger.',
  },
  7.2: {
    title: 'Purchase Orders (PO)',
    body: 'Create a formal purchase order before receiving the vendor invoice. A PO records what you intend to buy, at what price, and from whom.',
    steps: [
      {
        label: 'Create a Purchase Order',
        desc: 'Include vendor, items, quantities, and pricing.',
      },
      { label: 'Approve the PO', desc: 'Get internal approval before ordering.' },
      {
        label: 'Send it to the vendor',
        desc: 'Share the approved PO as the order request.',
      },
      {
        label: 'Receive goods and invoice',
        desc: 'Convert the PO to a Purchase invoice or a Disbursement.',
      },
    ],
    bullets: [
      {
        icon: 'ti-package',
        label: 'Formal request',
        desc: 'Use POs when your business needs buying approval first.',
      },
      {
        icon: 'ti-repeat',
        label: 'Convert later',
        desc: 'Pre-fill a purchase or disbursement record from the PO.',
      },
      {
        icon: 'ti-archive',
        label: 'Record history',
        desc: 'POs are kept for audit and purchasing traceability.',
      },
    ],
    note: 'Purchase Orders do NOT post to the General Ledger. Only converted and approved documents affect your accounts.',
  },
  7.3: {
    title: 'Payments (Vendor Payments)',
    body: 'Record a payment made to a vendor and apply it to one or more outstanding purchase invoices. This reduces what you owe.',
    steps: [
      { label: 'Prepare the payment', desc: 'Confirm the vendor and amount owed.' },
      {
        label: 'Create a payment record',
        desc: 'Select the vendor and invoices to apply.',
      },
      {
        label: 'Include payment details',
        desc: 'Add payment method, bank/check information, and any charges.',
      },
      { label: 'Approve and post', desc: "The vendor's AP balance is reduced." },
    ],
    bullets: [
      {
        icon: 'ti-receipt',
        label: 'Bank charges',
        desc: 'Enter any charges or discounts if applicable.',
      },
      {
        icon: 'ti-file-text',
        label: 'Apply invoices',
        desc: 'Use payments to settle one or multiple invoices.',
      },
      {
        icon: 'ti-paperclip',
        label: 'Attach confirmations',
        desc: 'Upload bank transfer proof or remittance slips.',
      },
    ],
    posting: {
      debit: 'Accounts Payable (AP) — your balance owed to the vendor goes down',
      credit: 'Cash / Bank account — your cash goes down',
    },
  },
  8.1: {
    title: 'Adjustments',
    body: 'Make manual corrections or special accounting entries that do not belong to a standard transaction. Use for accruals, reclassifications, corrections, and period-end entries.',
    bullets: [
      {
        icon: 'ti-refresh',
        label: 'Correct wrong accounts',
        desc: 'Fix accounts used on already-posted entries.',
      },
      {
        icon: 'ti-calendar-plus',
        label: 'Accrue income or expense',
        desc: 'Record amounts that belong in this period but have not been invoiced.',
      },
      {
        icon: 'ti-transfer',
        label: 'Reclassify amounts',
        desc: 'Move a balance from one account to another.',
      },
      {
        icon: 'ti-building',
        label: 'Depreciation / amortization',
        desc: 'Record period-end asset write-down entries.',
      },
    ],
    warning:
      'Total debits must equal total credits. The system will not allow an unbalanced entry. Always add a clear explanation in the Notes field.',
  },
  8.2: {
    title: 'Advances (Prepayments)',
    body: 'Record money paid in advance — before a purchase or service is received — or money received from a customer before you have invoiced them.',
    bullets: [
      {
        icon: 'ti-truck',
        label: 'Vendor down payment',
        desc: 'Deposit paid before goods are delivered.',
      },
      {
        icon: 'ti-user-dollar',
        label: 'Customer deposit',
        desc: 'Received before work begins.',
      },
      {
        icon: 'ti-briefcase',
        label: 'Employee advance',
        desc: 'Cash advance for a business trip or expense.',
      },
    ],
    steps: [
      {
        label: 'Create the advance',
        desc: 'Record date, payee/customer, purpose, amount, and reference.',
      },
      {
        label: 'Track outstanding advances',
        desc: 'View unsettled advances until they are applied.',
      },
      {
        label: 'Apply or settle',
        desc: 'Settle the advance against a purchase or sales invoice.',
      },
    ],
    posting: {
      debit: 'Advances / Prepaid account (asset)',
      credit: 'Cash / Bank account',
    },
    note: 'When the advance is applied, the prepaid balance is removed and the actual expense or invoice amount is recorded.',
  },
  9.1: {
    title: 'Trial Balance',
    body: 'A fundamental accuracy check. Shows the balance of every account for a selected period. Total debits must equal total credits.',
    steps: [
      { label: 'Select a date range', desc: '' },
      { label: 'Run the report', desc: '' },
      { label: 'Check totals', desc: 'Total Debit must equal total Credit.' },
      {
        label: 'Investigate if unbalanced',
        desc: 'Look for missing entries, unposted records, or adjustment errors.',
      },
    ],
    note: 'Run this before every month-end and year-end close, before preparing financial statements.',
  },
  9.2: {
    title: 'Income Statement (Profit & Loss)',
    body: 'Shows whether the business made a profit or a loss during a selected period by comparing revenue earned against expenses incurred.',
    bullets: [
      {
        icon: 'ti-arrow-up',
        label: 'Revenue',
        desc: 'Sum of credits minus debits on Revenue-type accounts.',
      },
      {
        icon: 'ti-arrow-down',
        label: 'Expenses',
        desc: 'Sum of debits minus credits on Expense-type accounts.',
      },
      { icon: 'ti-math', label: 'Net Income', desc: 'Revenue minus Expenses.' },
    ],
    note: 'Select a start and end date (usually a month or full financial year). Compare periods to track performance over time.',
  },
  9.3: {
    title: 'General Ledger',
    body: 'The detailed record of every posted transaction, organized by account. Think of it as the complete transaction diary for each account.',
    bullets: [
      {
        icon: 'ti-list',
        label: 'Every journal line',
        desc: 'Date, source document, amount, and debit/credit type.',
      },
      {
        icon: 'ti-refresh',
        label: 'Running balances',
        desc: 'Trace how each account moved over time.',
      },
      {
        icon: 'ti-file-search',
        label: 'Drill into source',
        desc: 'Click any line to open the original invoice, receipt, or disbursement.',
      },
    ],
    note: 'Unlike the Journal Entries report, the General Ledger groups by account with running balances rather than showing each entry in date order.',
  },
  9.4: {
    title: 'Balance Sheet',
    body: "A snapshot of the business's financial position on a specific date. Shows what the business owns (assets), owes (liabilities), and the owner's share (equity).",
    bullets: [
      {
        icon: 'ti-building-bank',
        label: 'Assets',
        desc: 'Current (cash, AR, inventory) and non-current (equipment, property).',
      },
      {
        icon: 'ti-credit-card',
        label: 'Liabilities',
        desc: 'Current (AP, VAT payable) and long-term (loans).',
      },
      {
        icon: 'ti-user-dollar',
        label: 'Equity',
        desc: "Owner's capital and retained earnings.",
      },
    ],
    note: 'Total Assets must equal Total Liabilities plus Equity. If they do not match, investigate.',
  },
  9.5: {
    title: 'Statement of Comprehensive Income',
    body: 'An extended Income Statement that includes other comprehensive income (OCI) — items that affect equity but are not part of normal operations.',
    bullets: [
      {
        icon: 'ti-chart-candle',
        label: 'Unrealized gains / losses',
        desc: 'On certain investments.',
      },
      {
        icon: 'ti-world',
        label: 'Currency adjustments',
        desc: 'Foreign currency translation differences.',
      },
      {
        icon: 'ti-home',
        label: 'Revaluation surplus',
        desc: 'On property and equipment.',
      },
    ],
    note: 'Useful for businesses that follow full IFRS / PFRS reporting requirements.',
  },
  9.6: {
    title: 'Journal Entries',
    body: 'View every journal entry posted to the system in chronological order. Useful for accountants, auditors, or anyone verifying the raw accounting data.',
    bullets: [
      {
        icon: 'ti-list',
        label: 'Chronological view',
        desc: 'Each complete entry (all debit and credit lines together).',
      },
      {
        icon: 'ti-filter',
        label: 'Filter by date, account, or reference',
        desc: '',
      },
      {
        icon: 'ti-download',
        label: 'Export for audit',
        desc: 'Download for external use or audit submission.',
      },
    ],
    note: 'Differs from the General Ledger: the GL groups by account with running balances, while this view shows each entry in date order.',
  },
  9.7: {
    title: 'Bank Reconciliation',
    body: 'Compare your bank statement to your accounting books. The goal is to confirm that every transaction in the bank is also recorded in the system, and vice versa.',
    steps: [
      {
        label: 'Enter bank statement transactions',
        desc: 'For the period being reconciled.',
      },
      {
        label: 'Match transactions',
        desc: 'The system matches bank lines against GL cash entries.',
      },
      {
        label: 'Mark cleared items',
        desc: 'Confirm transactions that appear on both sides.',
      },
      {
        label: 'Review outstanding items',
        desc: 'Identify items only in the books or only on the bank statement.',
      },
      {
        label: 'Create adjusting entries',
        desc: 'Record bank charges, interest, or genuine errors.',
      },
      {
        label: 'Finalize the reconciliation',
        desc: 'Ensure GL balance matches bank balance.',
      },
    ],
    note: 'Reconcile at least once a month to catch missing entries, bank errors, and timing differences before they become hard to trace.',
  },
  9.8: {
    title: 'Audit Trail',
    body: 'A complete log of who did what and when. Every create, edit, approve, and delete action on important records is captured automatically.',
    bullets: [
      {
        icon: 'ti-user-check',
        label: 'Track who made changes',
        desc: 'User, action, and timestamp.',
      },
      {
        icon: 'ti-diff',
        label: 'Before and after values',
        desc: 'See exactly what was changed.',
      },
      {
        icon: 'ti-download',
        label: 'Export for compliance',
        desc: 'Share with auditors or for investigations.',
      },
    ],
  },
  10.1: {
    title: 'Key transaction flows',
    body: 'A quick reference for choosing the right module.',
    flows: [
      {
        label: 'Cash in (no invoice)',
        icon: 'ti-cash',
        color: '#16a34a',
        desc: 'Customer pays you cash directly.',
        module: 'Receipts',
        ref: '5.1',
        effect: 'Cash up, Income recorded',
      },
      {
        label: 'Cash out (no invoice)',
        icon: 'ti-cash-off',
        color: '#dc2626',
        desc: 'You pay something in cash directly.',
        module: 'Disbursements',
        ref: '5.2',
        effect: 'Cash down, Expense recorded',
      },
      {
        label: 'Credit sale (invoice first, payment later)',
        icon: 'ti-file-invoice',
        color: '#2563eb',
        desc: 'Sell to a customer who will pay in the future.',
        module: 'Sales then Collections',
        ref: '6.1 / 6.2',
        effect: 'AR up, then Cash up',
      },
      {
        label: 'Credit purchase (invoice now, payment later)',
        icon: 'ti-shopping-cart',
        color: '#7c3aed',
        desc: 'Receive goods or services and pay the vendor later.',
        module: 'Purchase then Payments',
        ref: '7.1 / 7.3',
        effect: 'AP up, then Cash down',
      },
      {
        label: 'Purchase Order (request before order)',
        icon: 'ti-file-text',
        color: '#b45309',
        desc: 'Create an approval request before ordering.',
        module: 'Purchase Orders',
        ref: '7.2',
        effect: 'No GL effect until converted',
      },
      {
        label: 'Corrections',
        icon: 'ti-refresh',
        color: '#0891b2',
        desc: 'Fix a posted error or enter an accrual.',
        module: 'Adjustments',
        ref: '8.1',
        effect: 'Manual journal entry to GL',
      },
      {
        label: 'Prepayments',
        icon: 'ti-clock',
        color: '#be185d',
        desc: 'Pay or receive before the invoice exists.',
        module: 'Advances',
        ref: '8.2',
        effect: 'Prepaid/advance account until settled',
      },
    ],
    isFlowRef: true,
  },
  10.2: {
    title: 'Filters & date search',
    body: 'Almost every page allows you to filter records by date and other criteria.',
    bullets: [
      {
        icon: 'ti-calendar',
        label: 'Date filter',
        desc: 'Select a start and end date — only records in that range are shown.',
      },
      {
        icon: 'ti-user',
        label: 'Customer / vendor filter',
        desc: 'Narrow results to a specific party.',
      },
      {
        icon: 'ti-circle-check',
        label: 'Status filter',
        desc: 'Draft, Approved, or Posted.',
      },
      {
        icon: 'ti-hash',
        label: 'Reference number',
        desc: 'Find a specific document directly.',
      },
      {
        icon: 'ti-search',
        label: 'Header search',
        desc: 'Searches across all modules at once — requires a keyword and date range.',
      },
    ],
  },
  10.3: {
    title: 'User actions per page',
    body: 'Depending on your access rights, you may be able to do some or all of the following on each page.',
    bullets: [
      {
        icon: 'ti-eye',
        label: 'View and browse',
        desc: 'Always available if you can see the page.',
      },
      {
        icon: 'ti-plus',
        label: 'Add a new record',
        desc: 'Requires Create permission.',
      },
      { icon: 'ti-edit', label: 'Edit a draft', desc: 'Requires Edit permission.' },
      {
        icon: 'ti-circle-check',
        label: 'Approve and post',
        desc: 'Requires Approve permission.',
      },
      { icon: 'ti-download', label: 'Download / print as PDF', desc: '' },
      { icon: 'ti-paperclip', label: 'Attach supporting files', desc: '' },
    ],
    note: 'If a button is not visible, you do not have permission for that action. Contact your administrator.',
  },
  10.4: {
    title: 'Automation & posting',
    body: 'The system automates the accounting work so you only need to enter the business event.',
    flows: [
      {
        label: 'Sales invoice approved',
        icon: 'ti-file-invoice',
        color: '#2563eb',
        desc: '',
        module: 'Debit AR / Credit Revenue / Credit VAT Payable',
        ref: '',
        effect: 'AR created, inventory may reduce',
      },
      {
        label: 'Collection recorded',
        icon: 'ti-coin',
        color: '#16a34a',
        desc: '',
        module: 'Debit Cash / Credit AR',
        ref: '',
        effect: 'Customer balance decreases, invoice marked paid',
      },
      {
        label: 'Purchase invoice approved',
        icon: 'ti-shopping-cart',
        color: '#7c3aed',
        desc: '',
        module: 'Debit Expense/Inventory / Credit AP',
        ref: '',
        effect: 'AP created, inventory may increase',
      },
      {
        label: 'Vendor payment recorded',
        icon: 'ti-cash-off',
        color: '#dc2626',
        desc: '',
        module: 'Debit AP / Credit Cash',
        ref: '',
        effect: 'Vendor balance decreases, invoice marked paid',
      },
      {
        label: 'Receipt posted',
        icon: 'ti-cash',
        color: '#0891b2',
        desc: '',
        module: 'Debit Cash / Credit Income',
        ref: '',
        effect: 'Direct cash posting — no AR/AP lifecycle',
      },
      {
        label: 'Disbursement posted',
        icon: 'ti-arrow-up-circle',
        color: '#b45309',
        desc: '',
        module: 'Debit Expense / Credit Cash',
        ref: '',
        effect: 'Direct cash posting — no AR/AP lifecycle',
      },
    ],
    isPostingRef: true,
  },
  10.5: {
    title: 'General tips',
    body: 'Key rules that save time and prevent errors.',
    tips: [
      {
        num: '1',
        label: 'Approve before running reports',
        desc: 'Draft records are excluded from all reports. Post everything before checking financial statements.',
      },
      {
        num: '2',
        label: 'Run Trial Balance first',
        desc: 'Before month-end reports, verify debits equal credits. An imbalance means a posting error exists.',
      },
      {
        num: '3',
        label: 'Reconcile monthly',
        desc: 'Bank reconciliation catches missing entries and errors before they become hard to trace.',
      },
      {
        num: '4',
        label: 'Always note adjustments',
        desc: 'Write a clear explanation in the Notes field. You or your auditor will need it in six months.',
      },
      {
        num: '5',
        label: "Proformas and POs don't post",
        desc: 'These are planning documents. Only converted and approved records affect your accounts.',
      },
      {
        num: '6',
        label: 'Know your role',
        desc: "If you can't see a page or button, ask your administrator. Don't try to work around it.",
      },
      {
        num: '7',
        label: 'Dates matter',
        desc: 'Enter the actual transaction date. Reports are date-based — wrong dates put entries in the wrong period.',
      },
      {
        num: '8',
        label: 'PDF downloads are a snapshot',
        desc: 'If you edit a record after downloading, download a fresh copy.',
      },
      {
        num: '9',
        label: 'The audit trail records everything',
        desc: 'Every action is logged. Work accurately and honestly.',
      },
      {
        num: '10',
        label: 'When in doubt, ask',
        desc: 'A wrong posting is harder to fix than an unposted draft. Ask your supervisor before entering uncertain data.',
      },
    ],
  },
}

const ALL_SEARCH_ITEMS = SECTIONS.flatMap((s) =>
  s.subsections.map((sub) => ({
    id: sub.id,
    label: sub.title,
    part: s.title,
    partNum: s.part,
  })),
)

function PostingBox({ debit, credit }) {
  return (
    <div
      style={{
        border: '1px solid #e5e7eb',
        borderRadius: 8,
        overflow: 'hidden',
        margin: '16px 0',
      }}
    >
      <div
        style={{
          background: '#f8f8f8',
          padding: '6px 12px',
          fontSize: 11,
          fontWeight: 700,
          color: '#888',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          borderBottom: '1px solid #e5e7eb',
        }}
      >
        Posting effect on approval
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
        <div style={{ padding: '10px 14px', borderRight: '1px solid #e5e7eb' }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: '#16a34a',
              marginBottom: 4,
              letterSpacing: '0.04em',
            }}
          >
            DEBIT
          </div>
          <div style={{ fontSize: 13, color: '#111' }}>{debit}</div>
        </div>
        <div style={{ padding: '10px 14px' }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: '#dc2626',
              marginBottom: 4,
              letterSpacing: '0.04em',
            }}
          >
            CREDIT
          </div>
          <div style={{ fontSize: 13, color: '#111' }}>{credit}</div>
        </div>
      </div>
    </div>
  )
}

function SectionContent({ id }) {
  const data = DOC_CONTENT[id]
  if (!data) return <div style={{ color: '#888' }}>Content coming soon.</div>
  return (
    <div>
      <p
        style={{ color: '#374151', lineHeight: 1.7, marginBottom: 16, fontSize: 15 }}
      >
        {data.body}
      </p>

      {data.steps && (
        <ol style={{ listStyle: 'none', padding: 0, margin: '16px 0' }}>
          {data.steps.map((s, i) => (
            <li key={i} style={{ display: 'flex', gap: 12, marginBottom: 10 }}>
              <span
                style={{
                  minWidth: 24,
                  height: 24,
                  background: '#dc2626',
                  color: '#fff',
                  borderRadius: '50%',
                  fontSize: 12,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  marginTop: 1,
                }}
              >
                {i + 1}
              </span>
              <div>
                <span style={{ fontWeight: 600, color: '#111', fontSize: 14 }}>
                  {s.label}
                </span>
                {s.desc && (
                  <span style={{ color: '#6b7280', fontSize: 14 }}> — {s.desc}</span>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}

      {data.bullets && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            margin: '16px 0',
          }}
        >
          {data.bullets.map((b, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                gap: 12,
                alignItems: 'flex-start',
                padding: '8px 12px',
                background: '#f9fafb',
                borderRadius: 6,
                border: '1px solid #f3f4f6',
              }}
            >
              <i
                className={'ti ' + b.icon}
                style={{
                  fontSize: 18,
                  color: '#dc2626',
                  marginTop: 1,
                  flexShrink: 0,
                }}
                aria-hidden="true"
              />
              <div>
                <span style={{ fontWeight: 600, color: '#111', fontSize: 14 }}>
                  {b.label}
                </span>
                {b.desc && (
                  <span style={{ color: '#6b7280', fontSize: 14 }}> — {b.desc}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {data.posting && (
        <PostingBox debit={data.posting.debit} credit={data.posting.credit} />
      )}

      {data.flows && data.isFlowRef && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            margin: '16px 0',
          }}
        >
          {data.flows.map((f, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '10px 14px',
                background: '#f9fafb',
                borderRadius: 6,
                border: '1px solid #f3f4f6',
              }}
            >
              <i
                className={'ti ' + f.icon}
                style={{ fontSize: 18, color: f.color, flexShrink: 0 }}
                aria-hidden="true"
              />
              <div style={{ flex: 1 }}>
                <span style={{ fontWeight: 600, color: '#111', fontSize: 14 }}>
                  {f.label}
                </span>
                <span style={{ color: '#6b7280', fontSize: 14 }}> — {f.desc}</span>
                <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>
                  Use: <strong style={{ color: '#374151' }}>{f.module}</strong>{' '}
                  &nbsp;·&nbsp; {f.effect}
                </div>
              </div>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: '#dc2626',
                  background: '#fee2e2',
                  padding: '2px 7px',
                  borderRadius: 4,
                  flexShrink: 0,
                }}
              >
                {f.ref}
              </span>
            </div>
          ))}
        </div>
      )}

      {data.flows && data.isPostingRef && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            margin: '16px 0',
          }}
        >
          {data.flows.map((f, i) => (
            <div
              key={i}
              style={{
                padding: '10px 14px',
                background: '#f9fafb',
                borderRadius: 6,
                border: '1px solid #f3f4f6',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: 4,
                }}
              >
                <i
                  className={'ti ' + f.icon}
                  style={{ fontSize: 16, color: f.color }}
                  aria-hidden="true"
                />
                <span style={{ fontWeight: 600, color: '#111', fontSize: 14 }}>
                  {f.label}
                </span>
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: '#374151',
                  fontFamily: 'monospace',
                  background: '#ede9fe',
                  padding: '2px 8px',
                  borderRadius: 4,
                  display: 'inline-block',
                  marginBottom: 4,
                }}
              >
                {f.module}
              </div>
              <div style={{ fontSize: 12, color: '#6b7280' }}>{f.effect}</div>
            </div>
          ))}
        </div>
      )}

      {data.tips && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            margin: '16px 0',
          }}
        >
          {data.tips.map((t) => (
            <div
              key={t.num}
              style={{
                display: 'flex',
                gap: 12,
                padding: '10px 14px',
                background: '#f9fafb',
                borderRadius: 6,
                border: '1px solid #f3f4f6',
              }}
            >
              <span
                style={{
                  minWidth: 24,
                  height: 24,
                  background: '#111',
                  color: '#fff',
                  borderRadius: 4,
                  fontSize: 12,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {t.num}
              </span>
              <div>
                <span style={{ fontWeight: 600, color: '#111', fontSize: 14 }}>
                  {t.label} —{' '}
                </span>
                <span style={{ color: '#6b7280', fontSize: 14 }}>{t.desc}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {data.note && (
        <div
          style={{
            display: 'flex',
            gap: 10,
            padding: '10px 14px',
            background: '#eff6ff',
            border: '1px solid #bfdbfe',
            borderRadius: 6,
            marginTop: 12,
          }}
        >
          <i
            className="ti ti-info-circle"
            style={{ fontSize: 16, color: '#2563eb', flexShrink: 0, marginTop: 1 }}
            aria-hidden="true"
          />
          <p style={{ margin: 0, fontSize: 13, color: '#1e40af', lineHeight: 1.6 }}>
            {data.note}
          </p>
        </div>
      )}

      {data.warning && (
        <div
          style={{
            display: 'flex',
            gap: 10,
            padding: '10px 14px',
            background: '#fff7ed',
            border: '1px solid #fed7aa',
            borderRadius: 6,
            marginTop: 12,
          }}
        >
          <i
            className="ti ti-alert-triangle"
            style={{ fontSize: 16, color: '#ea580c', flexShrink: 0, marginTop: 1 }}
            aria-hidden="true"
          />
          <p style={{ margin: 0, fontSize: 13, color: '#9a3412', lineHeight: 1.6 }}>
            {data.warning}
          </p>
        </div>
      )}
    </div>
  )
}

export default function UserDocumentation() {
  const [activeId, setActiveId] = useState('1.1')
  const [expandedParts, setExpandedParts] = useState({ 1: true })
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [showSearch, setShowSearch] = useState(false)
  const searchRef = useRef(null)

  const activeSection = SECTIONS.find((s) =>
    s.subsections.some((sub) => sub.id === activeId),
  )
  const activeSubsection = activeSection?.subsections.find(
    (sub) => sub.id === activeId,
  )

  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setSearchResults([])
      return
    }
    const q = searchQuery.toLowerCase()
    const results = ALL_SEARCH_ITEMS.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.part.toLowerCase().includes(q) ||
        item.id.includes(q),
    )
    setSearchResults(results.slice(0, 8))
  }, [searchQuery])

  const navigate = (id) => {
    setActiveId(id)
    const partNum = id.split('.')[0]
    setExpandedParts((prev) => ({ ...prev, [partNum]: true }))
    setSearchQuery('')
    setSearchResults([])
    setShowSearch(false)
  }

  const togglePart = (partNum) => {
    setExpandedParts((prev) => ({ ...prev, [partNum]: !prev[partNum] }))
  }

  const allSubs = SECTIONS.flatMap((s) => s.subsections)
  const idx = allSubs.findIndex((s) => s.id === activeId)
  const prevSub = allSubs[idx - 1]
  const nextSub = allSubs[idx + 1]

  return (
    <div
      style={{
        fontFamily: 'system-ui, -apple-system, sans-serif',
        minHeight: '100vh',
        background: '#f5f5f5',
      }}
    >
      <link
        rel="stylesheet"
        href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.19.0/dist/tabler-icons.min.css"
      />

      {/* Header */}
      <header
        style={{
          background: '#111',
          color: '#fff',
          position: 'sticky',
          top: 0,
          zIndex: 100,
          borderBottom: '3px solid #dc2626',
        }}
      >
        <div
          style={{
            maxWidth: 1100,
            margin: '0 auto',
            padding: '0 18px',
            display: 'flex',
            alignItems: 'center',
            height: 56,
            gap: 16,
          }}
        >
          <div
            style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}
          >
            <div
              style={{
                background: '#dc2626',
                borderRadius: 6,
                width: 32,
                height: 32,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <i
                className="ti ti-book"
                style={{ fontSize: 16, color: '#fff' }}
                aria-hidden="true"
              />
            </div>
            <div>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  letterSpacing: '-0.02em',
                  lineHeight: 1.1,
                }}
              >
                Accounting System
              </div>
              <div
                style={{
                  fontSize: 10,
                  color: '#9ca3af',
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                }}
              >
                User Guide v1.0
              </div>
            </div>
          </div>

          <div
            style={{
              flex: 1,
              maxWidth: 420,
              position: 'relative',
              marginLeft: 'auto',
            }}
          >
            <i
              className="ti ti-search"
              style={{
                position: 'absolute',
                left: 10,
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#9ca3af',
                fontSize: 14,
                pointerEvents: 'none',
              }}
              aria-hidden="true"
            />
            <input
              ref={searchRef}
              type="text"
              placeholder="Search the guide…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setShowSearch(true)}
              onBlur={() => setTimeout(() => setShowSearch(false), 180)}
              style={{
                width: '100%',
                padding: '7px 12px 7px 32px',
                background: '#fff',
                border: '1px solid #d1d5db',
                borderRadius: 6,
                color: '#111',
                fontSize: 13,
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
            {showSearch && searchResults.length > 0 && (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 4px)',
                  left: 0,
                  right: 0,
                  background: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: 8,
                  boxShadow: '0 8px 32px rgba(0,0,0,0.14)',
                  overflow: 'hidden',
                  zIndex: 200,
                }}
              >
                {searchResults.map((r) => (
                  <div
                    key={r.id}
                    onMouseDown={() => navigate(r.id)}
                    style={{
                      padding: '9px 14px',
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      borderBottom: '1px solid #f3f4f6',
                      background: '#fff',
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background = '#f9fafb')
                    }
                    onMouseLeave={(e) => (e.currentTarget.style.background = '#fff')}
                  >
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#111' }}>
                        {r.label}
                      </div>
                      <div style={{ fontSize: 11, color: '#9ca3af' }}>
                        Part {r.partNum} — {r.part}
                      </div>
                    </div>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: '#dc2626',
                        background: '#fee2e2',
                        padding: '2px 7px',
                        borderRadius: 4,
                      }}
                    >
                      {r.id}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>

      <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex' }}>
        {/* Left sidebar */}
        <aside
          style={{
            width: 210,
            flexShrink: 0,
            background: '#fff',
            borderRight: '1px solid #e5e7eb',
            minHeight: 'calc(100vh - 56px)',
            position: 'sticky',
            top: 56,
            height: 'calc(100vh - 56px)',
            overflowY: 'auto',
          }}
        >
          <nav style={{ padding: '12px 0' }}>
            {SECTIONS.map((section) => {
              const isExpanded = expandedParts[section.part]
              const isActive = activeSection?.part === section.part
              return (
                <div key={section.part}>
                  <button
                    onClick={() => togglePart(section.part)}
                    style={{
                      width: '100%',
                      padding: '8px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      background: isActive ? '#fff5f5' : 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      textAlign: 'left',
                      borderLeft: isActive
                        ? '3px solid #dc2626'
                        : '3px solid transparent',
                      boxSizing: 'border-box',
                    }}
                  >
                    <i
                      className={'ti ' + section.icon}
                      style={{
                        fontSize: 14,
                        color: isActive ? '#dc2626' : '#9ca3af',
                        flexShrink: 0,
                      }}
                      aria-hidden="true"
                    />
                    <span
                      style={{
                        flex: 1,
                        fontSize: 13,
                        fontWeight: isActive ? 700 : 500,
                        color: isActive ? '#dc2626' : '#374151',
                        lineHeight: 1.3,
                      }}
                    >
                      <span
                        style={{ color: '#9ca3af', marginRight: 4, fontSize: 11 }}
                      >
                        {section.part}.
                      </span>
                      {section.title}
                    </span>
                    <i
                      className={
                        'ti ' + (isExpanded ? 'ti-chevron-down' : 'ti-chevron-right')
                      }
                      style={{ fontSize: 11, color: '#9ca3af' }}
                      aria-hidden="true"
                    />
                  </button>
                  {isExpanded && (
                    <div>
                      {section.subsections.map((sub) => {
                        const isSubActive = activeId === sub.id
                        return (
                          <button
                            key={sub.id}
                            onClick={() => navigate(sub.id)}
                            style={{
                              width: '100%',
                              padding: '5px 14px 5px 36px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8,
                              background: isSubActive ? '#fee2e2' : 'transparent',
                              border: 'none',
                              cursor: 'pointer',
                              textAlign: 'left',
                              borderLeft: isSubActive
                                ? '3px solid #dc2626'
                                : '3px solid transparent',
                              boxSizing: 'border-box',
                            }}
                          >
                            <span
                              style={{
                                fontSize: 11,
                                color: isSubActive ? '#dc2626' : '#9ca3af',
                                fontWeight: 600,
                                minWidth: 26,
                              }}
                            >
                              {sub.id}
                            </span>
                            <span
                              style={{
                                fontSize: 12,
                                color: isSubActive ? '#991b1b' : '#6b7280',
                                fontWeight: isSubActive ? 600 : 400,
                                lineHeight: 1.3,
                              }}
                            >
                              {sub.title}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </nav>
        </aside>

        {/* Main content */}
        <main style={{ flex: 1, padding: '24px 24px', minWidth: 0 }}>
          {/* Breadcrumb */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              marginBottom: 20,
              fontSize: 12,
              color: '#9ca3af',
            }}
          >
            <i className="ti ti-home" style={{ fontSize: 12 }} aria-hidden="true" />
            <span>Part {activeSection?.part}</span>
            <i
              className="ti ti-chevron-right"
              style={{ fontSize: 10 }}
              aria-hidden="true"
            />
            <span style={{ color: '#374151' }}>{activeSection?.title}</span>
            <i
              className="ti ti-chevron-right"
              style={{ fontSize: 10 }}
              aria-hidden="true"
            />
            <span style={{ color: '#111', fontWeight: 600 }}>
              {activeSubsection?.title}
            </span>
          </div>

          {/* Section header */}
          <div
            style={{
              marginBottom: 24,
              paddingBottom: 20,
              borderBottom: '2px solid #f3f4f6',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                marginBottom: 8,
              }}
            >
              <div
                style={{
                  background: '#dc2626',
                  color: '#fff',
                  borderRadius: 5,
                  padding: '3px 9px',
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: '0.02em',
                }}
              >
                {activeId}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: '#9ca3af',
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                  fontWeight: 600,
                }}
              >
                Part {activeSection?.part} — {activeSection?.title}
              </div>
            </div>
            <h1
              style={{
                fontSize: 26,
                fontWeight: 700,
                color: '#111',
                margin: 0,
                letterSpacing: '-0.02em',
              }}
            >
              {activeSubsection?.title}
            </h1>
          </div>

          {/* Content */}
          <div style={{ maxWidth: 760 }}>
            <SectionContent id={activeId} />
          </div>

          {/* Prev / Next */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginTop: 48,
              paddingTop: 20,
              borderTop: '1px solid #e5e7eb',
              maxWidth: 760,
            }}
          >
            {prevSub ? (
              <button
                onClick={() => navigate(prevSub.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 16px',
                  background: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: 8,
                  cursor: 'pointer',
                  fontSize: 13,
                  color: '#374151',
                }}
              >
                <i
                  className="ti ti-arrow-left"
                  style={{ fontSize: 14 }}
                  aria-hidden="true"
                />
                <div style={{ textAlign: 'left' }}>
                  <div
                    style={{
                      fontSize: 10,
                      color: '#9ca3af',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                    }}
                  >
                    {prevSub.id}
                  </div>
                  <div style={{ fontWeight: 600 }}>{prevSub.title}</div>
                </div>
              </button>
            ) : (
              <div />
            )}
            {nextSub ? (
              <button
                onClick={() => navigate(nextSub.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 16px',
                  background: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: 8,
                  cursor: 'pointer',
                  fontSize: 13,
                  color: '#374151',
                }}
              >
                <div style={{ textAlign: 'right' }}>
                  <div
                    style={{
                      fontSize: 10,
                      color: '#9ca3af',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                    }}
                  >
                    {nextSub.id}
                  </div>
                  <div style={{ fontWeight: 600 }}>{nextSub.title}</div>
                </div>
                <i
                  className="ti ti-arrow-right"
                  style={{ fontSize: 14 }}
                  aria-hidden="true"
                />
              </button>
            ) : (
              <div />
            )}
          </div>
        </main>

        {/* Right mini-TOC */}
        <aside
          style={{
            width: 160,
            flexShrink: 0,
            padding: '20px 16px',
            position: 'sticky',
            top: 56,
            height: 'calc(100vh - 56px)',
            overflowY: 'auto',
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: '#9ca3af',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              marginBottom: 10,
            }}
          >
            In this part
          </div>
          {activeSection?.subsections.map((sub) => (
            <button
              key={sub.id}
              onClick={() => navigate(sub.id)}
              style={{
                width: '100%',
                textAlign: 'left',
                padding: '5px 0',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: 12,
                color: activeId === sub.id ? '#dc2626' : '#6b7280',
                fontWeight: activeId === sub.id ? 700 : 400,
                lineHeight: 1.4,
                display: 'block',
              }}
            >
              <span
                style={{
                  color: activeId === sub.id ? '#dc2626' : '#bbb',
                  marginRight: 5,
                  fontSize: 11,
                }}
              >
                {sub.id}
              </span>
              {sub.title}
            </button>
          ))}
        </aside>
      </div>
    </div>
  )
}
