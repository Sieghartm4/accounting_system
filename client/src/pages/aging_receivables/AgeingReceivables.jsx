import React, { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
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
  return number.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
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

  const formatBlock = (value) => String(value).padStart(2, '0')
  const statusLabel = isFuture ? 'Due in' : 'Overdue'
  const badgeClasses = isFuture
    ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
    : 'bg-red-100 text-red-700 border-red-200'

  return (
    <div className="flex flex-col items-start gap-2">
      <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.3em] ${badgeClasses}`}>
        {statusLabel}
      </span>
      <div className="inline-flex items-center gap-1 rounded-3xl bg-[#111111] px-2 py-2 shadow-inner shadow-black/20">
        {[days, hours, minutes, seconds].map((value, idx) => (
          <div key={idx} className="flex flex-col items-center justify-center rounded-2xl bg-[#1f2937] px-3 py-2 min-w-10.5 shrink-0">
            <span className="text-sm font-black text-white">{formatBlock(value)}</span>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-4 gap-2 text-[10px] uppercase tracking-[0.2em] text-gray-500 w-full px-1">
        <span className="text-center">D</span>
        <span className="text-center">H</span>
        <span className="text-center">M</span>
        <span className="text-center">S</span>
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
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    const intervalId = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(intervalId)
  }, [])

  const fadeInUp = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } }
  }

  const overdueCount = sales?.length || 0
  const totalAmountDue = useMemo(() => {
    return (sales || []).reduce(
      (sum, sale) =>
        sum + (Number(sale.amount_due || sale.total_amount_due || sale.total_amount) || 0),
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
        <p className="text-xs font-black uppercase tracking-[3px] text-gray-400">Syncing Aging Receivables...</p>
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
            <button 
              type="button"
              className="flex items-center gap-2 px-5 py-3 bg-white border border-gray-200 text-xs font-bold text-black rounded-xl hover:bg-gray-50 transition-all shadow-sm tracking-widest uppercase"
            >
              <Download size={14} />
              Export List
            </button>
            <button
              onClick={refetchSales}
              className="flex items-center gap-2 px-6 py-3 bg-black text-white text-xs font-bold rounded-xl hover:bg-red-600 transition-all shadow-lg tracking-widest uppercase"
            >
              <RefreshCw size={14} />
              Refresh
            </button>
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
        <DynamicTable
          data={tableData}
          title="Aging Receivables"
          enableAddButton={false}
          enableActionColumn={false}
          badgeColumns={[
            {
              column: 'status',
              values: {
                PAID: 'green',
                UNPAID: 'red',
                APPROVED: 'blue',
                PREPARED: 'yellow',
                CHECKED: 'purple',
              }
            }
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
        <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 leading-none mb-1">{label}</p>
        <div className="flex items-baseline gap-2">
          <h4 className="text-xl font-black text-black">{value}</h4>
          <span className="text-[9px] font-bold text-gray-400 uppercase">{subText}</span>
        </div>
      </div>
    </div>
  )
}