import React, { useState, useMemo } from 'react'
import {
  Terminal,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Code,
} from 'lucide-react'

// ============================================================================
// SANDBOX TOOL
// Live endpoint playground: simulates POST /sales -> PENDING -> APPROVED
// so engineers can see the computed totals and the double-entry journal
// lines that the Posting Engine would generate.
// ============================================================================

export default function SandboxTool() {
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
        message: "Sales document recorded under 'PREPARED' state in DB.",
        timestamp: '2026-07-18T09:15:00Z',
        data: {
          sales_id: Math.floor(Math.random() * 900) + 101,
          document_reference: 'SALES-2026-MOCK',
          gross_amount: computedGross.toFixed(2),
          calculated_vat: computedVat.toFixed(2),
          withholding_tax_withheld: computedWht.toFixed(2),
          total_receivable_due: computedNet.toFixed(2),
          state: 'PREPARED',
          db_operations: [
            `INSERT INTO sales (customer_id, doc_ref, total_amount_due, state) VALUES (5, 'SALES-2026-MOCK', ${computedNet.toFixed(2)}, 'PREPARED')`,
            `INSERT INTO sales_items (product_service, gross, vat, wht, net) VALUES (12, ${computedGross.toFixed(2)}, ${computedVat.toFixed(2)}, ${computedWht.toFixed(2)}, ${computedNet.toFixed(2)})`,
            `INSERT INTO attachments (doc_type, doc_id, file_ref) VALUES ('sales', LAST_INSERT_ID(), 'mock-support-doc.pdf')`,
          ],
          system_message:
            "Only 'APPROVED' transactions generate journal entries and reach the Posting Engine.",
        },
      })
      setIsSubmitting(false)
      setTraceStep(1)
    }, 1000)
  }

  const advanceApproval = () => {
    if (!sandboxResponse) return
    setSandboxResponse((prev) => {
      const nextState = prev.data.state === 'PREPARED' ? 'CHECKED' : 'APPROVED'
      const isFinal = nextState === 'APPROVED'
      return {
        ...prev,
        message: isFinal
          ? 'Sales APPROVED. Double entry posted successfully to the General Ledger.'
          : `Sales moved to '${nextState}'. Awaiting next approval step.`,
        data: {
          ...prev.data,
          state: nextState,
          ...(isFinal
            ? {
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
                  `UPDATE sales SET state = 'APPROVED' WHERE id = ${prev.data.sales_id}`,
                  `INSERT INTO journal_entries (db_name, db_id, coa_id, type, amount) VALUES ('SALES', ${prev.data.sales_id}, 11, 'DEBIT', ${computedNet.toFixed(2)})`,
                  `INSERT INTO journal_entries (db_name, db_id, coa_id, type, amount) VALUES ('SALES', ${prev.data.sales_id}, 45, 'CREDIT', ${computedGross.toFixed(2)})`,
                  `INSERT INTO journal_entries (db_name, db_id, coa_id, type, amount) VALUES ('SALES', ${prev.data.sales_id}, 25, 'CREDIT', ${computedVat.toFixed(2)})`,
                  `INSERT INTO journal_entries (db_name, db_id, coa_id, type, amount) VALUES ('SALES', ${prev.data.sales_id}, 15, 'DEBIT', ${computedWht.toFixed(2)})`,
                  `NOTE: On APPROVED, Collections may now be created against this Sales document.`,
                ],
              }
            : {
                db_operations: [
                  `UPDATE sales SET state = '${nextState}' WHERE id = ${prev.data.sales_id}`,
                ],
              }),
        },
      }
    })
    setTraceStep((prev) => Math.min(prev + 1, 3))
  }

  const approvalLabel =
    !sandboxResponse
      ? null
      : sandboxResponse.data.state === 'PREPARED'
        ? 'Mark as CHECKED'
        : sandboxResponse.data.state === 'CHECKED'
          ? 'Approve (CHECKED → APPROVED)'
          : null

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
          Simulate a live Sales posting through the PREPARED → CHECKED → APPROVED
          workflow. Adjust quantities, values, or tax rates to verify calculations,
          dynamic SQL outputs, and balancing general ledger offsets.
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
                <span>POST Draft Sales Document</span>
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
                <div className="flex items-center gap-1.5">
                  {['PREPARED', 'CHECKED', 'APPROVED'].map((stage, i) => {
                    const stageOrder = ['PREPARED', 'CHECKED', 'APPROVED']
                    const currentIdx = stageOrder.indexOf(sandboxResponse.data.state)
                    const reached = i <= currentIdx
                    return (
                      <React.Fragment key={stage}>
                        <span
                          className={`px-2 py-1 rounded text-[10px] font-bold border ${
                            reached
                              ? 'bg-sky-500/10 border-sky-500 text-sky-400'
                              : 'bg-slate-950 border-slate-800 text-slate-600'
                          }`}
                        >
                          {stage}
                        </span>
                        {i < 2 && (
                          <span className="text-slate-700 text-[10px]">→</span>
                        )}
                      </React.Fragment>
                    )
                  })}
                </div>

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

          {approvalLabel && (
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 mt-4 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="space-y-1 text-xs text-slate-300">
                <span className="font-bold text-amber-400 flex items-center gap-1">
                  <AlertTriangle size={12} /> Approval Step Pending
                </span>
                <p className="text-[11px] leading-relaxed">
                  {sandboxResponse.data.state === 'PREPARED'
                    ? 'Document saved as PREPARED. No journal entries exist yet — advance the workflow to continue.'
                    : 'Document is CHECKED. Approve to trigger the Posting Engine and write journal entries to the GL.'}
                </p>
              </div>
              <button
                onClick={advanceApproval}
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-lg shrink-0 shadow-lg flex items-center gap-1"
              >
                <CheckCircle2 size={12} /> {approvalLabel}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}