import React, { useState, useEffect, useMemo } from 'react'
import * as XLSX from 'xlsx'
import {
  FileText,
  Download,
  RefreshCcw,
  ArrowUpRight,
  ArrowDownLeft,
  Hash,
  Search,
  User,
  ChevronDown,
} from 'lucide-react'

export default function GeneralLedger() {
  const [accounts, setAccounts] = useState([])
  const [grandTotalDebit, setGTD] = useState(0)
  const [grandTotalCredit, setGTC] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [activeAccount, setActiveAccount] = useState(null)
  const [exportMenuOpen, setExportMenuOpen] = useState(false)

  useEffect(() => {
    fetchGeneralLedger()
  }, [])

  useEffect(() => {
    const t = setTimeout(() => fetchGeneralLedger(), 500)
    return () => clearTimeout(t)
  }, [startDate, endDate])

  const fetchGeneralLedger = async () => {
    try {
      setLoading(true)
      setError('')
      const token = localStorage.getItem('token')
      const params = new URLSearchParams()
      if (startDate) params.append('start_date', startDate)
      if (endDate) params.append('end_date', endDate)

      const url = `${import.meta.env.VITE_SERVER_LINK}/reports/general-ledger${params.toString() ? '?' + params.toString() : ''}`
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      })

      const result = await response.json()
      if (result.success) {
        setAccounts(result.data.accounts || [])
        setGTD(result.data.grandTotalDebit || 0)
        setGTC(result.data.grandTotalCredit || 0)
        if (!startDate && !endDate) {
          if (result.startDate) setStartDate(result.startDate)
          if (result.endDate) setEndDate(result.endDate)
        }
      } else {
        setError(result.message || 'Failed to fetch general ledger')
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

  // Filter accounts + entries by search term
  const { filteredAccounts, subTotalDebit, subTotalCredit } = useMemo(() => {
    const q = searchTerm.toLowerCase().trim()
    let td = 0,
      tc = 0

    const filtered = accounts
      .map((acc) => {
        const txns = q
          ? acc.entries.filter(
              (t) =>
                acc.account_code?.toLowerCase().includes(q) ||
                acc.account_name?.toLowerCase().includes(q) ||
                t.responsibility_center?.toLowerCase().includes(q),
            )
          : acc.entries

        txns.forEach((t) => {
          if (t.entry_type === 'DEBIT') td += t.amount
          if (t.entry_type === 'CREDIT') tc += t.amount
        })
        return { ...acc, entries: txns }
      })
      .filter((acc) => acc.entries.length > 0)

    return { filteredAccounts: filtered, subTotalDebit: td, subTotalCredit: tc }
  }, [accounts, searchTerm])

  const totalRows = filteredAccounts.reduce((s, acc) => s + acc.entries.length, 0)

  const buildExportRows = () => {
    const rows = []
    filteredAccounts.forEach((acc) => {
      rows.push([`${acc.account_code} - ${acc.account_name}`])
      rows.push([
        'Posted Date',
        'Source',
        'Debit',
        'Credit',
        'Balance',
        'Center',
        'DocRef',
      ])
      let subtotalDebit = 0
      let subtotalCredit = 0
      acc.entries.forEach((entry) => {
        const debit = entry.entry_type === 'DEBIT' ? entry.amount : ''
        const credit = entry.entry_type === 'CREDIT' ? entry.amount : ''
        subtotalDebit += entry.entry_type === 'DEBIT' ? entry.amount : 0
        subtotalCredit += entry.entry_type === 'CREDIT' ? entry.amount : 0
        rows.push([
          formatDate(entry.posted_date),
          entry.db_name?.replace(/_/g, ' ').toUpperCase() || '—',
          debit !== '' ? fmt(debit) : '',
          credit !== '' ? fmt(credit) : '',
          fmt(entry.balance),
          entry.responsibility_center || 'HQ',
          entry.db_id || '—',
        ])
      })
      rows.push([
        '',
        'Subtotal',
        fmt(subtotalDebit),
        fmt(subtotalCredit),
        '',
        '',
        '',
      ])
      rows.push([])
    })
    return rows
  }

  const handleExportExcel = () => {
    const rows = buildExportRows()
    if (rows.length === 0) return

    const workbook = XLSX.utils.book_new()
    const worksheet = XLSX.utils.aoa_to_sheet(rows)
    XLSX.utils.book_append_sheet(workbook, worksheet, 'General Ledger')
    XLSX.writeFile(
      workbook,
      `general-ledger-${new Date().toISOString().split('T')[0]}.xlsx`,
    )
    setExportMenuOpen(false)
  }

const handleExportPDF = async () => {
  try {
    const { jsPDF } = await import('jspdf')
    const { default: autoTable } = await import('jspdf-autotable')
    
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'pt',
      format: 'letter',
    })

    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    const margin = 40
    let currentY = 45

    // --- Color Palette Definitions ---
    const COLOR_PRIMARY_BLACK = [17, 24, 39]     // #111827 - Solid structural headers
    const COLOR_ACCENT_RED = [220, 38, 38]       // #DC2626 - Indicators and Grand totals
    const COLOR_MUTED_GRAY = [107, 114, 128]     // #6B7280 - Sub-labels and metadata
    const COLOR_BORDER_LIGHT = [229, 231, 235]   // #E5E7EB - Table column separators
    const COLOR_ROW_ALT = [249, 250, 251]        // #F9FAFB - Alternating rows

    // ─────────────────────────────────────────────────────────────────────────
    // 1. REPORT HEADER DESIGN
    // ─────────────────────────────────────────────────────────────────────────
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(18)
    doc.setTextColor(...COLOR_PRIMARY_BLACK)
    doc.text('GENERAL LEDGER', margin, currentY)
    
    // Decorative Right-Aligned Stamp
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...COLOR_ACCENT_RED)
    doc.text('FINANCIAL MANAGEMENT REPORT', pageWidth - margin, currentY, { align: 'right' })
    currentY += 16

    // Metadata details
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(...COLOR_MUTED_GRAY)
    const periodText = `${startDate || 'All Dates'} — ${endDate || 'All Dates'}`
    doc.text(`Reporting Period: ${periodText}`, margin, currentY)
    
    const genTimestamp = `Generated: ${new Date().toLocaleString('en-PH')}`
    doc.text(genTimestamp, pageWidth - margin, currentY, { align: 'right' })
    currentY += 14

    // Top structural accent rule
    doc.setDrawColor(...COLOR_PRIMARY_BLACK)
    doc.setLineWidth(1.5)
    doc.line(margin, currentY, pageWidth - margin, currentY)
    currentY += 24

    // ─────────────────────────────────────────────────────────────────────────
    // 2. ITERATE ACCOUNTS & GENERATE SECTION SCHEMATICS
    // ─────────────────────────────────────────────────────────────────────────
    filteredAccounts.forEach((acc) => {
      // Prevent orphaned account headers near bottom bounds
      if (currentY > pageHeight - 130) {
        doc.addPage()
        currentY = margin + 10
      }

      // Draw Account Title bar structure
      doc.setDrawColor(...COLOR_BORDER_LIGHT)
      doc.setLineWidth(1)
      doc.line(margin, currentY - 4, pageWidth - margin, currentY - 4)

      // Tiny Red Indicator Block left accent box
      doc.setFillColor(...COLOR_ACCENT_RED)
      doc.rect(margin, currentY, 4, 14, 'F')

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(11)
      doc.setTextColor(...COLOR_PRIMARY_BLACK)
      doc.text(`${acc.account_code}   ${acc.account_name.toUpperCase()}`, margin + 10, currentY + 11)
      currentY += 22

      // Map out individual database items
      const body = acc.entries.map((entry) => [
        formatDate(entry.posted_date),
        entry.db_name?.replace(/_/g, ' ').toUpperCase() || '—',
        entry.entry_type === 'DEBIT' ? fmt(entry.amount) : '',
        entry.entry_type === 'CREDIT' ? fmt(entry.amount) : '',
        fmt(entry.balance),
        entry.responsibility_center || 'HQ',
        entry.db_id || '—',
      ])

      // Calculate localized subtotals
      const subtotalDebit = acc.entries.reduce(
        (sum, entry) => sum + (entry.entry_type === 'DEBIT' ? entry.amount : 0),
        0,
      )
      const subtotalCredit = acc.entries.reduce(
        (sum, entry) => sum + (entry.entry_type === 'CREDIT' ? entry.amount : 0),
        0,
      )

      // Inject subtotal line calculation straight into the autoTable row structure
      body.push([
        { content: 'Account Subtotals', colSpan: 2, styles: { fontStyle: 'bold', fillColor: [243, 244, 246] } },
        { content: fmt(subtotalDebit), styles: { fontStyle: 'bold', halign: 'right', fillColor: [243, 244, 246] } },
        { content: fmt(subtotalCredit), styles: { fontStyle: 'bold', halign: 'right', fillColor: [243, 244, 246] } },
        { content: '', colSpan: 3, styles: { fillColor: [243, 244, 246] } }
      ])

      autoTable(doc, {
        startY: currentY,
        head: [['Posted Date', 'Source Ledger', 'Debit Amount', 'Credit Amount', 'Running Balance', 'Resp Center', 'Doc Reference']],
        body,
        theme: 'striped',
        margin: { left: margin, right: margin },
        headStyles: {
          fillColor: COLOR_PRIMARY_BLACK,
          textColor: 255,
          fontStyle: 'bold',
          fontSize: 9,
          cellPadding: 6,
          halign: 'left',
        },
        styles: {
          fontSize: 8.5,
          cellPadding: 5,
          textColor: [55, 65, 81],
          lineColor: COLOR_BORDER_LIGHT,
          lineWidth: 0.5,
          valign: 'middle',
        },
        alternateRowStyles: {
          fillColor: COLOR_ROW_ALT,
        },
        columnStyles: {
          0: { cellWidth: 80, halign: 'left' },
          1: { cellWidth: 150, halign: 'left' },
          2: { cellWidth: 100, halign: 'right' },
          3: { cellWidth: 100, halign: 'right' },
          4: { cellWidth: 110, halign: 'right', fontStyle: 'bold' },
          5: { cellWidth: 80, halign: 'center' },
          6: { halign: 'left' },
        },
        didDrawPage: (data) => {
          currentY = data.cursor.y + 25
        },
      })

      // Track cursor progression point safely across boundaries
      currentY = doc.previousAutoTable?.finalY ? doc.previousAutoTable.finalY + 25 : currentY + 25
    })

    // ─────────────────────────────────────────────────────────────────────────
    // 3. FINAL SUMMARY SUMMARY / GRAND TOTAL SECTION
    // ─────────────────────────────────────────────────────────────────────────
    if (filteredAccounts.length > 0) {
      if (currentY > pageHeight - 100) {
        doc.addPage()
        currentY = margin + 15
      }

      const totalBlockWidth = 320
      const startX = pageWidth - margin - totalBlockWidth

      // Structural header block for totals
      doc.setFillColor(...COLOR_PRIMARY_BLACK)
      doc.rect(startX, currentY, totalBlockWidth, 22, 'F')
      
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.setTextColor(255)
      doc.text('REPORT GRAND SUMMARY TOTALS', startX + 10, currentY + 14)
      currentY += 22

      // Row for Total Debit
      doc.setFillColor(...COLOR_ROW_ALT)
      doc.rect(startX, currentY, totalBlockWidth, 20, 'F')
      doc.setDrawColor(...COLOR_BORDER_LIGHT)
      doc.setLineWidth(0.5)
      doc.rect(startX, currentY, totalBlockWidth, 20, 'S')
      
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(...COLOR_PRIMARY_BLACK)
      doc.text('Consolidated Balance Debit:', startX + 10, currentY + 13)
      doc.setFont('helvetica', 'bold')
      doc.text(fmt(grandTotalDebit), pageWidth - margin - 10, currentY + 13, { align: 'right' })
      currentY += 20

      // Row for Total Credit
      doc.setFillColor(255)
      doc.rect(startX, currentY, totalBlockWidth, 20, 'F')
      doc.rect(startX, currentY, totalBlockWidth, 20, 'S')
      
      doc.setFont('helvetica', 'normal')
      doc.text('Consolidated Balance Credit:', startX + 10, currentY + 13)
      doc.setFont('helvetica', 'bold')
      doc.text(fmt(grandTotalCredit), pageWidth - margin - 10, currentY + 13, { align: 'right' })
      currentY += 20

      // Accent closure line double weight under final entries
      doc.setDrawColor(...COLOR_ACCENT_RED)
      doc.setLineWidth(1.5)
      doc.line(startX, currentY, pageWidth - margin, currentY)
    }

    // Trigger saving output stream
    doc.save(`general-ledger-${new Date().toISOString().split('T')[0]}.pdf`)
    setExportMenuOpen(false)
  } catch (err) {
    console.error('PDF export layout engine compilation failure:', err)
  }
}

  // Scroll to account function
  const scrollToAccount = (accountCode) => {
    const element = document.getElementById(`account-${accountCode}`)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' })
      setActiveAccount(accountCode)
    }
  }

  if (loading && accounts.length === 0)
    return (
      <div className="h-full w-full flex flex-col items-center justify-center gap-4">
        <div className="w-10 h-10 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-[10px] font-black uppercase tracking-[3px] text-gray-400">
          Loading Ledger Transactions...
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
            onClick={fetchGeneralLedger}
            className="mt-3 px-4 py-2 bg-red-600 text-white text-xs font-black rounded-lg uppercase tracking-widest hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    )

  const isBalanced = Math.abs(grandTotalDebit - grandTotalCredit) < 0.01

  return (
    <div className="flex flex-col gap-2 bg-[#F3F4F6] min-h-full custom-scrollbar">
      {/* HEADER */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-black rounded-xl flex-shrink-0">
            <FileText size={22} className="text-red-500" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-black tracking-tighter leading-none">
              General <span className="text-red-600 italic">Ledger</span>
            </h1>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-[2px] mt-1">
              Transaction History & Audit
            </p>
          </div>
        </div>
        <div className="flex gap-2 items-center relative">
          <div className="relative">
            <button
              onClick={() => setExportMenuOpen((prev) => !prev)}
              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 border border-emerald-600 text-[11px] font-black text-white rounded-xl hover:bg-emerald-700 uppercase tracking-widest transition-colors"
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
            onClick={fetchGeneralLedger}
            className="w-10 h-10 bg-red-600 text-white rounded-xl hover:bg-red-700 flex items-center justify-center transition-colors"
          >
            <RefreshCcw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* STAT CARDS */}
      <div className="grid grid-cols-4 gap-3">
        <StatCard
          iconBg="bg-red-50"
          iconColor="text-red-600"
          icon={<FileText size={18} />}
          label="Total Transactions"
          value={totalRows}
          sub="Journal Entries"
        />
        <StatCard
          iconBg="bg-gray-100"
          iconColor="text-black"
          icon={<ArrowUpRight size={18} />}
          label="Total Debit"
          value={`₱${fmt(subTotalDebit)}`}
          sub="PHP"
          small
        />
        <StatCard
          iconBg="bg-red-50"
          iconColor="text-red-600"
          icon={<ArrowDownLeft size={18} />}
          label="Total Credit"
          value={`₱${fmt(subTotalCredit)}`}
          sub="PHP"
          small
          valueClass="text-red-600"
        />
        <StatCard
          iconBg={isBalanced ? 'bg-green-50' : 'bg-red-50'}
          iconColor={isBalanced ? 'text-green-600' : 'text-red-600'}
          icon={<Hash size={18} />}
          label="Balance Status"
          value={isBalanced ? 'Balanced' : 'Unbalanced'}
          sub="Audit Check"
          valueClass={isBalanced ? 'text-green-600' : 'text-red-600'}
        />
      </div>

      {/* TOOLBAR */}
      <div className="bg-white border border-gray-100 rounded-2xl px-4 py-3 flex items-center gap-3 flex-wrap shadow-sm">
        {/* Navigation Sidebar */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black text-gray-400 uppercase tracking-[2px]">
            Navigate:
          </span>
          <div className="relative">
            <button
              onClick={() =>
                setActiveAccount(activeAccount === null ? 'dropdown' : null)
              }
              className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-[11px] font-black text-gray-700 hover:bg-gray-100 transition-all"
            >
              <span>All Accounts</span>
              <ChevronDown
                size={12}
                className={`transition-transform ${activeAccount === 'dropdown' ? 'rotate-180' : ''}`}
              />
            </button>
            {activeAccount === 'dropdown' && accounts.length > 0 && (
              <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 min-w-[250px] max-h-[300px] overflow-y-auto">
                {accounts.map((acc) => (
                  <button
                    key={acc.account_code}
                    onClick={() => {
                      scrollToAccount(acc.account_code)
                      setActiveAccount(null)
                    }}
                    className="w-full text-left px-4 py-2 text-[11px] font-black text-gray-700 hover:bg-red-50 hover:text-red-600 transition-all flex items-center justify-between border-b border-gray-50 last:border-b-0"
                  >
                    <span>
                      {acc.account_code} - {acc.account_name}
                    </span>
                    <span className="text-[9px] text-gray-400">
                      ({acc.entries.length})
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="hidden md:block w-px h-7 bg-gray-100" />

        {/* Search */}
        <div className="flex-1 min-w-[200px] flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 h-8 focus-within:border-red-500 focus-within:bg-white transition-all">
          <Search size={14} className="text-gray-300 flex-shrink-0" />
          <input
            type="text"
            placeholder="Search transactions..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 bg-transparent border-none outline-none text-[12px] font-bold text-black placeholder:text-gray-300 placeholder:font-semibold"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="text-gray-300 hover:text-red-500 text-lg leading-none transition-colors"
            >
              ×
            </button>
          )}
        </div>
        <div className="hidden md:block w-px h-7 bg-gray-100" />
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-black text-gray-400 uppercase tracking-[2px]">
            From
          </span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="px-3 py-2 border border-gray-100 rounded-xl bg-gray-50 text-[11px] font-bold text-black outline-none focus:border-red-500 focus:bg-white transition-all"
          />
          <span className="text-[10px] font-black text-gray-400 uppercase tracking-[2px]">
            To
          </span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="px-3 py-2 border border-gray-100 rounded-xl bg-gray-50 text-[11px] font-bold text-black outline-none focus:border-red-500 focus:bg-white transition-all"
          />
        </div>
        <button
          onClick={() => {
            setStartDate('')
            setEndDate('')
            setSearchTerm('')
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
          className="px-4 py-2 bg-black rounded-xl text-[10px] font-black text-white uppercase tracking-widest hover:bg-red-600 transition-all cursor-pointer"
        >
          Today
        </button>
      </div>

      {/* TABLE CARD */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col custom-scrollbar">
        {/* Table header bar */}
        <div className="flex items-center gap-2 px-5 py-3 bg-black flex-shrink-0">
          <FileText size={14} className="text-gray-500" />
          <span className="text-[11px] font-black uppercase tracking-[3px] text-white">
            General Ledger by Account
          </span>
          <span className="text-[10px] font-bold text-gray-600 ml-1">
            {totalRows} entries
          </span>
          <div className="ml-auto">
            {Math.abs(grandTotalDebit - grandTotalCredit) < 0.01 ? (
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
          className="overflow-y-auto overflow-x-auto custom-scrollbar"
          style={{ maxHeight: '550px' }}
        >
          <div className="divide-y divide-gray-100">
            {filteredAccounts.length === 0 ? (
              <div className="py-16 text-center text-[12px] font-bold text-gray-300">
                No accounts found
              </div>
            ) : (
              filteredAccounts.map((acc) => {
                const closingBal = acc.closingBalance || 0

                return (
                  <div
                    key={acc.account_code}
                    id={`account-${acc.account_code}`}
                    className="bg-white"
                  >
                    {/* Account header */}
                    <div className="bg-gray-800 px-6 py-3 sticky top-0 z-10">
                      <h3 className="text-[13px] font-black text-white tracking-wide">
                        {acc.account_code} - {acc.account_name}
                      </h3>
                      <p className="text-[10px] font-bold text-gray-400 mt-0.5">
                        {acc.account_type}
                      </p>
                    </div>

                    {/* Account entries table */}
                    <table
                      className="w-full border-collapse"
                      style={{ tableLayout: 'fixed', minWidth: '700px' }}
                    >
                      <colgroup>
                        <col style={{ width: '15%' }} />
                        <col style={{ width: '20%' }} />
                        <col style={{ width: '12%' }} />
                        <col style={{ width: '12%' }} />
                        <col style={{ width: '12%' }} />
                        <col style={{ width: '18%' }} />
                        <col style={{ width: '11%' }} />
                      </colgroup>
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                          <th className="py-2 px-4 text-[11px] font-black uppercase tracking-[1px] text-black text-left">
                            Posted Date
                          </th>
                          <th className="py-2 px-4 text-[11px] font-black uppercase tracking-[1px] text-black text-left">
                            Source
                          </th>
                          <th className="py-2 px-4 text-[11px] font-black uppercase tracking-[1px] text-black text-right border-l border-gray-200">
                            Debit
                          </th>
                          <th className="py-2 px-4 text-[11px] font-black uppercase tracking-[1px] text-black text-right border-l border-gray-200">
                            Credit
                          </th>
                          <th className="py-2 px-4 text-[11px] font-black uppercase tracking-[1px] text-black text-right border-l border-gray-200">
                            Balance
                          </th>
                          <th className="py-2 px-4 text-[11px] font-black uppercase tracking-[1px] text-black text-left border-l border-gray-200">
                            Center
                          </th>
                          <th className="py-2 px-4 text-[11px] font-black uppercase tracking-[1px] text-black text-left border-l border-gray-200">
                            DocRef
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {acc.entries.map((entry, idx) => (
                          <tr
                            key={idx}
                            className="hover:bg-red-50 transition-colors"
                          >
                            <td className="py-2 px-4 text-[11px] font-bold text-black">
                              {formatDate(entry.posted_date)}
                            </td>
                            <td className="py-2 px-4 text-[11px] font-bold text-gray-600">
                              {entry.db_name?.replace(/_/g, ' ').toUpperCase() ||
                                '—'}
                            </td>
                            <td className="py-2 px-4 text-right font-mono text-[12px] font-black text-black border-l border-gray-200">
                              {entry.entry_type === 'DEBIT' ? (
                                fmt(entry.amount)
                              ) : (
                                <span className="text-gray-200">—</span>
                              )}
                            </td>
                            <td className="py-2 px-4 text-right font-mono text-[12px] font-black text-red-600 border-l border-gray-200">
                              {entry.entry_type === 'CREDIT' ? (
                                fmt(entry.amount)
                              ) : (
                                <span className="text-gray-200">—</span>
                              )}
                            </td>
                            <td className="py-2 px-4 text-right font-mono text-[12px] font-black text-blue-600 border-l border-gray-200">
                              {fmt(entry.balance)}
                            </td>
                            <td className="py-2 px-4 text-[11px] font-bold text-gray-600 border-l border-gray-200">
                              {entry.responsibility_center || 'HQ'}
                            </td>
                            <td className="py-2 px-4 text-[11px] font-bold text-gray-600 border-l border-gray-200">
                              {entry.db_id || '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {/* Account closing balance */}
                    <div className="bg-gray-100 px-6 py-2 border-t border-gray-200">
                      <div className="flex justify-between items-center text-[12px] font-black">
                        <span className="text-gray-600 uppercase tracking-[1px]">
                          Closing Balance:
                        </span>
                        <span className="text-blue-600 font-mono text-[13px]">
                          {fmt(closingBal)}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Grand totals footer */}
        <div className="border-t-4 border-red-600 bg-black flex-shrink-0">
          <div className="px-6 py-4">
            <div className="grid grid-cols-3 gap-6">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[2px] text-gray-400 mb-1">
                  Total Debit
                </p>
                <p className="text-[18px] font-black text-white font-mono">
                  PHP {fmt(grandTotalDebit)}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[2px] text-gray-400 mb-1">
                  Total Credit
                </p>
                <p className="text-[18px] font-black text-red-400 font-mono">
                  PHP {fmt(grandTotalCredit)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-black uppercase tracking-[2px] text-gray-400 mb-1">
                  Net (Dr − Cr)
                </p>
                <p
                  className={`text-[18px] font-black font-mono ${Math.abs(grandTotalDebit - grandTotalCredit) < 0.01 ? 'text-green-400' : 'text-orange-400'}`}
                >
                  PHP {fmt(Math.abs(grandTotalDebit - grandTotalCredit))}
                  <span className="text-[11px] ml-2">
                    {grandTotalDebit > grandTotalCredit
                      ? 'DR'
                      : grandTotalCredit > grandTotalDebit
                        ? 'CR'
                        : 'BALANCED'}
                  </span>
                </p>
              </div>
            </div>
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
  small = false,
  valueClass = 'text-black',
}) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-4 flex items-center gap-3 hover:shadow-md transition-shadow">
      <div
        className={`w-10 h-10 ${iconBg} ${iconColor} rounded-xl flex items-center justify-center flex-shrink-0`}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[9px] font-black uppercase tracking-[3px] text-gray-400 mb-1 whitespace-nowrap">
          {label}
        </p>
        <h4
          className={`font-black ${valueClass} leading-none truncate ${small ? 'text-[13px]' : 'text-xl'}`}
        >
          {value}
        </h4>
        <p className="text-[9px] font-bold text-gray-300 uppercase mt-1">{sub}</p>
      </div>
    </div>
  )
}
