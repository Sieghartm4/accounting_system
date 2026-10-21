import React, { useState, useEffect, useMemo } from 'react'
import {
  FileText,
  Download,
  RefreshCcw,
  Search,
  User,
  Calendar,
  Hash,
  Wallet,
  CheckCircle,
} from 'lucide-react'
import LoadingScreen from '../../components/LoadingScreen'
import { currentReportPeriod } from '../../utils/reportPeriod'
import { API } from '../../api/endpoints'

function SummaryTile({ label, value, subText, color, icon: Icon }) {
  const theme = {
    emerald: {
      text: 'text-emerald-600 dark:text-emerald-400',
      badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      bar: 'bg-emerald-500',
      bg: 'bg-emerald-500',
      textOnActive: 'text-white'
    },
    amber: {
      text: 'text-amber-600 dark:text-amber-400',
      badgeBg: 'bg-amber-50 text-amber-700 border-amber-200',
      bar: 'bg-amber-500',
      bg: 'bg-amber-500',
      textOnActive: 'text-white'
    },
    orange: {
      text: 'text-orange-600 dark:text-orange-400',
      badgeBg: 'bg-orange-50 text-orange-700 border-orange-200',
      bar: 'bg-orange-500',
      bg: 'bg-orange-500',
      textOnActive: 'text-white'
    },
    rose: {
      text: 'text-rose-600 dark:text-rose-400',
      badgeBg: 'bg-rose-50 text-rose-700 border-rose-200',
      bar: 'bg-rose-500',
      bg: 'bg-rose-500',
      textOnActive: 'text-white'
    },
    blue: {
      text: 'text-blue-600 dark:text-blue-400',
      badgeBg: 'bg-blue-50 text-blue-700 border-blue-200',
      bar: 'bg-blue-500',
      bg: 'bg-blue-500',
      textOnActive: 'text-white'
    },
    dark: {
      text: 'text-emerald-400',
      badgeBg: 'bg-emerald-950 text-emerald-300 border-emerald-800/50',
      bar: 'bg-emerald-400',
      bg: 'bg-emerald-400',
      textOnActive: 'text-white'
    },
  }[color] || {
    text: 'text-gray-700',
    badgeBg: 'bg-gray-50 text-gray-700 border-gray-200',
    bar: 'bg-gray-400',
    bg: 'bg-gray-400',
    textOnActive: 'text-white'
  }

  const bgClass = color === 'dark'
    ? 'bg-slate-900 text-white border-slate-800'
    : 'bg-white text-gray-900 border-gray-200/80 shadow-xs'

  const activeBgClass = bgClass

  const isClickable = false

  return (
    <div
      className={`${activeBgClass} p-3 rounded-xl border relative overflow-hidden flex flex-col justify-between h-full hover:scale-105 hover:shadow-lg group transition-all duration-300`}
    >
      {/* Bottom Accent Indicator - Animates on hover (behind content) */}
      <div className={`absolute bottom-0 left-0 right-0 h-1 ${theme.bar} group-hover:h-full transition-all duration-300 z-0`} />

      {/* Content wrapper with higher z-index */}
      <div className="relative z-10 flex flex-col justify-between h-full">
        {/* Top Header Row */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full border ${theme.badgeBg} group-hover:bg-white group-hover:text-gray-900 group-hover:border-white`}>
            {label}
          </span>
          <span className={`text-xs font-medium text-gray-400 group-hover:text-white/80`}>
            {subText}
          </span>
        </div>

        {/* Value Row with Icon */}
        <div className="flex items-center gap-2 my-1">
          {Icon && (
            <Icon size={20} className={`${color === 'dark' ? theme.text : 'text-gray-600'} group-hover:text-white transition-colors`} />
          )}
          <span className={`text-2xl font-bold font-mono tracking-tight ${color === 'dark' ? theme.text : 'text-black'} group-hover:text-white`}>
            {value}
          </span>
        </div>
      </div>
    </div>
  )
}

export default function JournalEntries() {
  const [journalEntries, setJournalEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [startDate, setStartDate] = useState(() => currentReportPeriod().start)
  const [endDate, setEndDate] = useState(() => currentReportPeriod().end)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    fetchJournalEntries()
  }, [])

  const fetchJournalEntries = async () => {
    try {
      setLoading(true)
      setError('')
      const token = sessionStorage.getItem('authenticated')
      const params = new URLSearchParams()
      if (startDate) params.append('start_date', startDate)
      if (endDate) params.append('end_date', endDate)

      const url = `${API.reportsJournalEntries()}${params.toString() ? '?' + params.toString() : ''}`
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      })

      const result = await response.json()
      if (result.success) {
        setJournalEntries(result.data || [])
        if (!startDate && !endDate) {
          if (result.startDate) setStartDate(result.startDate)
          if (result.endDate) setEndDate(result.endDate)
        }
      } else {
        setError(result.message || 'Failed to fetch journal entries')
      }
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

  const formatDate = (ds) => {
    if (!ds) return ''
    const d = new Date(ds)
    return d.toLocaleDateString('en-PH', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
    })
  }

  // Filter journal entries by search term
  const filteredEntries = useMemo(() => {
    const q = searchTerm.toLowerCase().trim()
    if (!q) return journalEntries

    return journalEntries.filter(
      (entry) =>
        entry.db_name?.toLowerCase().includes(q) ||
        entry.responsibility_center?.toLowerCase().includes(q) ||
        (entry.account_name || entry.coa_name)?.toLowerCase().includes(q) ||
        entry.type?.toLowerCase().includes(q),
    )
  }, [journalEntries, searchTerm])

  if (loading)
    return <LoadingScreen label="Loading Journal Entries..." />

  if (error)
    return (
      <div className="p-10">
        <div className="bg-red-50 border-l-4 border-red-600 p-6 rounded-r-xl">
          <h3 className="text-red-800 font-bold uppercase text-sm">Error</h3>
          <p className="text-red-600 text-sm mt-1">{error}</p>
          <button
            onClick={fetchJournalEntries}
            className="mt-3 px-4 py-2 bg-red-600 text-white text-xs font-black rounded-lg uppercase tracking-widest hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    )

  const totalDebit = filteredEntries.reduce(
    (sum, entry) =>
      entry.type === 'DEBIT' ? sum + parseFloat(entry.amount || 0) : sum,
    0,
  )
  const totalCredit = filteredEntries.reduce(
    (sum, entry) =>
      entry.type === 'CREDIT' ? sum + parseFloat(entry.amount || 0) : sum,
    0,
  )

  return (
    <div className="flex flex-col gap-2 bg-[#F3F4F6] h-full custom-scrollbar">
      {/* HEADER */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-black rounded-xl flex-shrink-0">
            <FileText size={22} className="text-red-500" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-black tracking-tighter leading-none">
              Journal <span className="text-red-600 italic">Entries</span>
            </h1>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-[2px] mt-1">
              Transaction Records
            </p>
          </div>
        </div>
        <div className="flex gap-2 items-center relative">
                    {/* Date range filter — enlarged for comfortable clicking.
              Previously the date inputs were 11px transparent boxes (their whole
              clickable area nearly invisible) and the actions were 9px chips that
              didn't stand out from the header. Dates are now real bordered fields
              with visible FROM/TO labels, and Reset/Submit are full-size buttons.
              State, values and handlers are untouched. */}
          <div className="flex flex-col lg:flex-row lg:items-center gap-1.5 lg:gap-2 w-full md:w-auto bg-white border border-slate-300 rounded-xl p-2 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider shrink-0">From</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full lg:w-[7.5rem] shrink-0 bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-2 text-xs font-bold text-slate-700 outline-none cursor-pointer focus:outline-none focus:border-red-500 focus:ring-2 focus:ring-red-400/30 hover:border-slate-400 transition-colors"
              />
            </div>
            <span className="hidden lg:block h-6 w-px bg-slate-200 shrink-0" />
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider shrink-0">To</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full lg:w-[7.5rem] shrink-0 bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-2 text-xs font-bold text-slate-700 outline-none cursor-pointer focus:outline-none focus:border-red-500 focus:ring-2 focus:ring-red-400/30 hover:border-slate-400 transition-colors"
              />
            </div>
            <span className="hidden lg:block mx-1 h-6 w-px bg-slate-200 shrink-0" />
            <button
              onClick={() => {
                setStartDate('')
                setEndDate('')
                setSearchTerm('')
              }}
              className="w-full lg:w-auto px-4 py-2 rounded-lg border border-slate-300 bg-white text-[11px] font-black text-slate-600 uppercase tracking-widest hover:border-red-500 hover:bg-red-50 hover:text-red-600 transition-colors cursor-pointer"
            >
              Reset
            </button>
            <button
              onClick={fetchJournalEntries}
              className="w-full lg:w-auto px-5 py-2 rounded-lg bg-red-600 text-[11px] font-black text-white uppercase tracking-widest shadow-sm shadow-red-600/30 hover:bg-red-700 transition-colors cursor-pointer"
            >
              Submit
            </button>
          </div>
          <div className="flex gap-2">
            <button className="flex items-center gap-2 px-5 py-2.5 bg-white border border-gray-200 text-[11px] font-black text-black rounded-xl hover:bg-gray-50 uppercase tracking-widest">
              <Download size={13} /> Export PDF
            </button>
            <button
              onClick={fetchJournalEntries}
              className="w-10 h-10 bg-red-600 text-white rounded-xl hover:bg-red-700 flex items-center justify-center transition-colors"
            >
              <RefreshCcw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
      </div>

      {/* STAT CARDS */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <SummaryTile
          label="Total Entries"
          value={filteredEntries.length}
          subText="Journal Entries"
          color="emerald"
          icon={FileText}
        />
        <SummaryTile
          label="Total Debit"
          value={`₱${fmt(totalDebit)}`}
          subText="PHP"
          color="blue"
          icon={Wallet}
        />
        <SummaryTile
          label="Total Credit"
          value={`₱${fmt(totalCredit)}`}
          subText="PHP"
          color="orange"
          icon={Wallet}
        />
        <SummaryTile
          label="Balance"
          value={`₱${fmt(Math.abs(totalDebit - totalCredit))}`}
          subText={totalDebit > totalCredit ? 'DR' : 'CR'}
          color="emerald"
          icon={CheckCircle}
        />
      </div>

      {/* TABLE CARD */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col flex-1 overflow-hidden min-h-0 custom-scrollbar">
        {/* Table header bar */}
        <div className="flex flex-wrap items-center gap-2 px-4 sm:px-5 py-3 bg-black flex-shrink-0">
          <FileText size={14} className="text-gray-500" />
          <span className="text-[11px] font-black uppercase tracking-[3px] text-white">
            Journal Entries
          </span>
          <span className="text-[10px] font-bold text-gray-600 ml-1">
            {filteredEntries.length} records
          </span>
            {/* Search lives on the table header, not in a separate card above it:
                the control that filters the table belongs on the table. Colours
                are for the black bar - grey-on-grey was unreadable against it. */}
            <div className="ml-auto w-full sm:w-auto flex items-center gap-2 bg-white rounded-lg px-2.5 h-9 sm:h-7 shadow-sm">
              <Search size={13} className="text-gray-400 flex-shrink-0" />
              <input
                type="text"
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1 sm:flex-none w-full sm:w-44 bg-transparent border-none outline-none text-[11px] font-bold text-gray-900 placeholder:text-gray-400 placeholder:font-semibold"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="text-gray-400 hover:text-gray-900 text-sm leading-none transition-colors"
                >
                  ×
                </button>
              )}
            </div>
        </div>

        {/* Scrollable body */}
        <div
          className="overflow-y-auto overflow-x-auto custom-scrollbar flex-1 min-h-0"
        >
          <table
            className="w-full border-collapse"
            style={{ tableLayout: 'fixed', minWidth: '800px' }}
          >
            <colgroup>
              <col style={{ width: '12%' }} />
              <col style={{ width: '15%' }} />
              <col style={{ width: '15%' }} />
              <col style={{ width: '20%' }} />
              <col style={{ width: '15%' }} />
              <col style={{ width: '13%' }} />
              <col style={{ width: '10%' }} />
            </colgroup>
            <thead className="sticky top-0 z-10">
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="py-3 px-4 text-[12px] font-black uppercase tracking-[1.5px] text-black text-left">
                  ID
                </th>
                <th className="py-3 px-4 text-[12px] font-black uppercase tracking-[1.5px] text-black text-left">
                  Date
                </th>
                <th className="py-3 px-4 text-[12px] font-black uppercase tracking-[1.5px] text-black text-left">
                  Module
                </th>
                <th className="py-3 px-4 text-[12px] font-black uppercase tracking-[1.5px] text-black text-left">
                  Responsibility Center
                </th>
                <th className="py-3 px-4 text-[12px] font-black uppercase tracking-[1.5px] text-black text-left">
                  Account Name
                </th>
                <th className="py-3 px-4 text-[12px] font-black uppercase tracking-[1.5px] text-black text-right border-l border-gray-200">
                  Debit
                </th>
                <th className="py-3 px-4 text-[12px] font-black uppercase tracking-[1.5px] text-black text-right border-l border-gray-200">
                  Credit
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredEntries.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="py-16 text-center text-[12px] font-bold text-gray-300"
                  >
                    No journal entries found
                  </td>
                </tr>
              ) : (
                filteredEntries.map((entry, index) => (
                  <tr
                    key={entry.id || index}
                    className="hover:bg-red-100 hover:border-l-4 hover:border-red-600 hover:shadow-sm transition-colors"
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded bg-gray-100 flex items-center justify-center text-gray-500">
                          <Hash size={10} />
                        </div>
                        <span className="text-[12px] font-black text-black">
                          {entry.id}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-[12px] font-bold text-black">
                        {formatDate(entry.date)}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-[12px] font-black text-gray-600">
                        {entry.db_name || '—'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-full bg-red-50 flex items-center justify-center text-red-500">
                          <User size={8} />
                        </div>
                        <span className="text-[12px] font-bold text-gray-600 truncate">
                          {entry.responsibility_center || '—'}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-[12px] font-black text-gray-600">
                        {entry.account_name || entry.coa_name || '—'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-[15px] font-black text-black border-l border-gray-200">
                      {entry.type === 'DEBIT' ? (
                        `₱${fmt(entry.amount)}`
                      ) : (
                        <span className="text-gray-200">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-[15px] font-black text-red-600 border-l border-gray-200">
                      {entry.type === 'CREDIT' ? (
                        `₱${fmt(entry.amount)}`
                      ) : (
                        <span className="text-gray-200">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Summary footer */}
        <div className="border-t-4 border-red-600 bg-black flex-shrink-0">
          <table
            className="w-full border-collapse"
            style={{ tableLayout: 'fixed', minWidth: '800px' }}
          >
            <colgroup>
              <col style={{ width: '12%' }} />
              <col style={{ width: '15%' }} />
              <col style={{ width: '15%' }} />
              <col style={{ width: '20%' }} />
              <col style={{ width: '15%' }} />
              <col style={{ width: '13%' }} />
              <col style={{ width: '10%' }} />
            </colgroup>
            <tbody>
              <tr>
                <td
                  colSpan={5}
                  className="py-3 px-4 text-[12px] font-black text-white uppercase tracking-[3px]"
                >
                  Total Summary
                </td>
                <td className="py-3 px-4 text-right font-mono text-[15px] font-black text-white border-l border-gray-600">
                  ₱{fmt(totalDebit)}
                </td>
                <td className="py-3 px-4 text-right font-mono text-[15px] font-black text-red-400 border-l border-gray-600">
                  ₱{fmt(totalCredit)}
                </td>
              </tr>
              <tr className="border-t border-gray-700">
                <td
                  colSpan={5}
                  className="py-2 px-4 text-[10px] font-black text-gray-400 uppercase tracking-[2px]"
                >
                  Net Balance
                </td>
                <td
                  colSpan={2}
                  className={`py-2 px-4 text-right font-mono text-[13px] font-black border-l border-gray-600 ${totalDebit >= totalCredit ? 'text-white' : 'text-red-400'}`}
                >
                  ₱{fmt(Math.abs(totalDebit - totalCredit))}
                  <span className="text-[10px] ml-1">
                    {totalDebit > totalCredit ? 'DR' : 'CR'}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
