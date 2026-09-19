/**
 * Accounting Rulebook (Domain Knowledge Index)
 *
 * Purpose: give the AI copilot the same accounting rules a human bookkeeper
 * knows, so it can classify "where does X belong" questions and drive the user
 * to the correct page + element instead of guessing.
 *
 * IMPORTANT - mapping rules
 * - `route` MUST be one of the app's real routes (see SITE_MAP); never invent one.
 * - `targetLabel` MUST describe a button/label that actually appears on that page
 *   (see NEW_PAGE_BUTTONS and the live page structure). Never invent a button.
 * - If this app genuinely has no page for a category (e.g. "bank charges journal
 *   entry"), explain that in `note` and route to the closest real page; do not
 *   pretend the page exists.
 *
 * Each entry = { id, type, phraseTokens, category, route, targetLabel, explanation, note? }
 */
export const ACCOUNTING_RULEBOOK = {
  tradingIncome: {
    category: 'Capital Gains / Other Income',
    route: '/adjustments',
    targetLabel: 'New Adjustment',
    explanation:
      'Trading gains and realised gains on financial instruments are Capital Gains / Other Income, NOT standard operating product sales. Record them through an Adjusting Entry on this page (account + amount), using an "Other Income" / "Capital Gains" account in the Chart of Accounts.',
    note: 'This system has no dedicated "Other Income" transaction page, so non-operating income is captured via Adjustments rather than the Sales form.'
  },
  productSales: {
    category: 'Operating Revenue',
    route: '/sales',
    targetLabel: 'New Sales',
    explanation:
      'Standard sales of goods or services are Operating Revenue. Use the New Sales form, pick the customer, add product/service line items)Skip, then draft or post.'
  },
  officeSupplies: {
    category: 'Operating Expense',
    route: '/purchase',
    targetLabel: 'New Purchase',
    explanation:
      'Day-to-day office supply purchases are Operating Expenses. Record them on the Purchase form with the vendor and line items, then draft or post.'
  },
  customerReceipt: {
    category: 'Cash Receipts / Collections',
    route: '/receipts',
    targetLabel: 'New Receipt',
    explanation:
      'Money received from a customer is a Receipt. Use the New Receipt form, select the customerSkip, record the amount, then draft or post.'
  },
  vendorPayment: {
    category: 'Cash Payments / Disbursements',
    route: '/payments',
    targetLabel: 'New Payment',
    explanation:
      'Money paid to a vendor is a Payment (or Cash Disbursement). Use the New Payment form, select the vendorSkip, record the amount, then draft or post.'
  },
  purchaseOrder: {
    category: 'Purchase Orders (Pre-commitment)',
    route: '/purchase_order',
    targetLabel: 'New Purchase Order',
    explanation:
      'A Purchase Order is a pre-commitment to buy and is not yet an expense. File it here before converting to a Purchase when goods arrive.'
  },
  vat: {
    category: 'Value Added Tax',
    route: '/vat',
    targetLabel: 'VAT',
    explanation:
      'VAT is tracked in its own module: run the VAT report to see output and input VAT positions, and record VAT through the sales/purchase line-item VAT % selectors.'
  },
  withholdingTax: {
    category: 'Withholding Tax',
    route: '/witholding_tax',
    targetLabel: 'Withholding Tax',
    explanation:
      'Withholding tax at source is computed from the WHT % column on transaction line items and reported in the Withholding Tax module.'
  },
  adjustments: {
    category: 'Adjustments / Journal Entries',
    route: '/adjustments',
    targetLabel: 'New Adjustment',
    explanation:
      'Adjusting entries fix account balances; note this page is account-and-amount based (no product line items) and does have Remarks + Attachments.'
  },
  chartsOfAccounts: {
    category: 'Chart of Accounts / COA',
    route: '/charts',
    targetLabel: 'Chart of Accounts',
    explanation:
      'The Chart of Accounts defines every account (Cash, AR, Inventory, Revenue, Other Income\u2026). Settings live under Chart of Accounts; each transaction line selects a COA.'
  },
  agingReceivables: {
    category: 'Aging Receivables',
    route: '/aging_receivables',
    targetLabel: 'Aging Receivables',
    explanation:
      'Aging Receivables report lists overdue customer balances; navigate here to review customers who have not paid.'
  },
  agingPayables: {
    category: 'Aging Payables',
    route: '/aging_payables',
    targetLabel: 'Aging Payables',
    explanation:
      'Aging Payables report lists overdue vendor balances; navigate here to review unpaid vendor bills.'
  },
  trialBalance: {
    category: 'Trial Balance',
    route: '/trial-balance',
    targetLabel: 'Trial Balance',
    explanation:
      'The Trial Balance lists every account with its debit/credit totals to verify the books balance before financial statements.'
  },
  generalLedger: {
    category: 'General Ledger',
    route: '/general-ledger',
    targetLabel: 'General Ledger',
    explanation:
      'The General Ledger shows all posting activity per account; use it to trace transactions back to source documents.'
  },
  bankReconciliation: {
    category: 'Bank Reconciliation',
    route: '/bank-reconciliation',
    targetLabel: 'Bank Reconciliation',
    explanation:
      'Bank Reconciliation matches the bank statement against the cashbook to surface missing or duplicate items.'
  },
  incomeStatement: {
    category: 'Income Statement',
    route: '/income-statement',
    targetLabel: 'Income Statement',
    explanation:
      'The Income Statement summarises revenue and expenses to compute profit for the period.'
  }
}

/** Ordered alias phrase lists so the model can match natural language to an entry. */
export const ACCOUNTING_ALIASES = [
  { entryId: 'tradingIncome', phrases: ['trading income', 'capital gain', 'investment income', 'gain on sale of shares', 'other income'] },
  { entryId: 'productSales', phrases: ['product sales', 'goods sales', 'operating revenue', 'sale of goods', 'sale invoice'] },
  { entryId: 'officeSupplies', phrases: ['office suppl', 'stationery', 'operating expense', 'supplies expense'] },
  { entryId: 'customerReceipt', phrases: ['receipt', 'money received', 'customer payment', 'collection'] },
  { entryId: 'vendorPayment', phrases: ['payment to vendor', 'disbursement', 'money paid', 'pay supplier'] },
  { entryId: 'purchaseOrder', phrases: ['purchase order', 'p.o.'] },
  { entryId: 'vat', phrases: ['vat', 'value added tax', 'output tax', 'input tax'] },
  { entryId: 'withholdingTax', phrases: ['withholding tax', 'wht', 'witholding'] },
  { entryId: 'adjustments', phrases: ['adjustment', 'journal entry', 'adjusting entry', 'journal'] },
  { entryId: 'chartsOfAccounts', phrases: ['chart of accounts', 'coa', 'account list'] },
  { entryId: 'agingReceivables', phrases: ['aging receivable', 'overdue customer', 'accounts receivable report'] },
  { entryId: 'agingPayables', phrases: ['aging payable', 'overdue vendor', 'accounts payable report'] },
  { entryId: 'trialBalance', phrases: ['trial balance'] },
  { entryId: 'generalLedger', phrases: ['general ledger', 'ledger'] },
  { entryId: 'bankReconciliation', phrases: ['bank reconciliation', 'reconcile bank'] },
  { entryId: 'incomeStatement', phrases: ['income statement', 'profit and loss', 'p&l'] }
]
</content>
