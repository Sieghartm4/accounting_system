import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Table2, Download, DollarSign, TrendingUp, TrendingDown, RefreshCcw, Calendar, FileText } from 'lucide-react';

export default function IncomeStatement() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  // Calculate color class whenever data changes
  const netIncomeColorClass = data?.netIncome >= 0 ? 'text-green-600' : 'text-red-600';

  useEffect(() => { fetchIncomeStatement(); }, []);

  useEffect(() => {
    const timer = setTimeout(() => { fetchIncomeStatement(); }, 500);
    return () => clearTimeout(timer);
  }, [startDate, endDate]);

  const fetchIncomeStatement = async () => {
    try {
      setLoading(true);
      setError('');
      const token = localStorage.getItem('token');
      const params = new URLSearchParams();
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);
      const url = `${import.meta.env.VITE_SERVER_LINK}/reports/income-statement${params.toString() ? '?' + params : ''}`;
      
      const response = await fetch(url, {
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();
      if (result.success) setData(result.data);
      else setError(result.message || 'Failed to fetch income statement');
    } catch (err) {
      setError('Connection Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const fmt = (n) => new Intl.NumberFormat('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);

  if (loading && !data) return (
    <div className="h-full w-full flex flex-col items-center justify-center gap-4">
      <div className="w-10 h-10 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
      <p className="text-[10px] font-black uppercase tracking-[3px] text-gray-400">Calculating Profit & Loss...</p>
    </div>
  );

  if (error) return (
    <div className="p-10">
      <div className="bg-red-50 border-l-4 border-red-600 p-6 rounded-r-xl">
        <h3 className="text-red-800 font-bold uppercase text-sm">Error</h3>
        <p className="text-red-600 text-sm mt-1">{error}</p>
        <button onClick={fetchIncomeStatement} className="mt-3 px-4 py-2 bg-red-600 text-white text-xs font-black rounded-lg uppercase tracking-widest hover:bg-red-700">Retry</button>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-5 bg-[#F3F4F6] min-h-full custom-scrollbar">

      {/* HEADER */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-black rounded-xl flex-shrink-0">
            <FileText size={22} className="text-red-500" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-black tracking-tighter leading-none">
              Income <span className="text-red-600 italic">Statement</span>
            </h1>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-[2px] mt-1">Profit & Loss Summary</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 px-5 py-2.5 bg-white border border-gray-200 text-[11px] font-black text-black rounded-xl hover:bg-gray-50 uppercase tracking-widest shadow-sm">
            <Download size={13} /> Export PDF
          </button>
          <button onClick={fetchIncomeStatement}
            className="w-10 h-10 bg-red-600 text-white rounded-xl hover:bg-red-700 flex items-center justify-center transition-colors shadow-lg shadow-red-200">
            <RefreshCcw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* STAT CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <StatCard
          iconBg="bg-green-50" iconColor="text-green-600"
          icon={<TrendingUp size={18} />}
          label="Total Revenue" value={`₱${fmt(data?.totalRevenues)}`} sub="Gross Earnings"
          valueClass="text-green-600"
        />
        <StatCard
          iconBg="bg-red-50" iconColor="text-red-600"
          icon={<TrendingDown size={18} />}
          label="Total Expenses" value={`₱${fmt(data?.totalExpenses)}`} sub="Operating Costs"
          valueClass="text-red-600"
        />
        <StatCard
          iconBg="bg-black" iconColor="text-red-500"
          icon={<DollarSign size={18} />}
          label="Net Income"
          value={`₱${fmt(data?.netIncome)}`}
          sub="Bottom Line"
          valueClass={data?.netIncome >= 0 ? 'text-black' : 'text-red-600'}
        />
      </div>

      {/* TOOLBAR */}
      <div className="bg-white border border-gray-100 rounded-2xl px-4 py-3 flex items-center gap-4 flex-wrap shadow-sm">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-red-100 rounded-lg text-red-600">
            <Calendar size={14} />
          </div>
          <span className="text-[10px] font-black text-gray-400 uppercase tracking-[2px]">Period Filter</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
            className="px-3 py-2 border border-gray-100 rounded-xl bg-gray-50 text-[11px] font-bold text-black outline-none focus:border-red-500 focus:bg-white transition-all" />
          <span className="text-gray-300">to</span>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
            className="px-3 py-2 border border-gray-100 rounded-xl bg-gray-50 text-[11px] font-bold text-black outline-none focus:border-red-500 focus:bg-white transition-all" />
        </div>
        <div className="ml-auto flex gap-2">
            <button onClick={() => { setStartDate(''); setEndDate(''); }}
              className="px-4 py-2 border border-gray-900 rounded-xl text-[10px] font-black text-gray-900 uppercase tracking-widest hover:border-red-500 hover:text-red-600 transition-all bg-white cursor-pointer">
              Reset
            </button>
            <button onClick={() => { const t = new Date().toISOString().split('T')[0]; setStartDate(t); setEndDate(t); }}
              className="px-4 py-2 bg-black rounded-xl text-[10px] font-black text-white uppercase tracking-widest hover:bg-red-600 cursor-pointer">
              Today
            </button>
        </div>
      </div>

      {/* CONTENT GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        
        {/* REVENUE TABLE */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col custom-scrollbar">
          <div className="flex items-center gap-2 px-5 py-3 bg-black">
            <TrendingUp size={14} className="text-green-500" />
            <span className="text-[11px] font-black uppercase tracking-[3px] text-white">Revenues</span>
          </div>
          <div className="overflow-y-auto custom-scrollbar" style={{ maxHeight: '480px' }}>
            <table className="w-full border-collapse">
              <thead className="sticky top-0 bg-gray-50 z-10">
                <tr className="border-b border-gray-100">
                  <th className="py-3 px-5 text-[11px] font-black uppercase text-gray-400 text-left">Code</th>
                  <th className="py-3 px-5 text-[11px] font-black uppercase text-gray-400 text-left">Account Name</th>
                  <th className="py-3 px-5 text-[11px] font-black uppercase text-gray-400 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.revenues?.map((item, i) => (
                  <tr key={i} className="hover:bg-green-50/50 transition-colors">
                    <td className="py-3 px-5">
                      <p className="text-[10px] font-bold text-gray-400 uppercase">{item['Account Code']}</p>
                    </td>
                    <td className="py-3 px-5">
                      <p className="text-[13px] font-bold text-black">{item['Account Name']}</p>
                    </td>
                    <td className="py-3 px-5 text-right font-mono text-[15px] font-black text-black">
                      {fmt(item.Current)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-auto bg-gray-50 border-t border-gray-100 px-5 py-3 flex justify-between items-center">
            <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Total Revenue</span>
            <span className="text-lg font-black text-green-600">₱ {fmt(data.totalRevenues)}</span>
          </div>
        </div>

        {/* EXPENSES TABLE */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col custom-scrollbar">
          <div className="flex items-center gap-2 px-5 py-3 bg-black">
            <TrendingDown size={14} className="text-red-500" />
            <span className="text-[11px] font-black uppercase tracking-[3px] text-white">Expenses</span>
          </div>
          <div className="overflow-y-auto custom-scrollbar" style={{ maxHeight: '480px' }}>
            <table className="w-full border-collapse">
              <thead className="sticky top-0 bg-gray-50 z-10">
                <tr className="border-b border-gray-100">
                  <th className="py-3 px-5 text-[11px] font-black uppercase text-gray-400 text-left">Code</th>
                  <th className="py-3 px-5 text-[11px] font-black uppercase text-gray-400 text-left">Account Name</th>
                  <th className="py-3 px-5 text-[11px] font-black uppercase text-gray-400 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.expenses?.map((item, i) => (
                  <tr key={i} className="hover:bg-red-50/50 transition-colors">
                    <td className="py-3 px-5">
                      <p className="text-[10px] font-bold text-gray-400 uppercase">{item['Account Code']}</p>
                    </td>
                    <td className="py-3 px-5">
                      <p className="text-[13px] font-bold text-black">{item['Account Name']}</p>
                    </td>
                    <td className="py-3 px-5 text-right font-mono text-[15px] font-black text-red-600">
                      {fmt(item.Current)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-auto bg-gray-50 border-t border-gray-100 px-5 py-3 flex justify-between items-center">
            <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Total Expenses</span>
            <span className="text-lg font-black text-red-600">₱ {fmt(data.totalExpenses)}</span>
          </div>
        </div>

      </div>
    </div>
  );
}

function StatCard({ iconBg, iconColor, icon, label, value, sub, valueClass = 'text-black' }) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-4 flex items-center gap-3 hover:shadow-md transition-shadow">
      <div className={`w-10 h-10 ${iconBg} ${iconColor} rounded-xl flex items-center justify-center flex-shrink-0`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[9px] font-black uppercase tracking-[3px] text-gray-400 mb-1 whitespace-nowrap">{label}</p>
        <h4 className={`font-black ${valueClass} leading-none truncate text-xl tracking-tight`}>{value}</h4>
        <p className="text-[9px] font-bold text-gray-300 uppercase mt-1">{sub}</p>
      </div>
    </div>
  );
}