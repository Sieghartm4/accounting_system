import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Truck, ShieldCheck, Search, Download } from 'lucide-react'
import DynamicTable from '../../components/DynamicTable'
import RouteProtection from '../../components/RouteProtection'
import useVendorTransactions from './useVendorTransactions'
import VendorTransactionDetail from './VendorTransactionDetail'

const formatCurrency = (value) =>
  Number(value || 0).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

function VendorTransactionsContent() {
  const { vendorTransactions, loading, error, summary } = useVendorTransactions()
  const [viewingVendor, setViewingVendor] = useState(null)

  const fadeInUp = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
  }

  if (viewingVendor) {
    return (
      <VendorTransactionDetail
        vendorId={viewingVendor.id}
        vendorName={viewingVendor.name}
        onBack={() => setViewingVendor(null)}
      />
    )
  }

  if (loading) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-black uppercase tracking-[3px] text-gray-400">
          Loading Vendor Transactions...
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
      <div className="shrink-0">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={fadeInUp}
          className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-4"
        >
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-black rounded-lg text-red-500 shadow-lg shadow-black/20">
                <Truck size={24} />
              </div>
              <h1 className="text-4xl font-black text-black tracking-tighter">
                Vendor <span className="text-red-600 italic">Transactions</span>
              </h1>
            </div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-tight">
              Approved purchases and cash disbursement balance per vendor.
            </p>
          </div>

          <div className="flex gap-3">
            <button className="flex items-center gap-2 px-5 py-3 bg-white border border-gray-200 text-xs font-bold text-black rounded-xl hover:bg-gray-50 transition-all shadow-sm">
              <Download size={14} />
              EXPORT LIST
            </button>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <SummaryCard
            icon={<Truck className="text-red-600" size={20} />}
            label="Vendor Records"
            value={summary.vendors || 0}
            subText="Supplier profiles"
          />
          <SummaryCard
            icon={<ShieldCheck className="text-black" size={20} />}
            label="Approved Transactions"
            value={summary.approvedDisbursements + summary.approvedPurchases}
            subText="Total records"
          />
          <SummaryCard
            icon={<Search className="text-gray-400" size={20} />}
            label="Total Amount Due"
            value={`₱ ${formatCurrency(summary.totalAmountDue)}`}
            subText="Open balance"
          />
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="flex-1 min-h-0 bg-white rounded-2xl shadow-xl shadow-black/5 overflow-hidden border border-gray-100"
      >
        <DynamicTable
          data={vendorTransactions}
          title="Vendor Transaction Balances"
          enableAddButton={false}
          enableActionColumn={true}
          routeName="vendors"
          actionButtons={[
            {
              label: 'View',
              onClick: (row) => setViewingVendor(row),
            },
          ]}
          badgeColumns={[
            {
              column: 'status',
              values: {
                ACTIVE: 'green',
                INACTIVE: 'red',
                PENDING: 'yellow',
                UNKNOWN: 'gray',
              },
            },
          ]}
        />
      </motion.div>
    </div>
  )
}

function SummaryCard({ icon, label, value, subText }) {
  return (
    <div className="bg-white p-4 rounded-xl border border-gray-100 flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="p-3 bg-gray-50 rounded-xl">{icon}</div>
      <div>
        <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 leading-none mb-1">
          {label}
        </p>
        <div className="flex items-baseline gap-2">
          <h4 className="text-xl font-black text-black">{value}</h4>
          <span className="text-[9px] font-bold text-gray-400 uppercase">
            {subText}
          </span>
        </div>
      </div>
    </div>
  )
}

export default function VendorTransactions() {
  return (
    <RouteProtection routeName="vendors">
      <VendorTransactionsContent />
    </RouteProtection>
  )
}
