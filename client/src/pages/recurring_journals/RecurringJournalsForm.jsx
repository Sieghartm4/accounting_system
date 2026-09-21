import React, { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Save,
  Plus,
  Trash2,
  Minus,
  FileText,
  Layers,
  Landmark,
  Calculator,
  Search,
  ChevronDown,
  ChevronUp,
  Wallet,
  Repeat,
  Calendar,
} from 'lucide-react'
import ReactDOM from 'react-dom'
import DynamicToast from '../../components/DynamicToast'
import useResponsibilityCenter from '../responsibility_center/useResponsibilityCenter'

// ─────────────────────────────────────────────────────────────────────────────
// Portal Dropdown
// ─────────────────────────────────────────────────────────────────────────────
const MIN_DROPDOWN_WIDTH = 260

function PortalDropdown({ anchorRef, open, children }) {
  const [style, setStyle] = useState({})

  useEffect(() => {
    if (!open || !anchorRef.current) return
    const update = () => {
      const rect = anchorRef.current.getBoundingClientRect()
      const viewportHeight = window.innerHeight
      const spaceBelow = viewportHeight - rect.bottom
      const spaceAbove = rect.top
      const dropdownMaxH = 240
      const width = Math.max(rect.width, MIN_DROPDOWN_WIDTH)
      let top, maxHeight
      if (spaceBelow >= Math.min(dropdownMaxH, 160) || spaceBelow >= spaceAbove) {
        top = rect.bottom + window.scrollY + 4
        maxHeight = Math.min(dropdownMaxH, spaceBelow - 8)
      } else {
        maxHeight = Math.min(dropdownMaxH, spaceAbove - 8)
        top = rect.top + window.scrollY - maxHeight - 4
      }
      let left = rect.left + window.scrollX
      if (left + width > window.innerWidth - 8)
        left = window.innerWidth - width - 8 + window.scrollX
      setStyle({ top, left, width, maxHeight })
    }
    update()
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
    }
  }, [open, anchorRef])

  if (!open) return null
  return ReactDOM.createPortal(
    <div
      style={{
        position: 'absolute',
        top: style.top,
        left: style.left,
        width: style.width,
        maxHeight: style.maxHeight,
        zIndex: 99999,
        overflowY: 'auto',
        background: '#fff',
        border: '1px solid #e5e7eb',
        borderRadius: '10px',
        boxShadow: '0 10px 40px -6px rgba(0,0,0,0.18)',
      }}
    >
      {children}
    </div>,
    document.body,
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Reusable SearchableDropdown
// ─────────────────────────────────────────────────────────────────────────────
function SearchableDropdown({
  placeholder,
  value,
  onChange,
  onSelect,
  options,
  inputClassName,
  emptyText = 'No results found',
  disabled = false,
}) {
  const [open, setOpen] = useState(false)
  const anchorRef = useRef(null)
  const closeTimer = useRef(null)
  const filtered = options.filter(
    (o) =>
      !value ||
      o.label.toLowerCase().includes(value.toLowerCase()) ||
      (o.sublabel || '').toLowerCase().includes(value.toLowerCase()),
  )
  const handleBlur = () => {
    closeTimer.current = setTimeout(() => setOpen(false), 180)
  }
  const handleFocus = () => {
    if (!disabled) {
      clearTimeout(closeTimer.current)
      setOpen(true)
    }
  }
  const handleSelect = (opt) => {
    if (!disabled) {
      clearTimeout(closeTimer.current)
      onSelect(opt)
      setOpen(false)
    }
  }

  if (disabled) {
    return (
      <div className="relative w-full">
        <input
          type="text"
          placeholder={placeholder}
          value={value}
          readOnly
          className={`${inputClassName} cursor-not-allowed text-black`}
          autoComplete="off"
        />
      </div>
    )
  }

  return (
    <div ref={anchorRef} className="relative w-full">
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => {
          onChange(e.target.value)
          setOpen(true)
        }}
        onFocus={handleFocus}
        onBlur={handleBlur}
        className={inputClassName}
        autoComplete="off"
      />
      <PortalDropdown anchorRef={anchorRef} open={open}>
        {filtered.length > 0 ? (
          filtered.map((opt, i) => (
            <div
              key={opt.value ?? i}
              onMouseDown={(e) => {
                e.preventDefault()
                handleSelect(opt)
              }}
              className="flex items-center justify-between gap-2 px-3 py-2 text-[12px] font-bold hover:bg-red-50 cursor-pointer transition-colors border-b border-gray-100 last:border-b-0 text-black"
            >
              <span className="truncate flex-1">{opt.label}</span>
              {opt.sublabel && (
                <span className="text-gray-400 text-[10px] font-semibold uppercase tracking-wide flex-shrink-0">
                  {opt.sublabel}
                </span>
              )}
            </div>
          ))
        ) : (
          <div className="px-3 py-3 text-[12px] text-gray-400 text-center">
            {emptyText}
          </div>
        )}
      </PortalDropdown>
    </div>
  )
}

const fmt = (n = 0) =>
  Number(n).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

// ─────────────────────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────────────────────
// Format price for display
const formatPriceDisplay = (value) => {
  if (value === '' || value === null || value === undefined) return ''

  const stringValue = String(value)
  const parts = stringValue.split('.')
  const integerPart = parts[0]
  const decimalPart = parts.length > 1 ? parts[1] : null

  let formattedInteger = ''
  if (integerPart) {
    formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  }

  if (decimalPart !== null) {
    return `${formattedInteger}.${decimalPart}`
  }

  return formattedInteger
}

// Parse price input
const parsePriceInput = (input) => {
  if (input === '' || input === null || input === undefined) return ''

  let cleaned = String(input).replace(/[^0-9.]/g, '')
  const parts = cleaned.split('.')
  if (parts.length > 2) {
    cleaned = parts[0] + '.' + parts.slice(1).join('')
  }

  return cleaned
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper functions for summary
// ─────────────────────────────────────────────────────────────────────────────
function SDivider() {
  return <div className="h-[1px] w-full bg-gray-400" />
}

const SummaryRow = ({
  label,
  value,
  badge,
  badgeColor = "text-zinc-400",
  valuePrefix = "",
  textColor = "text-zinc-900",
  containerClassName = "py-1 border-b border-zinc-500",
  isNested = false,
}) => {
  const strVal = String(value || "");

  const getValueFontSize = (len) => {
    if (len > 24) return "text-xs";
    if (len > 18) return "text-sm";
    return "text-sm sm:text-base";
  };

  return (
    <div
      className={`flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5 w-full min-w-0 ${containerClassName}`}
    >
      <div className="flex items-center gap-1 min-w-max">
        <span
          className={`font-bold text-zinc-800 ${isNested ? "text-xs" : "text-sm"
            }`}
        >
          {label}
        </span>
        {badge && (
          <span className={`text-xs font-bold ${badgeColor}`}>{badge}</span>
        )}
      </div>

      <div className="flex-1 flex justify-end min-w-max text-right">
        <span
          className={`font-extrabold font-mono tracking-tight whitespace-nowrap ml-auto ${textColor} ${getValueFontSize(
            strVal.length
          )}`}
        >
          {valuePrefix && <span className="mr-0.5">{valuePrefix}</span>}
          <span className="text-emerald-600 font-extrabold mr-1">₱</span>
          <span>{strVal}</span>
        </span>
      </div>
    </div>
  );
};

const TotalHeroAmount = ({ value, fmt }) => {
  const formattedVal = fmt(value);
  const len = String(formattedVal || "").length;

  const getHeroFontSize = (charCount) => {
    if (charCount > 25) return "text-sm";
    if (charCount > 18) return "text-base";
    if (charCount > 12) return "text-xl";
    return "text-2xl";
  };

  return (
    <div
      className={`font-black font-mono text-white tracking-tight drop-shadow-sm text-right whitespace-nowrap overflow-hidden transition-all duration-150 ${getHeroFontSize(
        len
      )}`}
    >
      <span className="text-emerald-300 mr-1">₱</span>
      <span>{formattedVal}</span>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────
export default function RecurringJournalsForm({
  onBack,
  onSuccess,
  isViewMode = false,
  isEditMode = false,
  templateData = null,
}) {
  const [journalEntries, setJournalEntries] = useState([])

  // ── Remote data ──────────────────────────────────────────────────────────
  const [chartsOfAccounts, setChartsOfAccounts] = useState([])

  const {
    responsibilityCenters,
    loading: responsibilityCentersLoading,
    error: responsibilityCentersError,
  } = useResponsibilityCenter()

  const responsibilityCenterOptions = responsibilityCenters.map((center) => ({
    label: center.name || '',
    sublabel: center.department || '',
    value: center.name || '',
  }))

  const [bulkResponsibilityCenter, setBulkResponsibilityCenter] = useState('')

  // ── Header fields ───────────────────────────────────────────────────────
  const [name, setName] = useState('')
  const [reference, setReference] = useState('')
  const [frequency, setFrequency] = useState('MONTHLY')
  const [interval, setInterval] = useState(1)
  const [day, setDay] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [status, setStatus] = useState('ACTIVE')
  const [remarks, setRemarks] = useState('')
  const [isBasicDetailsCollapsed, setIsBasicDetailsCollapsed] = useState(false)
  const [isJournalEntriesCollapsed, setIsJournalEntriesCollapsed] = useState(false)

  const [toast, setToast] = useState(null)

  const coaOptions = chartsOfAccounts.map((a) => ({
    label: a.name || a.account_name,
    sublabel: a.code || a.account_code,
    value: a.id,
  }))

  const fetchChartsOfAccounts = async () => {
    try {
      const token = sessionStorage.getItem('authenticated')
      if (!token) throw new Error('No authorization token found')
      const res = await fetch(
        `${import.meta.env.VITE_SERVER_LINK}/charts_of_accounts`,
        { headers: { Authorization: `Bearer ${token}` } },
      )
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`)
      const result = await res.json()
      if (result.success) setChartsOfAccounts(result.data)
    } catch (err) {
      console.error('COA fetch error:', err.message)
    }
  }

  useEffect(() => {
    fetchChartsOfAccounts()
  }, [])

  useEffect(() => {
    if ((isViewMode || isEditMode) && templateData) {
      if (templateData.data && templateData.data.length > 0) {
        const template = templateData.data[0]
        setName(template.name || '')
        setReference(template.reference || '')
        setFrequency(template.frequency || 'MONTHLY')
        setInterval(template.interval || 1)
        setDay(template.day || '')
        setStartDate(template.start_date || '')
        setEndDate(template.end_date || '')
        setStatus(template.status || 'ACTIVE')
        setRemarks(template.remarks || '')
      }

      const items = templateData.items || (templateData.data?.[0]?.items)
      
      if (items && items.length > 0) {
        const journal = items.map((entry) => ({
          id: entry.id,
          account: entry.coa_id,
          accountSearch: entry.account_name,
          center: entry.responsibility_center || '',
          debit: entry.type === 'debit' ? parseFloat(entry.amount) || 0 : 0,
          credit: entry.type === 'credit' ? parseFloat(entry.amount) || 0 : 0,
          isManual: true,
        }))
        setJournalEntries(journal)
      } else {
        setJournalEntries([])
      }
    }
  }, [isViewMode, isEditMode, templateData])

  // ── Journal entry helpers ─────────────────────────────────────────────────
  const addJournalEntry = () =>
    setJournalEntries((prev) => [
      ...prev,
      {
        id: Date.now(),
        account: '',
        accountSearch: '',
        center: '',
        debit: '',
        credit: '',
        isManual: true,
      },
    ])

  // Initialize with at least one empty entry when creating new template
  useEffect(() => {
    if (!isViewMode && !isEditMode && journalEntries.length === 0) {
      addJournalEntry()
    }
  }, [isViewMode, isEditMode, journalEntries.length])
  const removeJournalEntry = (id) =>
    setJournalEntries((prev) => prev.filter((e) => e.id !== id))
  const updateJournalEntry = (id, field, value) =>
    setJournalEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, [field]: value } : e)),
    )

  const normalizeKey = (key) =>
    String(key || '')
      .trim()
      .toLowerCase()
  const normalizeValue = (value) => String(value || '').trim()
  const parseNumeric = (value) => {
    const cleaned = String(value || '')
      .replace(/,/g, '')
      .replace(/[₱\$]/g, '')
      .trim()
    return cleaned === '' || Number.isNaN(Number(cleaned)) ? null : Number(cleaned)
  }

  const findCoaIdByLabel = (label) => {
    if (!label) return ''
    const normalizedLabel = normalizeValue(label).toLowerCase()
    const found = coaOptions.find((coa) => {
      const labelMatch = normalizeValue(coa.label).toLowerCase() === normalizedLabel
      const sublabelMatch =
        normalizeValue(coa.sublabel).toLowerCase() === normalizedLabel
      const containsLabel = normalizeValue(`${coa.label} ${coa.sublabel}`)
        .toLowerCase()
        .includes(normalizedLabel)
      return labelMatch || sublabelMatch || containsLabel
    })
    return found?.value || ''
  }

  // ── Post Transaction ──────────────────────────────────────────────────────
  const handleSaveTemplate = async () => {
    try {
      const token = sessionStorage.getItem('authenticated')
      if (!token) {
        setToast({
          type: 'error',
          message: 'No authorization token found. Please login again.',
        })
        return
      }

      if (!name) {
        setToast({ type: 'warning', message: 'Template name is required' })
        return
      }

      if (!startDate) {
        setToast({ type: 'warning', message: 'Start date is required' })
        return
      }

      // Check if journal entries are balanced
      const totalDebit = journalEntries.reduce(
        (sum, entry) => sum + (parseFloat(entry.debit) || 0),
        0,
      )
      const totalCredit = journalEntries.reduce(
        (sum, entry) => sum + (parseFloat(entry.credit) || 0),
        0,
      )

      if (Math.abs(totalDebit - totalCredit) > 0.01) {
        setToast({
          type: 'warning',
          message:
            'Journal entries must be balanced. Total debits must equal total credits.',
        })
        return
      }

      if (journalEntries.length === 0) {
        setToast({
          type: 'warning',
          message: 'At least one journal entry is required',
        })
        return
      }

      const preparedJournalEntries = journalEntries.map((entry) => {
        const rawAccountValue = entry.account || entry.accountSearch || ''
        const accountValue = String(rawAccountValue || '').trim()
        const resolvedAccountId =
          accountValue && !Number.isNaN(Number(accountValue))
            ? Number(accountValue)
            : findCoaIdByLabel(accountValue)

        return {
          coa_id: resolvedAccountId || null,
          account_id: resolvedAccountId || null,
          responsibility_center: entry.center || '',
          debit: parseFloat(entry.debit) || 0,
          credit: parseFloat(entry.credit) || 0,
        }
      })

      const templatePayload = {
        name,
        frequency,
        interval: parseInt(interval) || 1,
        day: day ? parseInt(day) : null,
        start_date: startDate,
        end_date: endDate || null,
        status,
        remarks,
        journal_entries: preparedJournalEntries,
      }

      console.log('📤 Sending template payload:', templatePayload)
      console.log('📤 Journal entries count:', preparedJournalEntries.length)
      console.log('📤 Journal entries data:', preparedJournalEntries)

      const url = isEditMode && templateData
        ? `${import.meta.env.VITE_SERVER_LINK}/recurring_journals/${templateData.data[0].id}`
        : `${import.meta.env.VITE_SERVER_LINK}/recurring_journals`

      const method = isEditMode && templateData ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(templatePayload),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(
          errorData.message || `HTTP error! status: ${response.status}`,
        )
      }

      const result = await response.json()
      if (result.success) {
        const nextToast = {
          type: 'success',
          message: isEditMode
            ? 'Recurring journal template updated successfully!'
            : 'Recurring journal template created successfully!',
        }
        setToast(nextToast)
        if (onSuccess) await onSuccess(nextToast)
        onBack()
      } else {
        setToast({
          type: 'error',
          message: result.message || 'Failed to save template',
        })
      }
    } catch (error) {
      console.error('Error saving template:', error)
      setToast({ type: 'error', message: 'Error: ' + error.message })
    }
  }

  // ── Styles ────────────────────────────────────────────────────────────────
  const inputBase =
    'w-full px-3 py-1.5 rounded-lg text-[12px] font-bold outline-none transition-all ' +
    (isViewMode
      ? 'bg-gray-100 border border-gray-300 text-black cursor-not-allowed'
      : 'bg-gray-50 border border-gray-200 text-black focus:ring-1 focus:ring-red-500')
  const tableInput =
    'w-full rounded-md px-1 py-1 text-[13px] font-bold text-center outline-none ' +
    (isViewMode
      ? 'bg-gray-100 border border-gray-300 text-black cursor-not-allowed'
      : 'bg-gray-50/50 focus:ring-1 focus:ring-red-400')

  const totalDebit = journalEntries.reduce(
    (s, e) => s + (isNaN(parseFloat(e.debit)) ? 0 : parseFloat(e.debit)),
    0,
  )
  const totalCredit = journalEntries.reduce(
    (s, e) => s + (isNaN(parseFloat(e.credit)) ? 0 : parseFloat(e.credit)),
    0,
  )
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01
  const totalEntries = journalEntries.length

  const fadeInUp = {
    hidden: { opacity: 0, y: 15 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
  }

  return (
    <div className="h-full flex flex-col overflow-x-hidden bg-[#F3F4F6]">
      <style
        dangerouslySetInnerHTML={{
          __html: `
          .custom-table-scroller::-webkit-scrollbar { height: 6px; width: 6px; }
          .custom-table-scroller::-webkit-scrollbar-track { background: #f1f1f1; border-radius: 10px; }
          .custom-table-scroller::-webkit-scrollbar-thumb { background: #1a1a1a; border-radius: 10px; }
          .custom-table-scroller::-webkit-scrollbar-thumb:hover { background: #dc2626; }
          .sidebar-scroll::-webkit-scrollbar { width: 4px; }
          .sidebar-scroll::-webkit-scrollbar-track { background: transparent; }
          .sidebar-scroll::-webkit-scrollbar-thumb { background: #374151; border-radius: 4px; }
        `,
        }}
      />

      {toast && (
        <DynamicToast
          type={toast.type}
          message={toast.message}
          onClose={() => setToast(null)}
        />
      )}

      {/* TOP NAV */}
      <div className="flex items-center justify-between flex-shrink-0 mb-2">
        <nav
          className="cursor-pointer px-4 py-2 bg-gray-600 text-white text-[12px] font-black rounded-lg hover:bg-gray-700 transition-all uppercase tracking-[2px] flex items-center gap-2 shadow-md shadow-gray-200"
          onClick={onBack}
        >
          <ArrowLeft size={17} />
          <span className="text-white">Go Back</span>
        </nav>
        {!isViewMode && (
          <div className="flex gap-2 items-center">
            <button
              onClick={handleSaveTemplate}
              className="px-6 py-2 bg-green-600 text-white text-[12px] font-black rounded-lg hover:bg-green-700 transition-all uppercase tracking-[2px] flex items-center gap-2 shadow-md shadow-green-200"
            >
              <Save size={14} /> {isEditMode ? 'Update Template' : 'Create Template'}
            </button>
          </div>
        )}
      </div>

      {/* BODY */}
      <div className="flex-1 flex flex-col gap-2 min-h-0">
        <div className="flex-1 flex gap-2 min-h-0">
          {/* LEFT SIDEBAR - SUMMARY */}
          <aside className="w-full flex-shrink-0 flex flex-col gap-2 h-full max-w-[18%]">
            <section className="bg-white rounded-xl border border-red-200 shadow-md overflow-hidden flex-1 flex flex-col min-h-0">
              <div className="px-4 py-3 bg-gradient-to-r from-red-600 to-red-700 text-white flex items-center justify-between border-b border-red-800 shadow-sm flex-shrink-0">
                <div className="flex items-center gap-2">
                  <Calculator size={18} className="text-red-100" />
                  <h3 className="text-sm font-bold tracking-tight">Template Summary</h3>
                </div>
                <span className="text-xs bg-zinc-900 text-zinc-100 px-2.5 py-0.5 rounded-full border border-zinc-800 font-mono font-semibold">
                  PHP (₱)
                </span>
              </div>

              <div className="custom-table-scroller overflow-y-auto min-h-0 flex-1 custom-scrollbar p-3.5 py-2 space-y-1.5">
                <SummaryRow label="Total Entries:" value={totalEntries} />
                <SummaryRow
                  label="Total Debit:"
                  value={fmt(totalDebit)}
                  textColor="text-green-600"
                />
                <SummaryRow
                  label="Total Credit:"
                  value={fmt(totalCredit)}
                  textColor="text-red-600"
                />
              </div>

              <div className="p-3.5 pt-1 flex-shrink-0">
                <div className="h-[2px] w-full bg-red-600 rounded-full mb-2" />

                <div className="p-3 bg-gradient-to-br from-red-600 via-red-600 to-red-700 rounded-lg text-white shadow-md border-l-4 border-zinc-900 relative overflow-hidden">
                  <div className="flex items-center justify-between mb-1">
                    <span className="bg-zinc-900 text-zinc-100 px-2.5 py-0.5 rounded text-xs font-black tracking-wider uppercase border border-zinc-800 shadow-sm flex items-center gap-1">
                      <Wallet size={11} className="text-red-500" />
                      TOTAL AMOUNT
                    </span>
                  </div>

                  <div className="text-right w-full min-w-0">
                    <TotalHeroAmount value={totalDebit} fmt={fmt} />

                    <p className="text-xs text-red-100/90 mt-0.5 font-medium">
                      {!isBalanced ? `Unbalanced: ${fmt(Math.abs(totalDebit - totalCredit))}` : 'Balanced'}
                    </p>
                  </div>
                </div>
              </div>
            </section>
          </aside>

          {/* MAIN CONTENT */}
          <main className="flex-1 overflow-y-auto custom-table-scroller space-y-4 pr-1 min-h-0">
            <motion.div
              initial="hidden"
              animate="visible"
              variants={fadeInUp}
              className="space-y-4"
            >
              {/* BASIC DETAILS */}
              <section className="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden">
                <div className="px-4 py-2.5 bg-zinc-900 text-white flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-red-600 text-white flex items-center justify-center font-semibold text-sm">
                      <Repeat size={14} />
                    </div>
                    <h2 className="text-base font-bold tracking-tight">Template Details</h2>
                  </div>
                  <button
                    onClick={() => setIsBasicDetailsCollapsed(!isBasicDetailsCollapsed)}
                    className="text-white bg-red-600 hover:bg-red-700 p-2 rounded-lg transition-colors"
                    title={isBasicDetailsCollapsed ? 'Expand' : 'Collapse'}
                  >
                    {isBasicDetailsCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                  </button>
                </div>

                {!isBasicDetailsCollapsed && (
                  <div className="p-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Name */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                          Template Name <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          placeholder="Enter template name..."
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          disabled={isViewMode}
                          className={`w-full bg-white border rounded-lg px-3 py-2 text-sm text-zinc-800 focus:ring-2 focus:ring-red-600 focus:border-red-600 outline-none transition-all ${isViewMode ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : ''} ${!name ? 'border-red-500' : 'border-zinc-300'}`}
                        />
                      </div>

                      {/* Reference (read-only, auto-generated) */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                          Reference
                        </label>
                        <input
                          type="text"
                          placeholder="Auto-generated"
                          value={reference}
                          readOnly
                          className="w-full bg-gray-100 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-400 cursor-not-allowed"
                        />
                      </div>

                      {/* Frequency */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                          Frequency <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={frequency}
                          onChange={(e) => setFrequency(e.target.value)}
                          disabled={isViewMode}
                          className={`w-full bg-white border rounded-lg px-3 py-2 text-sm text-zinc-800 focus:ring-2 focus:ring-red-600 focus:border-red-600 outline-none transition-all ${isViewMode ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : ''}`}
                        >
                          <option value="DAILY">Daily</option>
                          <option value="WEEKLY">Weekly</option>
                          <option value="BIWEEKLY">Bi-Weekly</option>
                          <option value="MONTHLY">Monthly</option>
                          <option value="QUARTERLY">Quarterly</option>
                          <option value="SEMI_ANNUAL">Semi-Annual</option>
                          <option value="ANNUAL">Annual</option>
                        </select>
                      </div>

                      {/* Interval */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                          Interval <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="number"
                          min="1"
                          placeholder="1"
                          value={interval}
                          onChange={(e) => setInterval(e.target.value)}
                          disabled={isViewMode}
                          className={`w-full bg-white border rounded-lg px-3 py-2 text-sm text-zinc-800 focus:ring-2 focus:ring-red-600 focus:border-red-600 outline-none transition-all ${isViewMode ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : ''}`}
                        />
                      </div>

                      {/* Day (optional) */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                          Day <span className="text-red-500 font-normal normal-case tracking-normal ml-1">(Optional)</span>
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="31"
                          placeholder="e.g., 15 for 15th day"
                          value={day}
                          onChange={(e) => setDay(e.target.value)}
                          disabled={isViewMode}
                          className={`w-full bg-white border rounded-lg px-3 py-2 text-sm text-zinc-800 focus:ring-2 focus:ring-red-600 focus:border-red-600 outline-none transition-all ${isViewMode ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : ''}`}
                        />
                      </div>

                      {/* Status */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                          Status <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={status}
                          onChange={(e) => setStatus(e.target.value)}
                          disabled={isViewMode}
                          className={`w-full bg-white border rounded-lg px-3 py-2 text-sm text-zinc-800 focus:ring-2 focus:ring-red-600 focus:border-red-600 outline-none transition-all ${isViewMode ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : ''}`}
                        >
                          <option value="ACTIVE">Active</option>
                          <option value="INACTIVE">Inactive</option>
                        </select>
                      </div>

                      {/* Start Date */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                          Start Date <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="date"
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                          disabled={isViewMode}
                          className={`w-full bg-white border rounded-lg px-3 py-2 text-sm text-zinc-800 focus:ring-2 focus:ring-red-600 focus:border-red-600 outline-none transition-all ${isViewMode ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : ''} ${!startDate ? 'border-red-500' : 'border-zinc-300'}`}
                        />
                      </div>

                      {/* End Date */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                          End Date <span className="text-red-500 font-normal normal-case tracking-normal ml-1">(Optional)</span>
                        </label>
                        <input
                          type="date"
                          value={endDate}
                          onChange={(e) => setEndDate(e.target.value)}
                          disabled={isViewMode}
                          className={`w-full bg-white border rounded-lg px-3 py-2 text-sm text-zinc-800 focus:ring-2 focus:ring-red-600 focus:border-red-600 outline-none transition-all ${isViewMode ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : ''}`}
                        />
                      </div>

                      {/* Remarks */}
                      <div className="md:col-span-2">
                        <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                          Remarks
                        </label>
                        <textarea
                          placeholder="Enter remarks..."
                          value={remarks}
                          onChange={(e) => setRemarks(e.target.value)}
                          disabled={isViewMode}
                          rows={3}
                          className={`w-full bg-white border rounded-lg px-3 py-2 text-sm text-zinc-800 focus:ring-2 focus:ring-red-600 focus:border-red-600 outline-none transition-all ${isViewMode ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : ''}`}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </section>

              {/* JOURNAL ENTRIES */}
              <section className="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden">
                <div className="px-4 py-2.5 bg-zinc-900 text-white flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-red-600 text-white flex items-center justify-center font-semibold text-sm">
                      <Layers size={14} />
                    </div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-bold tracking-tight">Journal Entries</h2>
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-zinc-800 text-zinc-100 border border-zinc-700`}>
                        {isBalanced ? 'Balanced' : 'Unbalanced'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-white pointer-events-none" />
                      <div className="pl-7">
                        <SearchableDropdown
                          placeholder="Resp. Center to All"
                          value={bulkResponsibilityCenter}
                          onChange={setBulkResponsibilityCenter}
                          onSelect={(opt) => {
                            setBulkResponsibilityCenter(opt.value)
                            journalEntries.forEach((entry) =>
                              updateJournalEntry(entry.id, 'center', opt.value),
                            )
                          }}
                          options={responsibilityCenterOptions}
                          inputClassName="w-48 bg-zinc-800 border border-zinc-700 text-white text-[11px] font-bold rounded-lg px-2 py-1.5 outline-none focus:ring-1 focus:ring-red-500"
                          disabled={isViewMode}
                        />
                      </div>
                    </div>
                    {!isViewMode && (
                      <button
                        onClick={addJournalEntry}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-[11px] font-bold rounded-lg transition-colors"
                      >
                        <Plus size={12} /> Add Entry
                      </button>
                    )}
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-zinc-100 text-zinc-700 text-[11px] font-bold uppercase tracking-wider">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold">Account</th>
                        <th className="px-3 py-2 text-left font-semibold">Responsibility Center</th>
                        <th className="px-3 py-2 text-center font-semibold">Debit</th>
                        <th className="px-3 py-2 text-center font-semibold">Credit</th>
                        {!isViewMode && (
                          <th className="px-3 py-2 text-center font-semibold">Actions</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {journalEntries.map((entry) => (
                        <tr key={entry.id} className="border-b border-zinc-200 hover:bg-zinc-50">
                          <td className="px-3 py-2">
                            <SearchableDropdown
                              placeholder="Search account..."
                              value={entry.accountSearch}
                              onChange={(val) => updateJournalEntry(entry.id, 'accountSearch', val)}
                              onSelect={(opt) => {
                                updateJournalEntry(entry.id, 'account', opt.value)
                                updateJournalEntry(entry.id, 'accountSearch', opt.label)
                              }}
                              options={coaOptions}
                              inputClassName={tableInput}
                              disabled={isViewMode}
                            />
                          </td>
                          <td className="px-3 py-2">
                            <SearchableDropdown
                              placeholder="Center..."
                              value={entry.center}
                              onChange={(val) => updateJournalEntry(entry.id, 'center', val)}
                              onSelect={(opt) => updateJournalEntry(entry.id, 'center', opt.value)}
                              options={responsibilityCenterOptions}
                              inputClassName={tableInput}
                              disabled={isViewMode}
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="text"
                              value={formatPriceDisplay(entry.debit)}
                              onChange={(e) => {
                                const parsed = parsePriceInput(e.target.value)
                                updateJournalEntry(entry.id, 'debit', parsed)
                              }}
                              disabled={isViewMode}
                              className={tableInput}
                              placeholder="0.00"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="text"
                              value={formatPriceDisplay(entry.credit)}
                              onChange={(e) => {
                                const parsed = parsePriceInput(e.target.value)
                                updateJournalEntry(entry.id, 'credit', parsed)
                              }}
                              disabled={isViewMode}
                              className={tableInput}
                              placeholder="0.00"
                            />
                          </td>
                          {!isViewMode && (
                            <td className="px-3 py-2 text-center">
                              <button
                                onClick={() => removeJournalEntry(entry.id)}
                                className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="Remove entry"
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-zinc-50 font-bold text-zinc-800">
                      <tr>
                        <td colSpan={2} className="px-3 py-2 text-right">
                          TOTALS
                        </td>
                        <td className="px-3 py-2 text-center text-green-600">
                          ₱{fmt(totalDebit)}
                        </td>
                        <td className="px-3 py-2 text-center text-red-600">
                          ₱{fmt(totalCredit)}
                        </td>
                        {!isViewMode && <td></td>}
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </section>
            </motion.div>
          </main>
        </div>
      </div>
    </div>
  )
}
