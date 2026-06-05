import React, { useState, useEffect } from 'react'
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
} from 'lucide-react'
import * as XLSX from 'xlsx'
import useCompany from '../company/useCompany'
import { renderPDFCompanyHeader } from '../../utils/pdfCompanyHeader'

export default function IncomeStatement() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [exportMenuOpen, setExportMenuOpen] = useState(false)
  const { company } = useCompany()

  const netIncomeColorClass =
    data?.netIncome >= 0 ? 'text-green-600' : 'text-red-600'

  useEffect(() => {
    fetchIncomeStatement()
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchIncomeStatement()
    }, 500)
    return () => clearTimeout(timer)
  }, [startDate, endDate])

  const fetchIncomeStatement = async () => {
    try {
      setLoading(true)
      setError('')
      const token = localStorage.getItem('token')
      const params = new URLSearchParams()
      if (startDate) params.append('start_date', startDate)
      if (endDate) params.append('end_date', endDate)
      const url = `${import.meta.env.VITE_SERVER_LINK}/reports/income-statement${params.toString() ? '?' + params : ''}`

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
      const M = 36
      let y = renderPDFCompanyHeader(doc, company, W, M)

      const BLK = [17, 24, 39]
      const GRN = [5, 150, 105]
      const RED = [220, 38, 38]
      const GRY = [107, 114, 128]
      const LGT = [229, 231, 235]
      const WHT = [255, 255, 255]

      doc.setFillColor(...BLK)
      doc.rect(M, y - 14, W - M * 2, 32, 'F')
      doc
        .setFont('helvetica', 'bold')
        .setFontSize(13)
        .setTextColor(...WHT)
      doc.text('INCOME STATEMENT', M + 8, y + 6)
      doc.setFontSize(8).setTextColor(...GRY)
      doc.text('Profit & Loss Summary', W - M - 8, y + 6, { align: 'right' })
      y += 32

      doc.setFillColor(...BLK)
      doc.rect(M, y - 2, W - M * 2, 18, 'F')
      doc
        .setFont('helvetica', 'normal')
        .setFontSize(8)
        .setTextColor(...GRY)
      doc.text(
        `Period: ${formatDate(startDate) || 'All Dates'} — ${formatDate(endDate) || 'All Dates'}`,
        M + 8,
        y + 10,
      )
      doc.text(
        `Generated: ${new Date().toLocaleDateString('en-PH')}`,
        W - M - 8,
        y + 10,
        { align: 'right' },
      )
      y += 22

      // REVENUES TABLE
      const revenueBody =
        data.revenues?.map((row) => [
          row['Account Code'],
          row['Account Name'],
          fmt(parseFloat(row.Current || 0)),
        ]) || []

      autoTable(doc, {
        startY: y,
        margin: { left: M, right: M },
        tableWidth: W - M * 2,
        head: [
          [{ content: 'REVENUES', colSpan: 3, styles: { halign: 'left' } }],
          [
            { content: 'CODE', styles: { halign: 'left' } },
            { content: 'ACCOUNT NAME', styles: { halign: 'left' } },
            { content: 'AMOUNT (₱)', styles: { halign: 'right' } },
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
              content: fmt(data.totalRevenues || 0),
              styles: { halign: 'right', fontStyle: 'bold' },
            },
          ],
        ],
        theme: 'plain',
        headStyles: {
          fillColor: GRN,
          textColor: WHT,
          fontStyle: 'bold',
          fontSize: 9,
          cellPadding: { top: 6, bottom: 6, left: 6, right: 6 },
          lineColor: [55, 65, 81],
          lineWidth: 0.5,
        },
        footStyles: {
          fillColor: [55, 65, 81],
          textColor: WHT,
          fontStyle: 'bold',
          fontSize: 10,
          cellPadding: { top: 6, bottom: 6, left: 6, right: 6 },
          lineColor: GRN,
          lineWidth: { top: 2, bottom: 0, left: 0, right: 0 },
        },
        styles: {
          fontSize: 9,
          cellPadding: { top: 5, bottom: 5, left: 6, right: 6 },
          textColor: [55, 65, 81],
          lineColor: LGT,
          lineWidth: 0.3,
          valign: 'top',
        },
        columnStyles: {
          0: { cellWidth: 45, halign: 'left' },
          1: { cellWidth: 'auto', halign: 'left' },
          2: { cellWidth: 50, halign: 'right', fontStyle: 'bold', textColor: GRN },
        },
      })

      y = doc.lastAutoTable.finalY + 12

      // EXPENSES TABLE
      const expenseBody =
        data.expenses?.map((row) => [
          row['Account Code'],
          row['Account Name'],
          fmt(parseFloat(row.Current || 0)),
        ]) || []

      autoTable(doc, {
        startY: y,
        margin: { left: M, right: M },
        tableWidth: W - M * 2,
        head: [
          [{ content: 'EXPENSES', colSpan: 3, styles: { halign: 'left' } }],
          [
            { content: 'CODE', styles: { halign: 'left' } },
            { content: 'ACCOUNT NAME', styles: { halign: 'left' } },
            { content: 'AMOUNT (₱)', styles: { halign: 'right' } },
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
              content: fmt(data.totalExpenses || 0),
              styles: { halign: 'right', fontStyle: 'bold' },
            },
          ],
        ],
        theme: 'plain',
        headStyles: {
          fillColor: RED,
          textColor: WHT,
          fontStyle: 'bold',
          fontSize: 9,
          cellPadding: { top: 6, bottom: 6, left: 6, right: 6 },
          lineColor: [55, 65, 81],
          lineWidth: 0.5,
        },
        footStyles: {
          fillColor: [55, 65, 81],
          textColor: WHT,
          fontStyle: 'bold',
          fontSize: 10,
          cellPadding: { top: 6, bottom: 6, left: 6, right: 6 },
          lineColor: RED,
          lineWidth: { top: 2, bottom: 0, left: 0, right: 0 },
        },
        styles: {
          fontSize: 9,
          cellPadding: { top: 5, bottom: 5, left: 6, right: 6 },
          textColor: [55, 65, 81],
          lineColor: LGT,
          lineWidth: 0.3,
          valign: 'top',
        },
        columnStyles: {
          0: { cellWidth: 45, halign: 'left' },
          1: { cellWidth: 'auto', halign: 'left' },
          2: { cellWidth: 50, halign: 'right', fontStyle: 'bold', textColor: RED },
        },
      })

      y = doc.lastAutoTable.finalY + 12

      // NET INCOME SUMMARY
      const netIncomeColor = data.netIncome >= 0 ? GRN : RED
      doc.setFillColor(...netIncomeColor)
      doc.rect(M, y, W - M * 2, 24, 'F')
      doc
        .setFont('helvetica', 'bold')
        .setFontSize(12)
        .setTextColor(...WHT)
      doc.text('NET INCOME', M + 8, y + 15)
      doc.setFontSize(14)
      doc.text(fmt(data.netIncome || 0), W - M - 8, y + 15, { align: 'right' })

      doc.save(`income-statement-${new Date().toISOString().split('T')[0]}.pdf`)
      setExportMenuOpen(false)
    } catch (err) {
      console.error('PDF export error:', err)
    }
  }

  if (loading && !data)
    return (
      <div className="h-full w-full flex flex-col items-center justify-center gap-4">
        <div className="w-10 h-10 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-[10px] font-black uppercase tracking-[3px] text-gray-400">
          Calculating Profit & Loss...
        </p>
      </div>
    )

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
    <div className="flex flex-col gap-3 bg-[#F3F4F6] min-h-full custom-scrollbar">
      {/* HEADER */}
      <div className="flex items-center justify-between flex-wrap gap-3">
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <StatCard
          iconBg="bg-green-50"
          iconColor="text-green-600"
          icon={<TrendingUp size={18} />}
          label="Total Revenue"
          value={`₱${fmt(data?.totalRevenues)}`}
          sub="Gross Earnings"
          valueClass="text-green-600"
        />
        <StatCard
          iconBg="bg-red-50"
          iconColor="text-red-600"
          icon={<TrendingDown size={18} />}
          label="Total Expenses"
          value={`₱${fmt(data?.totalExpenses)}`}
          sub="Operating Costs"
          valueClass="text-red-600"
        />
        <StatCard
          iconBg="bg-black"
          iconColor="text-red-500"
          icon={<DollarSign size={18} />}
          label="Net Income"
          value={`₱${fmt(data?.netIncome)}`}
          sub="Bottom Line"
          valueClass={data?.netIncome >= 0 ? 'text-black' : 'text-red-600'}
        />
      </div>

      {/* TOOLBAR */}
      <div className="bg-white border border-gray-100 rounded-2xl px-4 py-3 flex items-center gap-4 flex-wrap shadow-sm">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-red-100 rounded-lg text-red-600">
            <Calendar size={14} />
          </div>
          <span className="text-[10px] font-black text-gray-400 uppercase tracking-[2px]">
            Period Filter
          </span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="px-3 py-2 border border-gray-100 rounded-xl bg-gray-50 text-[11px] font-bold text-black outline-none focus:border-red-500 focus:bg-white transition-all"
          />
          <span className="text-gray-300">to</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="px-3 py-2 border border-gray-100 rounded-xl bg-gray-50 text-[11px] font-bold text-black outline-none focus:border-red-500 focus:bg-white transition-all"
          />
        </div>
        <div className="ml-auto flex gap-2">
          <button
            onClick={() => {
              setStartDate('')
              setEndDate('')
            }}
            className="px-4 py-2 border border-gray-900 rounded-xl text-[10px] font-black text-gray-900 uppercase tracking-widest hover:border-red-500 hover:text-red-600 transition-all bg-white cursor-pointer"
          >
            Reset
          </button>
          <button
            onClick={() => {
              const t = new Date().toISOString().split('T')[0]
              setStartDate(t)
              setEndDate(t)
            }}
            className="px-4 py-2 bg-black rounded-xl text-[10px] font-black text-white uppercase tracking-widest hover:bg-red-600 cursor-pointer"
          >
            Today
          </button>
        </div>
      </div>

      {/* CONTENT GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* REVENUE TABLE */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col custom-scrollbar">
          <div className="flex items-center gap-2 px-5 py-3 bg-black">
            <TrendingUp size={14} className="text-green-500" />
            <span className="text-[11px] font-black uppercase tracking-[3px] text-white">
              Revenues
            </span>
          </div>
          <div
            className="overflow-y-auto custom-scrollbar"
            style={{ maxHeight: '570px' }}
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
                  <tr key={i} className="hover:bg-green-50/50 transition-colors">
                    <td className="py-3 px-5">
                      <p className="text-[10px] font-bold text-gray-400 uppercase">
                        {item['Account Code']}
                      </p>
                    </td>
                    <td className="py-3 px-5">
                      <p className="text-[13px] font-bold text-black">
                        {item['Account Name']}
                      </p>
                    </td>
                    <td className="py-3 px-5 text-right font-mono text-[15px] font-black text-black">
                      {fmt(item.Current)}
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
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col custom-scrollbar">
          <div className="flex items-center gap-2 px-5 py-3 bg-black">
            <TrendingDown size={14} className="text-red-500" />
            <span className="text-[11px] font-black uppercase tracking-[3px] text-white">
              Expenses
            </span>
          </div>
          <div
            className="overflow-y-auto custom-scrollbar"
            style={{ maxHeight: '570px' }}
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
                  <tr key={i} className="hover:bg-red-50/50 transition-colors">
                    <td className="py-3 px-5">
                      <p className="text-[10px] font-bold text-gray-400 uppercase">
                        {item['Account Code']}
                      </p>
                    </td>
                    <td className="py-3 px-5">
                      <p className="text-[13px] font-bold text-black">
                        {item['Account Name']}
                      </p>
                    </td>
                    <td className="py-3 px-5 text-right font-mono text-[15px] font-black text-red-600">
                      {fmt(item.Current)}
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

function StatCard({
  iconBg,
  iconColor,
  icon,
  label,
  value,
  sub,
  valueClass = 'text-black',
}) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-4 flex items-center gap-3 hover:shadow-md transition-shadow">
      <div
        className={`w-10 h-10 ${iconBg} ${iconColor} rounded-xl flex items-center justify-center shrink-0`}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[9px] font-black uppercase tracking-[3px] text-gray-400 mb-1 whitespace-nowrap">
          {label}
        </p>
        <h4
          className={`font-black ${valueClass} leading-none truncate text-xl tracking-tight`}
        >
          {value}
        </h4>
        <p className="text-[9px] font-bold text-gray-300 uppercase mt-1">{sub}</p>
      </div>
    </div>
  )
}
