import React, { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  DollarSign,
  Download,
  RefreshCcw,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Search,
  Calendar,
  Landmark,
  ReceiptText,
  XCircle,
  HelpCircle,
} from 'lucide-react'

// StatCard Component
const StatCard = ({
  iconBg,
  iconColor,
  icon,
  label,
  value,
  sub,
  valueClass,
  small,
}) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow"
  >
    <div className="flex items-start justify-between">
      <div className="flex-1">
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-[2px]">
          {label}
        </p>
        <p
          className={`${small ? 'text-2xl' : 'text-3xl'} font-black ${valueClass || 'text-black'} mt-1 leading-none`}
        >
          {value}
        </p>
        <p className="text-[10px] font-bold text-gray-300 uppercase tracking-[1px] mt-2">
          {sub}
        </p>
      </div>
      <div className={`${iconBg} rounded-xl p-2.5 flex-shrink-0`}>
        <div className={`${iconColor}`}>{icon}</div>
      </div>
    </div>
  </motion.div>
)

// DetailRow Component
const DetailRow = ({ label, value, highlight, icon: Icon }) => (
  <div className="flex items-center justify-between py-2.5 px-4 border-b border-gray-100 hover:bg-gray-50 transition-colors">
    <div className="flex items-center gap-3">
      {Icon && <Icon size={16} className="text-gray-400 flex-shrink-0" />}
      <span className="text-[12px] font-bold text-gray-600">{label}</span>
    </div>
    <span className={`text-[12px] font-black ${highlight || 'text-black'}`}>
      ₱
      {new Intl.NumberFormat('en-PH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(value || 0)}
    </span>
  </div>
)

// Reconciliation Table Row
const ReconciliationRow = ({ item, type }) => {
  const fmt = (n) =>
    new Intl.NumberFormat('en-PH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n || 0)

  if (type === 'check') {
    return (
      <tr className="border-b border-gray-100 hover:bg-red-50 transition-colors">
        <td className="px-4 py-2.5 text-[11px] font-bold text-black">
          {item['Check Number']}
        </td>
        <td className="px-4 py-2.5 text-[11px] font-bold text-gray-600">
          {item['Date']}
        </td>
        <td className="px-4 py-2.5 text-[11px] font-black text-red-600">
          ₱{fmt(item['Amount'])}
        </td>
        <td className="px-4 py-2.5">
          <span
            className={`text-[9px] font-black px-2.5 py-1 rounded-full ${
              item['Status'] === 'ISSUED'
                ? 'bg-yellow-100 text-yellow-700'
                : 'bg-gray-100 text-gray-700'
            }`}
          >
            {item['Status']}
          </span>
        </td>
      </tr>
    )
  }

  if (type === 'deposit') {
    return (
      <tr className="border-b border-gray-100 hover:bg-green-50 transition-colors">
        <td className="px-4 py-2.5 text-[11px] font-bold text-black">{item.type}</td>
        <td className="px-4 py-2.5 text-[11px] font-bold text-black">
          {item['Document Reference']}
        </td>
        <td className="px-4 py-2.5 text-[11px] font-bold text-gray-600">
          {item['Date']}
        </td>
        <td className="px-4 py-2.5 text-[11px] font-black text-green-600">
          ₱{fmt(item['Amount'])}
        </td>
        <td className="px-4 py-2.5">
          <span
            className={`text-[9px] font-black px-2.5 py-1 rounded-full ${
              item['Status'] === 'PENDING'
                ? 'bg-blue-100 text-blue-700'
                : 'bg-yellow-100 text-yellow-700'
            }`}
          >
            {item['Status']}
          </span>
        </td>
      </tr>
    )
  }

  if (type === 'adjustment') {
    return (
      <tr className="border-b border-gray-100 hover:bg-purple-50 transition-colors">
        <td className="px-4 py-2.5 text-[11px] font-bold text-black">
          {item['Description']}
        </td>
        <td className="px-4 py-2.5 text-[11px] font-bold text-gray-600">
          {item['Date']}
        </td>
        <td className="px-4 py-2.5 text-[11px] font-black text-purple-600">
          ₱{fmt(item['Amount'])}
        </td>
        <td className="px-4 py-2.5">
          <span
            className={`text-[9px] font-black px-2.5 py-1 rounded-full bg-purple-100 text-purple-700`}
          >
            {item['Status']}
          </span>
        </td>
      </tr>
    )
  }
}

export default function BankReconciliation() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [bankStatementBalance, setBankStatementBalance] = useState('')
  const [searchTerm, setSearchTerm] = useState('')

  const fmt = (n) =>
    new Intl.NumberFormat('en-PH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n || 0)

  useEffect(() => {
    fetchBankReconciliation()
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchBankReconciliation()
    }, 500)
    return () => clearTimeout(timer)
  }, [startDate, endDate])

  const fetchBankReconciliation = async () => {
    try {
      setLoading(true)
      setError('')
      const token = localStorage.getItem('token')

      const params = new URLSearchParams()
      if (startDate) params.append('start_date', startDate)
      if (endDate) params.append('end_date', endDate)
      if (bankStatementBalance)
        params.append('bank_statement_balance', bankStatementBalance)

      const url = `${import.meta.env.VITE_SERVER_LINK}/reports/bank-reconciliation${params.toString() ? '?' + params.toString() : ''}`

      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      })

      const result = await response.json()
      if (result.success) setData(result.data)
      else setError(result.message || 'Failed to fetch bank reconciliation')
    } catch (err) {
      setError('Connection Error: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateBankBalance = () => {
    if (bankStatementBalance) {
      fetchBankReconciliation()
    }
  }

  if (loading && !data)
    return (
      <div className="h-full w-full flex flex-col items-center justify-center gap-4">
        <div className="w-10 h-10 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-[10px] font-black uppercase tracking-[3px] text-gray-400">
          Reconciling Bank Records...
        </p>
      </div>
    )

  if (error)
    return (
      <div className="p-10">
        <div className="bg-red-50 border-l-4 border-red-600 p-6 rounded-r-xl">
          <h3 className="text-red-800 font-bold uppercase text-sm">Error</h3>
          <p className="text-red-600 text-sm mt-1">{error}</p>
          <button
            onClick={fetchBankReconciliation}
            className="mt-3 px-4 py-2 bg-red-600 text-white text-xs font-black rounded-lg uppercase tracking-widest hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    )

  const isReconciled = data?.summary?.is_reconciled
  const difference = data?.summary?.difference || 0

  return (
    <div className="flex flex-col gap-3 bg-[#F3F4F6] min-h-full custom-scrollbar">
      {/* HEADER */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-black rounded-xl flex-shrink-0">
            <Landmark size={22} className="text-red-500" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-black tracking-tighter leading-none">
              Bank <span className="text-red-600 italic">Reconciliation</span>
            </h1>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-[2px] mt-1">
              Verify Cash Accounts
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 px-5 py-2.5 bg-white border border-gray-200 text-[11px] font-black text-black rounded-xl hover:bg-gray-50 uppercase tracking-widest shadow-sm">
            <Download size={13} /> Export PDF
          </button>
          <button
            onClick={fetchBankReconciliation}
            className="w-10 h-10 bg-red-600 text-white rounded-xl hover:bg-red-700 flex items-center justify-center transition-colors shadow-lg shadow-red-200"
          >
            <RefreshCcw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* STAT CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <StatCard
          iconBg="bg-blue-50"
          iconColor="text-blue-600"
          icon={<Landmark size={18} />}
          label="GL Cash Balance"
          value={`₱${fmt(data?.summary?.cash_gl_balance)}`}
          sub="Books"
          valueClass="text-blue-600"
          small
        />
        <StatCard
          iconBg="bg-purple-50"
          iconColor="text-purple-600"
          icon={<ReceiptText size={18} />}
          label="Bank Statement"
          value={`₱${fmt(data?.summary?.bank_statement_balance)}`}
          sub="Bank"
          valueClass="text-purple-600"
          small
        />
        <StatCard
          iconBg="bg-orange-50"
          iconColor="text-orange-600"
          icon={<DollarSign size={18} />}
          label="Adjusted Balance"
          value={`₱${fmt(data?.summary?.adjusted_cash_balance)}`}
          sub="After Items"
          valueClass="text-orange-600"
          small
        />
        <StatCard
          iconBg={isReconciled ? 'bg-green-50' : 'bg-red-50'}
          iconColor={isReconciled ? 'text-green-600' : 'text-red-600'}
          icon={
            isReconciled ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />
          }
          label="Reconciliation"
          value={isReconciled ? 'Balanced' : `₱${fmt(Math.abs(difference))}`}
          sub={isReconciled ? 'Complete' : 'Difference'}
          valueClass={isReconciled ? 'text-green-600' : 'text-red-600'}
        />
      </div>

      {/* TOOLBAR */}
      <div className="bg-white border border-gray-100 rounded-2xl px-4 py-3 flex items-center gap-3 flex-wrap shadow-sm">
        {/* Search */}
        <div className="flex-1 min-w-[200px] flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 h-8 focus-within:border-red-500 focus-within:bg-white transition-all">
          <Search size={14} className="text-gray-300 flex-shrink-0" />
          <input
            type="text"
            placeholder="Search descriptions..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 bg-transparent border-none outline-none text-[12px] font-bold text-black placeholder:text-gray-300 placeholder:font-semibold"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="text-gray-300 hover:text-red-500 text-lg leading-none transition-colors"
            >
              ×
            </button>
          )}
        </div>

        <div className="hidden md:block w-px h-7 bg-gray-100" />

        {/* Date filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-black text-gray-400 uppercase tracking-[2px]">
            From
          </span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="px-3 py-2 border border-gray-100 rounded-xl bg-gray-50 text-[11px] font-bold text-black outline-none focus:border-red-500 focus:bg-white transition-all"
          />
          <span className="text-[10px] font-black text-gray-400 uppercase tracking-[2px]">
            To
          </span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="px-3 py-2 border border-gray-100 rounded-xl bg-gray-50 text-[11px] font-bold text-black outline-none focus:border-red-500 focus:bg-white transition-all"
          />
        </div>

        <div className="hidden md:block w-px h-7 bg-gray-100" />

        {/* Bank Statement Balance Input */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black text-gray-400 uppercase tracking-[2px]">
            Bank Balance
          </span>
          <input
            type="number"
            value={bankStatementBalance}
            onChange={(e) => setBankStatementBalance(e.target.value)}
            placeholder="Enter amount"
            className="px-3 py-2 border border-gray-100 rounded-xl bg-gray-50 text-[11px] font-bold text-black outline-none focus:border-red-500 focus:bg-white transition-all w-32"
          />
          <button
            onClick={handleUpdateBankBalance}
            className="px-3 py-2 bg-red-600 text-white text-[10px] font-black rounded-xl hover:bg-red-700 transition-colors uppercase tracking-widest"
          >
            Update
          </button>
        </div>
      </div>

      {/* CASH ACCOUNTS SECTION */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm"
      >
        <div className="bg-gradient-to-r from-blue-50 to-blue-100 px-4 py-3 border-b border-gray-100 flex items-center gap-2">
          <Landmark size={16} className="text-blue-600" />
          <h3 className="text-[12px] font-black text-blue-900 uppercase tracking-[1px]">
            Cash Accounts (GL)
          </h3>
        </div>
        <div className="p-0">
          {data?.cash_accounts?.map((account, idx) => (
            <DetailRow
              key={idx}
              label={`${account['Account Code']} - ${account['Account Name']}`}
              value={account.Balance}
              highlight="text-blue-600"
              icon={Landmark}
            />
          ))}
        </div>
      </motion.div>

      {/* RECONCILIATION FLOW */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* OUTSTANDING CHECKS */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm lg:col-span-2"
        >
          <div className="bg-gradient-to-r from-yellow-50 to-yellow-100 px-4 py-3 border-b border-gray-100 flex items-center gap-2">
            <XCircle size={16} className="text-yellow-600" />
            <h3 className="text-[12px] font-black text-yellow-900 uppercase tracking-[1px]">
              Outstanding Checks
            </h3>
            <span className="ml-auto text-[10px] font-black text-yellow-700">
              Total: ₱{fmt(data?.outstanding_checks_total)}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-4 py-2 text-[10px] font-black text-gray-600 uppercase tracking-[1px] text-left">
                    Check #
                  </th>
                  <th className="px-4 py-2 text-[10px] font-black text-gray-600 uppercase tracking-[1px] text-left">
                    Date
                  </th>
                  <th className="px-4 py-2 text-[10px] font-black text-gray-600 uppercase tracking-[1px] text-left">
                    Amount
                  </th>
                  <th className="px-4 py-2 text-[10px] font-black text-gray-600 uppercase tracking-[1px] text-left">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {data?.outstanding_checks?.length > 0 ? (
                  data.outstanding_checks.map((check, idx) => (
                    <ReconciliationRow key={idx} item={check} type="check" />
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan="4"
                      className="px-4 py-6 text-center text-[11px] font-bold text-gray-400"
                    >
                      No outstanding checks
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* RECONCILIATION SUMMARY */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm"
        >
          <div className="bg-gradient-to-r from-red-50 to-red-100 px-4 py-3 border-b border-gray-100">
            <h3 className="text-[12px] font-black text-red-900 uppercase tracking-[1px]">
              Reconciliation Summary
            </h3>
          </div>
          <div className="p-4 space-y-1">
            <DetailRow
              label="GL Cash Balance"
              value={data?.summary?.cash_gl_balance}
              highlight="text-blue-600"
            />
            <DetailRow
              label="Less: Outstanding Checks"
              value={data?.outstanding_checks_total}
              highlight="text-red-600"
            />
            <DetailRow
              label="Plus: Deposits in Transit"
              value={data?.deposits_in_transit_total}
              highlight="text-green-600"
            />
            <DetailRow
              label="Plus/Less: Adjustments"
              value={data?.bank_adjustments_total}
              highlight={
                data?.bank_adjustments_total >= 0 ? 'text-green-600' : 'text-red-600'
              }
            />
            <div className="border-t-2 border-gray-200 my-2 pt-2">
              <DetailRow
                label="Adjusted Balance"
                value={data?.summary?.adjusted_cash_balance}
                highlight="text-orange-600"
              />
            </div>
            <div className="border-b border-gray-100 pb-2">
              <DetailRow
                label="Bank Statement"
                value={data?.summary?.bank_statement_balance}
                highlight="text-purple-600"
              />
            </div>
            <div
              className={`mt-3 p-3 rounded-xl ${isReconciled ? 'bg-green-50' : 'bg-red-50'}`}
            >
              <p className="text-[10px] font-black uppercase tracking-[1px] text-gray-500 mb-1">
                Difference
              </p>
              <p
                className={`text-2xl font-black ${isReconciled ? 'text-green-600' : 'text-red-600'}`}
              >
                ₱{fmt(Math.abs(difference))}
              </p>
              <p
                className={`text-[9px] font-bold mt-1 ${isReconciled ? 'text-green-600' : 'text-red-600'}`}
              >
                {isReconciled ? '✓ Reconciled' : '⚠ Discrepancy'}
              </p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* DEPOSITS IN TRANSIT */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm"
      >
        <div className="bg-gradient-to-r from-green-50 to-green-100 px-4 py-3 border-b border-gray-100 flex items-center gap-2">
          <TrendingUp size={16} className="text-green-600" />
          <h3 className="text-[12px] font-black text-green-900 uppercase tracking-[1px]">
            Deposits in Transit
          </h3>
          <span className="ml-auto text-[10px] font-black text-green-700">
            Total: ₱{fmt(data?.deposits_in_transit_total)}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-4 py-2 text-[10px] font-black text-gray-600 uppercase tracking-[1px] text-left">
                  Type
                </th>
                <th className="px-4 py-2 text-[10px] font-black text-gray-600 uppercase tracking-[1px] text-left">
                  Reference
                </th>
                <th className="px-4 py-2 text-[10px] font-black text-gray-600 uppercase tracking-[1px] text-left">
                  Date
                </th>
                <th className="px-4 py-2 text-[10px] font-black text-gray-600 uppercase tracking-[1px] text-left">
                  Amount
                </th>
                <th className="px-4 py-2 text-[10px] font-black text-gray-600 uppercase tracking-[1px] text-left">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {data?.deposits_in_transit?.length > 0 ? (
                data.deposits_in_transit.map((deposit, idx) => (
                  <ReconciliationRow key={idx} item={deposit} type="deposit" />
                ))
              ) : (
                <tr>
                  <td
                    colSpan="5"
                    className="px-4 py-6 text-center text-[11px] font-bold text-gray-400"
                  >
                    No deposits in transit
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* BANK ADJUSTMENTS */}
      {data?.bank_adjustments?.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm"
        >
          <div className="bg-gradient-to-r from-purple-50 to-purple-100 px-4 py-3 border-b border-gray-100 flex items-center gap-2">
            <AlertCircle size={16} className="text-purple-600" />
            <h3 className="text-[12px] font-black text-purple-900 uppercase tracking-[1px]">
              Bank Adjustments Required
            </h3>
            <span className="ml-auto text-[10px] font-black text-purple-700">
              Total Impact: ₱{fmt(data?.bank_adjustments_total)}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-4 py-2 text-[10px] font-black text-gray-600 uppercase tracking-[1px] text-left">
                    Description
                  </th>
                  <th className="px-4 py-2 text-[10px] font-black text-gray-600 uppercase tracking-[1px] text-left">
                    Date
                  </th>
                  <th className="px-4 py-2 text-[10px] font-black text-gray-600 uppercase tracking-[1px] text-left">
                    Amount
                  </th>
                  <th className="px-4 py-2 text-[10px] font-black text-gray-600 uppercase tracking-[1px] text-left">
                    Type
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.bank_adjustments.map((adj, idx) => (
                  <ReconciliationRow key={idx} item={adj} type="adjustment" />
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {/* INFO BOX */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-blue-50 border border-blue-200 rounded-2xl p-4"
      >
        <div className="flex gap-3">
          <HelpCircle size={18} className="text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="text-[12px] font-black text-blue-900 uppercase tracking-[1px] mb-1">
              How Bank Reconciliation Works
            </h4>
            <p className="text-[11px] text-blue-800 leading-relaxed">
              Compare your accounting records with the bank statement. Enter the bank
              statement balance and this report will automatically calculate the
              difference. Outstanding checks and deposits in transit are timing
              differences that should match when cleared. Bank charges and interest
              must be recorded as adjusting entries to balance your books.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
