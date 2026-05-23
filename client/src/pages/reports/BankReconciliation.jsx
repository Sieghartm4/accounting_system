import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus,
  Building2,
  AlertCircle,
  Loader,
  CheckCircle2,
  Scale,
  TrendingUp,
  TrendingDown,
  Minus,
} from 'lucide-react'
import DynamicToast from '../../components/DynamicToast'
import BankReconciliationDetail from './BankReconciliationDetail'
import { getItemSection, getItemMeta } from './useBankReconciliation'

const fmt = (n) =>
  parseFloat(n || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

export default function BankReconciliation() {
  const [view, setView] = useState('list')
  const [reconciliations, setReconciliations] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedReconciliation, setSelectedReconciliation] = useState(null)
  const [chartOfAccounts, setChartOfAccounts] = useState([])
  const [showToast, setShowToast] = useState(false)
  const [toastMessage, setToastMessage] = useState('')
  const [toastType, setToastType] = useState('success')
  const [createFormData, setCreateFormData] = useState({
    bank_account: '',
    coa_id: '',
    bank_statement_balance: '',
  })
  const [reconciliationSummaries, setReconciliationSummaries] = useState({})

  const showToastMessage = (message, type = 'success') => {
    setToastMessage(message)
    setToastType(type)
    setShowToast(true)
    setTimeout(() => setShowToast(false), 3000)
  }

  const formatLocalDate = (d) => {
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

  const buildDateQuery = (start, end) => {
    const params = new URLSearchParams()
    if (start) params.append('start_date', start)
    if (end) params.append('end_date', end)
    const queryString = params.toString()
    return queryString ? `?${queryString}` : ''
  }

  const fetchReconciliationSummaries = async (reconciliationsList) => {
    const token = localStorage.getItem('token')
    const [startDate, endDate] = getCurrentMonthRange()
    const queryString = buildDateQuery(startDate, endDate)
    const summaries = {}

    await Promise.all(
      reconciliationsList.map(async (reconciliation) => {
        try {
          const detailResponse = await fetch(
            `${import.meta.env.VITE_SERVER_LINK}/bank_reconciliation/${reconciliation.id}${queryString}`,
            {
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
            },
          )
          const detailResult = await detailResponse.json()

          const adjustmentsResponse = await fetch(
            `${import.meta.env.VITE_SERVER_LINK}/bank_reconciliation/${reconciliation.id}/adjustments${queryString}`,
            {
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
            },
          )
          const adjustmentsResult = await adjustmentsResponse.json()

          const journalResponse = reconciliation.coa_id
            ? await fetch(
                `${import.meta.env.VITE_SERVER_LINK}/journal_entries/coa/${reconciliation.coa_id}${queryString}`,
                {
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                  },
                },
              )
            : null
          const journalResult = journalResponse
            ? await journalResponse.json()
            : { success: false, data: [] }

          if (!detailResult.success) return

          const items = detailResult.data.items || []
          const adjustments = adjustmentsResult.success
            ? adjustmentsResult.data || []
            : []
          const journalEntries = journalResult.success
            ? journalResult.data || []
            : []

          const bankSectionItems = items.filter(
            (item) => getItemSection(item) === 'BANK',
          )
          const bookSectionItems = items.filter(
            (item) => getItemSection(item) === 'BOOK',
          )

          const depositsInTransit = bankSectionItems
            .filter(
              (item) =>
                (item.bri_details || item.details || item.item_type) ===
                'deposits_in_transit',
            )
            .reduce((sum, item) => {
              const debit = Math.abs(parseFloat(item.bri_debit || item.debit || 0))
              return sum + debit
            }, 0)

          const outstandingChecks = bankSectionItems
            .filter(
              (item) =>
                (item.bri_details || item.details || item.item_type) ===
                'outstanding_checks',
            )
            .reduce((sum, item) => {
              const credit = Math.abs(
                parseFloat(item.bri_credit || item.credit || 0),
              )
              return sum + credit
            }, 0)

          const bookAdditions = bookSectionItems
            .filter(
              (item) =>
                getItemMeta(item.bri_details || item.details || item.item_type)
                  .effect === 'add',
            )
            .reduce((sum, item) => {
              const debit = Math.abs(parseFloat(item.bri_debit || item.debit || 0))
              const credit = Math.abs(
                parseFloat(item.bri_credit || item.credit || 0),
              )
              return sum + Math.max(debit, credit)
            }, 0)

          const bookDeductions = bookSectionItems
            .filter(
              (item) =>
                getItemMeta(item.bri_details || item.details || item.item_type)
                  .effect === 'deduct',
            )
            .reduce((sum, item) => {
              const debit = Math.abs(parseFloat(item.bri_debit || item.debit || 0))
              const credit = Math.abs(
                parseFloat(item.bri_credit || item.credit || 0),
              )
              return sum + Math.max(debit, credit)
            }, 0)

          const bookErrorAdjustments = bookSectionItems
            .filter(
              (item) =>
                (item.bri_details || item.details || item.item_type) ===
                'error_book',
            )
            .reduce((sum, item) => {
              const c = parseFloat(item.bri_credit || item.credit || 0)
              const d = parseFloat(item.bri_debit || item.debit || 0)
              return sum + (c - d)
            }, 0)

          const bankCardAdditions = adjustments
            .filter(
              (adj) => adj.side === 'BANK' && adj.type === 'deposits_in_transit',
            )
            .reduce((sum, adj) => sum + (parseFloat(adj.amount) || 0), 0)

          const bankCardDeductions = adjustments
            .filter(
              (adj) => adj.side === 'BANK' && adj.type === 'outstanding_checks',
            )
            .reduce((sum, adj) => sum + (parseFloat(adj.amount) || 0), 0)

          const bankCardErrors = adjustments
            .filter((adj) => adj.side === 'BANK' && adj.type === 'error_bank')
            .reduce((sum, adj) => sum + (parseFloat(adj.amount) || 0), 0)

          const bookCardAdditions = adjustments
            .filter((adj) => adj.side === 'BOOK')
            .filter((adj) => getItemMeta(adj.type).effect === 'add')
            .reduce((sum, adj) => sum + (parseFloat(adj.amount) || 0), 0)

          const bookCardDeductions = adjustments
            .filter((adj) => adj.side === 'BOOK')
            .filter((adj) => getItemMeta(adj.type).effect === 'deduct')
            .reduce((sum, adj) => sum + (parseFloat(adj.amount) || 0), 0)

          const bookCardErrors = adjustments
            .filter((adj) => adj.side === 'BOOK' && adj.type === 'error_book')
            .reduce((sum, adj) => sum + (parseFloat(adj.amount) || 0), 0)

          const glDebits = journalEntries
            .filter((e) => e.type?.toLowerCase() === 'debit')
            .reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0)

          const glCredits = journalEntries
            .filter((e) => e.type?.toLowerCase() === 'credit')
            .reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0)

          const endingBookBalance = journalEntries.length
            ? glDebits - glCredits
            : parseFloat(detailResult.data.running_balance || 0)

          const adjustedBankBalance =
            parseFloat(detailResult.data.bank_statement_balance || 0) +
            depositsInTransit -
            outstandingChecks +
            bankCardAdditions -
            bankCardDeductions +
            bankCardErrors

          const adjustedBookBalance =
            endingBookBalance +
            bookAdditions +
            bookCardAdditions -
            bookDeductions -
            bookCardDeductions +
            bookErrorAdjustments +
            bookCardErrors

          const reconDifference = adjustedBookBalance - adjustedBankBalance

          summaries[reconciliation.id] = {
            bankStatementBalance: parseFloat(
              detailResult.data.bank_statement_balance || 0,
            ),
            glBalance: endingBookBalance,
            adjustedBankBalance,
            adjustedBookBalance,
            reconDifference,
            isReconciled: Math.abs(reconDifference) < 0.01,
            items,
            adjustments,
            journalEntries,
          }
        } catch (error) {
          console.error(
            'Failed to fetch summary for reconciliation',
            reconciliation.id,
            error,
          )
        }
      }),
    )

    setReconciliationSummaries(summaries)
  }

  const fetchReconciliations = async () => {
    try {
      setLoading(true)
      setError('')
      const token = localStorage.getItem('token')
      const res = await fetch(
        `${import.meta.env.VITE_SERVER_LINK}/bank_reconciliation`,
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        },
      )
      const result = await res.json()
      if (result.success) {
        const list = result.data || []
        setReconciliations(list)
        fetchReconciliationSummaries(list)
      } else {
        setError('Failed to fetch bank reconciliations')
        showToastMessage('Failed to load reconciliations', 'error')
      }
    } catch {
      setError('Server error while fetching reconciliations')
      showToastMessage('Failed to load reconciliations', 'error')
    } finally {
      setLoading(false)
    }
  }

  const fetchChartOfAccounts = async () => {
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(
        `${import.meta.env.VITE_SERVER_LINK}/charts_of_accounts`,
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        },
      )
      const result = await res.json()
      if (result.success) setChartOfAccounts(result.data || [])
    } catch {}
  }

  useEffect(() => {
    fetchReconciliations()
    fetchChartOfAccounts()
  }, [])

  const handleCreateReconciliation = async () => {
    if (!createFormData.bank_account || !createFormData.coa_id) {
      showToastMessage('Please fill all required fields', 'error')
      return
    }
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(
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
          }),
        },
      )
      const result = await res.json()
      if (result.success) {
        showToastMessage('Bank reconciliation created successfully')
        setShowCreateModal(false)
        setCreateFormData({
          bank_account: '',
          coa_id: '',
          bank_statement_balance: '',
        })
        fetchReconciliations()
      } else {
        showToastMessage(
          result.message || 'Failed to create reconciliation',
          'error',
        )
      }
    } catch {
      showToastMessage('Server error while creating reconciliation', 'error')
    }
  }

  if (view === 'detail' && selectedReconciliation) {
    return (
      <BankReconciliationDetail
        selectedReconciliation={selectedReconciliation}
        onBack={() => {
          setView('list')
          setSelectedReconciliation(null)
        }}
      />
    )
  }

  // ── Summary stats using the proper two-section method ──
  // Adjusted Bank = Bank Statement + Deposits in Transit - Outstanding Checks - Bank Errors
  // Adjusted Book = GL Balance + Interest/Credits - Fees/NSF/Debits + Book Errors
  // Both sides should equal each other when reconciled
  const totalBankStatement = reconciliations.reduce((sum, r) => {
    const summary = reconciliationSummaries[r.id] || {}
    const bankValue =
      typeof summary.bankStatementBalance === 'number'
        ? summary.bankStatementBalance
        : parseFloat(r.bank_statement_balance || 0)
    return sum + bankValue
  }, 0)

  const totalBookBalance = reconciliations.reduce((sum, r) => {
    const summary = reconciliationSummaries[r.id] || {}
    const bookValue =
      typeof summary.glBalance === 'number'
        ? summary.glBalance
        : parseFloat(r.running_balance || 0)
    return sum + bookValue
  }, 0)

  const totalVariance = totalBankStatement - totalBookBalance
  const reconciledCount = reconciliations.filter((r) => {
    const summary = reconciliationSummaries[r.id] || {}
    const diff =
      typeof summary.reconDifference === 'number'
        ? summary.reconDifference
        : parseFloat(r.bank_statement_balance || 0) -
          parseFloat(r.running_balance || 0)
    return Math.abs(diff) < 0.01
  }).length

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen bg-[#F3F4F6]"
    >
      <div className="max-w-8xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex justify-between items-start gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-black rounded-xl flex-shrink-0">
              <Scale className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-black tracking-tighter leading-none">
                Bank <span className="text-red-600 italic">Reconciliation</span>
              </h1>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-[2px] mt-1">
                Two-Section Book-to-Bank Matching
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
              })
              setShowCreateModal(true)
            }}
            className="bg-black text-white px-5 py-3 rounded-xl font-black text-[11px] uppercase tracking-widest flex items-center gap-2 hover:bg-red-600 transition-all shadow-sm"
          >
            <Plus size={15} />
            New Reconciliation
          </motion.button>
        </div>

        {/* Method explanation banner */}
        <div className="bg-white border border-gray-100 rounded-2xl p-4 mb-5 shadow-sm">
          <div className="flex items-start gap-4 flex-wrap">
            <div className="flex-1 min-w-60">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-[2px] mb-2">
                How it works — Two-Section Method
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="bg-blue-50 rounded-xl p-3 border border-blue-100">
                  <p className="text-[9px] font-black text-blue-500 uppercase tracking-[2px] mb-1">
                    Section 1 — Bank Side
                  </p>
                  <p className="text-xs text-blue-800 font-medium">
                    Bank Statement Balance
                    <br />
                    <span className="text-emerald-600">+ Deposits in Transit</span>
                    <br />
                    <span className="text-red-600">− Outstanding Checks</span>
                    <br />
                    <span className="text-amber-600">± Bank Errors</span>
                    <br />
                    <span className="font-black">= Adjusted Bank Balance</span>
                  </p>
                </div>
                <div className="bg-violet-50 rounded-xl p-3 border border-violet-100">
                  <p className="text-[9px] font-black text-violet-500 uppercase tracking-[2px] mb-1">
                    Section 2 — Book Side
                  </p>
                  <p className="text-xs text-violet-800 font-medium">
                    GL Book Balance
                    <br />
                    <span className="text-emerald-600">
                      + Interest / EFT Credits
                    </span>
                    <br />
                    <span className="text-red-600">− Service Fees / NSF</span>
                    <br />
                    <span className="text-amber-600">± Book Errors</span>
                    <br />
                    <span className="font-black">= Adjusted Book Balance</span>
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 self-center">
              <div className="text-center px-4 py-3 bg-gray-50 rounded-xl border border-gray-200">
                <p className="text-[9px] font-black text-gray-400 uppercase tracking-[2px]">
                  Reconciled
                </p>
                <p className="text-2xl font-black text-black">
                  {reconciledCount}/{reconciliations.length}
                </p>
                <p className="text-[9px] font-bold text-gray-400">accounts</p>
              </div>
            </div>
          </div>
        </div>

        {/* Stats */}
        {!loading && !error && reconciliations.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
            {[
              {
                label: 'Total Bank Statements',
                value: `₱${fmt(totalBankStatement)}`,
                sub: 'Ending per bank',
                icon: <Building2 size={18} />,
                iconClass: 'bg-blue-50 text-blue-600',
                valueClass: 'text-blue-700',
              },
              {
                label: 'Total GL Book Balance',
                value: `₱${fmt(totalBookBalance)}`,
                sub: 'Per general ledger',
                icon: <Scale size={18} />,
                iconClass: 'bg-violet-50 text-violet-600',
                valueClass: 'text-violet-700',
              },
              {
                label: 'Unreconciled Variance',
                value: `₱${fmt(Math.abs(totalVariance))}`,
                sub:
                  totalVariance === 0
                    ? 'Fully matched'
                    : totalVariance > 0
                      ? 'Bank exceeds books'
                      : 'Books exceed bank',
                icon:
                  totalVariance === 0 ? (
                    <CheckCircle2 size={18} />
                  ) : Math.abs(totalVariance) > 0 ? (
                    <TrendingUp size={18} />
                  ) : (
                    <TrendingDown size={18} />
                  ),
                iconClass:
                  Math.abs(totalVariance) < 0.01
                    ? 'bg-emerald-50 text-emerald-600'
                    : 'bg-red-50 text-red-600',
                valueClass:
                  Math.abs(totalVariance) < 0.01
                    ? 'text-emerald-700'
                    : 'text-red-700',
              },
            ].map((stat) => (
              <div
                key={stat.label}
                className="bg-white border border-gray-100 rounded-2xl p-4 flex items-center gap-3 shadow-sm"
              >
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${stat.iconClass}`}
                >
                  {stat.icon}
                </div>
                <div className="min-w-0">
                  <p className="text-[9px] font-black uppercase tracking-[3px] text-gray-400 mb-1">
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

        {/* Main Content */}
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
              Create one to start reconciling your bank statement to your books
            </p>
            <button
              onClick={() => {
                setCreateFormData({
                  bank_account: '',
                  coa_id: '',
                  bank_statement_balance: '',
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
                <span className="text-[10px] font-bold text-gray-500 ml-1">
                  {reconciliations.length} reconciliation
                  {reconciliations.length === 1 ? '' : 's'}
                </span>
              </div>
              <span className="text-[10px] font-black text-gray-500 uppercase tracking-[2px]">
                Select an account to open the reconciliation worksheet
              </span>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                <AnimatePresence>
                  {reconciliations.map((r, i) => {
                    const summary = reconciliationSummaries[r.id] || {}
                    const bankStatement =
                      summary.bankStatementBalance ??
                      parseFloat(r.bank_statement_balance || 0)
                    const glBalance =
                      summary.glBalance ?? parseFloat(r.running_balance || 0)
                    const effectiveDiff =
                      typeof summary.reconDifference === 'number'
                        ? summary.reconDifference
                        : bankStatement - glBalance
                    const isReconciled =
                      typeof summary.isReconciled === 'boolean'
                        ? summary.isReconciled
                        : Math.abs(effectiveDiff) < 0.01
                    const adjustedBankBalance = summary.adjustedBankBalance
                    const adjustedBookBalance = summary.adjustedBookBalance

                    return (
                      <motion.button
                        type="button"
                        key={r.id}
                        className="group text-left bg-white rounded-xl border border-gray-200 hover:border-black hover:shadow-md transition-all overflow-hidden"
                        onClick={() => {
                          setSelectedReconciliation(r)
                          setView('detail')
                        }}
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
                            <div
                              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-all
                                ${
                                  isReconciled
                                    ? 'bg-emerald-50 text-emerald-500 group-hover:bg-emerald-600 group-hover:text-white'
                                    : 'bg-gray-50 text-gray-300 group-hover:bg-black group-hover:text-red-500'
                                }`}
                            >
                              {isReconciled ? (
                                <CheckCircle2 size={18} />
                              ) : (
                                <Building2 size={18} />
                              )}
                            </div>
                          </div>

                          {/* Two-column balance display matching the two-section method */}
                          <div className="grid grid-cols-2 gap-2 mt-4">
                            <div className="rounded-lg bg-blue-50 border border-blue-100 p-3">
                              <p className="text-[9px] font-black text-blue-400 uppercase tracking-[2px]">
                                Bank Statement
                              </p>
                              <p className="text-sm font-black font-mono text-blue-700 mt-1 truncate">
                                ₱{fmt(bankStatement)}
                              </p>
                            </div>
                            <div className="rounded-lg bg-violet-50 border border-violet-100 p-3">
                              <p className="text-[9px] font-black text-violet-400 uppercase tracking-[2px]">
                                GL Book Balance
                              </p>
                              <p className="text-sm font-black font-mono text-violet-700 mt-1 truncate">
                                ₱{fmt(glBalance)}
                              </p>
                            </div>
                          </div>

                          {adjustedBankBalance != null &&
                            adjustedBookBalance != null && (
                              <div className="mt-3 rounded-xl bg-slate-50 border border-slate-100 p-3 text-[11px] text-slate-700">
                                <p className="font-black uppercase tracking-[2px] text-slate-400 mb-1">
                                  Current month adjusted balances
                                </p>
                                <div className="flex flex-wrap gap-2 text-slate-800">
                                  <span>Bank ₱{fmt(adjustedBankBalance)}</span>
                                  <span>Book ₱{fmt(adjustedBookBalance)}</span>
                                </div>
                              </div>
                            )}

                          <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-3">
                            <span
                              className={`px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-wider flex items-center gap-1
                              ${isReconciled ? 'bg-emerald-100 text-emerald-700' : 'bg-red-50 text-red-700'}`}
                            >
                              {isReconciled ? (
                                <>
                                  <CheckCircle2 size={10} /> Reconciled
                                </>
                              ) : (
                                <>
                                  <AlertCircle size={10} /> Variance ₱
                                  {fmt(Math.abs(effectiveDiff))}
                                </>
                              )}
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
                  Enter the bank account and the ending balance from your bank
                  statement
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
                    placeholder="e.g. BDO Checking – 0012345678"
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-gray-900 outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">
                    Chart of Accounts (Cash Account) *
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
                    <option value="">-- Select Cash Account --</option>
                    {chartOfAccounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.code} – {a.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">
                    Ending Bank Statement Balance
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
                  <p className="text-[10px] text-gray-400 mt-1">
                    This is the closing balance shown on your bank statement — not
                    your GL balance.
                  </p>
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
