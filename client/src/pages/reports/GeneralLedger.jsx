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
} from 'lucide-react'
import useCompany from '../company/useCompany'
import { renderPDFCompanyHeader } from '../../utils/pdfCompanyHeader'

export default function GeneralLedger() {
  const [ledgerEntries, setLedgerEntries] = useState([])
  const [grandTotalDebit, setGTD] = useState(0)
  const [grandTotalCredit, setGTC] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [exportMenuOpen, setExportMenuOpen] = useState(false)
  const { company } = useCompany()

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
        setLedgerEntries(result.data || [])
        setGTD(result.grandTotalDebit || 0)
        setGTC(result.grandTotalCredit || 0)
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

  const filteredEntries = useMemo(() => {
    const q = searchTerm.toLowerCase().trim()
    if (!q) return ledgerEntries
    return ledgerEntries.filter(
      (e) =>
        e.account_code?.toLowerCase().includes(q) ||
        e.account_name?.toLowerCase().includes(q) ||
        e.particulars?.toLowerCase().includes(q) ||
        e.responsibility_center?.toLowerCase().includes(q),
    )
  }, [ledgerEntries, searchTerm])

  const entriesWithBalance = useMemo(() => {
    let running = 0
    return filteredEntries.map((entry) => {
      running += (entry.debit || 0) - (entry.credit || 0)
      return { ...entry, runningBalance: running }
    })
  }, [filteredEntries])

  const groupedEntries = useMemo(() => {
    const groups = []
    let currentGroup = null
    entriesWithBalance.forEach((entry) => {
      const key = `${entry.date}||${entry.db_name}||${entry.db_id}`
      if (!currentGroup || currentGroup.key !== key) {
        currentGroup = { key, entries: [] }
        groups.push(currentGroup)
      }
      currentGroup.entries.push(entry)
    })
    return groups
  }, [entriesWithBalance])

  const totalRows = filteredEntries.length
  const isBalanced = Math.abs(grandTotalDebit - grandTotalCredit) < 0.01

  // ─────────────────────────────────────────────────────────────
  // EXCEL EXPORT — matches on-screen layout
  // ─────────────────────────────────────────────────────────────
  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet([])

    // Helpers
    const setCell = (ws, addr, value, style) => {
      if (!ws[addr]) ws[addr] = {}
      ws[addr].v = value
      ws[addr].t = typeof value === 'number' ? 'n' : 's'
      if (style) ws[addr].s = style
    }

    // Color constants (ARGB hex, no #)
    const BLACK_BG = { fgColor: { rgb: '111827' } }
    const RED_BG = { fgColor: { rgb: 'DC2626' } }
    const GRAY_BG = { fgColor: { rgb: 'F9FAFB' } }
    const WHITE_BG = { fgColor: { rgb: 'FFFFFF' } }
    const BORDER_GRAY = {
      top: { style: 'thin', color: { rgb: 'E5E7EB' } },
      bottom: { style: 'thin', color: { rgb: 'E5E7EB' } },
      left: { style: 'thin', color: { rgb: 'E5E7EB' } },
      right: { style: 'thin', color: { rgb: 'E5E7EB' } },
    }
    const BORDER_GROUP = {
      top: { style: 'thin', color: { rgb: 'E5E7EB' } },
      bottom: { style: 'medium', color: { rgb: 'D1D5DB' } },
      left: { style: 'thin', color: { rgb: 'E5E7EB' } },
      right: { style: 'thin', color: { rgb: 'E5E7EB' } },
    }

    const whiteOnBlack = (bold = false, align = 'left') => ({
      font: { bold, color: { rgb: 'FFFFFF' }, name: 'Calibri', sz: 9 },
      fill: BLACK_BG,
      alignment: { horizontal: align, vertical: 'center', wrapText: false },
      border: { right: { style: 'thin', color: { rgb: '374151' } } },
    })
    const redOnBlack = (bold = false, align = 'center') => ({
      font: { bold, color: { rgb: 'EF4444' }, name: 'Calibri', sz: 8 },
      fill: BLACK_BG,
      alignment: { horizontal: align, vertical: 'center' },
    })
    const bodyCell = (fill, color = '111827', align = 'left', bold = false) => ({
      font: { bold, color: { rgb: color }, name: 'Calibri', sz: 9 },
      fill: { fgColor: { rgb: fill } },
      alignment: { horizontal: align, vertical: 'center', wrapText: false },
      border: BORDER_GRAY,
    })
    const groupSepCell = (fill, color = '111827', align = 'left', bold = false) => ({
      font: { bold, color: { rgb: color }, name: 'Calibri', sz: 9 },
      fill: { fgColor: { rgb: fill } },
      alignment: { horizontal: align, vertical: 'center', wrapText: false },
      border: BORDER_GROUP,
    })

    // Column letters: A=Date, B=AccountTitle, C=Debit, D=Credit, E=Balance
    const COLS = ['A', 'B', 'C', 'D', 'E']
    let r = 1 // 1-indexed row

    // ── Row 1: Report title bar (black bg) ──
    ;['A', 'B', 'C', 'D', 'E'].forEach((c) => {
      setCell(
        ws,
        `${c}${r}`,
        c === 'A'
          ? 'GENERAL LEDGER — CHRONOLOGICAL'
          : c === 'E'
            ? isBalanced
              ? 'BALANCED'
              : 'UNBALANCED'
            : '',
        {
          font: {
            bold: true,
            color: {
              rgb: c === 'E' ? (isBalanced ? '4ADE80' : 'F87171') : 'FFFFFF',
            },
            name: 'Calibri',
            sz: c === 'A' ? 13 : 9,
          },
          fill: BLACK_BG,
          alignment: {
            horizontal: c === 'E' ? 'right' : 'left',
            vertical: 'center',
          },
        },
      )
    })
    r++

    // ── Row 2: Period subtitle ──
    ;['A', 'B', 'C', 'D', 'E'].forEach((c) => {
      setCell(
        ws,
        `${c}${r}`,
        c === 'A'
          ? `Period: ${formatDate(startDate) || 'All'} — ${formatDate(endDate) || 'All'}`
          : c === 'E'
            ? `Generated: ${new Date().toLocaleDateString('en-PH')}`
            : '',
        {
          font: { bold: false, color: { rgb: '6B7280' }, name: 'Calibri', sz: 8 },
          fill: BLACK_BG,
          alignment: {
            horizontal: c === 'E' ? 'right' : 'left',
            vertical: 'center',
          },
        },
      )
    })
    r++

    // ── Row 3: blank spacer ──
    r++

    // ── Row 4: "Amount (₱)" spanning header row ──
    setCell(ws, `A${r}`, 'DATE', whiteOnBlack(true, 'left'))
    setCell(
      ws,
      `B${r}`,
      'ACCOUNT TITLE AND EXPLANATIONS',
      whiteOnBlack(true, 'left'),
    )
    setCell(ws, `C${r}`, 'AMOUNT (₱)', redOnBlack(true, 'center'))
    setCell(ws, `D${r}`, '', redOnBlack(false, 'center'))
    setCell(ws, `E${r}`, '', redOnBlack(false, 'center'))
    r++

    // ── Row 5: Debit / Credit / Balance sub-header ──
    setCell(ws, `A${r}`, '', whiteOnBlack(true, 'left'))
    setCell(ws, `B${r}`, '', whiteOnBlack(true, 'left'))
    setCell(ws, `C${r}`, 'DEBIT', whiteOnBlack(true, 'right'))
    setCell(ws, `D${r}`, 'CREDIT', whiteOnBlack(true, 'right'))
    setCell(ws, `E${r}`, 'BALANCE', whiteOnBlack(true, 'right'))
    r++

    const headerStartRow = 4
    const headerEndRow = r - 1

    // ── Data rows ──
    groupedEntries.forEach((group, gIdx) => {
      const fill = gIdx % 2 === 0 ? 'FFFFFF' : 'F9FAFB'
      group.entries.forEach((entry, eIdx) => {
        const isFirst = eIdx === 0
        const isLast = eIdx === group.entries.length - 1
        const isCreditLine = entry.debit === 0 && entry.credit !== 0
        const cellFn = isLast ? groupSepCell : bodyCell

        setCell(
          ws,
          `A${r}`,
          isFirst ? formatDate(entry.date) : '',
          cellFn(fill, '111827', 'left', false),
        )
        setCell(
          ws,
          `B${r}`,
          `${entry.account_code}  ${entry.account_name}${isCreditLine ? '  (credit)' : ''}`,
          cellFn(fill, isCreditLine ? '6B7280' : '111827', 'left', !isCreditLine),
        )

        if (entry.debit !== 0) {
          ws[`C${r}`] = {
            v: entry.debit,
            t: 'n',
            z: '#,##0.00',
            s: cellFn(fill, '111827', 'right', true),
          }
        } else {
          setCell(ws, `C${r}`, '—', cellFn(fill, 'D1D5DB', 'right', false))
        }

        if (entry.credit !== 0) {
          ws[`D${r}`] = {
            v: entry.credit,
            t: 'n',
            z: '#,##0.00',
            s: cellFn(fill, 'DC2626', 'right', true),
          }
        } else {
          setCell(ws, `D${r}`, '—', cellFn(fill, 'D1D5DB', 'right', false))
        }

        if (isLast) {
          const balColor = entry.runningBalance >= 0 ? '111827' : 'DC2626'
          const balLabel =
            entry.runningBalance > 0 ? ' DR' : entry.runningBalance < 0 ? ' CR' : ''
          ws[`E${r}`] = {
            v: Math.abs(entry.runningBalance),
            t: 'n',
            z: '#,##0.00',
            s: groupSepCell(fill, balColor, 'right', true),
          }
          // append DR/CR label as a suffix string cell when balance is shown
          ws[`E${r}`] = {
            v: `${fmt(Math.abs(entry.runningBalance))}${balLabel}`,
            t: 's',
            s: groupSepCell(fill, balColor, 'right', true),
          }
        } else {
          setCell(ws, `E${r}`, '—', cellFn(fill, 'D1D5DB', 'right', false))
        }

        r++
      })
    })

    // ── Totals footer row ──
    const footStyle = (align = 'left') => ({
      font: { bold: true, color: { rgb: 'FFFFFF' }, name: 'Calibri', sz: 10 },
      fill: { fgColor: { rgb: '111827' } },
      alignment: { horizontal: align, vertical: 'center' },
      border: { top: { style: 'thick', color: { rgb: 'DC2626' } } },
    })
    setCell(ws, `A${r}`, 'TOTAL', footStyle('left'))
    setCell(ws, `B${r}`, `${totalRows} entries`, footStyle('left'))
    ws[`C${r}`] = {
      v: grandTotalDebit,
      t: 'n',
      z: '#,##0.00',
      s: footStyle('right'),
    }
    ws[`D${r}`] = {
      v: grandTotalCredit,
      t: 'n',
      z: '#,##0.00',
      s: {
        ...footStyle('right'),
        font: { bold: true, color: { rgb: 'FCA5A5' }, name: 'Calibri', sz: 10 },
      },
    }
    const netVal = Math.abs(grandTotalDebit - grandTotalCredit)
    ws[`E${r}`] = {
      v: `${fmt(netVal)} ${isBalanced ? 'BALANCED' : grandTotalDebit > grandTotalCredit ? 'DR' : 'CR'}`,
      t: 's',
      s: {
        ...footStyle('right'),
        font: {
          bold: true,
          color: { rgb: isBalanced ? '4ADE80' : 'FBBF24' },
          name: 'Calibri',
          sz: 10,
        },
      },
    }

    // ── Sheet range & column widths ──
    ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: r, c: 4 } })
    ws['!cols'] = [
      { wch: 14 }, // Date
      { wch: 48 }, // Account Title
      { wch: 18 }, // Debit
      { wch: 18 }, // Credit
      { wch: 20 }, // Balance
    ]
    ws['!rows'] = [
      { hpt: 24 }, // title
      { hpt: 16 }, // subtitle
      { hpt: 6 }, // spacer
      { hpt: 18 }, // Amount header
      { hpt: 18 }, // Debit/Credit/Balance
    ]

    // Merge title cells A1:D1 and A2:D2
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 3 } }, // title text
      { s: { r: 1, c: 0 }, e: { r: 1, c: 3 } }, // subtitle text
      { s: { r: 3, c: 2 }, e: { r: 3, c: 4 } }, // "Amount (₱)" spans C-E row 4
      { s: { r: 4, c: 0 }, e: { r: 4, c: 1 } }, // blank under date+title in sub-header
    ]

    XLSX.utils.book_append_sheet(wb, ws, 'General Ledger')
    XLSX.writeFile(
      wb,
      `general-ledger-${new Date().toISOString().split('T')[0]}.xlsx`,
    )
    setExportMenuOpen(false)
  }

  // ─────────────────────────────────────────────────────────────
  // PDF EXPORT — matches on-screen layout
  // ─────────────────────────────────────────────────────────────
  const handleExportPDF = async () => {
    try {
      const { jsPDF } = await import('jspdf')
      const { default: autoTable } = await import('jspdf-autotable')

      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'pt',
        format: 'letter',
      })
      const W = doc.internal.pageSize.getWidth()
      const M = 36
      let y = renderPDFCompanyHeader(doc, company, W, M)

      // Color palette
      const BLK = [17, 24, 39]
      const RED = [220, 38, 38]
      const GRY = [107, 114, 128]
      const LGT = [229, 231, 235]
      const WHT = [255, 255, 255]
      const GRN = [74, 222, 128]
      const ORG = [251, 191, 36]
      const LGRY = [249, 250, 251]

      // ── Title bar (full-width black band) ──
      doc.setFillColor(...BLK)
      doc.rect(M, y - 14, W - M * 2, 32, 'F')
      doc
        .setFont('helvetica', 'bold')
        .setFontSize(13)
        .setTextColor(...WHT)
      doc.text('GENERAL LEDGER — CHRONOLOGICAL', M + 8, y + 6)
      doc.setFontSize(8).setTextColor(...(isBalanced ? GRN : RED))
      doc.text(isBalanced ? 'BALANCED' : 'UNBALANCED', W - M - 8, y + 6, {
        align: 'right',
      })
      y += 32

      // ── Subtitle bar ──
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
        `Generated: ${new Date().toLocaleDateString('en-PH')}   ${totalRows} entries`,
        W - M - 8,
        y + 10,
        { align: 'right' },
      )
      y += 22

      // ── Build table body from grouped entries ──
      const body = []
      groupedEntries.forEach((group, gIdx) => {
        group.entries.forEach((entry, eIdx) => {
          const isFirst = eIdx === 0
          const isLast = eIdx === group.entries.length - 1
          const isCreditLine = entry.debit === 0 && entry.credit !== 0

          body.push({
            _isLast: isLast,
            _isCreditLine: isCreditLine,
            _gIdx: gIdx,
            date: isFirst ? formatDate(entry.date) : '',
            title: entry.account_code
              ? `${entry.account_code}\n${isCreditLine ? '    ' : ''}${entry.account_name}${entry.particulars ? `\n    (${entry.particulars})` : ''}`
              : entry.account_name,
            debit: entry.debit !== 0 ? fmt(entry.debit) : '—',
            credit: entry.credit !== 0 ? fmt(entry.credit) : '—',
            balance: isLast
              ? `${fmt(Math.abs(entry.runningBalance))}\n${entry.runningBalance > 0 ? 'DR' : entry.runningBalance < 0 ? 'CR' : '—'}`
              : '—',
            _runBal: entry.runningBalance,
            _debitNum: entry.debit,
            _creditNum: entry.credit,
          })
        })
      })

      autoTable(doc, {
        startY: y,
        margin: { left: M, right: M },
        tableWidth: W - M * 2,

        // ── Two-row header matching on-screen ──
        head: [
          // Row 1: Date (rowspan hack via empty row 2), Title, "Amount (₱)" spanning 3
          [
            {
              content: 'DATE',
              rowSpan: 2,
              styles: { halign: 'left', valign: 'middle' },
            },
            {
              content: 'ACCOUNT TITLE AND EXPLANATIONS',
              rowSpan: 2,
              styles: { halign: 'left', valign: 'middle' },
            },
            {
              content: 'AMOUNT (₱)',
              colSpan: 3,
              styles: {
                halign: 'center',
                valign: 'middle',
                textColor: [239, 68, 68],
              },
            },
          ],
          // Row 2: Debit / Credit / Balance
          [
            { content: 'DEBIT', styles: { halign: 'right', valign: 'middle' } },
            { content: 'CREDIT', styles: { halign: 'right', valign: 'middle' } },
            { content: 'BALANCE', styles: { halign: 'right', valign: 'middle' } },
          ],
        ],

        body: body.map((row) => [
          row.date,
          row.title,
          row.debit,
          row.credit,
          row.balance,
        ]),

        foot: [
          [
            {
              content: 'TOTAL',
              colSpan: 2,
              styles: { halign: 'left', fontStyle: 'bold' },
            },
            {
              content: fmt(grandTotalDebit),
              styles: { halign: 'right', fontStyle: 'bold' },
            },
            {
              content: fmt(grandTotalCredit),
              styles: {
                halign: 'right',
                fontStyle: 'bold',
                textColor: [252, 165, 165],
              },
            },
            {
              content: `${fmt(Math.abs(grandTotalDebit - grandTotalCredit))} ${isBalanced ? 'BALANCED' : grandTotalDebit > grandTotalCredit ? 'DR' : 'CR'}`,
              styles: {
                halign: 'right',
                fontStyle: 'bold',
                textColor: isBalanced ? [74, 222, 128] : [251, 191, 36],
              },
            },
          ],
        ],

        theme: 'plain',

        headStyles: {
          fillColor: BLK,
          textColor: WHT,
          fontStyle: 'bold',
          fontSize: 8,
          cellPadding: { top: 5, bottom: 5, left: 5, right: 5 },
          lineColor: [55, 65, 81],
          lineWidth: 0.5,
        },

        footStyles: {
          fillColor: BLK,
          textColor: WHT,
          fontStyle: 'bold',
          fontSize: 9,
          cellPadding: { top: 6, bottom: 6, left: 5, right: 5 },
          lineColor: RED,
          lineWidth: { top: 3, bottom: 0, left: 0, right: 0 },
        },

        styles: {
          fontSize: 8,
          cellPadding: { top: 4, bottom: 4, left: 5, right: 5 },
          textColor: [55, 65, 81],
          lineColor: LGT,
          lineWidth: 0.3,
          valign: 'top',
        },

        columnStyles: {
          0: { cellWidth: 65, halign: 'left' },
          1: { cellWidth: 'auto', halign: 'left' },
          2: { cellWidth: 85, halign: 'right', fontStyle: 'bold' },
          3: { cellWidth: 85, halign: 'right', fontStyle: 'bold' },
          4: { cellWidth: 90, halign: 'right', fontStyle: 'bold' },
        },

        // ── Per-cell styling to replicate on-screen look ──
        didParseCell(data) {
          if (data.section !== 'body') return
          const row = body[data.row.index]
          if (!row) return

          const isEven = row._gIdx % 2 === 0
          data.cell.styles.fillColor = isEven ? WHT : LGRY

          // Group separator — thicker bottom border on last row of transaction
          if (row._isLast) {
            data.cell.styles.lineWidth = {
              top: 0.3,
              bottom: 1.5,
              left: 0.3,
              right: 0.3,
            }
            data.cell.styles.lineColor = [156, 163, 175]
          }

          // Credit lines indented
          if (data.column.index === 1 && row._isCreditLine) {
            data.cell.styles.textColor = [107, 114, 128]
          }

          // Debit column: black text for values, light gray for dashes
          if (data.column.index === 2) {
            data.cell.styles.textColor =
              row._debitNum !== 0 ? [17, 24, 39] : [209, 213, 219]
          }

          // Credit column: red for values, light gray for dashes
          if (data.column.index === 3) {
            data.cell.styles.textColor =
              row._creditNum !== 0 ? [220, 38, 38] : [209, 213, 219]
          }

          // Balance column: black DR, red CR, gray for non-last
          if (data.column.index === 4) {
            if (row._isLast) {
              data.cell.styles.textColor =
                row._runBal >= 0 ? [17, 24, 39] : [220, 38, 38]
              data.cell.styles.fontStyle = 'bold'
            } else {
              data.cell.styles.textColor = [209, 213, 219]
            }
          }
        },

        // ── Page numbers ──
        didDrawPage(data) {
          const pageCount = doc.internal.getNumberOfPages()
          doc
            .setFont('helvetica', 'normal')
            .setFontSize(7)
            .setTextColor(...GRY)
          doc.text(
            `Page ${data.pageNumber} of ${pageCount}`,
            W - M,
            doc.internal.pageSize.getHeight() - 12,
            { align: 'right' },
          )
          doc.text(
            'GENERAL LEDGER — CONFIDENTIAL',
            M,
            doc.internal.pageSize.getHeight() - 12,
          )
        },
      })

      doc.save(`general-ledger-${new Date().toISOString().split('T')[0]}.pdf`)
      setExportMenuOpen(false)
    } catch (err) {
      console.error('PDF export error:', err)
    }
  }

  if (loading && ledgerEntries.length === 0)
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

  return (
    <div className="flex flex-col gap-3 bg-[#F3F4F6] h-full">
      {/* ── PAGE HEADER ── */}
      <div className="flex items-center justify-between flex-wrap gap-3 flex-shrink-0">
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
            onClick={fetchGeneralLedger}
            className="w-10 h-10 bg-red-600 text-white rounded-xl hover:bg-red-700 flex items-center justify-center transition-colors"
          >
            <RefreshCcw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* ── STAT CARDS ── */}
      <div className="grid grid-cols-4 gap-3 flex-shrink-0">
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
          value={`₱${fmt(grandTotalDebit)}`}
          sub="PHP"
          small
        />
        <StatCard
          iconBg="bg-red-50"
          iconColor="text-red-600"
          icon={<ArrowDownLeft size={18} />}
          label="Total Credit"
          value={`₱${fmt(grandTotalCredit)}`}
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

      {/* ── TOOLBAR ── */}
      <div className="bg-white border border-gray-100 rounded-2xl px-4 py-3 flex items-center gap-3 flex-wrap shadow-sm flex-shrink-0">
        <div className="flex-1 min-w-[200px] flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 h-8 focus-within:border-red-500 focus-within:bg-white transition-all">
          <Search size={14} className="text-gray-300 flex-shrink-0" />
          <input
            type="text"
            placeholder="Search by account code, name, or center..."
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

      {/* ── TABLE CARD ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col flex-1 overflow-hidden min-h-0">
        {/* Title bar */}
        <div
          className="flex items-center gap-2 px-5 py-3 flex-shrink-0"
          style={{ backgroundColor: '#111827' }}
        >
          <FileText size={14} className="text-gray-500" />
          <span className="text-[11px] font-black uppercase tracking-[3px] text-white">
            General Ledger — Chronological
          </span>
          <span className="text-[10px] font-bold text-gray-500 ml-1">
            {totalRows} entries
          </span>
          <div className="ml-auto">
            {isBalanced ? (
              <span className="px-2.5 py-1 bg-green-900 text-green-300 text-[9px] font-black uppercase rounded-md tracking-widest">
                Balanced
              </span>
            ) : (
              <span className="px-2.5 py-1 border border-red-500 text-red-400 text-[9px] font-black uppercase rounded-md tracking-widest">
                Unbalanced
              </span>
            )}
          </div>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto overflow-x-auto custom-scrollbar flex-1 min-h-0">
          {filteredEntries.length === 0 ? (
            <div className="py-16 text-center text-[12px] font-bold text-gray-300">
              No entries found
            </div>
          ) : (
            <table className="w-full border-collapse" style={{ minWidth: '800px' }}>
              <colgroup>
                <col style={{ width: '120px' }} />
                <col />
                <col style={{ width: '160px' }} />
                <col style={{ width: '160px' }} />
                <col style={{ width: '160px' }} />
              </colgroup>
              <thead className="sticky top-0 z-20">
                <tr style={{ backgroundColor: '#111827' }}>
                  <th
                    rowSpan={2}
                    style={{ backgroundColor: '#111827' }}
                    className="py-3 px-4 text-[11px] font-black uppercase tracking-widest text-white text-left border-r border-gray-700 align-middle"
                  >
                    Date
                  </th>
                  <th
                    rowSpan={2}
                    style={{ backgroundColor: '#111827' }}
                    className="py-3 px-4 text-[11px] font-black uppercase tracking-widest text-white text-left border-r-2 border-red-700 align-middle"
                  >
                    Account Title and Explanations
                  </th>
                  <th
                    colSpan={3}
                    style={{ backgroundColor: '#111827' }}
                    className="py-2 px-4 text-[10px] font-black uppercase tracking-[3px] text-red-500 text-center border-b border-gray-700"
                  >
                    Amount (₱)
                  </th>
                </tr>
                <tr style={{ backgroundColor: '#111827' }}>
                  <th
                    style={{ backgroundColor: '#111827' }}
                    className="py-2 px-4 text-[11px] font-black uppercase tracking-widest text-white text-right border-r border-gray-700"
                  >
                    Debit
                  </th>
                  <th
                    style={{ backgroundColor: '#111827' }}
                    className="py-2 px-4 text-[11px] font-black uppercase tracking-widest text-white text-right border-r border-gray-700"
                  >
                    Credit
                  </th>
                  <th
                    style={{ backgroundColor: '#111827' }}
                    className="py-2 px-4 text-[11px] font-black uppercase tracking-widest text-white text-right"
                  >
                    Balance
                  </th>
                </tr>
              </thead>
              <tbody>
                {groupedEntries.map((group, gIdx) => {
                  const rowBg = gIdx % 2 === 0 ? '#ffffff' : '#f9fafb'
                  return group.entries.map((entry, eIdx) => {
                    const isFirst = eIdx === 0
                    const isLast = eIdx === group.entries.length - 1
                    const isCreditLine = entry.debit === 0 && entry.credit !== 0
                    return (
                      <tr
                        key={`${gIdx}-${eIdx}`}
                        style={{ backgroundColor: rowBg }}
                        className={[
                          isLast ? 'border-b-2 border-gray-300' : '',
                          'hover:bg-red-50 transition-colors',
                        ].join(' ')}
                      >
                        <td className="py-2.5 px-4 text-[11px] font-bold text-black align-top whitespace-nowrap border-r border-gray-200">
                          {isFirst ? formatDate(entry.date) : null}
                        </td>
                        <td className="py-2.5 px-4 text-[11px] text-gray-800 border-r-2 border-gray-200">
                          <div
                            className={`flex items-start gap-1 ${isCreditLine ? 'pl-5' : ''}`}
                          >
                            {isCreditLine && (
                              <span className="text-gray-300 text-[10px] mt-0.5 select-none">
                                └
                              </span>
                            )}
                            <div>
                              <span className="font-mono text-[9px] text-gray-400 block leading-none mb-0.5">
                                {entry.account_code}
                              </span>
                              <span className="font-bold text-black">
                                {entry.account_name}
                              </span>
                              {entry.particulars && (
                                <span className="block text-[10px] text-gray-400 italic mt-0.5">
                                  ({entry.particulars})
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono text-[12px] font-black text-black align-middle border-r border-gray-200">
                          {entry.debit !== 0 ? (
                            fmt(entry.debit)
                          ) : (
                            <span className="text-gray-200">—</span>
                          )}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono text-[12px] font-black text-red-600 align-middle border-r border-gray-200">
                          {entry.credit !== 0 ? (
                            fmt(entry.credit)
                          ) : (
                            <span className="text-gray-200">—</span>
                          )}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono text-[12px] font-black align-middle">
                          {isLast ? (
                            <span
                              className={
                                entry.runningBalance >= 0
                                  ? 'text-black'
                                  : 'text-red-600'
                              }
                            >
                              {fmt(Math.abs(entry.runningBalance))}
                              <span className="text-[9px] font-black ml-1 text-gray-400">
                                {entry.runningBalance > 0
                                  ? 'DR'
                                  : entry.runningBalance < 0
                                    ? 'CR'
                                    : '—'}
                              </span>
                            </span>
                          ) : (
                            <span className="text-gray-200">—</span>
                          )}
                        </td>
                      </tr>
                    )
                  })
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Pinned footer */}
        <div
          className="flex-shrink-0 border-t-4 border-red-600"
          style={{ backgroundColor: '#111827' }}
        >
          <div
            className="px-6 py-4 grid grid-cols-3 gap-6"
            style={{ minWidth: '800px' }}
          >
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
                className={`text-[18px] font-black font-mono ${isBalanced ? 'text-green-400' : 'text-orange-400'}`}
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
