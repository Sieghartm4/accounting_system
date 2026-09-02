import React, { useEffect, useMemo, useState } from 'react'
import { Clock3, RefreshCw, TrendingDown } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import DynamicTable from '../../components/DynamicTable'
import RouteProtection from '../../components/RouteProtection'
import useAgeingPayables from './useAgeingPayables'
import { AgingTimerCell } from '../aging_receivables/AgeingReceivables'

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

const formatAmount = (value) =>
  Number(value || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

function AgeingPayablesContent() {
  const { purchases, loading, error, refetchPurchases } = useAgeingPayables()
  const navigate = useNavigate()
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    const intervalId = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(intervalId)
  }, [])

  const totalAmountDue = useMemo(
    () =>
      purchases.reduce((sum, purchase) => sum + Number(purchase.amount_due || 0), 0),
    [purchases],
  )

  const overdueCount = useMemo(
    () =>
      purchases.filter((purchase) => {
        const dueTime = new Date(purchase.date_due).getTime()
        return Number.isFinite(dueTime) && now - dueTime > 0
      }).length,
    [purchases, now],
  )

  const tableData = useMemo(
    () =>
      purchases.map((purchase) => {
        return {
          id: purchase.id,
          vendor: purchase.vendor || 'Unknown Vendor',
          doc_ref: purchase.doc_ref || '—',
          date_delivered: formatDate(purchase.date_delivered),
          date_due: formatDate(purchase.date_due),
          amount_due: `₱ ${formatAmount(purchase.amount_due)}`,
          status: purchase.status || 'UNKNOWN',
          aging: <AgingTimerCell dueDate={purchase.date_due} now={now} />,
        }
      }),
    [purchases, now],
  )

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-sm text-gray-500">
        Syncing Aging Payables...
      </div>
    )
  }

  if (error) {
    return <div className="p-10 text-red-600">{error}</div>
  }

  return (
    <div className="h-full flex flex-col bg-transparent overflow-hidden">
      <div className="shrink-0 flex flex-col md:flex-row md:items-end justify-between gap-4 mb-5">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-black rounded-lg text-red-500">
            <Clock3 size={24} />
          </div>
          <h1 className="text-4xl font-black text-black tracking-tighter">
            Aging <span className="text-red-600 italic">Payables</span>
          </h1>
        </div>
        <div className="flex items-center gap-2 bg-white rounded-lg px-3 py-1 border border-gray-200">
          <label className="text-[10px] font-black text-gray-500 uppercase tracking-wider">
            Due
          </label>
          <input
            type="date"
            value={dateFrom}
            onChange={(event) => setDateFrom(event.target.value)}
            className="px-2 py-1 bg-gray-50 border border-gray-100 rounded text-sm"
          />
          <span className="text-gray-400">to</span>
          <input
            type="date"
            value={dateTo}
            onChange={(event) => setDateTo(event.target.value)}
            className="px-2 py-1 bg-gray-50 border border-gray-100 rounded text-sm"
          />
          <button
            type="button"
            onClick={() =>
              refetchPurchases({ date_from: dateFrom, date_to: dateTo })
            }
            className="px-3 py-1 bg-black text-white text-sm font-bold rounded-lg hover:bg-red-600 cursor-pointer"
          >
            Apply
          </button>
          <button
            type="button"
            onClick={() => {
              setDateFrom('')
              setDateTo('')
              refetchPurchases()
            }}
            className="px-2 py-1 bg-white border border-gray-200 text-sm font-bold rounded-lg hover:bg-gray-50 cursor-pointer"
          >
            Clear
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
        <SummaryCard
          icon={<TrendingDown className="text-red-600" size={20} />}
          label="Open Payables"
          value={purchases.length}
          subText="Unpaid Purchases"
        />
        <SummaryCard
          icon={<Clock3 className="text-black" size={20} />}
          label="Overdue Age"
          value={`${overdueCount} Items`}
          subText="Live Timer"
        />
        <SummaryCard
          icon={<TrendingDown className="text-gray-400" size={20} />}
          label="Total Amount Due"
          value={`₱ ${formatAmount(totalAmountDue)}`}
          subText="Open Balance"
        />
      </div>

      <div className="flex-1 min-h-0 bg-white rounded-2xl shadow-xl shadow-black/5 overflow-hidden border border-gray-100">
        <DynamicTable
          data={tableData}
          title="Aging Payables"
          enableAddButton={false}
          enableActionColumn
          actionButtons={[
            {
              label: 'View',
              onClick: (row) =>
                navigate(`/purchase?id=${encodeURIComponent(row.id)}`),
            },
          ]}
          badgeColumns={[
            {
              column: 'status',
              values: {
                PAID: 'green',
                UNPAID: 'red',
                PARTIAL: 'yellow',
                APPROVED: 'blue',
              },
            },
          ]}
        />
      </div>
    </div>
  )
}

function SummaryCard({ icon, label, value, subText }) {
  return (
    <div className="bg-white p-4 rounded-xl border border-gray-100 flex items-center gap-4 shadow-sm">
      <div className="p-3 bg-gray-50 rounded-xl">{icon}</div>
      <div>
        <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">
          {label}
        </p>
        <h4 className="text-xl font-black text-black">{value}</h4>
        <span className="text-[9px] font-bold text-gray-400 uppercase">
          {subText}
        </span>
      </div>
    </div>
  )
}

export default function AgeingPayables() {
  return (
    <RouteProtection routeName={['aging_payables', 'purchase']}>
      <AgeingPayablesContent />
    </RouteProtection>
  )
}
