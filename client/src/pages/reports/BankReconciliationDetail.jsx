import React, { useState, useMemo } from 'react'
// eslint-disable-next-line no-unused-vars
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Edit,
  Edit2,
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
  Link2,
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
  const [showToastState, setShowToastState] = useState(false)
  const [toastMessage, setToastMessage] = useState('')
  const [toastType, setToastType] = useState('success')

  const showToast = (msg, type = 'success') => {
    if (typeof msg === 'object') {
      setToastMessage(msg.text || '')
      setToastType(msg.type || 'success')
    } else {
      setToastMessage(msg)
      setToastType(type)
    }
    setShowToastState(true)
    setTimeout(() => setShowToastState(false), 3500)
  }

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
    bankSectionFilter,
    setBankSectionFilter,
    editingBankBalance,
    setEditingBankBalance,
    bankBalanceInput,
    setBankBalanceInput,
    reconciliationMethod,
    setReconciliationMethod,
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
    matchedBankAmount,
    unmatchedBankAmount,
    matchedGLAmount,
    unmatchedGLAmount,
    bankErrors,
    bankStatementEndingBalance,
    adjustedBankBalance,
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
    suggestedAdjustments,
    setSuggestedAdjustments,
    generateSuggestedAdjustments,
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
    // Matching functions
    handleCreateMatch,
    handleDeleteMatch,
    fetchMatches,
  } = useBankReconciliation(selectedReconciliation)

  // Helper function to check if bank item and GL entry have opposite debit/credit directions
  const isValidDebitCreditMatch = (bankItem, glEntry) => {
    const bankDebit = parseFloat(bankItem.bri_debit || bankItem.debit || 0) || 0
    const bankCredit = parseFloat(bankItem.bri_credit || bankItem.credit || 0) || 0
    const bankAmount = parseFloat(bankItem.amount || 0) || 0
    const glType = (glEntry.type || '').toUpperCase()
    const glAmount = parseFloat(glEntry.amount || 0) || 0
    
    console.log('isValidDebitCreditMatch detailed:', {
      bankItem: { 
        id: bankItem.id, 
        description: bankItem.description,
        debit: bankDebit, 
        credit: bankCredit,
        amount: bankAmount,
        bri_debit: bankItem.bri_debit,
        bri_credit: bankItem.bri_credit
      },
      glEntry: { 
        id: glEntry.id, 
        db_name: glEntry.db_name,
        type: glType, 
        amount: glAmount,
        check_number: glEntry.check_number,
        debit: glEntry.debit,
        credit: glEntry.credit
      }
    })
    
    // Determine bank item direction from debit/credit fields first, then amount
    let bankIsCredit = false
    let bankIsDebit = false
    
    if (bankCredit > 0 && bankDebit === 0) {
      bankIsCredit = true
    } else if (bankDebit > 0 && bankCredit === 0) {
      bankIsDebit = true
    } else if (bankAmount !== 0) {
      // If no debit/credit fields, use amount sign
      bankIsCredit = bankAmount > 0
      bankIsDebit = bankAmount < 0
    }
    
    // GL entry direction from type field
    const glIsDebit = glType === 'DEBIT'
    const glIsCredit = glType === 'CREDIT'
    
    const isValid = (bankIsCredit && glIsDebit) || (bankIsDebit && glIsCredit)
    console.log('isValidDebitCreditMatch result:', { bankIsCredit, glIsDebit, bankIsDebit, glIsCredit, isValid })
    
    // Valid if: bank credit (positive amount/deposit) + GL debit (receipt) OR bank debit (negative amount/withdrawal) + GL credit (payment)
    return isValid
  }

  // Helper function to check reference/check number match
  const hasMatchingReference = (bankItem, glEntry) => {
    const bankRef = (bankItem.reference_number || bankItem.bri_reference_number || '').toLowerCase()
    const glRef = (glEntry.check_number || glEntry.document_reference || '').toLowerCase()
    return bankRef && glRef && bankRef === glRef
  }

  // Check if current selections have valid debit/credit matching
  const isSelectionValidForMatching = useMemo(() => {
    if (selectedStmtIds.length === 0 || selectedBookIds.length === 0) return false
    
    const ledgerId = selectedBookIds[0]
    const glEntry = journalEntries.find(entry => entry.id === ledgerId)
    
    if (!glEntry) {
      console.log('isSelectionValidForMatching: No GL entry found for ledgerId', ledgerId)
      return false
    }
    
    console.log('isSelectionValidForMatching check:', { selectedStmtIds, selectedBookIds, glEntry })
    
    // Check all selected bank items against the GL entry
    for (const bankItemId of selectedStmtIds) {
      const bankItem = items.find(item => item.id === bankItemId)
      console.log('Bank item validation:', { bankItemId, bankItem, found: !!bankItem })
      if (!bankItem) {
        console.log('Bank item not found')
        return false
      }
      const isValid = isValidDebitCreditMatch(bankItem, glEntry)
      console.log('Bank item validation result:', { bankItemId, isValid })
      if (!isValid) {
        return false
      }
    }
    
    console.log('isSelectionValidForMatching: returning true')
    return true
  }, [selectedStmtIds, selectedBookIds, items, journalEntries])

  // Generate consistent color for match groups based on ledger_id
  const getMatchColor = (ledgerId) => {
    if (!ledgerId) return null
    const colors = [
      'bg-red-500', 'bg-blue-500', 'bg-green-500', 'bg-yellow-500', 
      'bg-purple-500', 'bg-pink-500', 'bg-indigo-500', 'bg-teal-500',
      'bg-orange-500', 'bg-cyan-500', 'bg-lime-500', 'bg-rose-500'
    ]
    const hash = ledgerId.toString().split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
    return colors[hash % colors.length]
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
      // Use absolute amount for matching comparison
      return sum + (item ? Math.abs(getItemAmount(item)) : 0)
    }, 0)
  }, [selectedStmtIds, items])

  const selectedBookTotal = useMemo(() => {
    return selectedBookIds.reduce((sum, id) => {
      const item = journalEntries.find(i => i.id === id)
      // Use absolute amount for matching comparison
      return sum + (item ? Math.abs(parseFloat(item.amount) || 0) : 0)
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

  // Auto-match function with proper accounting rules
  const handleAutoMatch = async () => {
    let matchCount = 0
    const unmatchedStmts = items.filter(i => i.ledger_id === null || i.ledger_id === undefined)
    const unmatchedBooks = journalEntries.filter(entry => !items.some(item => item.ledger_id === entry.id))

    console.log('Auto-match starting:', { unmatchedStmtsCount: unmatchedStmts.length, unmatchedBooksCount: unmatchedBooks.length })

    // Collect all matches first, then execute them
    const matchesToMake = []

    // First try reference number matching (highest priority)
    // Must also have matching or reasonably close amounts (using absolute values)
    // Iterate in reverse to safely splice during iteration
    for (let i = unmatchedStmts.length - 1; i >= 0; i--) {
      const stmt = unmatchedStmts[i]
      const stmtAmount = Math.abs(getItemAmount(stmt))
      const matchingBook = unmatchedBooks.find(
        b => hasMatchingReference(stmt, b) && 
             isValidDebitCreditMatch(stmt, b) &&
             Math.abs(Math.abs(parseFloat(b.amount) || 0) - stmtAmount) < 0.01
      )

      if (matchingBook) {
        matchesToMake.push({ stmtId: stmt.id, bookId: matchingBook.id, type: 'reference' })
        unmatchedStmts.splice(i, 1)
        const bookIndex = unmatchedBooks.indexOf(matchingBook)
        if (bookIndex > -1) unmatchedBooks.splice(bookIndex, 1)
      }
    }

    console.log('After reference matching:', { matchesFound: matchesToMake.length, remainingStmts: unmatchedStmts.length, remainingBooks: unmatchedBooks.length })

    // Then try exact amount matching with opposite debit/credit directions
    // Compare absolute amounts for matching
    // Iterate in reverse to safely splice during iteration
    for (let i = unmatchedStmts.length - 1; i >= 0; i--) {
      const stmt = unmatchedStmts[i]
      const stmtAmount = Math.abs(getItemAmount(stmt))
      console.log('Checking bank item for amount match:', { 
        stmtId: stmt.id, 
        stmtAmount, 
        stmtDescription: stmt.description 
      })
      
      const matchingBook = unmatchedBooks.find(
        b => {
          const bookAmount = Math.abs(parseFloat(b.amount) || 0)
          const amountMatch = Math.abs(bookAmount - stmtAmount) < 0.01
          const debitCreditMatch = isValidDebitCreditMatch(stmt, b)
          console.log('  Checking GL entry:', { 
            bookId: b.id, 
            bookAmount, 
            amountMatch, 
            debitCreditMatch,
            bookDescription: b.description 
          })
          return amountMatch && debitCreditMatch
        }
      )

      if (matchingBook) {
        matchesToMake.push({ stmtId: stmt.id, bookId: matchingBook.id, type: 'amount' })
        unmatchedStmts.splice(i, 1)
        const bookIndex = unmatchedBooks.indexOf(matchingBook)
        if (bookIndex > -1) unmatchedBooks.splice(bookIndex, 1)
        console.log('  Match found and added:', { stmtId: stmt.id, bookId: matchingBook.id })
      } else {
        console.log('  No match found for bank item:', stmt.id)
      }
    }

    console.log('After amount matching:', { totalMatches: matchesToMake.length, matches: matchesToMake })

    // Execute all matches (skip refresh during bulk matching)
    for (const match of matchesToMake) {
      await handleMatchBankToLedger(match.stmtId, match.bookId, null, true)
      matchCount++
    }

    // Many-to-one matching disabled to prevent false matches
    // Only exact 1-to-1 matches by reference or amount are allowed

    // Refresh data after matching
    await fetchReconciliationItems()

    if (matchCount > 0) {
      showToast({ type: 'success', text: `⚡ Smart Auto-Match created ${matchCount} new transaction pair matches!` })
    } else {
      showToast({ type: 'info', text: 'No eligible auto-matches found based on reference, amount, and debit/credit rules.' })
    }
  }

  // Manual match execution
  const handleMatchSelected = async () => {
    if (selectedStmtIds.length === 0 || selectedBookIds.length === 0) {
      showToast({ type: 'error', text: 'Please select at least one item from Bank Statement and one from Book Ledger' })
      return
    }

    // Validate debit/credit matching rules for all selected items
    const ledgerId = selectedBookIds[0]
    const glEntry = journalEntries.find(entry => entry.id === ledgerId)
    
    for (let i = 0; i < selectedStmtIds.length; i++) {
      const bankItemId = selectedStmtIds[i]
      const bankItem = items.find(item => item.id === bankItemId)
      
      if (bankItem && glEntry && !isValidDebitCreditMatch(bankItem, glEntry)) {
        showToast({ 
          type: 'error', 
          text: 'Invalid match: Bank deposits (credits) must match GL receipts (debits). Bank withdrawals (debits) must match GL payments (credits).' 
        })
        return
      }
    }

    // Allow partial matching - don't require exact balance
    // But warn if there's a significant variance
    if (Math.abs(selectedDifference) > 0.01) {
      showToast({ type: 'warning', text: `Partial match: variance of ₱${selectedDifference.toFixed(2)} will remain as Deposits in Transit` })
    }

    // Match bank items to ledger items (supports many-to-one and partial matching)
    for (let i = 0; i < selectedStmtIds.length; i++) {
      const bankItemId = selectedStmtIds[i]
      const bankItem = items.find(item => item.id === bankItemId)
      if (bankItemId && ledgerId && bankItem) {
        // Get the actual amount being matched for this bank item
        const matchedAmount = getItemAmount(bankItem)
        await handleMatchBankToLedger(bankItemId, ledgerId, matchedAmount)
      }
    }

    // Refresh data after matching to ensure calculations are updated
    await fetchReconciliationItems()
    await fetchJournalEntries()

    setSelectedStmtIds([])
    setSelectedBookIds([])
    showToast({ type: 'success', text: `Successfully matched ${selectedStmtIds.length} items!` })
  }

  // Unmatch a specific item
  const handleUnmatch = async (bankItemId) => {
    if (!bankItemId) return
    await handleUnmatchBankFromLedger(bankItemId)
    // Refresh data after unmatching to ensure calculations are updated
    await fetchReconciliationItems()
    await fetchJournalEntries()
    showToast({ type: 'success', text: 'Transaction link removed. Item returned to unmatched status.' })
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
    showToast({ type: 'success', text: 'GL Adjustment entry posted and reconciled successfully!' })
  }

  // Calculate reconcile percentage
  const totalItemsCount = items.length + journalEntries.length
  const matchedBankItems = items.filter(i => i.ledger_id !== null && i.ledger_id !== undefined).length
  const matchedBookItems = journalEntries.filter(entry => items.some(item => item.ledger_id === entry.id)).length
  const matchedItemsCount = matchedBankItems + matchedBookItems
  const reconcilePercentage = totalItemsCount > 0 ? Math.round((matchedItemsCount / totalItemsCount) * 100) : 100

  // Note: unrecordedBankCredits and unrecordedBankDebits are now calculated in useBankReconciliation.js
  // as bookAdditions and bookDeductions from unmatched bank statement items

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
      showToast({ type: 'success', text: `Imported ${parsedRows.length} OCR row(s).` })
    } catch (error) {
      console.error('[OCR] error:', error)
      setOcrError(error?.message || 'Failed to import OCR rows.')
      showToast({ type: 'error', text: error?.message || 'Failed to import OCR rows.' })
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


      {/* Main Workspace Container */}
      <main className="max-w-[1700px] mx-auto ">
        
        {/* Month Filter */}
        <div className="bg-white border border-gray-100 rounded-2xl px-4 py-3 mb-4 flex items-center justify-between gap-3 flex-wrap shadow-sm">
          <div className="flex items-center gap-3">
            <button
              onClick={() => onBack?.()}
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
              ) : (
                <>
                  <select
                    value={availableMonths.some(m => m.start_date === detailStartDate && m.end_date === detailEndDate)
                      ? `${detailStartDate}|${detailEndDate}`
                      : 'new_period'}
                    onChange={(e) => {
                      if (e.target.value === 'new_period') {
                        // Set to next month for new period
                        const currentEndDate = new Date(detailEndDate)
                        const nextMonthStart = new Date(currentEndDate.getFullYear(), currentEndDate.getMonth() + 1, 1)
                        const nextMonthEnd = new Date(currentEndDate.getFullYear(), currentEndDate.getMonth() + 2, 0)
                        const nextMonthStartStr = nextMonthStart.toISOString().split('T')[0]
                        const nextMonthEndStr = nextMonthEnd.toISOString().split('T')[0]
                        setDetailStartDate(nextMonthStartStr)
                        setDetailEndDate(nextMonthEndStr)
                      } else {
                        const selected = availableMonths.find(
                          (m) => `${m.start_date}|${m.end_date}` === e.target.value,
                        )
                        if (selected) {
                          setDetailStartDate(selected.start_date)
                          setDetailEndDate(selected.end_date)
                        }
                      }
                    }}
                    className="px-3 py-2 border border-gray-100 rounded-xl bg-white text-sm font-bold text-black outline-none focus:border-blue-500 focus:bg-blue-50 transition-all cursor-pointer"
                  >
                    <option value="new_period" className="text-blue-600 font-bold">
                      + New Period
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
              className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-md transition"
            >
              <Lock size={14} />
              Finalize Period
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

                {/* Reconciliation Method Selector */}
                <div className="lg:col-span-12 flex items-center justify-between mb-2">
                  <span className="text-xs font-mono font-bold text-zinc-500 uppercase tracking-wider">
                    RECONCILIATION METHOD
                  </span>
                  <select
                    value={reconciliationMethod}
                    onChange={(e) => setReconciliationMethod(e.target.value)}
                    className="px-3 py-1.5 text-xs font-bold border border-zinc-300 rounded-lg bg-white focus:outline-none focus:border-red-500"
                  >
                    <option value="adjusted_balance">Adjusted Balance Method</option>
                    <option value="bank_to_book">Bank-to-Book Method</option>
                    <option value="book_to_bank">Book-to-Bank Method</option>
                  </select>
                </div>

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
                    {reconciliationMethod === 'adjusted_balance' || reconciliationMethod === 'bank_to_book' ? (
                      <>
                        <div className="flex justify-between py-1 border-b border-zinc-200/60 items-center">
                          <span className="text-zinc-600">Ending Statement Balance</span>
                          {editingBankBalance ? (
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                value={bankBalanceInput}
                                onChange={(e) => setBankBalanceInput(e.target.value)}
                                className="w-24 px-2 py-1 text-right border border-zinc-300 rounded text-xs font-mono"
                                placeholder="0.00"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    handleUpdateBankStatementBalance()
                                  } else if (e.key === 'Escape') {
                                    setEditingBankBalance(false)
                                    setBankBalanceInput('')
                                  }
                                }}
                              />
                              <button
                                onClick={handleUpdateBankStatementBalance}
                                className="text-emerald-600 hover:text-emerald-700 font-bold text-xs"
                              >
                                ✓
                              </button>
                              <button
                                onClick={() => {
                                  setEditingBankBalance(false)
                                  setBankBalanceInput('')
                                }}
                                className="text-red-600 hover:text-red-700 font-bold text-xs"
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-zinc-900">₱{fmt(bankStatementEndingBalance)}</span>
                              <button
                                onClick={() => {
                                  setBankBalanceInput(bankStatementEndingBalance.toString())
                                  setEditingBankBalance(true)
                                }}
                                className="text-zinc-400 hover:text-zinc-600"
                                title="Edit bank statement balance"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                        </div>
                        <div className="flex justify-between py-1 border-b border-zinc-200/60 text-emerald-700">
                          <span>(+) Deposits in Transit</span>
                          <span className="font-bold">+₱{fmt(depositsInTransit)}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-zinc-200/60 text-red-600">
                          <span>(-) Outstanding Checks</span>
                          <span className="font-bold">-₱{fmt(outstandingChecks)}</span>
                        </div>
                      </>
                    ) : (
                      <div className="flex justify-between py-1 border-b border-zinc-200/60 text-zinc-500 italic">
                        <span>Starting from Book Balance</span>
                        <span>→</span>
                      </div>
                    )}

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

                    {/* Suggested Adjustments from Partial Matching */}
                    {suggestedAdjustments.length > 0 && (
                      <div className="mt-3 pt-2 border-t border-zinc-200/60">
                        <div className="text-[10px] font-bold text-amber-600 uppercase tracking-wider mb-2 flex items-center gap-1">
                          <Zap className="w-3 h-3" />
                          Suggested Adjustments
                        </div>
                        {suggestedAdjustments.map((adj) => (
                          <div key={adj.id} className="flex justify-between items-center py-1 text-zinc-600 bg-amber-50 px-2 rounded mb-1">
                            <span className="text-xs">
                              {adj.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} - {adj.description}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-amber-700">
                                ₱{fmt(adj.amount)}
                              </span>
                              <button
                                onClick={() => {
                                  handleAddBankAdjustment(adj.type, adj.description, adj.amount)
                                  setSuggestedAdjustments(suggestedAdjustments.filter(a => a.id !== adj.id))
                                }}
                                className="text-xs font-bold text-amber-600 hover:text-amber-800 bg-amber-100 px-2 py-0.5 rounded"
                              >
                                Accept
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Add Bank Adjustment Button */}
                    <button
                      onClick={() => {
                        generateSuggestedAdjustments()
                        setShowBankAdjustmentForm(true)
                      }}
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
                      <div className="flex flex-col items-center space-y-1">
                        <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-red-500/20 text-red-300 border border-red-500/30">
                          <AlertCircle className="w-3 h-3" />
                          <span>DISCREPANCY</span>
                        </span>
                        <span className="text-[9px] text-zinc-400 font-mono">
                          {adjustedBankBalance > adjustedBookBalance
                            ? `Bank ahead by ₱${fmt(adjustedBankBalance - adjustedBookBalance)}`
                            : `Book ahead by ₱${fmt(adjustedBookBalance - adjustedBankBalance)}`}
                        </span>
                      </div>
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
                    {reconciliationMethod === 'adjusted_balance' || reconciliationMethod === 'book_to_bank' ? (
                      <>
                        <div className="flex justify-between py-1 border-b border-zinc-200/60">
                          <span className="text-zinc-600">Ending Book GL Balance</span>
                          <span className="font-bold text-zinc-900">₱{fmt(endingBookBalance)}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-zinc-200/60 text-emerald-700">
                          <span>(+) Unrecorded Bank Credits</span>
                          <span className="font-bold">+₱{fmt(bookAdditions)}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-zinc-200/60 text-red-600">
                          <span>(-) Unrecorded Bank Charges</span>
                          <span className="font-bold">-₱{fmt(bookDeductions)}</span>
                        </div>
                      </>
                    ) : (
                      <div className="flex justify-between py-1 border-b border-zinc-200/60 text-zinc-500 italic">
                        <span>Target: Ending Book GL Balance</span>
                        <span>→</span>
                      </div>
                    )}

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
                      disabled={Math.abs(selectedDifference) > 0.01 || !isSelectionValidForMatching}
                      className={`px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-md ${Math.abs(selectedDifference) === 0 && isSelectionValidForMatching
                          ? 'bg-emerald-500 hover:bg-emerald-600 text-white cursor-pointer'
                          : 'bg-zinc-700 text-zinc-400 cursor-not-allowed opacity-60'
                        }`}
                      title={!isSelectionValidForMatching ? 'Invalid match: Bank deposits (credits) must match GL receipts (debits). Bank withdrawals (debits) must match GL payments (credits).' : ''}
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
                      const debit = parseFloat(item.bri_debit || item.debit || 0) || 0;
                      const credit = parseFloat(item.bri_credit || item.credit || 0) || 0;
                      const isCredit = credit > 0 && debit === 0;
                      const isDebit = debit > 0 && credit === 0;
                      const isMatched = item.ledger_id !== null && item.ledger_id !== undefined;
                      const displayDate = item.date || item.bri_date ? formatLocalDate(new Date(item.date || item.bri_date)) : '-';
                      
                      // Find the matched GL entry
                      const matchedGLEntry = isMatched ? journalEntries.find(entry => entry.id === item.ledger_id) : null;
                      // Get match color based on ledger_id
                      const matchColor = getMatchColor(item.ledger_id);

                      return (
                        <div
                          key={item.id}
                          onClick={() => !isMatched && toggleSelectStmt(item.id)}
                          className={`p-3.5 flex items-center justify-between text-xs transition-colors cursor-pointer ${isMatched
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
                                onClick={(e) => {
                                  e.stopPropagation()
                                  toggleSelectStmt(item.id)
                                }}
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
                                <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold ${isCredit ? 'bg-emerald-100 text-emerald-700' : isDebit ? 'bg-red-100 text-red-700' : 'bg-zinc-100 text-zinc-600'}`}>
                                  {isCredit ? 'CREDIT' : isDebit ? 'DEBIT' : 'N/A'}
                                </span>
                              </div>
                              <div className="text-[10px] text-zinc-500 font-mono mt-0.5 flex items-center space-x-2">
                                <span>{displayDate}</span>
                                <span>•</span>
                                <span>Ref: {item.reference_number || item.bri_reference_number || '-'}</span>
                              </div>
                              {isMatched && matchedGLEntry && (
                                <div className="text-[9px] text-emerald-600 font-mono mt-1 flex items-center space-x-1">
                                  <Link2 className="w-3 h-3" />
                                  <span>→ GL: {matchedGLEntry.check_number || matchedGLEntry.document_reference || `ID ${matchedGLEntry.id}`} (₱{fmt(Math.abs(parseFloat(matchedGLEntry.amount) || 0))})</span>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="text-right flex items-center space-x-3">
                            <div>
                              <div className={`font-mono font-bold ${isCredit ? 'text-emerald-600' : 'text-zinc-900'}`}>
                                {isCredit ? '+' : isDebit ? '-' : ''}₱{fmt(Math.abs(amount))}
                              </div>
                              <div className="text-[10px]">
                                {isMatched ? (
                                  <span className="text-emerald-700 font-bold font-mono">MATCHED</span>
                                ) : (
                                  <span className="text-amber-600 font-bold font-mono">UNMATCHED</span>
                                )}
                              </div>
                              {/* Color indicator for matched items */}
                              {isMatched && matchColor && (
                                <div className={`h-1.5 w-16 rounded-full ${matchColor} mt-1`} />
                              )}
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
                      // GL entries use type field (DEBIT/CREDIT) and amount field
                      const amount = parseFloat(entry.amount) || 0;
                      const entryType = (entry.type || '').toUpperCase();
                      const isMatched = items.some(item => item.ledger_id === entry.id);
                      const checkRef = entry.check_number || entry.document_reference || '-';
                      const payeeMemo = [entry.payee_name, entry.responsibility_center].filter(Boolean).join(' - ') || entry.description || 'No description';
                      const displayDate = entry.date ? formatLocalDate(new Date(entry.date)) : '-';

                      // Determine if this is an inflow or outflow based on type field (DEBIT/CREDIT)
                      const dbType = (entry.db_name || entry.category || '').toLowerCase();
                      // DEBIT entries are inflows (receipts), CREDIT entries are outflows (contra-accounts/adjustments)
                      const isInflow = entryType === 'DEBIT' || ((dbType.includes('receipt') || dbType.includes('collection')) && entryType !== 'CREDIT');
                      const isOutflow = entryType === 'CREDIT' || dbType.includes('payment') || dbType.includes('disbursement');
                      
                      // Find all matched bank items for this GL entry
                      const matchedBankItems = isMatched ? items.filter(item => item.ledger_id === entry.id) : [];
                      // Get match color based on entry.id (which is the ledger_id for bank items)
                      const matchColor = getMatchColor(entry.id);

                      return (
                        <div
                          key={entry.id}
                          onClick={() => !isMatched && toggleSelectBook(entry.id)}
                          className={`p-3.5 flex items-center justify-between text-xs transition-colors cursor-pointer ${isMatched
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
                                onClick={(e) => {
                                  e.stopPropagation()
                                  toggleSelectBook(entry.id)
                                }}
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
                                <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold ${entryType === 'DEBIT' ? 'bg-emerald-100 text-emerald-700' : entryType === 'CREDIT' ? 'bg-red-100 text-red-700' : 'bg-zinc-100 text-zinc-600'}`}>
                                  {entryType || 'N/A'}
                                </span>
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-100 text-zinc-600 border border-zinc-200">
                                  {entry.db_name || entry.category || 'General'}
                                </span>
                              </div>
                              <div className="text-[10px] text-zinc-500 font-mono mt-0.5 flex items-center space-x-2">
                                <span>{entry.date}</span>
                                <span>•</span>
                                <span>Chk #: {checkRef}</span>
                              </div>
                              {isMatched && matchedBankItems.length > 0 && (
                                <div className="text-[9px] text-emerald-600 font-mono mt-1 flex flex-col space-y-0.5">
                                  {matchedBankItems.map(bankItem => (
                                    <div key={bankItem.id} className="flex items-center space-x-1">
                                      <Link2 className="w-3 h-3" />
                                      <span>→ Bank: {bankItem.reference_number || bankItem.bri_reference_number || `ID ${bankItem.id}`} (₱{fmt(Math.abs(getItemAmount(bankItem)))})</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="text-right flex items-center space-x-3">
                            <div>
                              <div className={`font-mono font-bold ${isInflow ? 'text-emerald-600' : 'text-zinc-900'}`}>
                                {isInflow ? '+' : isOutflow ? '-' : ''}₱{fmt(Math.abs(amount))}
                              </div>
                              <div className="text-[10px]">
                                {isMatched ? (
                                  <span className="text-emerald-700 font-bold font-mono">MATCHED</span>
                                ) : (
                                  <span className="text-zinc-500 font-bold font-mono">
                                    {isInflow ? 'DEP IN TRANSIT' : isOutflow ? 'OUTSTANDING CHK' : 'CREDIT ADJUSTMENT'}
                                  </span>
                                )}
                              </div>
                              {/* Color indicator for matched items */}
                              {isMatched && matchColor && (
                                <div className={`h-1.5 w-16 rounded-full ${matchColor} mt-1`} />
                              )}
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
                      const debit = parseFloat(i.bri_debit || i.debit || 0) || 0
                      const credit = parseFloat(i.bri_credit || i.credit || 0) || 0
                      // Determine type based on actual debit/credit fields from DB
                      const isCredit = credit > 0 && debit === 0
                      const isDebit = debit > 0 && credit === 0
                      const displayDate = i.date || i.bri_date ? formatLocalDate(new Date(i.date || i.bri_date)) : '-'
                      return (
                        <tr key={i.id} className="hover:bg-zinc-50">
                          <td className="p-3">{displayDate}</td>
                          <td className="p-3 font-semibold text-zinc-600">{i.reference_number || i.bri_reference_number || '-'}</td>
                          <td className="p-3 font-sans font-medium text-zinc-900">{i.description || i.bri_description || i.details || 'No description'}</td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${isCredit ? 'bg-emerald-100 text-emerald-800' : 'bg-zinc-100 text-zinc-700'}`}>
                              {isCredit ? 'CR' : isDebit ? 'DR' : '-'}
                            </span>
                          </td>
                          <td className={`p-3 text-right font-bold ${isCredit ? 'text-emerald-600' : 'text-zinc-900'}`}>
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
                    <span>+₱{fmt(bookAdditions)}</span>
                  </div>
                  <div className="flex justify-between text-red-600">
                    <span>Less: Unrecorded Service Charges / Debits</span>
                    <span>-₱{fmt(bookDeductions)}</span>
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
                    showToast({ type: 'success', text: 'Bank adjustment added successfully' })
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
                    showToast({ type: 'success', text: 'Book adjustment added successfully' })
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

      {showToastState && (
        <DynamicToast
          message={toastMessage?.text || toastMessage || ''}
          type={toastMessage?.type || toastType}
          onClose={() => setShowToastState(false)}
        />
      )}
    </div>
  )
}
