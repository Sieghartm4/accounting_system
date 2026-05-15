import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BarChart3,
  Download,
  DollarSign,
  TrendingUp,
  TrendingDown,
  RefreshCcw,
  Calendar,
  FileText,
  Activity,
  ChevronDown,
  ChevronRight
} from 'lucide-react'

export default function StatementOfComprehensiveIncome() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  
  // Track collapsed states
  const [expanded, setExpanded] = useState({
    revenue: true,
    cogs: true,
    expenses: true,
    oci: true
  })

  const toggle = (section) => {
    setExpanded(prev => ({ ...prev, [section]: !prev[section] }))
  }

  useEffect(() => {
    fetchSCI()
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchSCI()
    }, 500)
    return () => clearTimeout(timer)
  }, [startDate, endDate])

  const fetchSCI = async () => {
    try {
      setLoading(true)
      setError('')
      const token = localStorage.getItem('token')
      const params = new URLSearchParams()
      if (startDate) params.append('start_date', startDate)
      if (endDate) params.append('end_date', endDate)
      const url = `${import.meta.env.VITE_SERVER_LINK}/reports/statement-of-comprehensive-income${params.toString() ? '?' + params : ''}`

      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      })
      const result = await response.json()
      if (result.success) setData(result.data)
      else setError(result.message || 'Failed to fetch statement')
    } catch (err) {
      setError('Connection Error: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const fmt = (n) =>
    new Intl.NumberFormat('en-PH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n || 0)

  if (loading && !data)
    return (
      <div className="h-full w-full flex flex-col items-center justify-center gap-4">
        <div className="w-10 h-10 border-4 border-purple-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-[10px] font-black uppercase tracking-[3px] text-gray-400">
          Calculating Comprehensive Income...
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
            onClick={fetchSCI}
            className="mt-3 px-4 py-2 bg-red-600 text-white text-xs font-black rounded-lg uppercase tracking-widest hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    )

  return (
    <div className="flex flex-col gap-3 bg-[#F3F4F6] min-h-full custom-scrollbar p-4">
      {/* HEADER */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-black rounded-xl flex-shrink-0">
            <BarChart3 size={22} className="text-purple-500" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-black tracking-tighter leading-none">
              Comprehensive <span className="text-purple-600 italic">Income</span>
            </h1>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-[2px] mt-1">
              Net Income + Other Gains/Losses
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 px-5 py-2.5 bg-white border border-gray-200 text-[11px] font-black text-black rounded-xl hover:bg-gray-50 uppercase tracking-widest shadow-sm">
            <Download size={13} /> Export PDF
          </button>
          <button
            onClick={fetchSCI}
            className="w-10 h-10 bg-purple-600 text-white rounded-xl hover:bg-purple-700 flex items-center justify-center transition-colors shadow-lg shadow-purple-200"
          >
            <RefreshCcw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* STAT CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <StatCard
          iconBg="bg-green-50"
          iconColor="text-green-600"
          icon={<TrendingUp size={18} />}
          label="Gross Profit"
          value={`₱${fmt(data?.grossProfit)}`}
          sub="Revenue - COGS"
          valueClass="text-green-600"
        />
        <StatCard
          iconBg="bg-blue-50"
          iconColor="text-blue-600"
          icon={<DollarSign size={18} />}
          label="Operating Income"
          value={`₱${fmt(data?.operatingIncome)}`}
          sub="Gross - Op. Exp."
          valueClass="text-blue-600"
        />
        <StatCard
          iconBg="bg-black"
          iconColor="text-red-500"
          icon={<DollarSign size={18} />}
          label="Net Income"
          value={`₱${fmt(data?.netIncome)}`}
          sub="After All Expenses"
          valueClass={data?.netIncome >= 0 ? 'text-black' : 'text-red-600'}
        />
        <StatCard
          iconBg="bg-purple-50"
          iconColor="text-purple-600"
          icon={<Activity size={18} />}
          label="Total Comprehensive"
          value={`₱${fmt(data?.totalComprehensiveIncome)}`}
          sub="Income + OCI"
          valueClass={
            data?.totalComprehensiveIncome >= 0 ? 'text-purple-600' : 'text-red-600'
          }
        />
      </div>

      {/* TOOLBAR */}
      <div className="bg-white border border-gray-100 rounded-2xl px-4 py-3 flex items-center gap-4 flex-wrap shadow-sm">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-purple-100 rounded-lg text-purple-600">
            <Calendar size={14} />
          </div>
          <span className="text-[10px] font-black text-gray-400 uppercase tracking-[2px]">
            Period Filter
          </span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="px-3 py-2 border border-gray-100 rounded-xl bg-gray-50 text-[11px] font-bold text-black outline-none focus:border-purple-500 focus:bg-white transition-all"
          />
          <span className="text-gray-300">to</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="px-3 py-2 border border-gray-100 rounded-xl bg-gray-50 text-[11px] font-bold text-black outline-none focus:border-purple-500 focus:bg-white transition-all"
          />
        </div>
        <div className="ml-auto flex gap-2">
          <button
            onClick={() => {
              setStartDate('')
              setEndDate('')
            }}
            className="px-4 py-2 border border-gray-900 rounded-xl text-[10px] font-black text-gray-900 uppercase tracking-widest hover:border-purple-500 hover:text-purple-600 transition-all bg-white cursor-pointer"
          >
            Reset
          </button>
          <button
            onClick={() => {
              const t = new Date().toISOString().split('T')[0]
              setStartDate(t)
              setEndDate(t)
            }}
            className="px-4 py-2 bg-black rounded-xl text-[10px] font-black text-white uppercase tracking-widest hover:bg-purple-600 cursor-pointer"
          >
            Today
          </button>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col custom-scrollbar">
        
        {/* A. REVENUE SECTION - Collapsible */}
        <div className="border-b border-gray-100">
          <button 
            onClick={() => toggle('revenue')}
            className="w-full flex items-center justify-between px-5 py-3 bg-black hover:bg-gray-900 transition-colors"
          >
            <div className="flex items-center gap-2">
              <TrendingUp size={14} className="text-green-500" />
              <span className="text-[11px] font-black uppercase tracking-[3px] text-white">A. Revenue</span>
            </div>
            {expanded.revenue ? <ChevronDown size={16} className="text-white" /> : <ChevronRight size={16} className="text-white" />}
          </button>
          
          <AnimatePresence>
            {expanded.revenue && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }} 
                animate={{ height: 'auto', opacity: 1 }} 
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="p-5">
                  <table className="w-full">
                    <tbody className="text-sm">
                      {data?.revenues.filter(r => !r['Account Name'].toLowerCase().includes('discount')).map((item, i) => (
                        <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                          <td className="py-2 px-3 text-[11px] font-bold text-gray-600">{item['Account Code']}</td>
                          <td className="py-2 px-3 text-[12px] font-bold text-black">{item['Account Name']}</td>
                          <td className="py-2 px-3 text-right text-[12px] font-bold text-gray-900">₱{fmt(item.Current)}</td>
                        </tr>
                      ))}
                      <tr className="bg-green-50 font-black">
                        <td className="py-3 px-3 text-[11px] uppercase tracking-wider text-green-700">Total Revenue</td>
                        <td></td>
                        <td className="py-3 px-3 text-right text-green-700 text-lg">₱{fmt(data?.salesRevenue)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* B. COST OF SALES SECTION - Collapsible */}
        <div className="border-b border-gray-100">
          <button 
            onClick={() => toggle('cogs')}
            className="w-full flex items-center justify-between px-5 py-3 bg-gray-900 hover:bg-gray-800 transition-colors"
          >
            <div className="flex items-center gap-2">
              <TrendingDown size={14} className="text-red-400" />
              <span className="text-[11px] font-black uppercase tracking-[3px] text-white">B. Less: Cost of Sales</span>
            </div>
            {expanded.cogs ? <ChevronDown size={16} className="text-white" /> : <ChevronRight size={16} className="text-white" />}
          </button>
          
          <AnimatePresence>
            {expanded.cogs && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }} 
                animate={{ height: 'auto', opacity: 1 }} 
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="p-5">
                  <table className="w-full">
                    <tbody className="text-sm">
                      {data?.revenues.filter(r => r['Account Name'].toLowerCase().includes('cost')).map((item, i) => (
                        <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                          <td className="py-2 px-3 text-[11px] font-bold text-gray-600">{item['Account Code']}</td>
                          <td className="py-2 px-3 text-[12px] font-bold text-black">{item['Account Name']}</td>
                          <td className="py-2 px-3 text-right text-[12px] font-bold text-gray-900">₱{fmt(item.Current)}</td>
                        </tr>
                      ))}
                      <tr className="bg-red-50 font-black">
                        <td className="py-3 px-3 text-[11px] uppercase tracking-wider text-red-700">Total Cost of Sales</td>
                        <td></td>
                        <td className="py-3 px-3 text-right text-red-700 text-lg">₱{fmt(data?.costOfSales)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* C. GROSS PROFIT - NOT Collapsible (Calculation only) */}
        <div className="border-b border-gray-100 bg-green-50 px-5 py-4">
          <div className="flex justify-between items-center">
            <span className="text-[11px] font-black uppercase tracking-[3px] text-green-700">C. Gross Profit (A - B)</span>
            <span className="text-[18px] font-black text-green-700">₱{fmt(data?.grossProfit)}</span>
          </div>
        </div>

        {/* D. OPERATING EXPENSES SECTION - Collapsible */}
        <div className="border-b border-gray-100">
          <button 
            onClick={() => toggle('expenses')}
            className="w-full flex items-center justify-between px-5 py-3 bg-black hover:bg-gray-900 transition-colors"
          >
            <div className="flex items-center gap-2">
              <TrendingDown size={14} className="text-orange-400" />
              <span className="text-[11px] font-black uppercase tracking-[3px] text-white">D. Operating Expenses</span>
            </div>
            {expanded.expenses ? <ChevronDown size={16} className="text-white" /> : <ChevronRight size={16} className="text-white" />}
          </button>
          
          <AnimatePresence>
            {expanded.expenses && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }} 
                animate={{ height: 'auto', opacity: 1 }} 
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="p-5">
                  <table className="w-full">
                    <tbody className="text-sm">
                      {data?.operatingExpenses.map((item, i) => (
                        <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                          <td className="py-2 px-3 text-[11px] font-bold text-gray-600">{item['Account Code']}</td>
                          <td className="py-2 px-3 text-[12px] font-bold text-black">{item['Account Name']}</td>
                          <td className="py-2 px-3 text-right text-[12px] font-bold text-gray-900">₱{fmt(item.Current)}</td>
                        </tr>
                      ))}
                      <tr className="bg-orange-50 font-black">
                        <td className="py-3 px-3 text-[11px] uppercase tracking-wider text-orange-700">Total Operating Expenses</td>
                        <td></td>
                        <td className="py-3 px-3 text-right text-orange-700 text-lg">₱{fmt(data?.totalOperatingExpenses)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* E. OPERATING INCOME - NOT Collapsible */}
        <div className="border-b border-gray-100 bg-blue-50 px-5 py-4">
          <div className="flex justify-between items-center">
            <span className="text-[11px] font-black uppercase tracking-[3px] text-blue-700">E. Operating Income (C - D)</span>
            <span className="text-[18px] font-black text-blue-700">₱{fmt(data?.operatingIncome)}</span>
          </div>
        </div>

        {/* F. NET INCOME - NOT Collapsible */}
        <div className="border-b border-gray-100 bg-black px-5 py-4">
          <div className="flex justify-between items-center">
            <span className="text-[11px] font-black uppercase tracking-[3px] text-white">F. Net Income</span>
            <span className={`text-[18px] font-black ${data?.netIncome >= 0 ? 'text-green-400' : 'text-red-400'}`}>₱{fmt(data?.netIncome)}</span>
          </div>
        </div>

        {/* G. OTHER COMPREHENSIVE INCOME - Collapsible ONLY if data exists */}
        <div className="border-b border-gray-100">
          {data?.otherComprehensiveIncome && data.otherComprehensiveIncome.length > 0 ? (
            <>
              <button 
                onClick={() => toggle('oci')}
                className="w-full flex items-center justify-between px-5 py-3 bg-purple-900 hover:bg-purple-800 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Activity size={14} className="text-purple-300" />
                  <span className="text-[11px] font-black uppercase tracking-[3px] text-white">G. Other Comprehensive Income (OCI)</span>
                </div>
                {expanded.oci ? <ChevronDown size={16} className="text-white" /> : <ChevronRight size={16} className="text-white" />}
              </button>
              <AnimatePresence>
                {expanded.oci && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }} 
                    animate={{ height: 'auto', opacity: 1 }} 
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="p-5">
                      <table className="w-full">
                        <tbody className="text-sm">
                          {data.otherComprehensiveIncome.map((item, i) => (
                            <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                              <td className="py-2 px-3 text-[11px] font-bold text-gray-600">{item['Account Code']}</td>
                              <td className="py-2 px-3 text-[12px] font-bold text-black">{item['Account Name']}</td>
                              <td className="py-2 px-3 text-right text-[12px] font-bold text-gray-900">₱{fmt(item.Current)}</td>
                            </tr>
                          ))}
                          <tr className="bg-purple-50 font-black">
                            <td className="py-3 px-3 text-[11px] uppercase tracking-wider text-purple-700">Total OCI</td>
                            <td></td>
                            <td className="py-3 px-3 text-right text-purple-700 text-lg">₱{fmt(data?.totalOCI)}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          ) : (
            <div className="flex items-center gap-2 px-5 py-3 bg-purple-900">
               <Activity size={14} className="text-purple-300" />
               <span className="text-[11px] font-black uppercase tracking-[3px] text-white">G. OCI (None)</span>
               <span className="ml-auto text-white font-bold text-sm">₱0.00</span>
            </div>
          )}
        </div>

        {/* H. TOTAL COMPREHENSIVE INCOME - NOT Collapsible */}
        <div className="bg-gradient-to-r from-purple-900 to-purple-700 px-5 py-5">
          <div className="flex justify-between items-center">
            <span className="text-[12px] font-black uppercase tracking-[3px] text-white">H. Total Comprehensive Income (F + G)</span>
            <span className={`text-[22px] font-black ${data?.totalComprehensiveIncome >= 0 ? 'text-purple-200' : 'text-red-300'}`}>
              ₱{fmt(data?.totalComprehensiveIncome)}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

function StatCard({ iconBg, iconColor, icon, label, value, sub, valueClass }) {
  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm hover:shadow-md transition-all"
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-[2px]">
            {label}
          </p>
          <p className={`text-[20px] font-black mt-1 ${valueClass || 'text-black'}`}>
            {value}
          </p>
          <p className="text-[9px] text-gray-500 font-bold mt-1 uppercase tracking-widest">
            {sub}
          </p>
        </div>
        <div className={`${iconBg} p-3 rounded-lg`}>
          <div className={iconColor}>{icon}</div>
        </div>
      </div>
    </motion.div>
  )
}