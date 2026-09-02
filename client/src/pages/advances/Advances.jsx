import React, { useMemo, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowRight,
  Download,
  RefreshCcw,
  Hash,
  Calendar,
  FileText,
} from 'lucide-react'
import DynamicTable from '../../components/DynamicTable'
import RouteProtection from '../../components/RouteProtection'
import useAdvances from './useAdvances'

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
  const [expandedGroup, setExpandedGroup] = useState(null) // Track which date/type group is expanded
  const [selectedAdvances, setSelectedAdvances] = useState([]) // Store selected advances for adjustment
  const [selectedGroups, setSelectedGroups] = useState([]) // Store selected groups for bulk adjustment
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

  if (loading && advances.length === 0) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center gap-4">
        <div className="w-10 h-10 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-[10px] font-black uppercase tracking-[3px] text-gray-400">
          Loading Advances...
        </p>
      </div>
    )
  }

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
    <div className="h-full flex flex-col gap-4 bg-[#F3F4F6] min-h-full custom-scrollbar">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-black rounded-xl shrink-0">
            <ArrowRight size={22} className="text-red-500" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-black tracking-tighter leading-none">
              Advances <span className="text-red-600 italic">Journal Entries</span>
            </h1>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-[2px] mt-1">
              Entries lacking linked source records
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
      </div>

      <div className="grid grid-cols-4 gap-3">
        <div className="bg-white border border-gray-100 rounded-2xl p-4 flex items-center gap-3 hover:shadow-md transition-shadow">
          <div className="w-10 h-10 bg-red-50 text-red-600 rounded-xl flex items-center justify-center shrink-0">
            <FileText size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-[9px] font-black uppercase tracking-[3px] text-gray-400 mb-1 whitespace-nowrap">
              Total Advances
            </p>
            <h4 className="font-black text-black leading-none truncate text-xl">
              {advances.length}
            </h4>
            <p className="text-[9px] font-bold text-gray-300 uppercase mt-1">
              Unlinked Transactions
            </p>
          </div>
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl p-4 flex items-center gap-3 hover:shadow-md transition-shadow">
          <div className="w-10 h-10 bg-gray-100 text-black rounded-xl flex items-center justify-center shrink-0">
            <Hash size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-[9px] font-black uppercase tracking-[3px] text-gray-400 mb-1 whitespace-nowrap">
              Total Debit
            </p>
            <h4 className="font-black text-black leading-none truncate text-xl">
              ₱{fmt(totalDebit)}
            </h4>
            <p className="text-[9px] font-bold text-gray-300 uppercase mt-1">
              Debit
            </p>
          </div>
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl p-4 flex items-center gap-3 hover:shadow-md transition-shadow">
          <div className="w-10 h-10 bg-red-50 text-red-600 rounded-xl flex items-center justify-center shrink-0">
            <Hash size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-[9px] font-black uppercase tracking-[3px] text-gray-400 mb-1 whitespace-nowrap">
              Total Credit
            </p>
            <h4 className="font-black text-red-600 leading-none truncate text-xl">
              ₱{fmt(totalCredit)}
            </h4>
            <p className="text-[9px] font-bold text-gray-300 uppercase mt-1">
              Credit
            </p>
          </div>
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl p-4 flex items-center gap-3 hover:shadow-md transition-shadow">
          <div className="w-10 h-10 bg-green-50 text-green-600 rounded-xl flex items-center justify-center shrink-0">
            <Calendar size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-[9px] font-black uppercase tracking-[3px] text-gray-400 mb-1 whitespace-nowrap">
              Latest Fetch
            </p>
            <h4 className="font-black text-black leading-none truncate text-xl">
              {formatDate(new Date().toISOString())}
            </h4>
            <p className="text-[9px] font-bold text-gray-300 uppercase mt-1">
              Refreshed
            </p>
          </div>
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
            isLoading={loading && advances.length === 0}
            returnColumn="groupKey"
            onRowClick={(groupKey, row) => {
              const key = `${row.date}-${row.type}`
              setExpandedGroup(expandedGroup === key ? null : key)
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
            highlightRow={{ column: 'groupKey', value: expandedGroup }}
          />
        </motion.div>

        {/* RIGHT COLUMN: Detailed Advances Table */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="col-span-1 md:col-span-8 flex flex-col min-h-0 bg-white rounded-2xl shadow-xl shadow-black/5 overflow-hidden border border-gray-100"
        >
          <DynamicTable
            data={expandedGroup ? groupedAdvances.find(g => `${g.date}-${g.type}` === expandedGroup)?.advances || [] : []}
            title=""
            enableAddButton={false}
            enableCheckbox={true}
            enableActionColumn={false}
            isLoading={loading && advances.length === 0}
            checkboxColumn="id"
            onCheckboxChange={(selectedIds) => {
              const group = groupedAdvances.find(g => `${g.date}-${g.type}` === expandedGroup)
              if (!group) return
              const selectedRows = group.advances.filter(row => selectedIds.includes(row.id))
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
