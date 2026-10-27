import React, { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Table2,
  Download,
  DollarSign,
  TrendingUp,
  TrendingDown,
  RefreshCcw,
  Calendar,
  FileText,
  ArrowUpRight,
  Wallet,
  ShieldCheck,
} from 'lucide-react'
import * as XLSX from 'xlsx'
import useCompany from '../company/useCompany'
import { renderPDFCompanyHeader } from '../../utils/pdfCompanyHeader'
import LoadingScreen from '../../components/LoadingScreen'
import { currentReportPeriod } from '../../utils/reportPeriod'
import { API } from '../../api/endpoints'

export default function IncomeStatement() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
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

  const netIncomeColorClass =
    data?.netIncome >= 0 ? 'text-green-600' : 'text-red-600'

  useEffect(() => {
    fetchIncomeStatement()
  }, [])

  const fetchIncomeStatement = async () => {
    try {
      setLoading(true)
      setError('')
      const token = sessionStorage.getItem('authenticated')
      const params = new URLSearchParams()
      if (startDate) params.append('start_date', startDate)
      if (endDate) params.append('end_date', endDate)
      const url = `${API.reportsIncomeStatement()}${params.toString() ? '?' + params : ''}`

      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      })
      const result = await response.json()
      if (result.success) setData(result.data)
      else setError(result.message || 'Failed to fetch income statement')
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

  const handleAccountNameClick = (accountCode) => {
    const params = new URLSearchParams()
    params.append('account_code', accountCode)
    if (startDate) params.append('start_date', startDate)
    if (endDate) params.append('end_date', endDate)
    navigate(`/general-ledger?${params.toString()}`)
  }

  const handleAmountClick = (accountCode) => {
    const params = new URLSearchParams()
    params.append('account_code', accountCode)
    if (startDate) params.append('start_date', startDate)
    if (endDate) params.append('end_date', endDate)
    navigate(`/general-ledger?${params.toString()}`)
  }

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
    const GREEN_BG = { fgColor: { rgb: '059669' } }
    const RED_BG = { fgColor: { rgb: 'DC2626' } }
    const GRAY_BG = { fgColor: { rgb: 'F9FAFB' } }
    const BORDER_GRAY = {
      top: { style: 'thin', color: { rgb: 'E5E7EB' } },
      bottom: { style: 'thin', color: { rgb: 'E5E7EB' } },
      left: { style: 'thin', color: { rgb: 'E5E7EB' } },
      right: { style: 'thin', color: { rgb: 'E5E7EB' } },
    }
    const BORDER_SECTION = {
      top: { style: 'medium', color: { rgb: '111827' } },
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

    const sectionHeader = (color) => ({
      font: { bold: true, color: { rgb: 'FFFFFF' }, name: 'Calibri', sz: 11 },
      fill: { fgColor: { rgb: color } },
      alignment: { horizontal: 'left', vertical: 'center' },
      border: BORDER_SECTION,
    })

    const subtotalStyle = (align = 'left') => ({
      font: { bold: true, color: { rgb: 'FFFFFF' }, name: 'Calibri', sz: 10 },
      fill: { fgColor: { rgb: '374151' } },
      alignment: { horizontal: align, vertical: 'center' },
      border: BORDER_TOTAL,
    })

    let r = 1

    ;['A', 'B', 'C'].forEach((c) => {
      setCell(ws, `${c}${r}`, c === 'A' ? 'INCOME STATEMENT' : '', {
        font: { bold: true, color: { rgb: 'FFFFFF' }, name: 'Calibri', sz: 13 },
        fill: BLACK_BG,
        alignment: { horizontal: 'left', vertical: 'center' },
      })
    })
    r++
    ;['A', 'B', 'C'].forEach((c) => {
      setCell(
        ws,
        `${c}${r}`,
        c === 'A'
          ? `Period: ${formatDate(startDate) || 'All'} — ${formatDate(endDate) || 'All'}`
          : c === 'C'
            ? `Generated: ${new Date().toLocaleDateString('en-PH')}`
            : '',
        {
          font: { bold: false, color: { rgb: '6B7280' }, name: 'Calibri', sz: 9 },
          fill: BLACK_BG,
          alignment: {
            horizontal: c === 'C' ? 'right' : 'left',
            vertical: 'center',
          },
        },
      )
    })
    r++

    r++

    // REVENUES SECTION
    setCell(ws, `A${r}`, 'REVENUES', sectionHeader('059669'))
    setCell(ws, `B${r}`, '', sectionHeader('059669'))
    setCell(ws, `C${r}`, '', sectionHeader('059669'))
    r++

    setCell(ws, `A${r}`, 'CODE', whiteOnBlack(true))
    setCell(ws, `B${r}`, 'ACCOUNT NAME', whiteOnBlack(true))
    setCell(ws, `C${r}`, 'AMOUNT (₱)', whiteOnBlack(true))
    r++

    const revenueStartRow = r
    data.revenues?.forEach((row, idx) => {
      const rowFill = idx % 2 === 0 ? 'FFFFFF' : 'F9FAFB'
      setCell(ws, `A${r}`, row['Account Code'], bodyCell(rowFill, 'left'))
      setCell(ws, `B${r}`, row['Account Name'], bodyCell(rowFill, 'left'))
      ws[`C${r}`] = {
        v: parseFloat(row.Current || 0),
        t: 'n',
        z: '#,##0.00',
        s: bodyCell(rowFill, 'right'),
      }
      r++
    })

    setCell(ws, `A${r}`, 'TOTAL REVENUES', subtotalStyle('left'))
    setCell(ws, `B${r}`, '', subtotalStyle('left'))
    ws[`C${r}`] = {
      v: data.totalRevenues || 0,
      t: 'n',
      z: '#,##0.00',
      s: subtotalStyle('right'),
    }
    r++

    r++

    // EXPENSES SECTION
    setCell(ws, `A${r}`, 'EXPENSES', sectionHeader('DC2626'))
    setCell(ws, `B${r}`, '', sectionHeader('DC2626'))
    setCell(ws, `C${r}`, '', sectionHeader('DC2626'))
    r++

    setCell(ws, `A${r}`, 'CODE', whiteOnBlack(true))
    setCell(ws, `B${r}`, 'ACCOUNT NAME', whiteOnBlack(true))
    setCell(ws, `C${r}`, 'AMOUNT (₱)', whiteOnBlack(true))
    r++

    data.expenses?.forEach((row, idx) => {
      const rowFill = idx % 2 === 0 ? 'FFFFFF' : 'F9FAFB'
      setCell(ws, `A${r}`, row['Account Code'], bodyCell(rowFill, 'left'))
      setCell(ws, `B${r}`, row['Account Name'], bodyCell(rowFill, 'left'))
      ws[`C${r}`] = {
        v: parseFloat(row.Current || 0),
        t: 'n',
        z: '#,##0.00',
        s: bodyCell(rowFill, 'right'),
      }
      r++
    })

    setCell(ws, `A${r}`, 'TOTAL EXPENSES', subtotalStyle('left'))
    setCell(ws, `B${r}`, '', subtotalStyle('left'))
    ws[`C${r}`] = {
      v: data.totalExpenses || 0,
      t: 'n',
      z: '#,##0.00',
      s: subtotalStyle('right'),
    }
    r++

    r++

    // NET INCOME
    const netIncomeStyle = (align = 'left') => ({
      font: { bold: true, color: { rgb: 'FFFFFF' }, name: 'Calibri', sz: 11 },
      fill: { fgColor: { rgb: data.netIncome >= 0 ? '059669' : 'DC2626' } },
      alignment: { horizontal: align, vertical: 'center' },
      border: {
        top: { style: 'thick', color: { rgb: '111827' } },
        bottom: { style: 'thin' },
      },
    })

    setCell(ws, `A${r}`, 'NET INCOME', netIncomeStyle('left'))
    setCell(ws, `B${r}`, '', netIncomeStyle('left'))
    ws[`C${r}`] = {
      v: data.netIncome || 0,
      t: 'n',
      z: '#,##0.00',
      s: netIncomeStyle('right'),
    }

    ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r, c: 2 } })
    ws['!cols'] = [{ wch: 16 }, { wch: 36 }, { wch: 18 }]
    ws['!rows'] = [{ hpt: 24 }, { hpt: 16 }, { hpt: 6 }, { hpt: 18 }]
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 2 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 2 } },
    ]

    XLSX.utils.book_append_sheet(wb, ws, 'Income Statement')
    XLSX.writeFile(
      wb,
      `income-statement-${new Date().toISOString().split('T')[0]}.xlsx`,
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

      const BLK = [17, 24, 39]      // Slate 900 (Unified Header Theme)
      const GRY = [100, 116, 139]   // Slate 500
      const LGT = [226, 232, 240]   // Slate 200
      const WHT = [255, 255, 255]
      const BG_ALT = [248, 250, 252]// Slate 50
      const SUCCESS = [16, 185, 129] // Emerald 500
      const DANGER = [239, 68, 68]   // Red 500

      // Document Title Section
      doc.setDrawColor(...LGT)
      doc.setLineWidth(1)
      doc.line(M, y, W - M, y)
      y += 14

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(14)
      doc.setTextColor(...BLK)
      doc.text('INCOME STATEMENT', M, y)

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.setTextColor(...GRY)
      doc.text('Profit & Loss Summary', W - M, y, { align: 'right' })

      y += 12
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(...GRY)
      doc.text(
        `Period: ${formatDate(startDate) || 'All Dates'} — ${formatDate(endDate) || 'All Dates'}`,
        M,
        y,
      )
      doc.text(
        `Generated: ${new Date().toLocaleDateString('en-PH')}`,
        W - M,
        y,
        { align: 'right' },
      )
      y += 16

      // Currency formatter helper
      const cleanFmt = (val) => {
        const formatted = fmt(parseFloat(val || 0))
        return formatted.replace('₱', 'Php ')
      }

      // ── 1. REVENUES TABLE ────────────────────────────────────────────────
      const revenueBody =
        data.revenues?.map((row) => [
          row['Account Code'] || '',
          row['Account Name'] || '',
          cleanFmt(row.Current),
        ]) || []

      autoTable(doc, {
        startY: y,
        margin: { left: M, right: M },
        tableWidth: W - M * 2,
        head: [
          [
            { content: 'REVENUES', colSpan: 3, styles: { fillColor: BLK, textColor: WHT, fontStyle: 'bold', fontSize: 9 } }
          ],
          [
            { content: 'ACCOUNT CODE', styles: { halign: 'left' } },
            { content: 'ACCOUNT NAME', styles: { halign: 'left' } },
            { content: 'AMOUNT (Php)', styles: { halign: 'right' } },
          ],
        ],
        body: revenueBody,
        foot: [
          [
            {
              content: 'TOTAL REVENUES',
              colSpan: 2,
              styles: { halign: 'left', fontStyle: 'bold' },
            },
            {
              content: cleanFmt(data.totalRevenues || 0),
              styles: { halign: 'right', fontStyle: 'bold', textColor: [16, 185, 129] },
            },
          ],
        ],
        theme: 'plain',
        headStyles: {
          fillColor: [51, 65, 85], // Slate 700 for subheaders
          textColor: WHT,
          fontStyle: 'bold',
          fontSize: 8.5,
          cellPadding: { top: 6, bottom: 6, left: 8, right: 8 },
        },
        alternateRowStyles: { fillColor: BG_ALT },
        styles: {
          fontSize: 8.5,
          font: 'helvetica',
          cellPadding: { top: 5, bottom: 5, left: 8, right: 8 },
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
          0: { cellWidth: 90, halign: 'left', fontStyle: 'bold' },
          1: { cellWidth: 'auto', halign: 'left' },
          2: { cellWidth: 110, halign: 'right', fontStyle: 'bold' },
        },
      })

      y = doc.lastAutoTable.finalY + 14

      // ── 2. EXPENSES TABLE ────────────────────────────────────────────────
      const expenseBody =
        data.expenses?.map((row) => [
          row['Account Code'] || '',
          row['Account Name'] || '',
          cleanFmt(row.Current),
        ]) || []

      autoTable(doc, {
        startY: y,
        margin: { left: M, right: M },
        tableWidth: W - M * 2,
        head: [
          [
            { content: 'EXPENSES', colSpan: 3, styles: { fillColor: BLK, textColor: WHT, fontStyle: 'bold', fontSize: 9 } }
          ],
          [
            { content: 'ACCOUNT CODE', styles: { halign: 'left' } },
            { content: 'ACCOUNT NAME', styles: { halign: 'left' } },
            { content: 'AMOUNT (Php)', styles: { halign: 'right' } },
          ],
        ],
        body: expenseBody,
        foot: [
          [
            {
              content: 'TOTAL EXPENSES',
              colSpan: 2,
              styles: { halign: 'left', fontStyle: 'bold' },
            },
            {
              content: cleanFmt(data.totalExpenses || 0),
              styles: { halign: 'right', fontStyle: 'bold', textColor: [239, 68, 68] },
            },
          ],
        ],
        theme: 'plain',
        headStyles: {
          fillColor: [51, 65, 85], // Slate 700 for subheaders
          textColor: WHT,
          fontStyle: 'bold',
          fontSize: 8.5,
          cellPadding: { top: 6, bottom: 6, left: 8, right: 8 },
        },
        alternateRowStyles: { fillColor: BG_ALT },
        styles: {
          fontSize: 8.5,
          font: 'helvetica',
          cellPadding: { top: 5, bottom: 5, left: 8, right: 8 },
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
          0: { cellWidth: 90, halign: 'left', fontStyle: 'bold' },
          1: { cellWidth: 'auto', halign: 'left' },
          2: { cellWidth: 110, halign: 'right', fontStyle: 'bold' },
        },
      })

      y = doc.lastAutoTable.finalY + 16

      // ── 3. DYNAMIC NET INCOME / NET LOSS SUMMARY BOX ─────────────────────
      const netIncomeVal = data.netIncome || 0
      const isNetPositive = netIncomeVal >= 0
      const netLabel = isNetPositive ? 'NET INCOME' : 'NET LOSS'
      const netBgColor = isNetPositive ? [6, 95, 70] : [153, 27, 27] // Emerald for income, Red for loss

      doc.setFillColor(...netBgColor)
      doc.roundedRect(M, y, W - M * 2, 32, 4, 4, 'F')

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(11)
      doc.setTextColor(...WHT)
      doc.text(netLabel, M + 12, y + 20) // Displays ONLY one correct label

      doc.setFontSize(12)
      doc.text(cleanFmt(netIncomeVal), W - M - 12, y + 20, { align: 'right' })

      // Page Footers (Page X of Y) across all pages
      const totalPages = doc.internal.getNumberOfPages()
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8)
        doc.setTextColor(...GRY)
        doc.text(`Page ${i} of ${totalPages}`, W - M, H - 20, { align: 'right' })
        doc.text('Confidential — For Internal Financial Reporting Only', M, H - 20)
      }

      doc.save(`income-statement-${new Date().toISOString().split('T')[0]}.pdf`)
      setExportMenuOpen(false)
    } catch (err) {
      console.error('PDF export error:', err)
    }
  }

  if (loading)
    return <LoadingScreen label="Calculating Profit & Loss..." />

  if (error)
    return (
      <div className="p-10">
        <div className="bg-red-50 border-l-4 border-red-600 p-6 rounded-r-xl">
          <h3 className="text-red-800 font-bold uppercase text-sm">Error</h3>
          <p className="text-red-600 text-sm mt-1">{error}</p>
          <button
            onClick={fetchIncomeStatement}
            className="mt-3 px-4 py-2 bg-red-600 text-white text-xs font-black rounded-lg uppercase tracking-widest hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    )

  return (
    <div className="flex flex-col gap-3 bg-[#F3F4F6] h-full  overflow-x-auto custom-scrollbar">
      {/* HEADER */}
      <div className="flex items-center justify-between flex-wrap gap-3 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-black rounded-xl shrink-0">
            <FileText size={22} className="text-red-500" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-black tracking-tighter leading-none">
              Income <span className="text-red-600 italic">Statement</span>
            </h1>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-[2px] mt-1">
              Profit & Loss Summary
            </p>
          </div>
        </div>
        <div className="flex gap-2 items-center relative">
                    {/* Date range filter — enlarged for comfortable clicking.
              Previously the date inputs were 11px transparent boxes (their whole
              clickable area nearly invisible) and the actions were 9px chips that
              didn't stand out from the header. Dates are now real bordered fields
              with visible FROM/TO labels, and Reset/Submit are full-size buttons.
              State, values and handlers are untouched. */}
          <div className="flex flex-col lg:flex-row lg:items-center gap-1.5 lg:gap-2 w-full md:w-auto bg-white border border-slate-300 rounded-xl p-2 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider shrink-0">From</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full lg:w-[7.5rem] shrink-0 bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-2 text-xs font-bold text-slate-700 outline-none cursor-pointer focus:outline-none focus:border-red-500 focus:ring-2 focus:ring-red-400/30 hover:border-slate-400 transition-colors"
              />
            </div>
            <span className="hidden lg:block h-6 w-px bg-slate-200 shrink-0" />
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider shrink-0">To</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full lg:w-[7.5rem] shrink-0 bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-2 text-xs font-bold text-slate-700 outline-none cursor-pointer focus:outline-none focus:border-red-500 focus:ring-2 focus:ring-red-400/30 hover:border-slate-400 transition-colors"
              />
            </div>
            <span className="hidden lg:block mx-1 h-6 w-px bg-slate-200 shrink-0" />
            <button
              onClick={() => {
                setStartDate('')
                setEndDate('')
              }}
              className="w-full lg:w-auto px-4 py-2 rounded-lg border border-slate-300 bg-white text-[11px] font-black text-slate-600 uppercase tracking-widest hover:border-red-500 hover:bg-red-50 hover:text-red-600 transition-colors cursor-pointer"
            >
              Reset
            </button>
            <button
              onClick={fetchIncomeStatement}
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
            onClick={fetchIncomeStatement}
            className="w-10 h-10 bg-red-600 text-white rounded-xl hover:bg-red-700 flex items-center justify-center transition-colors shadow-lg shadow-red-200"
          >
            <RefreshCcw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* STAT CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 flex-shrink-0">
        <SummaryTile
          label="Total Revenue"
          value={`₱${fmt(data?.totalRevenues)}`}
          subText="Gross Earnings"
          color="emerald"
          icon={TrendingUp}
        />
        <SummaryTile
          label="Total Expenses"
          value={`₱${fmt(data?.totalExpenses)}`}
          subText="Operating Costs"
          color="rose"
          icon={TrendingDown}
        />
        <SummaryTile
          label="Net Income"
          value={`₱${fmt(data?.netIncome)}`}
          subText="Bottom Line"
          color="dark"
          icon={Wallet}
        />
      </div>

      {/* CONTENT GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1 min-h-0">
        {/* REVENUE TABLE */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col  overflow-x-auto custom-scrollbar">
          <div className="flex flex-wrap items-center gap-2 px-4 sm:px-5 py-3 bg-black flex-shrink-0">
            <TrendingUp size={14} className="text-green-500" />
            <span className="text-[11px] font-black uppercase tracking-[3px] text-white">
              Revenues
            </span>
          </div>
          <div
            className="overflow-y-auto  overflow-x-auto custom-scrollbar flex-1 min-h-0"
          >
            <table className="w-full border-collapse">
              <thead className="sticky top-0 bg-gray-50 z-10">
                <tr className="border-b border-gray-100">
                  <th className="py-3 px-5 text-[11px] font-black uppercase text-gray-400 text-left">
                    Code
                  </th>
                  <th className="py-3 px-5 text-[11px] font-black uppercase text-gray-400 text-left">
                    Account Name
                  </th>
                  <th className="py-3 px-5 text-[11px] font-black uppercase text-gray-400 text-right">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.revenues?.map((item, i) => (
                  <tr key={i} className="hover:bg-red-100 hover:border-l-4 hover:border-red-600 hover:shadow-sm transition-colors">
                    <td className="py-3 px-5">
                      <p className="text-[10px] font-bold text-gray-400 uppercase">
                        {item['Account Code']}
                      </p>
                    </td>
                    <td className="py-3 px-5">
                      <button
                        onClick={() => handleAccountNameClick(item['Account Code'])}
                        className="group flex items-center gap-1.5 text-[13px] font-bold text-black hover:text-red-600 hover:bg-red-50 hover:underline cursor-pointer transition-all rounded px-2 py-1 text-left"
                        title="View in General Ledger"
                      >
                        {item['Account Name']}
                        <ArrowUpRight size={10} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>
                    </td>
                    <td className="py-3 px-5 text-right font-mono text-[15px] font-black text-black">
                      <button
                        onClick={() => handleAmountClick(item['Account Code'])}
                        className="group flex items-center justify-end gap-1.5 hover:text-red-600 hover:bg-red-50 hover:underline cursor-pointer transition-all rounded px-2 py-1"
                        title="View in General Ledger"
                      >
                        {fmt(item.Current)}
                        <ArrowUpRight size={10} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-auto bg-gray-50 border-t border-gray-100 px-5 py-3 flex justify-between items-center">
            <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest">
              Total Revenue
            </span>
            <span className="text-lg font-black text-green-600">
              ₱ {fmt(data.totalRevenues)}
            </span>
          </div>
        </div>

        {/* EXPENSES TABLE */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col  overflow-x-auto custom-scrollbar">
          <div className="flex items-center gap-2 px-5 py-3 bg-black flex-shrink-0">
            <TrendingDown size={14} className="text-red-500" />
            <span className="text-[11px] font-black uppercase tracking-[3px] text-white">
              Expenses
            </span>
          </div>
          <div
            className="overflow-y-auto  overflow-x-auto custom-scrollbar flex-1 min-h-0"
          >
            <table className="w-full border-collapse">
              <thead className="sticky top-0 bg-gray-50 z-10">
                <tr className="border-b border-gray-100">
                  <th className="py-3 px-5 text-[11px] font-black uppercase text-gray-400 text-left">
                    Code
                  </th>
                  <th className="py-3 px-5 text-[11px] font-black uppercase text-gray-400 text-left">
                    Account Name
                  </th>
                  <th className="py-3 px-5 text-[11px] font-black uppercase text-gray-400 text-right">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.expenses?.map((item, i) => (
                  <tr key={i} className="hover:bg-red-100 hover:border-l-4 hover:border-red-600 hover:shadow-sm transition-colors">
                    <td className="py-3 px-5">
                      <p className="text-[10px] font-bold text-gray-400 uppercase">
                        {item['Account Code']}
                      </p>
                    </td>
                    <td className="py-3 px-5">
                      <button
                        onClick={() => handleAccountNameClick(item['Account Code'])}
                        className="group flex items-center gap-1.5 text-[13px] font-bold text-black hover:text-red-600 hover:bg-red-50 hover:underline cursor-pointer transition-all rounded px-2 py-1 text-left"
                        title="View in General Ledger"
                      >
                        {item['Account Name']}
                        <ArrowUpRight size={10} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>
                    </td>
                    <td className="py-3 px-5 text-right font-mono text-[15px] font-black text-red-600">
                      <button
                        onClick={() => handleAmountClick(item['Account Code'])}
                        className="group flex items-center justify-end gap-1.5 hover:text-black hover:bg-red-50 hover:underline cursor-pointer transition-all rounded px-2 py-1"
                        title="View in General Ledger"
                      >
                        {fmt(item.Current)}
                        <ArrowUpRight size={10} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-auto bg-gray-50 border-t border-gray-100 px-5 py-3 flex justify-between items-center">
            <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest">
              Total Expenses
            </span>
            <span className="text-lg font-black text-red-600">
              ₱ {fmt(data.totalExpenses)}
            </span>
          </div>
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
      className={`${activeBgClass} p-3 rounded-xl border relative overflow-hidden flex flex-col justify-between h-full  group `}
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
