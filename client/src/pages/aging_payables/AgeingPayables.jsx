import React, { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { Clock3, TrendingDown, Download, RefreshCw, Printer, FileText, X, Eye, DollarSign, Filter, RotateCw } from 'lucide-react'
import RouteProtection from '../../components/RouteProtection'
import useAgeingPayables from './useAgeingPayables'
import LoadingScreen from '../../components/LoadingScreen'

const formatDate = (value) => {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  })
}

const decimalFormat = (value) => {
  const number = Number(value)
  if (Number.isNaN(number)) return '0.00'
  return number.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

const formatCurrency = (value) => {
  return `₱ ${decimalFormat(value)}`
}

export default function AgeingPayables() {
  return (
    <RouteProtection routeName={['aging_payables', 'purchase']}>
      <AgeingPayablesContent />
    </RouteProtection>
  )
}

function AgeingPayablesContent() {
  const { purchases, loading, error, refetchPurchases } = useAgeingPayables()
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState('')
  const [statusTab, setStatusTab] = useState('ALL')
  const [bucketFilter, setBucketFilter] = useState('ALL')
  const [asOfDate, setAsOfDate] = useState(new Date())
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [selectedItem, setSelectedItem] = useState(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false)
  const [paymentAmount, setPaymentAmount] = useState(0)

  // Calculate aging buckets for each purchase
  const purchasesWithAging = useMemo(() => {
    const now = new Date()
    return (purchases || []).map((purchase) => {
      const dueDate = new Date(purchase.date_due || purchase.due_date)
      const daysOverdue = Math.floor((now - dueDate) / (1000 * 60 * 60 * 24))
      const amountDue = Number(purchase.amount_due || purchase.total_amount_due || purchase.total_amount) || 0
      const amountTotal = Number(purchase.total_amount || purchase.amount) || 0
      const paidAmount = amountTotal - amountDue

      let agingBucket = 'Current'
      let bucketAmounts = {
        current: 0,
        b1_30: 0,
        b31_60: 0,
        b61_90: 0,
        b90_plus: 0,
      }

      if (daysOverdue <= 0) {
        agingBucket = 'Current'
        bucketAmounts.current = amountDue
      } else if (daysOverdue <= 30) {
        agingBucket = '1-30'
        bucketAmounts.b1_30 = amountDue
      } else if (daysOverdue <= 60) {
        agingBucket = '31-60'
        bucketAmounts.b31_60 = amountDue
      } else if (daysOverdue <= 90) {
        agingBucket = '61-90'
        bucketAmounts.b61_90 = amountDue
      } else {
        agingBucket = '90+'
        bucketAmounts.b90_plus = amountDue
      }

      const status = amountDue === 0 ? 'PAID' : amountDue < amountTotal ? 'PARTIALLY PAID' : 'OVERDUE'

      return {
        ...purchase,
        id: purchase.id,
        vendor_code: purchase.vendor_code || `VEN-${purchase.id}`,
        vendor_name: purchase.vendor || purchase.vendor_name || 'Unknown',
        doc_ref: purchase.doc_ref || purchase.document_reference || '—',
        terms: purchase.terms || 'Net 30',
        date_delivered: formatDate(purchase.date_delivered),
        date_due: formatDate(dueDate),
        days_overdue: daysOverdue,
        amount_total: amountTotal,
        amount_due: amountDue,
        status,
        aging_bucket: agingBucket,
        bucket_amounts: bucketAmounts,
      }
    })
  }, [purchases])

  // Filter purchases based on search, status, and bucket
  const filteredPurchases = useMemo(() => {
    return purchasesWithAging.filter((item) => {
      const matchesSearch =
        searchQuery === '' ||
        item.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.vendor_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.vendor_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.doc_ref.toLowerCase().includes(searchQuery.toLowerCase())

      const matchesStatus = statusTab === 'ALL' || item.status === statusTab
      const matchesBucket = bucketFilter === 'ALL' || item.aging_bucket === bucketFilter

      return matchesSearch && matchesStatus && matchesBucket
    })
  }, [purchasesWithAging, searchQuery, statusTab, bucketFilter])

  // Calculate summary statistics
  const stats = useMemo(() => {
    let totalAmount = 0
    let bucketCurrent = 0,
      countCurrent = 0
    let bucket1_30 = 0,
      count1_30 = 0
    let bucket31_60 = 0,
      count31_60 = 0
    let bucket61_90 = 0,
      count61_90 = 0
    let bucket90_plus = 0,
      count90_plus = 0

    filteredPurchases.forEach((inv) => {
      totalAmount += inv.amount_due
      bucketCurrent += inv.bucket_amounts.current
      if (inv.bucket_amounts.current > 0) countCurrent++

      bucket1_30 += inv.bucket_amounts.b1_30
      if (inv.bucket_amounts.b1_30 > 0) count1_30++

      bucket31_60 += inv.bucket_amounts.b31_60
      if (inv.bucket_amounts.b31_60 > 0) count31_60++

      bucket61_90 += inv.bucket_amounts.b61_90
      if (inv.bucket_amounts.b61_90 > 0) count61_90++

      bucket90_plus += inv.bucket_amounts.b90_plus
      if (inv.bucket_amounts.b90_plus > 0) count90_plus++
    })

    return {
      totalAmount,
      bucketCurrent,
      countCurrent,
      bucket1_30,
      count1_30,
      bucket31_60,
      count31_60,
      bucket61_90,
      count61_90,
      bucket90_plus,
      count90_plus,
    }
  }, [filteredPurchases])

  const calculatePercent = (amount) => {
    if (!stats.totalAmount || stats.totalAmount === 0) return '0'
    return ((amount / stats.totalAmount) * 100).toFixed(1)
  }

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await refetchPurchases()
    setTimeout(() => setIsRefreshing(false), 600)
  }

  const resetFilters = () => {
    setSearchQuery('')
    setStatusTab('ALL')
    setBucketFilter('ALL')
  }

  const openModal = (item) => {
    setSelectedItem(item)
    setIsModalOpen(true)
  }

  const openPaymentModal = (item) => {
    setSelectedItem(item)
    setPaymentAmount(item.amount_due)
    setIsPaymentModalOpen(true)
  }

  const handleView = (item) => {
    navigate(`/purchase?id=${item.id}`)
  }

  if (loading) return <LoadingScreen label="Loading Aging Payables..." />

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
      {/* --- HEADER SECTION --- */}
      <div className="shrink-0 mb-6">
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start space-x-4">
            <div className="w-12 h-12 rounded-xl bg-black text-white flex items-center justify-center font-black text-xl shadow-md">
              5L
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold tracking-widest text-gray-400 uppercase">
                  5L SOLUTIONS CORP. • FINANCE & ACCOUNTING
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-green-100 text-green-800 border border-green-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1 animate-pulse"></span>
                  Live AP Ledger
                </span>
              </div>
              <h1 className="text-2xl font-black text-black tracking-tight mt-0.5">
                ACCOUNTS PAYABLE AGING DETAIL REPORT
              </h1>
              <p className="text-xs text-gray-500 mt-1">
                As of <span className="font-semibold text-gray-700">{formatDate(asOfDate)}</span> • Currency:{' '}
                <span className="font-semibold text-gray-700">PHP (₱)</span> • Entity:{' '}
                <span className="font-semibold text-gray-700">Main HQ Manila</span>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => window.print()}
              className="flex items-center space-x-1.5 px-3 py-2 bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 text-xs font-semibold rounded-xl shadow-sm transition"
            >
              <Printer size={14} />
              <span>Print</span>
            </button>
            <button className="flex items-center space-x-1.5 px-3 py-2 bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 text-xs font-semibold rounded-xl shadow-sm transition">
              <FileText size={14} />
              <span>Export CSV</span>
            </button>
            <button
              onClick={handleRefresh}
              className={`p-2 bg-black hover:bg-red-600 text-white rounded-xl shadow-sm transition ${
                isRefreshing ? 'animate-spin' : ''
              }`}
              title="Refresh Payables Data"
            >
              <RotateCw size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* --- AGING SUMMARY KPI GRID --- */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <SummaryTile
          label="Current (Not Due)"
          value={formatCurrency(stats.bucketCurrent)}
          count={stats.countCurrent}
          percent={calculatePercent(stats.bucketCurrent)}
          color="emerald"
        />
        <SummaryTile
          label="1 - 30 Days"
          value={formatCurrency(stats.bucket1_30)}
          count={stats.count1_30}
          percent={calculatePercent(stats.bucket1_30)}
          color="amber"
        />
        <SummaryTile
          label="31 - 60 Days"
          value={formatCurrency(stats.bucket31_60)}
          count={stats.count31_60}
          percent={calculatePercent(stats.bucket31_60)}
          color="orange"
        />
        <SummaryTile
          label="61 - 90 Days"
          value={formatCurrency(stats.bucket61_90)}
          count={stats.count61_90}
          percent={calculatePercent(stats.bucket61_90)}
          color="rose"
        />
        <SummaryTile
          label="> 90 Days Past Due"
          value={formatCurrency(stats.bucket90_plus)}
          count={stats.count90_plus}
          percent={calculatePercent(stats.bucket90_plus)}
          color="red"
        />
        <SummaryTile
          label="Total AP Outstanding"
          value={formatCurrency(stats.totalAmount)}
          count={filteredPurchases.length}
          percent="100"
          color="dark"
        />
      </div>

      {/* --- FILTER TOOLBAR & TABLE --- */}
      <div className="flex-1 min-h-0 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-200 bg-gray-50 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold text-gray-600">
            <button
              onClick={() => setStatusTab('ALL')}
              className={`px-3 py-1.5 rounded-lg transition ${
                statusTab === 'ALL'
                  ? 'bg-black text-white'
                  : 'bg-white hover:bg-gray-100 text-gray-700 border border-gray-200'
              }`}
            >
              All Items ({purchasesWithAging.length})
            </button>
            <button
              onClick={() => setStatusTab('OVERDUE')}
              className={`px-3 py-1.5 rounded-lg transition ${
                statusTab === 'OVERDUE'
                  ? 'bg-red-600 text-white'
                  : 'bg-white hover:bg-gray-100 text-gray-700 border border-gray-200'
              }`}
            >
              Overdue Only
            </button>
            <button
              onClick={() => setStatusTab('PARTIALLY PAID')}
              className={`px-3 py-1.5 rounded-lg transition ${
                statusTab === 'PARTIALLY PAID'
                  ? 'bg-amber-500 text-white'
                  : 'bg-white hover:bg-gray-100 text-gray-700 border border-gray-200'
              }`}
            >
              Partially Paid
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 sm:w-64">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search Vendor, PO #, Doc Ref..."
                className="w-full pl-9 pr-3 py-1.5 bg-white border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-black focus:outline-none transition"
              />
              <Filter size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            </div>

            <select
              value={bucketFilter}
              onChange={(e) => setBucketFilter(e.target.value)}
              className="px-3 py-1.5 bg-white border border-gray-200 rounded-xl text-xs font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-black"
            >
              <option value="ALL">All Aging Buckets</option>
              <option value="Current">Current (Not Due)</option>
              <option value="1-30">1 - 30 Days Overdue</option>
              <option value="31-60">31 - 60 Days Overdue</option>
              <option value="61-90">61 - 90 Days Overdue</option>
              <option value="90+">&gt; 90 Days Overdue</option>
            </select>

            <button
              onClick={resetFilters}
              className="p-1.5 text-gray-400 hover:text-gray-700 bg-gray-100 rounded-xl transition"
              title="Reset Filters"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* --- AGING TABLE --- */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-black text-white text-[11px] font-bold uppercase tracking-wider">
                <th className="py-3 px-3">PO # / Ref</th>
                <th className="py-3 px-3">Vendor Name</th>
                <th className="py-3 px-3 text-center">PO Date</th>
                <th className="py-3 px-3 text-center">Due Date</th>
                <th className="py-3 px-3 text-center">Terms</th>
                <th className="py-3 px-3 text-right text-green-300 bg-gray-900/80">Current</th>
                <th className="py-3 px-3 text-right text-amber-300 bg-gray-900/80">1-30 Days</th>
                <th className="py-3 px-3 text-right text-orange-300 bg-gray-900/80">31-60 Days</th>
                <th className="py-3 px-3 text-right text-rose-300 bg-gray-900/80">61-90 Days</th>
                <th className="py-3 px-3 text-right text-red-300 bg-gray-900/80">&gt; 90 Days</th>
                <th className="py-3 px-3 text-right font-black text-white bg-gray-950">Total Due</th>
                <th className="py-3 px-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 text-xs font-medium text-gray-700 bg-white">
              {filteredPurchases.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50 transition group">
                  <td className="py-3 px-3 font-mono font-bold text-black whitespace-nowrap">
                    <div>{item.id}</div>
                    <div className="text-[10px] text-gray-400 font-normal">Ref: {item.doc_ref}</div>
                  </td>
                  <td className="py-3 px-3 whitespace-nowrap">
                    <div className="font-bold text-black">{item.vendor_name}</div>
                    <div className="text-[10px] text-gray-400 font-mono">{item.vendor_code}</div>
                  </td>
                  <td className="py-3 px-3 text-center text-gray-600 whitespace-nowrap font-mono text-[11px]">
                    {item.date_delivered}
                  </td>
                  <td
                    className={`py-3 px-3 text-center font-mono text-[11px] whitespace-nowrap ${
                      item.days_overdue > 0 ? 'text-red-600 font-bold' : 'text-gray-700'
                    }`}
                  >
                    {item.date_due}
                  </td>
                  <td className="py-3 px-3 text-center whitespace-nowrap">
                    <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-600 font-mono text-[10px] font-semibold border border-gray-200">
                      {item.terms}
                    </span>
                  </td>
                  <td
                    className={`py-3 px-3 text-right font-mono whitespace-nowrap bg-gray-50/50 ${
                      item.bucket_amounts.current > 0 ? 'text-black font-semibold' : 'text-gray-300'
                    }`}
                  >
                    {item.bucket_amounts.current > 0 ? formatCurrency(item.bucket_amounts.current) : '—'}
                  </td>
                  <td
                    className={`py-3 px-3 text-right font-mono whitespace-nowrap bg-amber-50/20 ${
                      item.bucket_amounts.b1_30 > 0 ? 'text-amber-700 font-semibold' : 'text-gray-300'
                    }`}
                  >
                    {item.bucket_amounts.b1_30 > 0 ? formatCurrency(item.bucket_amounts.b1_30) : '—'}
                  </td>
                  <td
                    className={`py-3 px-3 text-right font-mono whitespace-nowrap bg-orange-50/20 ${
                      item.bucket_amounts.b31_60 > 0 ? 'text-orange-700 font-semibold' : 'text-gray-300'
                    }`}
                  >
                    {item.bucket_amounts.b31_60 > 0 ? formatCurrency(item.bucket_amounts.b31_60) : '—'}
                  </td>
                  <td
                    className={`py-3 px-3 text-right font-mono whitespace-nowrap bg-rose-50/20 ${
                      item.bucket_amounts.b61_90 > 0 ? 'text-rose-700 font-semibold' : 'text-gray-300'
                    }`}
                  >
                    {item.bucket_amounts.b61_90 > 0 ? formatCurrency(item.bucket_amounts.b61_90) : '—'}
                  </td>
                  <td
                    className={`py-3 px-3 text-right font-mono whitespace-nowrap bg-red-50/20 ${
                      item.bucket_amounts.b90_plus > 0 ? 'text-red-700 font-bold' : 'text-gray-300'
                    }`}
                  >
                    {item.bucket_amounts.b90_plus > 0 ? formatCurrency(item.bucket_amounts.b90_plus) : '—'}
                  </td>
                  <td className="py-3 px-3 text-right font-mono font-black text-black bg-gray-100/60 whitespace-nowrap text-sm">
                    {formatCurrency(item.amount_due)}
                  </td>
                  <td className="py-3 px-3 text-center whitespace-nowrap">
                    <div className="flex items-center justify-center space-x-1">
                      <button
                        onClick={() => openModal(item)}
                        className="p-1.5 text-gray-600 hover:text-black bg-gray-100 hover:bg-gray-200 rounded-lg transition"
                        title="View Detail Ledger"
                      >
                        <Eye size={12} />
                      </button>
                      <button
                        onClick={() => handleView(item)}
                        className="p-1.5 text-gray-600 hover:text-black bg-gray-100 hover:bg-gray-200 rounded-lg transition"
                        title="View Purchase Order"
                      >
                        <FileText size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {filteredPurchases.length === 0 && (
                <tr>
                  <td colSpan={12} className="py-12 text-center text-gray-400 bg-white">
                    <FileText size={32} className="mx-auto mb-2 text-gray-300" />
                    <p className="text-sm">No aging payables found matching selected criteria.</p>
                  </td>
                </tr>
              )}
            </tbody>

            {/* --- FOOTER TOTALS --- */}
            <tfoot className="bg-black text-white text-xs font-bold font-mono">
              <tr>
                <td colSpan={5} className="py-3 px-4 text-right uppercase tracking-wider font-sans font-extrabold text-gray-300">
                  GRAND TOTAL PAYABLES:
                </td>
                <td className="py-3 px-3 text-right text-green-400 bg-gray-950/80 border-t border-gray-700">
                  {formatCurrency(stats.bucketCurrent)}
                </td>
                <td className="py-3 px-3 text-right text-amber-400 bg-gray-950/80 border-t border-gray-700">
                  {formatCurrency(stats.bucket1_30)}
                </td>
                <td className="py-3 px-3 text-right text-orange-400 bg-gray-950/80 border-t border-gray-700">
                  {formatCurrency(stats.bucket31_60)}
                </td>
                <td className="py-3 px-3 text-right text-rose-400 bg-gray-950/80 border-t border-gray-700">
                  {formatCurrency(stats.bucket61_90)}
                </td>
                <td className="py-3 px-3 text-right text-red-400 bg-gray-950/80 border-t border-gray-700">
                  {formatCurrency(stats.bucket90_plus)}
                </td>
                <td className="py-3 px-3 text-right font-black text-green-300 bg-gray-950 text-sm border-t-2 border-b-4 border-gray-600">
                  {formatCurrency(stats.totalAmount)}
                </td>
                <td className="py-3 px-3 bg-black"></td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* --- FOOTER METADATA --- */}
        <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between text-xs text-gray-500 gap-2">
          <div className="flex items-center space-x-4">
            <span>
              RECORD COUNT: <strong className="text-black">{filteredPurchases.length}</strong>
            </span>
            <span>•</span>
            <span>
              LEDGER AGING MODE: <strong className="text-black">DUE DATE BASED</strong>
            </span>
            <span>•</span>
            <span>
              LAST SYNC: <strong className="text-black">{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong>
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-gray-400">Standard Accounting Format •</span>
            <span className="font-bold tracking-wider text-black">5L SOLUTIONS CORP.</span>
          </div>
        </div>
      </div>

      {/* --- DETAIL MODAL --- */}
      {isModalOpen && selectedItem && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-gray-100 overflow-hidden">
            <div className="bg-black text-white p-6 flex items-center justify-between">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="px-2 py-0.5 bg-red-500/20 text-red-300 border border-red-500/30 rounded text-[10px] font-mono font-bold">
                    {selectedItem.id}
                  </span>
                  <span className="text-gray-400 text-xs">Vendor Payable Detail</span>
                </div>
                <h2 className="text-xl font-bold mt-1">{selectedItem.vendor_name}</h2>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-white p-2 rounded-xl transition"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-2xl border border-gray-100 text-xs">
                <div>
                  <span className="text-gray-400 block mb-0.5">Vendor Code</span>
                  <span className="font-mono font-bold text-black">{selectedItem.vendor_code}</span>
                </div>
                <div>
                  <span className="text-gray-400 block mb-0.5">Doc Reference</span>
                  <span className="font-mono font-bold text-black">{selectedItem.doc_ref}</span>
                </div>
                <div>
                  <span className="text-gray-400 block mb-0.5">PO Date</span>
                  <span className="font-bold text-black">{selectedItem.date_delivered}</span>
                </div>
                <div>
                  <span className="text-gray-400 block mb-0.5">Due Date</span>
                  <span className="font-bold text-red-600">{selectedItem.date_due}</span>
                </div>
              </div>

              <div className="flex items-center justify-between p-4 bg-black text-white rounded-2xl">
                <div>
                  <span className="text-xs text-gray-400 uppercase font-bold block">Current Balance Due</span>
                  <span className="text-2xl font-black text-green-400 font-mono">
                    {formatCurrency(selectedItem.amount_due)}
                  </span>
                </div>
                <div className="text-right text-xs">
                  <span className="text-gray-400 block">
                    Total PO: <strong className="text-white">{formatCurrency(selectedItem.amount_total)}</strong>
                  </span>
                  <span className="text-gray-400 block">
                    Payment Terms: <strong className="text-amber-300">{selectedItem.terms}</strong>
                  </span>
                </div>
              </div>

              <div className="border border-gray-200 rounded-xl p-3 bg-gray-50/50">
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
                  Aging Bucket Classification
                </h4>
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-gray-600">
                    Days Past Due: <strong className="text-black">{selectedItem.days_overdue} Days</strong>
                  </span>
                  <span
                    className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                      selectedItem.days_overdue > 0 ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                    }`}
                  >
                    {selectedItem.aging_bucket} Bucket
                  </span>
                </div>
              </div>
            </div>

            <div className="p-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
              <button className="px-4 py-2 bg-white hover:bg-gray-100 border border-gray-200 text-gray-700 rounded-xl text-xs font-semibold transition">
                Send Statement of Account
              </button>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-gray-500 hover:text-black text-xs font-semibold transition"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    setIsModalOpen(false)
                    openPaymentModal(selectedItem)
                  }}
                  className="px-4 py-2 bg-black hover:bg-red-600 text-white rounded-xl text-xs font-semibold transition shadow-md"
                >
                  Record Payment
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- PAYMENT MODAL --- */}
      {isPaymentModalOpen && selectedItem && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-gray-100 overflow-hidden">
            <div className="bg-black text-white p-5 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base">Record Payment Entry</h3>
                <p className="text-xs text-gray-400">
                  {selectedItem.id} • {selectedItem.vendor_name}
                </p>
              </div>
              <button
                onClick={() => setIsPaymentModalOpen(false)}
                className="text-gray-400 hover:text-white transition"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-5 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-gray-700 mb-1">Payment Amount (₱)</label>
                <input
                  type="number"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(Number(e.target.value))}
                  step="0.01"
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm font-mono font-bold text-black focus:ring-2 focus:ring-black focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block font-semibold text-gray-700 mb-1">Payment Method</label>
                <select className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-black focus:outline-none">
                  <option>Bank Wire / Online Deposit</option>
                  <option>Check Deposit</option>
                  <option>Cash Payment</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-gray-700 mb-1">Official Receipt (OR) / Ref #</label>
                <input
                  type="text"
                  placeholder="e.g. OR-2026-9982"
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-black focus:outline-none"
                  required
                />
              </div>
              <div className="pt-2 flex justify-end space-x-2">
                <button
                  onClick={() => setIsPaymentModalOpen(false)}
                  className="px-4 py-2 text-gray-500 font-semibold"
                >
                  Cancel
                </button>
                <button className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl transition shadow">
                  Post Payment
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function SummaryTile({ label, value, count, percent, color }) {
  const colorClasses = {
    emerald: 'text-green-600 bg-green-500',
    amber: 'text-amber-600 bg-amber-400',
    orange: 'text-orange-600 bg-orange-500',
    rose: 'text-rose-600 bg-rose-500',
    red: 'text-red-700 bg-red-700',
    dark: 'text-green-400 bg-green-400',
  }

  const bgClass = color === 'dark' ? 'bg-black text-white' : 'bg-white border border-gray-200'

  return (
    <div className={`${bgClass} p-4 rounded-xl shadow-sm relative overflow-hidden`}>
      <span className="text-[10px] font-bold tracking-wider text-gray-400 uppercase block mb-1">
        {label}
      </span>
      <span className="text-lg font-black tracking-tight font-mono block" style={{ color: colorClasses[color].split(' ')[0] }}>
        {value}
      </span>
      <div className="mt-2 text-[10px] text-gray-400 flex items-center justify-between">
        <span>{count} Invoices</span>
        <span className="font-bold" style={{ color: colorClasses[color].split(' ')[0] }}>
          {percent}%
        </span>
      </div>
      <div className={`absolute bottom-0 left-0 right-0 h-1 ${colorClasses[color].split(' ')[1]}`} />
    </div>
  )
}
