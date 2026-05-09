import React, { useState, useEffect, useMemo } from 'react';
import {
  FileText, Download, RefreshCcw, Search, User, Calendar, Hash
} from 'lucide-react';

export default function JournalEntries() {
  const [journalEntries, setJournalEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => { fetchJournalEntries(); }, []);

  useEffect(() => {
    const t = setTimeout(() => fetchJournalEntries(), 500);
    return () => clearTimeout(t);
  }, [startDate, endDate]);

  const fetchJournalEntries = async () => {
    try {
      setLoading(true);
      setError('');
      const token = localStorage.getItem('token');
      const params = new URLSearchParams();
      if (startDate) params.append('start_date', startDate);
      if (endDate)   params.append('end_date', endDate);

      const url = `${import.meta.env.VITE_SERVER_LINK}/reports/journal-entries${params.toString() ? '?' + params.toString() : ''}`;
      const response = await fetch(url, {
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
      });

      const result = await response.json();
      if (result.success) {
        setJournalEntries(result.data || []);
        if (!startDate && !endDate) {
          if (result.startDate) setStartDate(result.startDate);
          if (result.endDate)   setEndDate(result.endDate);
        }
      } else {
        setError(result.message || 'Failed to fetch journal entries');
      }
    } catch (err) {
      setError('Connection Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const fmt = n => new Intl.NumberFormat('en-PH', {
    minimumFractionDigits: 2, maximumFractionDigits: 2
  }).format(n || 0);

  const formatDate = ds => {
    if (!ds) return '';
    const d = new Date(ds);
    return d.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: '2-digit' });
  };

  // Filter journal entries by search term
  const filteredEntries = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    if (!q) return journalEntries;
    
    return journalEntries.filter(entry =>
      entry.db_name?.toLowerCase().includes(q) ||
      entry.responsibility_center?.toLowerCase().includes(q) ||
      entry.coa_name?.toLowerCase().includes(q) ||
      entry.type?.toLowerCase().includes(q)
    );
  }, [journalEntries, searchTerm]);

  if (loading && journalEntries.length === 0) return (
    <div className="h-full w-full flex flex-col items-center justify-center gap-4">
      <div className="w-10 h-10 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
      <p className="text-[10px] font-black uppercase tracking-[3px] text-gray-400">Loading Journal Entries...</p>
    </div>
  );

  if (error) return (
    <div className="p-10">
      <div className="bg-red-50 border-l-4 border-red-600 p-6 rounded-r-xl">
        <h3 className="text-red-800 font-bold uppercase text-sm">Error</h3>
        <p className="text-red-600 text-sm mt-1">{error}</p>
        <button onClick={fetchJournalEntries} className="mt-3 px-4 py-2 bg-red-600 text-white text-xs font-black rounded-lg uppercase tracking-widest hover:bg-red-700">Retry</button>
      </div>
    </div>
  );

  const totalDebit = filteredEntries.reduce((sum, entry) => entry.type === 'DEBIT' ? sum + parseFloat(entry.amount || 0) : sum, 0);
  const totalCredit = filteredEntries.reduce((sum, entry) => entry.type === 'CREDIT' ? sum + parseFloat(entry.amount || 0) : sum, 0);

  return (
    <div className="flex flex-col gap-2 bg-[#F3F4F6] min-h-full custom-scrollbar">

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
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-[2px] mt-1">Transaction Records</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 px-5 py-2.5 bg-white border border-gray-200 text-[11px] font-black text-black rounded-xl hover:bg-gray-50 uppercase tracking-widest">
            <Download size={13} /> Export PDF
          </button>
          <button onClick={fetchJournalEntries}
            className="w-10 h-10 bg-red-600 text-white rounded-xl hover:bg-red-700 flex items-center justify-center transition-colors">
            <RefreshCcw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* STAT CARDS */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-white border border-gray-100 rounded-2xl p-4 flex items-center gap-3 hover:shadow-md transition-shadow">
          <div className="w-10 h-10 bg-red-50 text-red-600 rounded-xl flex items-center justify-center flex-shrink-0">
            <FileText size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-[9px] font-black uppercase tracking-[3px] text-gray-400 mb-1 whitespace-nowrap">Total Entries</p>
            <h4 className="font-black text-black leading-none truncate text-xl">{filteredEntries.length}</h4>
            <p className="text-[9px] font-bold text-gray-300 uppercase mt-1">Journal Entries</p>
          </div>
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl p-4 flex items-center gap-3 hover:shadow-md transition-shadow">
          <div className="w-10 h-10 bg-gray-100 text-black rounded-xl flex items-center justify-center flex-shrink-0">
            <Hash size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-[9px] font-black uppercase tracking-[3px] text-gray-400 mb-1 whitespace-nowrap">Total Debit</p>
            <h4 className="font-black text-black leading-none truncate text-xl">₱{fmt(totalDebit)}</h4>
            <p className="text-[9px] font-bold text-gray-300 uppercase mt-1">PHP</p>
          </div>
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl p-4 flex items-center gap-3 hover:shadow-md transition-shadow">
          <div className="w-10 h-10 bg-red-50 text-red-600 rounded-xl flex items-center justify-center flex-shrink-0">
            <Hash size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-[9px] font-black uppercase tracking-[3px] text-gray-400 mb-1 whitespace-nowrap">Total Credit</p>
            <h4 className="font-black text-red-600 leading-none truncate text-xl">₱{fmt(totalCredit)}</h4>
            <p className="text-[9px] font-bold text-gray-300 uppercase mt-1">PHP</p>
          </div>
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl p-4 flex items-center gap-3 hover:shadow-md transition-shadow">
          <div className="w-10 h-10 bg-green-50 text-green-600 rounded-xl flex items-center justify-center flex-shrink-0">
            <Calendar size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-[9px] font-black uppercase tracking-[3px] text-gray-400 mb-1 whitespace-nowrap">Balance</p>
            <h4 className="font-black text-green-600 leading-none truncate text-xl">₱{fmt(Math.abs(totalDebit - totalCredit))}</h4>
            <p className="text-[9px] font-bold text-gray-300 uppercase mt-1">{totalDebit > totalCredit ? 'DR' : 'CR'}</p>
          </div>
        </div>
      </div>

      {/* TOOLBAR */}
      <div className="bg-white border border-gray-100 rounded-2xl px-4 py-3 flex items-center gap-3 flex-wrap shadow-sm">
        {/* Search */}
        <div className="flex-1 min-w-[200px] flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 h-8 focus-within:border-red-500 focus-within:bg-white transition-all">
          <Search size={14} className="text-gray-300 flex-shrink-0" />
          <input type="text" placeholder="Search journal entries..."
            value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            className="flex-1 bg-transparent border-none outline-none text-[12px] font-bold text-black placeholder:text-gray-300 placeholder:font-semibold" />
          {searchTerm && (
            <button onClick={() => setSearchTerm('')} className="text-gray-300 hover:text-red-500 text-lg leading-none transition-colors">×</button>
          )}
        </div>
        <div className="hidden md:block w-px h-7 bg-gray-100" />
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
          <FileText size={14} className="text-gray-500" />
          <span className="text-[11px] font-black uppercase tracking-[3px] text-white">Journal Entries</span>
          <span className="text-[10px] font-bold text-gray-600 ml-1">{filteredEntries.length} records</span>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto overflow-x-auto custom-scrollbar" style={{ maxHeight: '460px' }}>
          <table className="w-full border-collapse" style={{ tableLayout: 'fixed', minWidth: '800px' }}>
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
                <th className="py-3 px-4 text-[12px] font-black uppercase tracking-[1.5px] text-black text-left">ID</th>
                <th className="py-3 px-4 text-[12px] font-black uppercase tracking-[1.5px] text-black text-left">Date</th>
                <th className="py-3 px-4 text-[12px] font-black uppercase tracking-[1.5px] text-black text-left">Module</th>
                <th className="py-3 px-4 text-[12px] font-black uppercase tracking-[1.5px] text-black text-left">Responsibility Center</th>
                <th className="py-3 px-4 text-[12px] font-black uppercase tracking-[1.5px] text-black text-left">Account Name</th>
                <th className="py-3 px-4 text-[12px] font-black uppercase tracking-[1.5px] text-black text-right border-l border-gray-200">Debit</th>
                <th className="py-3 px-4 text-[12px] font-black uppercase tracking-[1.5px] text-black text-right border-l border-gray-200">Credit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredEntries.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-[12px] font-bold text-gray-300">
                    No journal entries found
                  </td>
                </tr>
              ) : filteredEntries.map((entry, index) => (
                <tr key={entry.id || index} className="hover:bg-red-50 transition-colors">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded bg-gray-100 flex items-center justify-center text-gray-500">
                        <Hash size={10} />
                      </div>
                      <span className="text-[12px] font-black text-black">{entry.id}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-[12px] font-bold text-black">{formatDate(entry.date)}</span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-[12px] font-black text-gray-600">{entry.db_name || '—'}</span>
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
                    <span className="text-[12px] font-black text-gray-600">{entry.coa_name || '—'}</span>
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-[15px] font-black text-black border-l border-gray-200">
                    {entry.type === 'DEBIT' ? `₱${fmt(entry.amount)}` : <span className="text-gray-200">—</span>}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-[15px] font-black text-red-600 border-l border-gray-200">
                    {entry.type === 'CREDIT' ? `₱${fmt(entry.amount)}` : <span className="text-gray-200">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Summary footer */}
        <div className="border-t-4 border-red-600 bg-black flex-shrink-0">
          <table className="w-full border-collapse" style={{ tableLayout: 'fixed', minWidth: '800px' }}>
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
                <td colSpan={5} className="py-3 px-4 text-[12px] font-black text-white uppercase tracking-[3px]">Total Summary</td>
                <td className="py-3 px-4 text-right font-mono text-[15px] font-black text-white border-l border-gray-600">
                  ₱{fmt(totalDebit)}
                </td>
                <td className="py-3 px-4 text-right font-mono text-[15px] font-black text-red-400 border-l border-gray-600">
                  ₱{fmt(totalCredit)}
                </td>
              </tr>
              <tr className="border-t border-gray-700">
                <td colSpan={5} className="py-2 px-4 text-[10px] font-black text-gray-400 uppercase tracking-[2px]">Net Balance</td>
                <td colSpan={2} className={`py-2 px-4 text-right font-mono text-[13px] font-black border-l border-gray-600 ${totalDebit >= totalCredit ? 'text-white' : 'text-red-400'}`}>
                  ₱{fmt(Math.abs(totalDebit - totalCredit))}
                  <span className="text-[10px] ml-1">{totalDebit > totalCredit ? 'DR' : 'CR'}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
