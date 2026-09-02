import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Calculator,
  Calendar,
  TrendingUp,
  Landmark,
  HandCoins,
  FileText,
  Building2,
  Zap,
  Package,
  Eye,
  Clock,
  Filter,
  Search,
  AlertTriangle,
  Network,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  ShieldCheck,
  ChevronRight,
} from 'lucide-react'
import RouteProtection from '../../components/RouteProtection'
import useResponsibilityCenter from '../responsibility_center/useResponsibilityCenter'

const getCurrentMonthRange = () => {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const lastDay = new Date(year, today.getMonth() + 1, 0).getDate()

  return {
    start: `${year}-${month}-01`,
    end: `${year}-${month}-${String(lastDay).padStart(2, '0')}`,
  }
}

function DashboardNewContent() {
  const navigate = useNavigate()
  const { responsibilityCenters, loading: responsibilityCentersLoading } =
    useResponsibilityCenter()

  // State for Date Filters & Responsibility Center
  const currentMonth = getCurrentMonthRange()
  const [startDate, setStartDate] = useState(currentMonth.start)
  const [endDate, setEndDate] = useState(currentMonth.end)
  const [submittedStartDate, setSubmittedStartDate] = useState(currentMonth.start)
  const [submittedEndDate, setSubmittedEndDate] = useState(currentMonth.end)
  const [submittedResponsibilityCenter, setSubmittedResponsibilityCenter] =
    useState('')
  const [selectedCenter, setSelectedCenter] = useState('all')
  const [centerSearch, setCenterSearch] = useState('')
  const [isCenterDropdownOpen, setIsCenterDropdownOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [chartLoaded, setChartLoaded] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Dynamic Metrics based on Date selection
  const [metrics, setMetrics] = useState({
    netIncome: 0,
    grossRevenue: 0,
    margin: 0,
    cash: 0,
    ar: 0,
    ap: 0,
    netCashMovement: 0,
    collectionsRate: 0,
    paymentsRate: 0,
    overdueAmount: 0,
    cashBreakdown: {
      cashOnHand: 0,
      pettyCash: 0,
      bankAccounts: 0,
      checks: 0,
    },
  })

  // Additional data from API
  const [apiData, setApiData] = useState(null)

  // Chart References
  const perfChartRef = useRef(null)
  const agingChartRef = useRef(null)
  const perfChartInstance = useRef(null)
  const agingChartInstance = useRef(null)
  const centerDropdownRef = useRef(null)

  // Transactions Data
  const [transactions, setTransactions] = useState([
    {
      ref: 'OR-2026-0891',
      date: 'Aug 29, 2026',
      type: 'Receipt',
      party: 'Acme Enterprise Corp',
      center: 'Retail & Sales',
      amount: 28500,
      status: 'Posted',
    },
    {
      ref: 'DV-2026-0412',
      date: 'Aug 28, 2026',
      type: 'Disbursement',
      party: 'Apex Global Logistics',
      center: 'Operations',
      amount: -14250,
      status: 'For Approval',
    },
    {
      ref: 'JV-2026-0105',
      date: 'Aug 28, 2026',
      type: 'Adjustment',
      party: 'Depreciation Expense & Accum. Dep.',
      center: 'Head Office',
      amount: 5400,
      status: 'Posted',
    },
    {
      ref: 'INV-2026-1102',
      date: 'Aug 27, 2026',
      type: 'Sales Invoice',
      party: 'Starlight Retail Group',
      center: 'Retail & Sales',
      amount: 42100,
      status: 'Posted',
    },
  ])

  // Fetch dashboard data from API
  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true)
        const token = localStorage.getItem('token')
        const dashboardParams = new URLSearchParams({
          start_date: submittedStartDate,
          end_date: submittedEndDate,
        })
        if (submittedResponsibilityCenter) {
          dashboardParams.set('responsibility_center', submittedResponsibilityCenter)
        }
        const response = await fetch(
          `${import.meta.env.VITE_SERVER_LINK}/dashboard?${dashboardParams.toString()}`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
          },
        )

        if (response.ok) {
          const result = await response.json()
          if (result.success && result.data) {
            // Store full API data
            setApiData(result.data)

            // Update metrics with actual data
            setMetrics({
              netIncome: result.data.fh?.netIncome || 0,
              grossRevenue: result.data.fh?.grossRevenue || 0,
              margin: result.data.fh?.marginPercent || 0,
              cash: result.data.fh?.totalCashPosition || 0,
              ar: result.data.fh?.totalReceivables || 0,
              ap: result.data.fh?.totalPayables || 0,
              netCashMovement: result.data.fh?.netCashMovement || 0,
              collectionsRate: result.data.fh?.collectionsRate || 0,
              paymentsRate: result.data.fh?.paymentsRate || 0,
              overdueAmount: result.data.arAging?.overdue_total || 0,
              cashBreakdown: result.data.fh?.cashBreakdown || {
                cashOnHand: 0,
                pettyCash: 0,
                bankAccounts: 0,
                checks: 0,
              },
            })

            // Update transactions
            if (result.data.recentTransactions) {
              setTransactions(
                result.data.recentTransactions.map((txn) => ({
                  ref: txn.refNo,
                  date: txn.date,
                  type: txn.module,
                  party: txn.party,
                  center: txn.responsibilityCenter || 'Head Office',
                  amount: txn.amount,
                  status: txn.status,
                  sourceModule: txn.sourceModule,
                  sourceRoute: txn.sourceRoute,
                  entryType: txn.entryType,
                })),
              )
            }
          }
        }
      } catch (err) {
        console.error('Error fetching dashboard data:', err)
        setError('Failed to load dashboard data')
      } finally {
        setLoading(false)
      }
    }

    fetchDashboardData()
  }, [submittedStartDate, submittedEndDate, submittedResponsibilityCenter])

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (
        centerDropdownRef.current &&
        !centerDropdownRef.current.contains(event.target)
      ) {
        setIsCenterDropdownOpen(false)
      }
    }

    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [])

  // Dynamically Load Chart.js CDN script
  useEffect(() => {
    if (window.Chart) {
      setChartLoaded(true)
      return
    }
    const script = document.createElement('script')
    script.src = 'https://cdn.jsdelivr.net/npm/chart.js'
    script.async = true
    script.onload = () => setChartLoaded(true)
    document.body.appendChild(script)
  }, [])

  // Update Data based on Date Range change
  useEffect(() => {
    if (startDate && endDate && !apiData) {
      const start = new Date(startDate)
      const end = new Date(endDate)
      const diffDays = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)))

      const estimatedRev = diffDays * 18700
      const estimatedNet = estimatedRev * 0.246

      setMetrics((prev) => ({
        ...prev,
        grossRevenue: estimatedRev,
        netIncome: estimatedNet,
      }))
    }
  }, [startDate, endDate, apiData])

  const handleDateSubmit = (event) => {
    event.preventDefault()
    setSubmittedStartDate(startDate)
    setSubmittedEndDate(endDate)
    const selectedCenterRecord = responsibilityCenters.find(
      (center) => String(center.id) === String(selectedCenter),
    )
    setSubmittedResponsibilityCenter(
      selectedCenter === 'all' ? '' : selectedCenterRecord?.name || '',
    )
  }

  // Render Charts when Chart.js is loaded
  useEffect(() => {
    if (!chartLoaded) return

    // Financial Performance Chart
    if (perfChartRef.current) {
      if (perfChartInstance.current) perfChartInstance.current.destroy()

      const ctxPerf = perfChartRef.current.getContext('2d')
      const revenueData = apiData?.revenueExpenses || []
      const labels = revenueData.map((d) => d.month || 'Unknown')
      const revenueValues = revenueData.map((d) => d.revenue || 0)
      const expenseValues = revenueData.map((d) => d.expenses || 0)

      // Only render chart if there's actual data from API
      if (revenueData.length === 0) {
        // Showempty state - no chart
        return
      }

      perfChartInstance.current = new window.Chart(ctxPerf, {
        type: 'bar',
        data: {
          labels: labels,
          datasets: [
            {
              label: 'Revenue / Sales',
              data: revenueValues,
              backgroundColor: '#10b981',
              borderRadius: 4,
              barPercentage: 0.6,
            },
            {
              label: 'Expenses',
              data: expenseValues,
              backgroundColor: '#f43f5e',
              borderRadius: 4,
              barPercentage: 0.6,
            },
            {
              label: 'Net Profit',
              data: revenueValues.map((r, i) => r - (expenseValues[i] || 0)),
              type: 'line',
              borderColor: '#0284c7',
              borderWidth: 3,
              fill: false,
              tension: 0.3,
              pointBackgroundColor: '#0284c7',
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: {
            mode: 'nearest',
            intersect: false,
          },
          plugins: {
            legend: { display: false },
            tooltip: {
              enabled: true,
              mode: 'nearest',
              intersect: false,
              callbacks: {
                label: (context) => {
                  const value = Number(context.parsed.y || 0)
                  return `${context.dataset.label}: ₱${value.toLocaleString(
                    'en-PH',
                    {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    },
                  )}`
                },
              },
            },
          },
          scales: {
            y: {
              ticks: {
                callback: function (val) {
                  return '₱' + val / 1000 + 'k'
                },
                font: { size: 10 },
              },
              grid: { color: '#f1f5f9' },
            },
            x: {
              ticks: { font: { size: 10 } },
              grid: { display: false },
            },
          },
        },
      })
    }

    // AR Aging Breakdown Chart
    if (agingChartRef.current) {
      if (agingChartInstance.current) agingChartInstance.current.destroy()

      const ctxAging = agingChartRef.current.getContext('2d')
      const arData = apiData?.arAging || {}
      const agingValues = [
        arData.current || 0,
        arData.overdue_1_30 || 0,
        arData.overdue_31_60 || 0,
        arData.overdue_61_plus || 0,
      ]

      agingChartInstance.current = new window.Chart(ctxAging, {
        type: 'doughnut',
        data: {
          labels: [
            'Current (0-30d)',
            '1-30d Overdue',
            '31-60d Overdue',
            '61+d Overdue',
          ],
          datasets: [
            {
              data: agingValues,
              backgroundColor: ['#10b981', '#3b82f6', '#f59e0b', '#f43f5e'],
              borderWidth: 2,
              borderColor: '#ffffff',
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'bottom',
              labels: { boxWidth: 12, font: { size: 10 } },
            },
          },
          cutout: '65%',
        },
      })
    }

    return () => {
      if (perfChartInstance.current) perfChartInstance.current.destroy()
      if (agingChartInstance.current) agingChartInstance.current.destroy()
    }
  }, [chartLoaded, metrics])

  // Filtered Transactions List
  const filteredTransactions = transactions.filter((t) => {
    const matchesSearch =
      t.ref.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.party.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.type.toLowerCase().includes(searchTerm.toLowerCase())
    const selectedCenterRecord = responsibilityCenters.find(
      (center) => String(center.id) === String(selectedCenter),
    )
    const transactionCenter = String(t.center || '')
      .trim()
      .toLowerCase()
    const matchesCenter =
      selectedCenter === 'all' ||
      (selectedCenterRecord &&
        [selectedCenterRecord.name, selectedCenterRecord.code]
          .filter(Boolean)
          .some((value) => String(value).trim().toLowerCase() === transactionCenter))
    return matchesSearch && matchesCenter
  })

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 font-sans text-slate-800 flex flex-col items-center justify-center">
        <div className="text-slate-500">Loading dashboard...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 font-sans text-slate-800 flex flex-col items-center justify-center">
        <div className="text-red-500">{error}</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 flex flex-col">
      {/* MAIN CONTAINER */}
      <main className="pb-4 space-y-6 flex-1 max-w-8xl w-full mx-auto">
        {/* TOP TITLE & CONTROL BAR */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
          <div>
            <div className="flex items-center space-x-3 mb-1">
              <div>
                <h1 className="text-2xl font-bold text-slate-900 leading-tight">
                  Financial Executive Dashboard
                </h1>
              </div>
            </div>
            <p className="text-xs text-slate-500">
              Real-time accounting overview, operating compliance, and GL ledger
              summaries
            </p>
          </div>

          {/* Global Dashboard Controls */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Start Date & End Date Selector */}
            <form
              onSubmit={handleDateSubmit}
              className="flex items-center space-x-2 bg-white p-1 rounded-lg border border-slate-200 text-xs shadow-sm"
            >
              <span className="text-slate-500 font-medium pl-2 hidden md:inline-flex items-center">
                <Calendar className="w-3.5 h-3.5 mr-1 text-slate-400" /> Date Range:
              </span>
              <div className="flex items-center space-x-1.5">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-slate-50 border border-slate-300 text-slate-700 font-medium rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
                <span className="text-slate-400 font-medium">to</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-slate-50 border border-slate-300 text-slate-700 font-medium rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
                <button
                  type="submit"
                  className="px-3 py-1 bg-black hover:bg-slate-800 active:scale-[0.98] text-white font-semibold rounded-md transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-1"
                >
                  Submit
                </button>
              </div>
            </form>

            {/* Responsibility Center Filter */}
            <div
              ref={centerDropdownRef}
              className="hidden lg:flex items-center bg-white p-1 rounded-lg border border-slate-200 text-xs shadow-sm relative"
            >
              <span className="text-slate-500 font-medium pl-2 flex items-center">
                <Network className="w-3.5 h-3.5 mr-1 text-slate-400" /> Center:
              </span>
              <div className="relative">
                <input
                  type="text"
                  value={centerSearch}
                  onFocus={() => setIsCenterDropdownOpen(true)}
                  onChange={(event) => {
                    setCenterSearch(event.target.value)
                    setSelectedCenter('all')
                    setIsCenterDropdownOpen(true)
                  }}
                  placeholder={
                    responsibilityCentersLoading
                      ? 'Loading centers...'
                      : 'Search center...'
                  }
                  className="w-44 bg-slate-50 border border-slate-300 text-slate-700 font-medium rounded-md px-2 py-1 pr-7 focus:outline-none focus:ring-1 focus:ring-sky-500"
                  aria-label="Search responsibility center"
                />
                {centerSearch && (
                  <button
                    type="button"
                    onClick={() => {
                      setCenterSearch('')
                      setSelectedCenter('all')
                      setSubmittedResponsibilityCenter('')
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                    aria-label="Clear responsibility center"
                  >
                    ×
                  </button>
                )}
                {isCenterDropdownOpen && (
                  <div className="absolute right-0 top-full z-30 mt-1 max-h-56 w-64 overflow-y-auto rounded-md border border-slate-300 bg-white py-1 shadow-lg">
                    <button
                      type="button"
                      onClick={() => {
                        setCenterSearch('')
                        setSelectedCenter('all')
                        setSubmittedResponsibilityCenter('')
                        setIsCenterDropdownOpen(false)
                      }}
                      className="block w-full px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-sky-50 cursor-pointer"
                    >
                      All Responsibility Centers
                    </button>
                    {responsibilityCenters
                      .filter((center) => {
                        const query = centerSearch.trim().toLowerCase()
                        return (
                          !query ||
                          String(center.name || '')
                            .toLowerCase()
                            .includes(query) ||
                          String(center.code || '')
                            .toLowerCase()
                            .includes(query)
                        )
                      })
                      .map((center) => (
                        <button
                          type="button"
                          key={center.id}
                          onClick={() => {
                            setSelectedCenter(String(center.id))
                            setCenterSearch(center.name || center.code || '')
                            setSubmittedResponsibilityCenter(center.name || '')
                            setIsCenterDropdownOpen(false)
                          }}
                          className="block w-full border-t border-slate-100 px-3 py-2 text-left text-xs text-slate-700 hover:bg-sky-50 cursor-pointer"
                        >
                          <span className="font-semibold">{center.name}</span>
                          {center.code && (
                            <span className="ml-2 text-slate-400">
                              {center.code}
                            </span>
                          )}
                        </button>
                      ))}
                    {!responsibilityCentersLoading &&
                      responsibilityCenters.length === 0 && (
                        <div className="px-3 py-2 text-xs text-slate-400">
                          No responsibility centers found
                        </div>
                      )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* TOP FINANCIAL KPI CARDS GRID */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* KPI 1: NET INCOME / PROFIT OR LOSS */}
          <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Net Profit / (Loss)
              </span>
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline justify-between">
              <div className="text-2xl font-bold text-slate-900">
                ₱
                {metrics.netIncome.toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </div>
              <span className="text-xs font-medium text-emerald-600 flex items-center">
                <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" />
                +12.4%
              </span>
            </div>
            <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span>
                Gross Revenue:{' '}
                <strong className="text-slate-700">
                  ₱{(metrics.grossRevenue / 1000).toFixed(0)}k
                </strong>
              </span>
              <span>
                Margin:{' '}
                <strong className="text-emerald-600">
                  {typeof metrics.margin === 'number'
                    ? metrics.margin.toFixed(1)
                    : metrics.margin}
                  %
                </strong>
              </span>
            </div>
          </div>

          {/* KPI 2: CASH & BANK BALANCES */}
          <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Cash & Liquidity
              </span>
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                <Landmark className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline justify-between">
              <div className="text-2xl font-bold text-slate-900">
                ₱{metrics.cash.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </div>
              <span
                className={`text-xs font-medium flex items-center ${metrics.netCashMovement >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}
              >
                {metrics.netCashMovement >= 0 ? (
                  <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" />
                ) : (
                  <ArrowDownRight className="w-3.5 h-3.5 mr-0.5" />
                )}
                {metrics.netCashMovement >= 0 ? '+' : ''}₱
                {(metrics.netCashMovement / 1000).toFixed(0)}k
              </span>
            </div>
            <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span>
                Bank:{' '}
                <strong className="text-slate-700">
                  ₱{(metrics.cashBreakdown.bankAccounts / 1000).toFixed(0)}k
                </strong>
              </span>
              <span>
                Cash:{' '}
                <strong className="text-slate-700">
                  ₱{(metrics.cashBreakdown.cashOnHand / 1000).toFixed(0)}k
                </strong>
              </span>
              <span>
                Petty:{' '}
                <strong className="text-slate-700">
                  ₱{(metrics.cashBreakdown.pettyCash / 1000).toFixed(0)}k
                </strong>
              </span>
              <span>
                Checks:{' '}
                <strong className="text-slate-700">
                  ₱{(metrics.cashBreakdown.checks / 1000).toFixed(0)}k
                </strong>
              </span>
            </div>
          </div>

          {/* KPI 3: ACCOUNTS RECEIVABLE (AR) */}
          <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Accounts Receivable (AR)
              </span>
              <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                <HandCoins className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline justify-between">
              <div className="text-2xl font-bold text-slate-900">
                ₱{metrics.ar.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </div>
              <span className="text-xs font-medium text-rose-600 flex items-center">
                <AlertTriangle className="w-3.5 h-3.5 mr-1" />₱
                {(apiData?.alerts?.overdueReceivables?.amount / 1000 || 0).toFixed(
                  0,
                )}
                k Overdue
              </span>
            </div>
            <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span>
                Collections Rate:{' '}
                <strong className="text-slate-700">
                  {typeof metrics.collectionsRate === 'number'
                    ? metrics.collectionsRate.toFixed(1)
                    : metrics.collectionsRate}
                  %
                </strong>
              </span>
              <button
                type="button"
                onClick={() => navigate('/collections')}
                className="text-sky-600 font-medium hover:underline cursor-pointer"
              >
                Collect Bills
              </button>
            </div>
          </div>

          {/* KPI 4: ACCOUNTS PAYABLE (AP) */}
          <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Accounts Payable (AP)
              </span>
              <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                <FileText className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline justify-between">
              <div className="text-2xl font-bold text-slate-900">
                ₱{metrics.ap.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </div>
              <span className="text-xs font-medium text-rose-600 flex items-center">
                <AlertTriangle className="w-3.5 h-3.5 mr-1" />₱
                {(apiData?.alerts?.overduePayables?.amount / 1000 || 0).toFixed(0)}k
                Overdue
              </span>
            </div>
            <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span>
                Payments Rate:{' '}
                <strong className="text-slate-700">
                  {typeof metrics.paymentsRate === 'number'
                    ? metrics.paymentsRate.toFixed(1)
                    : metrics.paymentsRate}
                  %
                </strong>
              </span>
              <button
                type="button"
                onClick={() => navigate('/payments')}
                className="text-sky-600 font-medium hover:underline cursor-pointer"
              >
                Pay Bills
              </button>
            </div>
          </div>
        </div>

        {/* SECOND SECTION: PRIMARY CHARTS & TAX SUMMARY */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Financial Performance Chart (Revenue vs Expense vs Net) */}
          <div className="lg:col-span-2 bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-slate-800 text-base">
                  Financial Performance Trend
                </h3>
                <p className="text-xs text-slate-500">
                  Revenue, Operating Expenses, and Net Profit trajectory
                </p>
              </div>
              <div className="flex items-center space-x-3 text-xs">
                <span className="flex items-center">
                  <span className="w-3 h-3 rounded-full bg-emerald-500 mr-1.5"></span>{' '}
                  Sales
                </span>
                <span className="flex items-center">
                  <span className="w-3 h-3 rounded-full bg-rose-500 mr-1.5"></span>{' '}
                  Expenses
                </span>
                <span className="flex items-center">
                  <span className="w-3 h-3 rounded-full bg-sky-600 mr-1.5"></span>{' '}
                  Net Income
                </span>
              </div>
            </div>
            <div className="flex-1 min-h-[280px] relative">
              {apiData?.revenueExpenses && apiData.revenueExpenses.length > 0 ? (
                <canvas ref={perfChartRef}></canvas>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-slate-400">
                  <TrendingUp className="w-12 h-12 mb-3 opacity-50" />
                  <p className="text-sm">
                    No financial data available for this period
                  </p>
                  <p className="text-xs mt-1">
                    Adjust the date range to see performance trends
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Tax & Compliance Position Widget (VAT & Withholding Tax) */}
          <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-slate-800 text-base">
                  Tax & Compliance Status
                </h3>
                <span className="px-2 py-0.5 text-[10px] font-semibold bg-blue-100 text-blue-700 rounded-full">
                  Monthly Return
                </span>
              </div>
              <p className="text-xs text-slate-500 mb-4">
                Calculated output vs input VAT and withholding tax liabilities
              </p>

              {/* VAT Calculation Card */}
              <div className="bg-slate-50 rounded-lg p-3.5 border border-slate-200 space-y-2 mb-4">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-600">Output VAT (12% on Sales):</span>
                  <span className="font-semibold text-slate-800">
                    ₱
                    {(apiData?.tax?.outputVAT || 0).toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-600">
                    Less: Input VAT (Purchases):
                  </span>
                  <span className="font-semibold text-slate-800">
                    (₱
                    {(apiData?.tax?.inputVAT || 0).toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                    })}
                    )
                  </span>
                </div>
                <div className="border-t border-slate-200 pt-2 flex justify-between text-sm font-bold">
                  <span className="text-slate-800">Net VAT Payable:</span>
                  <span className="text-amber-600">
                    ₱
                    {(apiData?.tax?.netVATPayable || 0).toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                </div>
              </div>

              {/* Withholding Tax Card */}
              <div className="bg-slate-50 rounded-lg p-3.5 border border-slate-200 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-600">
                    Withholding Tax Payable (Expanded):
                  </span>
                  <span className="font-semibold text-slate-800">
                    ₱
                    {(apiData?.tax?.wtExpanded || 0).toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-600">
                    Creditable Withholding Tax (2307):
                  </span>
                  <span className="font-semibold text-emerald-600">
                    ₱
                    {(apiData?.tax?.wtCreditable || 0).toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-500 flex items-center">
                <Clock className="w-3.5 h-3.5 mr-1" /> Due in 12 days
              </span>
              <button className="text-xs text-sky-600 hover:text-sky-700 font-semibold flex items-center">
                Generate Tax Return <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
              </button>
            </div>
          </div>
        </div>

        {/* THIRD SECTION: RECEIVABLES / PAYABLES AGING & BANK RECON */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* AR Aging Breakdown Chart */}
          <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-slate-800 text-sm">
                Accounts Receivable Aging
              </h3>
              <button
                type="button"
                onClick={() => navigate('/aging_receivables')}
                className="text-xs text-sky-600 font-medium hover:underline cursor-pointer"
              >
                View Details
              </button>
            </div>
            <div className="h-48 relative">
              <canvas ref={agingChartRef}></canvas>
            </div>
            <div className="mt-3 grid grid-cols-4 gap-2 text-center text-[11px]">
              <div className="bg-emerald-50 p-1.5 rounded">
                <div className="text-slate-500">Current</div>
                <div className="font-bold text-emerald-700">
                  ₱{((apiData?.arAging?.current || 0) / 1000).toFixed(0)}K
                </div>
              </div>
              <div className="bg-blue-50 p-1.5 rounded">
                <div className="text-slate-500">1-30 Days</div>
                <div className="font-bold text-blue-700">
                  ₱{((apiData?.arAging?.overdue_1_30 || 0) / 1000).toFixed(0)}K
                </div>
              </div>
              <div className="bg-amber-50 p-1.5 rounded">
                <div className="text-slate-500">31-60 Days</div>
                <div className="font-bold text-amber-700">
                  ₱{((apiData?.arAging?.overdue_31_60 || 0) / 1000).toFixed(0)}K
                </div>
              </div>
              <div className="bg-rose-50 p-1.5 rounded">
                <div className="text-slate-500">61+ Days</div>
                <div className="font-bold text-rose-700">
                  ₱{((apiData?.arAging?.overdue_61_plus || 0) / 1000).toFixed(0)}K
                </div>
              </div>
            </div>
          </div>

          {/* AP Aging & Top Vendor Payables Due */}
          <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-slate-800 text-sm">
                Top Vendor Payables Due
              </h3>
              <button
                type="button"
                onClick={() => navigate('/aging_payables')}
                className="text-xs text-sky-600 font-medium hover:underline cursor-pointer"
              >
                Schedule Payment
              </button>
            </div>
            <div className="space-y-3">
              {apiData?.topVendors?.slice(0, 3).map((vendor, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg text-xs"
                >
                  <div className="flex items-center space-x-2.5">
                    <div
                      className={`w-8 h-8 rounded flex items-center justify-center font-bold ${
                        idx === 0
                          ? 'bg-amber-100 text-amber-700'
                          : idx === 1
                            ? 'bg-slate-200 text-slate-700'
                            : 'bg-rose-100 text-rose-700'
                      }`}
                    >
                      {idx === 0 ? (
                        <Building2 className="w-4 h-4" />
                      ) : idx === 1 ? (
                        <Zap className="w-4 h-4" />
                      ) : (
                        <Package className="w-4 h-4" />
                      )}
                    </div>
                    <div>
                      <div className="font-semibold text-slate-800">
                        {vendor.vendorName || 'Unknown Vendor'}
                      </div>
                      <div className="text-slate-500">
                        Due {vendor.dueDate || 'TBD'}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-slate-800">
                      ₱
                      {(vendor.amount || 0).toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                      })}
                    </div>
                    <span
                      className={`text-[10px] font-medium ${
                        vendor.status === 'Approved'
                          ? 'text-emerald-600'
                          : vendor.status === 'Overdue'
                            ? 'text-rose-600'
                            : 'text-amber-600'
                      }`}
                    >
                      {vendor.status || 'Pending'}
                    </span>
                  </div>
                </div>
              ))}
              {(!apiData?.topVendors || apiData.topVendors.length === 0) && (
                <div className="text-center text-slate-500 text-xs py-4">
                  No vendor payables data
                </div>
              )}
            </div>
          </div>

          {/* Bank Reconciliation Status Center */}
          <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-slate-800 text-sm">
                  Bank Reconciliation Accounts
                </h3>
                <span className="text-xs text-slate-500">Month-End Sync</span>
              </div>
              <div className="space-y-3">
                {apiData?.bankAccounts?.slice(0, 2).map((account, idx) => (
                  <div
                    key={idx}
                    role="button"
                    tabIndex={0}
                    onClick={() =>
                      navigate('/bank-reconciliation', {
                        state: { reconciliationId: account.id },
                      })
                    }
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        navigate('/bank-reconciliation', {
                          state: { reconciliationId: account.id },
                        })
                      }
                    }}
                    className={`p-2.5 rounded-lg border text-xs space-y-1.5 cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-sky-500 ${
                      account.reconciled
                        ? 'border-slate-200'
                        : 'border-amber-200 bg-amber-50/40'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-slate-800 flex items-center">
                        <Landmark
                          className={`w-3.5 h-3.5 mr-1.5 ${account.reconciled ? 'text-sky-600' : 'text-amber-600'}`}
                        />{' '}
                        {account.accountName || 'Bank Account'}
                      </span>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                          account.reconciled
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {account.reconciled
                          ? 'Reconciled'
                          : `${account.unreconciledCount || 0} Unmatched`}
                      </span>
                    </div>
                    <div className="text-slate-500 text-[11px] pl-5">
                      {account.bankAccount || 'No bank reference'}
                    </div>
                    <div className="flex justify-between text-slate-500 text-[11px]">
                      <span>
                        GL Balance: ₱
                        {(account.glBalance || 0).toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                        })}
                      </span>
                      <span>
                        Bank Statement: ₱
                        {(account.bankBalance || 0).toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                        })}
                      </span>
                      <span>
                        Variance: ₱
                        {Math.abs(account.variance || 0).toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                  </div>
                ))}
                {(!apiData?.bankAccounts || apiData.bankAccounts.length === 0) && (
                  <div className="text-center text-slate-500 text-xs py-4">
                    No bank accounts data
                  </div>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => navigate('/bank-reconciliation')}
              className="w-full mt-4 py-2 bg-slate-900 hover:bg-slate-800 hover:shadow-md active:scale-[0.99] text-white rounded-lg text-xs font-semibold transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
            >
              Launch Bank Reconciliation Tool
            </button>
          </div>
        </div>

        {/* FOURTH SECTION: RECENT TRANSACTIONS & JOURNAL ENTRIES */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-slate-800 text-base">
                Recent Ledger & Operational Transactions
              </h3>
              <p className="text-xs text-slate-500">
                Live feed across Receipts, Disbursements, Sales, and Adjustments
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search transaction or ref #"
                  className="text-xs pl-8 pr-3 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-sky-500 w-48"
                />
              </div>
              <button className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-lg border border-slate-300 transition flex items-center">
                <Filter className="w-3.5 h-3.5 mr-1" /> Filter
              </button>
            </div>
          </div>

          <div className="max-h-96 overflow-x-auto overflow-y-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
                  <th className="p-3.5">Ref No.</th>
                  <th className="p-3.5">Date</th>
                  <th className="p-3.5">Module / Type</th>
                  <th className="p-3.5">Resp. Center</th>
                  <th className="p-3.5 text-right">Amount</th>
                  <th className="p-3.5 text-center">Status</th>
                  <th className="p-3.5 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTransactions.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/80 transition">
                    <td className="p-3.5 font-semibold text-sky-600">{item.ref}</td>
                    <td className="p-3.5 text-slate-600">{item.date}</td>
                    <td className="p-3.5">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                          item.type === 'Receipt'
                            ? 'bg-emerald-100 text-emerald-800'
                            : item.type === 'Disbursement'
                              ? 'bg-rose-100 text-rose-800'
                              : item.type === 'Sales Invoice'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-indigo-100 text-indigo-800'
                        }`}
                      >
                        {item.type}
                      </span>
                    </td>
                    <td className="p-3.5 text-slate-500">{item.center}</td>
                    <td
                      className={`p-3.5 text-right font-bold ${item.entryType?.toUpperCase() === 'DEBIT' ? 'text-emerald-600' : 'text-slate-800'}`}
                    >
                      {item.entryType?.toUpperCase() === 'DEBIT'
                        ? `+₱${item.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                        : `-₱${Math.abs(item.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
                    </td>
                    <td className="p-3.5 text-center">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                          item.status === 'Posted'
                            ? 'bg-slate-100 text-slate-700'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td className="p-3.5 text-center">
                      <button
                        type="button"
                        onClick={() => {
                          const routeMap = {
                            receipts: 'receipts',
                            cash_disbursements: 'disbursement',
                            sales: 'sales',
                            purchase: 'purchase',
                            payments: 'payments',
                            collections: 'collections',
                            adjustments: 'adjustments',
                          }
                          const route = routeMap[item.sourceRoute]
                          if (route && item.ref) {
                            navigate(`/${route}?id=${encodeURIComponent(item.ref)}`)
                          }
                        }}
                        disabled={!item.sourceRoute || !item.ref}
                        className="text-slate-400 hover:text-sky-600 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
                        title="View Detail"
                      >
                        <Eye className="w-4 h-4 mx-auto" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="p-4 text-center text-xs text-slate-400 border-t border-slate-200 bg-white mt-auto">
        LedgerPulse Enterprise Accounting System &bull; Double-Entry General Ledger
        Compliant &bull; VAT & WHT Calculator Active
      </footer>
    </div>
  )
}

export default function DashboardNew() {
  return (
    <RouteProtection routeName="dashboard">
      <DashboardNewContent />
    </RouteProtection>
  )
}
