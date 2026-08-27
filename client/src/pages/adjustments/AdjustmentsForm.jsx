import React, { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Save,
  Upload,
  Plus,
  Trash2,
  Minus,
  FileText,
  Paperclip,
  Layers,
  Landmark,
  Calculator,
  Search,
  ChevronDown,
  ChevronUp,
  Wallet,
} from 'lucide-react'
import ReactDOM from 'react-dom'
import * as XLSX from 'xlsx'
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
// Format price for display (adds commas to integers, allows unlimited decimals)
const formatPriceDisplay = (value) => {
  if (value === '' || value === null || value === undefined) return ''

  // Ensure we are working with a string
  const stringValue = String(value)

  // Split the integer part and the decimal part
  const parts = stringValue.split('.')
  const integerPart = parts[0]
  const decimalPart = parts.length > 1 ? parts[1] : null

  // Add commas to the integer part (e.g., 98732123 -> 98,732,123)
  let formattedInteger = ''
  if (integerPart) {
    // Regex to add commas every 3 digits
    formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  }

  // If the user typed a dot, reattach the dot and all exact decimal digits
  if (decimalPart !== null) {
    return `${formattedInteger}.${decimalPart}`
  }

  return formattedInteger
}

// Parse price input (keeps it as a safe string to preserve dots and zeros)
const parsePriceInput = (input) => {
  if (input === '' || input === null || input === undefined) return ''

  // Strip everything except digits and the decimal dot
  let cleaned = String(input).replace(/[^0-9.]/g, '')

  // Prevent multiple decimal dots (e.g., 1.2.3 becomes 1.23)
  const parts = cleaned.split('.')
  if (parts.length > 2) {
    cleaned = parts[0] + '.' + parts.slice(1).join('')
  }

  // Return as a STRING so React doesn't delete trailing dots or zeros while typing
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
      {/* Label & Badge */}
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

      {/* Value */}
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
export default function AdjustmentsForm({
  onBack,
  onSuccess,
  isViewMode = false,
  isEditMode = false,
  adjustmentData = null,
  initialJournalEntries = [],
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

  // ── Payment / header fields ───────────────────────────────────────────────
  const [documentReference, setDocumentReference] = useState('')
  const [postingDate, setPostingDate] = useState('')
  const [remarks, setRemarks] = useState('')
  const [isBasicDetailsCollapsed, setIsBasicDetailsCollapsed] = useState(false)
  const [isJournalEntriesCollapsed, setIsJournalEntriesCollapsed] = useState(false)

  const [attachments, setAttachments] = useState([])
  const uploadInputRef = useRef(null)

  const [toast, setToast] = useState(null)
  const [imageModal, setImageModal] = useState({ isOpen: false, imageSrc: '' })

  const coaOptions = chartsOfAccounts.map((a) => ({
    label: a.name || a.account_name,
    sublabel: a.code || a.account_code,
    value: a.id,
  }))

  const fetchChartsOfAccounts = async () => {
    try {
      const token = localStorage.getItem('token')
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
    if ((isViewMode || isEditMode) && adjustmentData) {
      console.log('Populating form with adjustment data:', adjustmentData)

      // Populate basic adjustment info
      if (adjustmentData.data && adjustmentData.data.length > 0) {
        const adjustment = adjustmentData.data[0]
        setDocumentReference(adjustment.document_reference || '')
        setPostingDate(adjustment.posting_date || '')
        setRemarks(adjustment.remarks || '')
      }

      // Populate journal entries
      if (
        adjustmentData.journal_entries &&
        adjustmentData.journal_entries.length > 0
      ) {
        const journal = adjustmentData.journal_entries.map((entry) => ({
          id: entry.id,
          account: entry.coa_id, // Use coa_id for the account field
          accountSearch: entry.account_name, // Use account_name for search display
          center: entry.responsibility_center || '',
          debit: entry.type === 'DEBIT' ? parseFloat(entry.amount) || 0 : 0,
          credit: entry.type === 'CREDIT' ? parseFloat(entry.amount) || 0 : 0,
          isManual: true, // In edit mode, all entries should be editable
        }))
        setJournalEntries(journal)
      }

      // Populate attachments
      if (adjustmentData.attachments && adjustmentData.attachments.length > 0) {
        console.log('Processing attachments:', adjustmentData.attachments)
        const attachments = adjustmentData.attachments.map((att) => {
          console.log(
            'Processing attachment:',
            att.id,
            att.name,
            'File data type:',
            typeof att.file,
            'File data length:',
            att.file ? att.file.length : 'null',
          )
          return {
            id: att.id,
            fileName: att.name || '',
            file: att.file || null,
            remarks: att.remarks || '',
            uploadedBy: att.uploaded_by || 'Current User',
            date: att.uploaded_date || new Date().toLocaleDateString(),
          }
        })
        setAttachments(attachments)
      }
    }
  }, [isViewMode, isEditMode, adjustmentData])

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
  const removeJournalEntry = (id) =>
    setJournalEntries((prev) => prev.filter((e) => e.id !== id))
  const updateJournalEntry = (id, field, value) =>
    setJournalEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, [field]: value } : e)),
    )

  // ── Attachment helpers ────────────────────────────────────────────────────
  const addAttachment = () =>
    setAttachments((prev) => [
      ...prev,
      {
        id: Date.now(),
        fileName: '',
        file: null,
        remarks: '',
        uploadedBy: 'Current User',
        date: new Date().toLocaleDateString(),
      },
    ])
  const removeAttachment = (id) =>
    setAttachments((prev) => prev.filter((a) => a.id !== id))
  const updateAttachment = (id, field, value) =>
    setAttachments((prev) =>
      prev.map((att) => (att.id === id ? { ...att, [field]: value } : att)),
    )
  const handleFileChange = (id, file) => {
    if (file) {
      updateAttachment(id, 'fileName', file.name)
      updateAttachment(id, 'file', file)
    }
  }

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

  const mapInitialJournalEntry = (entry) => {
    const normalizedAmount =
      entry.amount_raw ?? entry.amount ?? entry.debit ?? entry.credit ?? ''
    const amount = parseNumeric(normalizedAmount)
    const type = String(entry.type || '')
      .trim()
      .toUpperCase()
    const isDebit = type === 'DEBIT'
    const isCredit = type === 'CREDIT'

    return {
      id: entry.id ?? Date.now() + Math.random(),
      account: entry.coa_id ?? entry.account ?? entry.account_id ?? '',
      accountSearch:
        entry.account_name || entry.coa_name || entry.account || entry.name || '',
      center: entry.responsibility_center ?? entry.center ?? '',
      debit: isDebit ? amount || 0 : 0,
      credit: isCredit ? amount || 0 : 0,
      isManual: true,
    }
  }

  useEffect(() => {
    if (
      !isViewMode &&
      !isEditMode &&
      Array.isArray(initialJournalEntries) &&
      initialJournalEntries.length > 0
    ) {
      const mapped = initialJournalEntries.map(mapInitialJournalEntry)

      // Add a balancing credit entry for Advances when entries come from Advances
      const balancingLabel = 'Advances to Officers and Employees'
      const totalDebit = mapped.reduce(
        (s, e) => s + (isNaN(parseFloat(e.debit)) ? 0 : parseFloat(e.debit)),
        0,
      )

      const hasBalancing = mapped.some(
        (e) =>
          String(e.accountSearch || '')
            .trim()
            .toLowerCase() === balancingLabel.toLowerCase(),
      )

      if (totalDebit > 0 && !hasBalancing) {
        const balancingEntry = {
          id: Date.now() + Math.floor(Math.random() * 1000),
          account: '',
          accountSearch: balancingLabel,
          center: '',
          debit: 0,
          credit: totalDebit,
          isManual: false,
        }
        mapped.push(balancingEntry)
      }

      setJournalEntries(mapped)
    }
  }, [initialJournalEntries, isEditMode, isViewMode])

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

  const handleUploadJournalEntries = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const arrayBuffer = await file.arrayBuffer()
      const workbook = XLSX.read(arrayBuffer, { type: 'array' })
      const sheetName = workbook.SheetNames[0]
      const sheet = workbook.Sheets[sheetName]
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' })

      const parsedEntries = rows
        .map((row, index) => {
          const normalizedRow = {}
          Object.keys(row).forEach((key) => {
            normalizedRow[normalizeKey(key)] = row[key]
          })

          const accountName =
            normalizedRow['charts of account'] ||
            normalizedRow['chart of account'] ||
            normalizedRow['chart of accounts'] ||
            normalizedRow['account'] ||
            normalizedRow['account name'] ||
            normalizedRow['coa'] ||
            ''

          const center =
            normalizedRow['responsibility center'] ||
            normalizedRow['responsibility center name'] ||
            normalizedRow['cost center'] ||
            normalizedRow['department'] ||
            normalizedRow['center'] ||
            ''

          const debitValue =
            normalizedRow['debit'] ||
            normalizedRow['dr'] ||
            normalizedRow['debit amount'] ||
            normalizedRow['amount debit'] ||
            normalizedRow['amount'] ||
            ''

          const creditValue =
            normalizedRow['credit'] ||
            normalizedRow['cr'] ||
            normalizedRow['credit amount'] ||
            normalizedRow['amount credit'] ||
            ''

          let debit = parseNumeric(debitValue)
          let credit = parseNumeric(creditValue)

          if ((debit === null || debit === 0) && credit === null) {
            const implied = parseNumeric(
              normalizedRow['amount'] || normalizedRow['value'] || '',
            )
            if (implied !== null) {
              if (implied < 0) {
                credit = Math.abs(implied)
              } else {
                debit = implied
              }
            }
          }

          if (debit === null) debit = ''
          if (credit === null) credit = ''

          return {
            id: Date.now() + index,
            account: findCoaIdByLabel(accountName),
            accountSearch: normalizeValue(accountName),
            center: normalizeValue(center),
            debit,
            credit,
            isManual: true,
          }
        })
        .filter(
          (entry) =>
            entry.accountSearch ||
            entry.debit !== '' ||
            entry.credit !== '' ||
            entry.center,
        )

      if (parsedEntries.length === 0) {
        setToast({
          type: 'warning',
          message: 'No valid journal rows were found in the uploaded Excel file.',
        })
        return
      }

      setJournalEntries(parsedEntries)
      setToast({
        type: 'success',
        message: `Imported ${parsedEntries.length} journal row${parsedEntries.length === 1 ? '' : 's'} from Excel.`,
      })
    } catch (error) {
      console.error('Excel upload failed:', error)
      setToast({
        type: 'error',
        message:
          'Unable to parse the Excel file. Please upload a valid .xls or .xlsx file.',
      })
    } finally {
      event.target.value = null
    }
  }

  // ── Post Transaction ──────────────────────────────────────────────────────
  const fileToBase64 = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = () => resolve(reader.result)
      reader.onerror = (err) => reject(err)
    })

  const handlePostTransaction = async () => {
    try {
      // if (!documentReference) {
      //   setToast({ type: 'warning', message: 'Please enter document reference' })
      //   return
      // }

      const token = localStorage.getItem('token')
      if (!token) {
        setToast({
          type: 'error',
          message: 'No authorization token found. Please login again.',
        })
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
        // Allow for small floating point differences
        setToast({
          type: 'warning',
          message:
            'Journal entries must be balanced. Total debits must equal total credits.',
        })
        return
      }

      const userData = JSON.parse(localStorage.getItem('user') || '{}')
      const createdBy = userData.mu_username || userData.username || 'Unknown User'

      const preparedJournalEntries = journalEntries.map((entry) => {
        const rawAccountValue = entry.account || entry.accountSearch || ''
        const accountValue = String(rawAccountValue || '').trim()
        const resolvedAccountId =
          accountValue && !Number.isNaN(Number(accountValue))
            ? Number(accountValue)
            : findCoaIdByLabel(accountValue)

        return {
          account_id: resolvedAccountId || null,
          responsibility_center: entry.center || '',
          debit: parseFloat(entry.debit) || 0,
          credit: parseFloat(entry.credit) || 0,
        }
      })

      const preparedAttachments = await Promise.all(
        attachments.map(async (att) => ({
          name: att.fileName,
          file: att.file ? await fileToBase64(att.file) : null,
          remarks: att.remarks,
          uploaded_by: att.uploadedBy,
          uploaded_date: att.date || new Date().toLocaleDateString(),
        })),
      )

      // ── adjustment header payload ──
      const adjustmentPayload = {
        document_reference: documentReference || null,
        posting_date: postingDate || new Date().toISOString().split('T')[0],
        remarks: remarks,
        status: 'PREPARED BY',
        total_amount: totalDebit, // Use total debit as the adjustment amount
        created_by: createdBy,
        adjustment_attachments: preparedAttachments,
        journal_entries: preparedJournalEntries,
      }

      const url =
        isEditMode && adjustmentData
          ? `${import.meta.env.VITE_SERVER_LINK}/adjustments/${adjustmentData.data[0].id}`
          : isViewMode && adjustmentData
            ? `${import.meta.env.VITE_SERVER_LINK}/adjustments/${adjustmentData.data[0].id}`
            : `${import.meta.env.VITE_SERVER_LINK}/adjustments`

      const method = (isEditMode || isViewMode) && adjustmentData ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(adjustmentPayload),
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
            ? 'Adjustment updated successfully!'
            : isViewMode
              ? 'Adjustment updated successfully!'
              : 'Adjustment posted successfully!',
        }
        setToast(nextToast)
        if (onSuccess) await onSuccess(nextToast)
        onBack()
      } else {
        setToast({
          type: 'error',
          message: result.message || 'Failed to save adjustment',
        })
      }
    } catch (error) {
      console.error('Error saving adjustment:', error)
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
  const manualEntries = journalEntries.filter((e) => e.isManual).length
  const autoEntries = totalEntries - manualEntries

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
          .summary-tooltip { display: none; }
          .summary-row:hover .summary-tooltip { display: block; }
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
          <div className="flex gap-2">
            <button className="px-4 py-2 bg-white border border-gray-200 text-[12px] font-black text-gray-400 rounded-lg hover:bg-gray-50 transition-all uppercase">
              Save Draft
            </button>
            <button
              type="button"
              onClick={() => uploadInputRef.current?.click()}
              className="px-4 py-2 bg-blue-600 text-white text-[12px] font-black rounded-lg hover:bg-blue-700 transition-all uppercase tracking-[1px] flex items-center gap-2"
            >
              <Upload size={14} /> Upload Excel
            </button>
            <input
              ref={uploadInputRef}
              type="file"
              accept=".xls,.xlsx"
              className="hidden"
              onChange={handleUploadJournalEntries}
            />
            <button
              onClick={handlePostTransaction}
              className="px-6 py-2 bg-green-600 text-white text-[12px] font-black rounded-lg hover:bg-green-700 transition-all uppercase tracking-[2px] flex items-center gap-2 shadow-md shadow-green-200"
            >
              <Save size={14} /> {isEditMode ? 'Update Adjustment' : 'Post Adjustment'}
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
              {/* Prominent Header */}
              <div className="px-4 py-3 bg-gradient-to-r from-red-600 to-red-700 text-white flex items-center justify-between border-b border-red-800 shadow-sm flex-shrink-0">
                <div className="flex items-center gap-2">
                  <Calculator size={18} className="text-red-100" />
                  <h3 className="text-sm font-bold tracking-tight">Financial Summary</h3>
                </div>
                <span className="text-xs bg-zinc-900 text-zinc-100 px-2.5 py-0.5 rounded-full border border-zinc-800 font-mono font-semibold">
                  PHP (₱)
                </span>
              </div>

              {/* Financial Summary Items */}
              <div className="custom-table-scroller overflow-y-auto min-h-0 flex-1 custom-scrollbar p-3.5 py-2 space-y-1.5">
                {/* 1. Total Entries */}
                <SummaryRow
                  label="Total Entries:"
                  value={totalEntries}
                />

                {/* 2. Manual Entries */}
                <SummaryRow
                  label="Manual Entries:"
                  value={manualEntries}
                  textColor="text-blue-600"
                />

                {/* 4. Total Debit */}
                <SummaryRow
                  label="Total Debit:"
                  value={fmt(totalDebit)}
                  textColor="text-green-600"
                />

                {/* 5. Total Credit */}
                <SummaryRow
                  label="Total Credit:"
                  value={fmt(totalCredit)}
                  textColor="text-red-600"
                />
              </div>

              {/* TOTAL AMOUNT HERO BOX */}
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
                      <Landmark size={14} />
                    </div>
                    <h2 className="text-base font-bold tracking-tight">Basic Details</h2>
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
                      {/* Document Reference */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                          Document Reference <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          placeholder="Enter document reference..."
                          value={documentReference}
                          onChange={(e) => setDocumentReference(e.target.value)}
                          disabled={isViewMode}
                          className={`w-full bg-white border rounded-lg px-3 py-2 text-sm text-zinc-800 focus:ring-2 focus:ring-red-600 focus:border-red-600 outline-none transition-all ${isViewMode ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : ''} ${!documentReference ? 'border-red-500' : 'border-zinc-300'}`}
                        />
                      </div>

                      {/* Posting Date */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                          Posting Date <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="date"
                          value={postingDate}
                          onChange={(e) => setPostingDate(e.target.value)}
                          disabled={isViewMode}
                          className={`w-full bg-white border rounded-lg px-3 py-2 text-sm text-zinc-800 focus:ring-2 focus:ring-red-600 focus:border-red-600 outline-none transition-all ${isViewMode ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : ''} ${!postingDate ? 'border-red-500' : 'border-zinc-300'}`}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </section>

              {/* 2. JOURNAL ENTRIES */}
              <section className="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden">
                <div className="px-4 py-2.5 bg-zinc-900 text-white flex items-center justify-between">
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
                  <button
                    onClick={() => setIsJournalEntriesCollapsed(!isJournalEntriesCollapsed)}
                    className="text-white bg-red-600 hover:bg-red-700 p-2 rounded-lg transition-colors"
                    title={isJournalEntriesCollapsed ? 'Expand' : 'Collapse'}
                  >
                    {isJournalEntriesCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                  </button>
                </div>

                {!isJournalEntriesCollapsed && (
                  <div className="">
                    <div className="overflow-x-auto">
                      <table
                        className="w-full text-left text-xs"
                        style={{ tableLayout: 'fixed', minWidth: 600 }}
                      >
                        <colgroup>
                          <col style={{ width: '35%' }} />
                          <col style={{ width: '18%' }} />
                          <col style={{ width: '18%' }} />
                          <col style={{ width: '22%' }} />
                          <col style={{ width: '6%' }} />
                        </colgroup>
                        <thead className="bg-zinc-100 border-b border-zinc-200 uppercase font-bold text-zinc-600 tracking-wider">
                          <tr>
                            <th className="py-2.5 px-3 text-center">Chart of Account</th>
                            <th className="py-2.5 px-3 text-center w-32">Debit (₱)</th>
                            <th className="py-2.5 px-3 text-center w-32">Credit (₱)</th>
                            <th className="py-2.5 px-3 text-center">Responsibility Center</th>
                            <th className="py-2.5 px-3 w-10 text-center"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-200 text-zinc-800">
                          {journalEntries.map((entry) => (
                            <tr key={entry.id}>
                              <td className="py-2 px-3 text-center">
                                <SearchableDropdown
                                  disabled={isViewMode}
                                  placeholder="Search account..."
                                  value={entry.accountSearch}
                                  onChange={(v) =>
                                    updateJournalEntry(entry.id, 'accountSearch', v)
                                  }
                                  onSelect={(opt) => {
                                    updateJournalEntry(entry.id, 'account', opt.value)
                                    updateJournalEntry(
                                      entry.id,
                                      'accountSearch',
                                      opt.label,
                                    )
                                  }}
                                  options={coaOptions}
                                  inputClassName={`${tableInput} ${isViewMode ? 'bg-transparent text-black cursor-not-allowed' : ''}`}
                                  emptyText="No accounts found"
                                />
                              </td>
                              <td className="py-2 px-3 text-center font-mono">
                                <input
                                  disabled={isViewMode}
                                  className={`${tableInput + ' font-black text-center'} ${isViewMode ? 'bg-transparent text-black cursor-not-allowed' : ''}`}
                                  placeholder="0.00"
                                  type="text"
                                  inputMode="decimal"
                                  value={formatPriceDisplay(entry.debit ?? '')}
                                  onChange={(e) => {
                                    const parsed = parsePriceInput(e.target.value)
                                    updateJournalEntry(
                                      entry.id,
                                      'debit',
                                      parsed === '' ? '' : parseFloat(parsed) || 0,
                                    )
                                  }}
                                />
                              </td>
                              <td className="py-2 px-3 text-center font-mono">
                                <input
                                  disabled={isViewMode}
                                  className={`${tableInput + ' font-black text-center text-red-600'} ${isViewMode ? 'bg-transparent text-gray-200 cursor-not-allowed' : ''}`}
                                  placeholder="0.00"
                                  type="text"
                                  inputMode="decimal"
                                  value={formatPriceDisplay(entry.credit ?? '')}
                                  onChange={(e) => {
                                    const parsed = parsePriceInput(e.target.value)
                                    updateJournalEntry(
                                      entry.id,
                                      'credit',
                                      parsed === '' ? '' : parseFloat(parsed) || 0,
                                    )
                                  }}
                                />
                              </td>
                              <td className="py-2 px-3 text-center">
                                <SearchableDropdown
                                  disabled={isViewMode}
                                  placeholder="Select"
                                  value={entry.center}
                                  onChange={(v) =>
                                    updateJournalEntry(entry.id, 'center', v)
                                  }
                                  onSelect={(opt) =>
                                    updateJournalEntry(entry.id, 'center', opt.value)
                                  }
                                  options={responsibilityCenterOptions}
                                  inputClassName={`${tableInput} ${isViewMode ? 'bg-transparent text-black cursor-not-allowed' : ''}`}
                                  emptyText={
                                    responsibilityCentersError ||
                                    'No responsibility centers found'
                                  }
                                />
                              </td>
                              <td className="py-2 px-3 text-center">
                                {!isViewMode && (
                                  <button
                                    className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                                    onClick={() => removeJournalEntry(entry.id)}
                                  >
                                    <Trash2 size={15} className="mx-auto" />
                                  </button>
                                )}
                                {!isViewMode && (
                                  <span className="text-gray-300 text-[11px] italic">
                                    {entry.isManual ? 'Manual' : 'Auto'}
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-slate-50 font-semibold text-slate-900 border-t border-slate-200">
                          <tr>
                            <td colSpan={2} className="py-2.5 px-3 text-right text-xs">Total Ledger Balance:</td>
                            <td className="py-2.5 px-3 text-right font-mono text-emerald-700 text-xs">{fmt(totalDebit)}</td>
                            <td className="py-2.5 px-3 text-right font-mono text-emerald-700 text-xs">{fmt(totalCredit)}</td>
                            <td />
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                    {!isViewMode && (
                      <div className="p-4 bg-zinc-50 border-t border-zinc-200 flex items-center justify-between">
                        <button
                          onClick={() => addJournalEntry(bulkResponsibilityCenter)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-red-500 border-dashed text-xs font-bold rounded-lg text-red-600 bg-red-50 hover:bg-red-100 transition-colors"
                        >
                          <Plus size={12} /> Add Ledger Row
                        </button>
                        <span className="text-xs text-zinc-500 font-medium">{journalEntries.length} {journalEntries.length === 1 ? 'entry' : 'entries'}</span>
                      </div>
                    )}
                  </div>
                )}
              </section>

              {/* 3. ATTACHMENTS & REMARKS */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Attachments Card */}
                <section className="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden">
                  <div className="px-4 py-2.5 bg-zinc-900 text-white flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Paperclip className="text-red-500" size={16} />
                      <h2 className="text-sm font-bold tracking-tight">Attachments</h2>
                    </div>
                    <span className="text-xs text-zinc-400 font-medium">{attachments.length} {attachments.length === 1 ? 'File' : 'Files'}</span>
                  </div>
                  <div className="p-4">
                    <div className="overflow-x-auto custom-table-scroller">
                      <table
                        className="w-full text-center"
                        style={{ tableLayout: 'fixed', minWidth: 600 }}
                      >
                        <colgroup>
                          <col style={{ width: '25%' }} />
                          <col style={{ width: '25%' }} />
                          <col style={{ width: '25%' }} />
                          <col style={{ width: '15%' }} />
                          <col style={{ width: '10%' }} />
                        </colgroup>
                        <thead>
                          <tr className="border-b border-gray-100">
                            {[ 'File Name', 'File', 'Remarks', 'Uploaded By', '', ].map((h, i) => (
                              <th
                                key={i}
                                className="pb-3 text-[12px] font-black uppercase text-gray-900 tracking-tighter text-center px-1"
                              >
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-200">
                          {attachments.map((file) => (
                            <tr key={file.id}>
                              <td className="py-2 px-1">
                                <input
                                  disabled={isViewMode}
                                  className={`w-full bg-white border rounded-lg px-3 py-2 text-sm text-zinc-800 focus:ring-2 focus:ring-red-600 focus:border-red-600 outline-none transition-all ${isViewMode ? 'bg-transparent text-black cursor-not-allowed' : ''}`}
                                  placeholder="e.g. Attachment_Scan"
                                  value={file.fileName}
                                  onChange={(e) =>
                                    updateAttachment(
                                      file.id,
                                      'fileName',
                                      e.target.value,
                                    )
                                  }
                                />
                              </td>
                              <td className="py-2 px-1">
                                {isViewMode ? (
                                  <div
                                    className={`w-full bg-white border rounded-lg px-3 py-2 text-sm text-zinc-800 cursor-not-allowed flex items-center justify-center`}
                                  >
                                    {file.file &&
                                      typeof file.file === 'string' &&
                                      file.file.startsWith('data:image/') ? (
                                      <>
                                      <img
                                        src={file.file}
                                        alt={file.fileName || 'Attachment'}
                                        className="max-h-16 max-w-full object-contain cursor-pointer hover:scale-105 transition-transform"
                                        onClick={() =>
                                          setImageModal({
                                            isOpen: true,
                                            imageSrc: file.file,
                                          })
                                        }
                                        title="Click to view full size"
                                      />
                                      <span className="text-[8px] text-gray-500 ml-2">
                                        {Math.round(file.file.length / 1024)}KB
                                      </span>
                                      </>
                                    ) : file.file && typeof file.file === 'string' ? (
                                      <span className="text-blue-600 text-[11px] font-bold">
                                        Non-image file (
                                        {Math.round(file.file.length / 1024)}KB)
                                      </span>
                                    ) : file.file ? (
                                      <span className="text-orange-600 text-[11px] font-bold">
                                        Invalid file data
                                      </span>
                                    ) : (
                                      <span className="text-gray-400 text-[11px] italic">
                                        No file
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <input
                                    type="file"
                                    className="text-[11px] font-bold text-gray-400 file:mr-2 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-[10px] file:font-black file:bg-black file:text-white cursor-pointer w-full"
                                    onChange={(e) =>
                                      handleFileChange(file.id, e.target.files[0])
                                    }
                                  />
                                )}
                              </td>
                              <td className="py-2 px-1">
                                <input
                                  disabled={isViewMode}
                                  className={`w-full bg-white border rounded-lg px-3 py-2 text-sm text-zinc-800 focus:ring-2 focus:ring-red-600 focus:border-red-600 outline-none transition-all ${isViewMode ? 'bg-transparent text-black cursor-not-allowed' : ''}`}
                                  placeholder="Add note..."
                                  value={file.remarks}
                                  onChange={(e) =>
                                    updateAttachment(
                                      file.id,
                                      'remarks',
                                      e.target.value,
                                    )
                                  }
                                />
                              </td>
                              <td className="py-2 px-1 text-[12px] font-bold text-gray-600 italic">
                                {file.uploadedBy}
                              </td>
                              <td className="py-2 text-center">
                                {!isViewMode && (
                                  <button
                                    onClick={() => removeAttachment(file.id)}
                                    className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                                  >
                                    <Trash2 size={15} />
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {!isViewMode && (
                      <button
                        onClick={addAttachment}
                        className="mt-2 py-1.5 border-2 border-dashed rounded-lg w-full text-[12px] font-black uppercase border-slate-300 text-slate-600 transition-all duration-300 hover:bg-slate-50 hover:border-slate-400 flex items-center justify-center gap-1"
                      >
                        <Plus size={15} /> Add File
                      </button>
                    )}
                  </div>
                </section>

                {/* Remarks Card */}
                <section className="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden">
                  <div className="px-4 py-2.5 bg-zinc-900 text-white flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="text-red-500" size={16} />
                      <h2 className="text-sm font-bold tracking-tight">Remarks & Internal Notes</h2>
                    </div>
                  </div>
                  <div className="p-4">
                    <textarea
                      disabled={isViewMode}
                      rows={4}
                      placeholder="Enter justification, payment reference notes, or internal instructions here..."
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                      className={`w-full border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none ${isViewMode ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : ''}`}
                    />
                  </div>
                </section>
              </div>
            </motion.div>
          </main>
        </div>
      </div>

      {/* --- IMAGE MODAL --- */}
      {imageModal.isOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-8 bg-black/90 backdrop-blur-sm animate-in fade-in duration-300"
          onClick={() => setImageModal({ isOpen: false, imageSrc: '' })}
        >
          <button
            onClick={(e) => {
              e.stopPropagation()
              setImageModal({ isOpen: false, imageSrc: '' })
            }}
            className="absolute top-6 right-6 text-white hover:text-red-500 transition-colors"
          >
            <ArrowLeft size={32} />
          </button>
          <img
            src={imageModal.imageSrc}
            alt="Preview"
            className="max-w-full max-h-full rounded-2xl shadow-2xl border-4 border-white/10 p-2 scale-in animate-in zoom-in-95 duration-300"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────
function TableSection({ title, icon, children, defaultCollapsed = false, extraContent }) {
  const [isCollapsed, setIsCollapsed] = useState(false)

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          {icon}
          <h2 className="text-[15px] font-black uppercase tracking-[1px] text-black">
            {title}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {extraContent}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg transition-colors"
          >
            {isCollapsed ? (
              <>
                <Plus size={16} />
                <span className="text-[11px] font-black uppercase">Show</span>
              </>
            ) : (
              <>
                <Minus size={16} />
                <span className="text-[11px] font-black uppercase">Hide</span>
              </>
            )}
          </button>
        </div>
      </div>

      {!isCollapsed && <div className="px-4 pb-4">{children}</div>}
    </div>
  )
}

function SidebarInput({
  label,
  placeholder,
  type = 'text',
  required,
  value,
  onChange,
  disabled = false,
}) {
  return (
    <div className="space-y-1">
      <label className="text-[11px] font-black uppercase text-gray-400 block">
        {label}
        {required && <span className="text-red-600 ml-1">*</span>}
      </label>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        disabled={disabled}
        className={`w-full px-3 py-1.5 rounded-lg text-[12px] font-bold outline-none transition-all ${
          disabled
            ? 'bg-gray-100 border border-gray-300 text-black cursor-not-allowed'
            : 'bg-gray-50 border border-gray-200 text-black focus:ring-1 focus:ring-red-500'
        }`}
      />
    </div>
  )
}
