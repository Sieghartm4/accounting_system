import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Table2, Download, DollarSign, ShieldCheck, Search, RefreshCcw } from 'lucide-react';

export default function TrialBalance() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => { fetchTrialBalance(); }, []);
  useEffect(() => {
    const t = setTimeout(() => fetchTrialBalance(), 500);
    return () => clearTimeout(t);
  }, [startDate, endDate]);

  const fetchTrialBalance = async () => {
    try {
      setLoading(true); setError('');
      const token = localStorage.getItem('token');
      const params = new URLSearchParams();
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);
      const url = `${import.meta.env.VITE_SERVER_LINK}/reports/trial-balance${params.toString() ? '?' + params : ''}`;
      const res = await fetch(url, { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error(`Server responded with ${res.status}`);
      const result = await res.json();
      if (result.success) setData(result.data || []);
      else setError(result.message || 'Failed to fetch trial balance');
    } catch (err) {
      setError('Connection Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const fmt = (n) => new Intl.NumberFormat('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);

  const { filtered, totalDebit, totalCredit, isBalanced } = useMemo(() => {
    const q = searchTerm.toLowerCase();
    const f = data.filter(r =>
      r['Account Name']?.toLowerCase().includes(q) ||
      r['Account Code']?.toString().includes(q)
    );
    const td = f.reduce((s, i) => s + parseFloat(i.DEBIT || 0), 0);
    const tc = f.reduce((s, i) => s + parseFloat(i.CREDIT || 0), 0);
    return { filtered: f, totalDebit: td, totalCredit: tc, isBalanced: Math.abs(td - tc) < 0.01 };
  }, [data, searchTerm]);

  if (loading && data.length === 0) return (
    <div className="h-full w-full flex flex-col items-center justify-center gap-4">
      <div className="w-10 h-10 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
      <p className="text-[10px] font-black uppercase tracking-[3px] text-gray-400">Loading Ledger...</p>
    </div>
  );

  if (error) return (
    <div className="p-10">
      <div className="bg-red-50 border-l-4 border-red-600 p-6 rounded-r-xl">
        <h3 className="text-red-800 font-bold uppercase text-sm">Error</h3>
        <p className="text-red-600 text-sm mt-1">{error}</p>
        <button onClick={fetchTrialBalance} className="mt-3 px-4 py-2 bg-red-600 text-white text-xs font-black rounded-lg uppercase tracking-widest hover:bg-red-700">Retry</button>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-2 bg-[#F3F4F6] min-h-full custom-scrollbar">

      {/* HEADER */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-black rounded-xl flex-shrink-0">
            <Table2 size={22} className="text-red-500" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-black tracking-tighter leading-none">
              Trial <span className="text-red-600 italic">Balance</span>
            </h1>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-[2px] mt-1">General Ledger Report</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 px-5 py-2.5 bg-white border border-gray-200 text-[11px] font-black text-black rounded-xl hover:bg-gray-50 uppercase tracking-widest">
            <Download size={13} /> Export PDF
          </button>
          <button onClick={fetchTrialBalance}
            className="w-10 h-10 bg-red-600 text-white rounded-xl hover:bg-red-700 flex items-center justify-center transition-colors">
            <RefreshCcw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* STAT CARDS — all 4 in one row */}
      <div className="grid grid-cols-4 gap-3">
        <StatCard
          iconBg="bg-red-50" iconColor="text-red-600"
          icon={<Table2 size={18} />}
          label="Total Accounts" value={filtered.length} sub="Active Records"
        />
        <StatCard
          iconBg="bg-gray-100" iconColor="text-black"
          icon={<DollarSign size={18} />}
          label="Total Debit" value={`₱${fmt(totalDebit)}`} sub="PHP" small
        />
        <StatCard
          iconBg="bg-red-50" iconColor="text-red-600"
          icon={<DollarSign size={18} />}
          label="Total Credit" value={`₱${fmt(totalCredit)}`} sub="PHP" small valueClass="text-red-600"
        />
        <StatCard
          iconBg={isBalanced ? 'bg-green-50' : 'bg-red-50'}
          iconColor={isBalanced ? 'text-green-600' : 'text-red-600'}
          icon={<ShieldCheck size={18} />}
          label="Audit Status"
          value={isBalanced ? 'Verified' : 'Discrepancy'}
          sub="Balance Check"
          valueClass={isBalanced ? 'text-green-600' : 'text-red-600'}
        />
      </div>

      {/* TOOLBAR */}
      <div className="bg-white border border-gray-100 rounded-2xl px-4 py-3 flex items-center gap-3 flex-wrap shadow-sm">
        {/* Search */}
        <div className="flex-1 min-w-[200px] flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 h-8 focus-within:border-red-500 focus-within:bg-white transition-all">
          <Search size={14} className="text-gray-300 flex-shrink-0" />
          <input
            type="text"
            placeholder="Search by account name or code..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="flex-1 bg-transparent border-none outline-none text-[12px] font-bold text-black placeholder:text-gray-300 placeholder:font-semibold"
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm('')} className="text-gray-300 hover:text-red-500 text-lg leading-none transition-colors">×</button>
          )}
        </div>

        <div className="hidden md:block w-px h-7 bg-gray-100" />

        {/* Date filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-black text-gray-400 uppercase tracking-[2px]">From</span>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
            className="px-3 py-2 border border-gray-100 rounded-xl bg-gray-50 text-[11px] font-bold text-black outline-none focus:border-red-500 focus:bg-white transition-all" />
          <span className="text-[10px] font-black text-gray-400 uppercase tracking-[2px]">To</span>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
            className="px-3 py-2 border border-gray-100 rounded-xl bg-gray-50 text-[11px] font-bold text-black outline-none focus:border-red-500 focus:bg-white transition-all" />
        </div>

        <button onClick={() => { setStartDate(''); setEndDate(''); setSearchTerm(''); }}
          className="px-4 py-2 border border-gray-900 rounded-xl text-[10px] font-black text-gray-900 uppercase tracking-widest hover:border-red-500 hover:text-red-600 transition-all bg-white cursor-pointer">
          Reset
        </button>
        <button onClick={() => { const t = new Date().toISOString().split('T')[0]; setStartDate(t); setEndDate(t); }}
          className="px-4 py-2 bg-black rounded-xl text-[10px] font-black text-white uppercase tracking-widest hover:bg-red-600 transition-all cursor-pointer">
          Today
        </button>
      </div>

      {/* TABLE CARD */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col custom-scrollbar">

        {/* Table header bar */}
        <div className="flex items-center gap-2 px-5 py-3 bg-black flex-shrink-0">
          <Table2 size={14} className="text-gray-500" />
          <span className="text-[11px] font-black uppercase tracking-[3px] text-white">Account Ledger</span>
          <span className="text-[10px] font-bold text-gray-600 ml-1">{filtered.length} records</span>
          <div className="ml-auto">
            {isBalanced
              ? <span className="px-2.5 py-1 bg-green-100 text-green-800 text-[9px] font-black uppercase rounded-md tracking-widest">Balanced</span>
              : <span className="px-2.5 py-1 bg-red-100 text-red-800 text-[9px] font-black uppercase rounded-md tracking-widest">Unbalanced</span>
            }
          </div>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto overflow-x-auto custom-scrollbar" style={{ maxHeight: '570px' }}>
          <table className="w-full border-collapse" style={{ tableLayout: 'fixed', minWidth: '480px' }}>
            <colgroup>
              <col style={{ width: '12%' }} />
              <col style={{ width: '46%' }} />
              <col style={{ width: '21%' }} />
              <col style={{ width: '21%' }} />
            </colgroup>
            <thead className="sticky top-0 z-10">
              <tr className="bg-gray-50 border-b border-gray-100">
                {['Code', 'Account Name', 'Debit', 'Credit'].map((h, i) => (
                  <th key={i} className={`py-3 px-4 text-[12px] font-black uppercase tracking-[1.5px] text-black ${i >= 2 ? 'text-right border-l border-gray-200' : 'text-left'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 ? (
                <tr><td colSpan={4} className="py-16 text-center text-[12px] font-bold text-gray-300">No accounts match your search</td></tr>
              ) : filtered.map((row, i) => (
                <tr key={i} className="hover:bg-red-50 transition-colors">
                  <td className="py-3 px-4 text-[11px] font-bold text-gray-400">{row['Account Code']}</td>
                  <td className="py-3 px-4 text-[13px] font-bold text-black">{row['Account Name']}</td>
                  <td className="py-3 px-4 text-right font-mono text-[16px] font-black text-black border-l border-gray-200">
                    {parseFloat(row.DEBIT) > 0 ? fmt(row.DEBIT) : <span className="text-gray-200">—</span>}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-[16px] font-black text-red-600 border-l border-gray-200">
                    {parseFloat(row.CREDIT) > 0 ? fmt(row.CREDIT) : <span className="text-gray-200">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals footer — outside scroll, always visible */}
        <div className="border-t-4 border-red-600 bg-black flex-shrink-0">
          <table className="w-full border-collapse" style={{ tableLayout: 'fixed', minWidth: '480px' }}>
            <colgroup>
              <col style={{ width: '12%' }} />
              <col style={{ width: '46%' }} />
              <col style={{ width: '21%' }} />
              <col style={{ width: '21%' }} />
            </colgroup>
            <tbody>
              <tr>
                <td colSpan="2" className="py-3 px-4 text-[11px] font-black text-white uppercase tracking-[3px]">Totals</td>
                <td className="py-3 px-4 text-right font-mono text-[14px] font-black text-white border-l border-gray-600">PHP {fmt(totalDebit)}</td>
                <td className="py-3 px-4 text-right font-mono text-[14px] font-black text-red-400 border-l border-gray-600">PHP {fmt(totalCredit)}</td>
              </tr>
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
}

function StatCard({ iconBg, iconColor, icon, label, value, sub, small = false, valueClass = 'text-black' }) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-4 flex items-center gap-3 hover:shadow-md transition-shadow">
      <div className={`w-10 h-10 ${iconBg} ${iconColor} rounded-xl flex items-center justify-center flex-shrink-0`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[9px] font-black uppercase tracking-[3px] text-gray-400 mb-1 whitespace-nowrap">{label}</p>
        <h4 className={`font-black ${valueClass} leading-none truncate ${small ? 'text-[13px]' : 'text-xl'}`}>{value}</h4>
        <p className="text-[9px] font-bold text-gray-300 uppercase mt-1">{sub}</p>
      </div>
    </div>
  );
}