import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Users, ArrowLeft, Calendar } from 'lucide-react'
import DynamicTable from '../../components/DynamicTable'
import RouteProtection from '../../components/RouteProtection'
import DynamicToast from '../../components/DynamicToast'
import LoadingScreen from '../../components/LoadingScreen'
import useCustomerTransactionDetail from './useCustomerTransactionDetail'

const formatCurrency = (value) =>
  Number(value || 0).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

function CustomerTransactionDetailContent({ customerId, customerName, onBack }) {
  const { receipts, sales, loading, error } =
    useCustomerTransactionDetail(customerId)
  const [activeTab, setActiveTab] = useState('receipts')
  // First load shows the current month (1st → today). The inputs are drafts;
  // Submit applies the range to the loaded data, Clear empties both.
  const [month, today] = (() => {
    const now = new Date()
    const iso = (d) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    return [iso(new Date(now.getFullYear(), now.getMonth(), 1)), iso(now)]
  })()
  const [dateFrom, setDateFrom] = useState(month)
  const [dateTo, setDateTo] = useState(today)
  const [appliedFrom, setAppliedFrom] = useState(month)
  const [appliedTo, setAppliedTo] = useState(today)

  const filterByDate = (data, fromField, toField) => {
    if (!appliedFrom && !appliedTo) return data

    return data.filter((item) => {
      const itemDate = item[fromField] ? new Date(item[fromField]) : null
      const from = appliedFrom ? new Date(appliedFrom) : null
      const to = appliedTo ? new Date(appliedTo) : null

      if (from && itemDate && itemDate < from) return false
      if (to && itemDate && itemDate > to) return false
      return true
    })
  }

  const filteredReceipts = filterByDate(
    receipts,
    'collection_date',
    'collection_date',
  )
  const filteredSales = filterByDate(sales, 'date_delivered', 'date_due')

  if (loading) {
    return <LoadingScreen label="Loading Transaction Details..." />
  }

  if (error) {
    return (
      <div className="p-10 flex items-center justify-center">
        <div className="bg-red-50 border-l-4 border-red-600 p-6 rounded-r-xl shadow-sm">
          <h3 className="text-red-800 font-bold uppercase text-sm">System Error</h3>
          <p className="text-red-600 text-sm mt-1">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-transparent overflow-hidden">
      {/* Header — back button, title and date filter share one row, filter
          pushed to the right end. Previously the title sat under the back
          button and the filter took its own full-width strip. */}
      <div className="shrink-0 mb-6">
        <div className="flex items-center flex-wrap gap-3 mb-4">
          <button
            onClick={onBack}
            className="cursor-pointer px-4 py-2 bg-gray-600 text-white text-[12px] font-black rounded-lg hover:bg-gray-700 transition-all uppercase tracking-[2px] flex items-center gap-2 shadow-md shadow-gray-200"
          >
            <ArrowLeft size={17} />
            Back
          </button>

          <div className="flex items-center gap-3">
            <div className="p-2 bg-black rounded-lg text-red-500 shadow-lg shadow-black/20">
              <Users size={24} />
            </div>
            <div>
              <h1 className="text-3xl font-black text-black tracking-tighter">
                {customerName}
              </h1>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-tight">
                Transaction Details & History
              </p>
            </div>
          </div>

          {/* Date Filter (right end of the header row) */}
          <div className="ml-auto flex flex-wrap items-center gap-3 bg-white p-3 rounded-xl border border-gray-100">
            <div className="flex items-center gap-2">
              <Calendar size={16} className="text-gray-500" />
              <label className="text-xs font-bold text-gray-600 uppercase">From</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="px-3 py-1 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-gray-600 uppercase">To</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="px-3 py-1 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
            {(dateFrom || dateTo || appliedFrom || appliedTo) && (
              <button
                onClick={() => {
                  setDateFrom('')
                  setDateTo('')
                  setAppliedFrom('')
                  setAppliedTo('')
                }}
                className="px-4 py-1.5 rounded-lg border border-slate-300 bg-white text-[10px] font-black text-slate-600 uppercase tracking-widest hover:border-red-500 hover:bg-red-50 hover:text-red-600 transition-colors"
              >
                Clear
              </button>
            )}
            <button
              onClick={() => {
                setAppliedFrom(dateFrom)
                setAppliedTo(dateTo)
              }}
              className="px-4 py-1.5 rounded-lg bg-red-600 text-[10px] font-black text-white uppercase tracking-widest shadow-sm shadow-red-600/30 hover:bg-red-700 transition-colors"
            >
              Submit
            </button>
          </div>
        </div>

        {/* Tabs — pill design matching the Collections page */}
        <div className="flex items-center gap-2 p-1 bg-white rounded-xl w-fit border border-gray-200 shadow-sm">
          <button
            onClick={() => setActiveTab('receipts')}
            className={`px-5 py-2 text-xs font-bold tracking-wider rounded-lg transition-all relative ${
              activeTab === 'receipts'
                ? 'bg-red-600 text-white shadow'
                : 'text-gray-600 hover:text-black hover:bg-gray-100'
            }`}
          >
            RECEIPTS ({filteredReceipts.length})
          </button>

          <button
            onClick={() => setActiveTab('sales')}
            className={`px-5 py-2 text-xs font-bold tracking-wider rounded-lg transition-all relative ${
              activeTab === 'sales'
                ? 'bg-red-600 text-white shadow'
                : 'text-gray-600 hover:text-black hover:bg-gray-100'
            }`}
          >
            SALES ({filteredSales.length})
          </button>
        </div>
      </div>

      {/* Content */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="flex-1 min-h-0 bg-white rounded-2xl shadow-xl shadow-black/5 overflow-hidden border border-gray-100"
      >
        {activeTab === 'receipts' && (
          <DynamicTable
            data={filteredReceipts}
            title="Receipt Records"
            enableAddButton={false}
            enableActionColumn={false}
            badgeColumns={[
              {
                column: 'state',
                values: {
                  PREPARED: 'orange',
                  CHECKED: 'blue',
                  APPROVED: 'green',
                  REJECTED: 'red',
                  CANCELLED: 'orange',
                },
              },
            ]}
          />
        )}
        {activeTab === 'sales' && (
          <DynamicTable
            data={filteredSales}
            title="Sales Records"
            enableAddButton={false}
            enableActionColumn={false}
            badgeColumns={[
              {
                column: 'state',
                values: {
                  PREPARED: 'orange',
                  CHECKED: 'blue',
                  APPROVED: 'green',
                  REJECTED: 'red',
                  CANCELLED: 'orange',
                },
              },
            ]}
          />
        )}
      </motion.div>
    </div>
  )
}

export default function CustomerTransactionDetail({
  customerId,
  customerName,
  onBack,
}) {
  return (
    <RouteProtection routeName="customers">
      <CustomerTransactionDetailContent
        customerId={customerId}
        customerName={customerName}
        onBack={onBack}
      />
    </RouteProtection>
  )
}
