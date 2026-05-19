import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  DollarSign,
  Building2,
  AlertCircle,
  Loader,
  ArrowLeft,
  FileText,
  ChevronDown,
  CheckCircle2,
  XCircle,
  Scale,
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCw,
  Search,
  Calendar,
} from 'lucide-react'
import DynamicToast from '../../components/DynamicToast'

// ─── ITEM TYPE CONFIG ────────────────────────────────────────────────────────
const ITEM_TYPES = [
  {
    value: 'deposits_in_transit',
    label: 'Deposit in Transit',
    side: 'bank',
    effect: '+',
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
    badge: 'bg-emerald-100 text-emerald-700',
  },
  {
    value: 'outstanding_checks',
    label: 'Outstanding Check',
    side: 'bank',
    effect: '-',
    color: 'text-rose-600',
    bg: 'bg-rose-50',
    badge: 'bg-rose-100 text-rose-700',
  },
  {
    value: 'bank_charges',
    label: 'Bank Charge / Fee',
    side: 'book',
    effect: '-',
    color: 'text-rose-600',
    bg: 'bg-rose-50',
    badge: 'bg-rose-100 text-rose-700',
  },
  {
    value: 'interest_income',
    label: 'Interest Income',
    side: 'book',
    effect: '+',
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
    badge: 'bg-emerald-100 text-emerald-700',
  },
  {
    value: 'nsf_checks',
    label: 'NSF / Bounced Check',
    side: 'book',
    effect: '-',
    color: 'text-rose-600',
    bg: 'bg-rose-50',
    badge: 'bg-rose-100 text-rose-700',
  },
  {
    value: 'credit_memo',
    label: 'Bank Credit Memo',
    side: 'book',
    effect: '+',
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
    badge: 'bg-emerald-100 text-emerald-700',
  },
  {
    value: 'debit_memo',
    label: 'Bank Debit Memo',
    side: 'book',
    effect: '-',
    color: 'text-rose-600',
    bg: 'bg-rose-50',
    badge: 'bg-rose-100 text-rose-700',
  },
  {
    value: 'error_bank',
    label: 'Bank Error',
    side: 'bank',
    effect: '+/-',
    color: 'text-amber-600',
    bg: 'bg-amber-50',
    badge: 'bg-amber-100 text-amber-700',
  },
  {
    value: 'error_book',
    label: 'Book Error / Correction',
    side: 'book',
    effect: '+/-',
    color: 'text-amber-600',
    bg: 'bg-amber-50',
    badge: 'bg-amber-100 text-amber-700',
  },
]

const getItemType = (val) => ITEM_TYPES.find((t) => t.value === val) || ITEM_TYPES[0]

const fmt = (n) =>
  parseFloat(n || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

const emptyItemForm = () => ({
  date: new Date().toISOString().split('T')[0],
  description: '',
  reference_number: '',
  details: '',
  debit: '',
  credit: '',
  item_type: 'deposits_in_transit',
})

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────
export default function BankReconciliation() {
  const [view, setView] = useState('list')
  const [reconciliations, setReconciliations] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedReconciliation, setSelectedReconciliation] = useState(null)
  const [items, setItems] = useState([])
  const [itemsLoading, setItemsLoading] = useState(false)
  const [showItemModal, setShowItemModal] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [showToast, setShowToast] = useState(false)
  const [toastMessage, setToastMessage] = useState('')
  const [toastType, setToastType] = useState('success')
  const [chartOfAccounts, setChartOfAccounts] = useState([])
  const [activeTab, setActiveTab] = useState('all') // 'all' | 'bank' | 'book'
  const [journalEntries, setJournalEntries] = useState([])
  const [journalEntriesLoading, setJournalEntriesLoading] = useState(false)
  const [detailStartDate, setDetailStartDate] = useState('')
  const [detailEndDate, setDetailEndDate] = useState('')
  const [bankSearchTerm, setBankSearchTerm] = useState('')
  const [bookSearchTerm, setBookSearchTerm] = useState('')

  const [createFormData, setCreateFormData] = useState({
    bank_account: '',
    coa_id: '',
    bank_statement_balance: '',
    book_balance: '',
  })

  const [itemFormData, setItemFormData] = useState(emptyItemForm())
  const [itemFormRows, setItemFormRows] = useState([emptyItemForm()])

  // ── Toast ──
  const showToastMessage = (message, type = 'success') => {
    setToastMessage(message)
    setToastType(type)
    setShowToast(true)
    setTimeout(() => setShowToast(false), 3000)
  }

  // ── Fetch ──
  const fetchReconciliations = async () => {
    try {
      setLoading(true)
      setError('')
      const token = localStorage.getItem('token')
      const response = await fetch(
        `${import.meta.env.VITE_SERVER_LINK}/bank_reconciliation`,
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        },
      )
      const result = await response.json()
      if (result.success) setReconciliations(result.data || [])
      else {
        setError('Failed to fetch bank reconciliations')
        showToastMessage('Failed to load reconciliations', 'error')
      }
    } catch (err) {
      setError('Server error while fetching reconciliations')
      showToastMessage('Failed to load reconciliations', 'error')
    } finally {
      setLoading(false)
    }
  }

  const buildDateQuery = (startDate = detailStartDate, endDate = detailEndDate) => {
    const params = new URLSearchParams()
    if (startDate) params.append('start_date', startDate)
    if (endDate) params.append('end_date', endDate)
    const query = params.toString()
    return query ? `?${query}` : ''
  }

  const fetchReconciliationItems = async (
    reconciliationId,
    startDate = detailStartDate,
    endDate = detailEndDate,
  ) => {
    try {
      setItemsLoading(true)
      const token = localStorage.getItem('token')
      const response = await fetch(
        `${import.meta.env.VITE_SERVER_LINK}/bank_reconciliation/${reconciliationId}${buildDateQuery(startDate, endDate)}`,
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
        setSelectedReconciliation(result.data)
        // Fetch journal entries after reconciliation detail is loaded
        if (result.data.coa_id) {
          fetchJournalEntriesByCoa(result.data.coa_id, startDate, endDate)
        }
      } else {
        showToastMessage('Failed to load reconciliation items', 'error')
      }
    } catch (err) {
      showToastMessage('Failed to load items', 'error')
    } finally {
      setItemsLoading(false)
    }
  }

  const fetchChartOfAccounts = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(
        `${import.meta.env.VITE_SERVER_LINK}/charts_of_accounts`,
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        },
      )
      const result = await response.json()
      if (result.success) setChartOfAccounts(result.data || [])
    } catch (err) {}
  }

  const fetchJournalEntriesByCoa = async (
    coaId,
    startDate = detailStartDate,
    endDate = detailEndDate,
  ) => {
    try {
      console.log('=== Fetching Journal Entries ===')
      console.log('COA ID:', coaId)
      setJournalEntriesLoading(true)
      const token = localStorage.getItem('token')
      const url = `${import.meta.env.VITE_SERVER_LINK}/journal_entries/coa/${coaId}${buildDateQuery(startDate, endDate)}`
      console.log('Request URL:', url)
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      })
      const result = await response.json()
      console.log('Response:', result)
      if (result.success) {
        console.log(`Loaded ${result.data.length} journal entries`)
        setJournalEntries(result.data || [])
      } else {
        console.error('API Error:', result.message)
        showToastMessage('Failed to load journal entries', 'error')
      }
    } catch (err) {
      console.error('Fetch error:', err)
      showToastMessage('Failed to load journal entries', 'error')
    } finally {
      setJournalEntriesLoading(false)
    }
  }

  useEffect(() => {
    fetchReconciliations()
    fetchChartOfAccounts()
  }, [])

  useEffect(() => {
    if (view !== 'detail' || !selectedReconciliation?.id) return
    const timer = setTimeout(() => {
      fetchReconciliationItems(
        selectedReconciliation.id,
        detailStartDate,
        detailEndDate,
      )
    }, 350)

    return () => clearTimeout(timer)
  }, [detailStartDate, detailEndDate])

  // ── Create ──
  const handleCreateReconciliation = async () => {
    if (!createFormData.bank_account || !createFormData.coa_id) {
      showToastMessage('Please fill all required fields', 'error')
      return
    }
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(
        `${import.meta.env.VITE_SERVER_LINK}/bank_reconciliation`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            bank_account: createFormData.bank_account,
            coa_id: parseInt(createFormData.coa_id),
            bank_statement_balance:
              parseFloat(createFormData.bank_statement_balance) || 0,
            book_balance: parseFloat(createFormData.book_balance) || 0,
          }),
        },
      )
      const result = await response.json()
      if (result.success) {
        showToastMessage('Bank reconciliation created successfully')
        setShowCreateModal(false)
        setCreateFormData({
          bank_account: '',
          coa_id: '',
          bank_statement_balance: '',
          book_balance: '',
        })
        fetchReconciliations()
      } else {
        showToastMessage(
          result.message || 'Failed to create reconciliation',
          'error',
        )
      }
    } catch (err) {
      showToastMessage('Server error while creating reconciliation', 'error')
    }
  }

  // ── Items CRUD ──
  const handleAddOrUpdateItem = async () => {
    const rowsToSave = editingItem ? [itemFormData] : itemFormRows
    const invalidRow = rowsToSave.find((row) => {
      const debitValue = parseFloat(row.debit) || 0
      const creditValue = parseFloat(row.credit) || 0
      return !row.date || (debitValue === 0 && creditValue === 0)
    })

    if (invalidRow) {
      showToastMessage(
        'Each item needs a date and either a debit or credit amount',
        'error',
      )
      return
    }

    try {
      const token = localStorage.getItem('token')

      for (const row of rowsToSave) {
        const debitValue = parseFloat(row.debit) || 0
        const creditValue = parseFloat(row.credit) || 0
        const payload = {
          date: row.date,
          description: row.description || null,
          reference_number: row.reference_number || null,
          details: row.item_type, // store item_type in details field
          debit: debitValue,
          credit: creditValue,
          item_type: row.item_type,
        }
        const url = editingItem
          ? `${import.meta.env.VITE_SERVER_LINK}/bank_reconciliation/item/${editingItem.id}`
          : `${import.meta.env.VITE_SERVER_LINK}/bank_reconciliation/item/add`
        const method = editingItem ? 'PUT' : 'POST'
        const body = editingItem
          ? payload
          : { br_id: selectedReconciliation.id, ...payload }
        const response = await fetch(url, {
          method,
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(body),
        })
        const result = await response.json()
        if (!result.success) {
          showToastMessage(result.message || 'Failed to save item', 'error')
          return
        }
      }

      showToastMessage(
        editingItem
          ? 'Item updated successfully'
          : `${rowsToSave.length} item${rowsToSave.length === 1 ? '' : 's'} added successfully`,
      )
      await fetchReconciliationItems(selectedReconciliation.id)
      setShowItemModal(false)
      setEditingItem(null)
      resetItemForm()
    } catch (err) {
      showToastMessage('Server error while saving item', 'error')
    }
  }

  const handleEditItem = (item) => {
    setEditingItem(item)
    setItemFormData({
      date: item.date || new Date().toISOString().split('T')[0],
      description: item.description || '',
      reference_number: item.reference_number || '',
      details: item.details || '',
      debit: item.debit ? parseFloat(item.debit).toString() : '',
      credit: item.credit ? parseFloat(item.credit).toString() : '',
      item_type: item.item_type || item.details || 'deposits_in_transit',
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
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        },
      )
      const result = await response.json()
      if (result.success) {
        showToastMessage('Item deleted successfully')
        await fetchReconciliationItems(selectedReconciliation.id)
      } else {
        showToastMessage(result.message || 'Failed to delete item', 'error')
      }
    } catch (err) {
      showToastMessage('Server error while deleting item', 'error')
    }
  }

  const resetItemForm = () => {
    setItemFormData(emptyItemForm())
    setItemFormRows([emptyItemForm()])
  }

  const updateItemFormRow = (index, field, value) => {
    setItemFormRows((rows) =>
      rows.map((row, rowIndex) => {
        if (rowIndex !== index) return row
        const nextRow = { ...row, [field]: value }
        if (field === 'debit' && value) nextRow.credit = ''
        if (field === 'credit' && value) nextRow.debit = ''
        return nextRow
      }),
    )
  }

  const addItemFormRow = () => {
    setItemFormRows((rows) => [...rows, emptyItemForm()])
  }

  const removeItemFormRow = (index) => {
    setItemFormRows((rows) =>
      rows.length === 1 ? rows : rows.filter((_, rowIndex) => rowIndex !== index),
    )
  }

  // ── Reconciliation Math ──
  const computeReconciliation = () => {
    const getAdjustmentAmount = (item) => {
      const t = getItemType(item.item_type || item.details)
      const debit = parseFloat(item.debit || 0)
      const credit = parseFloat(item.credit || 0)
      const amount = Math.max(Math.abs(debit), Math.abs(credit))

      if (t.effect === '+') return amount
      if (t.effect === '-') return -amount
      return credit - debit
    }

    const journalDebit = journalEntries
      .filter((e) => e.type && e.type.toLowerCase() === 'debit')
      .reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0)
    const journalCredit = journalEntries
      .filter((e) => e.type && e.type.toLowerCase() === 'credit')
      .reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0)
    const journalBookBalance = journalDebit - journalCredit
    const savedBookBalance = parseFloat(selectedReconciliation?.running_balance || 0)
    const bookBalance =
      journalEntries.length > 0 ? journalBookBalance : savedBookBalance

    const bankStatementInput = parseFloat(
      selectedReconciliation?.bank_statement_balance || 0,
    )
    const bankStatementItems = items
    const bankStatementItemsBalance = bankStatementItems.reduce(
      (sum, item) => sum + getAdjustmentAmount(item),
      0,
    )
    const bankStatementBalance =
      bankStatementItems.length > 0 ? bankStatementItemsBalance : bankStatementInput

    const bankItems = items.filter((i) => {
      const t = getItemType(i.item_type || i.details)
      return t.side === 'bank'
    })
    const bookItems = items.filter((i) => {
      const t = getItemType(i.item_type || i.details)
      return t.side === 'book'
    })

    let bankAdj = 0
    bankItems.forEach((item) => {
      bankAdj += getAdjustmentAmount(item)
    })

    let bookAdj = 0
    bookItems.forEach((item) => {
      bookAdj += getAdjustmentAmount(item)
    })

    const sumAdjustments = (list, effect) =>
      list
        .filter(
          (item) => getItemType(item.item_type || item.details).effect === effect,
        )
        .reduce((sum, item) => sum + Math.abs(getAdjustmentAmount(item)), 0)

    const adjustedBankBalance = bankStatementBalance
    const adjustedBookBalance = bookBalance
    const difference = bankStatementBalance - bookBalance
    const isReconciled = Math.abs(difference) < 0.01

    return {
      bankStatementBalance,
      bankStatementInput,
      bankStatementItems,
      bankStatementItemsBalance,
      bookBalance,
      savedBookBalance,
      journalDebit,
      journalCredit,
      journalBookBalance,
      bankAdj,
      bookAdj,
      bankItems,
      bookItems,
      bankAdditions: sumAdjustments(bankItems, '+'),
      bankDeductions: sumAdjustments(bankItems, '-'),
      bankCorrections: bankItems
        .filter(
          (item) => getItemType(item.item_type || item.details).effect === '+/-',
        )
        .reduce((sum, item) => sum + getAdjustmentAmount(item), 0),
      bookAdditions: sumAdjustments(bookItems, '+'),
      bookDeductions: sumAdjustments(bookItems, '-'),
      bookCorrections: bookItems
        .filter(
          (item) => getItemType(item.item_type || item.details).effect === '+/-',
        )
        .reduce((sum, item) => sum + getAdjustmentAmount(item), 0),
      adjustedBankBalance,
      adjustedBookBalance,
      difference,
      isReconciled,
    }
  }

  const goBackToList = () => {
    setView('list')
    setSelectedReconciliation(null)
    setItems([])
    setJournalEntries([])
    setBankSearchTerm('')
    setBookSearchTerm('')
    setEditingItem(null)
    resetItemForm()
  }

  const goToDetail = (r) => {
    setSelectedReconciliation(r)
    setView('detail')
    fetchReconciliationItems(r.id)
  }

  // ════════════════════════════════════════════════════════════════
  // LIST VIEW
  // ════════════════════════════════════════════════════════════════
  if (view === 'list') {
    const totalBookBalance = reconciliations.reduce(
      (sum, r) => sum + (parseFloat(r.running_balance) || 0),
      0,
    )
    const totalBankStatement = reconciliations.reduce(
      (sum, r) => sum + (parseFloat(r.bank_statement_balance) || 0),
      0,
    )
    const totalDifference = totalBankStatement - totalBookBalance

    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="min-h-screen bg-[#F3F4F6]"
      >
        <div className="max-w-8xl mx-auto">
          {/* Header */}
          <div className="mb-4 flex justify-between items-start gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-black rounded-xl flex-shrink-0">
                <Scale className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <h1 className="text-3xl font-black text-black tracking-tighter leading-none">
                  Bank <span className="text-red-600 italic">Reconciliation</span>
                </h1>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-[2px] mt-1">
                  Book-to-bank matching workspace
                </p>
              </div>
            </div>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => {
                setCreateFormData({
                  bank_account: '',
                  coa_id: '',
                  bank_statement_balance: '',
                  book_balance: '',
                })
                setShowCreateModal(true)
              }}
              className="bg-black text-white px-5 py-3 rounded-xl font-black text-[11px] uppercase tracking-widest flex items-center gap-2 hover:bg-red-600 transition-all shadow-sm"
            >
              <Plus size={15} />
              New Reconciliation
            </motion.button>
          </div>

          {!loading && !error && reconciliations.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
              {[
                {
                  label: 'Bank Accounts',
                  value: reconciliations.length,
                  sub: 'Open worksheets',
                  icon: <Building2 size={18} />,
                  iconClass: 'bg-red-50 text-red-600',
                },
                {
                  label: 'Book Balance',
                  value: `₱${fmt(totalBookBalance)}`,
                  sub: 'GL running total',
                  icon: <FileText size={18} />,
                  iconClass: 'bg-gray-100 text-black',
                },
                {
                  label: 'Bank Statement',
                  value: `₱${fmt(totalBankStatement)}`,
                  sub: 'Statement total',
                  icon: <DollarSign size={18} />,
                  iconClass: 'bg-red-50 text-red-600',
                },
                {
                  label: 'Variance',
                  value: `₱${fmt(Math.abs(totalDifference))}`,
                  sub:
                    totalDifference === 0
                      ? 'Matched'
                      : totalDifference > 0
                        ? 'Bank higher'
                        : 'Books higher',
                  icon:
                    totalDifference === 0 ? (
                      <CheckCircle2 size={18} />
                    ) : (
                      <AlertCircle size={18} />
                    ),
                  iconClass:
                    Math.abs(totalDifference) < 0.01
                      ? 'bg-gray-100 text-black'
                      : 'bg-red-50 text-red-600',
                  valueClass:
                    Math.abs(totalDifference) < 0.01 ? 'text-black' : 'text-red-600',
                },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="bg-white border border-gray-100 rounded-2xl p-4 flex items-center gap-3 shadow-sm"
                >
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${stat.iconClass}`}
                  >
                    {stat.icon}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[9px] font-black uppercase tracking-[3px] text-gray-400 mb-1 whitespace-nowrap">
                      {stat.label}
                    </p>
                    <h4
                      className={`font-black leading-none truncate text-xl ${stat.valueClass || 'text-black'}`}
                    >
                      {stat.value}
                    </h4>
                    <p className="text-[9px] font-bold text-gray-300 uppercase mt-1">
                      {stat.sub}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <Loader className="w-10 h-10 text-gray-400 animate-spin mx-auto mb-3" />
                <p className="text-gray-500 text-sm">Loading reconciliations...</p>
              </div>
            </div>
          ) : error ? (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
              <AlertCircle className="text-red-600 shrink-0" size={18} />
              <span className="text-red-800 text-sm">{error}</span>
            </div>
          ) : reconciliations.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
              <Scale className="mx-auto text-gray-300 mb-4" size={48} />
              <p className="text-gray-500 font-semibold mb-2">
                No bank reconciliations yet
              </p>
              <p className="text-gray-400 text-sm mb-5">
                Create one to start comparing your books with your bank
              </p>
              <button
                onClick={() => {
                  setCreateFormData({
                    bank_account: '',
                    coa_id: '',
                    bank_statement_balance: '',
                    book_balance: '',
                  })
                  setShowCreateModal(true)
                }}
                className="text-sm font-bold text-gray-900 border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 transition"
              >
                + Create Reconciliation
              </button>
            </div>
          ) : (
            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
              <div className="px-5 py-3 bg-black border-b-4 border-red-600 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Building2 size={14} className="text-red-500" />
                  <span className="text-[11px] font-black uppercase tracking-[3px] text-white">
                    Bank Accounts
                  </span>
                  <span className="text-[10px] font-bold text-gray-600">
                    {reconciliations.length} reconciliation
                    {reconciliations.length === 1 ? '' : 's'}
                  </span>
                </div>
                <span className="text-[10px] font-black text-gray-500 uppercase tracking-[2px]">
                  Select an account to continue
                </span>
              </div>

              <div className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  <AnimatePresence>
                    {reconciliations.map((r, i) => {
                      const bookBalance = parseFloat(r.running_balance || 0)
                      const bankBalance = parseFloat(r.bank_statement_balance || 0)
                      const diff = bankBalance - bookBalance
                      const isMatched = Math.abs(diff) < 0.01

                      return (
                        <motion.button
                          type="button"
                          key={r.id}
                          className="group text-left bg-white rounded-xl border border-gray-200 hover:border-black hover:shadow-md transition-all overflow-hidden"
                          onClick={() => goToDetail(r)}
                          initial={{ opacity: 0, y: 12 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.04 }}
                          whileHover={{ y: -2 }}
                        >
                          <div className="h-1 bg-black group-hover:bg-red-600 transition-colors" />
                          <div className="p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="font-black text-black text-[15px] leading-tight truncate">
                                  {r.account_name || 'Unnamed Cash Account'}
                                </p>
                                <p className="text-[11px] text-gray-400 mt-1 font-mono truncate">
                                  {r.bank_account || 'No bank reference'}
                                </p>
                              </div>
                              <div className="w-10 h-10 rounded-xl bg-gray-50 text-gray-300 group-hover:bg-black group-hover:text-red-500 flex items-center justify-center flex-shrink-0 transition-all">
                                <Building2 size={18} />
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2 mt-4">
                              <div className="rounded-lg bg-gray-50 border border-gray-100 p-3">
                                <p className="text-[9px] font-black text-gray-400 uppercase tracking-[2px]">
                                  Book
                                </p>
                                <p className="text-sm font-black font-mono text-black mt-1 truncate">
                                  ₱{fmt(bookBalance)}
                                </p>
                              </div>
                              <div className="rounded-lg bg-gray-50 border border-gray-100 p-3">
                                <p className="text-[9px] font-black text-gray-400 uppercase tracking-[2px]">
                                  Bank
                                </p>
                                <p className="text-sm font-black font-mono text-black mt-1 truncate">
                                  ₱{fmt(bankBalance)}
                                </p>
                              </div>
                            </div>

                            <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-3">
                              <span
                                className={`px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-wider ${
                                  isMatched
                                    ? 'bg-gray-100 text-gray-700'
                                    : 'bg-red-50 text-red-700'
                                }`}
                              >
                                {isMatched
                                  ? 'Matched'
                                  : `Variance ₱${fmt(Math.abs(diff))}`}
                              </span>
                              <span className="text-[10px] font-black text-gray-400 group-hover:text-red-600 uppercase tracking-[2px] transition">
                                Open →
                              </span>
                            </div>
                          </div>
                        </motion.button>
                      )
                    })}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Create Modal */}
        <AnimatePresence>
          {showCreateModal && (
            <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
              <motion.div
                className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden"
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
              >
                <div className="bg-gray-900 px-6 py-4">
                  <h2 className="text-lg font-black text-white">
                    New Bank Reconciliation
                  </h2>
                  <p className="text-gray-400 text-xs mt-0.5">
                    Set up a new reconciliation account
                  </p>
                </div>
                <div className="p-6 space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">
                      Bank Account Name / Number *
                    </label>
                    <input
                      type="text"
                      value={createFormData.bank_account}
                      onChange={(e) =>
                        setCreateFormData({
                          ...createFormData,
                          bank_account: e.target.value,
                        })
                      }
                      placeholder="e.g. BDO Checking - 0012345678"
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-gray-900 outline-none text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">
                      Chart of Accounts *
                    </label>
                    <select
                      value={createFormData.coa_id}
                      onChange={(e) =>
                        setCreateFormData({
                          ...createFormData,
                          coa_id: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-gray-900 outline-none text-sm"
                    >
                      <option value="">-- Select Account --</option>
                      {chartOfAccounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.code} - {a.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">
                        Bank Statement Balance
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                          ₱
                        </span>
                        <input
                          type="number"
                          step="0.01"
                          value={createFormData.bank_statement_balance}
                          onChange={(e) =>
                            setCreateFormData({
                              ...createFormData,
                              bank_statement_balance: e.target.value,
                            })
                          }
                          placeholder="0.00"
                          className="w-full pl-6 pr-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 outline-none text-sm"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">
                        Book Balance (GL)
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                          ₱
                        </span>
                        <input
                          type="number"
                          step="0.01"
                          value={createFormData.book_balance}
                          onChange={(e) =>
                            setCreateFormData({
                              ...createFormData,
                              book_balance: e.target.value,
                            })
                          }
                          placeholder="0.00"
                          className="w-full pl-6 pr-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 outline-none text-sm"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={() => setShowCreateModal(false)}
                      className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-gray-700 text-sm font-bold hover:bg-gray-50 transition"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleCreateReconciliation}
                      className="flex-1 px-4 py-2.5 bg-gray-900 text-white rounded-lg text-sm font-bold hover:bg-gray-800 transition"
                    >
                      Create Reconciliation
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {showToast && (
          <DynamicToast
            message={toastMessage}
            type={toastType}
            onClose={() => setShowToast(false)}
          />
        )}
      </motion.div>
    )
  }

  // ════════════════════════════════════════════════════════════════
  // DETAIL VIEW — Proper Bank Reconciliation
  // ════════════════════════════════════════════════════════════════
  if (view === 'detail' && selectedReconciliation) {
    const recon = computeReconciliation()
    const filteredItems =
      activeTab === 'increase'
        ? items.filter((item) => {
            const t = getItemType(item.item_type || item.details)
            return (
              t.effect === '+' ||
              (t.effect === '+/-' &&
                parseFloat(item.credit || 0) - parseFloat(item.debit || 0) >= 0)
            )
          })
        : activeTab === 'decrease'
          ? items.filter((item) => {
              const t = getItemType(item.item_type || item.details)
              return (
                t.effect === '-' ||
                (t.effect === '+/-' &&
                  parseFloat(item.credit || 0) - parseFloat(item.debit || 0) < 0)
              )
            })
          : items
    const bankSearch = bankSearchTerm.toLowerCase().trim()
    const visibleBankItems = bankSearch
      ? filteredItems.filter((item) => {
          const t = getItemType(item.item_type || item.details)
          return [
            item.date,
            item.reference_number,
            item.description,
            item.details,
            t.label,
            item.debit,
            item.credit,
          ]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(bankSearch))
        })
      : filteredItems
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
            .some((value) => String(value).toLowerCase().includes(bookSearch)),
        )
      : journalEntries

    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="min-h-screen bg-gray-50"
      >
        <div className="max-w-8xl mx-auto">
          {/* ── Header ── */}
          <div className="mb-6">
            <motion.button
              whileHover={{ x: -3 }}
              onClick={goBackToList}
              className="mb-4 text-sm text-gray-500 hover:text-gray-900 flex items-center gap-1.5 font-medium transition"
            >
              <ArrowLeft size={15} />
              Back to Reconciliations
            </motion.button>
            <div className="flex justify-between items-start">
              <div>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-gray-900 rounded-lg flex items-center justify-center">
                    <Scale className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-black text-gray-900 tracking-tight">
                      Bank Reconciliation
                    </h1>
                    <p className="text-gray-500 text-sm">
                      {selectedReconciliation.account_name}
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => {
                    fetchReconciliationItems(selectedReconciliation.id)
                  }}
                  className="px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-bold text-gray-700 hover:bg-gray-50 transition flex items-center gap-2"
                >
                  <RefreshCw size={14} />
                  Refresh
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => {
                    resetItemForm()
                    setItemFormRows([emptyItemForm()])
                    setEditingItem(null)
                    setShowItemModal(true)
                  }}
                  className="bg-gray-900 text-white px-5 py-2.5 rounded-lg font-bold text-sm flex items-center gap-2 hover:bg-gray-800 transition"
                >
                  <Plus size={16} />
                  Add Item
                </motion.button>
              </div>
            </div>
          </div>

          {/* ── DATE FILTER ── */}
          <div className="bg-white border border-gray-100 rounded-2xl px-4 py-3 mb-4 flex items-center gap-3 flex-wrap shadow-sm">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
                <Calendar size={15} />
              </div>
              <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-[2px]">
                  Date Range
                </p>
                <p className="text-xs font-bold text-gray-600">
                  Filters bank items and book journal entries
                </p>
              </div>
            </div>
            <div className="hidden md:block w-px h-8 bg-gray-100" />
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-[2px]">
                From
              </span>
              <input
                type="date"
                value={detailStartDate}
                onChange={(e) => setDetailStartDate(e.target.value)}
                className="px-3 py-2 border border-gray-100 rounded-xl bg-gray-50 text-[11px] font-bold text-black outline-none focus:border-red-500 focus:bg-white transition-all"
              />
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-[2px]">
                To
              </span>
              <input
                type="date"
                value={detailEndDate}
                onChange={(e) => setDetailEndDate(e.target.value)}
                className="px-3 py-2 border border-gray-100 rounded-xl bg-gray-50 text-[11px] font-bold text-black outline-none focus:border-red-500 focus:bg-white transition-all"
              />
            </div>
            <button
              onClick={() => {
                setDetailStartDate('')
                setDetailEndDate('')
              }}
              className="px-4 py-2 border border-gray-900 rounded-xl text-[10px] font-black text-gray-900 uppercase tracking-widest hover:border-red-500 hover:text-red-600 transition-all bg-white"
            >
              Clear
            </button>
          </div>

          {/* ── RECONCILIATION STATUS BANNER ── */}
          <motion.div
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className={`rounded-xl border-2 p-5 mb-6 flex items-center justify-between ${
              recon.isReconciled
                ? 'border-gray-900 bg-white'
                : 'border-red-600 bg-red-50'
            }`}
          >
            <div className="flex items-center gap-3">
              {recon.isReconciled ? (
                <CheckCircle2 className="text-gray-900" size={28} />
              ) : (
                <AlertCircle className="text-red-600" size={28} />
              )}
              <div>
                <p
                  className={`font-black text-base ${recon.isReconciled ? 'text-gray-900' : 'text-red-700'}`}
                >
                  {recon.isReconciled
                    ? '✓ RECONCILED — Book records match bank statement'
                    : '⚠ NOT YET RECONCILED — Book-to-bank difference exists'}
                </p>
                <p
                  className={`text-sm ${recon.isReconciled ? 'text-gray-600' : 'text-red-600'}`}
                >
                  {recon.isReconciled
                    ? 'Journal entry book balance equals reconciliation item bank balance'
                    : `Difference of ₱${fmt(Math.abs(recon.difference))} — review journal entries and bank statement items`}
                </p>
              </div>
            </div>
            <div
              className={`text-right ${recon.isReconciled ? 'text-gray-900' : 'text-red-700'}`}
            >
              <p className="text-xs font-bold uppercase tracking-wider opacity-60">
                Difference
              </p>
              <p className="text-2xl font-black font-mono">
                ₱{fmt(Math.abs(recon.difference))}
              </p>
            </div>
          </motion.div>

          {/* ── TWO-COLUMN RECONCILIATION STATEMENT ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
            {/* LEFT — Book / Journal Entry Side */}
            <motion.div
              initial={{ y: 16, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="bg-white rounded-xl border border-gray-200 overflow-hidden"
            >
              <div className="bg-gray-900 px-5 py-3.5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white font-black text-sm uppercase tracking-wider">
                      Book Balance (Journal Entries)
                    </p>
                    <p className="text-gray-400 text-xs mt-0.5">
                      Cash in Bank per GL · {selectedReconciliation.account_name}
                    </p>
                  </div>
                  <FileText className="text-gray-500" size={20} />
                </div>
              </div>
              <div className="p-5">
                {/* Starting balance */}
                <div className="flex justify-between items-center py-3 border-b border-gray-100">
                  <span className="text-sm text-gray-600">Journal Entry Debits</span>
                  <span className="font-bold font-mono text-gray-900">
                    ₱{fmt(recon.journalDebit)}
                  </span>
                </div>
                <div className="flex justify-between items-center py-3 border-b border-gray-100">
                  <span className="text-sm text-gray-600">
                    Journal Entry Credits
                  </span>
                  <span className="font-bold font-mono text-red-600">
                    ₱{fmt(recon.journalCredit)}
                  </span>
                </div>

                {journalEntries.length === 0 && (
                  <div className="py-6 text-center">
                    <p className="text-gray-400 text-xs">
                      No journal entries loaded for this cash account
                    </p>
                    <p className="text-gray-300 text-xs mt-0.5">
                      Saved GL running balance is used until entries load
                    </p>
                  </div>
                )}

                {/* Adjusted bank balance */}
                <div className="mt-4 pt-4 border-t-2 border-gray-900 flex justify-between items-center">
                  <span className="text-sm font-black text-gray-900 uppercase tracking-wide">
                    Book Balance from Journal Entries
                  </span>
                  <span className="text-lg font-black text-gray-900 font-mono">
                    ₱{fmt(recon.bookBalance)}
                  </span>
                </div>
              </div>
            </motion.div>

            {/* RIGHT — Bank Statement Side */}
            <motion.div
              initial={{ y: 16, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.15 }}
              className="bg-white rounded-xl border border-gray-200 overflow-hidden"
            >
              <div className="bg-gray-800 px-5 py-3.5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white font-black text-sm uppercase tracking-wider">
                      Bank Statement Balance
                    </p>
                    <p className="text-gray-400 text-xs mt-0.5">
                      From reconciliation items ·{' '}
                      {selectedReconciliation.bank_account}
                    </p>
                  </div>
                  <Building2 className="text-gray-500" size={20} />
                </div>
              </div>
              <div className="p-5">
                {/* Starting book balance */}
                <div className="flex justify-between items-center py-3 border-b border-gray-100">
                  <span className="text-sm text-gray-600">
                    {recon.bankStatementItems.length > 0
                      ? 'Bank Statement Items Loaded'
                      : 'Manual Bank Statement Balance'}
                  </span>
                  <span className="font-bold font-mono text-gray-900">
                    {recon.bankStatementItems.length > 0
                      ? `${recon.bankStatementItems.length} item${recon.bankStatementItems.length === 1 ? '' : 's'}`
                      : `₱${fmt(recon.bankStatementInput)}`}
                  </span>
                </div>

                {/* Bank statement items */}
                {recon.bankStatementItems.length > 0 && (
                  <div className="mt-3 space-y-1">
                    {recon.bankStatementItems.filter(
                      (i) => getItemType(i.item_type || i.details).effect === '+',
                    ).length > 0 && (
                      <>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider pt-2 pb-1">
                          Add: Bank Statement Increases
                        </p>
                        {recon.bankStatementItems
                          .filter(
                            (i) =>
                              getItemType(i.item_type || i.details).effect === '+',
                          )
                          .map((item) => (
                            <div
                              key={item.id}
                              className="flex justify-between items-start py-1.5 pl-3 border-l-2 border-emerald-400"
                            >
                              <div className="flex-1 min-w-0 pr-3">
                                <p className="text-xs font-medium text-gray-700 truncate">
                                  {item.description ||
                                    getItemType(item.item_type || item.details)
                                      .label}
                                </p>
                                <p className="text-xs text-gray-400">
                                  {new Date(item.date).toLocaleDateString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric',
                                  })}
                                </p>
                              </div>
                              <span className="text-sm font-bold text-emerald-600 font-mono shrink-0">
                                +₱{fmt(item.credit || item.debit)}
                              </span>
                            </div>
                          ))}
                      </>
                    )}
                    {recon.bankStatementItems.filter(
                      (i) => getItemType(i.item_type || i.details).effect === '-',
                    ).length > 0 && (
                      <>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider pt-2 pb-1">
                          Less: Bank Statement Decreases
                        </p>
                        {recon.bankStatementItems
                          .filter(
                            (i) =>
                              getItemType(i.item_type || i.details).effect === '-',
                          )
                          .map((item) => (
                            <div
                              key={item.id}
                              className="flex justify-between items-start py-1.5 pl-3 border-l-2 border-rose-400"
                            >
                              <div className="flex-1 min-w-0 pr-3">
                                <p className="text-xs font-medium text-gray-700 truncate">
                                  {item.description ||
                                    getItemType(item.item_type || item.details)
                                      .label}
                                </p>
                                <p className="text-xs text-gray-400">
                                  {new Date(item.date).toLocaleDateString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric',
                                  })}
                                </p>
                              </div>
                              <span className="text-sm font-bold text-rose-600 font-mono shrink-0">
                                (₱{fmt(item.debit || item.credit)})
                              </span>
                            </div>
                          ))}
                      </>
                    )}
                  </div>
                )}

                {recon.bankStatementItems.length === 0 && (
                  <div className="py-6 text-center">
                    <p className="text-gray-400 text-xs">
                      No bank statement items yet
                    </p>
                    <p className="text-gray-300 text-xs mt-0.5">
                      Add bank statement deposits, checks, charges, and interest
                    </p>
                  </div>
                )}

                {/* Adjusted book balance */}
                <div className="mt-4 pt-4 border-t-2 border-gray-900 flex justify-between items-center">
                  <span className="text-sm font-black text-gray-900 uppercase tracking-wide">
                    Bank Balance from Reconciliation Items
                  </span>
                  <span className="text-lg font-black text-gray-900 font-mono">
                    ₱{fmt(recon.bankStatementBalance)}
                  </span>
                </div>
              </div>
            </motion.div>
          </div>
          {/* ── BANK STATEMENT ITEMS TABLE ── */}
          <motion.div
            initial={{ y: 16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.25 }}
            className="bg-white rounded-xl border border-gray-200 overflow-hidden"
          >
            {/* Table Header + Tabs */}
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-3">
              <h2 className="font-black text-gray-900">
                Bank Statement Items{' '}
                <span className="text-gray-400 font-normal text-sm ml-1">
                  ({visibleBankItems.length}/{items.length})
                </span>
              </h2>
              {/* Filter tabs */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 h-9 focus-within:border-red-500 focus-within:bg-white transition-all">
                  <Search size={14} className="text-gray-300 flex-shrink-0" />
                  <input
                    type="text"
                    placeholder="Search bank items..."
                    value={bankSearchTerm}
                    onChange={(e) => setBankSearchTerm(e.target.value)}
                    className="w-48 bg-transparent border-none outline-none text-[12px] font-bold text-black placeholder:text-gray-300"
                  />
                  {bankSearchTerm && (
                    <button
                      onClick={() => setBankSearchTerm('')}
                      className="text-gray-300 hover:text-red-500 leading-none"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>
                <div className="flex bg-gray-100 rounded-lg p-0.5 text-xs font-bold">
                  {[
                    ['all', 'All Items'],
                    ['increase', 'Increases'],
                    ['decrease', 'Decreases'],
                  ].map(([val, label]) => (
                    <button
                      key={val}
                      onClick={() => setActiveTab(val)}
                      className={`px-3 py-1.5 rounded-md transition ${activeTab === val ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {itemsLoading ? (
              <div className="flex items-center justify-center p-12">
                <Loader className="w-8 h-8 text-gray-400 animate-spin" />
              </div>
            ) : visibleBankItems.length === 0 ? (
              <div className="p-12 text-center">
                <Scale className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                <p className="text-gray-500 text-sm font-medium">No items yet</p>
                <p className="text-gray-400 text-xs mt-1">
                  Click "Add Item" to add bank statement items
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="px-5 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-5 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                        Type
                      </th>
                      <th className="px-5 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                        Reference
                      </th>
                      <th className="px-5 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                        Description
                      </th>
                      <th className="px-5 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">
                        Debit
                      </th>
                      <th className="px-5 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">
                        Credit
                      </th>
                      <th className="px-5 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">
                        Bank Effect
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleBankItems.map((item, idx) => {
                      const t = getItemType(item.item_type || item.details)
                      const debitVal = parseFloat(item.debit || 0)
                      const creditVal = parseFloat(item.credit || 0)
                      const amount = Math.max(
                        Math.abs(debitVal),
                        Math.abs(creditVal),
                      )
                      const bankEffect =
                        t.effect === '+'
                          ? amount
                          : t.effect === '-'
                            ? -amount
                            : creditVal - debitVal
                      return (
                        <motion.tr
                          key={item.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: idx * 0.03 }}
                          className="border-b border-gray-50 hover:bg-gray-50 transition group cursor-pointer"
                          onClick={() => handleEditItem(item)}
                        >
                          <td className="px-5 py-3.5 text-sm text-gray-600 whitespace-nowrap">
                            {new Date(item.date).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </td>
                          <td className="px-5 py-3.5">
                            <span
                              className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${t.badge}`}
                            >
                              {t.label}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-sm text-gray-500 font-mono">
                            {item.reference_number || '—'}
                          </td>
                          <td className="px-5 py-3.5 text-sm text-gray-700 max-w-xs truncate">
                            {item.description || '—'}
                          </td>
                          <td className="px-5 py-3.5 text-sm font-bold font-mono text-right text-blue-600">
                            {debitVal > 0 ? `₱${fmt(debitVal)}` : '—'}
                          </td>
                          <td className="px-5 py-3.5 text-sm font-bold font-mono text-right text-purple-600">
                            {creditVal > 0 ? `₱${fmt(creditVal)}` : '—'}
                          </td>
                          <td className="px-5 py-3.5 text-sm font-bold font-mono text-right text-gray-900">
                            <span
                              className={
                                bankEffect < 0 ? 'text-red-600' : 'text-gray-900'
                              }
                            >
                              {bankEffect < 0 ? '-' : '+'}₱
                              {fmt(Math.abs(bankEffect))}
                            </span>
                          </td>
                        </motion.tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-50 border-t-2 border-gray-900">
                      <td
                        colSpan="4"
                        className="px-5 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider"
                      >
                        TOTALS:
                      </td>
                      <td className="px-5 py-3 text-right text-sm font-black text-blue-600 font-mono">
                        ₱
                        {fmt(
                          visibleBankItems.reduce(
                            (sum, item) => sum + (parseFloat(item.debit) || 0),
                            0,
                          ),
                        )}
                      </td>
                      <td className="px-5 py-3 text-right text-sm font-black text-purple-600 font-mono">
                        ₱
                        {fmt(
                          visibleBankItems.reduce(
                            (sum, item) => sum + (parseFloat(item.credit) || 0),
                            0,
                          ),
                        )}
                      </td>
                      <td className="px-5 py-3 text-right text-sm font-black text-gray-900 font-mono">
                        ₱
                        {fmt(
                          visibleBankItems.reduce((sum, item) => {
                            const t = getItemType(item.item_type || item.details)
                            const debitVal = parseFloat(item.debit || 0)
                            const creditVal = parseFloat(item.credit || 0)
                            const amount = Math.max(
                              Math.abs(debitVal),
                              Math.abs(creditVal),
                            )
                            if (t.effect === '+') return sum + amount
                            if (t.effect === '-') return sum - amount
                            return sum + creditVal - debitVal
                          }, 0),
                        )}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </motion.div>

          {/* ── BOOK RECORDS / JOURNAL ENTRIES ── */}
          <motion.div
            initial={{ y: 16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="bg-white rounded-xl border border-gray-200 overflow-hidden mt-6"
          >
            <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 bg-indigo-600 rounded flex items-center justify-center">
                  <FileText className="w-3 h-3 text-white" />
                </div>
                <div>
                  <h3 className="font-black text-sm text-gray-900 uppercase tracking-wider">
                    Book Records - Journal Entries (GL)
                  </h3>
                  <p className="text-xs text-gray-400">
                    {visibleJournalEntries.length}/{journalEntries.length} entries
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 h-9 focus-within:border-red-500 focus-within:bg-white transition-all">
                  <Search size={14} className="text-gray-300 flex-shrink-0" />
                  <input
                    type="text"
                    placeholder="Search book entries..."
                    value={bookSearchTerm}
                    onChange={(e) => setBookSearchTerm(e.target.value)}
                    className="w-52 bg-transparent border-none outline-none text-[12px] font-bold text-black placeholder:text-gray-300"
                  />
                  {bookSearchTerm && (
                    <button
                      onClick={() => setBookSearchTerm('')}
                      className="text-gray-300 hover:text-red-500 leading-none"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>
                {journalEntriesLoading && (
                  <div className="text-xs font-medium text-gray-500 flex items-center gap-1">
                    <Loader className="w-3 h-3 animate-spin" />
                    Loading...
                  </div>
                )}
              </div>
            </div>

            {journalEntriesLoading ? (
              <div className="p-6 flex items-center justify-center h-40">
                <div className="text-center">
                  <Loader className="w-10 h-10 text-gray-300 animate-spin mx-auto mb-2" />
                  <p className="text-gray-500 text-xs">Loading journal entries...</p>
                </div>
              </div>
            ) : visibleJournalEntries.length === 0 ? (
              <div className="p-6 text-center">
                <p className="text-gray-400 text-sm font-medium">
                  No journal entries found for this account
                </p>
                <p className="text-gray-300 text-xs mt-1">
                  Journal entries will appear here once they are created
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="px-5 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-5 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                        Reference
                      </th>
                      <th className="px-5 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                        Description
                      </th>
                      <th className="px-5 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">
                        Debit
                      </th>
                      <th className="px-5 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">
                        Credit
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleJournalEntries.map((entry) => {
                      const isDebit =
                        entry.type && entry.type.toLowerCase() === 'debit'
                      return (
                        <motion.tr
                          key={entry.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="border-b border-gray-50 hover:bg-indigo-50/30 transition"
                        >
                          <td className="px-5 py-3 text-sm text-gray-600">
                            {new Date(entry.date).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </td>
                          <td className="px-5 py-3 text-sm text-gray-700 font-mono font-medium">
                            {entry.db_name || '—'}
                          </td>
                          <td className="px-5 py-3 text-sm text-gray-700">
                            {entry.responsibility_center || '—'}
                          </td>
                          <td
                            className={`px-5 py-3 text-right text-sm font-mono font-bold ${
                              isDebit ? 'text-blue-600' : 'text-gray-400'
                            }`}
                          >
                            {isDebit ? `₱${fmt(entry.amount)}` : '—'}
                          </td>
                          <td
                            className={`px-5 py-3 text-right text-sm font-mono font-bold ${
                              !isDebit ? 'text-purple-600' : 'text-gray-400'
                            }`}
                          >
                            {!isDebit ? `₱${fmt(entry.amount)}` : '—'}
                          </td>
                        </motion.tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-50 border-t-2 border-gray-900">
                      <td
                        colSpan="3"
                        className="px-5 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider"
                      >
                        TOTALS:
                      </td>
                      <td className="px-5 py-3 text-right text-sm font-black text-blue-600 font-mono">
                        ₱
                        {fmt(
                          visibleJournalEntries
                            .filter(
                              (e) => e.type && e.type.toLowerCase() === 'debit',
                            )
                            .reduce(
                              (sum, e) => sum + (parseFloat(e.amount) || 0),
                              0,
                            ),
                        )}
                      </td>
                      <td className="px-5 py-3 text-right text-sm font-black text-purple-600 font-mono">
                        ₱
                        {fmt(
                          visibleJournalEntries
                            .filter(
                              (e) => e.type && e.type.toLowerCase() === 'credit',
                            )
                            .reduce(
                              (sum, e) => sum + (parseFloat(e.amount) || 0),
                              0,
                            ),
                        )}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </motion.div>
        </div>

        {/* ── ITEM MODAL ── */}
        <AnimatePresence>
          {showItemModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm"
              onClick={() => {
                setShowItemModal(false)
                setEditingItem(null)
              }}
            >
              <motion.div
                initial={{ scale: 0.95, y: 16 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 16 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-2xl shadow-2xl max-w-xl w-full overflow-hidden"
              >
                <div className="bg-gray-900 px-6 py-4">
                  <h3 className="text-base font-black text-white">
                    {editingItem
                      ? 'Edit Reconciliation Item'
                      : 'Add Reconciliation Item'}
                  </h3>
                  <p className="text-gray-400 text-xs mt-0.5">
                    Categorize correctly — this determines which side of the
                    reconciliation it affects
                  </p>
                </div>

                <div className="p-6 overflow-y-auto max-h-[70vh]">
                  {editingItem ? (
                    <>
                      {/* Item Type — most important field, shown first */}
                      <div className="mb-5">
                        <label className="block text-xs font-bold text-gray-700 mb-2 uppercase tracking-wider">
                          Item Type *
                        </label>
                        <select
                          value={itemFormData.item_type}
                          onChange={(e) =>
                            setItemFormData({
                              ...itemFormData,
                              item_type: e.target.value,
                            })
                          }
                          className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 outline-none text-sm font-medium"
                        >
                          <optgroup label="Bank Statement Increases">
                            {ITEM_TYPES.filter((t) => t.effect === '+').map((t) => (
                              <option key={t.value} value={t.value}>
                                {t.label} ({t.effect})
                              </option>
                            ))}
                          </optgroup>
                          <optgroup label="Bank Statement Decreases">
                            {ITEM_TYPES.filter((t) => t.effect === '-').map((t) => (
                              <option key={t.value} value={t.value}>
                                {t.label} ({t.effect})
                              </option>
                            ))}
                          </optgroup>
                          <optgroup label="Corrections / Errors">
                            {ITEM_TYPES.filter((t) => t.effect === '+/-').map(
                              (t) => (
                                <option key={t.value} value={t.value}>
                                  {t.label} ({t.effect})
                                </option>
                              ),
                            )}
                          </optgroup>
                        </select>
                        {/* Explanation chip */}
                        {itemFormData.item_type &&
                          (() => {
                            const t = getItemType(itemFormData.item_type)
                            return (
                              <div
                                className={`mt-2 px-3 py-2 rounded-lg text-xs font-medium ${t.bg} ${t.color}`}
                              >
                                <span className="font-bold">{t.label}</span> is
                                recorded as a bank statement item and{' '}
                                {t.effect === '+'
                                  ? 'increases'
                                  : t.effect === '-'
                                    ? 'decreases'
                                    : 'corrects'}{' '}
                                the bank-side balance.
                              </div>
                            )
                          })()}
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
                              setItemFormData({
                                ...itemFormData,
                                date: e.target.value,
                              })
                            }
                            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 outline-none text-sm"
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
                            placeholder="Check no., Receipt no."
                            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 outline-none text-sm"
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
                            placeholder="e.g. Service charge for April, Deposit for check #1234"
                            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 outline-none text-sm"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">
                            Debit Amount
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
                              className="w-full pl-7 pr-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 outline-none text-sm"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">
                            Credit Amount
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
                              className="w-full pl-7 pr-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 outline-none text-sm"
                            />
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-black text-gray-900 uppercase tracking-wider">
                            Batch Reconciliation Items
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            Add deposits in transit, outstanding checks, bank
                            charges, and other reconciling items in one save.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={addItemFormRow}
                          className="px-3 py-2 bg-black text-white rounded-lg text-xs font-black hover:bg-red-600 transition flex items-center gap-1.5"
                        >
                          <Plus size={13} />
                          Add Row
                        </button>
                      </div>

                      <div className="space-y-3">
                        {itemFormRows.map((row, index) => {
                          const t = getItemType(row.item_type)
                          return (
                            <div
                              key={index}
                              className="border border-gray-200 rounded-xl p-4 bg-white"
                            >
                              <div className="flex items-center justify-between mb-3">
                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-[2px]">
                                  Item {index + 1}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => removeItemFormRow(index)}
                                  disabled={itemFormRows.length === 1}
                                  className="w-8 h-8 rounded-lg border border-gray-200 text-gray-400 hover:text-red-600 hover:border-red-200 disabled:opacity-40 disabled:hover:text-gray-400 disabled:hover:border-gray-200 flex items-center justify-center"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div className="md:col-span-2">
                                  <label className="block text-[10px] font-black text-gray-500 mb-1 uppercase tracking-wider">
                                    Item Type *
                                  </label>
                                  <select
                                    value={row.item_type}
                                    onChange={(e) =>
                                      updateItemFormRow(
                                        index,
                                        'item_type',
                                        e.target.value,
                                      )
                                    }
                                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 outline-none text-sm font-medium"
                                  >
                                    <optgroup label="Bank Statement Increases">
                                      {ITEM_TYPES.filter(
                                        (type) => type.effect === '+',
                                      ).map((type) => (
                                        <option key={type.value} value={type.value}>
                                          {type.label} ({type.effect})
                                        </option>
                                      ))}
                                    </optgroup>
                                    <optgroup label="Bank Statement Decreases">
                                      {ITEM_TYPES.filter(
                                        (type) => type.effect === '-',
                                      ).map((type) => (
                                        <option key={type.value} value={type.value}>
                                          {type.label} ({type.effect})
                                        </option>
                                      ))}
                                    </optgroup>
                                    <optgroup label="Corrections / Errors">
                                      {ITEM_TYPES.filter(
                                        (type) => type.effect === '+/-',
                                      ).map((type) => (
                                        <option key={type.value} value={type.value}>
                                          {type.label} ({type.effect})
                                        </option>
                                      ))}
                                    </optgroup>
                                  </select>
                                  <div
                                    className={`mt-2 px-3 py-2 rounded-lg text-xs font-medium ${t.bg} ${t.color}`}
                                  >
                                    <span className="font-bold">{t.label}</span> is a
                                    bank statement item used for the bank-side
                                    balance.
                                  </div>
                                </div>

                                <div>
                                  <label className="block text-[10px] font-black text-gray-500 mb-1 uppercase tracking-wider">
                                    Date *
                                  </label>
                                  <input
                                    type="date"
                                    value={row.date}
                                    onChange={(e) =>
                                      updateItemFormRow(
                                        index,
                                        'date',
                                        e.target.value,
                                      )
                                    }
                                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 outline-none text-sm"
                                  />
                                </div>

                                <div>
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
                                    placeholder="Check no., receipt no."
                                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 outline-none text-sm"
                                  />
                                </div>

                                <div className="md:col-span-2">
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
                                    placeholder="e.g. Service charge, deposit, outstanding check"
                                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 outline-none text-sm"
                                  />
                                </div>

                                <div>
                                  <label className="block text-[10px] font-black text-gray-500 mb-1 uppercase tracking-wider">
                                    Debit Amount
                                  </label>
                                  <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                                      ₱
                                    </span>
                                    <input
                                      type="number"
                                      step="0.01"
                                      value={row.debit}
                                      onChange={(e) =>
                                        updateItemFormRow(
                                          index,
                                          'debit',
                                          e.target.value,
                                        )
                                      }
                                      placeholder="0.00"
                                      className="w-full pl-7 pr-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 outline-none text-sm"
                                    />
                                  </div>
                                </div>

                                <div>
                                  <label className="block text-[10px] font-black text-gray-500 mb-1 uppercase tracking-wider">
                                    Credit Amount
                                  </label>
                                  <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                                      ₱
                                    </span>
                                    <input
                                      type="number"
                                      step="0.01"
                                      value={row.credit}
                                      onChange={(e) =>
                                        updateItemFormRow(
                                          index,
                                          'credit',
                                          e.target.value,
                                        )
                                      }
                                      placeholder="0.00"
                                      className="w-full pl-7 pr-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 outline-none text-sm"
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  <div className="flex gap-3 mt-6">
                    <button
                      onClick={() => {
                        setShowItemModal(false)
                        setEditingItem(null)
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
                        : `Add ${itemFormRows.length} Item${itemFormRows.length === 1 ? '' : 's'}`}
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {showToast && (
          <DynamicToast
            message={toastMessage}
            type={toastType}
            onClose={() => setShowToast(false)}
          />
        )}
      </motion.div>
    )
  }

  return null
}
