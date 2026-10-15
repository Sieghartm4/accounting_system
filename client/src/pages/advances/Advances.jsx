import React, { useMemo, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowRight,
  Download,
  RefreshCcw,
  Hash,
  Calendar,
  CheckCircle,
  XCircle,
  Wallet,
  ClipboardList,
} from 'lucide-react'
import DynamicTable from '../../components/DynamicTable'
import RouteProtection from '../../components/RouteProtection'
import useAdvances from './useAdvances'
import LoadingScreen from '../../components/LoadingScreen'
import DynamicToast from '../../components/DynamicToast'

const fmt = (value) =>
  new Intl.NumberFormat('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0)

const formatDate = (value) => {
  if (!value) return ''
  const date = new Date(value)
  return date.toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  })
}

function AdvancesContent() {
  const [filterStartDate, setFilterStartDate] = useState('')
  const [filterEndDate, setFilterEndDate] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [expandedGroups, setExpandedGroups] = useState([]) // Group keys open in the detail table.
  // This was a single key, so opening a second group replaced the first and the
  // detail table only ever showed the last one clicked. It holds every open key
  // so several groups stack in the table below.
  const [selectedAdvances, setSelectedAdvances] = useState([]) // Store selected advances for adjustment
  const [selectedGroups, setSelectedGroups] = useState([]) // Store selected groups for bulk adjustment
  const [toast, setToast] = useState(null)
  const navigate = useNavigate()
  const {
    advances,
    loading,
    loadingMore,
    error,
    hasMore,
    refreshAdvances,
    loadMore,
  } = useAdvances(startDate, endDate)

  // 🟢 ADDED: Socket listener for journal entries creation (use WSS when page is secure)
  useEffect(() => {
    const serverLink = import.meta.env.VITE_SERVER_LINK
    if (!serverLink) return

    // Build robust socket URL: if the page is served over HTTPS prefer wss, otherwise match server scheme
    const pageIsSecure = window.location.protocol === 'https:'
    let socketUrl = serverLink
    if (pageIsSecure) {
      // ensure WSS endpoint
      socketUrl = serverLink.replace(/^http:/i, 'wss:').replace(/^https:/i, 'wss:')
    } else {
      socketUrl = serverLink.replace(/^http:/i, 'ws:').replace(/^https:/i, 'ws:')
    }
    const socket = new WebSocket(socketUrl)

    socket.addEventListener('message', (event) => {
      try {
        const payload = JSON.parse(event.data)
        if (payload?.type === 'journal_entries_created') {
          // Refresh advances to show newly created entries
          refreshAdvances()
        }
      } catch (err) {
        console.error('Advances WebSocket message parse error', err)
      }
    })

    socket.addEventListener('error', (err) => {
      console.error('Advances WebSocket error', err)
    })

    return () => {
      socket.close()
    }
  }, [refreshAdvances])

  const totalDebit = advances.reduce(
    (sum, entry) => (entry.type === 'DEBIT' ? sum + Number(entry.amount || 0) : sum),
    0,
  )
  const totalCredit = advances.reduce(
    (sum, entry) =>
      entry.type === 'CREDIT' ? sum + Number(entry.amount || 0) : sum,
    0,
  )

  // Group advances by date and type
  const groupedAdvances = useMemo(() => {
    const groups = new Map()

    advances.forEach((advance) => {
      const dateKey = formatDate(advance.date)
      const typeKey = advance.type
      const groupKey = `${dateKey}-${typeKey}`

      if (!groups.has(groupKey)) {
        groups.set(groupKey, {
          groupKey,
          date: dateKey,
          type: typeKey,
          totalAmount: 0,
          advances: []
        })
      }

      const group = groups.get(groupKey)
      group.totalAmount += Number(advance.amount || 0)
      group.advances.push(advance)
    })

    return Array.from(groups.values()).sort((a, b) => {
      // Sort by date descending, then by type
      const dateA = new Date(a.date)
      const dateB = new Date(b.date)
      if (dateA.getTime() !== dateB.getTime()) {
        return dateB.getTime() - dateA.getTime()
      }
      return a.type.localeCompare(b.type)
    })
  }, [advances])

  // Every advance belonging to every open group, in the order the groups are
  // listed. Selecting two groups shows both sets of rows rather than the second
  // replacing the first.
  const expandedAdvances = useMemo(
    () =>
      groupedAdvances
        .filter((group) => expandedGroups.includes(group.groupKey))
        .flatMap((group) => group.advances),
    [groupedAdvances, expandedGroups],
  )

  const tableData = advances.map((entry) => ({
    ...entry,
    amount_raw: entry.amount,
    amount: `₱${fmt(entry.amount)}`,
    date: formatDate(entry.date),
  }))

  const handleCreateAdjustment = (selectedRows) => {
    const selectedAdvanceJournalEntries = selectedRows.map((row) => ({
      ...row,
      amount: row.amount_raw ?? row.amount,
    }))

    navigate('/adjustments', {
      state: {
        selectedAdvanceJournalEntries,
      },
    })
  }

  const handleBulkCreateAdjustment = (group) => {
    const selectedAdvanceJournalEntries = group.advances.map((advance) => ({
      ...advance,
      amount: Number(advance.amount),
    }))

    navigate('/adjustments', {
      state: {
        selectedAdvanceJournalEntries,
      },
    })
  }

  const handleBulkCreateAdjustmentFromGroups = (selectedGroups) => {
    const selectedAdvanceJournalEntries = selectedGroups.flatMap((group) =>
      group.advances.map((advance) => ({
        ...advance,
        amount: Number(advance.amount),
      }))
    )

    navigate('/adjustments', {
      state: {
        selectedAdvanceJournalEntries,
      },
    })
  }

  if (loading)
    return <LoadingScreen label="Loading Advances..." />

  if (error) {
    return (
      <div className="p-10">
        <div className="bg-red-50 border-l-4 border-red-600 p-6 rounded-r-xl">
          <h3 className="text-red-800 font-bold uppercase text-sm">Error</h3>
          <p className="text-red-600 text-sm mt-1">{error}</p>
          <button
            onClick={refreshAdvances}
            className="mt-3 px-4 py-2 bg-red-600 text-white text-xs font-black rounded-lg uppercase tracking-widest hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-transparent overflow-hidden">
      {toast && (
        <DynamicToast
          type={toast.type}
          message={toast.message}
          onClose={() => setToast(null)}
        />
      )}
      <div className="flex-shrink-0">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.5 } } }}
          className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-4"
        >
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-black rounded-lg text-red-500 shadow-lg shadow-black/20">
                <ArrowRight size={24} />
              </div>
              <h1 className="text-4xl font-black text-black tracking-tighter">
                Advances <span className="text-red-600 italic">Journal Entries</span>
              </h1>
            </div>
          </div>

          <div className="flex flex-col md:flex-row md:items-center gap-3">
            <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2">
              <label className="text-[10px] font-black uppercase tracking-[2px] text-gray-400">
                From
              </label>
              <input
                type="date"
                value={filterStartDate}
                onChange={(e) => setFilterStartDate(e.target.value)}
                className="h-10 w-36 rounded-lg border border-gray-200 bg-white px-2 text-xs font-bold text-black outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
            <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2">
              <label className="text-[10px] font-black uppercase tracking-[2px] text-gray-400">
                To
              </label>
              <input
                type="date"
                value={filterEndDate}
                onChange={(e) => setFilterEndDate(e.target.value)}
                className="h-10 w-36 rounded-lg border border-gray-200 bg-white px-2 text-xs font-bold text-black outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
            <button
              onClick={() => {
                setStartDate(filterStartDate)
                setEndDate(filterEndDate)
              }}
              className="h-10 px-4 bg-red-600 text-white font-black rounded-xl hover:bg-red-700 tracking-widest"
            >
              Submit
            </button>
            <button
              onClick={() => {
                setFilterStartDate('')
                setFilterEndDate('')
                setStartDate('')
                setEndDate('')
              }}
              className="h-10 px-4 bg-white border border-gray-200 text-[11px] font-black text-black rounded-xl hover:bg-gray-50 uppercase tracking-widest"
            >
              Clear
            </button>
            <button
              onClick={refreshAdvances}
              className="w-10 h-10 bg-red-600 text-white rounded-xl hover:bg-red-700 flex items-center justify-center transition-colors"
            >
              <RefreshCcw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </motion.div>

{/* ── SUMMARY TILES ──────────────────────────────────────────────────── */}
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
  <SummaryTile
    label="Total Advances"
    value={advances?.length || 0}
    subText="Transactions"
    color="emerald"
    icon={ClipboardList}
  />
  <SummaryTile
    label="Total Debit"
    value={`₱ ${fmt(totalDebit)}`}
    subText="Entries"
    color="rose"
    icon={XCircle}
  />
  <SummaryTile
    label="Total Credit"
    value={`₱ ${fmt(totalCredit)}`}
    subText="Entries"
    color="blue"
    icon={CheckCircle}
  />
  <SummaryTile
    label="Latest Fetch"
    value={formatDate(new Date().toISOString())}
    subText="Refreshed"
    color="amber"
    icon={Calendar}
  />
</div>
      </div>

      {/* --- TABLE SECTION --- */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-12 gap-6 pb-4"
      >
        {/* LEFT COLUMN: Grouped Date/Type Table */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="col-span-1 md:col-span-4 flex flex-col min-h-0 bg-white rounded-2xl shadow-xl shadow-black/5 overflow-hidden border border-gray-100"
        >
          <DynamicTable
            data={groupedAdvances}
            title=""
            enableAddButton={false}
            enableCheckbox={true}
            enableActionColumn={true}
            enableRowClick={true}
            isLoading={loading}
            returnColumn="groupKey"
            onRowClick={(groupKey, row) => {
              const key = row?.groupKey ?? groupKey
              setExpandedGroups((current) =>
                current.includes(key)
                  ? current.filter((k) => k !== key)
                  : [...current, key],
              )
            }}
            checkboxColumn="groupKey"
            onCheckboxChange={(selectedIds) => {
              const selectedRows = groupedAdvances.filter(row => selectedIds.includes(row.groupKey))
              setSelectedGroups(selectedRows)
            }}
            checkboxActions={[
              {
                label: 'Create Adjustment',
                onClick: (selectedRows) => handleBulkCreateAdjustmentFromGroups(selectedRows),
                style: 'red',
              },
            ]}
            actionButtons={[
              {
                label: 'Create Adjustment',
                icon: <ArrowRight size={14} />,
                onClick: (row) => handleBulkCreateAdjustment(row),
                style: 'red',
              },
            ]}
            columns={[
              { key: 'date', label: 'Date' },
              { key: 'type', label: 'Type' },
              {
                key: 'totalAmount',
                label: 'Total Amount',
                render: (value) => (
                  <span>
                    <span className="text-green-600">₱</span>
                    <span className="ml-1">{isNaN(value) ? '0.00' : parseFloat(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </span>
                )
              },
            ]}
            hiddenColumns={new Set(['advances', 'groupKey'])}
            highlightRow={{ column: 'groupKey', value: expandedGroups }}
          />
        </motion.div>

        {/* RIGHT COLUMN: Detailed Advances Table */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="col-span-1 md:col-span-8 flex flex-col min-h-0 bg-white rounded-2xl shadow-xl shadow-black/5 overflow-hidden border border-gray-100"
        >
          <DynamicTable
            data={expandedAdvances}
            title=""
            enableAddButton={false}
            enableCheckbox={true}
            enableActionColumn={false}
            isLoading={loading}
            checkboxColumn="id"
            onCheckboxChange={(selectedIds) => {
              // Scoped to the rows actually on screen, so a tick only ever
              // selects from the open groups - picking one group cannot pick an
              // advance belonging to another.
              const selectedRows = expandedAdvances.filter((row) =>
                selectedIds.includes(row.id),
              )
              setSelectedAdvances(selectedRows)
            }}
            checkboxActions={[
              {
                label: 'Create Adjustment',
                onClick: (selectedRows) => handleCreateAdjustment(selectedRows),
                style: 'red',
              },
            ]}
            columns={[
              { key: 'name', label: 'Account Name' },
              { key: 'responsibility_center', label: 'Responsibility Center' },
              { key: 'type', label: 'Type' },
              {
                key: 'amount',
                label: 'Amount',
                render: (value) => (
                  <span>
                    <span className="text-green-600">₱</span>
                    <span className="ml-1">{isNaN(value) ? '0.00' : parseFloat(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </span>
                )
              },
            ]}
            hiddenColumns={new Set(['id', 'db_name', 'db_id', 'coa_id', 'date'])}
          />
        </motion.div>
      </motion.div>
    </div>
  )
}

export default function Advances() {
  return (
    <RouteProtection routeName={['adjustments', 'advances']}>
      <AdvancesContent />
    </RouteProtection>
  )
}

function SummaryTile({ label, value, subText, color, onClick, isActive, icon: Icon }) {
  const theme = {
    emerald: {
      text: 'text-emerald-600 dark:text-emerald-400',
      badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      bar: 'bg-emerald-500',
      bg: 'bg-emerald-500',
      textOnActive: 'text-white'
    },
    amber: {
      text: 'text-amber-600 dark:text-amber-400',
      badgeBg: 'bg-amber-50 text-amber-700 border-amber-200',
      bar: 'bg-amber-500',
      bg: 'bg-amber-500',
      textOnActive: 'text-white'
    },
    orange: {
      text: 'text-orange-600 dark:text-orange-400',
      badgeBg: 'bg-orange-50 text-orange-700 border-orange-200',
      bar: 'bg-orange-500',
      bg: 'bg-orange-500',
      textOnActive: 'text-white'
    },
    rose: {
      text: 'text-rose-600 dark:text-rose-400',
      badgeBg: 'bg-rose-50 text-rose-700 border-rose-200',
      bar: 'bg-rose-500',
      bg: 'bg-rose-500',
      textOnActive: 'text-white'
    },
    blue: {
      text: 'text-blue-600 dark:text-blue-400',
      badgeBg: 'bg-blue-50 text-blue-700 border-blue-200',
      bar: 'bg-blue-500',
      bg: 'bg-blue-500',
      textOnActive: 'text-white'
    },
    dark: {
      text: 'text-emerald-400',
      badgeBg: 'bg-emerald-950 text-emerald-300 border-emerald-800/50',
      bar: 'bg-emerald-400',
      bg: 'bg-emerald-400',
      textOnActive: 'text-white'
    },
  }[color] || {
    text: 'text-gray-700',
    badgeBg: 'bg-gray-50 text-gray-700 border-gray-200',
    bar: 'bg-gray-400',
    bg: 'bg-gray-400',
    textOnActive: 'text-white'
  }

  const bgClass = color === 'dark'
    ? 'bg-slate-900 text-white border-slate-800'
    : 'bg-white text-gray-900 border-gray-200/80 shadow-xs'

  const activeBgClass = isActive
    ? `${theme.bg} text-white border-transparent`
    : bgClass

  const isClickable = onClick !== undefined

  return (
    <div
      onClick={isClickable ? onClick : undefined}
      className={`${activeBgClass} p-3 rounded-xl border relative overflow-hidden flex flex-col justify-between h-full cursor-pointer hover:scale-105 hover:shadow-lg group transition-all duration-300`}
    >
      {/* Bottom Accent Indicator - Animates on hover (behind content) */}
      <div className={`absolute bottom-0 left-0 right-0 h-1 ${theme.bar} group-hover:h-full transition-all duration-300 z-0`} />

      {/* Content wrapper with higher z-index */}
      <div className="relative z-10 flex flex-col justify-between h-full">
        {/* Top Header Row */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full border ${isActive ? 'bg-white text-gray-900 border-white' : theme.badgeBg} group-hover:bg-white group-hover:text-gray-900 group-hover:border-white`}>
            {label}
          </span>
          <span className={`text-xs font-medium ${isActive ? 'text-white/80' : 'text-gray-400'} group-hover:text-white/80`}>
            {subText}
          </span>
        </div>

        {/* Value Row with Icon */}
        <div className="flex items-center gap-2 my-1">
          {Icon && (
            <Icon size={20} className={`${isActive ? 'text-white' : (color === 'dark' ? theme.text : 'text-gray-600')} group-hover:text-white transition-colors`} />
          )}
          <span className={`text-2xl font-bold font-mono tracking-tight ${isActive ? 'text-white' : (color === 'dark' ? theme.text : 'text-black')} group-hover:text-white`}>
            {value}
          </span>
        </div>
      </div>
    </div>
  )
}
