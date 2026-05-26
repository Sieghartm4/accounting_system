import React, { useMemo, useState } from 'react'
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
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const { advances, loading, error, refreshAdvances } = useAdvances(
    startDate,
    endDate,
  )

  const totalDebit = advances.reduce(
    (sum, entry) => (entry.type === 'DEBIT' ? sum + Number(entry.amount || 0) : sum),
    0,
  )
  const totalCredit = advances.reduce(
    (sum, entry) =>
      entry.type === 'CREDIT' ? sum + Number(entry.amount || 0) : sum,
    0,
  )

  const tableData = advances.map((entry) => ({
    ...entry,
    amount: `₱${fmt(entry.amount)}`,
    date: formatDate(entry.date),
  }))

  const handleCreateAdjustment = (selectedRows) => {
    const ids = selectedRows.map((row) => row.id).join(', ')
    window.alert(
      `Create Adjustment for ${selectedRows.length} selected advance(s): ${ids}`,
    )
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
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-10 w-36 rounded-lg border border-gray-200 bg-white px-2 text-xs font-bold text-black outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>
          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2">
            <label className="text-[10px] font-black uppercase tracking-[2px] text-gray-400">
              To
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="h-10 w-36 rounded-lg border border-gray-200 bg-white px-2 text-xs font-bold text-black outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>
          <button
            onClick={() => {
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
        className="flex-1 min-h-0 bg-white rounded-2xl shadow-xl shadow-black/5 overflow-hidden border border-gray-100"
      >
        <DynamicTable
          data={tableData}
          title="Advances"
          actionButtons={[]}
          routeName="advances"
          enableAddButton={false}
          enableCheckbox={true}
          checkboxColumn="id"
          checkboxActions={[
            {
              label: 'Create Adjustment',
              onClick: handleCreateAdjustment,
            },
          ]}
        />
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
