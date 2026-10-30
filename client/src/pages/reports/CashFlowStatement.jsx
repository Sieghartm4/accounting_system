import React, { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Download,
  TrendingUp,
  RefreshCcw,
  FileText,
  ArrowUpRight,
  Wallet,
  BarChart,
  CreditCard,
  Plus,
  Equal,
  List,
  Sigma,
  Percent,
} from 'lucide-react'
import * as XLSX from 'xlsx'
import useCompany from '../company/useCompany'
import { renderPDFCompanyHeader } from '../../utils/pdfCompanyHeader'
import LoadingScreen from '../../components/LoadingScreen'
import { currentReportPeriod } from '../../utils/reportPeriod'
import { API } from '../../api/endpoints'

const METHODS = [
  { key: 'BASIC', label: 'Basic', hint: 'Section totals only' },
  { key: 'DIRECT', label: 'Direct', hint: 'Cash collections & payments by account' },
  { key: 'INDIRECT', label: 'Indirect', hint: 'Net income reconciled to cash' },
]

export default function CashFlowStatement() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [method, setMethod] = useState('DIRECT')
  const [startDate, setStartDate] = useState(
    () => searchParams.get('start_date') || currentReportPeriod().start,
  )
  const [endDate, setEndDate] = useState(
    () => searchParams.get('end_date') || currentReportPeriod().end,
  )
  const [exportMenuOpen, setExportMenuOpen] = useState(false)
  const { company } = useCompany()

  // Read URL parameters on mount
  useEffect(() => {
    const start = searchParams.get('start_date')
    const end = searchParams.get('end_date')
    if (start) setStartDate(start)
    if (end) setEndDate(end)
  }, [searchParams])

  useEffect(() => {
    fetchCashFlowStatement()
  }, [])

  const fetchCashFlowStatement = async () => {
    try {
      setLoading(true)
      setError('')
      const token = sessionStorage.getItem('authenticated')
      const params = new URLSearchParams()
      if (startDate) params.append('start_date', startDate)
      if (endDate) params.append('end_date', endDate)
      const url = `${API.reportsCashFlowStatement()}${params.toString() ? '?' + params : ''}`

      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      })
      const result = await response.json()
      if (result.success) setData(result.data)
      else setError(result.message || 'Failed to fetch cash flow statement')
    } catch (err) {
      setError('Connection Error: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const fmt = (n) =>
    new Intl.NumberFormat('en-PH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n || 0)

  const signed = (n) => {
    const num = Number(n || 0)
    return num >= 0 ? fmt(num) : `(${fmt(Math.abs(num))})`
  }

  const formatDate = (ds) => {
    if (!ds) return ''
    const d = new Date(ds)
    return d.toLocaleDateString('en-PH', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
    })
  }

  const openingAsOf = () => {
    if (!startDate) return '—'
    const d = new Date(startDate)
    d.setDate(d.getDate() - 1)
    return formatDate(d.toISOString().split('T')[0])
  }

  const closingAsOf = () => (endDate ? formatDate(endDate) : '—')

  const handleAccountNameClick = (accountCode) => {
    const params = new URLSearchParams()
    params.append('account_code', accountCode)
    if (startDate) params.append('start_date', startDate)
    if (endDate) params.append('end_date', endDate)
    navigate(`/general-ledger?${params.toString()}`)
  }

  const handleAmountClick = handleAccountNameClick

  // Signed amount cell; deep-links to the General Ledger for the backing account.
  const AmountCell = ({ code, net }) => {
    const isPositive = Number(net || 0) >= 0
    return (
      <td className={`py-2 px-4 text-right w-32 font-mono text-[13px] font-black ${isPositive ? 'text-black' : 'text-red-600'}`}>
        <button
          onClick={() => code && handleAmountClick(code)}
          disabled={!code}
          className={`group flex items-center justify-end gap-1.5 rounded px-2 py-0.5 transition-all ${code ? 'hover:bg-red-50 hover:underline cursor-pointer' : 'cursor-default'}`}
          title={code ? 'View in General Ledger' : undefined}
        >
          {signed(net)}
          {code && (
            <ArrowUpRight size={10} className="opacity-0 group-hover:opacity-100 transition-opacity" />
          )}
        </button>
      </td>
    )
  }

  // Detail account row used under caption headings.
  const DetailRow = ({ item, indent = false }) => (
    <tr
      key={`${item.code || 'x'}-${item.name}`}
      className="hover:bg-red-100 transition-colors border-l-2 border-transparent hover:border-red-600"
    >
      <td className="py-1.5 px-4 w-20">
        <p className="text-[10px] font-bold text-gray-400 uppercase">{item.code}</p>
      </td>
      <td className={`py-1.5 px-4 ${indent ? 'pl-8' : ''}`}>
        {item.code ? (
          <button
            onClick={() => handleAccountNameClick(item.code)}
            className="group flex items-center gap-1.5 text-[11px] font-bold text-slate-700 hover:text-red-600 hover:bg-red-50 hover:underline cursor-pointer transition-all rounded px-1.5 py-0.5 text-left"
            title="View in General Ledger"
          >
            {item.name}
            <ArrowUpRight size={9} className="opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
        ) : (
          <span className="text-[11px] font-bold text-slate-700">{item.name}</span>
        )}
      </td>
      <AmountCell code={item.code} net={item.net} />
    </tr>
  )

  // Caption heading row inside a card table.
  const CaptionRow = ({ caption, group }) => (
    <tr className="bg-slate-100">
      <td colSpan={2} className="py-1.5 px-4">
        <span className="text-[10px] font-black uppercase tracking-wider text-slate-600">
          {caption}
        </span>
      </td>
      <td className="py-1.5 px-4 text-right w-32 font-mono text-[11px] font-black text-slate-600 whitespace-nowrap">
        {signed(group.net)}
      </td>
    </tr>
  )

  // Renders a section table from caption groups (with detail rows beneath).
  const renderCaptionedRows = (captionsList) => {
    if (!captionsList || captionsList.length === 0) {
      return (
        <tr>
          <td colSpan={3} className="py-4 px-4 text-gray-400 text-xs">
            No transactions recorded
          </td>
        </tr>
      )
    }
    return captionsList.map((group) => (
      <React.Fragment key={group.caption}>
        <CaptionRow caption={group.caption} group={group} />
        {group.rows.map((row) => (
          <DetailRow key={`${group.caption}-${row.code || row.name}`} item={row} indent />
        ))}
      </React.Fragment>
    ))
  }

  const footerFor = (label, value, big = false) => (
    <div className="mt-auto bg-gray-50 border-t border-gray-100 px-5 py-3 flex justify-between items-center">
      <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest">
        {label}
      </span>
      <span className={`${big ? 'text-lg font-black' : 'text-sm font-bold'} text-gray-900`}>
        ₱ {fmt(value)}
      </span>
    </div>
  )

  const SectionCard = ({ title, icon: Icon, children, footLabel, footValue }) => (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col h-full min-h-0">
      <div className="flex items-center gap-2 px-5 py-3 bg-black flex-shrink-0">
        <Icon size={14} className="text-red-500" />
        <span className="text-[11px] font-black uppercase tracking-[3px] text-white">
          {title}
        </span>
      </div>
      <div className="overflow-y-auto custom-scrollbar flex-1 min-h-0">
        <table className="w-full border-collapse">
          <thead className="sticky top-0 bg-gray-50 z-10">
            <tr className="border-b border-gray-100">
              <th className="py-2 px-4 text-[10px] font-black uppercase text-gray-400 text-left w-20">
                Code
              </th>
              <th className="py-2 px-4 text-[10px] font-black uppercase text-gray-400 text-left">
                Account Name
              </th>
              <th className="py-2 px-4 text-[10px] font-black uppercase text-gray-400 text-right w-32">
                Amount
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">{children}</tbody>
        </table>
      </div>
      {footerFor(footLabel, footValue)}
    </div>
  )

  // ── BASIC view: section totals only, exactly like the printed statement ──
  const BasicView = () => {
    const rows = [
      { label: 'CASH FLOW FROM OPERATING ACTIVITIES', value: data?.operating?.net, heavy: false },
      { label: 'CASH FLOW FROM INVESTING ACTIVITIES', value: data?.investing?.net, heavy: false },
      { label: 'CASH FLOW FROM FINANCING ACTIVITIES', value: data?.financing?.net, heavy: false },
      { label: 'NET INCREASE / (DECREASE) IN CASH', value: data?.netChange, heavy: true },
      { label: `OPENING CASH AS AT ${openingAsOf()}`, value: data?.openingCash, heavy: false },
      { label: `CLOSING CASH AS AT ${closingAsOf()}`, value: data?.closingCash, heavy: false },
      { label: 'NET INCREASE / (DECREASE) IN CASH', value: data?.netChange, heavy: true },
    ]
    return (
      <div className="bg-black text-white rounded-2xl border border-slate-800 shadow-sm p-6 md:p-8 max-w-5xl w-full mx-auto mt-4">
        <div className="text-center mb-6">
          <p className="text-base font-black tracking-[6px]">CASH FLOW STATEMENT</p>
          <p className="text-[11px] font-bold tracking-[2.5px] text-slate-400 mt-1.5">
            {startDate || '—'} — {endDate || 'ALL'} ({METHODS[0].label.toUpperCase()} PRESENTATION)
          </p>
        </div>
        <div className="divide-y divide-slate-800">
          {rows.map((row, i) => (
            <div key={`${row.label}-${i}`} className="flex items-center justify-between gap-8 py-3">
              <span className={`text-[13px] uppercase tracking-wider ${row.heavy ? 'font-black text-white' : 'font-semibold text-slate-300'}`}>
                {row.label}
              </span>
              <span className={`font-mono tabular-nums text-right ${row.heavy ? 'text-xl font-black' : 'text-base font-bold'} ${Number(row.value) >= 0 ? 'text-white' : 'text-red-400'}`}>
                ₱{signed(row.value)}
              </span>
            </div>
          ))}
        </div>
        {(data?.internalTransfers?.rows || []).length > 0 && (
          <p className="mt-5 text-[11px] font-medium text-slate-500 border-t border-slate-900 pt-4">
            Note: ₱{fmt((data.internalTransfers.rows || []).reduce((s, r) => s + (r.inflow + r.outflow), 0))} in transfers between the company's own cash/bank accounts are excluded from the three activity totals.
          </p>
        )}
      </div>
    )
  }

  // ── INDIRECT operating rows: net income → add-backs → working capital ──
  const IndirectOperatingRows = () => {
    const indirect = data?.indirect || {}
    const out = []
    out.push(
      <tr key="ni" className="bg-slate-50">
        <td className="py-2 px-4 w-20">
          <p className="text-[10px] font-bold text-gray-400 uppercase">P&amp;L</p>
        </td>
        <td className="py-2 px-4">
          <span className="text-[12px] font-black text-black uppercase tracking-wide">
            Net Income (period)
          </span>
        </td>
        <td className="py-2 px-4 text-right w-32 font-mono text-[13px] font-black text-black">
          {signed(indirect.netIncome)}
        </td>
      </tr>,
    )
      ; (indirect.addBacks || []).forEach((item) =>
        out.push(
          <tr key={item.label} className="hover:bg-red-50 transition-colors border-l-2 border-transparent hover:border-red-600">
            <td className="py-1.5 px-4 w-20" />
            <td className="py-1.5 px-4 pl-8">
              <span className="text-[11px] font-bold text-slate-700">{item.label}</span>
            </td>
            <td className="py-1.5 px-4 text-right w-32 font-mono text-[12px] font-black text-black">
              {signed(item.amount)}
            </td>
          </tr>,
        ),
      )
      ; (indirect.workingCapital || []).forEach((item) =>
        out.push(
          <tr key={item.label} className="hover:bg-red-50 transition-colors border-l-2 border-transparent hover:border-red-600">
            <td className="py-1.5 px-4 w-20" />
            <td className="py-1.5 px-4 pl-8">
              <span className="text-[11px] font-bold text-slate-700 capitalize">{item.label.replace(/^changes in/, 'Movement in')}</span>
            </td>
            <td className="py-1.5 px-4 text-right w-32 font-mono text-[12px] font-black text-black">
              {signed(item.amount)}
            </td>
          </tr>,
        ),
      )
    if (!indirect.addBacks?.length && !indirect.workingCapital?.length) {
      out.push(
        <tr key="none">
          <td colSpan={3} className="py-2 px-4 text-[11px] text-gray-400">
            No non-cash adjustments involved
          </td>
        </tr>,
      )
    }
    return out
  }

  const netChangeMismatch =
    method === 'INDIRECT'
      ? Math.abs(
        (data?.netChange || 0) -
        ((data?.indirect?.operatingNet || 0) + (data?.investing?.net || 0) + (data?.financing?.net || 0)),
      )
      : 0

  // ── Print model shared by Excel/PDF exports, per selected method ──
  const buildPrintModel = () => {
    const titleSub =
      method === 'BASIC' ? 'SUMMARY PRESENTATION' : method === 'DIRECT' ? 'DIRECT METHOD' : 'INDIRECT METHOD'
    const sections = []
    if (method === 'BASIC') {
      sections.push({
        title: 'CASH FLOW SUMMARY',
        lines: [
          { label: 'CASH FLOW FROM OPERATING ACTIVITIES', amount: data?.operating?.net },
          { label: 'CASH FLOW FROM INVESTING ACTIVITIES', amount: data?.investing?.net },
          { label: 'CASH FLOW FROM FINANCING ACTIVITIES', amount: data?.financing?.net },
          { label: 'NET INCREASE / (DECREASE) IN CASH', amount: data?.netChange, heavy: true },
          { label: `OPENING CASH AS AT ${openingAsOf()}`, amount: data?.openingCash },
          { label: `CLOSING CASH AS AT ${closingAsOf()}`, amount: data?.closingCash },
          { label: 'NET INCREASE / (DECREASE) IN CASH', amount: data?.netChange, heavy: true },
        ],
      })
    } else {
      // Operating block
      const opLines = []
      if (method === 'INDIRECT') {
        opLines.push({ label: 'NET INCOME', amount: data?.indirect?.netIncome, heavy: true })
          ; (data?.indirect?.addBacks || []).forEach((item) =>
            opLines.push({ label: item.label, amount: item.amount, indent: true }),
          )
          ; (data?.indirect?.workingCapital || []).forEach((item) =>
            opLines.push({ label: item.label, amount: item.amount, indent: true }),
          )
      } else {
        ; (data?.captions?.operating || []).forEach((group) => {
          opLines.push({ label: group.caption, amount: group.net, caption: true })
          group.rows.forEach((row) =>
            opLines.push({ code: row.code, label: row.name, amount: row.net, indent: true }),
          )
        })
        if (!data?.captions?.operating?.length) {
          opLines.push({ label: 'No transactions recorded', amount: 0, muted: true })
        }
      }
      sections.push({ title: 'CASH FLOWS FROM OPERATING ACTIVITIES', lines: opLines, foot: { label: 'NET CASH FROM OPERATING ACTIVITIES', amount: method === 'INDIRECT' ? data?.indirect?.operatingNet : data?.operating?.net } })

      // Investing / Financing — captioned for both modes
      const invLines = []
        ; (data?.captions?.investing || []).forEach((group) => {
          invLines.push({ label: group.caption, amount: group.net, caption: true })
          group.rows.forEach((row) =>
            invLines.push({ code: row.code, label: row.name, amount: row.net, indent: true }),
          )
        })
      if (!data?.captions?.investing?.length) invLines.push({ label: 'No transactions recorded', amount: 0, muted: true })
      sections.push({ title: 'CASH FLOWS FROM INVESTING ACTIVITIES', lines: invLines, foot: { label: 'NET CASH FROM INVESTING ACTIVITIES', amount: data?.investing?.net } })

      const finLines = []
        ; (data?.captions?.financing || []).forEach((group) => {
          finLines.push({ label: group.caption, amount: group.net, caption: true })
          group.rows.forEach((row) =>
            finLines.push({ code: row.code, label: row.name, amount: row.net, indent: true }),
          )
        })
      if (!data?.captions?.financing?.length) finLines.push({ label: 'No transactions recorded', amount: 0, muted: true })
      sections.push({ title: 'CASH FLOWS FROM FINANCING ACTIVITIES', lines: finLines, foot: { label: 'NET CASH FROM FINANCING ACTIVITIES', amount: data?.financing?.net } })

      if (data?.internalTransfers?.rows?.length) {
        const trRows = data.internalTransfers.rows.map((row) => ({
          code: row.code,
          label: row.name,
          amount: row.net,
          indent: true,
        }))
        sections.push({
          title: 'INTERNAL CASH TRANSFERS (EXCLUDED FROM TOTALS)',
          lines: trRows,
          foot: { label: 'NET TRANSFERS (EXCLUDED)', amount: data.internalTransfers.total },
        })
      }
      if (data?.unbalanced?.count) {
        // Documents whose journal lines don't balance — the audit trail
        // behind the "Other cash movements (unclassified)" bucket.
        sections.push({
          title: 'AUDIT: UNBALANCED DOCUMENTS (CASH MOVEMENT NOT FULLY EXPLAINED)',
          lines: (data.unbalanced.documents || []).map((doc, i) => ({
            code: doc.db_id,
            label: `${doc.db_name || 'document'} #${i + 1}`,
            amount: doc.amount,
            indent: false,
          })),
          foot: {
            label: `Total residual across ${data.unbalanced.count} document(s) — these amounts must equal the Operating "Other cash movements" line`,
            amount: data.unbalanced.total,
          },
        })
      }
    }
    return { titleSub, sections }
  }

  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet([])
    const { titleSub, sections } = buildPrintModel()

    const setCell = (ws, addr, value, style) => {
      if (!ws[addr]) ws[addr] = {}
      ws[addr].v = value
      ws[addr].t = typeof value === 'number' ? 'n' : 's'
      if (style) ws[addr].s = style
    }

    const BLACK_BG = { fgColor: { rgb: '111827' } }
    const GRAY_BG = { fgColor: { rgb: 'F9FAFB' } }
    const CAPTION_BG = { fgColor: { rgb: 'E5E7EB' } }
    const BORDER_GRAY = {
      top: { style: 'thin', color: { rgb: 'E5E7EB' } },
      bottom: { style: 'thin', color: { rgb: 'E5E7EB' } },
      left: { style: 'thin', color: { rgb: 'E5E7EB' } },
      right: { style: 'thin', color: { rgb: 'E5E7EB' } },
    }
    const BORDER_TOTAL = {
      top: { style: 'thick', color: { rgb: 'DC2626' } },
      bottom: { style: 'thin', color: { rgb: 'E5E7EB' } },
      left: { style: 'thin', color: { rgb: 'E5E7EB' } },
      right: { style: 'thin', color: { rgb: 'E5E7EB' } },
    }

    const whiteOnBlack = (bold = false) => ({
      font: { bold, color: { rgb: 'FFFFFF' }, name: 'Calibri', sz: 10 },
      fill: BLACK_BG,
      alignment: { horizontal: 'left', vertical: 'center' },
    })

    const bodyCell = (bold = false, fill = 'FFFFFF') => ({
      font: { bold, color: { rgb: '111827' }, name: 'Calibri', sz: 10 },
      fill: { fgColor: { rgb: fill } },
      alignment: { horizontal: 'left', vertical: 'center' },
      border: BORDER_GRAY,
    })

    const amountCell = (bold = false, fill = 'FFFFFF', negative = false) => ({
      font: { bold, color: { rgb: negative ? 'DC2626' : '111827' }, name: 'Calibri', sz: 10 },
      fill: { fgColor: { rgb: fill } },
      alignment: { horizontal: 'right', vertical: 'center' },
      border: BORDER_GRAY,
    })

    const subtotalStyle = (align = 'left') => ({
      font: { bold: true, color: { rgb: 'FFFFFF' }, name: 'Calibri', sz: 10 },
      fill: { fgColor: { rgb: '374151' } },
      alignment: { horizontal: align, vertical: 'center' },
      border: BORDER_TOTAL,
    })

    let r = 1

      ;['A', 'B'].forEach((c) => {
        setCell(ws, `${c}${r}`, c === 'A' ? 'CASH FLOW STATEMENT' : '', {
          font: { bold: true, color: { rgb: 'FFFFFF' }, name: 'Calibri', sz: 13 },
          fill: BLACK_BG,
          alignment: { horizontal: 'left', vertical: 'center' },
        })
      })
    r++
      ;['A', 'B'].forEach((c) => {
        setCell(
          ws,
          `${c}${r}`,
          c === 'A'
            ? `${METHODS.find((m) => m.key === method)?.label.toUpperCase() || ''} METHOD — Period: ${formatDate(startDate) || 'All'} — ${formatDate(endDate) || 'All'}`
            : `Generated: ${new Date().toLocaleDateString('en-PH')}`,
          {
            font: { bold: false, color: { rgb: '6B7280' }, name: 'Calibri', sz: 9 },
            fill: BLACK_BG,
            alignment: { horizontal: c === 'B' ? 'right' : 'left', vertical: 'center' },
          },
        )
      })
    r++
    r++

    const writeLine = (line) => {
      const fill = line.muted ? 'F9FAFB' : line.heavy ? 'E5E7EB' : 'FFFFFF'
      setCell(ws, `A${r}`, line.code || '', bodyCell(false, fill))
      setCell(ws, `B${r}`, (line.indent ? '    ' : '') + line.label, bodyCell(line.heavy || line.caption, fill))
      const amount = parseFloat(line.amount || 0)
      ws[`C${r}`] = {
        v: amount,
        t: 'n',
        z: '#,##0.00',
        s: amountCell(line.heavy || line.caption, fill, amount < 0),
      }
      r++
    }

    for (const section of sections) {
      setCell(ws, `A${r}`, section.title, whiteOnBlack(true))
      setCell(ws, `B${r}`, '', whiteOnBlack(true))
      setCell(ws, `C${r}`, '', whiteOnBlack(true))
      r++
      section.lines.forEach(writeLine)
      if (section.foot) {
        setCell(ws, `A${r}`, section.foot.label, subtotalStyle('left'))
        setCell(ws, `B${r}`, '', subtotalStyle('left'))
        ws[`C${r}`] = {
          v: parseFloat(section.foot.amount || 0),
          t: 'n',
          z: '#,##0.00',
          s: subtotalStyle('right'),
        }
        r++
      }
      r++
      r++
    }

    // Movement recap
    const netCashFlowStyle = (align = 'left') => ({
      font: { bold: true, color: { rgb: 'FFFFFF' }, name: 'Calibri', sz: 11 },
      fill: { fgColor: { rgb: (data?.netChange || 0) >= 0 ? '059669' : 'DC2626' } },
      alignment: { horizontal: align, vertical: 'center' },
      border: { top: { style: 'thick', color: { rgb: '111827' } }, bottom: { style: 'thin' } },
    })

    setCell(ws, `A${r}`, 'OPENING CASH', subtotalStyle('left'))
    setCell(ws, `B${r}`, '', subtotalStyle('left'))
    ws[`C${r}`] = { v: parseFloat(data?.openingCash || 0), t: 'n', z: '#,##0.00', s: subtotalStyle('right') }
    r++
    setCell(ws, `A${r}`, 'NET INCREASE (DECREASE) IN CASH', netCashFlowStyle('left'))
    setCell(ws, `B${r}`, '', netCashFlowStyle('left'))
    ws[`C${r}`] = { v: parseFloat(data?.netChange || 0), t: 'n', z: '#,##0.00', s: netCashFlowStyle('right') }
    r++
    setCell(ws, `A${r}`, 'CLOSING CASH', subtotalStyle('left'))
    setCell(ws, `B${r}`, '', subtotalStyle('left'))
    ws[`C${r}`] = { v: parseFloat(data?.closingCash || 0), t: 'n', z: '#,##0.00', s: subtotalStyle('right') }
    r++

    ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: r - 1, c: 2 } })
    ws['!cols'] = [{ wch: 16 }, { wch: 52 }, { wch: 18 }]
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 2 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 2 } },
    ]

    XLSX.utils.book_append_sheet(wb, ws, `Cash Flow (${method.toLowerCase()})`)
    XLSX.writeFile(
      wb,
      `cash-flow-statement-${method.toLowerCase()}-${new Date().toISOString().split('T')[0]}.xlsx`,
    )
    setExportMenuOpen(false)
  }

  const handleExportPDF = async () => {
    try {
      const { jsPDF } = await import('jspdf')
      const { default: autoTable } = await import('jspdf-autotable')

      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'pt',
        format: 'letter',
      })
      const W = doc.internal.pageSize.getWidth()
      const H = doc.internal.pageSize.getHeight()
      const M = 36
      let y = renderPDFCompanyHeader(doc, company, W, M)

      const BLK = [17, 24, 39]
      const GRY = [100, 116, 139]
      const LGT = [226, 232, 240]
      const WHT = [255, 255, 255]
      const BG_ALT = [248, 250, 252]
      const CAP_BG = [226, 232, 240]

      doc.setDrawColor(...LGT)
      doc.setLineWidth(1)
      doc.line(M, y, W - M, y)
      y += 14

      const { titleSub, sections } = buildPrintModel()

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(14)
      doc.setTextColor(...BLK)
      doc.text('CASH FLOW STATEMENT', M, y)

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.setTextColor(...GRY)
      doc.text(titleSub, W - M, y, { align: 'right' })

      y += 12
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.text(
        `Period: ${formatDate(startDate) || 'All Dates'} — ${formatDate(endDate) || 'All Dates'}`,
        M,
        y,
      )
      doc.text(`Generated: ${new Date().toLocaleDateString('en-PH')}`, W - M, y, {
        align: 'right',
      })
      y += 16

      const cleanFmt = (val) => {
        const formatted = fmt(parseFloat(val || 0))
        return formatted.replace('₱', 'Php ')
      }

      for (const section of sections) {
        const body = section.lines.map((line) => [
          line.code || '',
          (line.indent ? '   ' : '') + line.label,
          cleanFmt(line.amount),
        ])

        autoTable(doc, {
          startY: y,
          margin: { left: M, right: M },
          tableWidth: W - M * 2,
          head: [
            [
              { content: section.title, colSpan: 3, styles: { fillColor: BLK, textColor: WHT, fontStyle: 'bold', fontSize: 9.5 } },
            ],
            [
              { content: 'ACCOUNT CODE', styles: { halign: 'left' } },
              { content: 'DESCRIPTION', styles: { halign: 'left' } },
              { content: 'AMOUNT (Php)', styles: { halign: 'right' } },
            ],
          ],
          body: body.length
            ? body
            : [['', 'No transactions recorded', '0.00']],
          foot: section.foot
            ? [
              [
                {
                  content: section.foot.label,
                  colSpan: 2,
                  styles: { halign: 'left', fontStyle: 'bold' },
                },
                {
                  content: cleanFmt(section.foot.amount || 0),
                  styles: { halign: 'right', fontStyle: 'bold' },
                },
              ],
            ]
            : undefined,
          theme: 'plain',
          headStyles: {
            fillColor: [51, 65, 85],
            textColor: WHT,
            fontStyle: 'bold',
            fontSize: 8.5,
            cellPadding: { top: 6, bottom: 6, left: 8, right: 8 },
          },
          alternateRowStyles: { fillColor: BG_ALT },
          styles: {
            fontSize: 8.5,
            font: 'helvetica',
            cellPadding: { top: 4.5, bottom: 4.5, left: 8, right: 8 },
            textColor: [30, 41, 59],
            lineColor: LGT,
            lineWidth: 0.5,
            valign: 'middle',
          },
          footStyles: {
            fillColor: [241, 245, 249],
            textColor: BLK,
            fontStyle: 'bold',
            fontSize: 9,
            cellPadding: { top: 7, bottom: 7, left: 8, right: 8 },
            lineColor: [203, 213, 225],
            lineWidth: { top: 1, bottom: 1, left: 0, right: 0 },
          },
          columnStyles: {
            0: { cellWidth: 55, halign: 'left', fontStyle: 'bold' },
            1: { cellWidth: 'auto', halign: 'left' },
            2: { cellWidth: 75, halign: 'right', fontStyle: 'bold' },
          },
          didParseCell: (hookData) => {
            if (hookData.section !== 'body') return
            const line = section.lines[hookData.row.index]
            if (line?.caption) hookData.cell.styles.fillColor = CAP_BG
            if (line?.heavy) hookData.cell.styles.fontStyle = 'bold'
          },
        })
        y = doc.lastAutoTable.finalY + 14
      }

      // Movement recap box
      const netCashFlowVal = data?.netChange || 0
      const isNetPositive = netCashFlowVal >= 0
      const netBgColor = isNetPositive ? [6, 95, 70] : [153, 27, 27]

      doc.setFillColor(...netBgColor)
      doc.roundedRect(M, y, W - M * 2, 32, 4, 4, 'F')

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(11)
      doc.setTextColor(...WHT)
      doc.text('NET INCREASE (DECREASE) IN CASH', M + 12, y + 20)
      doc.setFontSize(12)
      doc.text(cleanFmt(netCashFlowVal), W - M - 12, y + 20, { align: 'right' })

      y += 46
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.setTextColor(...GRY)
      doc.text(`OPENING CASH: ${cleanFmt(data?.openingCash || 0)}`, M, y)
      doc.text(`CLOSING CASH: ${cleanFmt(data?.closingCash || 0)}`, W - M, y, { align: 'right' })

      const totalPages = doc.internal.getNumberOfPages()
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8)
        doc.setTextColor(...GRY)
        doc.text(`Page ${i} of ${totalPages}`, W - M, H - 20, { align: 'right' })
        doc.text('Confidential — For Internal Financial Reporting Only', M, H - 20)
      }

      doc.save(
        `cash-flow-statement-${method.toLowerCase()}-${new Date().toISOString().split('T')[0]}.pdf`,
      )
      setExportMenuOpen(false)
    } catch (err) {
      console.error('PDF export error:', err)
    }
  }

  if (loading) return <LoadingScreen label="Calculating Cash Flow..." />

  if (error)
    return (
      <div className="p-10">
        <div className="bg-red-50 border-l-4 border-red-600 p-6 rounded-r-xl">
          <h3 className="text-red-800 font-bold uppercase text-sm">Error</h3>
          <p className="text-red-600 text-sm mt-1">{error}</p>
          <button
            onClick={fetchCashFlowStatement}
            className="mt-3 px-4 py-2 bg-red-600 text-white text-xs font-black rounded-lg uppercase tracking-widest hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    )

  return (
    <div className="flex flex-col gap-3 bg-[#F3F4F6] h-full overflow-x-auto custom-scrollbar">
      {/* HEADER */}
      <div className="flex items-center justify-between flex-wrap gap-3 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-black rounded-xl shrink-0">
            <FileText size={22} className="text-red-500" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-black tracking-tighter leading-none">
              Cash Flow <span className="text-red-600 italic">Statement</span>
            </h1>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-[2px] mt-1">
              Operating, Investing
            </p>
          </div>
          {/* METHOD PILLS */}
          <div className="ml-4 flex items-center bg-slate-100 p-1.5 rounded-xl border border-slate-200 shadow-inner shadow-inner">
            {METHODS.map(({ key, label, hint }) => {
              const activeTab = method === key
              return (
                <button
                  key={key}
                  onClick={() => setMethod(key)}
                  title={hint}
                  className={`pl-5 pr-3 py-2.5 rounded-lg text-xs font-black tracking-wider uppercase transition-all ${activeTab
                      ? 'bg-red-600 text-white shadow'
                      : 'text-slate-600 hover:text-black hover:bg-white/70'
                    }`}
                >
                  <span className="inline-flex items-center gap-1.5">
                    {key === 'BASIC' ? (
                      <List size={14} />
                    ) : key === 'DIRECT' ? (
                      <Sigma size={14} />
                    ) : (
                      <Percent size={14} />
                    )}
                    {label}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
        <div className="flex gap-2 items-center relative">
          {/* Date range filter */}
          <div className="flex flex-col lg:flex-row lg:items-center gap-1.5 lg:gap-2 w-full md:w-auto bg-white border border-slate-300 rounded-xl p-2 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider shrink-0">From</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full lg:w-[7.5rem] shrink-0 bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-2 text-xs font-bold text-slate-700 outline-none cursor-pointer focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-400/30 hover:border-slate-400 transition-colors"
              />
            </div>
            <span className="hidden lg:block h-6 w-px bg-slate-200 shrink-0" />
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider shrink-0">To</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full lg:w-[7.5rem] shrink-0 bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-2 text-xs font-bold text-slate-700 outline-none cursor-pointer focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-400/30 hover:border-slate-400 transition-colors"
              />
            </div>
            <span className="hidden lg:block mx-1 h-6 w-px bg-slate-200 shrink-0" />
            <button
              onClick={() => {
                setStartDate('')
                setEndDate('')
              }}
              className="w-full lg:w-auto px-4 py-2 rounded-lg border border-slate-300 bg-white text-[11px] font-black text-slate-600 uppercase tracking-widest hover:border-blue-500 hover:bg-blue-50 hover:text-blue-600 transition-colors cursor-pointer"
            >
              Reset
            </button>
            <button
              onClick={fetchCashFlowStatement}
              className="w-full lg:w-auto px-5 py-2 rounded-lg bg-red-600 text-[11px] font-black text-white uppercase tracking-widest shadow-sm shadow-red-600/30 hover:bg-red-700 transition-colors cursor-pointer"
            >
              Submit
            </button>
          </div>
          <div className="relative">
            <button
              onClick={() => setExportMenuOpen((p) => !p)}
              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-[11px] font-black text-white rounded-xl hover:bg-emerald-700 uppercase tracking-widest transition-colors shadow-sm"
            >
              <Download size={13} /> Export
            </button>
            {exportMenuOpen && (
              <div className="absolute right-0 mt-2 w-40 bg-white border border-gray-200 rounded-xl shadow-lg z-50">
                <button
                  type="button"
                  onClick={handleExportPDF}
                  className="w-full text-left px-4 py-3 text-[11px] font-black text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  Export PDF ({method.toLowerCase()})
                </button>
                <button
                  type="button"
                  onClick={handleExportExcel}
                  className="w-full text-left px-4 py-3 text-[11px] font-black text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  Export Excel ({method.toLowerCase()})
                </button>
              </div>
            )}
          </div>
          <button
            onClick={fetchCashFlowStatement}
            className="w-10 h-10 bg-red-600 text-white rounded-xl hover:bg-red-700 flex items-center justify-center transition-colors shadow-lg shadow-red-200"
          >
            <RefreshCcw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* CONTENT */}
      <div className="flex-1 overflow-hidden flex flex-col gap-4 min-h-0">
        {method === 'BASIC' ? (
          <div className="flex-1 overflow-y-auto custom-scrollbar pb-4">
            <BasicView />
          </div>
        ) : (
          <>
            {/* THREE-COLUMN LAYOUT */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1 min-h-0 overflow-hidden">
              {/* OPERATING */}
              <SectionCard
                title="Operating Activities"
                icon={TrendingUp}
                footLabel={method === 'INDIRECT' ? 'Net — Indirect Method' : 'Net Cash from Operating Activities'}
                footValue={method === 'INDIRECT' ? data?.indirect?.operatingNet : data?.operating?.net}
              >
                {method === 'INDIRECT' ? (
                  <IndirectOperatingRows />
                ) : (
                  renderCaptionedRows(data?.captions?.operating)
                )}
              </SectionCard>

              {/* INVESTING */}
              <SectionCard
                title="Investing Activities"
                icon={BarChart}
                footLabel="Net Cash from Investing Activities"
                footValue={data?.investing?.net}
              >
                {renderCaptionedRows(data?.captions?.investing)}
              </SectionCard>

              {/* FINANCING */}
              <SectionCard
                title="Financing Activities"
                icon={CreditCard}
                footLabel="Net Cash from Financing Activities"
                footValue={data?.financing?.net}
              >
                {renderCaptionedRows(data?.captions?.financing)}
              </SectionCard>
            </div>

            {/* NET CASH FLOW SUMMARY */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex-shrink-0">
              <div className="flex items-center justify-between px-5 py-3 bg-slate-900 text-white">
                <div className="flex items-center gap-2.5">
                  <Wallet size={16} className="text-red-400" />
                  <span className="text-[11px] font-black uppercase tracking-[2px]">
                    Net Cash Position Summary
                  </span>
                  <span className="text-[10px] font-medium text-slate-400 font-mono ml-auto">
                    Operating + Investing + Financing
                  </span>
                </div>
              </div>

              <div className="px-5 py-4 bg-slate-50/70 border-t border-slate-200">
                <div className="flex flex-col lg:flex-row items-stretch gap-2 lg:gap-3">
                  <div className="flex-1 flex flex-col justify-center rounded-lg border border-slate-200 bg-white px-4 py-3">
                    <span className="text-[10px] font-black uppercase tracking-[2px] text-slate-500">
                      Operating {method === 'INDIRECT' ? '(Indirect)' : ''}
                    </span>
                    <span className="font-mono font-black text-slate-900 text-xl tabular-nums">
                      ₱ {fmt(method === 'INDIRECT' ? data?.indirect?.operatingNet : data?.operating?.net)}
                    </span>
                  </div>

                  <div className="flex items-center justify-center px-1">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-white">
                      <Plus size={14} strokeWidth={3} />
                    </span>
                  </div>

                  <div className="flex-[2] flex items-stretch rounded-lg border border-slate-200 bg-white">
                    <div className="flex-1 flex flex-col justify-center px-4 py-3 border-r border-slate-200">
                      <span className="text-[10px] font-black uppercase tracking-[2px] text-slate-500">
                        Investing
                      </span>
                      <span className="font-mono font-black text-slate-900 text-xl tabular-nums">
                        ₱ {fmt(data?.investing?.net)}
                      </span>
                    </div>
                    <div className="flex items-center justify-center px-2 shrink-0">
                      <Plus size={14} className="text-slate-400" strokeWidth={3} />
                    </div>
                    <div className="flex-1 flex flex-col justify-center px-4 py-3 border-r border-slate-200">
                      <span className="text-[10px] font-black uppercase tracking-[2px] text-slate-500">
                        Financing
                      </span>
                      <span className="font-mono font-black text-slate-900 text-xl tabular-nums">
                        ₱ {fmt(data?.financing?.net)}
                      </span>
                    </div>
                    <div className="flex-1 flex flex-col justify-center px-4 py-3 bg-slate-50/70">
                      <span className="text-[10px] font-black uppercase tracking-[2px] text-slate-500">
                        Internal Transfers (excluded)
                      </span>
                      <span className="font-mono font-black text-slate-400 text-xl tabular-nums">
                        ₱ {fmt((data?.internalTransfers?.rows || []).reduce((s, r) => s + (r.inflow + r.outflow), 0))}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-center px-1">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-white">
                      <Equal size={14} strokeWidth={3} />
                    </span>
                  </div>

                  <div className="flex-1 flex flex-col justify-center rounded-lg border border-slate-200 bg-slate-50/70 px-4 py-3">
                    <span className="text-[10px] font-black uppercase tracking-[2px] text-slate-500">
                      Net Change
                    </span>
                    <span className="font-mono font-black text-slate-900 text-xl tabular-nums">
                      ₱ {fmt(data?.netChange)}
                    </span>
                  </div>
                </div>

                {/* Opening → Closing reconciliation */}
                <div className="mt-3 flex flex-col sm:flex-row items-stretch gap-2 sm:gap-3 pt-3 border-t border-slate-200">
                  <div className="flex-1 flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-2.5">
                    <span className="text-[10px] font-black uppercase tracking-[2px] text-slate-500">
                      Opening Cash
                    </span>
                    <span className="font-mono font-black text-slate-900 text-sm tabular-nums">
                      ₱ {fmt(data?.openingCash)}
                    </span>
                  </div>
                  <div className="hidden sm:flex items-center justify-center px-1">
                    <Plus size={13} className="text-slate-400" strokeWidth={3} />
                  </div>
                  <div className="flex-1 flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-2.5">
                    <span className="text-[10px] font-black uppercase tracking-[2px] text-slate-500">
                      Net Change
                    </span>
                    <span className={`font-mono font-black text-sm tabular-nums ${(data?.netChange || 0) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      ₱ {fmt(data?.netChange)}
                    </span>
                  </div>
                  <div className="hidden sm:flex items-center justify-center px-1">
                    <Equal size={13} className="text-slate-400" strokeWidth={3} />
                  </div>
                  <div className="flex-1 flex items-center justify-between rounded-lg border border-slate-200 bg-slate-900 px-4 py-2.5">
                    <span className="text-[10px] font-black uppercase tracking-[2px] text-slate-400">
                      Closing Cash
                    </span>
                    <span className="font-mono font-black text-white text-sm tabular-nums">
                      ₱ {fmt(data?.closingCash)}
                    </span>
                  </div>
                </div>

                {netChangeMismatch > 0.01 && (
                  <p className="mt-2 text-[10px] font-medium text-amber-600">
                    Indirect operating figure differs from actual cash movement by ₱{fmt(netChangeMismatch)} — this stems from unbalanced or unclassified journal documents. The Net Change tile always reflects real cash (Opening → Closing).
                  </p>
                )}

                {(data?.unbalanced?.count || 0) > 0 && (
                  <div className="mt-2 flex flex-col sm:flex-row items-stretch gap-2">
                    <div className="flex-1 flex flex-col gap-1 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5">
                      <span className="text-[10px] font-black uppercase tracking-[2px] text-amber-700">
                        Data Quality Audit: ₱{fmt(data.unbalanced.total)} from {data.unbalanced.count} document{data.unbalanced.count === 1 ? '' : 's'} not fully explained
                      </span>
                      <span className="text-[10px] font-medium text-amber-700/90">
                        {data.unbalanced.documents?.slice(0, 6).map((doc) => `${doc.db_name} #${doc.db_id} (₱${fmt(doc.amount)})`).join(', ')}
                        {(data.unbalanced.documents?.length || 0) > 6 ? ' …' : ''} — see the exported audit section; these journal lines should be corrected or completed at the source.
                      </span>
                    </div>
                  </div>
                )}

                {(data?.internalTransfers?.rows || []).length > 0 && (
                  <p className="mt-2 text-[10px] font-medium text-slate-400">
                    Cash movements between cash/bank accounts (e.g. deposits between BPI and Cash on Hand) are shown as internal transfers and excluded from operating, investing, and financing totals to avoid double counting.
                  </p>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
