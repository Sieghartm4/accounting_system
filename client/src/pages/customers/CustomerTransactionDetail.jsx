import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Users, ArrowLeft, Calendar } from 'lucide-react'
import DynamicTable from '../../components/DynamicTable'
import RouteProtection from '../../components/RouteProtection'
import DynamicToast from '../../components/DynamicToast'
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
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const filterByDate = (data, fromField, toField) => {
    if (!dateFrom && !dateTo) return data

    return data.filter((item) => {
      const itemDate = item[fromField] ? new Date(item[fromField]) : null
      const from = dateFrom ? new Date(dateFrom) : null
      const to = dateTo ? new Date(dateTo) : null

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
    return (
      <div className="h-full w-full flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-black uppercase tracking-[3px] text-gray-400">
          Loading Transaction Details...
        </p>
      </div>
    )
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
      {/* Header */}
      <div className="shrink-0 mb-6">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-gray-600 hover:text-black transition-colors mb-4"
        >
          <ArrowLeft size={16} />
          Back to Transactions
        </button>

        <div className="flex items-center gap-3 mb-4">
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

        {/* Date Filter */}
        <div className="flex gap-4 bg-white p-4 rounded-xl border border-gray-100 mb-4">
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
          {(dateFrom || dateTo) && (
            <button
              onClick={() => {
                setDateFrom('')
                setDateTo('')
              }}
              className="px-4 py-1 bg-red-100 text-red-600 text-xs font-bold rounded-lg hover:bg-red-200 transition-colors"
            >
              Clear
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('receipts')}
            className={`px-6 py-3 font-bold text-sm uppercase tracking-widest transition-all ${
              activeTab === 'receipts'
                ? 'text-red-600 border-b-2 border-red-600'
                : 'text-gray-500 hover:text-black'
            }`}
          >
            Receipts ({filteredReceipts.length})
          </button>
          <button
            onClick={() => setActiveTab('sales')}
            className={`px-6 py-3 font-bold text-sm uppercase tracking-widest transition-all ${
              activeTab === 'sales'
                ? 'text-red-600 border-b-2 border-red-600'
                : 'text-gray-500 hover:text-black'
            }`}
          >
            Sales ({filteredSales.length})
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
