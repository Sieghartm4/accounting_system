import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Table2,
  Download,
  DollarSign,
  ShieldCheck,
  Search,
  RefreshCcw,
  ArrowUpRight,
  CheckCircle,
  Wallet,
} from 'lucide-react'
import * as XLSX from 'xlsx'
import useCompany from '../company/useCompany'
import { renderPDFCompanyHeader } from '../../utils/pdfCompanyHeader'
import LoadingScreen from '../../components/LoadingScreen'
import { currentReportPeriod } from '../../utils/reportPeriod'
import { API } from '../../api/endpoints'

export default function TrialBalance() {
  const navigate = useNavigate()
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [startDate, setStartDate] = useState(() => currentReportPeriod().start)
  const [endDate, setEndDate] = useState(() => currentReportPeriod().end)
  const [searchTerm, setSearchTerm] = useState('')
  const [exportMenuOpen, setExportMenuOpen] = useState(false)
  const { company } = useCompany()

  const handleAmountClick = (accountCode, amount, type) => {
    const params = new URLSearchParams()
    params.append('account_code', accountCode)
    params.append('type', type)
    if (startDate) params.append('start_date', startDate)
    if (endDate) params.append('end_date', endDate)
    navigate(`/general-ledger?${params.toString()}`)
  }

  const handleAccountNameClick = (accountCode) => {
    const params = new URLSearchParams()
    params.append('account_code', accountCode)
    if (startDate) params.append('start_date', startDate)
    if (endDate) params.append('end_date', endDate)
    navigate(`/general-ledger?${params.toString()}`)
  }

  useEffect(() => {
    const t = setTimeout(() => fetchTrialBalance(), 500)
    return () => clearTimeout(t)
  }, [startDate, endDate])

  const fetchTrialBalance = async () => {
    try {
      setLoading(true)
      setError('')
      const token = sessionStorage.getItem('authenticated')
      const params = new URLSearchParams()
      if (startDate) params.append('start_date', startDate)
      if (endDate) params.append('end_date', endDate)
      const url = `${API.reportsTrialBalance()}${params.toString() ? '?' + params : ''}`
      const res = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      })
      if (!res.ok) throw new Error(`Server responded with ${res.status}`)
      const result = await res.json()
      if (result.success) setData(result.data || [])
      else setError(result.message || 'Failed to fetch trial balance')
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

  const formatDate = (ds) => {
    if (!ds) return ''
    const d = new Date(ds)
    return d.toLocaleDateString('en-PH', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
    })
  }

  const { filtered, totalDebit, totalCredit, isBalanced } = useMemo(() => {
    const q = searchTerm.toLowerCase()
    const f = data.filter(
      (r) =>
        r['Account Name']?.toLowerCase().includes(q) ||
        r['Account Code']?.toString().includes(q),
    )
    const td = f.reduce((s, i) => s + parseFloat(i.DEBIT || 0), 0)
    const tc = f.reduce((s, i) => s + parseFloat(i.CREDIT || 0), 0)
    return {
      filtered: f,
      totalDebit: td,
      totalCredit: tc,
      isBalanced: Math.abs(td - tc) < 0.01,
    }
  }, [data, searchTerm])

  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet([])

    const setCell = (ws, addr, value, style) => {
      if (!ws[addr]) ws[addr] = {}
      ws[addr].v = value
      ws[addr].t = typeof value === 'number' ? 'n' : 's'
      if (style) ws[addr].s = style
    }

    const BLACK_BG = { fgColor: { rgb: '111827' } }
    const RED_BG = { fgColor: { rgb: 'DC2626' } }
    const GRAY_BG = { fgColor: { rgb: 'F9FAFB' } }
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
      border: { right: { style: 'thin', color: { rgb: '374151' } } },
    })

    const bodyCell = (fill = 'FFFFFF', align = 'left') => ({
      font: { bold: false, color: { rgb: '111827' }, name: 'Calibri', sz: 10 },
      fill: { fgColor: { rgb: fill } },
      alignment: { horizontal: align, vertical: 'center' },
      border: BORDER_GRAY,
    })

    const footStyle = (align = 'left') => ({
      font: { bold: true, color: { rgb: 'FFFFFF' }, name: 'Calibri', sz: 10 },
      fill: { fgColor: { rgb: '111827' } },
      alignment: { horizontal: align, vertical: 'center' },
      border: BORDER_TOTAL,
    })

    let r = 1

    ;['A', 'B', 'C', 'D'].forEach((c) => {
      setCell(ws, `${c}${r}`, c === 'A' ? 'TRIAL BALANCE' : '', {
        font: { bold: true, color: { rgb: 'FFFFFF' }, name: 'Calibri', sz: 13 },
        fill: BLACK_BG,
        alignment: { horizontal: 'left', vertical: 'center' },
      })
    })
    r++
    ;['A', 'B', 'C', 'D'].forEach((c) => {
      setCell(
        ws,
        `${c}${r}`,
        c === 'A'
          ? `Period: ${formatDate(startDate) || 'All'} — ${formatDate(endDate) || 'All'}`
          : c === 'D'
            ? `Generated: ${new Date().toLocaleDateString('en-PH')}`
            : '',
        {
          font: { bold: false, color: { rgb: '6B7280' }, name: 'Calibri', sz: 9 },
          fill: BLACK_BG,
          alignment: {
            horizontal: c === 'D' ? 'right' : 'left',
            vertical: 'center',
          },
        },
      )
    })
    r++

    r++

    setCell(ws, `A${r}`, 'ACCOUNT CODE', whiteOnBlack(true))
    setCell(ws, `B${r}`, 'ACCOUNT NAME', whiteOnBlack(true))
    setCell(ws, `C${r}`, 'DEBIT (₱)', whiteOnBlack(true))
    setCell(ws, `D${r}`, 'CREDIT (₱)', whiteOnBlack(true))
    r++

    const fill = 'FFFFFF'
    filtered.forEach((row, idx) => {
      const rowFill = idx % 2 === 0 ? 'FFFFFF' : 'F9FAFB'
      setCell(ws, `A${r}`, row['Account Code'], bodyCell(rowFill, 'left'))
      setCell(ws, `B${r}`, row['Account Name'], bodyCell(rowFill, 'left'))
      ws[`C${r}`] = {
        v: parseFloat(row.DEBIT || 0),
        t: 'n',
        z: '#,##0.00',
        s: bodyCell(rowFill, 'right'),
      }
      ws[`D${r}`] = {
        v: parseFloat(row.CREDIT || 0),
        t: 'n',
        z: '#,##0.00',
        s: bodyCell(rowFill, 'right'),
      }
      r++
    })

    setCell(ws, `A${r}`, 'TOTAL', footStyle('left'))
    setCell(ws, `B${r}`, `${filtered.length} accounts`, footStyle('left'))
    ws[`C${r}`] = {
      v: totalDebit,
      t: 'n',
      z: '#,##0.00',
      s: footStyle('right'),
    }
    ws[`D${r}`] = {
      v: totalCredit,
      t: 'n',
      z: '#,##0.00',
      s: {
        ...footStyle('right'),
        font: { bold: true, color: { rgb: 'FCA5A5' }, name: 'Calibri', sz: 10 },
      },
    }

    ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r, c: 3 } })
    ws['!cols'] = [{ wch: 16 }, { wch: 36 }, { wch: 18 }, { wch: 18 }]
    ws['!rows'] = [{ hpt: 24 }, { hpt: 16 }, { hpt: 6 }, { hpt: 18 }]
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 3 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 3 } },
    ]

    XLSX.utils.book_append_sheet(wb, ws, 'Trial Balance')
    XLSX.writeFile(
      wb,
      `trial-balance-${new Date().toISOString().split('T')[0]}.xlsx`,
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
    const M = 36 // 0.5 inch margins

    // Palette: Modern corporate slate/navy theme
    const BRAND = [15, 23, 42]     // Slate 900
    const TEXT_MAIN = [30, 41, 59] // Slate 800
    const MUTED = [100, 116, 139]  // Slate 500
    const BORDER = [226, 232, 240] // Slate 200
    const BG_ALT = [248, 250, 252] // Slate 50
    const SUCCESS = [16, 185, 129] // Emerald 500
    const DANGER = [239, 68, 68]   // Red 500

    // 1. Render Company Header
    let y = renderPDFCompanyHeader(doc, company, W, M)

    // 2. Document Title Section (Clean, subtle border without heavy black bars)
    doc.setDrawColor(...BORDER)
    doc.setLineWidth(1)
    doc.line(M, y, W - M, y)
    y += 14

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(14)
    doc.setTextColor(...BRAND)
    doc.text('TRIAL BALANCE', M, y)

    // Status Pill Badge (Balanced / Unbalanced)
    const statusText = isBalanced ? 'BALANCED' : 'UNBALANCED'
    const statusColor = isBalanced ? SUCCESS : DANGER
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(...statusColor)
    doc.text(statusText, W - M, y, { align: 'right' })

    y += 12

    // Meta details subtext
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...MUTED)
    const periodStr = `Period: ${formatDate(startDate) || 'All Dates'} — ${formatDate(endDate) || 'All Dates'}`
    const genStr = `Generated: ${new Date().toLocaleDateString('en-PH')}  |  ${filtered.length} accounts`
    doc.text(periodStr, M, y)
    doc.text(genStr, W - M, y, { align: 'right' })

    y += 12

    // 3. Format Data (Use 'PHP' or 'Php' instead of '₱' to prevent encoding box glitches)
    const cleanFmt = (val) => {
      const formatted = fmt(parseFloat(val || 0))
      return formatted.replace('₱', 'Php ')
    }

    const body = filtered.map((row) => [
      row['Account Code'] || '',
      row['Account Name'] || '',
      cleanFmt(row.DEBIT),
      cleanFmt(row.CREDIT),
    ])

    // 4. Generate AutoTable with proportional widths
    autoTable(doc, {
      startY: y,
      margin: { left: M, right: M, top: 50, bottom: 40 },
      tableWidth: W - M * 2,
      head: [
        [
          { content: 'ACCOUNT CODE', styles: { halign: 'left' } },
          { content: 'ACCOUNT NAME', styles: { halign: 'left' } },
          { content: 'DEBIT (Php)', styles: { halign: 'right' } },
          { content: 'CREDIT (Php)', styles: { halign: 'right' } },
        ],
      ],
      body: body,
      foot: [
        [
          {
            content: 'TOTAL',
            colSpan: 2,
            styles: { halign: 'left', fontStyle: 'bold' },
          },
          {
            content: cleanFmt(totalDebit),
            styles: { halign: 'right', fontStyle: 'bold' },
          },
          {
            content: cleanFmt(totalCredit),
            styles: { halign: 'right', fontStyle: 'bold' },
          },
        ],
      ],
      theme: 'plain',
      headStyles: {
        fillColor: BRAND,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8.5,
        cellPadding: { top: 7, bottom: 7, left: 8, right: 8 },
      },
      styles: {
        fontSize: 8.5,
        font: 'helvetica',
        cellPadding: { top: 6, bottom: 6, left: 8, right: 8 },
        textColor: TEXT_MAIN,
        lineColor: BORDER,
        lineWidth: 0.5,
        valign: 'middle',
      },
      alternateRowStyles: {
        fillColor: BG_ALT,
      },
      footStyles: {
        fillColor: [241, 245, 249], // Soft gray highlight for footer summary
        textColor: BRAND,
        fontStyle: 'bold',
        fontSize: 9,
        cellPadding: { top: 8, bottom: 8, left: 8, right: 8 },
        lineColor: BRAND,
        lineWidth: { top: 1.5, bottom: 1.5, left: 0, right: 0 },
      },
      columnStyles: {
        0: { cellWidth: 90, halign: 'left', fontStyle: 'bold' }, // Expanded to fit full codes comfortably
        1: { cellWidth: 'auto', halign: 'left' },               // Flexible space for full account names
        2: { cellWidth: 105, halign: 'right', fontStyle: 'bold' }, // Adequate room for currency amounts
        3: { cellWidth: 105, halign: 'right', fontStyle: 'bold' }, // Adequate room for currency amounts
      },
      didDrawPage: (data) => {
        // Dynamic Page Footer (Page X of Y)
        const totalPages = doc.internal.getNumberOfPages()
        const currentPage = data.pageNumber

        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8)
        doc.setTextColor(...MUTED)
        doc.text(
          `Page ${currentPage} of ${totalPages}`,
          W - M,
          H - 20,
          { align: 'right' }
        )
        doc.text(
          'Confidential — For Internal Financial Reporting Only',
          M,
          H - 20
        )
      },
    })

    doc.save(`trial-balance-${new Date().toISOString().split('T')[0]}.pdf`)
    if (typeof setExportMenuOpen === 'function') {
      setExportMenuOpen(false)
    }
  } catch (err) {
    console.error('PDF export error:', err)
  }
}

  if (loading)
    return <LoadingScreen label="Loading Trial Balance..." />

  if (error)
    return (
      <div className="p-10">
        <div className="bg-red-50 border-l-4 border-red-600 p-6 rounded-r-xl">
          <h3 className="text-red-800 font-bold uppercase text-sm">Error</h3>
          <p className="text-red-600 text-sm mt-1">{error}</p>
          <button
            onClick={fetchTrialBalance}
            className="mt-3 px-4 py-2 bg-red-600 text-white text-xs font-black rounded-lg uppercase tracking-widest hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    )

  return (
    <div className="flex flex-col gap-2 bg-[#F3F4F6] h-full custom-scrollbar">
      {/* HEADER */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-black rounded-xl flex-shrink-0">
            <Table2 size={22} className="text-red-500" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-black tracking-tighter leading-none">
              Trial <span className="text-red-600 italic">Balance</span>
            </h1>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-[2px] mt-1">
              General Ledger Report
            </p>
          </div>
        </div>
        <div className="flex gap-2 items-center relative">
          {/* Date range, restyled as one grouped control.

              This was two separate white boxes on a white header, so it read as
              two blank inputs rather than a single "from here to here" filter.
              One bordered, tinted container reads as a single unit, and the
              inputs inside it drop their own borders so there is a single edge
              around the pair rather than four. The state, values and handlers
              are untouched - this is presentation only. */}
          <div className="flex flex-col md:flex-row md:items-center gap-2 w-full md:w-auto rounded-xl border border-slate-200 bg-slate-50 pl-3 pr-2 py-1.5 shadow-sm">
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-[2px]">From</span>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full md:w-auto bg-transparent px-1 py-1 md:py-0.5 text-[11px] font-bold text-slate-800 outline-none" />
            <span className="hidden md:inline text-slate-300 text-[11px] leading-none">→</span>
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-[2px]">To</span>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full md:w-auto bg-transparent px-1 py-1 md:py-0.5 text-[11px] font-bold text-slate-800 outline-none" />
            <span className="hidden md:block mx-1 h-5 w-px bg-slate-200" />
            <button
              onClick={() => {
              setStartDate('')
              setEndDate('')
              setSearchTerm('')
            }}
              className="w-full md:w-auto px-2.5 py-2 md:py-1 rounded-lg border border-slate-300 bg-white text-[9px] font-black text-slate-700 uppercase tracking-widest hover:border-red-500 hover:text-red-600 transition-colors cursor-pointer"
            >
              Reset
            </button>
            <button
              onClick={() => {
              const t = new Date().toISOString().split('T')[0]
              setStartDate(t)
              setEndDate(t)
            }}
              className="w-full md:w-auto px-2.5 py-2 md:py-1 rounded-lg bg-slate-900 text-[9px] font-black text-white uppercase tracking-widest hover:bg-red-600 transition-colors cursor-pointer"
            >
              Today
            </button>
          </div>
          <div className="relative">
            <button
              onClick={() => setExportMenuOpen((p) => !p)}
              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-[11px] font-black text-white rounded-xl hover:bg-emerald-700 uppercase tracking-widest transition-colors"
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
                  Export PDF
                </button>
                <button
                  type="button"
                  onClick={handleExportExcel}
                  className="w-full text-left px-4 py-3 text-[11px] font-black text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  Export Excel
                </button>
              </div>
            )}
          </div>
          <button
            onClick={fetchTrialBalance}
            className="w-10 h-10 bg-red-600 text-white rounded-xl hover:bg-red-700 flex items-center justify-center transition-colors"
          >
            <RefreshCcw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* STAT CARDS — all 4 in one row */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <SummaryTile
          label="Total Accounts"
          value={filtered.length}
          subText="Active Records"
          color="emerald"
          icon={Table2}
        />
        <SummaryTile
          label="Total Debit"
          value={`₱${fmt(totalDebit)}`}
          subText="PHP"
          color="blue"
          icon={Wallet}
        />
        <SummaryTile
          label="Total Credit"
          value={`₱${fmt(totalCredit)}`}
          subText="PHP"
          color="orange"
          icon={Wallet}
        />
        <SummaryTile
          label="Audit Status"
          value={isBalanced ? 'Verified' : 'Discrepancy'}
          subText="Balance Check"
          color={isBalanced ? 'emerald' : 'rose'}
          icon={CheckCircle}
        />
      </div>

      {/* TABLE CARD */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col flex-1 overflow-hidden min-h-0 custom-scrollbar">
        {/* Table header bar */}
        <div className="flex flex-wrap items-center gap-2 px-4 sm:px-5 py-3 bg-black flex-shrink-0">
          <Table2 size={14} className="text-gray-500" />
          <span className="text-[11px] font-black uppercase tracking-[3px] text-white">
            Account Ledger
          </span>
          <span className="text-[10px] font-bold text-gray-600 ml-1">
            {filtered.length} records
          </span>
            {/* Search sits in the table header rather than in a separate white
                card above it: the control that filters the table belongs on the
                table. Colours are for the black bar - the old grey-on-grey
                placeholder and clear button were invisible against it. */}
            <div className="ml-auto w-full sm:w-auto flex items-center gap-2 bg-white rounded-lg px-2.5 h-9 sm:h-7 shadow-sm">
              <Search size={13} className="text-gray-400 flex-shrink-0" />
              <input
                type="text"
                placeholder="Search by account name or code..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1 sm:flex-none w-full sm:w-44 bg-transparent border-none outline-none text-[11px] font-bold text-gray-900 placeholder:text-gray-400 placeholder:font-semibold"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="text-gray-400 hover:text-gray-900 text-sm leading-none transition-colors"
                >
                  ×
                </button>
              )}
            </div>
            <div>
            {isBalanced ? (
              <span className="px-2.5 py-1 bg-green-100 text-green-800 text-[9px] font-black uppercase rounded-md tracking-widest">
                Balanced
              </span>
            ) : (
              <span className="px-2.5 py-1 bg-red-100 text-red-800 text-[9px] font-black uppercase rounded-md tracking-widest">
                Unbalanced
              </span>
            )}
          </div>
        </div>

        {/* Scrollable body */}
        <div
          className="overflow-y-auto overflow-x-auto custom-scrollbar flex-1 min-h-0"
        >
          <table
            className="w-full border-collapse"
            style={{ tableLayout: 'fixed', minWidth: '480px' }}
          >
            <colgroup>
              <col style={{ width: '12%' }} />
              <col style={{ width: '46%' }} />
              <col style={{ width: '21%' }} />
              <col style={{ width: '21%' }} />
            </colgroup>
            <thead className="sticky top-0 z-10">
              <tr className="bg-gray-50 border-b border-gray-100">
                {['Code', 'Account Name', 'Debit', 'Credit'].map((h, i) => (
                  <th
                    key={i}
                    className={`py-3 px-4 text-[12px] font-black uppercase tracking-[1.5px] text-black ${i >= 2 ? 'text-right border-l border-gray-200' : 'text-left'}`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="py-16 text-center text-[12px] font-bold text-gray-300"
                  >
                    No accounts match your search
                  </td>
                </tr>
              ) : (
                filtered.map((row, i) => (
                  <tr key={i} className="hover:bg-red-100 hover:border-l-4 hover:border-red-600 hover:shadow-sm transition-colors">
                    <td className="py-3 px-4 text-[11px] font-bold text-gray-400">
                      {row['Account Code']}
                    </td>
                    <td className="py-3 px-4 text-[13px] font-bold text-black">
                      <button
                        onClick={() => handleAccountNameClick(row['Account Code'])}
                        className="group flex items-center gap-1.5 hover:text-red-600 hover:bg-red-50 hover:underline cursor-pointer transition-all rounded px-2 py-1 text-left"
                        title="View in General Ledger"
                      >
                        {row['Account Name']}
                        <ArrowUpRight size={10} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-[16px] font-black text-black border-l border-gray-200">
                      {parseFloat(row.DEBIT) > 0 ? (
                        <button
                          onClick={() => handleAmountClick(row['Account Code'], row.DEBIT, 'debit')}
                          className="group flex items-center justify-end gap-1.5 hover:text-red-600 hover:bg-red-50 hover:underline cursor-pointer transition-all rounded px-2 py-1"
                          title="View in General Ledger"
                        >
                          {fmt(row.DEBIT)}
                          <ArrowUpRight size={10} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                      ) : (
                        <span className="text-gray-200">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-[16px] font-black text-red-600 border-l border-gray-200">
                      {parseFloat(row.CREDIT) > 0 ? (
                        <button
                          onClick={() => handleAmountClick(row['Account Code'], row.CREDIT, 'credit')}
                          className="group flex items-center justify-end gap-1.5 hover:text-black hover:bg-red-50 hover:underline cursor-pointer transition-all rounded px-2 py-1"
                          title="View in General Ledger"
                        >
                          {fmt(row.CREDIT)}
                          <ArrowUpRight size={10} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                      ) : (
                        <span className="text-gray-200">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Totals footer — outside scroll, always visible */}
        <div className="border-t-4 border-red-600 bg-black flex-shrink-0">
          <table
            className="w-full border-collapse"
            style={{ tableLayout: 'fixed', minWidth: '480px' }}
          >
            <colgroup>
              <col style={{ width: '12%' }} />
              <col style={{ width: '46%' }} />
              <col style={{ width: '21%' }} />
              <col style={{ width: '21%' }} />
            </colgroup>
            <tbody>
              <tr>
                <td
                  colSpan="2"
                  className="py-3 px-4 text-[11px] font-black text-white uppercase tracking-[3px]"
                >
                  Totals
                </td>
                <td className="py-3 px-4 text-right font-mono text-[14px] font-black text-white border-l border-gray-600">
                  PHP {fmt(totalDebit)}
                </td>
                <td className="py-3 px-4 text-right font-mono text-[14px] font-black text-red-400 border-l border-gray-600">
                  PHP {fmt(totalCredit)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function SummaryTile({ label, value, subText, color, icon: Icon }) {
  const theme = {
    emerald: {
      text: 'text-emerald-600 dark:text-emerald-400',
      badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      bar: 'bg-emerald-500',
      bg: 'bg-emerald-500',
      textOnActive: 'text-white'
    },
    amber: {
      text: 'text-amber-600 dark:text-amber-400',
      badgeBg: 'bg-amber-50 text-amber-700 border-amber-200',
      bar: 'bg-amber-500',
      bg: 'bg-amber-500',
      textOnActive: 'text-white'
    },
    orange: {
      text: 'text-orange-600 dark:text-orange-400',
      badgeBg: 'bg-orange-50 text-orange-700 border-orange-200',
      bar: 'bg-orange-500',
      bg: 'bg-orange-500',
      textOnActive: 'text-white'
    },
    rose: {
      text: 'text-rose-600 dark:text-rose-400',
      badgeBg: 'bg-rose-50 text-rose-700 border-rose-200',
      bar: 'bg-rose-500',
      bg: 'bg-rose-500',
      textOnActive: 'text-white'
    },
    blue: {
      text: 'text-blue-600 dark:text-blue-400',
      badgeBg: 'bg-blue-50 text-blue-700 border-blue-200',
      bar: 'bg-blue-500',
      bg: 'bg-blue-500',
      textOnActive: 'text-white'
    },
    dark: {
      text: 'text-emerald-400',
      badgeBg: 'bg-emerald-950 text-emerald-300 border-emerald-800/50',
      bar: 'bg-emerald-400',
      bg: 'bg-emerald-400',
      textOnActive: 'text-white'
    },
  }[color] || {
    text: 'text-gray-700',
    badgeBg: 'bg-gray-50 text-gray-700 border-gray-200',
    bar: 'bg-gray-400',
    bg: 'bg-gray-400',
    textOnActive: 'text-white'
  }

  const bgClass = color === 'dark'
    ? 'bg-slate-900 text-white border-slate-800'
    : 'bg-white text-gray-900 border-gray-200/80 shadow-xs'

  const activeBgClass = bgClass

  const isClickable = false

  return (
    <div
      className={`${activeBgClass} p-3 rounded-xl border relative overflow-hidden flex flex-col justify-between h-full hover:scale-105 hover:shadow-lg group transition-all duration-300`}
    >
      {/* Bottom Accent Indicator - Animates on hover (behind content) */}
      <div className={`absolute bottom-0 left-0 right-0 h-1 ${theme.bar} group-hover:h-full transition-all duration-300 z-0`} />

      {/* Content wrapper with higher z-index */}
      <div className="relative z-10 flex flex-col justify-between h-full">
        {/* Top Header Row */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full border ${theme.badgeBg} group-hover:bg-white group-hover:text-gray-900 group-hover:border-white`}>
            {label}
          </span>
          <span className={`text-xs font-medium text-gray-400 group-hover:text-white/80`}>
            {subText}
          </span>
        </div>

        {/* Value Row with Icon */}
        <div className="flex items-center gap-2 my-1">
          {Icon && (
            <Icon size={20} className={`${color === 'dark' ? theme.text : 'text-gray-600'} group-hover:text-white transition-colors`} />
          )}
          <span className={`text-2xl font-bold font-mono tracking-tight ${color === 'dark' ? theme.text : 'text-black'} group-hover:text-white`}>
            {value}
          </span>
        </div>
      </div>
    </div>
  )
}
