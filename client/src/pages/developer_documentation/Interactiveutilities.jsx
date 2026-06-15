import React, { useState, useEffect, useMemo } from 'react'
import {
  Play,
  Pause,
  ChevronRight,
  ChevronLeft,
  Terminal,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Code,
  Activity,
} from 'lucide-react'

// ============================================================================
// FLOWCHART DATA
// ============================================================================

const nodes = {
  sales: {
    id: 'sales',
    label: 'Sales Invoice',
    x: 100,
    y: 110,
    type: 'input',
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
    dbTable: 'sales / sales_items',
  },
  collections: {
    id: 'collections',
    label: 'Collections',
    x: 100,
    y: 220,
    type: 'input',
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
    dbTable: 'collections / collection_items',
  },
  arsub: {
    id: 'arsub',
    label: 'AR Subledger',
    x: 300,
    y: 165,
    type: 'subledger',
    desc: 'Tracks individual customer invoices, payments, and outstanding aging balances.',
    endpoint: 'GET /customers/:id',
    debits: [
      { account: 'Customer Balance (Debit)', desc: 'Tracks running owed amounts' },
    ],
    credits: [],
    dbTable: 'customers',
  },
  purchase: {
    id: 'purchase',
    label: 'Purchase Invoice',
    x: 100,
    y: 350,
    type: 'input',
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
    dbTable: 'purchase / purchase_items',
  },
  payments: {
    id: 'payments',
    label: 'Vendor Payments',
    x: 100,
    y: 460,
    type: 'input',
    desc: 'Disburses company cash to reduce outstanding accounts payable.',
    endpoint: 'POST /payments',
    debits: [
      {
        account: '2000 - Accounts Payable',
        desc: 'Reduces outstanding liability to vendor',
      },
    ],
    credits: [{ account: '1000 - Cash in Bank', desc: 'Reduces cash holdings' }],
    dbTable: 'payments / payment_items',
  },
  apsub: {
    id: 'apsub',
    label: 'AP Subledger',
    x: 300,
    y: 405,
    type: 'subledger',
    desc: 'Tracks individual vendor liabilities, aging schedules, and payment obligations.',
    endpoint: 'GET /vendor/:id',
    debits: [],
    credits: [
      { account: 'Vendor Liability (Credit)', desc: 'Tracks running owed amounts' },
    ],
    dbTable: 'vendors',
  },
  receipts: {
    id: 'receipts',
    label: 'Direct Receipts',
    x: 300,
    y: 260,
    type: 'cash',
    desc: 'Direct cash income bypassing the invoice/AR cycle.',
    endpoint: 'POST /receipt',
    debits: [{ account: '1000 - Cash in Bank', desc: 'Direct cash increase' }],
    credits: [
      {
        account: '4500+ - Non-Operating Revenue',
        desc: 'Direct revenue stream recognition',
      },
    ],
    dbTable: 'receipts',
  },
  disbursements: {
    id: 'disbursements',
    label: 'Direct Disbursements',
    x: 300,
    y: 510,
    type: 'cash',
    desc: 'Instant cash outflows bypassing the purchase/AP cycle.',
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
    dbTable: 'cash_disbursements',
  },
  adjustments: {
    id: 'adjustments',
    label: 'Adjustments / JEs',
    x: 300,
    y: 590,
    type: 'core',
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
    dbTable: 'adjustments / adjustment_items',
  },
  posting: {
    id: 'posting',
    label: 'Posting Engine',
    x: 520,
    y: 350,
    type: 'core',
    desc: 'Critical processing middleware. Validates DR=CR transactions, computes totals, and writes immutable records.',
    endpoint: 'PUT /sales/sales-state',
    debits: [],
    credits: [],
    dbTable: 'Middleware Processing Logic',
  },
  audit: {
    id: 'audit',
    label: 'Audit Trail Ledger',
    x: 520,
    y: 500,
    type: 'utility',
    desc: 'Irreversible tamper-proof records of every completed accounting state update.',
    endpoint: 'GET /audit_trail',
    debits: [],
    credits: [],
    dbTable: 'audit_trail',
  },
  gl: {
    id: 'gl',
    label: 'General Ledger (GL)',
    x: 720,
    y: 350,
    type: 'core',
    desc: 'The Single Source of Truth. Aggregates all validated transaction lines as journal entries.',
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
    dbTable: 'journal_entries',
  },
  tb: {
    id: 'tb',
    label: 'Trial Balance (TB)',
    x: 920,
    y: 165,
    type: 'report',
    desc: 'Verifies the ultimate accounting rule: sum of all debits equals sum of all credits.',
    endpoint: 'GET /reports/trial-balance',
    debits: [],
    credits: [],
    dbTable: 'journal_entries [aggregated]',
  },
  is: {
    id: 'is',
    label: 'Income Statement',
    x: 920,
    y: 260,
    type: 'report',
    desc: 'Calculates operational performance over a period: Revenues - Expenses = Net Income.',
    endpoint: 'GET /reports/income-statement',
    debits: [],
    credits: [],
    dbTable: 'journal_entries [filtered Revenue/Expense]',
  },
  bs: {
    id: 'bs',
    label: 'Balance Sheet',
    x: 920,
    y: 350,
    type: 'report',
    desc: 'Represents the fundamental equation: Assets = Liabilities + Equity at an exact point in time.',
    endpoint: 'GET /reports/balance-sheet',
    debits: [],
    credits: [],
    dbTable: 'journal_entries [filtered Asset/Liability/Equity]',
  },
  bankrecon: {
    id: 'bankrecon',
    label: 'Bank Reconciliation',
    x: 920,
    y: 500,
    type: 'utility',
    desc: 'Matches internally tracked cash journal records against raw external bank statement items.',
    endpoint: 'GET /bank_reconciliation',
    debits: [],
    credits: [],
    dbTable: 'bank_reconciliation / bank_reconciliation_items',
  },
  bankstatement: {
    id: 'bankstatement',
    label: 'Bank Statement',
    x: 720,
    y: 590,
    type: 'external',
    desc: 'Raw external transaction statement sourced from actual financial institutions.',
    endpoint: 'External Input / Statement Import',
    debits: [],
    credits: [],
    dbTable: 'Uploaded document logs',
  },
}

const connections = [
  { from: 'sales', to: 'arsub', label: 'creates' },
  { from: 'sales', to: 'posting', label: 'journal lines' },
  { from: 'collections', to: 'arsub', label: 'applies to' },
  { from: 'collections', to: 'posting', label: 'journal lines' },
  { from: 'arsub', to: 'gl', label: 'posting updates' },
  { from: 'purchase', to: 'apsub', label: 'creates' },
  { from: 'purchase', to: 'posting', label: 'journal lines' },
  { from: 'payments', to: 'apsub', label: 'applies to' },
  { from: 'payments', to: 'posting', label: 'journal lines' },
  { from: 'apsub', to: 'gl', label: 'posting updates' },
  { from: 'receipts', to: 'posting', label: 'journal lines' },
  { from: 'disbursements', to: 'posting', label: 'journal lines' },
  { from: 'adjustments', to: 'posting', label: 'journal lines' },
  { from: 'posting', to: 'gl', label: 'posts to' },
  { from: 'posting', to: 'audit', label: 'writes' },
  { from: 'gl', to: 'tb', label: 'balances' },
  { from: 'gl', to: 'is', label: 'revenues/expenses' },
  { from: 'gl', to: 'bs', label: 'ending values' },
  { from: 'gl', to: 'bankrecon', label: 'cash ledger' },
  { from: 'bankstatement', to: 'bankrecon', label: 'external matches' },
]

const scenarioFlows = {
  sales_cycle: {
    name: 'Sales to Collections Cycle',
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
    name: 'Direct Cash Flows',
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
    name: 'Trial Balance & Reports',
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

// ============================================================================
// FLOWCHART TOOL
// ============================================================================

function FlowchartTool() {
  const [selectedNodeId, setSelectedNodeId] = useState('sales')
  const [activeScenario, setActiveScenario] = useState('sales_cycle')
  const [isPlaying, setIsPlaying] = useState(true)
  const [stepIndex, setStepIndex] = useState(0)

  const scenario = scenarioFlows[activeScenario]
  const selectedNode = nodes[selectedNodeId] || nodes.sales

  const isNodeHighlighted = (id) => scenario.nodes.includes(id)
  const isConnectionHighlighted = (from, to) =>
    scenario.edges.some((e) => e.from === from && e.to === to)

  useEffect(() => {
    if (!isPlaying) return
    const interval = setInterval(() => {
      setStepIndex((prev) => (prev + 1) % scenario.explanation.length)
    }, 5500)
    return () => clearInterval(interval)
  }, [isPlaying, activeScenario])

  const handleScenarioChange = (key) => {
    setActiveScenario(key)
    setStepIndex(0)
  }

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-800 pb-4">
        <span className="text-xs font-mono font-bold uppercase tracking-widest text-sky-400">
          DEVELOPER UTILITY ENGINE
        </span>
        <h2 className="text-3xl font-extrabold text-white mt-1">
          Interactive System Flowchart Map
        </h2>
        <p className="text-sm text-slate-400 mt-2">
          Trace subledgers, posting validations, database tables, and dual general
          ledger updates through real-time path simulations.
        </p>
      </div>

      {/* Scenario bar */}
      <div className="bg-[#121826] border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-1">
          <span className="text-[10px] uppercase font-bold text-sky-400 tracking-widest block font-mono">
            ACTIVE TRACE WALKTHROUGH
          </span>
          <h3 className="text-sm font-bold text-white">
            Scenario Path: <span className="text-sky-400">{scenario.name}</span>
          </h3>
          <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
            {scenario.explanation[stepIndex]}
          </p>
        </div>

        <div className="flex items-center gap-3 bg-slate-950 p-2.5 rounded-xl border border-slate-800 shrink-0">
          <button
            onClick={() =>
              setStepIndex(
                (prev) =>
                  (prev - 1 + scenario.explanation.length) %
                  scenario.explanation.length,
              )
            }
            className="p-1 text-slate-400 hover:text-white hover:bg-slate-900 rounded transition-colors"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="bg-sky-500 hover:bg-sky-400 text-slate-950 p-1.5 rounded-full transition-all"
          >
            {isPlaying ? (
              <Pause size={14} fill="currentColor" />
            ) : (
              <Play size={14} fill="currentColor" />
            )}
          </button>
          <button
            onClick={() =>
              setStepIndex((prev) => (prev + 1) % scenario.explanation.length)
            }
            className="p-1 text-slate-400 hover:text-white hover:bg-slate-900 rounded transition-colors"
          >
            <ChevronRight size={16} />
          </button>
          <span className="text-xs font-mono text-slate-400 border-l border-slate-800 pl-3">
            {stepIndex + 1}/{scenario.explanation.length}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* SVG Diagram */}
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

            {connections.map((conn, idx) => {
              const origin = nodes[conn.from]
              const dest = nodes[conn.to]
              if (!origin || !dest) return null
              const isHighlighted = isConnectionHighlighted(conn.from, conn.to)
              const deltaX = dest.x - origin.x
              const pathData = `M ${origin.x} ${origin.y} C ${origin.x + deltaX * 0.45} ${origin.y}, ${origin.x + deltaX * 0.55} ${dest.y}, ${dest.x} ${dest.y}`

              return (
                <g key={idx}>
                  <path
                    d={pathData}
                    fill="none"
                    stroke="transparent"
                    strokeWidth="16"
                    className="cursor-pointer"
                    onClick={() => setSelectedNodeId(conn.from)}
                  />
                  <path
                    d={pathData}
                    fill="none"
                    stroke={isHighlighted ? '#06b6d4' : '#1e293b'}
                    strokeWidth={isHighlighted ? '3' : '2'}
                    markerEnd={isHighlighted ? 'url(#arrow-active)' : 'url(#arrow)'}
                    className="transition-all duration-300"
                  />
                  {isHighlighted && isPlaying && (
                    <path
                      d={pathData}
                      fill="none"
                      stroke="#22d3ee"
                      strokeWidth="3"
                      strokeDasharray="6,8"
                      style={{ animation: 'flowDash 0.8s linear infinite' }}
                    />
                  )}
                  {isHighlighted && (
                    <foreignObject
                      x={(origin.x + dest.x) / 2 - 55}
                      y={(origin.y + dest.y) / 2 - 12}
                      width="110"
                      height="24"
                    >
                      <div className="text-[9px] text-center font-bold font-mono text-cyan-400 bg-[#080d1a] border border-cyan-500/30 px-1 py-0.5 rounded shadow-lg truncate">
                        {conn.label}
                      </div>
                    </foreignObject>
                  )}
                </g>
              )
            })}

            {Object.keys(nodes).map((key) => {
              const node = nodes[key]
              const isSelected = selectedNodeId === key
              const isActive = isNodeHighlighted(key)
              const typeBadgeColor =
                {
                  input: 'text-indigo-400',
                  subledger: 'text-cyan-400',
                  core: 'text-blue-400',
                  report: 'text-teal-400',
                  cash: 'text-emerald-400',
                  utility: 'text-purple-400',
                  external: 'text-slate-500',
                }[node.type] || 'text-slate-500'

              return (
                <g
                  key={key}
                  transform={`translate(${node.x - 75}, ${node.y - 32})`}
                  className="cursor-pointer"
                  onClick={() => setSelectedNodeId(key)}
                >
                  {isActive && (
                    <rect
                      width="150"
                      height="64"
                      rx="10"
                      className="fill-none stroke-sky-500/20 stroke-[5px] blur-md"
                    />
                  )}
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
                    className={`fill-slate-900 stroke-[1.5px] transition-colors ${isSelected ? 'stroke-amber-400' : isActive ? 'stroke-sky-500' : 'stroke-slate-800'}`}
                  />
                  <circle
                    cx="15"
                    cy="18"
                    r="4"
                    className={isActive ? 'fill-sky-400' : 'fill-slate-700'}
                    style={isActive ? { animation: 'pulse 2s infinite' } : {}}
                  />
                  <text
                    x="135"
                    y="18"
                    textAnchor="end"
                    className={`text-[8px] font-bold font-mono tracking-widest uppercase fill-current ${typeBadgeColor}`}
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

        {/* Node Inspector */}
        <div className="xl:col-span-4 bg-[#121826] border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="border-b border-slate-800 pb-2">
            <span className="text-[10px] font-mono tracking-wider font-bold text-sky-400 uppercase block">
              NODE INSPECTOR
            </span>
            <h4 className="text-base font-bold text-white mt-1">
              {selectedNode.label}
            </h4>
          </div>

          <p className="text-xs text-slate-300 bg-slate-950/80 p-3 rounded-lg border border-slate-800 leading-relaxed italic">
            "{selectedNode.desc}"
          </p>

          <div className="text-xs space-y-1">
            <span className="text-[10px] font-bold text-slate-500 uppercase font-mono block">
              DB TARGETS
            </span>
            <span className="font-mono bg-slate-950 px-2.5 py-1 rounded text-cyan-400 block border border-slate-800">
              {selectedNode.dbTable}
            </span>
          </div>

          {(selectedNode.debits?.length > 0 || selectedNode.credits?.length > 0) && (
            <div className="space-y-3 pt-2">
              <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider block">
                LEDGER POSTING SETUP
              </span>
              <div className="bg-slate-950 rounded-lg p-3 space-y-3 border border-slate-800">
                <div>
                  <span className="text-[8px] font-bold font-mono text-emerald-400 block uppercase tracking-wider mb-1">
                    DEBIT SIDE (DR)
                  </span>
                  {selectedNode.debits?.length > 0 ? (
                    selectedNode.debits.map((d, i) => (
                      <div
                        key={i}
                        className="text-[11px] border-l-2 border-emerald-500 pl-2"
                      >
                        <span className="font-bold text-slate-200 block">
                          {d.account}
                        </span>
                        <span className="text-[10px] text-slate-500">{d.desc}</span>
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
                  {selectedNode.credits?.length > 0 ? (
                    selectedNode.credits.map((c, i) => (
                      <div
                        key={i}
                        className="text-[11px] border-l-2 border-rose-500 pl-2"
                      >
                        <span className="font-bold text-slate-200 block">
                          {c.account}
                        </span>
                        <span className="text-[10px] text-slate-500">{c.desc}</span>
                      </div>
                    ))
                  ) : (
                    <span className="text-[10px] text-slate-500 pl-2 block">
                      No credit lines for this node
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

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
                      : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
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
  )
}

// ============================================================================
// SANDBOX TOOL
// ============================================================================

function SandboxTool() {
  const [traceStep, setTraceStep] = useState(0)
  const [sandboxQty, setSandboxQty] = useState(12)
  const [sandboxPrice, setSandboxPrice] = useState(150)
  const [sandboxVatRate, setSandboxVatRate] = useState(12)
  const [sandboxWhtRate, setSandboxWhtRate] = useState(3)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [sandboxResponse, setSandboxResponse] = useState(null)

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
      setTraceStep(1)
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
            coa_code: '1100',
            coa_name: 'Accounts Receivable',
            amount: computedNet.toFixed(2),
          },
          {
            type: 'CREDIT',
            coa_code: '4000',
            coa_name: 'Sales Revenue',
            amount: computedGross.toFixed(2),
          },
          {
            type: 'CREDIT',
            coa_code: '2150',
            coa_name: 'VAT Payable',
            amount: computedVat.toFixed(2),
          },
          {
            type: 'DEBIT',
            coa_code: '1150',
            coa_name: 'Withholding Taxes Asset',
            amount: computedWht.toFixed(2),
          },
        ],
        db_operations: [
          `UPDATE sales SET state = 'APPROVED' WHERE id = ${prev.data.invoice_id}`,
          `INSERT INTO journal_entries (db_name, db_id, coa_id, type, amount) VALUES ('SALES', ${prev.data.invoice_id}, 11, 'DEBIT', ${computedNet.toFixed(2)})`,
          `INSERT INTO journal_entries (db_name, db_id, coa_id, type, amount) VALUES ('SALES', ${prev.data.invoice_id}, 45, 'CREDIT', ${computedGross.toFixed(2)})`,
          `INSERT INTO journal_entries (db_name, db_id, coa_id, type, amount) VALUES ('SALES', ${prev.data.invoice_id}, 25, 'CREDIT', ${computedVat.toFixed(2)})`,
          `INSERT INTO journal_entries (db_name, db_id, coa_id, type, amount) VALUES ('SALES', ${prev.data.invoice_id}, 15, 'DEBIT', ${computedWht.toFixed(2)})`,
        ],
      },
    }))
    setTraceStep(2)
  }

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-800 pb-4">
        <span className="text-xs font-mono font-bold uppercase tracking-widest text-sky-400">
          INTERACTIVE SANDBOX ENVIRONMENT
        </span>
        <h2 className="text-3xl font-extrabold text-white mt-1">
          Live Endpoint Playground
        </h2>
        <p className="text-sm text-slate-400 mt-2">
          Simulate live transactional postings. Adjust quantities, values, or tax
          rates to verify calculations, dynamic SQL outputs, and balancing general
          ledger offsets.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Controls */}
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
            {[
              {
                label: 'Bill Quantity',
                value: sandboxQty,
                setter: setSandboxQty,
                min: 1,
              },
              {
                label: 'Unit Price ($)',
                value: sandboxPrice,
                setter: setSandboxPrice,
                min: 1,
              },
              {
                label: 'VAT Percentage (%)',
                value: sandboxVatRate,
                setter: setSandboxVatRate,
                min: 0,
              },
              {
                label: 'WHT Deduct (%)',
                value: sandboxWhtRate,
                setter: setSandboxWhtRate,
                min: 0,
              },
            ].map(({ label, value, setter, min }) => (
              <div key={label} className="space-y-1">
                <label className="text-slate-400 block font-semibold">{label}</label>
                <input
                  type="number"
                  value={value}
                  onChange={(e) =>
                    setter(Math.max(min, parseInt(e.target.value) || 0))
                  }
                  className="w-full p-2 bg-slate-950 border border-slate-800 rounded text-slate-200 font-mono text-xs"
                />
              </div>
            ))}
          </div>

          <div className="bg-slate-950 rounded-lg p-3 border border-slate-800 font-mono text-[11px] space-y-2">
            {[
              { label: 'Gross Goods:', value: `$${computedGross.toFixed(2)}` },
              { label: 'VAT Total (+):', value: `$${computedVat.toFixed(2)}` },
              { label: 'Withholding (-):', value: `$${computedWht.toFixed(2)}` },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between">
                <span className="text-slate-500">{label}</span>
                <span className="font-bold text-slate-300">{value}</span>
              </div>
            ))}
            <div className="border-t border-slate-900" />
            <div className="flex justify-between text-xs text-sky-400 font-bold">
              <span>Total Invoice Due:</span>
              <span>${computedNet.toFixed(2)}</span>
            </div>
          </div>

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

          {traceStep > 0 && (
            <button
              onClick={() => {
                setTraceStep(0)
                setSandboxResponse(null)
              }}
              className="w-full py-1.5 bg-slate-950 hover:bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-all text-xs font-mono rounded"
            >
              Clear Playground
            </button>
          )}
        </div>

        {/* Response Console */}
        <div className="lg:col-span-8 bg-[#121826] border border-slate-800 rounded-xl p-5 flex flex-col justify-between min-h-[420px]">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h4 className="text-xs font-bold text-slate-200 tracking-widest uppercase flex items-center gap-2 font-mono">
                <Terminal size={14} className="text-sky-400" /> API RESPONSE CONSOLE
              </h4>
              <span className="text-[10px] font-mono text-slate-500">
                {sandboxResponse ? 'Status: 201 Created' : 'Idle'}
              </span>
            </div>

            {sandboxResponse ? (
              <div className="space-y-4 font-mono text-xs">
                <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 text-emerald-400 overflow-x-auto">
                  <pre>
                    <code>{JSON.stringify(sandboxResponse, null, 2)}</code>
                  </pre>
                </div>
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block font-mono">
                    Simulated DB Write Statements
                  </span>
                  <div className="bg-slate-950/80 p-3 rounded border border-slate-800 text-slate-300 text-[11px] leading-relaxed">
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
                  Configure your quantities and rates on the left parameter block and
                  click "POST Draft" to inspect database operations.
                </p>
              </div>
            )}
          </div>

          {traceStep === 1 && (
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 mt-4 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="space-y-1 text-xs text-slate-300">
                <span className="font-bold text-amber-400 flex items-center gap-1">
                  <AlertTriangle size={12} /> Double Entry Pending Verification
                </span>
                <p className="text-[11px] leading-relaxed">
                  Your draft has successfully saved, but has not yet posted any
                  ledger entries. Trigger approval state-change to post double entry.
                </p>
              </div>
              <button
                onClick={triggerSandboxApprove}
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-lg shrink-0 shadow-lg flex items-center gap-1"
              >
                <CheckCircle2 size={12} /> Approve and Post
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// NAV ITEMS
// ============================================================================

const NAV_ITEMS = [
  {
    id: 'tool-flowchart',
    title: 'Interactive Flowchart Map',
    badge: 'Flow',
    icon: <Activity size={12} />,
  },
  {
    id: 'tool-sandbox',
    title: 'Live Sandbox Playground',
    badge: 'Simulator',
    icon: <Terminal size={12} />,
  },
]

// ============================================================================
// INTERACTIVE UTILITIES PAGE (exported)
// ============================================================================

export default function InteractiveUtilities({ defaultTool = 'tool-flowchart' }) {
  const [selectedId, setSelectedId] = useState(defaultTool)

  useEffect(() => {
    setSelectedId(defaultTool)
  }, [defaultTool])

  return (
    <main className="flex-grow  max-w-8xl mx-auto w-full overflow-x-hidden">
      {selectedId === 'tool-flowchart' && <FlowchartTool />}
      {selectedId === 'tool-sandbox' && <SandboxTool />}
    </main>
  )
}
