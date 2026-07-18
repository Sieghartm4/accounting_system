import React, { useState, useEffect } from 'react'
import {
  Play,
  Pause,
  ChevronRight,
  ChevronLeft,
  Terminal,
  Activity,
  GitBranch,
} from 'lucide-react'
import SandboxTool from './Sandboxtool'

// ============================================================================
// FLOWCHART DATA
// ============================================================================
// Node "type" controls badge color only — kept identical to the original
// palette (input: indigo, cash: emerald, core: blue, report: teal,
// utility: purple, external: slate) so no new colors are introduced.

const nodes = {
  receipt: {
    id: 'receipt',
    label: 'Receipt',
    x: 100,
    y: 70,
    type: 'cash',
    desc: 'Direct cash income entry point. Creates a receipt with line items and supporting attachments, independent of any AR cycle.',
    endpoint: 'POST /receipts',
    creates: ['receipts', 'receipt_items', 'attachments', 'journal_entries'],
    approvalFlow: ['PREPARED', 'CHECKED', 'APPROVED'],
    dbTable: 'receipts / receipt_items',
  },
  cash_disbursement: {
    id: 'cash_disbursement',
    label: 'Cash Disbursement',
    x: 100,
    y: 170,
    type: 'cash',
    desc: 'Direct cash outflow entry point. Creates a disbursement with line items and attachments, and posts straight to the Posting Engine — it never touches Collections.',
    endpoint: 'POST /cash_disbursements',
    creates: [
      'cash_disbursements',
      'cash_disbursement_items',
      'attachments',
      'journal_entries',
    ],
    approvalFlow: ['PREPARED', 'CHECKED', 'APPROVED'],
    dbTable: 'cash_disbursements / cash_disbursement_items',
  },
  sales: {
    id: 'sales',
    label: 'Sales',
    x: 100,
    y: 270,
    type: 'input',
    desc: 'Creates a sales document with line items and attachments. Once fully APPROVED, a Collections document can be raised against it.',
    endpoint: 'POST /sales',
    creates: ['sales', 'sales_items', 'attachments', 'journal_entries'],
    approvalFlow: ['PREPARED', 'CHECKED', 'APPROVED'],
    dbTable: 'sales / sales_items',
  },
  purchase: {
    id: 'purchase',
    label: 'Purchase',
    x: 100,
    y: 370,
    type: 'input',
    desc: 'Creates a vendor purchase document with line items and attachments. Once fully APPROVED, a Payment can be raised against it.',
    endpoint: 'POST /purchase',
    creates: ['purchase', 'purchase_items', 'attachments', 'journal_entries'],
    approvalFlow: ['PREPARED', 'CHECKED', 'APPROVED'],
    dbTable: 'purchase / purchase_items',
  },
  purchase_order: {
    id: 'purchase_order',
    label: 'Purchase Order',
    x: 100,
    y: 470,
    type: 'input',
    desc: 'Created manually or fetched from the Inventory Management System (IMS). Approval decides the settlement path: credit routes to Purchase, cash routes to Cash Disbursement.',
    endpoint: 'POST /purchase_order',
    creates: ['purchase_orders'],
    decision: {
      question: 'Settlement type on approval',
      options: [
        { label: 'CREDIT', outcome: 'redirects & creates Purchase' },
        { label: 'CASH', outcome: 'redirects & creates Cash Disbursement' },
      ],
    },
    dbTable: 'purchase_orders',
  },
  advances: {
    id: 'advances',
    label: 'Advances',
    x: 100,
    y: 570,
    type: 'input',
    desc: 'Fetched from the Budget Management System (BMS). Once APPROVED, redirects into an Adjustment entry.',
    endpoint: 'GET /advances (BMS sync)',
    creates: ['advances'],
    approvalFlow: ['FETCHED (BMS)', 'APPROVED'],
    dbTable: 'advances [BMS synced]',
  },
  collections: {
    id: 'collections',
    label: 'Collections',
    x: 340,
    y: 245,
    type: 'input',
    desc: 'Can only be created against an APPROVED Sales document. Once fully APPROVED, updates that Sale to COLLECTED.',
    endpoint: 'POST /collections',
    creates: ['collections', 'collection_items', 'attachments', 'journal_entries'],
    approvalFlow: ['PREPARED', 'CHECKED', 'APPROVED'],
    statusUpdate: "Sets Sales.status = 'COLLECTED'",
    dbTable: 'collections / collection_items',
  },
  payments: {
    id: 'payments',
    label: 'Payments',
    x: 340,
    y: 345,
    type: 'input',
    desc: 'Can only be created against an APPROVED Purchase document. Once fully APPROVED, updates that Purchase to PAID.',
    endpoint: 'POST /payments',
    creates: ['payments', 'payment_items', 'attachments', 'journal_entries'],
    approvalFlow: ['PREPARED', 'CHECKED', 'APPROVED'],
    statusUpdate: "Sets Purchase.status = 'PAID'",
    dbTable: 'payments / payment_items',
  },
  adjustments: {
    id: 'adjustments',
    label: 'Adjustments',
    x: 340,
    y: 570,
    type: 'core',
    desc: 'Created once an Advance is APPROVED, or entered manually by accountants (accruals, corrections).',
    endpoint: 'POST /adjustments',
    creates: ['adjustments', 'attachments', 'journal_entries'],
    approvalFlow: ['PREPARED', 'CHECKED', 'APPROVED'],
    dbTable: 'adjustments / adjustment_items',
  },
  posting: {
    id: 'posting',
    label: 'Posting Engine',
    x: 560,
    y: 350,
    type: 'core',
    desc: 'Critical processing middleware. Validates DR = CR on every APPROVED document, computes totals, and writes immutable journal entries.',
    endpoint: 'PUT /posting-engine/process',
    creates: ['journal_entries'],
    dbTable: 'Middleware Processing Logic',
  },
  gl: {
    id: 'gl',
    label: 'General Ledger (GL)',
    x: 760,
    y: 350,
    type: 'core',
    desc: 'The single source of truth. Aggregates every posted journal entry line from every source document.',
    endpoint: 'GET /journal_entries',
    creates: ['journal_entries'],
    dbTable: 'journal_entries',
  },
  bankstatement: {
    id: 'bankstatement',
    label: 'Bank Statement',
    x: 760,
    y: 600,
    type: 'external',
    desc: 'Raw external transaction statement sourced from the financial institution, imported for matching.',
    endpoint: 'External Input / Statement Import',
    creates: ['bank_statement_imports'],
    dbTable: 'Uploaded document logs',
  },
  tb: {
    id: 'tb',
    label: 'Trial Balance (TB)',
    x: 960,
    y: 150,
    type: 'report',
    desc: 'Verifies the fundamental accounting rule: total debits equal total credits.',
    endpoint: 'GET /reports/trial-balance',
    creates: [],
    dbTable: 'journal_entries [aggregated]',
  },
  is: {
    id: 'is',
    label: 'Income Statement',
    x: 960,
    y: 250,
    type: 'report',
    desc: 'Calculates operational performance over a period: Revenues − Expenses = Net Income.',
    endpoint: 'GET /reports/income-statement',
    creates: [],
    dbTable: 'journal_entries [filtered Revenue/Expense]',
  },
  bs: {
    id: 'bs',
    label: 'Balance Sheet',
    x: 960,
    y: 350,
    type: 'report',
    desc: 'Represents the fundamental equation: Assets = Liabilities + Equity at an exact point in time.',
    endpoint: 'GET /reports/balance-sheet',
    creates: [],
    dbTable: 'journal_entries [filtered Asset/Liability/Equity]',
  },
  bankrecon: {
    id: 'bankrecon',
    label: 'Bank Reconciliation',
    x: 960,
    y: 460,
    type: 'utility',
    desc: 'Matches internally tracked cash journal records against raw external bank statement items.',
    endpoint: 'GET /bank_reconciliation',
    creates: [
      'bank_reconciliation',
      'bank_reconciliation_items',
      'bank_reconciliation_summary',
    ],
    dbTable: 'bank_reconciliation / items / summary',
  },
}

// `loop: true` marks a "feedback" edge that reports a status update back to
// the originating document (e.g. Collections -> Sales: status COLLECTED).
const connections = [
  { from: 'receipt', to: 'posting', label: 'journal lines' },
  { from: 'cash_disbursement', to: 'posting', label: 'journal lines' },
  { from: 'sales', to: 'posting', label: 'journal lines' },
  { from: 'sales', to: 'collections', label: 'if APPROVED' },
  { from: 'collections', to: 'posting', label: 'journal lines' },
  { from: 'collections', to: 'sales', label: 'status → COLLECTED', loop: true },
  { from: 'purchase', to: 'posting', label: 'journal lines' },
  { from: 'purchase', to: 'payments', label: 'if APPROVED' },
  { from: 'payments', to: 'posting', label: 'journal lines' },
  { from: 'payments', to: 'purchase', label: 'status → PAID', loop: true },
  {
    from: 'purchase_order',
    to: 'purchase',
    label: 'CREDIT · redirect',
    sameColumn: true,
  },
  {
    from: 'purchase_order',
    to: 'cash_disbursement',
    label: 'CASH · redirect',
    sameColumn: true,
  },
  { from: 'advances', to: 'adjustments', label: 'if APPROVED' },
  { from: 'adjustments', to: 'posting', label: 'journal lines' },
  { from: 'posting', to: 'gl', label: 'posts to' },
  { from: 'gl', to: 'tb', label: 'balances' },
  { from: 'gl', to: 'is', label: 'revenue/expense' },
  { from: 'gl', to: 'bs', label: 'ending values' },
  { from: 'gl', to: 'bankrecon', label: 'cash ledger' },
  { from: 'bankstatement', to: 'bankrecon', label: 'external matches' },
]

const scenarioFlows = {
  sales_cycle: {
    name: 'Sales to Collections Cycle',
    nodes: ['sales', 'posting', 'gl', 'collections', 'tb', 'is', 'bs'],
    edges: [
      { from: 'sales', to: 'posting' },
      { from: 'posting', to: 'gl' },
      { from: 'sales', to: 'collections' },
      { from: 'collections', to: 'posting' },
      { from: 'collections', to: 'sales' },
      { from: 'gl', to: 'tb' },
      { from: 'gl', to: 'is' },
      { from: 'gl', to: 'bs' },
    ],
    explanation: [
      'Step 1: A Sales document is created — sales, sales_items, and attachments are written, starting in state PREPARED.',
      'Step 2: The document moves PREPARED → CHECKED → APPROVED. Only on APPROVED do journal lines reach the Posting Engine.',
      'Step 3: The Posting Engine validates DR = CR and writes the entries to the General Ledger (journal_entries).',
      'Step 4: Because the Sale is APPROVED, a Collections document can now be created against it.',
      'Step 5: Collections runs its own PREPARED → CHECKED → APPROVED cycle, posting its own journal lines through the same engine.',
      "Step 6: Once Collections is APPROVED, it updates the originating Sale's status to COLLECTED — the GL feeds the Trial Balance, Income Statement, and Balance Sheet in real time.",
    ],
  },
  purchase_cycle: {
    name: 'Purchase to Payment Cycle',
    nodes: ['purchase', 'posting', 'gl', 'payments', 'tb', 'is', 'bs'],
    edges: [
      { from: 'purchase', to: 'posting' },
      { from: 'posting', to: 'gl' },
      { from: 'purchase', to: 'payments' },
      { from: 'payments', to: 'posting' },
      { from: 'payments', to: 'purchase' },
      { from: 'gl', to: 'tb' },
      { from: 'gl', to: 'is' },
      { from: 'gl', to: 'bs' },
    ],
    explanation: [
      'Step 1: A Purchase document is created — purchase, purchase_items, and attachments are written, starting in state PREPARED.',
      'Step 2: The document moves PREPARED → CHECKED → APPROVED, releasing its journal lines to the Posting Engine.',
      'Step 3: The Posting Engine validates and writes the approved entries to the General Ledger.',
      'Step 4: Because the Purchase is APPROVED, a Payment can now be created against it.',
      'Step 5: Payments runs its own PREPARED → CHECKED → APPROVED cycle before posting.',
      "Step 6: Once Payments is APPROVED, it updates the originating Purchase's status to PAID, and the reports refresh accordingly.",
    ],
  },
  direct_cash_cycle: {
    name: 'Direct Cash Flows',
    nodes: ['receipt', 'cash_disbursement', 'posting', 'gl', 'tb', 'is', 'bs'],
    edges: [
      { from: 'receipt', to: 'posting' },
      { from: 'cash_disbursement', to: 'posting' },
      { from: 'posting', to: 'gl' },
      { from: 'gl', to: 'tb' },
      { from: 'gl', to: 'is' },
      { from: 'gl', to: 'bs' },
    ],
    explanation: [
      'Receipts and Cash Disbursements both bypass Sales/Collections and Purchase/Payments entirely.',
      'Each still runs its own PREPARED → CHECKED → APPROVED workflow before releasing journal lines.',
      'Cash Disbursement posts straight to the Posting Engine — it is never linked to Collections.',
      'On APPROVED, the engine commits entries to journal_entries, instantly updating every report panel.',
    ],
  },
  purchase_order_cycle: {
    name: 'Purchase Order Routing',
    nodes: ['purchase_order', 'purchase', 'cash_disbursement', 'posting', 'gl'],
    edges: [
      { from: 'purchase_order', to: 'purchase' },
      { from: 'purchase_order', to: 'cash_disbursement' },
      { from: 'purchase', to: 'posting' },
      { from: 'cash_disbursement', to: 'posting' },
      { from: 'posting', to: 'gl' },
    ],
    explanation: [
      'Step 1: A Purchase Order is created manually, or fetched directly from the IMS.',
      'Step 2: Approval requires a settlement decision — CREDIT or CASH.',
      'Step 3a: CREDIT redirects and creates a new Purchase document, entering the standard Purchase → Payment cycle.',
      'Step 3b: CASH redirects and creates a new Cash Disbursement instead, skipping the AP cycle entirely.',
      'Step 4: Either path eventually reaches the Posting Engine and the General Ledger through its own approval flow.',
    ],
  },
  advances_cycle: {
    name: 'Advances to Adjustments',
    nodes: ['advances', 'adjustments', 'posting', 'gl', 'tb', 'is', 'bs'],
    edges: [
      { from: 'advances', to: 'adjustments' },
      { from: 'adjustments', to: 'posting' },
      { from: 'posting', to: 'gl' },
      { from: 'gl', to: 'tb' },
      { from: 'gl', to: 'is' },
      { from: 'gl', to: 'bs' },
    ],
    explanation: [
      'Step 1: An Advance is fetched from the Budget Management System (BMS).',
      'Step 2: Once the Advance is APPROVED, it redirects into a new Adjustment entry.',
      'Step 3: The Adjustment runs its own PREPARED → CHECKED → APPROVED cycle, then posts journal lines.',
      'Step 4: The Posting Engine writes the entries to the General Ledger, refreshing every downstream report.',
    ],
  },
  bank_recon_cycle: {
    name: 'Bank Reconciliation',
    nodes: ['gl', 'bankrecon', 'bankstatement'],
    edges: [
      { from: 'gl', to: 'bankrecon' },
      { from: 'bankstatement', to: 'bankrecon' },
    ],
    explanation: [
      'Step 1: The General Ledger supplies every internally recorded cash movement (Receipts, Disbursements, Collections, Payments).',
      'Step 2: A raw Bank Statement is imported as an external, unedited record of what actually cleared the bank.',
      'Step 3: Bank Reconciliation matches the two sources line by line, writing bank_reconciliation, its items, and a summary.',
      'Step 4: Unmatched items surface as reconciling differences for accountants to investigate.',
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
          Trace source documents, PREPARED → CHECKED → APPROVED workflows, redirect
          logic, and General Ledger fan-out through real-time path simulations.
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
        <div className="xl:col-span-8 bg-[#0c1220] border border-slate-800 rounded-2xl p-4 flex justify-center items-center overflow-auto min-h-[560px] relative">
          <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1.5px,transparent_1.5px)] [background-size:20px_20px] opacity-35 pointer-events-none" />
          <svg
            viewBox="0 0 1060 700"
            className="w-full max-w-[1060px] aspect-[1060/700] z-10 select-none relative"
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

              const pathData = conn.sameColumn
                ? `M ${origin.x} ${origin.y} C ${origin.x - 90} ${origin.y}, ${origin.x - 90} ${dest.y}, ${dest.x} ${dest.y}`
                : `M ${origin.x} ${origin.y} C ${origin.x + deltaX * 0.45} ${origin.y}, ${origin.x + deltaX * 0.55} ${dest.y}, ${dest.x} ${dest.y}`

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
                    strokeDasharray={conn.loop ? '2,4' : undefined}
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
                      x={(origin.x + dest.x) / 2 - 65}
                      y={(origin.y + dest.y) / 2 - 12}
                      width="130"
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

          {selectedNode.creates?.length > 0 && (
            <div className="space-y-2">
              <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider block">
                RECORDS CREATED
              </span>
              <div className="flex flex-wrap gap-1.5">
                {selectedNode.creates.map((table) => (
                  <span
                    key={table}
                    className="text-[10px] font-mono px-2 py-1 rounded bg-slate-950 border border-slate-800 text-slate-300"
                  >
                    {table}
                  </span>
                ))}
              </div>
            </div>
          )}

          {selectedNode.approvalFlow && (
            <div className="space-y-2">
              <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider block">
                APPROVAL WORKFLOW
              </span>
              <div className="flex items-center flex-wrap gap-1.5">
                {selectedNode.approvalFlow.map((step, i) => (
                  <React.Fragment key={step}>
                    <span className="text-[10px] font-mono font-bold px-2 py-1 rounded bg-sky-500/10 border border-sky-500/40 text-sky-400">
                      {step}
                    </span>
                    {i < selectedNode.approvalFlow.length - 1 && (
                      <ChevronRight size={11} className="text-slate-600" />
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>
          )}

          {selectedNode.decision && (
            <div className="space-y-2">
              <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <GitBranch size={11} /> {selectedNode.decision.question}
              </span>
              <div className="bg-slate-950 rounded-lg p-3 space-y-2 border border-slate-800">
                {selectedNode.decision.options.map((opt) => (
                  <div
                    key={opt.label}
                    className="text-[11px] border-l-2 border-amber-400 pl-2"
                  >
                    <span className="font-bold text-amber-400 block">
                      {opt.label}
                    </span>
                    <span className="text-[10px] text-slate-400">{opt.outcome}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {selectedNode.statusUpdate && (
            <div className="space-y-1">
              <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider block">
                ON FINAL APPROVAL
              </span>
              <span className="text-[11px] font-mono bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-2.5 py-1.5 rounded block">
                {selectedNode.statusUpdate}
              </span>
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
