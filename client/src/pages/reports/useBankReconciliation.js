import { useState, useEffect } from 'react'

export const formatLocalDate = (d) => {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const getCurrentMonthRange = () => {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  return [formatLocalDate(start), formatLocalDate(end)]
}

const getNextMonthRange = (currentEndDate) => {
  const endDate = new Date(currentEndDate)
  const nextMonthStart = new Date(endDate.getFullYear(), endDate.getMonth() + 1, 1)
  const nextMonthEnd = new Date(endDate.getFullYear(), endDate.getMonth() + 2, 0)
  return [formatLocalDate(nextMonthStart), formatLocalDate(nextMonthEnd)]
}

const addDays = (dateString, days) => {
  const date = new Date(dateString)
  date.setDate(date.getDate() + days)
  return formatLocalDate(date)
}

const isDateWithinRange = (dateString, startDate, endDate) => {
  const date = new Date(dateString)
  const start = new Date(startDate)
  const end = new Date(endDate)
  return date >= start && date <= end
}

const BANK_SECTION_ITEMS = [
  {
    value: 'deposits_in_transit',

    label: 'Deposit in Transit',

    effect: 'add',

    description: 'Cash deposited but not yet reflected on the bank statement',

    color: 'text-emerald-700',

    bg: 'bg-emerald-50',

    badge: 'bg-emerald-100 text-emerald-700',

    borderColor: 'border-emerald-200',
  },

  {
    value: 'outstanding_checks',

    label: 'Outstanding Check',

    effect: 'deduct',

    description:
      'Checks issued and recorded in the books but not yet cleared the bank',

    color: 'text-rose-700',

    bg: 'bg-rose-50',

    badge: 'bg-rose-100 text-rose-700',

    borderColor: 'border-rose-200',
  },

  {
    value: 'error_bank',

    label: 'Bank Error',

    effect: 'adjustment',

    description:
      'An error made by the bank that requires correction on the bank side',

    color: 'text-amber-700',

    bg: 'bg-amber-50',

    badge: 'bg-amber-100 text-amber-700',

    borderColor: 'border-amber-200',
  },
]

const BOOK_SECTION_ITEMS = [
  {
    value: 'interest_income',

    label: 'Interest Earned',

    effect: 'add',

    description: 'Interest credited by bank, not yet recorded in the books',

    color: 'text-emerald-700',

    bg: 'bg-emerald-50',

    badge: 'bg-emerald-100 text-emerald-700',

    borderColor: 'border-emerald-200',
  },

  {
    value: 'credit_memo',

    label: 'Bank Credit Memo',

    effect: 'add',

    description: 'EFT collection or other credit noted by bank, not yet in GL',

    color: 'text-emerald-700',

    bg: 'bg-emerald-50',

    badge: 'bg-emerald-100 text-emerald-700',

    borderColor: 'border-emerald-200',
  },

  {
    value: 'bank_charges',

    label: 'Bank Service Fee',

    effect: 'deduct',

    description: 'Monthly service charge or fee deducted by the bank, not yet in GL',

    color: 'text-rose-700',

    bg: 'bg-rose-50',

    badge: 'bg-rose-100 text-rose-700',

    borderColor: 'border-rose-200',
  },

  {
    value: 'nsf_checks',

    label: 'NSF / Bounced Check',

    effect: 'deduct',

    description:
      'A customer check deposited that was returned due to insufficient funds',

    color: 'text-rose-700',

    bg: 'bg-rose-50',

    badge: 'bg-rose-100 text-rose-700',

    borderColor: 'border-rose-200',
  },

  {
    value: 'debit_memo',

    label: 'Bank Debit Memo',

    effect: 'deduct',

    description: 'A bank-initiated debit not yet recorded in the books',

    color: 'text-rose-700',

    bg: 'bg-rose-50',

    badge: 'bg-rose-100 text-rose-700',

    borderColor: 'border-rose-200',
  },

  {
    value: 'error_book',

    label: 'Book Error / Correction',

    effect: 'adjustment',

    description: 'A recording error in the GL that must be corrected',

    color: 'text-amber-700',

    bg: 'bg-amber-50',

    badge: 'bg-amber-100 text-amber-700',

    borderColor: 'border-amber-200',
  },
]

const ALL_ITEM_TYPES = [...BANK_SECTION_ITEMS, ...BOOK_SECTION_ITEMS]

const normalizeItemValue = (val) =>
  String(val || '')
    .trim()
    .toLowerCase()

const DEMO_RECONCILIATION = {
  bank_statement_balance: 40320.0,

  running_balance: 40320.0,
}

const DEMO_RECONCILIATION_ITEMS = [
  {
    id: 'demo-1',

    date: '2026-05-16',

    section: 'BOOK',

    details: 'interest_income',

    debit: 100.0,

    credit: 0,
  },

  {
    id: 'demo-2',

    date: '2026-05-19',

    section: 'BOOK',

    details: 'credit_memo',

    debit: 1000.0,

    credit: 0,
  },

  {
    id: 'demo-3',

    date: '2026-05-19',

    section: 'BOOK',

    details: 'bank_charges',

    debit: 0,

    credit: 100.0,
  },

  {
    id: 'demo-4',

    date: '2026-05-20',

    section: 'BANK',

    details: 'deposits_in_transit',

    debit: 2000.0,

    credit: 0,
  },

  {
    id: 'demo-5',

    date: '2026-05-20',

    section: 'BANK',

    details: 'outstanding_checks',

    debit: 0,

    credit: 1000.0,
  },
]

const DEMO_MODE =
  import.meta.env.DEV && import.meta.env.VITE_BANK_RECONCILIATION_DEMO === 'true'
export const getItemMeta = (val) => {
  const normalized = normalizeItemValue(val)
  const found = ALL_ITEM_TYPES.find(
    (t) =>
      normalizeItemValue(t.value) === normalized ||
      normalizeItemValue(t.label) === normalized,
  )

  if (found) return found

  // Fallback: return a meta object that preserves the original DB value
  const raw = String(val || '')
  const pretty = raw
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/(^|\s)\S/g, (s) => s.toUpperCase())

  return {
    value: raw,
    label: pretty || 'Unknown',
    effect: 'adjustment',
    badge: 'bg-gray-100 text-gray-700',
  }
}

export const isBankSectionItem = (val) => {
  const normalized = normalizeItemValue(val)
  return BANK_SECTION_ITEMS.some(
    (t) =>
      normalizeItemValue(t.value) === normalized ||
      normalizeItemValue(t.label) === normalized,
  )
}

export const isBookSectionItem = (val) => {
  const normalized = normalizeItemValue(val)
  return BOOK_SECTION_ITEMS.some(
    (t) =>
      normalizeItemValue(t.value) === normalized ||
      normalizeItemValue(t.label) === normalized,
  )
}

export const getItemSection = (item) => {
  const detailsValue = item.bri_details || item.details || item.item_type

  if (isBankSectionItem(detailsValue)) return 'BANK'

  if (isBookSectionItem(detailsValue)) return 'BOOK'

  const sectionValue = String(item.section || '')
    .trim()
    .toUpperCase()
  if (sectionValue === 'BOOK') return 'BOOK'
  if (sectionValue === 'BANK') return 'BANK'

  return 'BANK'
}

export const fmt = (num) => {
  const n = parseFloat(num)

  if (isNaN(n)) return '0.00'

  return n.toLocaleString('en-US', {
    minimumFractionDigits: 2,

    maximumFractionDigits: 2,
  })
}

export const getItemAmount = (item) => {
  const debit = Math.abs(parseFloat(item.bri_debit || item.debit || 0))

  const credit = Math.abs(parseFloat(item.bri_credit || item.credit || 0))

  const section = getItemSection(item)

  if (section === 'BOOK') {
    return debit > 0 ? debit : credit > 0 ? -credit : 0
  }

  if (section === 'BANK') {
    return debit > 0 ? debit : credit > 0 ? -credit : 0
  }

  return credit - debit
}

const emptyItemForm = () => ({
  date: formatLocalDate(new Date()),

  reference_number: '',

  description: '',

  details: '',

  debit: '',

  credit: '',

  section: 'BANK',
})

export function useBankReconciliation(selectedReconciliation) {
  const [reconData, setReconData] = useState(
    DEMO_MODE ? DEMO_RECONCILIATION : selectedReconciliation,
  )

  const [items, setItems] = useState(DEMO_MODE ? DEMO_RECONCILIATION_ITEMS : [])

  const [itemsLoading, setItemsLoading] = useState(false)

  const [journalEntries, setJournalEntries] = useState([])

  const [journalEntriesLoading, setJournalEntriesLoading] = useState(false)

  const [showItemModal, setShowItemModal] = useState(false)

  const [editingItem, setEditingItem] = useState(null)

  const [itemFormData, setItemFormData] = useState(emptyItemForm())

  const [itemFormRows, setItemFormRows] = useState([emptyItemForm()])

  const [defaultStartDate, defaultEndDate] = getCurrentMonthRange()

  const [detailStartDate, setDetailStartDate] = useState(defaultStartDate)

  const [detailEndDate, setDetailEndDate] = useState(defaultEndDate)

  const [bankSearchTerm, setBankSearchTerm] = useState('')

  const [bookSearchTerm, setBookSearchTerm] = useState('')

  const [showToast, setShowToast] = useState(false)

  const [toastMessage, setToastMessage] = useState('')

  const [toastType, setToastType] = useState('success')

  const [bankSectionFilter, setBankSectionFilter] = useState('all')

  const [editingBankBalance, setEditingBankBalance] = useState(false)

  const [bankBalanceInput, setBankBalanceInput] = useState('')

  const [reconciliationMethod, setReconciliationMethod] =
    useState('adjusted_balance')

  const [editingBookBalance, setEditingBookBalance] = useState(false)

  const [bookBalanceInput, setBookBalanceInput] = useState('')

  const [availableMonths, setAvailableMonths] = useState([])

  const [availableMonthsLoading, setAvailableMonthsLoading] = useState(false)

  const [summaryDetails, setSummaryDetails] = useState(null)

  const [summaryLoading, setSummaryLoading] = useState(false)

  // Adjustment state for Bank and Book cards

  const [bankAdjustments, setBankAdjustments] = useState([])

  const [bookAdjustments, setBookAdjustments] = useState([])

  const [showBankAdjustmentForm, setShowBankAdjustmentForm] = useState(false)

  const [showBookAdjustmentForm, setShowBookAdjustmentForm] = useState(false)

  const [bankAdjustmentForm, setBankAdjustmentForm] = useState({
    type: '',

    description: '',

    amount: '',
    direction: 'add',
  })

  const [bookAdjustmentForm, setBookAdjustmentForm] = useState({
    type: '',

    description: '',

    amount: '',
    direction: 'add',
  })

  // Auto-suggested adjustments from partial matching remainders
  const [suggestedAdjustments, setSuggestedAdjustments] = useState([])

  // Generate auto-suggested adjustments based on partial matching remainders
  const generateSuggestedAdjustments = () => {
    const suggestions = []

    // Check GL entries for partial matches
    journalEntries.forEach((entry) => {
      const entryAmount = parseFloat(entry.amount) || 0
      const type = (entry.db_name || entry.category || '').toLowerCase()

      // Calculate matched amount for this entry
      const matchedAmount = items
        .filter((item) => item.ledger_id === entry.id)
        .reduce((sum, item) => {
          const matchedAmt =
            parseFloat(item.matched_amount || getItemAmount(item)) || 0
          return sum + matchedAmt
        }, 0)

      const remainder = entryAmount - matchedAmount

      // If there's a remainder and it's significant
      if (Math.abs(remainder) > 0.01) {
        const isReceipt = type.includes('receipt') || type.includes('collection')
        const isPayment = type.includes('payment') || type.includes('disbursement')

        if (isReceipt && remainder > 0) {
          // Suggest Deposits in Transit adjustment
          suggestions.push({
            id: `suggested-${entry.id}`,
            type: 'deposits_in_transit',
            description: `Remaining balance of ${entry.payee || entry.description || 'GL entry'} (Chk#: ${entry.check_number || 'N/A'})`,
            amount: remainder,
            sourceEntryId: entry.id,
            sourceEntry: entry,
            side: 'BANK',
            isSuggested: true,
          })
        } else if (isPayment && remainder > 0) {
          // Suggest Outstanding Checks adjustment
          suggestions.push({
            id: `suggested-${entry.id}`,
            type: 'outstanding_checks',
            description: `Remaining balance of ${entry.payee || entry.description || 'GL entry'} (Chk#: ${entry.check_number || 'N/A'})`,
            amount: remainder,
            sourceEntryId: entry.id,
            sourceEntry: entry,
            side: 'BANK',
            isSuggested: true,
          })
        }
      }
    })

    setSuggestedAdjustments(suggestions)
    return suggestions
  }

  const showToastMsg = (message, type = 'success') => {
    setToastMessage(message)

    setToastType(type)

    setShowToast(true)

    setTimeout(() => setShowToast(false), 3000)
  }

  const buildDateQuery = (start, end) => {
    const effectiveStart = start === undefined ? detailStartDate : start
    const effectiveEnd = end === undefined ? detailEndDate : end
    const params = new URLSearchParams()

    if (effectiveStart) params.append('start_date', effectiveStart)

    if (effectiveEnd) params.append('end_date', effectiveEnd)

    const queryString = params.toString()

    return queryString ? `?${queryString}` : ''
  }

  const fetchJournalEntries = async (
    start = detailStartDate,
    end = detailEndDate,
  ) => {
    try {
      setJournalEntriesLoading(true)
      setJournalEntries([])

      const token = localStorage.getItem('token')
      const response = await fetch(
        `${import.meta.env.VITE_SERVER_LINK}/journal_entries${buildDateQuery(start, end)}`,
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        },
      )

      const result = await response.json()
      console.log('Journal entries response:', result)
      if (result.success) {
        console.log('First journal entry sample:', result.data?.[0])
        // Deduplicate journal entries by id to prevent duplicates in the UI
        const uniqueEntries = Array.from(
          new Map((result.data || []).map((entry) => [entry.id, entry])).values(),
        )
        setJournalEntries(uniqueEntries)
      } else {
        setJournalEntries([])
        showToastMsg('Failed to load journal entries', 'error')
      }
    } catch {
      setJournalEntries([])
      showToastMsg('Failed to load journal entries', 'error')
    } finally {
      setJournalEntriesLoading(false)
    }
  }

  const fetchJournalEntriesByCoa = async (
    coaId,
    start = detailStartDate,
    end = detailEndDate,
    allowFallback = true,
  ) => {
    if (!coaId) {
      await fetchJournalEntries(start, end)
      return
    }

    try {
      setJournalEntriesLoading(true)
      setJournalEntries([])

      const token = localStorage.getItem('token')
      const response = await fetch(
        `${import.meta.env.VITE_SERVER_LINK}/journal_entries/coa/${coaId}${buildDateQuery(start, end)}`,
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        },
      )

      const result = await response.json()
      console.log('Journal entries by COA response:', result)
      if (result.success) {
        const entries = result.data || []
        console.log('First COA journal entry sample:', entries[0])
        if (entries.length === 0 && allowFallback && start && end) {
          console.warn(
            'No COA-specific journal entries found, falling back to all journal entries in range',
            start,
            end,
          )
          await fetchJournalEntries(start, end)
          return
        }
        // Deduplicate journal entries by id to prevent duplicates in the UI
        const uniqueEntries = Array.from(
          new Map(entries.map((entry) => [entry.id, entry])).values(),
        )
        setJournalEntries(uniqueEntries)
      } else {
        setJournalEntries([])
        showToastMsg('Failed to load journal entries', 'error')
      }
    } catch {
      setJournalEntries([])
      showToastMsg('Failed to load journal entries', 'error')
    } finally {
      setJournalEntriesLoading(false)
    }
  }

  const fetchReconciliationItems = async (
    startDate = detailStartDate,

    endDate = detailEndDate,
  ) => {
    try {
      setItemsLoading(true)

      const token = localStorage.getItem('token')

      const response = await fetch(
        `${import.meta.env.VITE_SERVER_LINK}/bank_reconciliation/${selectedReconciliation.id}${buildDateQuery(startDate, endDate)}`,

        {
          headers: {
            'Content-Type': 'application/json',

            Authorization: `Bearer ${token}`,
          },
        },
      )

      const result = await response.json()

      if (result.success) {
        setItems(result.data.items || [])

        setReconData(result.data)

        // Fetch adjustments from backend

        fetchAdjustments(startDate, endDate)

        // Set initial date range from fetched items if not already set

        if (
          !startDate &&
          !endDate &&
          result.data.items &&
          result.data.items.length > 0
        ) {
          const dates = result.data.items

            .map((item) => item.bri_date || item.date)

            .filter((date) => date)

          if (dates.length > 0) {
            const minDate = new Date(Math.min(...dates.map((d) => new Date(d))))

            const maxDate = new Date(Math.max(...dates.map((d) => new Date(d))))

            setDetailStartDate(minDate.toISOString().split('T')[0])

            setDetailEndDate(maxDate.toISOString().split('T')[0])
          }
        }
      } else {
        showToastMsg('Failed to load reconciliation items', 'error')
      }
    } catch {
      showToastMsg('Failed to load reconciliation items', 'error')
    } finally {
      setItemsLoading(false)
    }
  }

  const fetchAdjustments = async (
    startDate = detailStartDate,
    endDate = detailEndDate,
  ) => {
    try {
      const token = localStorage.getItem('token')

      const queryString = buildDateQuery(startDate, endDate)

      const response = await fetch(
        `${import.meta.env.VITE_SERVER_LINK}/bank_reconciliation/${selectedReconciliation.id}/adjustments${queryString}`,

        {
          headers: {
            'Content-Type': 'application/json',

            Authorization: `Bearer ${token}`,
          },
        },
      )

      const result = await response.json()

      if (result.success) {
        const adjustments = result.data || []

        // Separate adjustments by side

        setBankAdjustments(adjustments.filter((adj) => adj.side === 'BANK'))

        setBookAdjustments(adjustments.filter((adj) => adj.side === 'BOOK'))
      }
    } catch {
      console.error('Failed to load adjustments')
    }
  }

  useEffect(() => {
    if (DEMO_MODE) return

    // Fetch reconciliation items first to get dates and matching data
    fetchReconciliationItems().then(() => {
      // After reconciliation items are loaded, fetch other data
      fetchAvailableMonths()
      fetchAdjustments()

      const coaId = reconData?.coa_id || selectedReconciliation?.coa_id

      // Only fetch journal entries if we have COA ID and dates
      if (coaId && detailStartDate && detailEndDate) {
        fetchJournalEntriesByCoa(coaId, detailStartDate, detailEndDate)
      } else {
        setJournalEntries([])
      }
    })

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchReconciliationItems(detailStartDate, detailEndDate)
    }, 350)

    return () => clearTimeout(delayDebounceFn)

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailStartDate, detailEndDate])

  useEffect(() => {
    const coaId = reconData?.coa_id || selectedReconciliation?.coa_id

    if (coaId && detailStartDate && detailEndDate) {
      fetchJournalEntriesByCoa(coaId, detailStartDate, detailEndDate)
    } else {
      setJournalEntries([])
    }
  }, [
    reconData?.coa_id,
    selectedReconciliation?.coa_id,
    detailStartDate,
    detailEndDate,
  ])

  const handleUpdateBankStatementBalance = async () => {
    const val = parseFloat(bankBalanceInput)

    if (isNaN(val)) {
      showToastMsg('Please enter a valid amount', 'error')

      return
    }

    try {
      const token = localStorage.getItem('token')

      const response = await fetch(
        `${import.meta.env.VITE_SERVER_LINK}/bank_reconciliation/${selectedReconciliation.id}/bank_statement_balance`,

        {
          method: 'PUT',

          headers: {
            'Content-Type': 'application/json',

            Authorization: `Bearer ${token}`,
          },

          body: JSON.stringify({
            bank_statement_balance: val,
          }),
        },
      )

      const result = await response.json()

      if (result.success) {
        await fetchReconciliationItems()

        // Also refresh journal entries to ensure UI is updated
        const coaId = reconData?.coa_id || selectedReconciliation?.coa_id
        if (coaId && detailStartDate && detailEndDate) {
          await fetchJournalEntriesByCoa(coaId, detailStartDate, detailEndDate)
        }

        setEditingBankBalance(false)

        showToastMsg('Bank statement balance updated successfully')
      } else {
        showToastMsg(
          result.message || 'Failed to update bank statement balance',

          'error',
        )
      }
    } catch {
      showToastMsg('Server error while updating bank balance', 'error')
    }
  }

  const handleDeleteBankItem = async (itemId) => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(
        `${import.meta.env.VITE_SERVER_LINK}/bank_reconciliation/item/${itemId}`,
        {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        },
      )
      const result = await response.json()
      if (result.success) {
        await fetchReconciliationItems()

        // Also refresh journal entries to ensure UI is updated
        const coaId = reconData?.coa_id || selectedReconciliation?.coa_id
        if (coaId && detailStartDate && detailEndDate) {
          await fetchJournalEntriesByCoa(coaId, detailStartDate, detailEndDate)
        }

        showToastMsg('Bank statement item deleted successfully')
      } else {
        showToastMsg(
          result.message || 'Failed to delete bank statement item',
          'error',
        )
      }
    } catch {
      showToastMsg('Server error while deleting bank statement item', 'error')
    }
  }

  const handleMatchBankToLedger = async (
    bankItemId,
    ledgerId,
    matchedAmount = null,
    skipRefresh = false,
  ) => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(
        `${import.meta.env.VITE_SERVER_LINK}/bank_reconciliation/match`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            bankItemId,
            ledgerId,
            matchedAmount, // Optional: for partial matching
          }),
        },
      )
      const result = await response.json()
      if (result.success) {
        // Only refresh if not skipping (for bulk matching)
        if (!skipRefresh) {
          // Fetch both data sources in parallel to ensure sync
          const coaId = reconData?.coa_id || selectedReconciliation?.coa_id
          const journalEntriesPromise =
            coaId && detailStartDate && detailEndDate
              ? fetchJournalEntriesByCoa(coaId, detailStartDate, detailEndDate)
              : fetchJournalEntries()

          await Promise.all([fetchReconciliationItems(), journalEntriesPromise])
          showToastMsg('Bank item matched to ledger successfully')
        }
      } else {
        if (!skipRefresh) {
          showToastMsg(result.message || 'Failed to match bank to ledger', 'error')
        }
      }
    } catch {
      if (!skipRefresh) {
        showToastMsg('Server error while matching bank to ledger', 'error')
      }
    }
  }

  const handleUnmatchBankFromLedger = async (bankItemId) => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(
        `${import.meta.env.VITE_SERVER_LINK}/bank_reconciliation/unmatch/${bankItemId}`,
        {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        },
      )
      const result = await response.json()
      if (result.success) {
        // Fetch both data sources in parallel to ensure sync
        const coaId = reconData?.coa_id || selectedReconciliation?.coa_id
        const journalEntriesPromise =
          coaId && detailStartDate && detailEndDate
            ? fetchJournalEntriesByCoa(coaId, detailStartDate, detailEndDate)
            : fetchJournalEntries()

        await Promise.all([fetchReconciliationItems(), journalEntriesPromise])
        showToastMsg('Bank item unmatched successfully')
      } else {
        showToastMsg(result.message || 'Failed to unmatch bank from ledger', 'error')
      }
    } catch {
      showToastMsg('Server error while unmatching bank from ledger', 'error')
    }
  }

  const handleUpdateGeneralLedgerBalance = async () => {
    const val = parseFloat(bookBalanceInput)

    if (isNaN(val)) {
      showToastMsg('Please enter a valid amount', 'error')

      return
    }

    try {
      const token = localStorage.getItem('token')

      const response = await fetch(
        `${import.meta.env.VITE_SERVER_LINK}/bank_reconciliation/${selectedReconciliation.id}/balance`,

        {
          method: 'PUT',

          headers: {
            'Content-Type': 'application/json',

            Authorization: `Bearer ${token}`,
          },

          body: JSON.stringify({
            running_balance: val,
          }),
        },
      )

      const result = await response.json()

      if (result.success) {
        await fetchReconciliationItems()

        // Also refresh journal entries to ensure UI is updated
        const coaId = reconData?.coa_id || selectedReconciliation?.coa_id
        if (coaId && detailStartDate && detailEndDate) {
          await fetchJournalEntriesByCoa(coaId, detailStartDate, detailEndDate)
        }

        setEditingBookBalance(false)

        showToastMsg('General ledger balance updated successfully')
      } else {
        showToastMsg(
          result.message || 'Failed to update general ledger balance',

          'error',
        )
      }
    } catch {
      showToastMsg('Server error while updating general ledger balance', 'error')
    }
  }

  const handleAddOrUpdateItem = async () => {
    const rowsToSave = editingItem ? [itemFormData] : itemFormRows

    const hasInvalidRow = rowsToSave.some((row) => {
      const debit = parseFloat(row.debit) || 0

      const credit = parseFloat(row.credit) || 0

      const detailsValue = row.details

      const meta = getItemMeta(detailsValue)

      const section = isBankSectionItem(detailsValue) ? 'BANK' : 'BOOK'

      const sectionMismatch = row.section && row.section !== section

      const invalidAmount = debit <= 0 && credit <= 0

      const bothAmounts = debit > 0 && credit > 0

      const wrongSideDebit = meta.effect === 'deduct' && debit > 0

      const wrongSideCredit = meta.effect === 'add' && credit > 0

      return (
        !row.date ||
        !row.details ||
        invalidAmount ||
        bothAmounts ||
        sectionMismatch ||
        wrongSideDebit ||
        wrongSideCredit
      )
    })

    if (hasInvalidRow) {
      showToastMsg(
        'Each row must have a Date, Details, and either Debit or Credit greater than 0. Debit-only for additions, Credit-only for deductions.',

        'error',
      )

      return
    }

    try {
      const token = localStorage.getItem('token')

      for (const row of rowsToSave) {
        const debit = parseFloat(row.debit) || 0

        const credit = parseFloat(row.credit) || 0

        const detailsValue = row.details

        const enforcedSection = isBankSectionItem(detailsValue) ? 'BANK' : 'BOOK'

        const payload = {
          bri_date: row.date,

          date: row.date,

          bri_description: row.description || null,

          description: row.description || null,

          bri_reference_number: row.reference_number || null,

          reference_number: row.reference_number || null,

          bri_details: detailsValue,

          details: detailsValue,

          section: enforcedSection,

          bri_debit: debit,

          debit,

          bri_credit: credit,

          credit,

          bri_balance: credit - debit,

          balance: credit - debit,
        }

        let url = `${import.meta.env.VITE_SERVER_LINK}/bank_reconciliation/item/add`

        let method = 'POST'

        let bodyData = {
          br_id: selectedReconciliation.id,

          bri_br_id: selectedReconciliation.id,

          ...payload,
        }

        if (editingItem) {
          const itemId = editingItem.bri_id || editingItem.id

          url = `${import.meta.env.VITE_SERVER_LINK}/bank_reconciliation/item/${itemId}`

          method = 'PUT'

          bodyData = payload
        }

        const response = await fetch(url, {
          method,

          headers: {
            'Content-Type': 'application/json',

            Authorization: `Bearer ${token}`,
          },

          body: JSON.stringify(bodyData),
        })

        const result = await response.json()

        if (!result.success) {
          showToastMsg(result.message || 'Failed to save line item', 'error')

          return
        }
      }

      showToastMsg(
        editingItem
          ? 'Item updated successfully'
          : `${rowsToSave.length} item(s) added successfully`,
      )

      await fetchReconciliationItems()

      // Also refresh journal entries to ensure UI is updated
      const coaId = reconData?.coa_id || selectedReconciliation?.coa_id
      if (coaId && detailStartDate && detailEndDate) {
        await fetchJournalEntriesByCoa(coaId, detailStartDate, detailEndDate)
      }

      setShowItemModal(false)

      setEditingItem(null)

      resetItemForm()
    } catch {
      showToastMsg('Server error while saving reconciliation item', 'error')
    }
  }

  const handleEditItem = (item) => {
    const activeDetails = item.bri_details || item.details || item.item_type || ''

    const debit = parseFloat(item.bri_debit || item.debit || 0)

    const credit = parseFloat(item.bri_credit || item.credit || 0)

    const resolvedSection = isBankSectionItem(activeDetails) ? 'BANK' : 'BOOK'

    setEditingItem(item)

    setItemFormData({
      date: item.bri_date || item.date || new Date().toISOString().split('T')[0],

      reference_number: item.bri_reference_number || item.reference_number || '',

      description: item.bri_description || item.description || '',

      details: activeDetails,

      section: item.section || resolvedSection,

      debit: debit > 0 ? debit.toString() : '',

      credit: credit > 0 ? credit.toString() : '',
    })

    setShowItemModal(true)
  }

  const handleDeleteItem = async (itemId) => {
    if (!window.confirm('Are you sure you want to delete this item?')) return

    try {
      const token = localStorage.getItem('token')

      const response = await fetch(
        `${import.meta.env.VITE_SERVER_LINK}/bank_reconciliation/item/${itemId}`,

        {
          method: 'DELETE',

          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      )

      const result = await response.json()

      if (result.success) {
        showToastMsg('Item deleted successfully')

        await fetchReconciliationItems()

        // Also refresh journal entries to ensure UI is updated
        const coaId = reconData?.coa_id || selectedReconciliation?.coa_id
        if (coaId && detailStartDate && detailEndDate) {
          await fetchJournalEntriesByCoa(coaId, detailStartDate, detailEndDate)
        }
      } else {
        showToastMsg(result.message || 'Failed to delete item', 'error')
      }
    } catch {
      showToastMsg('Server error while deleting item', 'error')
    }
  }

  const resetItemForm = () => {
    setItemFormData(emptyItemForm())

    setItemFormRows([emptyItemForm()])
  }

  const updateItemFormRow = (index, field, value) => {
    setItemFormRows((prevRows) =>
      prevRows.map((row, i) => {
        if (i !== index) return row

        if (field === 'details') {
          const section = isBankSectionItem(value) ? 'BANK' : 'BOOK'

          return { ...row, details: value, section }
        }

        if (field === 'debit' && value) {
          return { ...row, debit: value, credit: '' }
        }

        if (field === 'credit' && value) {
          return { ...row, credit: value, debit: '' }
        }

        return { ...row, [field]: value }
      }),
    )
  }

  const addItemFormRow = () => {
    setItemFormRows((prevRows) => [...prevRows, emptyItemForm()])
  }

  const removeItemFormRow = (index) => {
    setItemFormRows((prevRows) =>
      prevRows.length === 1 ? prevRows : prevRows.filter((_, i) => i !== index),
    )
  }

  // Adjustment handlers

  const handleAddBankAdjustment = async () => {
    if (!bankAdjustmentForm.type || !bankAdjustmentForm.amount) {
      showToastMsg('Please select type and enter amount', 'error')

      return
    }

    const amount = parseFloat(bankAdjustmentForm.amount)

    if (isNaN(amount) || amount <= 0) {
      showToastMsg('Please enter a valid amount', 'error')

      return
    }

    try {
      const token = localStorage.getItem('token')

      const response = await fetch(
        `${import.meta.env.VITE_SERVER_LINK}/bank_reconciliation/adjustment/add`,

        {
          method: 'POST',

          headers: {
            'Content-Type': 'application/json',

            Authorization: `Bearer ${token}`,
          },

          body: JSON.stringify({
            br_id: selectedReconciliation.id,

            date: new Date().toISOString().split('T')[0],

            type: bankAdjustmentForm.type,

            description: bankAdjustmentForm.description,

            // for error adjustments, send positive amount (user can select type to indicate direction)
            amount: amount,

            side: 'BANK',
          }),
        },
      )

      const result = await response.json()

      if (result.success) {
        await fetchAdjustments()
        await fetchReconciliationItems()

        // Also refresh journal entries to ensure UI is updated
        const coaId = reconData?.coa_id || selectedReconciliation?.coa_id
        if (coaId && detailStartDate && detailEndDate) {
          await fetchJournalEntriesByCoa(coaId, detailStartDate, detailEndDate)
        }

        setBankAdjustmentForm({ type: '', description: '', amount: '' })

        setShowBankAdjustmentForm(false)

        showToastMsg('Bank adjustment added successfully')
      } else {
        showToastMsg(result.message || 'Failed to add bank adjustment', 'error')
      }
    } catch {
      showToastMsg('Server error while adding bank adjustment', 'error')
    }
  }

  const handleAddBookAdjustment = async () => {
    if (!bookAdjustmentForm.type || !bookAdjustmentForm.amount) {
      showToastMsg('Please select type and enter amount', 'error')

      return
    }

    const amount = parseFloat(bookAdjustmentForm.amount)

    if (isNaN(amount) || amount <= 0) {
      showToastMsg('Please enter a valid amount', 'error')

      return
    }

    try {
      const token = localStorage.getItem('token')

      const response = await fetch(
        `${import.meta.env.VITE_SERVER_LINK}/bank_reconciliation/adjustment/add`,

        {
          method: 'POST',

          headers: {
            'Content-Type': 'application/json',

            Authorization: `Bearer ${token}`,
          },

          body: JSON.stringify({
            br_id: selectedReconciliation.id,

            date: new Date().toISOString().split('T')[0],

            type: bookAdjustmentForm.type,

            description: bookAdjustmentForm.description,

            // for error adjustments, send positive amount (user can select type to indicate direction)
            amount: amount,

            side: 'BOOK',
          }),
        },
      )

      const result = await response.json()

      if (result.success) {
        await fetchAdjustments()
        await fetchReconciliationItems()

        // Also refresh journal entries to ensure UI is updated
        const coaId = reconData?.coa_id || selectedReconciliation?.coa_id
        if (coaId && detailStartDate && detailEndDate) {
          await fetchJournalEntriesByCoa(coaId, detailStartDate, detailEndDate)
        }

        setBookAdjustmentForm({ type: '', description: '', amount: '' })

        setShowBookAdjustmentForm(false)

        showToastMsg('Book adjustment added successfully')
      } else {
        showToastMsg(result.message || 'Failed to add book adjustment', 'error')
      }
    } catch {
      showToastMsg('Server error while adding book adjustment', 'error')
    }
  }

  const handleRemoveBankAdjustment = async (id) => {
    try {
      const token = localStorage.getItem('token')

      const response = await fetch(
        `${import.meta.env.VITE_SERVER_LINK}/bank_reconciliation/adjustment/${id}`,

        {
          method: 'DELETE',

          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      )

      const result = await response.json()

      if (result.success) {
        await fetchAdjustments()
        await fetchReconciliationItems()

        // Also refresh journal entries to ensure UI is updated
        const coaId = reconData?.coa_id || selectedReconciliation?.coa_id
        if (coaId && detailStartDate && detailEndDate) {
          await fetchJournalEntriesByCoa(coaId, detailStartDate, detailEndDate)
        }

        showToastMsg('Bank adjustment removed successfully')
      } else {
        showToastMsg(result.message || 'Failed to remove bank adjustment', 'error')
      }
    } catch {
      showToastMsg('Server error while removing bank adjustment', 'error')
    }
  }

  const handleRemoveBookAdjustment = async (id) => {
    try {
      const token = localStorage.getItem('token')

      const response = await fetch(
        `${import.meta.env.VITE_SERVER_LINK}/bank_reconciliation/adjustment/${id}`,

        {
          method: 'DELETE',

          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      )

      const result = await response.json()

      if (result.success) {
        await fetchAdjustments()
        await fetchReconciliationItems()

        // Also refresh journal entries to ensure UI is updated
        const coaId = reconData?.coa_id || selectedReconciliation?.coa_id
        if (coaId && detailStartDate && detailEndDate) {
          await fetchJournalEntriesByCoa(coaId, detailStartDate, detailEndDate)
        }

        showToastMsg('Book adjustment removed successfully')
      } else {
        showToastMsg(result.message || 'Failed to remove book adjustment', 'error')
      }
    } catch {
      showToastMsg('Server error while removing book adjustment', 'error')
    }
  }

  // Matching functionality
  const handleCreateMatch = async (stmtIds, bookIds) => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(
        `${import.meta.env.VITE_SERVER_LINK}/bank_reconciliation/match/add`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            br_id: selectedReconciliation.id,
            stmt_item_ids: stmtIds,
            book_item_ids: bookIds,
          }),
        },
      )

      const result = await response.json()
      if (result.success) {
        await fetchReconciliationItems()
        showToastMsg('Items matched successfully')
      } else {
        showToastMsg(result.message || 'Failed to match items', 'error')
      }
    } catch {
      showToastMsg('Server error while matching items', 'error')
    }
  }

  const handleDeleteMatch = async (matchId) => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(
        `${import.meta.env.VITE_SERVER_LINK}/bank_reconciliation/match/${matchId}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      )

      const result = await response.json()
      if (result.success) {
        await fetchReconciliationItems()
        showToastMsg('Match removed successfully')
      } else {
        showToastMsg(result.message || 'Failed to remove match', 'error')
      }
    } catch {
      showToastMsg('Server error while removing match', 'error')
    }
  }

  const fetchMatches = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(
        `${import.meta.env.VITE_SERVER_LINK}/bank_reconciliation/${selectedReconciliation.id}/matches`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      )

      const result = await response.json()
      if (result.success) {
        return result.data || []
      }
      return []
    } catch {
      console.error('Failed to fetch matches')
      return []
    }
  }

  const fetchAvailableMonths = async () => {
    const reconciliationId = reconData?.id || selectedReconciliation?.id
    if (!reconciliationId) return

    try {
      setAvailableMonthsLoading(true)
      const token = localStorage.getItem('token')
      const response = await fetch(
        `${import.meta.env.VITE_SERVER_LINK}/bank_reconciliation/${reconciliationId}/summary-months`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      )

      const result = await response.json()
      if (result.success && result.data) {
        const now = formatLocalDate(new Date())
        const savedMonths = [...result.data].sort(
          (a, b) => new Date(b.start_date) - new Date(a.start_date),
        )

        const currentPeriod = savedMonths.find((month) =>
          isDateWithinRange(now, month.start_date, month.end_date),
        )

        const latestSaved = savedMonths.reduce((latest, month) => {
          if (!latest) return month
          return new Date(month.end_date) > new Date(latest.end_date)
            ? month
            : latest
        }, null)

        let effectiveMonths = [...savedMonths]
        let defaultRange = null

        if (currentPeriod) {
          defaultRange = {
            start_date: currentPeriod.start_date,
            end_date: currentPeriod.end_date,
            label: `${new Date(currentPeriod.start_date).toLocaleDateString(
              'en-US',
              {
                month: 'short',
                day: 'numeric',
              },
            )} - ${new Date(currentPeriod.end_date).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}`,
            isOpenPeriod: false,
          }
        } else if (
          latestSaved &&
          isDateWithinRange(now, latestSaved.start_date, latestSaved.end_date)
        ) {
          defaultRange = {
            start_date: latestSaved.start_date,
            end_date: latestSaved.end_date,
            label: `${new Date(latestSaved.start_date).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
            })} - ${new Date(latestSaved.end_date).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}`,
            isOpenPeriod: false,
          }
        } else if (latestSaved && now > latestSaved.end_date) {
          const openStart = addDays(latestSaved.end_date, 1)
          const openLabel = `Unreconciled ${new Date(openStart).toLocaleDateString(
            'en-US',
            {
              month: 'short',
              day: 'numeric',
            },
          )} - ${new Date(now).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })}`
          const openPeriod = {
            start_date: openStart,
            end_date: now,
            label: openLabel,
            isOpenPeriod: true,
          }
          effectiveMonths = [openPeriod, ...savedMonths]
          defaultRange = openPeriod
        } else if (
          latestSaved &&
          now < savedMonths[savedMonths.length - 1].start_date
        ) {
          const openStart = formatLocalDate(
            new Date(now.getFullYear(), now.getMonth(), 1),
          )
          const openLabel = `Unreconciled ${new Date(openStart).toLocaleDateString(
            'en-US',
            {
              month: 'short',
              day: 'numeric',
            },
          )} - ${new Date(now).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })}`
          const openPeriod = {
            start_date: openStart,
            end_date: now,
            label: openLabel,
            isOpenPeriod: true,
          }
          effectiveMonths = [openPeriod, ...savedMonths]
          defaultRange = openPeriod
        }

        setAvailableMonths(effectiveMonths)

        if (defaultRange) {
          setDetailStartDate(defaultRange.start_date)
          setDetailEndDate(defaultRange.end_date)
        } else if (savedMonths.length > 0) {
          const first = savedMonths[0]
          setDetailStartDate(first.start_date)
          setDetailEndDate(first.end_date)
        }
      }
    } catch (error) {
      console.error('Error fetching available months:', error)
    } finally {
      setAvailableMonthsLoading(false)
    }
  }

  const handleSaveSummary = async () => {
    const reconciliationId = reconData?.id || selectedReconciliation?.id

    if (!reconciliationId) {
      showToastMsg('Unable to determine reconciliation id', 'error')
      return
    }

    try {
      const token = localStorage.getItem('token')
      const response = await fetch(
        `${import.meta.env.VITE_SERVER_LINK}/bank_reconciliation/summary/add`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            br_id: reconciliationId,
            start_date: detailStartDate,
            end_date: detailEndDate,
            adjusted_bank_balance: adjustedBankBalance,
            adjusted_book_balance: adjustedBookBalance,
            final_output: isReconciled ? 'Reconciled' : 'Not reconciled',
          }),
        },
      )

      const result = await response.json()

      if (!result.success) {
        showToastMsg(result.message || 'Failed to save summary', 'error')
        return
      }

      await fetchAvailableMonths()

      // Clear current data after saving summary to prepare for new period
      setItems([])
      setJournalEntries([])
      setBankAdjustments([])
      setBookAdjustments([])
      setSummaryDetails(null)

      // Reset date range to next month for new period
      const [newDefaultStartDate, newDefaultEndDate] =
        getNextMonthRange(detailEndDate)
      setDetailStartDate(newDefaultStartDate)
      setDetailEndDate(newDefaultEndDate)

      showToastMsg('Summary saved successfully. Data cleared for new period.')
    } catch {
      showToastMsg('Server error while saving summary', 'error')
    }
  }

  const fetchSummaryDetails = async (
    startDate = detailStartDate,
    endDate = detailEndDate,
  ) => {
    const reconciliationId = reconData?.id || selectedReconciliation?.id
    if (!reconciliationId || !startDate || !endDate) return null

    try {
      setSummaryLoading(true)
      const token = localStorage.getItem('token')

      // Convert dates to YYYY-MM-DD format if they're in ISO format
      const normalizeDate = (dateStr) => {
        if (!dateStr) return ''
        const date = new Date(dateStr)
        return formatLocalDate(date)
      }

      const normalizedStart = normalizeDate(startDate)
      const normalizedEnd = normalizeDate(endDate)

      const response = await fetch(
        `${import.meta.env.VITE_SERVER_LINK}/bank_reconciliation/${reconciliationId}/summary?start_date=${encodeURIComponent(
          normalizedStart,
        )}&end_date=${encodeURIComponent(normalizedEnd)}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      )

      const result = await response.json()
      if (result.success && result.data) {
        setSummaryDetails(result.data)
        return result.data
      }

      setSummaryDetails(null)
      return null
    } catch (error) {
      console.error('Failed to fetch bank reconciliation summary details:', error)
      setSummaryDetails(null)
      return null
    } finally {
      setSummaryLoading(false)
    }
  }

  const hasSavedSummary = availableMonths.some(
    (month) =>
      month.start_date === detailStartDate && month.end_date === detailEndDate,
  )

  useEffect(() => {
    if (hasSavedSummary) {
      fetchSummaryDetails(detailStartDate, detailEndDate)
    } else {
      setSummaryDetails(null)
    }
  }, [hasSavedSummary, detailStartDate, detailEndDate])

  const handleExportSummaryPdf = async () => {
    const reconciliationId = reconData?.id || selectedReconciliation?.id
    if (!reconciliationId) {
      showToastMsg('Unable to determine reconciliation id', 'error')
      return
    }

    const hasSavedSummary = availableMonths.some(
      (month) =>
        month.start_date === detailStartDate && month.end_date === detailEndDate,
    )

    if (!hasSavedSummary) {
      showToastMsg('No saved summary found for the selected period', 'error')
      return
    }

    const summary = await fetchSummaryDetails(detailStartDate, detailEndDate)
    if (!summary) {
      showToastMsg('Unable to load summary details for export', 'error')
      return
    }

    try {
      const { generateBankReconciliationPDF } =
        await import('../../utils/generateBankReconciliationPDF')

      await generateBankReconciliationPDF({
        reconData,
        summary,
        detailStartDate,
        detailEndDate,
        bankStatementEndingBalance,
        endingBookBalance,
        depositsInTransit,
        outstandingChecks,
        bankAdditions,
        bankDeductions,
        bankCardAdditions,
        bankCardDeductions,
        bankErrors,
        bookAdditions,
        bookDeductions,
        bookErrorAdjustments,
        bookCardAdditions,
        bookCardDeductions,
        bookCardErrors,
        adjustedBankBalance,
        adjustedBookBalance,
        reconDifference,
        isReconciled,
        bankAdjustments,
        bookAdjustments,
      })
    } catch (error) {
      console.error('Error generating export PDF:', error)
      showToastMsg('Failed to generate PDF', 'error')
    }
  }

  const bankSectionItems = items.filter((item) => getItemSection(item) === 'BANK')

  const bookSectionItems = items.filter((item) => getItemSection(item) === 'BOOK')

  // Calculate matched and unmatched bank statement amounts
  const matchedBankAmount = items
    .filter((item) => item.ledger_id !== null && item.ledger_id !== undefined)
    .reduce((sum, item) => {
      const debit = parseFloat(item.debit || item.bri_debit || 0) || 0
      const credit = parseFloat(item.credit || item.bri_credit || 0) || 0
      return sum + (debit - credit)
    }, 0)

  const unmatchedBankAmount = items
    .filter((item) => item.ledger_id === null || item.ledger_id === undefined)
    .reduce((sum, item) => {
      const debit = parseFloat(item.debit || item.bri_debit || 0) || 0
      const credit = parseFloat(item.credit || item.bri_credit || 0) || 0
      return sum + (debit - credit)
    }, 0)

  // Calculate matched and unmatched GL amounts
  const matchedGLAmount = journalEntries
    .filter((entry) => items.some((item) => item.ledger_id === entry.id))
    .reduce((sum, entry) => sum + (parseFloat(entry.amount) || 0), 0)

  const unmatchedGLAmount = journalEntries
    .filter((entry) => !items.some((item) => item.ledger_id === entry.id))
    .filter((entry) => {
      const type = (entry.db_name || entry.category || '').toLowerCase()
      return (
        type.includes('receipt') ||
        type.includes('collection') ||
        type.includes('payment') ||
        type.includes('disbursement')
      )
    })
    .reduce((sum, entry) => {
      const type = (entry.db_name || entry.category || '').toLowerCase()
      const isInflow = type.includes('receipt') || type.includes('collection')
      const amount = parseFloat(entry.amount) || 0
      return sum + (isInflow ? amount : -amount)
    }, 0)

  // Calculate deposits in transit (unmatched GL receipts/collections with DEBIT type)
  // KEY: Only include GL entries that are COMPLETELY UNMATCHED (no matched items at all)
  // Once a GL entry is matched to ANY bank item, it's no longer "in transit"
  const depositsInTransit = journalEntries
    .filter((entry) => {
      const dbType = (entry.db_name || entry.category || '').toLowerCase()
      const entryType = (entry.type || '').toUpperCase()
      // Only include DEBIT entries from receipts/collections (actual inflows)
      if (
        !(
          (dbType.includes('receipt') || dbType.includes('collection')) &&
          entryType === 'DEBIT'
        )
      ) {
        return false
      }
      // CRITICAL: Exclude any GL entry that has matched items
      const hasMatches = items.some((item) => item.ledger_id === entry.id)
      return !hasMatches // Only unmatched entries contribute
    })
    .reduce((sum, entry) => {
      // For completely unmatched GL entries, add the full amount
      return sum + (parseFloat(entry.amount) || 0)
    }, 0)

  // Calculate outstanding checks (unmatched GL payments/disbursements, or CREDIT entries in receipts)
  // KEY: Only include GL entries that are COMPLETELY UNMATCHED (no matched items at all)
  // Once a GL entry is matched to ANY bank item, it's no longer "outstanding"
  const outstandingChecks = journalEntries
    .filter((entry) => {
      const dbType = (entry.db_name || entry.category || '').toLowerCase()
      const entryType = (entry.type || '').toUpperCase()
      // Include: 1) payments/disbursements with DEBIT type, 2) CREDIT entries in receipts (contra-entries)
      if (
        !(
          dbType.includes('payment') ||
          (dbType.includes('disbursement') && entryType === 'DEBIT') ||
          ((dbType.includes('receipt') || dbType.includes('collection')) &&
            entryType === 'CREDIT')
        )
      ) {
        return false
      }
      // CRITICAL: Exclude any GL entry that has matched items
      const hasMatches = items.some((item) => item.ledger_id === entry.id)
      return !hasMatches // Only unmatched entries contribute
    })
    .reduce((sum, entry) => {
      // For completely unmatched GL entries, add the full amount
      return sum + Math.abs(parseFloat(entry.amount) || 0)
    }, 0)

  const bankErrors = bankSectionItems

    .filter(
      (item) =>
        (item.bri_details || item.details || item.item_type) === 'error_bank',
    )

    .reduce((sum, item) => {
      const c = parseFloat(item.bri_credit || item.credit || 0)

      const d = parseFloat(item.bri_debit || item.debit || 0)

      return sum + (c - d)
    }, 0)

  // Calculate ending book GL balance from cash transactions only (receipts, collections, payments, cash_disbursements)
  // This should include ALL GL entries regardless of match status - it's the total book balance
  const cashJournalEntries = journalEntries.filter((entry) => {
    const type = (entry.db_name || entry.category || '').toLowerCase()
    return (
      type.includes('receipt') ||
      type.includes('collection') ||
      type.includes('payment') ||
      type.includes('disbursement')
    )
  })

  const endingBookBalance = cashJournalEntries.reduce((sum, entry) => {
    const entryType = (entry.type || '').toUpperCase()
    const amount = parseFloat(entry.amount) || 0
    // DEBIT entries add to balance, CREDIT entries subtract from balance
    // This is the standard accounting: DEBIT = increase in assets, CREDIT = decrease
    return sum + (entryType === 'DEBIT' ? amount : -amount)
  }, 0)

  // Bank statement ending balance: CALCULATED from bank items (the imported bank feed)
  // CRITICAL: This is the ACTUAL ending balance shown on the bank statement
  // It includes ALL bank items (both matched and unmatched) because they all cleared the bank
  // Items on the bank statement are NOT "in transit" - they've already been processed by the bank
  const bankStatementEndingBalance = items
    .filter(
      (item) =>
        (item.bri_details || item.details || item.item_type) !== 'error_bank',
    )
    .reduce((sum, item) => {
      const credit = parseFloat(item.bri_credit || item.credit || 0) || 0
      const debit = parseFloat(item.bri_debit || item.debit || 0) || 0
      // Bank items: credits add, debits subtract
      return sum + credit - debit
    }, 0)

  // Calculate bank adjustments from the card adjustments
  const bankCardAdditions = bankAdjustments
    .filter((adj) => adj.type === 'deposits_in_transit')
    .reduce((sum, adj) => sum + (parseFloat(adj.amount) || 0), 0)

  const bankCardDeductions = bankAdjustments
    .filter((adj) => adj.type === 'outstanding_checks')
    .reduce((sum, adj) => sum + (parseFloat(adj.amount) || 0), 0)

  const bankCardErrors = bankAdjustments
    .filter((adj) => adj.type === 'error_bank')
    .reduce((sum, adj) => {
      return sum + (parseFloat(adj.amount) || 0)
    }, 0)

  // Calculate bank adjustments total
  const bankCardAdjustmentsTotal = bankAdjustments.reduce((sum, adj) => {
    const amount = parseFloat(adj.amount) || 0
    if (
      adj.type === 'deposits_in_transit' ||
      (adj.type === 'error_bank' && amount >= 0)
    ) {
      return sum + amount
    } else if (
      adj.type === 'outstanding_checks' ||
      (adj.type === 'error_bank' && amount < 0)
    ) {
      return sum + amount
    }
    return sum
  }, 0)

  // Calculate unrecorded bank credits (unmatched bank items that are credits/deposits)
  // For bank items: credit > 0 and debit === 0 means deposit (credit)
  // EXCEPT: exclude bank items whose reference # OR amount matches a GL entry's reference/amount
  const bookAdditions = items
    .filter((item) => item.ledger_id === null || item.ledger_id === undefined)
    .filter((item) => {
      // Only include items that are credits (credit > 0 and debit === 0)
      const debit = parseFloat(item.bri_debit || item.debit || 0) || 0
      const credit = parseFloat(item.bri_credit || item.credit || 0) || 0
      const isCredit = credit > 0 && debit === 0
      if (!isCredit) return false

      // Check if this bank item matches any GL entry (by reference OR by amount)
      const bankRef = (
        item.reference_number ||
        item.bri_reference_number ||
        ''
      ).toLowerCase()
      const bankAmount = credit

      const hasMatchingGL = journalEntries.some((entry) => {
        // Match by reference number (if both have refs)
        const glRef = (
          entry.check_number ||
          entry.document_reference ||
          ''
        ).toLowerCase()
        if (glRef && bankRef && glRef === bankRef) return true

        // Match by amount and type (GL DEBIT receipts/collections = bank credits/deposits)
        const entryType = (entry.type || '').toUpperCase()
        const entryAmount = parseFloat(entry.amount) || 0
        const dbType = (entry.db_name || entry.category || '').toLowerCase()
        const isReceiptOrCollection =
          dbType.includes('receipt') || dbType.includes('collection')
        if (
          isReceiptOrCollection &&
          entryType === 'DEBIT' &&
          Math.abs(entryAmount - bankAmount) < 0.01
        ) {
          return true
        }
        return false
      })

      // Exclude if there's a matching GL entry (it's not unrecorded)
      return !hasMatchingGL
    })
    .reduce((sum, item) => {
      const credit = parseFloat(item.bri_credit || item.credit || 0) || 0
      return sum + credit
    }, 0)

  // Calculate unrecorded bank charges (unmatched bank items that are debits/withdrawals)
  // For bank items: debit > 0 and credit === 0 means withdrawal/charge (debit)
  // EXCEPT: exclude bank items whose reference # OR amount matches a GL entry's reference/amount
  const bookDeductions = items
    .filter((item) => item.ledger_id === null || item.ledger_id === undefined)
    .filter((item) => {
      // Only include items that are debits (debit > 0 and credit === 0)
      const debit = parseFloat(item.bri_debit || item.debit || 0) || 0
      const credit = parseFloat(item.bri_credit || item.credit || 0) || 0
      const isDebit = debit > 0 && credit === 0
      if (!isDebit) return false

      // Check if this bank item matches any GL entry (by reference OR by amount)
      const bankRef = (
        item.reference_number ||
        item.bri_reference_number ||
        ''
      ).toLowerCase()
      const bankAmount = debit

      const hasMatchingGL = journalEntries.some((entry) => {
        // Match by reference number (if both have refs)
        const glRef = (
          entry.check_number ||
          entry.document_reference ||
          ''
        ).toLowerCase()
        if (glRef && bankRef && glRef === bankRef) return true

        // Match by amount and type (GL CREDIT payments/disbursements = bank debits/withdrawals)
        const entryType = (entry.type || '').toUpperCase()
        const entryAmount = parseFloat(entry.amount) || 0
        const dbType = (entry.db_name || entry.category || '').toLowerCase()
        const isPaymentOrDisbursement =
          dbType.includes('payment') || dbType.includes('disbursement')
        if (
          isPaymentOrDisbursement &&
          entryType === 'CREDIT' &&
          Math.abs(entryAmount - bankAmount) < 0.01
        ) {
          return true
        }
        return false
      })

      // Exclude if there's a matching GL entry (it's not unrecorded)
      return !hasMatchingGL
    })
    .reduce((sum, item) => {
      const debit = parseFloat(item.bri_debit || item.debit || 0) || 0
      return sum + debit
    }, 0)

  // Calculate bank additions (unmatched bank credits/deposits that will need to be deposited)
  const bankAdditions = bankSectionItems
    .filter((item) => item.ledger_id === null || item.ledger_id === undefined)
    .reduce((sum, item) => {
      const debit = parseFloat(item.bri_debit || item.debit || 0) || 0
      const credit = parseFloat(item.bri_credit || item.credit || 0) || 0
      // Credit entries (deposits) are additions
      if (credit > 0 && debit === 0) {
        return sum + credit
      }
      return sum
    }, 0)

  // Calculate bank deductions (unmatched bank debits/withdrawals)
  const bankDeductions = bankSectionItems
    .filter((item) => item.ledger_id === null || item.ledger_id === undefined)
    .reduce((sum, item) => {
      const debit = parseFloat(item.bri_debit || item.debit || 0) || 0
      const credit = parseFloat(item.bri_credit || item.credit || 0) || 0
      // Debit entries (withdrawals) are deductions
      if (debit > 0 && credit === 0) {
        return sum + debit
      }
      return sum
    }, 0)

  const bookErrorAdjustments = bookSectionItems

    .filter(
      (item) =>
        (item.bri_details || item.details || item.item_type) === 'error_book',
    )

    .reduce((sum, item) => {
      const c = parseFloat(item.bri_credit || item.credit || 0)

      const d = parseFloat(item.bri_debit || item.debit || 0)

      return sum + (c - d)
    }, 0)

  // Calculate book adjustments from the card adjustments
  // Respect the direction/type field: "less" should subtract, "add" should add
  const bookCardAdjustmentsTotal = bookAdjustments.reduce((sum, adj) => {
    const amount = parseFloat(adj.amount) || 0
    console.log('Book adjustment:', adj)
    // If direction is "less" or type indicates subtraction, subtract the amount
    if (
      adj.direction === 'less' ||
      adj.type === 'outstanding_checks' ||
      adj.type === 'service_fees' ||
      (adj.type === 'error_bank' && amount < 0)
    ) {
      return sum - Math.abs(amount)
    }
    // Otherwise add the amount
    return sum + Math.abs(amount)
  }, 0)

  // If no bank statement has been uploaded (balance is 0), deposits/outstanding adjustments don't apply
  const effectiveDepositsInTransit =
    bankStatementEndingBalance === 0 ? 0 : depositsInTransit
  const effectiveOutstandingChecks =
    bankStatementEndingBalance === 0 ? 0 : outstandingChecks

  // Calculate adjusted balances based on selected reconciliation method
  let adjustedBankBalance, adjustedBookBalance

  if (reconciliationMethod === 'adjusted_balance') {
    // Adjusted Balance Method: Adjusts both bank statement balance and book balance to find a corrected, matching common total
    adjustedBankBalance =
      bankStatementEndingBalance +
      effectiveDepositsInTransit -
      effectiveOutstandingChecks +
      bankCardAdjustmentsTotal
    adjustedBookBalance =
      endingBookBalance + bookAdditions - bookDeductions + bookCardAdjustmentsTotal
  } else if (reconciliationMethod === 'bank_to_book') {
    // Bank-to-Book Method: Starts with bank statement balance and adds/subtracts outstanding items to reach book balance
    adjustedBankBalance =
      bankStatementEndingBalance +
      effectiveDepositsInTransit -
      effectiveOutstandingChecks +
      bankCardAdjustmentsTotal
    adjustedBookBalance = endingBookBalance + bookCardAdjustmentsTotal // Target is the ending book GL balance plus book adjustments
  } else if (reconciliationMethod === 'book_to_bank') {
    // Book-to-Bank Method: Starts with internal ledger balance and reconciles it up to the active bank statement balance
    adjustedBookBalance =
      endingBookBalance + bookAdditions - bookDeductions + bookCardAdjustmentsTotal
    adjustedBankBalance = bankStatementEndingBalance + bankCardAdjustmentsTotal // Target is the ending statement balance plus bank adjustments
  }

  console.log('Balance calculation:', {
    bankStatementEndingBalance,
    depositsInTransit,
    outstandingChecks,
    bankCardAdjustmentsTotal,
    endingBookBalance,
    bookAdditions,
    bookDeductions,
    bookCardAdjustmentsTotal,
    bookAdjustments,
    adjustedBankBalance,
    adjustedBookBalance,
  })

  // Net variance: Always show absolute difference between adjusted bank and book balances
  const reconDifference = Math.abs(adjustedBookBalance - adjustedBankBalance)

  const isReconciled = Math.abs(reconDifference) < 0.005

  const allBankItemsFiltered =
    bankSectionFilter === 'bank'
      ? bankSectionItems
      : bankSectionFilter === 'book'
        ? bookSectionItems
        : items

  const bankSearch = bankSearchTerm.toLowerCase().trim()

  const visibleBankItems = bankSearch
    ? allBankItemsFiltered.filter((item) =>
        [
          item.bri_date || item.date,

          item.bri_reference_number || item.reference_number,

          item.bri_description || item.description,

          getItemMeta(item.bri_details || item.details || item.item_type).label,
        ]

          .filter(Boolean)

          .some((v) => String(v).toLowerCase().includes(bankSearch)),
      )
    : allBankItemsFiltered

  const bookSearch = bookSearchTerm.toLowerCase().trim()

  const visibleJournalEntries = bookSearch
    ? journalEntries.filter((entry) =>
        [
          entry.date,

          entry.db_name,

          entry.responsibility_center,

          entry.coa_name,

          entry.type,

          entry.amount,
        ]

          .filter(Boolean)

          .some((v) => String(v).toLowerCase().includes(bookSearch)),
      )
    : journalEntries

  return {
    reconData,

    items,

    itemsLoading,

    journalEntries,

    journalEntriesLoading,

    showItemModal,

    // Matching functions
    handleCreateMatch,
    handleDeleteMatch,
    fetchMatches,

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

    toastMessage,

    setToastMessage,

    toastType,

    setToastType,

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

    depositsInTransit: effectiveDepositsInTransit,

    outstandingChecks: effectiveOutstandingChecks,

    matchedBankAmount,

    unmatchedBankAmount,

    matchedGLAmount,

    unmatchedGLAmount,

    bankAdditions,

    bankDeductions,

    bankErrors,

    bankStatementEndingBalance,

    endingBankStatementBalance: bankStatementEndingBalance,

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

    summaryDetails,

    summaryLoading,

    hasSavedSummary,

    handleExportSummaryPdf,

    bankCardAdditions,

    bankCardDeductions,

    bankCardErrors,
  }
}
