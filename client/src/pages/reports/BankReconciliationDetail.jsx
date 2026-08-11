import React, { useState, useMemo } from 'react'
// eslint-disable-next-line no-unused-vars
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Edit,
  Plus,
  RefreshCw,
  AlertCircle,
  Building2,
  Calendar,
  Download,
  FileText,
  Scale,
  Loader,
  CheckCircle2,
  Check,
  X,
  Trash2,
  Search,
  Info,
  TrendingUp,
  TrendingDown,
  Layers,
  PieChart,
  ArrowUpRight,
  Zap,
  Filter,
  CheckSquare,
  Square,
  RotateCcw,
  Upload,
  Lock,
  BookOpen,
  XCircle,
  ChevronRight,
  ChevronDown,
  Sliders,
  Eye,
  DollarSign,
  List,
  Sparkles,
  ShieldCheck,
  Activity,
  CreditCard,
  ArrowDownLeft,
  Settings,
  Unlock,
} from 'lucide-react'
import DynamicToast from '../../components/DynamicToast'
import RightSideModal from '../../components/RightSideModal'

import {
  useBankReconciliation,
  getItemMeta,
  isBankSectionItem,
  getItemAmount,
  fmt,
  formatLocalDate,
} from './useBankReconciliation'

export default function BankReconciliationDetail({
  selectedReconciliation,
  onBack,
}) {
  const [activeTab, setActiveTab] = useState('reconcile') // 'reconcile', 'statements', 'ledger', 'report'
  const [selectedStmtIds, setSelectedStmtIds] = useState([])
  const [selectedBookIds, setSelectedBookIds] = useState([])
  const [showOnlyUnmatched, setShowOnlyUnmatched] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all') // 'all', 'unmatched', 'matched'
  const [cardShadowMode, setCardShadowMode] = useState('elevated')
  const [toastMessage, setToastMessage] = useState(null)

  // Modals state
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)
  const [isNewEntryModalOpen, setIsNewEntryModalOpen] = useState(false)
  const [isFinalizeModalOpen, setIsFinalizeModalOpen] = useState(false)
  const [selectedStmtForEntry, setSelectedStmtForEntry] = useState(null)

  const {
    reconData,
    items,
    itemsLoading,
    journalEntries,
    journalEntriesLoading,
    showItemModal,
    setShowItemModal,
    editingItem,
    setEditingItem,
    itemFormData,
    setItemFormData,
    itemFormRows,
    setItemFormRows,
    detailStartDate,
    setDetailStartDate,
    detailEndDate,
    setDetailEndDate,
    availableMonths,
    availableMonthsLoading,
    bankSearchTerm,
    setBankSearchTerm,
    bookSearchTerm,
    setBookSearchTerm,
    showToast,
    setShowToast,
    toastMessage: hookToastMessage,
    setToastMessage: setHookToastMessage,
    toastType,
    setToastType,
    bankSectionFilter,
    setBankSectionFilter,
    editingBankBalance,
    setEditingBankBalance,
    bankBalanceInput,
    setBankBalanceInput,
    editingBookBalance,
    setEditingBookBalance,
    bookBalanceInput,
    setBookBalanceInput,
    fetchReconciliationItems,
    handleUpdateBankStatementBalance,
    handleUpdateGeneralLedgerBalance,
    handleDeleteBankItem,
    handleMatchBankToLedger,
    handleUnmatchBankFromLedger,
    handleAddOrUpdateItem,
    handleEditItem,
    handleDeleteItem,
    resetItemForm,
    updateItemFormRow,
    addItemFormRow,
    removeItemFormRow,
    depositsInTransit,
    outstandingChecks,
    bankErrors,
    bankStatementEndingBalance,
    adjustedBankBalance,
    glDebits,
    glCredits,
    unadjustedBookBalance,
    endingBookBalance,
    bookAdditions,
    bookDeductions,
    bookErrorAdjustments,
    adjustedBookBalance,
    reconDifference,
    isReconciled,
    visibleBankItems,
    visibleJournalEntries,
    BANK_SECTION_ITEMS,
    BOOK_SECTION_ITEMS,
    // Adjustment state and handlers
    bankAdjustments,
    setBankAdjustments,
    bookAdjustments,
    setBookAdjustments,
    showBankAdjustmentForm,
    setShowBankAdjustmentForm,
    showBookAdjustmentForm,
    setShowBookAdjustmentForm,
    bankAdjustmentForm,
    setBankAdjustmentForm,
    bookAdjustmentForm,
    setBookAdjustmentForm,
    handleAddBankAdjustment,
    handleAddBookAdjustment,
    handleRemoveBankAdjustment,
    handleRemoveBookAdjustment,
    handleSaveSummary,
    hasSavedSummary,
    handleExportSummaryPdf,
    bankCardAdditions,
    bankCardDeductions,
    bankCardErrors,
    bookCardAdditions,
    bookCardDeductions,
    bookCardErrors,
    // Matching functions
    handleCreateMatch,
    handleDeleteMatch,
    fetchMatches,
  } = useBankReconciliation(selectedReconciliation)

  // Trigger Toast Notification
  const triggerToast = (msg, type = 'success') => {
    setToastMessage({ text: msg, type })
    setTimeout(() => setToastMessage(null), 3500)
  }

  // Filtered Items for current account
  const currentStmtItems = useMemo(() => {
    return items.filter(item => {
      if (showOnlyUnmatched && item.status === 'matched') return false
      if (statusFilter !== 'all' && item.status !== statusFilter) return false
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        return (
          (item.description || item.bri_description || '').toLowerCase().includes(q) ||
          (item.reference_number || item.bri_reference_number || '').toLowerCase().includes(q) ||
          getItemAmount(item).toString().includes(q)
        )
      }
      return true
    })
  }, [items, showOnlyUnmatched, statusFilter, searchQuery])

  const currentBookItems = useMemo(() => {
    return journalEntries.filter(item => {
      if (showOnlyUnmatched && item.status === 'matched') return false
      if (statusFilter !== 'all' && item.status !== statusFilter) return false
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        return (
          (item.description || '').toLowerCase().includes(q) ||
          (item.trans_no || '').toLowerCase().includes(q) ||
          (item.db_name || '').toLowerCase().includes(q) ||
          (parseFloat(item.amount) || 0).toString().includes(q)
        )
      }
      return true
    })
  }, [journalEntries, showOnlyUnmatched, statusFilter, searchQuery])

  // Calculate totals for selection
  const selectedStmtTotal = useMemo(() => {
    return selectedStmtIds.reduce((sum, id) => {
      const item = items.find(i => i.id === id)
      return sum + (item ? getItemAmount(item) : 0)
    }, 0)
  }, [selectedStmtIds, items])

  const selectedBookTotal = useMemo(() => {
    return selectedBookIds.reduce((sum, id) => {
      const item = journalEntries.find(i => i.id === id)
      return sum + (item ? (parseFloat(item.amount) || 0) : 0)
    }, 0)
  }, [selectedBookIds, journalEntries])

  const selectedDifference = Math.round((selectedStmtTotal - selectedBookTotal) * 100) / 100

  // Toggle selection handlers
  const toggleSelectStmt = (id) => {
    setSelectedStmtIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    )
  }

  const toggleSelectBook = (id) => {
    setSelectedBookIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    )
  }

  // Auto-match function
  const handleAutoMatch = async () => {
    let matchCount = 0
    const unmatchedStmts = items.filter(i => i.status !== 'matched')
    const unmatchedBooks = journalEntries.filter(i => i.status !== 'matched')

    // Simple amount-based matching
    unmatchedStmts.forEach(stmt => {
      const stmtAmount = getItemAmount(stmt)
      const matchingBook = unmatchedBooks.find(
        b => Math.abs(parseFloat(b.amount) || 0) === Math.abs(stmtAmount)
      )

      if (matchingBook) {
        // Call the match API
        handleCreateMatch([stmt.id], [matchingBook.id])
        matchCount++
      }
    })

    if (matchCount > 0) {
      triggerToast(`⚡ Smart Auto-Match created ${matchCount} new transaction pair matches!`)
    } else {
      triggerToast('No eligible auto-matches found based on exact amount rules.', 'info')
    }
  }

  // Manual match execution
  const handleMatchSelected = async () => {
    if (selectedStmtIds.length === 0 || selectedBookIds.length === 0) {
      triggerToast('Please select at least one item from Bank Statement and one from Book Ledger', 'error')
      return
    }

    if (Math.abs(selectedDifference) > 0.01) {
      triggerToast(`Selected amounts do not balance! Variance: ₱${selectedDifference.toFixed(2)}`, 'error')
      return
    }

    // Match each bank item to its corresponding ledger item (1-to-1 matching)
    for (let i = 0; i < selectedStmtIds.length; i++) {
      const bankItemId = selectedStmtIds[i]
      const ledgerId = selectedBookIds[i]
      if (bankItemId && ledgerId) {
        await handleMatchBankToLedger(bankItemId, ledgerId)
      }
    }

    setSelectedStmtIds([])
    setSelectedBookIds([])
    triggerToast(`Successfully matched ${selectedStmtIds.length} items!`)
  }

  // Unmatch a specific item
  const handleUnmatch = async (bankItemId) => {
    if (!bankItemId) return
    await handleUnmatchBankFromLedger(bankItemId)
    triggerToast('Transaction link removed. Item returned to unmatched status.')
  }

  // Create GL Book entry directly from Bank Statement item
  const handleCreateBookEntryFromStmt = (stmtItem) => {
    setSelectedStmtForEntry(stmtItem)
    setIsNewEntryModalOpen(true)
  }

  const handleSaveNewBookEntry = async (entryData) => {
    // Create the book entry via the existing item creation logic
    await handleAddOrUpdateItem({
      ...entryData,
      item_type: 'book_adjustment',
      section: 'BOOK',
    })

    // Match it with the statement item
    if (selectedStmtForEntry) {
      await handleCreateMatch([selectedStmtForEntry.id], [entryData.id])
    }

    setIsNewEntryModalOpen(false)
    setSelectedStmtForEntry(null)
    triggerToast('GL Adjustment entry posted and reconciled successfully!')
  }

  // Calculate reconcile percentage
  const totalItemsCount = items.length + journalEntries.length
  const matchedItemsCount = items.filter(i => i.status === 'matched').length + journalEntries.filter(i => i.status === 'matched').length
  const reconcilePercentage = totalItemsCount > 0 ? Math.round((matchedItemsCount / totalItemsCount) * 100) : 100

  // Calculate unrecorded bank credits and debits (unmatched statement items)
  const unrecordedBankCredits = useMemo(() => {
    return items
      .filter(i => i.status === 'unmatched' && getItemAmount(i) > 0)
      .reduce((sum, i) => sum + getItemAmount(i), 0)
  }, [items, getItemAmount])

  const unrecordedBankDebits = useMemo(() => {
    return items
      .filter(i => i.status === 'unmatched' && getItemAmount(i) < 0)
      .reduce((sum, i) => sum + Math.abs(getItemAmount(i)), 0)
  }, [items, getItemAmount])

  const [ocrLoading, setOcrLoading] = React.useState(false)
  const [ocrError, setOcrError] = React.useState('')
  const ocrFileInputRef = React.useRef(null)

  const parseOcrRows = (rows) => {
    if (!rows) return []

    let normalizedRows = Array.isArray(rows) ? rows : [rows]

    if (normalizedRows.length > 0 && Array.isArray(normalizedRows[0])) {
      const headerRow = normalizedRows[0].map((value) =>
        value?.toString().trim().toLowerCase(),
      )
      normalizedRows = normalizedRows.slice(1).map((row) => {
        if (!Array.isArray(row)) return {}
        return row.reduce((acc, value, index) => {
          acc[headerRow[index] || `col_${index}`] = value
          return acc
        }, {})
      })
    }

    const mapValue = (row, keys) => {
      for (const key of keys) {
        const found = row[key]
        if (found !== undefined && found !== null) {
          const value = found?.toString?.().trim?.()
          if (value !== '') return value
        }
      }
      return ''
    }

    const normalizeDate = (value) => {
      if (!value) return ''
      const stringValue = value.toString().trim()
      const date = new Date(stringValue)
      if (!Number.isNaN(date.getTime())) {
        return date.toISOString().split('T')[0]
      }
      return stringValue
    }

    const parseNumber = (value) => {
      if (value === undefined || value === null) return NaN
      const stringValue = value.toString().trim()
      if (!stringValue) return NaN
      const normalized = stringValue
        .replace(/[₱,$]/g, '')
        .replace(/\(/g, '-')
        .replace(/\)/g, '')
        .replace(/\s+/g, '')
      return parseFloat(normalized)
    }

    const normalizeRow = (rawRow) => {
      const row = Object.entries(rawRow || {}).reduce((acc, [key, value]) => {
        acc[key.toString().trim().toLowerCase()] = value
        return acc
      }, {})

      const details =
        mapValue(row, [
          'details',
          'description',
          'particulars',
          'account',
          'account_name',
          'narration',
          'remarks',
          'memo',
          'note',
        ]) || ''

      const date = normalizeDate(
        mapValue(row, [
          'date',
          'transaction_date',
          'posting_date',
          'value_date',
          'doc_date',
          'due_date',
          'dated',
        ]),
      )

      const reference_number = mapValue(row, [
        'reference_number',
        'reference',
        'ref',
        'check_no',
        'check_number',
        'voucher',
      ])

      const description = mapValue(row, [
        'description',
        'details',
        'particulars',
        'remarks',
        'memo',
        'note',
      ])

      const debitInput = mapValue(row, [
        'debit',
        'dr',
        'debit_amount',
        'debit amount',
        'withdrawal',
        'amount_dr',
      ])
      const creditInput = mapValue(row, [
        'credit',
        'cr',
        'credit_amount',
        'credit amount',
        'deposit',
        'amount_cr',
      ])
      const amountInput = mapValue(row, [
        'amount',
        'amt',
        'value',
        'total',
        'transaction_amount',
      ])
      const direction = mapValue(row, [
        'type',
        'direction',
        'side',
        'dr_cr',
        'debit_credit',
        'txn_type',
      ]).toLowerCase()

      let debit = ''
      let credit = ''

      const parsedDebit = parseNumber(debitInput)
      const parsedCredit = parseNumber(creditInput)
      const parsedAmount = parseNumber(amountInput)

      if (!Number.isNaN(parsedDebit) && parsedDebit > 0) {
        debit = parsedDebit.toString()
      }

      if (!Number.isNaN(parsedCredit) && parsedCredit > 0) {
        credit = parsedCredit.toString()
      }

      if (!debit && !credit && !Number.isNaN(parsedAmount) && parsedAmount !== 0) {
        if (parsedAmount < 0) {
          debit = Math.abs(parsedAmount).toString()
        } else if (/(debit|dr|withdrawal|deduct|minus)/.test(direction)) {
          debit = parsedAmount.toString()
        } else {
          credit = parsedAmount.toString()
        }
      }

      if (debit && credit) {
        if (debitInput && !creditInput) {
          credit = ''
        } else if (creditInput && !debitInput) {
          debit = ''
        } else {
          credit = ''
        }
      }

      return {
        details,
        date,
        reference_number,
        description,
        debit,
        credit,
      }
    }

    return normalizedRows
      .map(normalizeRow)
      .filter(
        (row) =>
          row.date ||
          row.details ||
          row.description ||
          row.reference_number ||
          row.debit ||
          row.credit,
      )
  }

  const openOcrFilePicker = () => {
    setOcrError('')
    ocrFileInputRef.current?.click()
  }

  const handleOcrFileSelected = async (event) => {
    const file = event.target?.files?.[0]
    if (!file) return

    setOcrError('')
    setOcrLoading(true)

    try {
      console.debug('[OCR] env values:', {
        OCR_API_raw: import.meta.env._OCR_API,
        VITE_OCR_API: import.meta.env.VITE_OCR_API,
      })

      const ocrBaseRaw =
        import.meta.env._OCR_API || import.meta.env.VITE_OCR_API || ''
      const ocrBase = ocrBaseRaw
        .toString()
        .trim()
        .replace(/^['"]|['"]$/g, '')

      console.debug('[OCR] resolved base URL:', ocrBase)
      if (!ocrBase) {
        console.error(
          '[OCR] server URL not configured, please set VITE_OCR_API in your .env',
        )
        throw new Error('OCR server URL is not configured.')
      }

      const ocrUrl = new URL('/ocr', ocrBase)
      ocrUrl.searchParams.set('format', 'auto')
      ocrUrl.searchParams.set('header', '1')
      ocrUrl.searchParams.set('row_tol', '0.6')

      console.debug('[OCR] request URL:', ocrUrl.toString())

      const formData = new FormData()
      formData.append('image', file)

      const response = await fetch(ocrUrl.toString(), {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('[OCR] request failed:', response.status, errorText)
        throw new Error(
          errorText || `OCR request failed with status ${response.status}`,
        )
      }

      const result = await response.json()
      console.debug('[OCR] response payload:', result)
      const rows = result.rows || result.data?.rows || result.data || []
      const parsedRows = parseOcrRows(rows)

      if (parsedRows.length === 0) {
        throw new Error('OCR returned no usable rows.')
      }

      setItemFormRows(parsedRows)
      setShowToast(true)
      setToastType('success')
      setToastMessage(`Imported ${parsedRows.length} OCR row(s).`)
    } catch (error) {
      console.error('[OCR] error:', error)
      setOcrError(error?.message || 'Failed to import OCR rows.')
      setShowToast(true)
      setToastType('error')
      setToastMessage(error?.message || 'Failed to import OCR rows.')
    } finally {
      setOcrLoading(false)
      if (event.target) event.target.value = ''
    }
  }

  // Helper function for BookOpen icon
  const BookOpenIcon = (props) => (
    <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
  )

  return (
    <div className="min-h-screen bg-[#f4f5f7] text-zinc-900 font-sans antialiased selection:bg-red-600 selection:text-white pb-12">
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className={`fixed top-5 right-5 z-50 flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-2xl text-white font-medium text-sm transition-all duration-300 animate-bounce ${toastMessage.type === 'error' ? 'bg-red-700 border border-red-500' :
            toastMessage.type === 'info' ? 'bg-zinc-800 border border-zinc-700' : 'bg-red-600 border border-red-500'
          }`}>
          {toastMessage.type === 'error' ? <AlertCircle className="w-5 h-5 text-white" /> : <CheckCircle2 className="w-5 h-5 text-white" />}
          <span>{toastMessage.text}</span>
        </div>
      )}


      {/* Main Workspace Container */}
      <main className="max-w-[1700px] mx-auto ">
        
        {/* Month Filter */}
        <div className="bg-white border border-gray-100 rounded-2xl px-4 py-3 mb-4 flex items-center justify-between gap-3 flex-wrap shadow-sm">
          <div className="flex items-center gap-3">
            <button
              onClick={() => window.history.back()}
              className="w-8 h-8 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center transition"
            >
              <ArrowLeft size={16} />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <Calendar size={15} />
              </div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-[2px]">
                Reconciliation Period
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden md:block w-px h-8 bg-gray-100" />
            <div className="flex items-center gap-2 flex-wrap">
              {availableMonthsLoading ? (
                <div className="flex items-center gap-2 text-gray-400 text-sm">
                  <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
                  Loading periods...
                </div>
              ) : availableMonths.length === 0 ? (
                <p className="text-gray-500 text-sm">No saved periods available</p>
              ) : (
                <>
                  <select
                    value={`${detailStartDate}|${detailEndDate}`}
                    onChange={(e) => {
                      const selected = availableMonths.find(
                        (m) => `${m.start_date}|${m.end_date}` === e.target.value,
                      )
                      if (selected) {
                        setDetailStartDate(selected.start_date)
                        setDetailEndDate(selected.end_date)
                      }
                    }}
                    className="px-3 py-2 border border-gray-100 rounded-xl bg-white text-sm font-bold text-black outline-none focus:border-blue-500 focus:bg-blue-50 transition-all cursor-pointer"
                  >
                    <option value="" disabled>
                      Select a month...
                    </option>
                    {availableMonths.map((month, idx) => (
                      <option
                        key={idx}
                        value={`${month.start_date}|${month.end_date}`}
                      >
                        {month.label}
                      </option>
                    ))}
                  </select>
                  {detailStartDate && detailEndDate && (
                    <span className="text-xs font-semibold text-gray-600 bg-blue-50 px-3 py-1.5 rounded-lg">
                      {new Date(detailStartDate).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}{' '}
                      -{' '}
                      {new Date(detailEndDate).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                  )}
                </>
              )}
            </div>
            <button
              onClick={handleSaveSummary}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-md transition"
            >
              Save Summary
            </button>
          </div>
        </div>

        {/* Navigation Tabs Bar */}
        <div className="flex items-center justify-between border-b border-zinc-300 mb-6 pb-2">
          <div className="flex space-x-2 sm:space-x-4">
            <button
              onClick={() => setActiveTab('reconcile')}
              className={`flex items-center space-x-2 px-4 py-2.5 rounded-t-xl text-xs sm:text-sm font-bold transition-all border-b-2 ${activeTab === 'reconcile'
                  ? 'border-red-600 text-red-600 bg-white shadow-sm'
                  : 'border-transparent text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/60'
                }`}
            >
              <Layers className="w-4 h-4" />
              <span>Reconciliation Matching Engine</span>
            </button>

            <button
              onClick={() => setActiveTab('statements')}
              className={`flex items-center space-x-2 px-4 py-2.5 rounded-t-xl text-xs sm:text-sm font-bold transition-all border-b-2 ${activeTab === 'statements'
                  ? 'border-red-600 text-red-600 bg-white shadow-sm'
                  : 'border-transparent text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/60'
                }`}
            >
              <FileText className="w-4 h-4" />
              <span>Bank Statement Feed ({items.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('ledger')}
              className={`flex items-center space-x-2 px-4 py-2.5 rounded-t-xl text-xs sm:text-sm font-bold transition-all border-b-2 ${activeTab === 'ledger'
                  ? 'border-red-600 text-red-600 bg-white shadow-sm'
                  : 'border-transparent text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/60'
                }`}
            >
              <Scale className="w-4 h-4" />
              <span>General Ledger Records ({journalEntries.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('report')}
              className={`flex items-center space-x-2 px-4 py-2.5 rounded-t-xl text-xs sm:text-sm font-bold transition-all border-b-2 ${activeTab === 'report'
                  ? 'border-red-600 text-red-600 bg-white shadow-sm'
                  : 'border-transparent text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/60'
                }`}
            >
              <PieChart className="w-4 h-4" />
              <span>Audit & Summary Sheet</span>
            </button>
          </div>

          <div className="hidden md:flex items-center space-x-2 text-xs font-mono text-zinc-500">
            <span>PROGRESS:</span>
            <div className="w-32 bg-zinc-200 h-2 rounded-full overflow-hidden">
              <div
                className="bg-red-600 h-full transition-all duration-500"
                style={{ width: `${reconcilePercentage}%` }}
              ></div>
            </div>
            <span className="font-bold text-zinc-800">{reconcilePercentage}%</span>
          </div>
        </div>


        {/* Tab Content */}
        {activeTab === 'reconcile' && (
          <div className="space-y-6">
            {/* Top Reconciliation Dynamic Calculation Header Card */}
            <div className="bg-white rounded-2xl border border-zinc-200/90 p-6 shadow-xl shadow-zinc-200/60">

              {/* Header Title Bar inside Card */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-zinc-100">
                <div className="flex items-center space-x-3">
                  <span className="px-3 py-1 bg-zinc-900 text-white font-mono text-[11px] font-bold tracking-widest uppercase rounded">
                    FORMULA CONTROL BLOCK
                  </span>
                  <h2 className="text-base font-bold text-zinc-900">
                    Bank Statement vs. General Ledger Reconciliation
                  </h2>
                </div>

                <div className="flex items-center space-x-3">
                  <button
                    onClick={handleAutoMatch}
                    className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold bg-zinc-900 hover:bg-zinc-800 text-white transition-all shadow-md active:scale-95"
                  >
                    <Zap className="w-4 h-4 text-red-500" />
                    <span>Run Smart Auto-Match</span>
                  </button>

                  <button
                    onClick={() => {
                      setShowOnlyUnmatched(!showOnlyUnmatched);
                    }}
                    className={`inline-flex items-center space-x-2 px-3 py-2 rounded-xl text-xs font-bold border transition-all ${showOnlyUnmatched
                        ? 'bg-red-50 border-red-300 text-red-700'
                        : 'bg-zinc-100 border-zinc-200 text-zinc-700 hover:bg-zinc-200'
                      }`}
                  >
                    <Filter className="w-3.5 h-3.5" />
                    <span>{showOnlyUnmatched ? 'Showing Unmatched Only' : 'Show All Items'}</span>
                  </button>
                </div>
              </div>

              {/* Math Reconciliation Summary Breakdown - Side by Side Cards */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-5">

                {/* Bank Statement Calculation Block */}
                <div className="lg:col-span-5 bg-zinc-50/80 rounded-xl p-4 border border-zinc-200/80">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-mono font-bold text-zinc-500 uppercase tracking-wider">
                      BANK STATEMENT RECONCILIATION
                    </span>
                    <span className="px-2 py-0.5 text-[10px] font-bold bg-zinc-200 text-zinc-700 rounded">
                      BANK FEED
                    </span>
                  </div>

                  <div className="space-y-2 text-xs font-mono">
                    <div className="flex justify-between py-1 border-b border-zinc-200/60">
                      <span className="text-zinc-600">Ending Statement Balance</span>
                      <span className="font-bold text-zinc-900">₱{fmt(bankStatementEndingBalance)}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-zinc-200/60 text-emerald-700">
                      <span>(+) Deposits in Transit</span>
                      <span className="font-bold">+₱{fmt(depositsInTransit)}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-zinc-200/60 text-red-600">
                      <span>(-) Outstanding Checks</span>
                      <span className="font-bold">-₱{fmt(outstandingChecks)}</span>
                    </div>

                    {/* Bank Adjustments List */}
                    {bankAdjustments.length > 0 && (
                      <div className="mt-3 pt-2 border-t border-zinc-200/60">
                        <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2">Bank Adjustments</div>
                        {bankAdjustments.map((adj, idx) => {
                          const isAdd = adj.type === 'deposits_in_transit' || (adj.type === 'error_bank' && adj.amount >= 0)
                          const displayAmount = Math.abs(adj.amount)
                          const typeLabel = adj.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
                          return (
                            <div key={adj.id || idx} className="flex justify-between items-center py-1 text-zinc-600">
                              <span className={`${isAdd ? 'text-emerald-700' : 'text-red-600'}`}>
                                {isAdd ? '(+) ' : '(-) '}{typeLabel} - {adj.description}
                              </span>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <span className={isAdd ? 'text-emerald-600' : 'text-red-600'}>
                                  {isAdd ? '+' : '-'}₱{fmt(displayAmount)}
                                </span>
                                <button
                                  onClick={() => handleRemoveBankAdjustment(adj.id)}
                                  className="text-zinc-400 hover:text-red-600"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}

                    <div className="flex justify-between pt-2 text-sm font-bold bg-white p-2 rounded border border-zinc-200">
                      <span className="text-zinc-900">Adjusted Bank Balance</span>
                      <span className="text-red-600 font-mono">₱{fmt(adjustedBankBalance)}</span>
                    </div>

                    {/* Add Bank Adjustment Button */}
                    <button
                      onClick={() => setShowBankAdjustmentForm(true)}
                      className="mt-2 w-full py-1.5 text-xs font-bold text-zinc-600 border border-zinc-300 rounded-lg hover:bg-zinc-50 hover:text-zinc-900 transition flex items-center justify-center gap-1"
                    >
                      <Plus className="w-3 h-3" />
                      Add Bank Adjustment
                    </button>
                  </div>
                </div>

                {/* Variance Counter Indicator Box */}
                <div className="lg:col-span-2 flex flex-col items-center justify-center p-4 rounded-xl bg-zinc-900 text-white border border-zinc-800 shadow-inner">
                  <span className="text-[10px] font-mono tracking-widest text-zinc-400 uppercase font-bold mb-1">
                    NET VARIANCE
                  </span>

                  <div className={`text-xl lg:text-2xl font-mono font-extrabold ${Math.abs(reconDifference) === 0 ? 'text-emerald-400' : 'text-red-500'}`}>
                    ₱{fmt(Math.abs(reconDifference))}
                  </div>

                  <div className="mt-2">
                    {Math.abs(reconDifference) === 0 ? (
                      <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>BALANCED</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-red-500/20 text-red-300 border border-red-500/30">
                        <AlertCircle className="w-3 h-3" />
                        <span>DISCREPANCY</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* General Ledger Calculation Block */}
                <div className="lg:col-span-5 bg-zinc-50/80 rounded-xl p-4 border border-zinc-200/80">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-mono font-bold text-zinc-500 uppercase tracking-wider">
                      BOOK LEDGER RECONCILIATION
                    </span>
                    <span className="px-2 py-0.5 text-[10px] font-bold bg-red-100 text-red-700 rounded">
                      BOOK GL
                    </span>
                  </div>

                  <div className="space-y-2 text-xs font-mono">
                    <div className="flex justify-between py-1 border-b border-zinc-200/60">
                      <span className="text-zinc-600">Ending Book GL Balance</span>
                      <span className="font-bold text-zinc-900">₱{fmt(endingBookBalance)}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-zinc-200/60 text-emerald-700">
                      <span>(+) Unrecorded Bank Credits</span>
                      <span className="font-bold">+₱{fmt(unrecordedBankCredits)}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-zinc-200/60 text-red-600">
                      <span>(-) Unrecorded Bank Charges</span>
                      <span className="font-bold">-₱{fmt(unrecordedBankDebits)}</span>
                    </div>

                    {/* Book Adjustments List */}
                    {bookAdjustments.length > 0 && (
                      <div className="mt-3 pt-2 border-t border-zinc-200/60">
                        <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2">Book Adjustments</div>
                        {bookAdjustments.map((adj, idx) => {
                          const isAdd = adj.type === 'interest_earned' || adj.type === 'bank_credit_memo' || (adj.type === 'error_book' && adj.amount >= 0)
                          const displayAmount = Math.abs(adj.amount)
                          const typeLabel = adj.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
                          return (
                            <div key={adj.id || idx} className="flex justify-between items-center py-1 text-zinc-600">
                              <span className={`${isAdd ? 'text-emerald-700' : 'text-red-600'}`}>
                                {isAdd ? '(+) ' : '(-) '}{typeLabel} - {adj.description}
                              </span>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <span className={isAdd ? 'text-emerald-600' : 'text-red-600'}>
                                  {isAdd ? '+' : '-'}₱{fmt(displayAmount)}
                                </span>
                                <button
                                  onClick={() => handleRemoveBookAdjustment(adj.id)}
                                  className="text-zinc-400 hover:text-red-600"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}

                    <div className="flex justify-between pt-2 text-sm font-bold bg-white p-2 rounded border border-zinc-200">
                      <span className="text-zinc-900">Adjusted Book Balance</span>
                      <span className="text-red-600 font-mono">₱{fmt(adjustedBookBalance)}</span>
                    </div>

                    {/* Add Book Adjustment Button */}
                    <button
                      onClick={() => setShowBookAdjustmentForm(true)}
                      className="mt-2 w-full py-1.5 text-xs font-bold text-zinc-600 border border-zinc-300 rounded-lg hover:bg-zinc-50 hover:text-zinc-900 transition flex items-center justify-center gap-1"
                    >
                      <Plus className="w-3 h-3" />
                      Add Book Adjustment
                    </button>
                  </div>
                </div>

              </div>

              {/* Selection Match Action Floating Bar when items are selected */}
              {(selectedStmtIds.length > 0 || selectedBookIds.length > 0) && (
                <div className="mt-5 p-4 bg-red-950 text-white rounded-xl border border-red-700 flex flex-col md:flex-row items-center justify-between gap-4 animate-fade-in shadow-xl">
                  <div className="flex items-center space-x-4 text-xs font-mono">
                    <div>
                      <span className="text-zinc-400">Statement Selected ({selectedStmtIds.length}):</span>
                      <span className="font-bold ml-1.5 text-white">₱{fmt(selectedStmtTotal)}</span>
                    </div>
                    <div className="text-zinc-500">vs</div>
                    <div>
                      <span className="text-zinc-400">Book Selected ({selectedBookIds.length}):</span>
                      <span className="font-bold ml-1.5 text-white">₱{fmt(selectedBookTotal)}</span>
                    </div>
                    <div className="pl-3 border-l border-red-800">
                      <span className="text-zinc-400">Variance:</span>
                      <span className={`font-bold ml-1.5 ${Math.abs(selectedDifference) === 0 ? 'text-emerald-400' : 'text-red-300'}`}>
                        ₱{fmt(Math.abs(selectedDifference))}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    <button
                      onClick={() => {
                        setSelectedStmtIds([]);
                        setSelectedBookIds([]);
                      }}
                      className="px-3 py-1.5 rounded-lg text-xs bg-red-900 hover:bg-red-800 text-zinc-200 border border-red-700"
                    >
                      Clear Selection
                    </button>

                    <button
                      onClick={handleMatchSelected}
                      disabled={Math.abs(selectedDifference) > 0.01}
                      className={`px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-md ${Math.abs(selectedDifference) === 0
                          ? 'bg-emerald-500 hover:bg-emerald-600 text-white cursor-pointer'
                          : 'bg-zinc-700 text-zinc-400 cursor-not-allowed opacity-60'
                        }`}
                    >
                      Match Selected Transactions
                    </button>
                  </div>
                </div>
              )}

            </div>

            {/* DUAL PANE COMPARISON TABLE WORKSPACE */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

              {/* LEFT PANE: BANK STATEMENT ITEMS */}
              <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden shadow-md">

                {/* Header Block Inspired by Red Header Block in Design Suite */}
                <div className="bg-red-600 text-white p-4 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <span className="px-2.5 py-0.5 rounded bg-black/20 text-[10px] font-mono uppercase font-bold tracking-wider">
                      STATEMENT SIDE
                    </span>
                    <h3 className="font-bold text-sm">Bank Statement Transactions</h3>
                  </div>
                  <span className="text-xs font-mono bg-white/10 px-2 py-1 rounded text-white">
                    {currentStmtItems.length} Records
                  </span>
                </div>

                {/* Table Header Filter & Search */}
                <div className="p-3 bg-zinc-50 border-b border-zinc-200 flex items-center space-x-3">
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      placeholder="Search description, ref # or amount..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600"
                    />
                  </div>
                </div>

                {/* Statement List */}
                <div className="divide-y divide-zinc-100 h-[calc(100vh-420px)] overflow-y-auto">
                  {currentStmtItems.length === 0 ? (
                    <div className="p-8 text-center text-zinc-500 text-xs font-mono">
                      No bank statement items matching search filter.
                    </div>
                  ) : (
                    currentStmtItems.map(item => {
                      const isSelected = selectedStmtIds.includes(item.id);
                      const amount = getItemAmount(item);
                      const isDebit = amount >= 0;
                      const isMatched = item.ledger_id !== null && item.ledger_id !== undefined;
                      const displayDate = item.date || item.bri_date ? formatLocalDate(new Date(item.date || item.bri_date)) : '-';

                      return (
                        <div
                          key={item.id}
                          className={`p-3.5 flex items-center justify-between text-xs transition-colors ${isMatched
                              ? 'bg-emerald-50/40 hover:bg-emerald-50/70'
                              : isSelected
                                ? 'bg-red-50/80 border-l-4 border-red-600'
                                : 'hover:bg-zinc-50'
                            }`}
                        >
                          <div className="flex items-center space-x-3">
                            {/* Checkbox for selection */}
                            {!isMatched ? (
                              <button
                                onClick={() => toggleSelectStmt(item.id)}
                                className="text-zinc-400 hover:text-red-600 transition-colors"
                              >
                                {isSelected ? (
                                  <CheckSquare className="w-4 h-4 text-red-600" />
                                ) : (
                                  <Square className="w-4 h-4" />
                                )}
                              </button>
                            ) : (
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                            )}

                            <div>
                              <div className="font-semibold text-zinc-900 flex items-center space-x-2">
                                <span>{item.description || item.bri_description || item.details || 'No description'}</span>
                              </div>
                              <div className="text-[10px] text-zinc-500 font-mono mt-0.5 flex items-center space-x-2">
                                <span>{displayDate}</span>
                                <span>•</span>
                                <span>Ref: {item.reference_number || item.bri_reference_number || '-'}</span>
                              </div>
                            </div>
                          </div>

                          <div className="text-right flex items-center space-x-3">
                            <div>
                              <div className={`font-mono font-bold ${isDebit ? 'text-emerald-600' : 'text-zinc-900'}`}>
                                {isDebit ? '+' : ''}₱{fmt(Math.abs(amount))}
                              </div>
                              <div className="text-[10px]">
                                {isMatched ? (
                                  <span className="text-emerald-700 font-bold font-mono">MATCHED</span>
                                ) : (
                                  <span className="text-amber-600 font-bold font-mono">UNMATCHED</span>
                                )}
                              </div>
                            </div>

                            {/* Actions */}
                            {isMatched ? (
                              <button
                                onClick={() => handleUnmatch(item.id)}
                                title="Unmatch Item"
                                className="p-1 rounded text-zinc-400 hover:text-red-600 hover:bg-zinc-100"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                              </button>
                            ) : (
                              <button
                                onClick={() => handleCreateBookEntryFromStmt(item)}
                                title="Create GL Entry from this item"
                                className="px-2 py-1 bg-zinc-900 hover:bg-black text-white text-[10px] font-bold rounded shadow-sm"
                              >
                                + GL Entry
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

              </div>

              {/* RIGHT PANE: GENERAL LEDGER BOOK ITEMS */}
              <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden shadow-md">

                {/* Header Block Inspired by Dark Carbon Header Block in Design Suite */}
                <div className="bg-zinc-900 text-white p-4 flex items-center justify-between border-b border-zinc-800">
                  <div className="flex items-center space-x-3">
                    <span className="px-2.5 py-0.5 rounded bg-red-600 text-white text-[10px] font-mono uppercase font-bold tracking-wider">
                      BOOK SIDE
                    </span>
                    <h3 className="font-bold text-sm">General Ledger Records</h3>
                  </div>
                  <span className="text-xs font-mono bg-zinc-800 px-2 py-1 rounded text-zinc-300">
                    {currentBookItems.length} Records
                  </span>
                </div>

                {/* Table Header Filter & Search */}
                <div className="p-3 bg-zinc-50 border-b border-zinc-200 flex items-center space-x-3">
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      placeholder="Search payee, check # or amount..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-800"
                    />
                  </div>
                </div>

                {/* Book Ledger List */}
                <div className="divide-y divide-zinc-100 h-[calc(100vh-420px)] overflow-y-auto">
                  {currentBookItems.length === 0 ? (
                    <div className="p-8 text-center text-zinc-500 text-xs font-mono">
                      No general ledger records matching search filter.
                    </div>
                  ) : (
                    currentBookItems.map(entry => {
                      const isSelected = selectedBookIds.includes(entry.id);
                      const amount = parseFloat(entry.amount) || 0;
                      const isDebit = amount >= 0;
                      const isMatched = items.some(item => item.ledger_id === entry.id);
                      const checkRef = entry.check_number || entry.document_reference || '-';
                      const payeeMemo = [entry.payee_name, entry.responsibility_center].filter(Boolean).join(' - ') || entry.description || 'No description';
                      const displayDate = entry.date ? formatLocalDate(new Date(entry.date)) : '-';

                      return (
                        <div
                          key={entry.id}
                          className={`p-3.5 flex items-center justify-between text-xs transition-colors ${isMatched
                              ? 'bg-emerald-50/40 hover:bg-emerald-50/70'
                              : isSelected
                                ? 'bg-zinc-100/90 border-l-4 border-zinc-900'
                                : 'hover:bg-zinc-50'
                            }`}
                        >
                          <div className="flex items-center space-x-3">
                            {/* Checkbox for selection */}
                            {!isMatched ? (
                              <button
                                onClick={() => toggleSelectBook(entry.id)}
                                className="text-zinc-400 hover:text-zinc-900 transition-colors"
                              >
                                {isSelected ? (
                                  <CheckSquare className="w-4 h-4 text-zinc-900" />
                                ) : (
                                  <Square className="w-4 h-4" />
                                )}
                              </button>
                            ) : (
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                            )}

                            <div>
                              <div className="font-semibold text-zinc-900 flex items-center space-x-2">
                                <span>{payeeMemo}</span>
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-100 text-zinc-600 border border-zinc-200">
                                  {entry.db_name || entry.category || 'General'}
                                </span>
                              </div>
                              <div className="text-[10px] text-zinc-500 font-mono mt-0.5 flex items-center space-x-2">
                                <span>{entry.date}</span>
                                <span>•</span>
                                <span>Chk #: {checkRef}</span>
                              </div>
                            </div>
                          </div>

                          <div className="text-right flex items-center space-x-3">
                            <div>
                              <div className={`font-mono font-bold ${isDebit ? 'text-emerald-600' : 'text-zinc-900'}`}>
                                {isDebit ? '+' : ''}₱{fmt(Math.abs(amount))}
                              </div>
                              <div className="text-[10px]">
                                {isMatched ? (
                                  <span className="text-emerald-700 font-bold font-mono">MATCHED</span>
                                ) : (
                                  <span className="text-zinc-500 font-bold font-mono">
                                    {isDebit ? 'DEP IN TRANSIT' : 'OUTSTANDING CHK'}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Unmatch Action */}
                            {isMatched && (
                              <button
                                onClick={() => {
                                  const matchedBankItem = items.find(item => item.ledger_id === entry.id);
                                  if (matchedBankItem) {
                                    handleUnmatch(matchedBankItem.id);
                                  }
                                }}
                                title="Unmatch Item"
                                className="p-1 rounded text-zinc-400 hover:text-red-600 hover:bg-zinc-100"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

              </div>

            </div>
          </div>
        )}

        {/* Statements Tab */}
        {activeTab === 'statements' && (
          <div className="bg-white rounded-2xl border border-zinc-200 p-6 shadow-md">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-base font-bold text-zinc-900">Imported Bank Statement Feed</h3>
                <p className="text-xs text-zinc-500 font-mono mt-1">Raw transactions imported directly from bank API feed</p>
              </div>

              <button
                onClick={() => setShowItemModal(true)}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-md"
              >
                + Add Manual / Upload Image
              </button>
            </div>

            <div className="overflow-x-auto border border-zinc-200 rounded-xl h-[calc(100vh-350px)] overflow-y-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-zinc-900 text-white uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="p-3">Date</th>
                    <th className="p-3">Reference #</th>
                    <th className="p-3">Description</th>
                    <th className="p-3">Type</th>
                    <th className="p-3 text-right">Amount</th>
                    <th className="p-3 text-center">Status</th>
                    <th className="p-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="p-8 text-center text-zinc-500 text-xs font-mono">
                        No bank statement items available.
                      </td>
                    </tr>
                  ) : (
                    items.map(i => {
                      const amount = getItemAmount(i)
                      const isDebit = amount >= 0
                      const displayDate = i.date || i.bri_date ? formatLocalDate(new Date(i.date || i.bri_date)) : '-'
                      return (
                        <tr key={i.id} className="hover:bg-zinc-50">
                          <td className="p-3">{displayDate}</td>
                          <td className="p-3 font-semibold text-zinc-600">{i.reference_number || i.bri_reference_number || '-'}</td>
                          <td className="p-3 font-sans font-medium text-zinc-900">{i.description || i.bri_description || i.details || 'No description'}</td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${isDebit ? 'bg-emerald-100 text-emerald-800' : 'bg-zinc-100 text-zinc-700'}`}>
                              {isDebit ? 'CR' : 'DR'}
                            </span>
                          </td>
                          <td className={`p-3 text-right font-bold ${isDebit ? 'text-emerald-600' : 'text-zinc-900'}`}>
                            ₱{fmt(Math.abs(amount))}
                          </td>
                          <td className="p-3 text-center">
                            <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${i.status === 'matched' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                              }`}>
                              {(i.status || 'unmatched').toUpperCase()}
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            <div className="flex items-center justify-center space-x-1  p-1">
                              <button
                                onClick={() => handleEditItem(i)}
                                className="p-1.5 rounded text-blue-600 bg-white transition-colors"
                                title="Edit item"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteBankItem(i.id)}
                                className="p-1.5 rounded text-red-600 bg-white transition-colors"
                                title="Delete item"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Ledger Tab */}
        {activeTab === 'ledger' && (
          <div className="bg-white rounded-2xl border border-zinc-200 p-6 shadow-md">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-base font-bold text-zinc-900">General Ledger (GL) Postings</h3>
                <p className="text-xs text-zinc-500 font-mono mt-1">Company internal accounting entries for this account</p>
              </div>

              <button
                onClick={() => {
                  setSelectedStmtForEntry(null);
                  setIsNewEntryModalOpen(true);
                }}
                className="px-4 py-2 bg-zinc-900 hover:bg-black text-white rounded-xl text-xs font-bold shadow-md"
              >
                + Post Manual GL Entry
              </button>
            </div>

            <div className="overflow-x-auto border border-zinc-200 rounded-xl h-[calc(100vh-350px)] overflow-y-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-red-600 text-white uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="p-3">Date</th>
                    <th className="p-3">Check / Ref #</th>
                    <th className="p-3">Payee / Memo</th>
                    <th className="p-3">Category</th>
                    <th className="p-3 text-right">Amount</th>
                    <th className="p-3 text-center">Reconciliation Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {journalEntries.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="p-8 text-center text-zinc-500 text-xs font-mono">
                        No general ledger entries available.
                      </td>
                    </tr>
                  ) : (
                    journalEntries.map(i => {
                      const isDebit = i.type?.toLowerCase() === 'debit'
                      const amount = parseFloat(i.amount) || 0
                      const checkRef = i.check_number || i.document_reference || '-'
                      const payeeMemo = [i.payee_name, i.responsibility_center].filter(Boolean).join(' - ') || i.description || 'No description'
                      const displayDate = i.date ? formatLocalDate(new Date(i.date)) : '-'
                      return (
                        <tr key={i.id} className="hover:bg-zinc-50">
                          <td className="p-3">{displayDate}</td>
                          <td className="p-3 font-semibold text-zinc-600">{checkRef}</td>
                          <td className="p-3 font-sans font-medium text-zinc-900">{payeeMemo}</td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 rounded bg-zinc-100 text-zinc-800 text-[10px] border border-zinc-200">
                              {i.db_name || i.category || 'General'}
                            </span>
                          </td>
                          <td className={`p-3 text-right font-bold ${isDebit ? 'text-emerald-600' : 'text-zinc-900'}`}>
                            ₱{fmt(Math.abs(amount))}
                          </td>
                          <td className="p-3 text-center">
                            <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${i.status === 'matched' ? 'bg-emerald-100 text-emerald-800' : 'bg-zinc-100 text-zinc-700'
                              }`}>
                              {i.status === 'matched' ? 'RECONCILED' : 'OPEN'}
                            </span>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Report Tab */}
        {activeTab === 'report' && (
          <div className="bg-white rounded-2xl border border-zinc-200 p-8 shadow-xl max-w-4xl mx-auto font-sans">
            <div className="border-b-2 border-zinc-900 pb-6 mb-6 flex items-start justify-between">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="bg-red-600 text-white text-[10px] font-mono px-2 py-0.5 rounded uppercase font-bold">
                    OFFICIAL FINANCIAL AUDIT
                  </span>
                  <span className="text-zinc-400 font-mono text-xs">REF-RECON-{new Date().getFullYear()}-{String(new Date().getMonth() + 1).padStart(2, '0')}</span>
                </div>
                <h1 className="text-2xl font-extrabold text-zinc-900 mt-2">Bank Reconciliation Summary Report</h1>
                <p className="text-xs text-zinc-500 font-mono mt-1">Period Ending {reconData.period_end_date || new Date().toLocaleDateString()} • Prepared for Enterprise Treasury Audit</p>
              </div>

              <div className="text-right">
                <div className="text-xs text-zinc-500 font-mono">ACCOUNT</div>
                <div className="font-bold text-zinc-900 text-sm">{reconData.account_name || 'Bank Account'}</div>
                <div className="text-xs font-mono text-red-600">{reconData.bank_account || 'No bank reference'}</div>
              </div>
            </div>

            {/* Formal Statement Breakdown Table */}
            <div className="space-y-6 text-sm">
              <div className="bg-zinc-50 p-4 rounded-xl border border-zinc-200 space-y-3 font-mono">
                <div className="flex justify-between font-bold text-zinc-900 text-base border-b border-zinc-300 pb-2">
                  <span>Balance per Bank Statement (A)</span>
                  <span>₱{fmt(bankStatementEndingBalance)}</span>
                </div>

                <div className="pl-4 space-y-1 text-xs">
                  <div className="flex justify-between text-emerald-700">
                    <span>Add: Deposits in Transit</span>
                    <span>+₱{fmt(depositsInTransit)}</span>
                  </div>
                  <div className="flex justify-between text-red-600">
                    <span>Less: Outstanding Checks</span>
                    <span>-₱{fmt(outstandingChecks)}</span>
                  </div>
                </div>

                <div className="flex justify-between font-extrabold text-red-600 text-base pt-2 border-t border-zinc-300 bg-white p-2 rounded">
                  <span>Adjusted Bank Balance</span>
                  <span>₱{fmt(adjustedBankBalance)}</span>
                </div>
              </div>

              <div className="bg-zinc-50 p-4 rounded-xl border border-zinc-200 space-y-3 font-mono">
                <div className="flex justify-between font-bold text-zinc-900 text-base border-b border-zinc-300 pb-2">
                  <span>Balance per General Ledger Books (B)</span>
                  <span>₱{fmt(endingBookBalance)}</span>
                </div>

                <div className="pl-4 space-y-1 text-xs">
                  <div className="flex justify-between text-emerald-700">
                    <span>Add: Unrecorded Bank Direct Credits</span>
                    <span>+₱{fmt(unrecordedBankCredits)}</span>
                  </div>
                  <div className="flex justify-between text-red-600">
                    <span>Less: Unrecorded Service Charges / Debits</span>
                    <span>-₱{fmt(unrecordedBankDebits)}</span>
                  </div>
                </div>

                <div className="flex justify-between font-extrabold text-red-600 text-base pt-2 border-t border-zinc-300 bg-white p-2 rounded">
                  <span>Adjusted Book Balance</span>
                  <span>₱{fmt(adjustedBookBalance)}</span>
                </div>
              </div>

              {/* Final Variance Row */}
              <div className={`p-4 rounded-xl border flex items-center justify-between font-mono font-bold ${Math.abs(reconDifference) === 0 ? 'bg-emerald-50 border-emerald-300 text-emerald-900' : 'bg-red-50 border-red-300 text-red-900'
                }`}>
                <span>NET UNRECONCILED DIFFERENCE (A - B):</span>
                <span className="text-lg">₱{fmt(Math.abs(reconDifference))}</span>
              </div>
            </div>

            {/* Print & Export Actions */}
            <div className="mt-8 pt-6 border-t border-zinc-200 flex justify-between items-center">
              <span className="text-xs text-zinc-400 font-mono">STATUS: {Math.abs(reconDifference) === 0 ? 'FULLY RECONCILED ✅' : 'PENDING MATCHES ⚠️'}</span>

              <button
                onClick={() => window.print()}
                className="px-5 py-2.5 bg-zinc-900 hover:bg-black text-white text-xs font-bold rounded-xl shadow-md flex items-center space-x-2"
              >
                <Download className="w-4 h-4" />
                <span>Print / Save Audit PDF</span>
              </button>
            </div>
          </div>
        )}

      </main>

      {/* Add / Edit Item Modal */}
      <RightSideModal
        isOpen={showItemModal}
        onClose={() => {
          setShowItemModal(false)
          setEditingItem(null)
          resetItemForm()
        }}
        title={editingItem ? 'Edit Reconciling Item' : 'Add Reconciling Items'}
        size={editingItem ? 'xl' : '5xl'}
      >
        <div className="pb-16">
          <div className="p-3 overflow-y-auto max-h-[75vh]">
            <div className="mb-5 grid grid-cols-2 gap-3">
              {/* <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
                <p className="text-[10px] font-black text-blue-600 uppercase tracking-[2px] mb-1.5">
                  Bank Section Items
                </p>
                {BANK_SECTION_ITEMS.map((t) => (
                  <div
                    key={t.value}
                    className="flex items-center gap-1.5 text-[11px] text-blue-800 mb-0.5"
                  >
                    <span className="font-black">
                      {t.effect === 'add' ? '+' : t.effect === 'deduct' ? '−' : '±'}
                    </span>
                    {t.label}
                  </div>
                ))}
              </div>
              <div className="bg-violet-50 border border-violet-100 rounded-xl p-3">
                <p className="text-[10px] font-black text-violet-600 uppercase tracking-[2px] mb-1.5">
                  Book Section Items
                </p>
                {BOOK_SECTION_ITEMS.map((t) => (
                  <div
                    key={t.value}
                    className="flex items-center gap-1.5 text-[11px] text-violet-800 mb-0.5"
                  >
                    <span className="font-black">
                      {t.effect === 'add' ? '+' : t.effect === 'deduct' ? '−' : '±'}
                    </span>
                    {t.label}
                  </div>
                ))}
              </div> */}
            </div>

            {editingItem ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-2 uppercase tracking-wider">
                    Details *
                  </label>
                  <input
                    type="text"
                    value={itemFormData.details}
                    onChange={(e) =>
                      setItemFormData({ ...itemFormData, details: e.target.value })
                    }
                    placeholder="Enter bank details"
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">
                      Date *
                    </label>
                    <input
                      type="date"
                      value={itemFormData.date}
                      onChange={(e) =>
                        setItemFormData({ ...itemFormData, date: e.target.value })
                      }
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">
                      Reference No.
                    </label>
                    <input
                      type="text"
                      value={itemFormData.reference_number}
                      onChange={(e) =>
                        setItemFormData({
                          ...itemFormData,
                          reference_number: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">
                      Description
                    </label>
                    <input
                      type="text"
                      value={itemFormData.description}
                      onChange={(e) =>
                        setItemFormData({
                          ...itemFormData,
                          description: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm"
                    />
                  </div>
                  <div className="col-span-2 grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">
                        Debit
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                          ₱
                        </span>
                        <input
                          type="number"
                          step="0.01"
                          value={itemFormData.debit}
                          onChange={(e) =>
                            setItemFormData({
                              ...itemFormData,
                              debit: e.target.value,
                              credit: e.target.value ? '' : itemFormData.credit,
                            })
                          }
                          placeholder="0.00"
                          className="w-full pl-7 pr-3 py-2.5 border border-gray-300 rounded-lg text-sm"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">
                        Credit
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                          ₱
                        </span>
                        <input
                          type="number"
                          step="0.01"
                          value={itemFormData.credit}
                          onChange={(e) =>
                            setItemFormData({
                              ...itemFormData,
                              credit: e.target.value,
                              debit: e.target.value ? '' : itemFormData.debit,
                            })
                          }
                          placeholder="0.00"
                          className="w-full pl-7 pr-3 py-2.5 border border-gray-300 rounded-lg text-sm"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="space-y-2">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                    <div>
                      <p className="text-xs font-black text-gray-900 uppercase tracking-wider">
                        Batch Reconciling Items
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Add multiple items in one save. Each row is one reconciling
                        entry.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={openOcrFilePicker}
                        disabled={ocrLoading}
                        className="px-3 py-2 bg-slate-900 text-white rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-slate-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {ocrLoading ? 'Uploading...' : 'Upload Image'}
                      </button>
                      <input
                        ref={ocrFileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleOcrFileSelected}
                      />
                    </div>
                  </div>
                  {ocrError && <p className="text-xs text-red-600">{ocrError}</p>}

                  <div className="space-y-2">
                    {itemFormRows.map((row, index) => {
                      const meta = getItemMeta(row.details)
                      return (
                        <div
                          key={index}
                          className={`border rounded-xl p-3 bg-white ${meta.borderColor}`}
                        >
                          <div className="grid grid-cols-1 md:grid-cols-13 gap-2 items-end">
                            <div className="md:col-span-2">
                              <label className="block text-[10px] font-black text-gray-500 mb-1 uppercase tracking-wider">
                                Details *
                              </label>
                              <input
                                type="text"
                                value={row.details}
                                onChange={(e) =>
                                  updateItemFormRow(index, 'details', e.target.value)
                                }
                                placeholder="Enter details"
                                className="w-full px-2.5 py-2 border border-gray-300 rounded-lg text-xs"
                              />
                            </div>

                            <div className="md:col-span-2">
                              <label className="block text-[10px] font-black text-gray-500 mb-1 uppercase tracking-wider">
                                Date *
                              </label>
                              <input
                                type="date"
                                value={row.date}
                                onChange={(e) =>
                                  updateItemFormRow(index, 'date', e.target.value)
                                }
                                className="w-full px-2.5 py-2 border border-gray-300 rounded-lg text-sm"
                              />
                            </div>

                            <div className="md:col-span-2">
                              <label className="block text-[10px] font-black text-gray-500 mb-1 uppercase tracking-wider">
                                Reference No.
                              </label>
                              <input
                                type="text"
                                value={row.reference_number}
                                onChange={(e) =>
                                  updateItemFormRow(
                                    index,
                                    'reference_number',
                                    e.target.value,
                                  )
                                }
                                placeholder="Check no."
                                className="w-full px-2.5 py-2 border border-gray-300 rounded-lg text-sm outline-none"
                              />
                            </div>

                            <div className="md:col-span-3">
                              <label className="block text-[10px] font-black text-gray-500 mb-1 uppercase tracking-wider">
                                Description
                              </label>
                              <input
                                type="text"
                                value={row.description}
                                onChange={(e) =>
                                  updateItemFormRow(
                                    index,
                                    'description',
                                    e.target.value,
                                  )
                                }
                                placeholder="Description details"
                                className="w-full px-2.5 py-2 border border-gray-300 rounded-lg text-sm outline-none"
                              />
                            </div>

                            <div className="md:col-span-3 grid grid-cols-2 gap-2">
                              <div>
                                <label className="block text-[10px] font-black text-gray-500 mb-1 uppercase tracking-wider">
                                  Debit
                                </label>
                                <div className="relative">
                                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">
                                    ₱
                                  </span>
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={row.debit}
                                    onChange={(e) => {
                                      updateItemFormRow(
                                        index,
                                        'debit',
                                        e.target.value,
                                      )
                                      if (e.target.value) {
                                        updateItemFormRow(index, 'credit', '')
                                      }
                                    }}
                                    placeholder="0.00"
                                    className="w-full pl-5 pr-2 py-2 border border-gray-300 rounded-lg text-sm outline-none"
                                  />
                                </div>
                              </div>
                              <div>
                                <label className="block text-[10px] font-black text-gray-500 mb-1 uppercase tracking-wider">
                                  Credit
                                </label>
                                <div className="relative">
                                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">
                                    ₱
                                  </span>
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={row.credit}
                                    onChange={(e) => {
                                      updateItemFormRow(
                                        index,
                                        'credit',
                                        e.target.value,
                                      )
                                      if (e.target.value) {
                                        updateItemFormRow(index, 'debit', '')
                                      }
                                    }}
                                    placeholder="0.00"
                                    className="w-full pl-5 pr-2 py-2 border border-gray-300 rounded-lg text-sm outline-none"
                                  />
                                </div>
                              </div>
                            </div>

                            <div className="md:col-span-1 flex items-end justify-end">
                              <button
                                type="button"
                                onClick={() => removeItemFormRow(index)}
                                disabled={itemFormRows.length === 1}
                                className="w-9 h-9 rounded-lg border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition"
                                aria-label="Delete row"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  <div className="pt-2 flex justify-start">
                    <button
                      type="button"
                      onClick={addItemFormRow}
                      className="px-4 py-2 border border-gray-900 text-gray-900 rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-gray-50 transition flex items-center gap-1.5"
                    >
                      <Plus size={13} /> Add Row
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowItemModal(false)
                  setEditingItem(null)
                  resetItemForm()
                }}
                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-gray-700 text-sm font-bold hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleAddOrUpdateItem}
                className="flex-1 px-4 py-2.5 bg-gray-900 text-white rounded-lg text-sm font-bold hover:bg-gray-800 transition flex items-center justify-center gap-2"
              >
                <Check size={16} />
                {editingItem
                  ? 'Update Item'
                  : `Save ${itemFormRows.length} Reconciling Item${itemFormRows.length === 1 ? '' : 's'}`}
              </button>
            </div>
          </div>
        </div>
      </RightSideModal>

      {/* MODAL 2: NEW GL ADJUSTMENT ENTRY */}
      {isNewEntryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
            <div className="px-6 py-4 bg-zinc-900 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Plus className="text-red-400" size={20} />
                <div>
                  <h3 className="text-white font-black text-lg">New GL Adjustment Entry</h3>
                  <p className="text-zinc-400 text-xs">Post manual journal entry</p>
                </div>
              </div>
              <button
                onClick={() => setIsNewEntryModalOpen(false)}
                className="text-zinc-400 hover:text-white transition"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-2">Account</label>
                <select className="w-full px-4 py-2.5 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:border-red-500">
                  <option>Select account...</option>
                  <option>Cash - BPI Checking</option>
                  <option>Cash - BDO Savings</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-2">Description</label>
                <input
                  type="text"
                  placeholder="Enter description..."
                  className="w-full px-4 py-2.5 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:border-red-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-zinc-700 mb-2">Debit</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    className="w-full px-4 py-2.5 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:border-red-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-700 mb-2">Credit</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    className="w-full px-4 py-2.5 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:border-red-500"
                  />
                </div>
              </div>
              <div className="mt-4 flex gap-3">
                <button
                  onClick={() => setIsNewEntryModalOpen(false)}
                  className="flex-1 px-4 py-2.5 border border-zinc-300 rounded-lg text-zinc-700 text-sm font-bold hover:bg-zinc-50 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setIsNewEntryModalOpen(false)
                    showToast({ type: 'success', text: 'GL entry posted successfully' })
                  }}
                  className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg text-sm font-bold hover:bg-red-700 transition"
                >
                  Post Entry
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: FINALIZE PERIOD */}
      {isFinalizeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
            <div className="px-6 py-4 bg-zinc-900 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Lock className="text-red-400" size={20} />
                <div>
                  <h3 className="text-white font-black text-lg">Finalize Reconciliation Period</h3>
                  <p className="text-zinc-400 text-xs">Lock and complete this reconciliation</p>
                </div>
              </div>
              <button
                onClick={() => setIsFinalizeModalOpen(false)}
                className="text-zinc-400 hover:text-white transition"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="text-amber-600 flex-shrink-0 mt-0.5" size={18} />
                  <div>
                    <p className="text-sm font-bold text-amber-900">Warning</p>
                    <p className="text-xs text-amber-700 mt-1">
                      Finalizing will lock this reconciliation period. You will not be able to make further changes.
                    </p>
                  </div>
                </div>
              </div>
              <div className="space-y-3 mb-6">
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-600">Ending Balance</span>
                  <span className="font-mono font-bold text-zinc-900">₱{fmt(bankStatementEndingBalance)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-600">Adjusted Balance</span>
                  <span className="font-mono font-bold text-zinc-900">₱{fmt(adjustedBankBalance)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-600">Variance</span>
                  <span className={`font-mono font-bold ${Math.abs(reconDifference) === 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    ₱{fmt(Math.abs(reconDifference))}
                  </span>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setIsFinalizeModalOpen(false)}
                  className="flex-1 px-4 py-2.5 border border-zinc-300 rounded-lg text-zinc-700 text-sm font-bold hover:bg-zinc-50 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setIsFinalizeModalOpen(false)
                    showToast({ type: 'success', text: 'Reconciliation period finalized' })
                  }}
                  disabled={Math.abs(reconDifference) > 0.01}
                  className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-bold transition ${Math.abs(reconDifference) === 0
                      ? 'bg-red-600 text-white hover:bg-red-700'
                      : 'bg-zinc-300 text-zinc-500 cursor-not-allowed'
                    }`}
                >
                  Finalize Period
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: BANK ADJUSTMENT FORM */}
      {showBankAdjustmentForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
            <div className="px-6 py-4 bg-zinc-900 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Plus className="text-red-400" size={20} />
                <div>
                  <h3 className="text-white font-black text-lg">Add Bank Adjustment</h3>
                  <p className="text-zinc-400 text-xs">Add manual adjustment to bank statement</p>
                </div>
              </div>
              <button
                onClick={() => setShowBankAdjustmentForm(false)}
                className="text-zinc-400 hover:text-white transition"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-2">Bank Side - Adjustment Type</label>
                <select
                  value={bankAdjustmentForm.type}
                  onChange={(e) => setBankAdjustmentForm({ ...bankAdjustmentForm, type: e.target.value })}
                  className="w-full px-4 py-2.5 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:border-red-500"
                >
                  <option value="">Select type...</option>
                  <option value="deposits_in_transit">Deposit in Transit (add)</option>
                  <option value="outstanding_checks">Outstanding Check (less)</option>
                  <option value="error_bank">Bank Error / Correction (add/less)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-2">Description</label>
                <input
                  type="text"
                  value={bankAdjustmentForm.description}
                  onChange={(e) => setBankAdjustmentForm({ ...bankAdjustmentForm, description: e.target.value })}
                  placeholder="Enter description..."
                  className="w-full px-4 py-2.5 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:border-red-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-2">Amount</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-sm">₱</span>
                  <input
                    type="number"
                    step="0.01"
                    value={bankAdjustmentForm.amount}
                    onChange={(e) => setBankAdjustmentForm({ ...bankAdjustmentForm, amount: e.target.value })}
                    placeholder="0.00"
                    className="w-full pl-8 pr-4 py-2.5 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:border-red-500"
                  />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowBankAdjustmentForm(false)}
                  className="flex-1 px-4 py-2.5 border border-zinc-300 rounded-lg text-zinc-700 text-sm font-bold hover:bg-zinc-50 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    handleAddBankAdjustment()
                    setShowBankAdjustmentForm(false)
                    setBankAdjustmentForm({ type: '', description: '', amount: '' })
                    triggerToast('Bank adjustment added successfully')
                  }}
                  className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg text-sm font-bold hover:bg-red-700 transition"
                >
                  Add Adjustment
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: BOOK ADJUSTMENT FORM */}
      {showBookAdjustmentForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
            <div className="px-6 py-4 bg-zinc-900 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Plus className="text-red-400" size={20} />
                <div>
                  <h3 className="text-white font-black text-lg">Add Book Adjustment</h3>
                  <p className="text-zinc-400 text-xs">Add manual adjustment to general ledger</p>
                </div>
              </div>
              <button
                onClick={() => setShowBookAdjustmentForm(false)}
                className="text-zinc-400 hover:text-white transition"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-2">Book Side - Adjustment Type</label>
                <select
                  value={bookAdjustmentForm.type}
                  onChange={(e) => setBookAdjustmentForm({ ...bookAdjustmentForm, type: e.target.value })}
                  className="w-full px-4 py-2.5 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:border-red-500"
                >
                  <option value="">Select type...</option>
                  <option value="interest_earned">Interest Earned (add)</option>
                  <option value="bank_credit_memo">Bank Credit Memo / EFT (add)</option>
                  <option value="service_fees">Bank Service Fee (less)</option>
                  <option value="nsf_fees">NSF / Bounced Check (less)</option>
                  <option value="bank_debit_memo">Bank Debit Memo (less)</option>
                  <option value="error_book">Book Error / Correction (add/less)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-2">Description</label>
                <input
                  type="text"
                  value={bookAdjustmentForm.description}
                  onChange={(e) => setBookAdjustmentForm({ ...bookAdjustmentForm, description: e.target.value })}
                  placeholder="Enter description..."
                  className="w-full px-4 py-2.5 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:border-red-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-2">Amount</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-sm">₱</span>
                  <input
                    type="number"
                    step="0.01"
                    value={bookAdjustmentForm.amount}
                    onChange={(e) => setBookAdjustmentForm({ ...bookAdjustmentForm, amount: e.target.value })}
                    placeholder="0.00"
                    className="w-full pl-8 pr-4 py-2.5 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:border-red-500"
                  />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowBookAdjustmentForm(false)}
                  className="flex-1 px-4 py-2.5 border border-zinc-300 rounded-lg text-zinc-700 text-sm font-bold hover:bg-zinc-50 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    handleAddBookAdjustment()
                    setShowBookAdjustmentForm(false)
                    setBookAdjustmentForm({ type: '', description: '', amount: '' })
                    triggerToast('Book adjustment added successfully')
                  }}
                  className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg text-sm font-bold hover:bg-red-700 transition"
                >
                  Add Adjustment
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showToast && (
        <DynamicToast
          message={toastMessage?.text || toastMessage || ''}
          type={toastMessage?.type || toastType}
          onClose={() => setShowToast(false)}
        />
      )}
    </div>
  )
}
