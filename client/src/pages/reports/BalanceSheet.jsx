import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BarChart3,
  Download,
  RefreshCcw,
  ShieldCheck,
  ShieldAlert,
  Equal,
  Plus,
  PieChart,
  Layers,
  Briefcase,
  ArrowUpRight,
} from 'lucide-react'
import * as XLSX from 'xlsx'
import useCompany from '../company/useCompany'
import { renderPDFCompanyHeader } from '../../utils/pdfCompanyHeader'
import LoadingScreen from '../../components/LoadingScreen'
import { currentReportPeriod } from '../../utils/reportPeriod'
import { API } from '../../api/endpoints'

export default function BalanceSheet() {
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [startDate, setStartDate] = useState(() => currentReportPeriod().start)
  const [endDate, setEndDate] = useState(() => currentReportPeriod().end)
  const [exportMenuOpen, setExportMenuOpen] = useState(false)
  const { company } = useCompany()

  useEffect(() => {
    fetchBalanceSheet()
  }, [])

  const fetchBalanceSheet = async () => {
    try {
      setLoading(true)
      setError('')
      const token = sessionStorage.getItem('authenticated')

      const params = new URLSearchParams()
      if (startDate) params.append('start_date', startDate)
      if (endDate) params.append('end_date', endDate)

      const url = `${API.reportsBalanceSheet()}${params.toString() ? '?' + params.toString() : ''}`

      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      })

      const result = await response.json()
      if (result.success) {
        setData(result.data)
      } else {
        setError(result.message || 'Failed to fetch balance sheet')
      }
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

  const handleBalanceClick = (accountCode) => {
    const params = new URLSearchParams()
    params.append('account_code', accountCode)
    if (startDate) params.append('start_date', startDate)
    if (endDate) params.append('end_date', endDate)
    navigate(`/general-ledger?${params.toString()}`)
  }

  const handleNetIncomeClick = () => {
    const params = new URLSearchParams()
    if (startDate) params.append('start_date', startDate)
    if (endDate) params.append('end_date', endDate)
    navigate(`/income-statement?${params.toString()}`)
  }

  const handleExportExcel = () => {
    if (!data) return
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet([])

    const setCell = (ws, addr, value, style) => {
      if (!ws[addr]) ws[addr] = {}
      ws[addr].v = value
      ws[addr].t = typeof value === 'number' ? 'n' : 's'
      if (style) ws[addr].s = style
    }

    const BLACK_BG = { fgColor: { rgb: '111827' } }
    const BLUE_BG = { fgColor: { rgb: '0369A1' } }
    const ORANGE_BG = { fgColor: { rgb: 'EA580C' } }
    const GREEN_BG = { fgColor: { rgb: '059669' } }
    const GRAY_BG = { fgColor: { rgb: 'F9FAFB' } }
    const BORDER_GRAY = {
      top: { style: 'thin', color: { rgb: 'E5E7EB' } },
      bottom: { style: 'thin', color: { rgb: 'E5E7EB' } },
      left: { style: 'thin', color: { rgb: 'E5E7EB' } },
      right: { style: 'thin', color: { rgb: 'E5E7EB' } },
    }
    const BORDER_TOTAL = {
      top: { style: 'thick', color: { rgb: '111827' } },
      bottom: { style: 'thin', color: { rgb: 'E5E7EB' } },
      left: { style: 'thin', color: { rgb: 'E5E7EB' } },
      right: { style: 'thin', color: { rgb: 'E5E7EB' } },
    }

    const whiteOnColor = (bgColor) => ({
      font: { bold: true, color: { rgb: 'FFFFFF' }, name: 'Calibri', sz: 10 },
      fill: { fgColor: { rgb: bgColor } },
      alignment: { horizontal: 'left', vertical: 'center' },
    })

    const bodyCell = (fill = 'FFFFFF', align = 'left') => ({
      font: { bold: false, color: { rgb: '111827' }, name: 'Calibri', sz: 10 },
      fill: { fgColor: { rgb: fill } },
      alignment: { horizontal: align, vertical: 'center' },
      border: BORDER_GRAY,
    })

    const footStyle = (align = 'left') => ({
      font: { bold: true, color: { rgb: 'FFFFFF' }, name: 'Calibri', sz: 10 },
      fill: { fgColor: { rgb: '374151' } },
      alignment: { horizontal: align, vertical: 'center' },
      border: BORDER_TOTAL,
    })

    let r = 1

    ;['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'].forEach((c) => {
      setCell(ws, `${c}${r}`, c === 'A' ? 'BALANCE SHEET' : '', {
        font: { bold: true, color: { rgb: 'FFFFFF' }, name: 'Calibri', sz: 13 },
        fill: BLACK_BG,
        alignment: { horizontal: 'left', vertical: 'center' },
      })
    })
    r++
    ;['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'].forEach((c) => {
      setCell(
        ws,
        `${c}${r}`,
        c === 'A'
          ? `Period: ${formatDate(startDate) || 'All'} — ${formatDate(endDate) || 'All'}`
          : c === 'I'
            ? `Generated: ${new Date().toLocaleDateString('en-PH')}`
            : '',
        {
          font: { bold: false, color: { rgb: '6B7280' }, name: 'Calibri', sz: 9 },
          fill: BLACK_BG,
          alignment: {
            horizontal: c === 'I' ? 'right' : 'left',
            vertical: 'center',
          },
        },
      )
    })
    r++
    r++

    // ASSETS
    setCell(ws, `A${r}`, 'ASSETS', whiteOnColor('0369A1'))
    setCell(ws, `B${r}`, '', whiteOnColor('0369A1'))
    setCell(ws, `C${r}`, '', whiteOnColor('0369A1'))
    r++

    setCell(ws, `A${r}`, 'CODE', whiteOnColor('1E40AF'))
    setCell(ws, `B${r}`, 'ACCOUNT NAME', whiteOnColor('1E40AF'))
    setCell(ws, `C${r}`, 'BALANCE (₱)', whiteOnColor('1E40AF'))
    r++

    data.assets?.forEach((item, idx) => {
      const rowFill = idx % 2 === 0 ? 'FFFFFF' : 'F9FAFB'
      setCell(ws, `A${r}`, item['Account Code'], bodyCell(rowFill, 'left'))
      setCell(ws, `B${r}`, item['Account Name'], bodyCell(rowFill, 'left'))
      ws[`C${r}`] = {
        v: parseFloat(Math.abs(item.Current || 0)),
        t: 'n',
        z: '#,##0.00',
        s: bodyCell(rowFill, 'right'),
      }
      r++
    })

    setCell(ws, `A${r}`, 'TOTAL ASSETS', footStyle('left'))
    setCell(ws, `B${r}`, '', footStyle('left'))
    ws[`C${r}`] = {
      v: Math.abs(data.totalAssets || 0),
      t: 'n',
      z: '#,##0.00',
      s: footStyle('right'),
    }
    r++

    r++

    // LIABILITIES
    setCell(ws, `A${r}`, 'LIABILITIES', whiteOnColor('EA580C'))
    setCell(ws, `B${r}`, '', whiteOnColor('EA580C'))
    setCell(ws, `C${r}`, '', whiteOnColor('EA580C'))
    r++

    setCell(ws, `A${r}`, 'CODE', whiteOnColor('C2410C'))
    setCell(ws, `B${r}`, 'ACCOUNT NAME', whiteOnColor('C2410C'))
    setCell(ws, `C${r}`, 'BALANCE (₱)', whiteOnColor('C2410C'))
    r++

    data.liabilities?.forEach((item, idx) => {
      const rowFill = idx % 2 === 0 ? 'FFFFFF' : 'F9FAFB'
      setCell(ws, `A${r}`, item['Account Code'], bodyCell(rowFill, 'left'))
      setCell(ws, `B${r}`, item['Account Name'], bodyCell(rowFill, 'left'))
      ws[`C${r}`] = {
        v: parseFloat(Math.abs(item.Current || 0)),
        t: 'n',
        z: '#,##0.00',
        s: bodyCell(rowFill, 'right'),
      }
      r++
    })

    setCell(ws, `A${r}`, 'TOTAL LIABILITIES', footStyle('left'))
    setCell(ws, `B${r}`, '', footStyle('left'))
    ws[`C${r}`] = {
      v: Math.abs(data.totalLiabilities || 0),
      t: 'n',
      z: '#,##0.00',
      s: footStyle('right'),
    }
    r++

    r++

    // EQUITY
    setCell(ws, `A${r}`, 'EQUITY', whiteOnColor('059669'))
    setCell(ws, `B${r}`, '', whiteOnColor('059669'))
    setCell(ws, `C${r}`, '', whiteOnColor('059669'))
    r++

    setCell(ws, `A${r}`, 'CODE', whiteOnColor('047857'))
    setCell(ws, `B${r}`, 'ACCOUNT NAME', whiteOnColor('047857'))
    setCell(ws, `C${r}`, 'BALANCE (₱)', whiteOnColor('047857'))
    r++

    data.equity?.forEach((item, idx) => {
      const rowFill = idx % 2 === 0 ? 'FFFFFF' : 'F9FAFB'
      setCell(ws, `A${r}`, item['Account Code'], bodyCell(rowFill, 'left'))
      setCell(ws, `B${r}`, item['Account Name'], bodyCell(rowFill, 'left'))
      ws[`C${r}`] = {
        v: parseFloat(Math.abs(item.Current || 0)),
        t: 'n',
        z: '#,##0.00',
        s: bodyCell(rowFill, 'right'),
      }
      r++
    })

    setCell(ws, `A${r}`, 'TOTAL EQUITY', footStyle('left'))
    setCell(ws, `B${r}`, '', footStyle('left'))
    ws[`C${r}`] = {
      v: Math.abs(data.totalEquity || 0),
      t: 'n',
      z: '#,##0.00',
      s: footStyle('right'),
    }

    ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r, c: 2 } })
    ws['!cols'] = [{ wch: 16 }, { wch: 36 }, { wch: 18 }]
    ws['!rows'] = [{ hpt: 24 }, { hpt: 16 }, { hpt: 6 }, { hpt: 18 }]
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 8 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 8 } },
    ]

    XLSX.utils.book_append_sheet(wb, ws, 'Balance Sheet')
    XLSX.writeFile(
      wb,
      `balance-sheet-${new Date().toISOString().split('T')[0]}.xlsx`,
    )
    setExportMenuOpen(false)
  }

const handleExportPDF = async () => {
    try {
      const { jsPDF } = await import('jspdf')
      const { default: autoTable } = await import('jspdf-autotable')

      const doc = new jsPDF({
        orientation: 'portrait', // Corrected to portrait
        unit: 'pt',
        format: 'letter',
      })
      const W = doc.internal.pageSize.getWidth()
      const H = doc.internal.pageSize.getHeight()
      const M = 36
      let y = renderPDFCompanyHeader(doc, company, W, M)

      const BLK = [17, 24, 39]      // Slate 900
      const GRY = [100, 116, 139]   // Slate 500
      const LGT = [226, 232, 240]   // Slate 200
      const WHT = [255, 255, 255]
      const BG_ALT = [248, 250, 252]// Slate 50

      // Document Title Section
      doc.setDrawColor(...LGT)
      doc.setLineWidth(1)
      doc.line(M, y, W - M, y)
      y += 14

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(14)
      doc.setTextColor(...BLK)
      doc.text('BALANCE SHEET', M, y)

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.setTextColor(...GRY)
      doc.text('Statement of Financial Position', W - M, y, { align: 'right' })

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

      // Clean currency formatter without encoding glitches
      const cleanFmt = (val) => {
        const formatted = fmt(parseFloat(val || 0))
        return formatted.replace('₱', 'Php ')
      }

      const absAssets = Math.abs(data.totalAssets || 0)
      const absLiabilities = Math.abs(data.totalLiabilities || 0)
      const absEquity = Math.abs(data.totalEquity || 0)

      // ── 1. ASSETS TABLE ──────────────────────────────────────────────────
      const assetBody =
        data.assets?.map((row) => [
          row['Account Code'] || '',
          row['Account Name'] || '',
          cleanFmt(Math.abs(parseFloat(row.Current || 0))),
        ]) || []

      autoTable(doc, {
        startY: y,
        margin: { left: M, right: M },
        tableWidth: W - M * 2,
        head: [
          [
            { content: 'ASSETS', colSpan: 3, styles: { fillColor: BLK, textColor: WHT, fontStyle: 'bold', fontSize: 9 } }
          ],
          [
            { content: 'CODE', styles: { halign: 'left' } },
            { content: 'ACCOUNT NAME', styles: { halign: 'left' } },
            { content: 'BALANCE (Php)', styles: { halign: 'right' } },
          ],
        ],
        body: assetBody,
        foot: [
          [
            {
              content: 'TOTAL ASSETS',
              colSpan: 2,
              styles: { halign: 'left', fontStyle: 'bold' },
            },
            {
              content: cleanFmt(absAssets),
              styles: { halign: 'right', fontStyle: 'bold', textColor: BLK },
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

      // ── 2. LIABILITIES TABLE ─────────────────────────────────────────────
      const liabilityBody =
        data.liabilities?.map((row) => [
          row['Account Code'] || '',
          row['Account Name'] || '',
          cleanFmt(Math.abs(parseFloat(row.Current || 0))),
        ]) || []

      autoTable(doc, {
        startY: y,
        margin: { left: M, right: M },
        tableWidth: W - M * 2,
        head: [
          [
            { content: 'LIABILITIES', colSpan: 3, styles: { fillColor: BLK, textColor: WHT, fontStyle: 'bold', fontSize: 9 } }
          ],
          [
            { content: 'CODE', styles: { halign: 'left' } },
            { content: 'ACCOUNT NAME', styles: { halign: 'left' } },
            { content: 'BALANCE (Php)', styles: { halign: 'right' } },
          ],
        ],
        body: liabilityBody,
        foot: [
          [
            {
              content: 'TOTAL LIABILITIES',
              colSpan: 2,
              styles: { halign: 'left', fontStyle: 'bold' },
            },
            {
              content: cleanFmt(absLiabilities),
              styles: { halign: 'right', fontStyle: 'bold', textColor: BLK },
            },
          ],
        ],
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

      // ── 3. EQUITY TABLE ──────────────────────────────────────────────────
      const equityBody =
        data.equity?.map((row) => [
          row['Account Code'] || '',
          row['Account Name'] || '',
          cleanFmt(Math.abs(parseFloat(row.Current || 0))),
        ]) || []

      autoTable(doc, {
        startY: y,
        margin: { left: M, right: M },
        tableWidth: W - M * 2,
        head: [
          [
            { content: 'EQUITY', colSpan: 3, styles: { fillColor: BLK, textColor: WHT, fontStyle: 'bold', fontSize: 9 } }
          ],
          [
            { content: 'CODE', styles: { halign: 'left' } },
            { content: 'ACCOUNT NAME', styles: { halign: 'left' } },
            { content: 'BALANCE (Php)', styles: { halign: 'right' } },
          ],
        ],
        body: equityBody,
        foot: [
          [
            {
              content: 'TOTAL EQUITY',
              colSpan: 2,
              styles: { halign: 'left', fontStyle: 'bold' },
            },
            {
              content: cleanFmt(absEquity),
              styles: { halign: 'right', fontStyle: 'bold', textColor: BLK },
            },
          ],
        ],
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

      doc.save(`balance-sheet-${new Date().toISOString().split('T')[0]}.pdf`)
      setExportMenuOpen(false)
    } catch (err) {
      console.error('PDF export error:', err)
    }
  }

  if (loading)
    return <LoadingScreen label="Compiling Balance Sheet..." />

  if (error) {
    return (
      <div className="p-10">
        <div className="bg-red-50 border-l-4 border-red-600 p-6 rounded-r-xl shadow-sm">
          <h3 className="text-red-800 font-bold uppercase text-sm">
            Error Loading Statement
          </h3>
          <p className="text-red-600 text-[12px] mt-1 font-medium">{error}</p>
          <button
            onClick={fetchBalanceSheet}
            className="mt-4 px-5 py-2 bg-red-600 text-white text-[10px] font-black rounded-lg uppercase tracking-widest hover:bg-red-700 transition-all"
          >
            Retry Fetch
          </button>
        </div>
      </div>
    )
  }

  if (!data) return null

  // Backend returns credit-normal accounts (liabilities, equity) as negatives.
  // The accounting equation  Assets = Liabilities + Equity  must be checked using
  // absolute values so the sign convention from the API doesn't break the comparison.
  const absAssets = Math.abs(data.totalAssets)
  const absLiabilities = Math.abs(data.totalLiabilities)
  const absEquity = Math.abs(data.totalEquity)
  const absLiabEquity = absLiabilities + absEquity
  const balanceDiff = Math.abs(absAssets - absLiabEquity)
  const isBalanced = balanceDiff < 0.01

  const Section = ({
    title,
    icon: Icon,
    color,
    items,
    total,
    totalLabel,
    netIncome,
      onAccountNameClick,
      onBalanceClick,
      onNetIncomeClick,
      className = '',
    }) => (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col h-full min-h-0 overflow-x-auto custom-scrollbar ${className}">
      <div className="flex items-center gap-2 px-5 py-3 bg-black">
        <Icon size={14} className={color} />
        <span className="text-[11px] font-black uppercase tracking-[3px] text-white">
          {title}
        </span>
      </div>

      <div
        className="overflow-y-auto overflow-x-auto custom-scrollbar flex-1 min-h-0"
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
                Balance
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {items?.map((item, i) => (
              <tr key={i} className="hover:bg-red-100 hover:border-l-4 hover:border-red-600 hover:shadow-sm transition-colors">
                <td className="py-3 px-5">
                  <p className="text-[10px] font-bold text-gray-400 uppercase">
                    {item['Account Code']}
                  </p>
                </td>
                <td className="py-3 px-5">
                  <button
                    onClick={() => {
                      const accountName = item['Account Name']?.toLowerCase() || ''
                      if (accountName.includes('net income')) {
                        onNetIncomeClick()
                      } else {
                        onAccountNameClick(item['Account Code'])
                      }
                  }}
                    className="group flex items-center gap-1.5 text-[13px] font-bold text-black hover:text-orange-600 hover:bg-orange-50 hover:underline cursor-pointer transition-all rounded px-2 py-1 text-left"
                    title={item['Account Name']?.toLowerCase().includes('net income') ? 'View in Income Statement' : 'View in General Ledger'}
                  >
                    {item['Account Name']}
                    <ArrowUpRight size={10} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                </td>
                <td className="py-3 px-5 text-right font-mono text-[15px] font-black text-black">
                  <button
                    onClick={() => {
                      const accountName = item['Account Name']?.toLowerCase() || ''
                      if (accountName.includes('net income')) {
                        onNetIncomeClick()
                      } else {
                        onBalanceClick(item['Account Code'])
                      }
                  }}
                    className="group flex items-center justify-end gap-1.5 hover:text-orange-600 hover:bg-orange-50 hover:underline cursor-pointer transition-all rounded px-2 py-1"
                    title={item['Account Name']?.toLowerCase().includes('net income') ? 'View in Income Statement' : 'View in General Ledger'}
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

      {/* FIX: show absolute value of section total with ₱ symbol */}
      <div className="mt-auto bg-gray-50 border-t border-gray-100 px-5 py-3 flex justify-between items-center">
        <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest">
          {totalLabel}
        </span>
        <span className={`text-lg font-black ${color}`}>
          ₱ {fmt(Math.abs(total))}
        </span>
      </div>
    </div>
  )

  return (
    <div className="flex flex-col gap-5 bg-[#F3F4F6] h-full overflow-x-auto custom-scrollbar">
      {/* HEADER */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-black rounded-2xl flex items-center justify-center shadow-xl shadow-gray-200">
            <BarChart3 size={24} className="text-orange-500" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-black tracking-tighter leading-none">
              Balance <span className="text-orange-600 italic">Sheet</span>
            </h1>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-[3px] mt-1">
              Statement of Financial Position
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
              onClick={fetchBalanceSheet}
              className="w-full lg:w-auto px-5 py-2 rounded-lg bg-red-600 text-[11px] font-black text-white uppercase tracking-widest shadow-sm shadow-red-600/30 hover:bg-red-700 transition-colors cursor-pointer"
            >
              Submit
            </button>
          </div>
          <div className="relative">
            <button
              onClick={() => setExportMenuOpen((p) => !p)}
              className="flex items-center gap-2 px-5 py-2.5 bg-orange-600 text-[11px] font-black text-white rounded-xl hover:bg-orange-700 uppercase tracking-widest shadow-sm transition-colors"
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
            onClick={fetchBalanceSheet}
            className="w-11 h-11 bg-orange-600 text-white rounded-xl hover:bg-orange-700 flex items-center justify-center transition-all shadow-lg shadow-orange-100 active:scale-95"
          >
            <RefreshCcw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

<div className="flex flex-col flex-1 min-h-0 gap-4 overflow-hidden">
  
  {/* ── THREE-COLUMN FINANCIALS (Stretches to fill available screen height) ── */}
  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1 min-h-0">
    <Section
      title="Assets"
      icon={Briefcase}
      color="text-blue-500"
      items={data.assets}
      total={data.totalAssets}
      totalLabel="Sum of Assets"
      onAccountNameClick={handleAccountNameClick}
      onBalanceClick={handleBalanceClick}
      className="min-h-0"
    />
    <Section
      title="Liabilities"
      icon={Layers}
      color="text-orange-500"
      items={data.liabilities}
      total={data.totalLiabilities}
      totalLabel="Sum of Liabilities"
      onAccountNameClick={handleAccountNameClick}
      onBalanceClick={handleBalanceClick}
      className="min-h-0"
    />
    <Section
      title="Equity"
      icon={PieChart}
      color="text-green-500"
      items={data.equity}
      total={data.totalEquity}
      totalLabel="Sum of Equity"
      onAccountNameClick={handleAccountNameClick}
      onBalanceClick={handleBalanceClick}
      onNetIncomeClick={handleNetIncomeClick}
      className="min-h-0"
    />
  </div>

{/* ── ROBUST BALANCE VERIFICATION CARD ── */}
  <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex-shrink-0">
    <div className="flex items-center justify-between px-5 py-3 bg-slate-900 text-white">
      <div className="flex items-center gap-2.5">
        <BarChart3 size={16} className="text-orange-400" />
        <span className="text-[11px] font-black uppercase tracking-[2px]">
          Balance Verification Summary
        </span>
        <span className="text-[10px] font-medium text-slate-400 font-mono ml-auto">
          Assets = Liabilities + Equity
        </span>
      </div>
    </div>

    {/* The accounting equation, written out.
        The previous card listed four totals side by side: three of them were
        just the column footers above repeated, and "Liab. + Equity" appeared
        with no indication of where it came from. Laid out as
        Assets = Liabilities + Equity the check explains itself, and the residual
        line names the subtraction it is reporting. */}
    <div className="px-5 py-4 bg-slate-50/70 border-t border-slate-200">
      <div className="flex flex-col lg:flex-row items-stretch gap-2 lg:gap-3">
        {/* LEFT SIDE */}
        <div className="flex-1 flex flex-col justify-center rounded-lg border border-blue-200 bg-blue-50/70 px-4 py-3">
          <span className="text-[10px] font-black uppercase tracking-[2px] text-blue-700">
            Total Assets
          </span>
          <span className="font-mono font-black text-blue-700 text-xl tabular-nums">
            ₱ {fmt(absAssets)}
          </span>
        </div>

        {/* THE OPERATOR */}
        <div className="flex items-center justify-center px-1">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-white">
            <Equal size={14} strokeWidth={3} />
          </span>
        </div>

        {/* RIGHT SIDE */}
        {/* Flex, not a grid: the operator is a fixed-width glyph and the three figures
            must stay on one line. A two-column grid broke the four children into
            two rows, which put Equity under Liabilities. */}
        <div className="flex-[2] flex items-stretch rounded-lg border border-slate-200 bg-white">
          <div className="flex-1 flex flex-col justify-center px-4 py-3 border-r border-slate-200">
            <span className="text-[10px] font-black uppercase tracking-[2px] text-orange-700">
              Total Liabilities
            </span>
            <span className="font-mono font-black text-orange-700 text-xl tabular-nums">
              ₱ {fmt(absLiabilities)}
            </span>
          </div>
          <div className="flex items-center justify-center px-2 shrink-0">
            <Plus size={14} className="text-slate-400" strokeWidth={3} />
          </div>
          <div className="flex-1 flex flex-col justify-center px-4 py-3 border-r border-slate-200">
            <span className="text-[10px] font-black uppercase tracking-[2px] text-emerald-700">
              Total Equity
            </span>
            <span className="font-mono font-black text-emerald-700 text-xl tabular-nums">
              ₱ {fmt(absEquity)}
            </span>
          </div>
          <div className="flex-1 flex flex-col justify-center px-4 py-3 bg-slate-50/70">
            <span className="text-[10px] font-black uppercase tracking-[2px] text-slate-500">
              Right side
            </span>
            <span className="font-mono font-black text-slate-900 text-xl tabular-nums">
              ₱ {fmt(absLiabEquity)}
            </span>
          </div>
        </div>
      </div>

      {/* RESIDUAL */}
      <div
        className={`mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border px-4 py-2.5 ${
          isBalanced
            ? 'border-emerald-200 bg-emerald-50'
            : 'border-red-200 bg-red-50'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white ${
              isBalanced ? 'bg-emerald-600' : 'bg-red-600'
            }`}
          >
            {isBalanced ? <ShieldCheck size={13} /> : <ShieldAlert size={13} />}
          </span>
          <span
            className={`text-[11px] font-black uppercase tracking-[2px] ${
              isBalanced ? 'text-emerald-800' : 'text-red-800'
            }`}
          >
            {isBalanced ? 'Balanced' : 'Out of Balance'}
          </span>
          <span className="text-[11px] font-medium text-slate-500 font-mono truncate">
            Assets − (Liabilities + Equity)
          </span>
        </div>
        <span
          className={`font-mono font-black text-lg tabular-nums ${
            isBalanced ? 'text-emerald-700' : 'text-red-700'
          }`}
        >
          ₱ {fmt(balanceDiff)}
        </span>
      </div>
    </div>
  </div>

</div>
    </div>
  )
}
