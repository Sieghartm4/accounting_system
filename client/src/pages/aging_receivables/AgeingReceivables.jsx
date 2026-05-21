import React, { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { Clock3, TrendingUp, Download, RefreshCw } from 'lucide-react'
import DynamicTable from '../../components/DynamicTable'
import RouteProtection from '../../components/RouteProtection'
import useAgeingReceivables from './useAgeingReceivables'

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

function FlipDigit({ digit }) {
  return (
    <div className="relative bg-gradient-to-b from-[#242930] to-[#111317] border border-[#2b313a] rounded-md px-1.5 py-1.5 shadow-[0_2px_5px_rgba(0,0,0,0.5)] flex items-center justify-center min-w-[20px] h-[30px] overflow-hidden">
      <div className="absolute inset-x-0 top-1/2 h-[1px] bg-black/80 z-10 shadow-[0_0.5px_0_rgba(255,255,255,0.06)]" />
      <div className="absolute inset-x-0 top-0 h-1/2 bg-white/[0.03] pointer-events-none z-0" />
      <span className="font-mono text-[13px] font-black text-gray-100 tracking-wider z-0 leading-none select-none drop-shadow-[0_1.5px_2px_rgba(0,0,0,0.95)]">
        {digit}
      </span>
    </div>
  )
}

function FlipUnitGroup({ value, label }) {
  const padValue = String(value).padStart(2, '0')
  const digit1 = padValue.charAt(0)
  const digit2 = padValue.charAt(1)

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex gap-0.5">
        <FlipDigit digit={digit1} />
        <FlipDigit digit={digit2} />
      </div>
      <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest leading-none mt-0.5">
        {label}
      </span>
    </div>
  )
}

function AgingTimerCell({ dueDate, now }) {
  const dueTime = new Date(dueDate).getTime()
  const timeDiff = Number.isFinite(dueTime) ? now - dueTime : 0
  const isFuture = timeDiff < 0
  const absMs = Math.abs(timeDiff)
  const totalSeconds = Math.floor(absMs / 1000)
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  const statusLabel = isFuture ? 'Due in' : 'Overdue'
  const badgeClasses = isFuture
    ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
    : 'bg-rose-500/10 text-rose-600 border-rose-500/20'

  return (
    <div className="inline-flex items-stretch">
      {/* LEFT STATUS */}
      <span
        className={`flex items-center justify-center gap-1.5 
      rounded-l-xl border border-r-0 
      px-3 h-14 
      text-[9px] font-black uppercase tracking-wider 
      leading-none
      ${badgeClasses}`}
      >
        <span
          className={`h-1.5 w-1.5 rounded-full animate-pulse ${
            isFuture ? 'bg-emerald-500' : 'bg-rose-500'
          }`}
        />
        {statusLabel}
      </span>

      {/* RIGHT TIMER */}
      <div
        className="flex items-center gap-1.5 
      rounded-r-xl bg-[#0b0c0e] px-3 
      h-14 border border-[#1b1c20] 
      shadow-[inset_0_2px_8px_rgba(0,0,0,0.8),0_4px_12px_rgba(0,0,0,0.15)]"
      >
        <FlipUnitGroup value={days} label="Days" />

        <span className="text-xs font-mono text-gray-500 font-bold select-none">
          :
        </span>

        <FlipUnitGroup value={hours} label="Hours" />

        <span className="text-xs font-mono text-gray-500 font-bold select-none">
          :
        </span>

        <FlipUnitGroup value={minutes} label="Mins" />

        <span className="text-xs font-mono text-gray-500 font-bold select-none">
          :
        </span>

        <FlipUnitGroup value={seconds} label="Secs" />
      </div>
    </div>
  )
}

export default function AgeingReceivables() {
  return (
    <RouteProtection routeName="aging_receivables">
      <AgeingReceivablesContent />
    </RouteProtection>
  )
}

function AgeingReceivablesContent() {
  const { sales, loading, error, refetchSales } = useAgeingReceivables()
  const navigate = useNavigate()
  const [now, setNow] = useState(Date.now())
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  useEffect(() => {
    const intervalId = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(intervalId)
  }, [])

  const fadeInUp = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
  }

  const overdueCount = sales?.length || 0
  const totalAmountDue = useMemo(() => {
    return (sales || []).reduce(
      (sum, sale) =>
        sum +
        (Number(sale.amount_due || sale.total_amount_due || sale.total_amount) || 0),
      0,
    )
  }, [sales])

  const tableData = useMemo(() => {
    return (sales || []).map((sale) => {
      const dueDate = sale.date_due || sale.dateDue || sale.due_date

      return {
        id: sale.id,
        customer: sale.customer || 'Unknown',
        doc_ref: sale.doc_ref || sale.document_reference || '—',
        date_delivered: formatDate(sale.date_delivered),
        date_due: formatDate(dueDate),
        amount_due: `₱ ${decimalFormat(sale.amount_due || sale.total_amount_due || sale.total_amount)}`,
        status: sale.status || 'UNKNOWN',
        aging_ledger: <AgingTimerCell dueDate={dueDate} now={now} />,
      }
    })
  }, [sales, now])

  if (loading) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs font-black uppercase tracking-[3px] text-gray-400">
          Syncing Aging Receivables...
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
      {/* --- HEADER SECTION --- */}
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
                <Clock3 size={24} />
              </div>
              <h1 className="text-4xl font-black text-black tracking-tighter">
                Aging <span className="text-red-600 italic">Receivables</span>
              </h1>
            </div>
          </div>

          <div className="flex gap-3">
            <div className="flex items-center gap-3">

              {/* Inline Date Filter */}
              <div className="flex items-center gap-2 bg-white rounded-lg px-3 py-1 border border-gray-200">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-wider mr-1">
                  Due
                </label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="px-2 py-1 bg-gray-50 border border-gray-100 rounded text-sm text-gray-800"
                />
                <span className="text-gray-400">to</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="px-2 py-1 bg-gray-50 border border-gray-100 rounded text-sm text-gray-800"
                />
                
                <button
                  onClick={() =>
                    refetchSales({ date_from: dateFrom, date_to: dateTo })
                  }
                  className="ml-2 px-3 py-1 bg-black text-white text-sm font-bold rounded-lg"
                >
                  Apply
                </button>
                
                <button
                  onClick={() => {
                    setDateFrom('')
                    setDateTo('')
                    refetchSales()
                  }}
                  className="px-2 py-1 bg-white border border-gray-200 text-sm font-bold rounded-lg"
                >
                  Clear
                </button>
              </div>
              <button
                type="button"
                className="flex items-center gap-2 px-5 py-3 bg-white border border-gray-200 text-xs font-bold text-black rounded-xl hover:bg-gray-50 transition-all shadow-sm tracking-widest uppercase"
              >
                <Download size={14} />
                Export List
              </button>
              <button
                onClick={() =>
                  refetchSales({ date_from: dateFrom, date_to: dateTo })
                }
                className="flex items-center gap-2 px-6 py-3 bg-black text-white text-xs font-bold rounded-xl hover:bg-red-600 transition-all shadow-lg tracking-widest uppercase"
              >
                <RefreshCw size={14} />
                Refresh
              </button>
            </div>
          </div>
        </motion.div>

        {/* --- SUMMARY TILES --- */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <SummaryCard
            icon={<TrendingUp className="text-red-600" size={20} />}
            label="Open Receivables"
            value={overdueCount}
            subText="Unpaid Sales"
          />
          <SummaryCard
            icon={<Clock3 className="text-black" size={20} />}
            label="Overdue Age"
            value={`${overdueCount} Items`}
            subText="Live Timer"
          />
          <SummaryCard
            icon={<TrendingUp className="text-gray-400" size={20} />}
            label="Total Amount Due"
            value={`₱ ${decimalFormat(totalAmountDue)}`}
            subText="Open Balance"
          />
        </div>
      </div>

      {/* --- TABLE SECTION --- */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="flex-1 min-h-0 bg-white rounded-2xl shadow-xl shadow-black/5 overflow-hidden border border-gray-100"
      >
        {/* Date filter moved to header to preserve DynamicTable footer */}

        <DynamicTable
          data={tableData}
          title="Aging Receivables"
          enableAddButton={false}
          enableActionColumn={true}
          actionButtons={[
            {
              label: 'View',
              onClick: (row) => {
                // navigate to Sales page with id query param to open SalesForm view
                navigate(`/sales?id=${row.id}`)
              },
            },
          ]}
          badgeColumns={[
            {
              column: 'status',
              values: {
                PAID: 'green',
                UNPAID: 'red',
                APPROVED: 'blue',
                PREPARED: 'yellow',
                CHECKED: 'purple',
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
