import { useState, useMemo, useEffect, useRef } from "react";

const SECTIONS = [
  {
    part: 1,
    title: "Getting Started",
    icon: "🚀",
    color: "#0ea5e9",
    bg: "#f0f9ff",
    articles: [
      {
        id: "1-1",
        title: "What This System Does",
        icon: "📊",
        content: `This is a web-based business accounting system that helps your team record and track all financial activity. It covers money coming in (sales, receipts, customer payments), money going out (purchases, disbursements, vendor payments), tax records (VAT and withholding tax), and financial reports including trial balance, income statement, balance sheet, and more.\n\nSome pages handle cash directly without needing an invoice first. Others manage the full invoice-and-payment cycle. Reports pull everything together so you can check the accuracy and health of your books at any time.`,
      },
      {
        id: "1-2",
        title: "Login & Register",
        icon: "🔐",
        content: `To log in, enter your username and password. After a successful login you are taken to the Dashboard. The system loads only the pages your account is permitted to use. If you forget your password, contact your administrator.\n\nIf registration is enabled by your administrator, use the Register page to create a new account. Fill in your name, email, and password. After registering you are redirected to the Login page to sign in.`,
      },
      {
        id: "1-3",
        title: "Dashboard",
        icon: "🏠",
        content: `The Dashboard is the home page you see immediately after login. It shows key financial totals at a glance (cash balances, outstanding invoices), recent transactions and activity, and quick links to the main pages you use most often.\n\nThink of it as the front page of your accounting records — a snapshot of where the business stands right now without having to run a full report.`,
      },
      {
        id: "1-4",
        title: "Search & Top-Header Tools",
        icon: "🔍",
        content: `A search box in the top header is available on every page. Type a keyword (customer name, reference number, or description), select a start and end date, then press Enter or click Search. Matching results include sales invoices, collections, receipts, purchases, disbursements, and adjustments. Click any result to open that record directly.\n\nThe search is useful when you remember a reference number or name but aren't sure which module it belongs to.`,
      },
      {
        id: "1-5",
        title: "User Access & Permissions",
        icon: "🛡️",
        content: `Not every user sees every page. The system checks your role and shows only the pages and actions you are allowed to use. If a page isn't in your menu, you don't have permission for it — ask your administrator to grant access.\n\nSome pages are visible but certain buttons (approve, delete, edit) may be hidden depending on your role. Administrators manage these settings in the Access Control page.`,
      },
    ],
  },
  {
    part: 2,
    title: "Administration",
    icon: "⚙️",
    color: "#8b5cf6",
    bg: "#f5f3ff",
    articles: [
      {
        id: "2-1",
        title: "Company Management",
        icon: "🏢",
        content: `Store and update your company's details — name, address, tax ID, logo, and more. These details appear on all printed documents such as invoices, receipts, and payments. Updated company details appear on all newly printed documents immediately after saving.\n\nTypically used by administrators or accounting managers.`,
      },
      {
        id: "2-2",
        title: "Access Control",
        icon: "🔑",
        content: `Define which pages and actions each user role can access. You can view existing access rules per role, grant or remove access to specific pages and actions (create, edit, approve, delete, print), and assign roles to users. Changes take effect the next time the affected user logs in or refreshes.\n\nBe careful when removing access — users will lose the ability to see or act on those pages immediately. Administrators only.`,
      },
      {
        id: "2-3",
        title: "User Management",
        icon: "👥",
        content: `Create and manage user accounts for everyone who needs to use the system. You can view all user accounts, create new accounts (name, email, password, role), edit existing user details or roles, and deactivate or delete accounts no longer needed.\n\nWhen a new user is created, the system applies access rights based on their assigned role. Changes to a user's role update their page access automatically.`,
      },
      {
        id: "2-4",
        title: "Chart of Accounts (COA)",
        icon: "📋",
        content: `The master list of every financial account category used in the system. All accounting entries must be mapped to an account from this list. Account types include: Assets (what the business owns), Liabilities (what the business owes), Equity (owner's share), Revenue (income from sales), and Expenses (costs of running the business).\n\nNew accounts become available immediately. Account balances update in real time whenever transactions are posted. Important: Changing an account type after transactions have been posted can affect your reports — consult your accountant before making changes.`,
      },
      {
        id: "2-5",
        title: "Products & Services",
        icon: "📦",
        content: `Maintain the catalog of products and services your business sells or buys. These items appear as line items on invoices, purchase orders, and receipts. You can add items with a name, code (SKU), description, unit price, VAT rate, and linked account.\n\nWhen you add a product to a sales invoice or purchase, the system pulls in the price and tax rate and computes the line total automatically. If inventory tracking is enabled, sales reduce stock quantities and purchases increase them.`,
      },
      {
        id: "2-6",
        title: "Proforma Entries",
        icon: "📄",
        content: `Create draft invoices (estimates or quotations) for customers before issuing a final invoice. Proforma records do NOT affect the books. You can create, edit, and convert proformas into real Sales invoices, and print them for customer approval.\n\nProforma entries do not create journal entries or affect account balances until they are converted to a Sales invoice and approved. After conversion, the document follows the normal sales posting process.`,
      },
    ],
  },
  {
    part: 3,
    title: "Customers & Vendors",
    icon: "🤝",
    color: "#10b981",
    bg: "#ecfdf5",
    articles: [
      {
        id: "3-1",
        title: "Customer Management",
        icon: "👤",
        content: `Store and maintain records for all customers your business sells to. Add customers with their name, contact person, email, phone, address, tax ID (TIN), payment terms, and credit limit. Customer balances (how much they owe) update automatically whenever invoices are posted and payments are received.\n\nNew customers immediately become available for selection on Sales, Collections, and Receipt pages.`,
      },
      {
        id: "3-2",
        title: "Customer Transactions",
        icon: "📑",
        content: `See the complete financial history for one or all customers in one place. You can view all customer-related documents (sales invoices, collections, receipts), filter by customer name, date range, or document type, and check outstanding balances per customer.\n\nUseful for answering customer queries like "what do I owe?" or for reviewing payment history before extending credit.`,
      },
      {
        id: "3-3",
        title: "Vendor Management",
        icon: "🏭",
        content: `Store and maintain records for all suppliers and vendors your business buys from. Add vendors with their name, contact details, address, tax ID, payment terms, and bank details for payment processing.\n\nVendor balances (how much you owe them) update automatically whenever purchase invoices are posted and payments are made. New vendors are available immediately on Purchase, Payments, and Disbursement pages.`,
      },
      {
        id: "3-4",
        title: "Vendor Transactions",
        icon: "🗂️",
        content: `See the complete financial history for one or all vendors in one place. View all vendor-related documents (purchase invoices, payments, disbursements), filter by vendor name, date range, or document type, and check outstanding payable balances per vendor.\n\nUseful when reviewing how much you owe a supplier before making a payment run, or when reconciling a supplier statement.`,
      },
    ],
  },
  {
    part: 4,
    title: "Tax Pages",
    icon: "🧾",
    color: "#f59e0b",
    bg: "#fffbeb",
    articles: [
      {
        id: "4-1",
        title: "VAT Management",
        icon: "💹",
        content: `Manage VAT (Value Added Tax) settings and view VAT-related records across sales and purchases. You can view and update VAT rates, view VAT records applied to transactions, and generate summaries of VAT collected (output tax) and VAT paid (input tax).\n\nWhen you add a product to a sales invoice, VAT is computed automatically from the rate set on the product. VAT amounts post to the VAT Payable or VAT Creditable accounts in the General Ledger automatically. Set up correct VAT rates before you start creating invoices — incorrect rates will require adjustment entries later.`,
      },
      {
        id: "4-2",
        title: "Withholding Tax",
        icon: "📊",
        content: `Record and track withholding taxes deducted from supplier payments or collected from customers. When you pay a vendor and are required to withhold a percentage of the payment as tax, you record it here.\n\nThe withheld amount is posted to a Withholding Tax Payable account in the General Ledger. The vendor receives the net amount, and the withheld tax is remitted to the tax authority separately. You can generate summaries for withholding tax compliance reporting.`,
      },
    ],
  },
  {
    part: 5,
    title: "Cash Transactions",
    icon: "💵",
    color: "#ef4444",
    bg: "#fef2f2",
    articles: [
      {
        id: "5-1",
        title: "Receipts",
        icon: "💰",
        content: `Record cash or check received by the business — without a sales invoice. Use for direct cash sales, miscellaneous income, donations, or any money received that does not go through the sales invoice cycle.\n\nWhen approved, the system posts: Debit → Cash/Bank account (increases your cash balance) and Credit → Income/Revenue account. Only approved/posted receipts affect the books. Drafts do not appear in reports.\n\nInputs: receipt date, customer (optional), reference number, payment method, bank/cash account, amount received, and remarks.`,
      },
      {
        id: "5-2",
        title: "Disbursements",
        icon: "💸",
        content: `Record cash or check paid out by the business — without a purchase invoice. Use for petty cash payments, miscellaneous expenses, or any direct cash payment that does not go through the purchase invoice cycle.\n\nWhen approved, the system posts: Credit → Cash/Bank account (decreases your cash balance) and Debit → Expense or Asset account. If you have a vendor invoice that needs to go through the approval process, use the Purchase page instead.\n\nInputs: payment date, payee/vendor, reference number, payment method, bank/cash account, amount paid, and expense category.`,
      },
    ],
  },
  {
    part: 6,
    title: "Sales Cycle",
    icon: "📈",
    color: "#06b6d4",
    bg: "#ecfeff",
    articles: [
      {
        id: "6-1",
        title: "Sales (Invoices)",
        icon: "🧾",
        content: `Create and manage customer sales invoices. When you sell to a customer on credit (they will pay later), you record it here first. The workflow: Create invoice (PREPARED/DRAFT) → Supervisor checks (CHECKED) → Authorized user approves and posts (APPROVED/POSTED) → Customer pays → record in Collections.\n\nOn approval the system posts: Debit → Accounts Receivable (customer owes you), Credit → Revenue account (income earned), Credit → VAT Payable (if VAT applies). The system also reduces inventory if stock tracking is enabled.\n\nInputs: customer name, invoice and due date, line items (product, quantity, unit price), discounts, VAT, payment terms, and reference number.`,
      },
      {
        id: "6-2",
        title: "Collections (Customer Payments)",
        icon: "💳",
        content: `Record a payment received from a customer and apply it to one or more outstanding sales invoices. This clears the customer's debt. Workflow: Customer sends payment → Create collection record → Select customer and invoices → Save and approve.\n\nOn approval: Debit → Cash/Bank account (your cash goes up), Credit → Accounts Receivable (customer's balance goes down). Applied invoices are marked as partially or fully paid. If the payment exceeds the invoice total, the excess becomes a credit balance for the customer.\n\nInputs: collection date, customer, payment method, bank/check details, amount received, invoice(s) to apply, and remarks.`,
      },
      {
        id: "6-3",
        title: "Aging Receivables",
        icon: "📅",
        content: `A report showing all unpaid customer invoices grouped by how overdue they are. The system takes all posted sales invoices not yet fully collected and groups them into age buckets: Current (not yet due), 1–30 days overdue, 31–60 days, 61–90 days, and Over 90 days overdue.\n\nUse this page to prioritize collection calls, identify customers with long-overdue balances, and support credit limit decisions. You can filter by date to see aging as of a specific day and export or print for collection follow-up.`,
      },
    ],
  },
  {
    part: 7,
    title: "Purchase Cycle",
    icon: "🛒",
    color: "#ec4899",
    bg: "#fdf2f8",
    articles: [
      {
        id: "7-1",
        title: "Purchase (Vendor Invoices)",
        icon: "📃",
        content: `Record vendor invoices for goods or services received. Use this when you have received a supplier invoice and need to record what you owe. Workflow: Receive vendor invoice → Create purchase record (DRAFT) → Reviewer checks (CHECKED) → Authorized user approves (APPROVED) → Pay vendor via Payments.\n\nOn approval: Debit → Expense or Inventory account (cost is recorded), Credit → Accounts Payable (you now owe the vendor). Inventory is increased if stock tracking is enabled.\n\nInputs: vendor name, invoice and due date, line items (description, quantity, unit price, expense/asset account), VAT, reference number, and payment terms.`,
      },
      {
        id: "7-2",
        title: "Purchase Orders (PO)",
        icon: "📝",
        content: `Create a formal purchase order (request to buy) before receiving the vendor's invoice. A PO documents what you intend to buy, at what price, and from whom. Use when your business requires formal approval before ordering goods or services.\n\nWorkflow: Create PO and get it approved → Send PO to vendor → Receive goods/services → Convert PO to Purchase invoice (or Disbursement for immediate cash payment). Purchase Orders do NOT post to the General Ledger — they are not yet expenses. On conversion, the PO details pre-fill the new purchase record automatically.`,
      },
      {
        id: "7-3",
        title: "Payments (Vendor Payments)",
        icon: "🏦",
        content: `Record a payment made to a vendor and apply it to one or more outstanding purchase invoices. This reduces what you owe the vendor. Workflow: Ready to pay vendor → Create payment record → Select vendor and purchase invoices → Save and approve.\n\nOn approval: Debit → Accounts Payable (your balance owed to vendor goes down), Credit → Cash/Bank account (your cash goes down). Applied purchase invoices are marked as partially or fully paid. Bank charges are posted to the relevant expense account if entered.\n\nInputs: payment date, vendor, payment method, bank/check details, amount paid, purchase invoice(s) to apply, bank charges, and remarks.`,
      },
    ],
  },
  {
    part: 8,
    title: "Accounting Adjustments",
    icon: "✏️",
    color: "#64748b",
    bg: "#f8fafc",
    articles: [
      {
        id: "8-1",
        title: "Adjustments",
        icon: "🔧",
        content: `Make manual corrections or special accounting entries that don't belong to a standard sales, purchase, receipt, or disbursement. Common uses: correcting a wrong account on a posted entry, recording accruals, reclassifying amounts between accounts, recording depreciation or amortization, and reversing prior period entries.\n\nIMPORTANT: Total debits must equal total credits — the system will not allow you to post an unbalanced entry. The entry appears in the Trial Balance, General Ledger, and all reports immediately. Always add clear notes explaining why the adjustment was made.\n\nInputs: date, reference number, debit account and amount, credit account and amount, and explanation/notes.`,
      },
      {
        id: "8-2",
        title: "Advances (Prepayments)",
        icon: "⏩",
        content: `Record money paid in advance before a purchase or service is received, or money received from a customer before invoicing. Common uses: down payment to a vendor, customer deposit before a project starts, and employee cash advance.\n\nWorkflow (Vendor Advance): Pay deposit → Record as Advance (cash goes out, Advances asset goes up) → Goods received and invoice arrives → Create Purchase → Apply advance to purchase invoice (Advances account goes down).\n\nOn initial advance: Debit → Advances/Prepaid account, Credit → Cash/Bank. When settled: Debit → Expense/Inventory, Credit → Advances/Prepaid.`,
      },
    ],
  },
  {
    part: 9,
    title: "Reports",
    icon: "📊",
    color: "#7c3aed",
    bg: "#f5f3ff",
    articles: [
      {
        id: "9-1",
        title: "Trial Balance",
        icon: "⚖️",
        content: `A fundamental accuracy check. Shows the balance of every account for a selected period. Total debits must equal total credits — if they don't, there is an error somewhere. Every account in the Chart of Accounts appears as a row, with debit and credit columns.\n\nHow to use: Select a date range → Run the report → Verify that total Debits equal total Credits → If they don't match, investigate for missing entries, unposted records, or adjustment errors. Only POSTED entries (not drafts) are included. Essential for month-end and year-end closing checks before preparing financial statements.`,
      },
      {
        id: "9-2",
        title: "Income Statement (Profit & Loss)",
        icon: "📉",
        content: `Shows whether the business made a profit or a loss during a selected period. Structure: Revenue → Less Cost of Sales → Gross Profit → Less Operating Expenses → Net Income/(Loss).\n\nThe system computes: Revenue = sum of credits minus debits on Revenue-type accounts; Expenses = sum of debits minus credits on Expense-type accounts; Net Income = Revenue − Expenses. Select a start and end date (usually a month or full financial year) and run the report. Compare periods to track business performance over time.`,
      },
      {
        id: "9-3",
        title: "General Ledger",
        icon: "📒",
        content: `The detailed record of every posted transaction, organized by account. Select an account (or all accounts) and a date range to see every journal line that touched that account, with the source document reference. Running balances show how an account moved over time. You can drill into any line to open the original source document.\n\nUseful for detailed account analysis, investigating unusual balances, reconciling specific accounts, and supporting audit inquiries. Differs from Journal Entries in that the GL groups by account and shows running balances.`,
      },
      {
        id: "9-4",
        title: "Balance Sheet",
        icon: "🏛️",
        content: `A snapshot of the business's financial position on a specific date. Shows what the business owns (assets), what it owes (liabilities), and the owner's share (equity). Structure: Assets (Current: Cash, AR, Inventory; Non-Current: Equipment, Property) + Liabilities (Current: AP, VAT Payable; Long-Term: Loans) + Equity (Owner's Capital and Retained Earnings).\n\nTotal Assets must equal Total Liabilities plus Equity. Select an "as of" date (e.g., last day of the month) and the system uses all GL balances up to and including that date.`,
      },
      {
        id: "9-5",
        title: "Statement of Comprehensive Income",
        icon: "📋",
        content: `An extended version of the Income Statement that includes not only operating profit/loss but also other comprehensive income (OCI) items — items that affect equity but are not part of normal operations. Common OCI items: unrealized gains or losses on certain investments, foreign currency translation adjustments, and revaluation surplus on property.\n\nStructure: Net Income (from P&L) + Other Comprehensive Income items = Total Comprehensive Income. Useful for businesses that follow full IFRS/PFRS reporting requirements.`,
      },
      {
        id: "9-6",
        title: "Journal Entries",
        icon: "📰",
        content: `View every journal entry posted to the system. Useful for accountants, auditors, or anyone who needs to verify the raw accounting data. You can filter by date range, account, or reference number, click any entry to see the full debit/credit detail and source document, and export for external use or audit submission.\n\nDiffers from the General Ledger: the GL groups by account and shows running balances, while Journal Entries shows each complete entry (all lines together) in chronological order.`,
      },
      {
        id: "9-7",
        title: "Bank Reconciliation",
        icon: "🏧",
        content: `Compare your bank statement to your accounting books to confirm every transaction is recorded correctly. Bank statements and your books can differ because of timing (checks not yet cleared, deposits in transit) or errors.\n\nProcess: Upload/enter bank statement transactions → System matches against GL cash entries → Mark transactions as "cleared" → Outstanding items are listed separately → Create reconciling adjustment entries for genuine differences → Finalize when GL balance matches bank balance. Reconcile at least once a month to catch missing entries and bank errors early.`,
      },
      {
        id: "9-8",
        title: "Audit Trail",
        icon: "🔎",
        content: `A complete log of who did what and when in the system. Shows every create, edit, approve, and delete action on important records. You can filter by user, date, page, or record, see the before and after values for changes, and export for compliance or investigation purposes.\n\nUseful for investigating discrepancies ("who changed this entry?"), compliance with internal controls, external audits, and detecting unauthorized changes. Every action you take in the system is logged.`,
      },
    ],
  },
  {
    part: 10,
    title: "Tips & Reference",
    icon: "💡",
    color: "#f97316",
    bg: "#fff7ed",
    articles: [
      {
        id: "10-1",
        title: "Key Transaction Flows",
        icon: "🔄",
        content: `CASH IN (no invoice): Customer pays you cash directly → Use Receipts → Cash goes up, Income recorded.\n\nCASH OUT (no invoice): You pay something in cash directly → Use Disbursements → Cash goes down, Expense recorded.\n\nCREDIT SALE (pay later): Sell to customer who will pay later → Step 1: Create Sales invoice (AR up, Revenue recorded) → Step 2: Customer pays → Collections (Cash up, AR down).\n\nCREDIT PURCHASE (pay later): Receive goods, pay vendor later → Step 1: Create Purchase invoice (Expense recorded, AP up) → Step 2: Pay vendor → Payments (AP down, Cash down).\n\nPURCHASE ORDER: Need approval before ordering → Step 1: Create PO (no ledger effect) → Step 2: Receive goods → Convert PO to Purchase → Step 3: Pay vendor → Payments.\n\nCORRECTIONS: Something posted incorrectly → Use Adjustments → Manual journal entry directly to GL.\n\nPREPAYMENTS: Pay before invoice is issued → Use Advances → Prepaid account records money, settled when invoice arrives.`,
      },
      {
        id: "10-2",
        title: "Using Filters & Date Search",
        icon: "🗓️",
        content: `Almost every page allows you to filter records by date. Select a Start Date and End Date, then apply the filter — only records within that range are shown. Clear the filter to return to the full list.\n\nAdditional filters available on most pages: customer or vendor name, status (Draft, Approved, Posted), reference number, and amount range.\n\nTop-header search: Searches across multiple modules at once and requires a keyword AND a date range. Click a result to jump directly to that record.\n\nOn most list pages you can click any row to open the full detail view of that record.`,
      },
      {
        id: "10-3",
        title: "What Users Can Do",
        icon: "✅",
        content: `Depending on your access rights, you may be able to: view and browse records, search by date/name/reference, add a new record (if you have Create permission), edit a draft record (if you have Edit permission), submit for checking or approval, approve and post to the books (if you have Approve permission), download or print documents as PDF, attach supporting files, and open and review full record details.\n\nIf a button is not visible, you do not have permission for that action. Contact your administrator to request access.`,
      },
      {
        id: "10-4",
        title: "Automation & Posting Flow",
        icon: "⚡",
        content: `The system automates the accounting work so you only need to enter the business event. Key automated postings:\n\nSales Invoice approved → AR record created, Journal: Debit AR / Credit Revenue / Credit VAT Payable, Inventory may be reduced.\n\nCollection recorded → Journal: Debit Cash / Credit AR, Customer's outstanding balance decreases, Invoice marked as paid.\n\nPurchase Invoice approved → AP record created, Journal: Debit Expense/Inventory / Credit AP, Inventory may be increased.\n\nVendor Payment recorded → Journal: Debit AP / Credit Cash, Vendor's outstanding balance decreases, Purchase invoice marked as paid.\n\nReceipt created → Journal: Debit Cash / Credit Income. No AR/AP lifecycle — direct cash posting.\n\nDisbursement created → Journal: Debit Expense / Credit Cash. No AR/AP lifecycle — direct cash posting.`,
      },
      {
        id: "10-5",
        title: "General Tips",
        icon: "📌",
        content: `1. ALWAYS APPROVE BEFORE RUNNING REPORTS: Draft records are not included in any report. Make sure all records are approved/posted before checking your Trial Balance or financial statements.\n\n2. USE TRIAL BALANCE FIRST: Before preparing month-end reports, run the Trial Balance to check that debits equal credits. An out-of-balance Trial Balance means there is a data entry or posting error somewhere.\n\n3. RECONCILE REGULARLY: Run Bank Reconciliation at least once a month. This catches missing entries, bank errors, and timing differences before they become hard to trace.\n\n4. ALWAYS ADD NOTES TO ADJUSTMENTS: The Notes field on Adjustments is very important. In 6 months, you (or your auditor) will need to understand why the entry was made.\n\n5. DATES MATTER: Always enter the correct transaction date. Reports are date-based; wrong dates put transactions in the wrong reporting period.\n\n6. THE AUDIT TRAIL RECORDS EVERYTHING: Every action you take in the system is logged — work accurately and honestly.`,
      },
    ],
  },
];

const ALL_ARTICLES = SECTIONS.flatMap((s) =>
  s.articles.map((a) => ({ ...a, sectionTitle: s.title, sectionColor: s.color, part: s.part }))
);

function highlight(text, query) {
  if (!query) return text;
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
  return text.split(regex).map((part, i) =>
    regex.test(part) ? (
      <mark key={i} style={{ background: "#fef08a", borderRadius: 3, padding: "0 1px" }}>
        {part}
      </mark>
    ) : (
      part
    )
  );
}

function ArticleContent({ content, query }) {
  return (
    <div style={{ fontSize: 15, lineHeight: 1.8, color: "var(--color-text-secondary)" }}>
      {content.split("\n\n").map((para, i) => (
        <p key={i} style={{ marginBottom: 12 }}>
          {query ? highlight(para, query) : para}
        </p>
      ))}
    </div>
  );
}

function ArticleCard({ article, query, accentColor, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen || false);
  return (
    <div
      style={{
        borderRadius: 12,
        border: `0.5px solid var(--color-border-tertiary)`,
        background: "var(--color-background-primary)",
        marginBottom: 10,
        overflow: "hidden",
        transition: "box-shadow 0.15s",
      }}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "14px 18px",
          background: "none",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <span style={{ fontSize: 20 }}>{article.icon}</span>
        <span
          style={{
            flex: 1,
            fontSize: 15,
            fontWeight: 500,
            color: "var(--color-text-primary)",
          }}
        >
          {query ? highlight(article.title, query) : article.title}
        </span>
        <span
          style={{
            fontSize: 18,
            color: "var(--color-text-tertiary)",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.2s",
          }}
        >
          ▾
        </span>
      </button>
      {open && (
        <div style={{ padding: "0 18px 16px 50px" }}>
          <div
            style={{
              height: 2,
              background: accentColor,
              borderRadius: 2,
              marginBottom: 14,
              width: 32,
            }}
          />
          <ArticleContent content={article.content} query={query} />
        </div>
      )}
    </div>
  );
}

export default function UserDocumentation() {
  const [activeSection, setActiveSection] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const searchRef = useRef(null);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return ALL_ARTICLES.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        a.content.toLowerCase().includes(q) ||
        a.sectionTitle.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  const activeData = activeSection
    ? SECTIONS.find((s) => s.part === activeSection)
    : null;

  useEffect(() => {
    if (!activeSection && !searchQuery) setActiveSection(1);
  }, []);

  const handleSectionClick = (part) => {
    setActiveSection(part);
    setSearchQuery("");
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--color-background-tertiary)",
        fontFamily: "var(--font-sans)",
      }}
    >
      {/* Header */}
      <header
        style={{
          background: "var(--color-background-primary)",
          borderBottom: "0.5px solid var(--color-border-tertiary)",
          padding: "0 24px",
          display: "flex",
          alignItems: "center",
          gap: 16,
          height: 60,
          position: "sticky",
          top: 0,
          zIndex: 100,
        }}
      >
        <button
          onClick={() => setSidebarOpen((o) => !o)}
          aria-label="Toggle sidebar"
          style={{
            background: "none",
            border: "0.5px solid var(--color-border-secondary)",
            borderRadius: 8,
            padding: "6px 8px",
            cursor: "pointer",
            color: "var(--color-text-secondary)",
            fontSize: 16,
            lineHeight: 1,
          }}
        >
          ☰
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              background: "linear-gradient(135deg, #0ea5e9, #8b5cf6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 15,
            }}
          >
            📗
          </div>
          <span
            style={{
              fontSize: 15,
              fontWeight: 500,
              color: "var(--color-text-primary)",
            }}
          >
            Accounting System Docs
          </span>
          <span
            style={{
              fontSize: 11,
              background: "var(--color-background-info)",
              color: "var(--color-text-info)",
              borderRadius: 6,
              padding: "2px 7px",
              fontWeight: 500,
            }}
          >
            v1.0
          </span>
        </div>
        {/* Search bar */}
        <div
          style={{
            flex: 1,
            maxWidth: 420,
            marginLeft: "auto",
            position: "relative",
          }}
        >
          <span
            style={{
              position: "absolute",
              left: 10,
              top: "50%",
              transform: "translateY(-50%)",
              fontSize: 16,
              color: "var(--color-text-tertiary)",
              pointerEvents: "none",
            }}
          >
            🔍
          </span>
          <input
            ref={searchRef}
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              if (e.target.value) setActiveSection(null);
            }}
            placeholder="Search documentation..."
            style={{
              width: "100%",
              paddingLeft: 34,
              paddingRight: 12,
              height: 36,
              borderRadius: 8,
              border: "0.5px solid var(--color-border-secondary)",
              background: "var(--color-background-secondary)",
              color: "var(--color-text-primary)",
              fontSize: 14,
              outline: "none",
              boxSizing: "border-box",
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              style={{
                position: "absolute",
                right: 8,
                top: "50%",
                transform: "translateY(-50%)",
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "var(--color-text-tertiary)",
                fontSize: 16,
                lineHeight: 1,
                padding: 0,
              }}
            >
              ×
            </button>
          )}
        </div>
      </header>

      <div style={{ display: "flex" }}>
        {/* Sidebar */}
        {sidebarOpen && (
          <aside
            style={{
              width: 250,
              minWidth: 250,
              background: "var(--color-background-primary)",
              borderRight: "0.5px solid var(--color-border-tertiary)",
              minHeight: "calc(100vh - 60px)",
              padding: "16px 12px",
              position: "sticky",
              top: 60,
              height: "calc(100vh - 60px)",
              overflowY: "auto",
            }}
          >
            <p
              style={{
                fontSize: 11,
                fontWeight: 500,
                letterSpacing: "0.08em",
                color: "var(--color-text-tertiary)",
                textTransform: "uppercase",
                marginBottom: 10,
                paddingLeft: 8,
              }}
            >
              Contents
            </p>
            {SECTIONS.map((section) => (
              <button
                key={section.part}
                onClick={() => handleSectionClick(section.part)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  width: "100%",
                  padding: "9px 10px",
                  borderRadius: 8,
                  border: "none",
                  background:
                    activeSection === section.part
                      ? section.bg
                      : "transparent",
                  cursor: "pointer",
                  textAlign: "left",
                  marginBottom: 2,
                  transition: "background 0.1s",
                }}
              >
                <span style={{ fontSize: 16 }}>{section.icon}</span>
                <span
                  style={{
                    flex: 1,
                    fontSize: 13.5,
                    fontWeight: activeSection === section.part ? 500 : 400,
                    color:
                      activeSection === section.part
                        ? section.color
                        : "var(--color-text-secondary)",
                  }}
                >
                  {section.title}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    color: "var(--color-text-tertiary)",
                    background: "var(--color-background-secondary)",
                    borderRadius: 4,
                    padding: "1px 5px",
                  }}
                >
                  {section.articles.length}
                </span>
              </button>
            ))}

            {/* Quick stats */}
            <div
              style={{
                marginTop: 20,
                padding: "12px 10px",
                borderRadius: 10,
                background: "var(--color-background-secondary)",
                border: "0.5px solid var(--color-border-tertiary)",
              }}
            >
              <p
                style={{
                  fontSize: 11,
                  color: "var(--color-text-tertiary)",
                  marginBottom: 8,
                  fontWeight: 500,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                Guide Stats
              </p>
              {[
                { label: "Sections", val: SECTIONS.length, icon: "📁" },
                { label: "Articles", val: ALL_ARTICLES.length, icon: "📄" },
                { label: "Topics", val: "Complete", icon: "✅" },
              ].map((s) => (
                <div
                  key={s.label}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 6,
                  }}
                >
                  <span
                    style={{
                      fontSize: 12,
                      color: "var(--color-text-secondary)",
                    }}
                  >
                    {s.icon} {s.label}
                  </span>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 500,
                      color: "var(--color-text-primary)",
                    }}
                  >
                    {s.val}
                  </span>
                </div>
              ))}
            </div>
          </aside>
        )}

        {/* Main content */}
        <main style={{ flex: 1, padding: "28px 32px", maxWidth: 860 }}>
          {/* Search results */}
          {searchQuery && (
            <div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  marginBottom: 20,
                }}
              >
                <span style={{ fontSize: 22 }}>🔍</span>
                <div>
                  <h1
                    style={{
                      fontSize: 20,
                      fontWeight: 500,
                      color: "var(--color-text-primary)",
                      margin: 0,
                    }}
                  >
                    Search Results
                  </h1>
                  <p
                    style={{
                      fontSize: 13,
                      color: "var(--color-text-tertiary)",
                      margin: "2px 0 0",
                    }}
                  >
                    {searchResults.length} result{searchResults.length !== 1 ? "s" : ""} for &ldquo;{searchQuery}&rdquo;
                  </p>
                </div>
              </div>
              {searchResults.length === 0 ? (
                <div
                  style={{
                    textAlign: "center",
                    padding: "60px 20px",
                    color: "var(--color-text-tertiary)",
                  }}
                >
                  <div style={{ fontSize: 40, marginBottom: 12 }}>🔎</div>
                  <p style={{ fontSize: 15 }}>No results found for that search.</p>
                  <p style={{ fontSize: 13, marginTop: 6 }}>
                    Try different keywords or browse sections in the sidebar.
                  </p>
                </div>
              ) : (
                searchResults.map((article) => (
                  <div key={article.id} style={{ marginBottom: 12 }}>
                    <div
                      style={{
                        fontSize: 11,
                        color: article.sectionColor,
                        fontWeight: 500,
                        marginBottom: 4,
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <span
                        style={{
                          background: article.sectionColor + "20",
                          borderRadius: 4,
                          padding: "1px 7px",
                        }}
                      >
                        Part {article.part} — {article.sectionTitle}
                      </span>
                    </div>
                    <ArticleCard
                      article={article}
                      query={searchQuery}
                      accentColor={article.sectionColor}
                      defaultOpen
                    />
                  </div>
                ))
              )}
            </div>
          )}

          {/* Section view */}
          {!searchQuery && activeData && (
            <div>
              {/* Section header */}
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 16,
                  marginBottom: 24,
                  padding: "20px 22px",
                  borderRadius: 14,
                  background: activeData.bg,
                  border: `0.5px solid ${activeData.color}30`,
                }}
              >
                <div
                  style={{
                    width: 50,
                    height: 50,
                    borderRadius: 12,
                    background: activeData.color + "20",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 24,
                    flexShrink: 0,
                  }}
                >
                  {activeData.icon}
                </div>
                <div>
                  <div
                    style={{
                      fontSize: 11,
                      color: activeData.color,
                      fontWeight: 500,
                      textTransform: "uppercase",
                      letterSpacing: "0.07em",
                      marginBottom: 4,
                    }}
                  >
                    Part {activeData.part}
                  </div>
                  <h1
                    style={{
                      fontSize: 22,
                      fontWeight: 500,
                      color: "var(--color-text-primary)",
                      margin: "0 0 6px",
                    }}
                  >
                    {activeData.title}
                  </h1>
                  <p style={{ fontSize: 13, color: "var(--color-text-tertiary)", margin: 0 }}>
                    {activeData.articles.length} article{activeData.articles.length !== 1 ? "s" : ""} in this section
                  </p>
                </div>
              </div>

              {/* Article quick-jump */}
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 8,
                  marginBottom: 20,
                }}
              >
                {activeData.articles.map((a) => (
                  <span
                    key={a.id}
                    style={{
                      fontSize: 12,
                      padding: "4px 10px",
                      borderRadius: 8,
                      background: "var(--color-background-secondary)",
                      border: "0.5px solid var(--color-border-tertiary)",
                      color: "var(--color-text-secondary)",
                      cursor: "default",
                    }}
                  >
                    {a.icon} {a.title}
                  </span>
                ))}
              </div>

              {/* Articles */}
              {activeData.articles.map((article) => (
                <ArticleCard
                  key={article.id}
                  article={article}
                  query=""
                  accentColor={activeData.color}
                />
              ))}

              {/* Section navigation */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginTop: 32,
                  gap: 12,
                }}
              >
                {activeData.part > 1 ? (
                  <button
                    onClick={() => setActiveSection(activeData.part - 1)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "10px 16px",
                      borderRadius: 10,
                      border: "0.5px solid var(--color-border-secondary)",
                      background: "var(--color-background-primary)",
                      cursor: "pointer",
                      fontSize: 13,
                      color: "var(--color-text-secondary)",
                    }}
                  >
                    ← Previous:{" "}
                    {SECTIONS.find((s) => s.part === activeData.part - 1)?.title}
                  </button>
                ) : (
                  <div />
                )}
                {activeData.part < SECTIONS.length && (
                  <button
                    onClick={() => setActiveSection(activeData.part + 1)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "10px 16px",
                      borderRadius: 10,
                      border: "0.5px solid var(--color-border-secondary)",
                      background: "var(--color-background-primary)",
                      cursor: "pointer",
                      fontSize: 13,
                      color: "var(--color-text-secondary)",
                    }}
                  >
                    Next:{" "}
                    {SECTIONS.find((s) => s.part === activeData.part + 1)?.title}{" "}
                    →
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Welcome / landing state */}
          {!searchQuery && !activeData && (
            <div>
              <h1
                style={{
                  fontSize: 24,
                  fontWeight: 500,
                  color: "var(--color-text-primary)",
                  marginBottom: 6,
                }}
              >
                📗 Accounting System User Guide
              </h1>
              <p
                style={{
                  fontSize: 15,
                  color: "var(--color-text-secondary)",
                  marginBottom: 28,
                }}
              >
                A complete reference for using the accounting system. Select a section from
                the sidebar or use the search bar above to find what you need.
              </p>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                  gap: 12,
                }}
              >
                {SECTIONS.map((section) => (
                  <button
                    key={section.part}
                    onClick={() => handleSectionClick(section.part)}
                    style={{
                      padding: "16px",
                      borderRadius: 12,
                      border: `0.5px solid ${section.color}30`,
                      background: section.bg,
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    <div style={{ fontSize: 22, marginBottom: 8 }}>{section.icon}</div>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 500,
                        color: "var(--color-text-primary)",
                        marginBottom: 4,
                      }}
                    >
                      {section.title}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--color-text-tertiary)" }}>
                      Part {section.part} · {section.articles.length} articles
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}