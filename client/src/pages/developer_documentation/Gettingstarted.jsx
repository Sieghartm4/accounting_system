import React, { useState, useEffect } from 'react'
import {
  Copy,
  ArrowRight,
  Settings,
  Activity,
  Database,
  Terminal,
} from 'lucide-react'

// ============================================================================
// GETTING STARTED DATA
// ============================================================================

const documents = [
  {
    id: 'welcome',
    title: 'LedgerFlow Dev Center',
    eyebrow: 'DEVELOPER DOCUMENTATION & PLATFORM SETUP',
    category: 'GETTING STARTED',
    isHome: true,
  },
  {
    id: 'project-structure',
    title: '1. Project Directory Structure',
    eyebrow: 'GETTING STARTED',
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
    eyebrow: 'GETTING STARTED',
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
]

// ============================================================================
// WELCOME HOME CONTENT
// ============================================================================

function WelcomePage({ onNavigate }) {
  return (
    <div className="space-y-12">
      <div className="space-y-4">
        <span className="text-xs font-semibold text-sky-400 uppercase tracking-widest font-mono">
          DEVELOPER DOCUMENTATION & PLATFORM SETUP
        </span>
        <h1 className="text-4xl font-extrabold text-white tracking-tight">
          LedgerFlow Dev Center
        </h1>
        <p className="text-base text-slate-400 max-w-3xl leading-relaxed">
          Welcome to the LedgerFlow developer hub. Our robust, real-time double-entry
          posting middleware aggregates subledgers, enforces strict balance controls,
          and offers interactive APIs for seamless accounting integrations.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          {
            icon: <Activity size={20} />,
            iconBg: 'bg-sky-500/10 text-sky-400',
            badge: 'Interactive',
            badgeStyle: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
            title: 'Flowchart Visualizer',
            desc: 'Launch the fully animated visual diagram to trace real-time transaction postings, ledger updates, and balance statements.',
            linkColor: 'text-sky-400',
            label: 'Launch Flowchart',
            action: () => onNavigate('interactive', 'tool-flowchart'),
          },
          {
            icon: <Terminal size={20} />,
            iconBg: 'bg-pink-500/10 text-pink-400',
            badge: 'Simulator',
            badgeStyle: 'bg-pink-500/10 text-pink-400 border-pink-500/20',
            title: 'API Sandbox Playground',
            desc: 'Post mock transaction payloads, compute VAT and withholding taxes, and track real-time changes inside simulated database records.',
            linkColor: 'text-pink-400',
            label: 'Open Sandbox',
            action: () => onNavigate('interactive', 'tool-sandbox'),
          },
          {
            icon: <Database size={20} />,
            iconBg: 'bg-teal-500/10 text-teal-400',
            badge: 'Data Model',
            badgeStyle: 'bg-teal-500/10 text-teal-400 border-teal-500/20',
            title: 'Database Schemas',
            desc: 'Inspect table models for charts_of_accounts, journal_entries, and subledgers with explicit PK/FK relational mappings.',
            linkColor: 'text-teal-400',
            label: 'Browse Tables',
            action: () => onNavigate('getting-started', 'project-structure'),
          },
          {
            icon: <Settings size={20} />,
            iconBg: 'bg-indigo-500/10 text-indigo-400',
            badge: 'Concept',
            badgeStyle: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
            title: 'Posting Middleware',
            desc: 'Learn how our ledger verifies balancing double-entry transactions during state changes to keep accounts synchronized.',
            linkColor: 'text-indigo-400',
            label: 'Read Core Spec',
            action: () => onNavigate('getting-started', 'auth'),
          },
        ].map((card) => (
          <div
            key={card.title}
            onClick={card.action}
            className="bg-[#121826] border border-slate-800 rounded-2xl p-5 hover:border-sky-500/50 cursor-pointer transition-all flex flex-col justify-between group"
          >
            <div className="space-y-3">
              <div className="flex justify-between items-start">
                <div
                  className={`h-10 w-10 rounded-lg flex items-center justify-center ${card.iconBg}`}
                >
                  {card.icon}
                </div>
                <span
                  className={`text-[9px] px-2 py-0.5 rounded-full font-bold border ${card.badgeStyle}`}
                >
                  {card.badge}
                </span>
              </div>
              <h3 className="text-sm font-bold text-white group-hover:text-sky-400 transition-colors">
                {card.title}
              </h3>
              <p className="text-[11px] text-slate-400 leading-normal">
                {card.desc}
              </p>
            </div>
            <div
              className={`mt-4 pt-3 border-t border-slate-800/60 text-[10px] font-semibold flex items-center gap-1.5 ${card.linkColor}`}
            >
              {card.label} <ArrowRight size={10} />
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-6 pt-6 border-t border-slate-800/80">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold text-white">Latest Update Releases</h2>
          <button
            onClick={() => onNavigate('getting-started', 'project-structure')}
            className="text-xs font-semibold text-sky-400 hover:text-sky-300 flex items-center gap-1.5"
          >
            View File Directories <ArrowRight size={14} />
          </button>
        </div>

        <div className="space-y-8 bg-[#121826]/45 p-6 rounded-2xl border border-slate-800/60">
          <div className="flex gap-4 relative">
            <div className="flex flex-col items-center">
              <div className="h-6 w-6 rounded-full bg-sky-500/15 border-2 border-sky-400 flex items-center justify-center">
                <div className="h-2 w-2 rounded-full bg-sky-400 animate-pulse" />
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
                Refactored financial statement queries to compile reports dynamically
                using optimized General Ledger grouping. Pre-computed VAT inputs and
                withholding credits are verified directly before any state transition
                updates commit.
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
                <span className="px-2 py-0.5 bg-slate-800 text-slate-400 border border-slate-800 rounded text-[9px] font-bold font-mono">
                  v1.1.0
                </span>
              </div>
              <h4 className="text-sm font-bold text-slate-100">
                Immutable Audit Trail Middleware Integration
              </h4>
              <p className="text-xs text-slate-400 max-w-4xl leading-relaxed">
                Added audit tracking modules to Express controller files. Deletion is
                restricted for posted ledger segments, and all status transitions are
                preserved inside JSON-based audit logs for strict accounting
                compliance.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// ARTICLE RENDERER
// ============================================================================

function ArticlePage({ doc }) {
  const [copiedText, setCopiedText] = useState('')

  const handleCopyCode = (codeText) => {
    navigator.clipboard.writeText(codeText)
    setCopiedText('Copied!')
    setTimeout(() => setCopiedText(''), 2000)
  }

  return (
    <article className="prose prose-invert max-w-none">
      <div className="border-b border-slate-800 pb-4">
        <span className="text-xs font-mono font-bold uppercase tracking-widest text-sky-400">
          {doc.eyebrow}
        </span>
        <h2 className="text-3xl font-extrabold text-white mt-1 font-mono">
          {doc.title}
        </h2>
      </div>

      <div className="space-y-6 pt-4 text-slate-300 text-sm leading-relaxed">
        {doc.content.split('###').map((block, bIdx) => {
          if (bIdx === 0 && !block.trim()) return null
          if (bIdx === 0)
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
                        <div className="bg-slate-950 px-4 py-2 border-b border-slate-800 flex justify-between items-center text-[10px] text-slate-400 uppercase">
                          <span>{lang || 'CODE'}</span>
                          <button
                            onClick={() => handleCopyCode(code)}
                            className="text-sky-400 hover:text-sky-300 flex items-center gap-1 text-[9px] font-sans font-semibold"
                          >
                            <Copy size={10} /> {copiedText || 'Copy Code'}
                          </button>
                        </div>
                        <pre className="p-4 overflow-x-auto text-slate-300">
                          <code>{code}</code>
                        </pre>
                      </div>
                    )
                  }
                  return (
                    <p key={cIdx} className="whitespace-pre-line leading-relaxed">
                      {segment}
                    </p>
                  )
                })
              ) : (
                <p className="whitespace-pre-line leading-relaxed">{body}</p>
              )}
            </div>
          )
        })}
      </div>
    </article>
  )
}

// ============================================================================
// NAV ITEMS
// ============================================================================

const NAV_ITEMS = [
  { id: 'welcome', title: 'Welcome & Overview', badge: 'Core' },
  { id: 'project-structure', title: '1. Project Structure', badge: 'Folders' },
  { id: 'auth', title: '2. Authentication & JWT', badge: 'Secure' },
]

// ============================================================================
// GETTING STARTED PAGE (exported)
// ============================================================================

export default function GettingStarted({ onNavigate, selectedDoc = 'welcome' }) {
  const [selectedId, setSelectedId] = useState(selectedDoc)
  const doc = documents.find((d) => d.id === selectedId)

  useEffect(() => {
    setSelectedId(selectedDoc)
  }, [selectedDoc])

  return (
    <main className="flex-grow  max-w-8xl mx-auto w-full overflow-x-hidden">
      {selectedId === 'welcome' ? (
        <WelcomePage onNavigate={onNavigate} />
      ) : (
        doc && <ArticlePage doc={doc} />
      )}
    </main>
  )
}
