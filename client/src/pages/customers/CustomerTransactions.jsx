import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Users, Download, ShieldCheck, Wallet } from 'lucide-react'
import DynamicTable from '../../components/DynamicTable'
import RouteProtection from '../../components/RouteProtection'
import LoadingScreen from '../../components/LoadingScreen'
import useCustomerTransactions from './useCustomerTransactions'
import CustomerTransactionDetail from './CustomerTransactionDetail'
import SummaryTile from '../../components/SummaryTile'

const formatCurrency = (value) =>
  Number(value || 0).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

function CustomerTransactionsContent() {
  const { customerTransactions, loading, error, summary } = useCustomerTransactions()
  const [viewingCustomer, setViewingCustomer] = useState(null)

  const fadeInUp = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
  }

  if (viewingCustomer) {
    return (
      <CustomerTransactionDetail
        customerId={viewingCustomer.name}
        customerName={viewingCustomer.name}
        onBack={() => setViewingCustomer(null)}
      />
    )
  }

  if (loading) {
    return <LoadingScreen label="Loading Customer Transactions..." />
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
                <Users size={24} />
              </div>
              <h1 className="text-4xl font-black text-black tracking-tighter">
                Customer <span className="text-red-600 italic">Transactions</span>
              </h1>
            </div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-tight">
              Approved receipts and sales balances per customer.
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
          <SummaryTile
            label="Customer Accounts"
            value={summary.customers || 0}
            subText="Active profiles"
            color="rose"
            icon={Users}
            hoverable
          />
          <SummaryTile
            label="Approved Transactions"
            value={summary.approvedReceipts + summary.approvedSales}
            subText="Total records"
            color="emerald"
            icon={ShieldCheck}
            hoverable
          />
          <SummaryTile
            label="Total Amount Due"
            value={`₱ ${formatCurrency(summary.totalAmountDue)}`}
            subText="Open balance"
            color="dark"
            icon={Wallet}
            plainLabel
            hoverable
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
          data={customerTransactions}
          title="Customer Transaction Balances"
          enableAddButton={false}
          enableActionColumn={true}
          routeName="customers"
          actionButtons={[
            {
              label: 'View',
              onClick: (row) => setViewingCustomer(row),
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

export default function CustomerTransactions() {
  return (
    <RouteProtection routeName="customers">
      <CustomerTransactionsContent />
    </RouteProtection>
  )
}
