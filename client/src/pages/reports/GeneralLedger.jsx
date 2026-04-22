import React, { useState, useEffect, useMemo } from 'react';
import {
  FileText, Download, RefreshCcw, ArrowUpRight,
  ArrowDownLeft, Hash, Search, User, ChevronDown
} from 'lucide-react';

export default function GeneralLedger() {
  const [sections, setSections]           = useState([]);
  const [grandTotalDebit, setGTD]         = useState(0);
  const [grandTotalCredit, setGTC]        = useState(0);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState('');
  const [startDate, setStartDate]         = useState('');
  const [endDate, setEndDate]             = useState('');
  const [searchTerm, setSearchTerm]       = useState('');
  const [activeSection, setActiveSection] = useState(null);

  useEffect(() => { fetchGeneralLedger(); }, []);

  useEffect(() => {
    const t = setTimeout(() => fetchGeneralLedger(), 500);
    return () => clearTimeout(t);
  }, [startDate, endDate]);

  const fetchGeneralLedger = async () => {
    try {
      setLoading(true);
      setError('');
      const token = localStorage.getItem('token');
      const params = new URLSearchParams();
      if (startDate) params.append('start_date', startDate);
      if (endDate)   params.append('end_date',   endDate);

      const url = `${import.meta.env.VITE_SERVER_LINK}/reports/general-ledger${params.toString() ? '?' + params.toString() : ''}`;
      const response = await fetch(url, {
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
      });

      const result = await response.json();
      if (result.success) {
        setSections(result.data.sections         || []);
        setGTD(result.data.grandTotalDebit       || 0);
        setGTC(result.data.grandTotalCredit      || 0);
        if (!startDate && !endDate) {
          if (result.startDate) setStartDate(result.startDate);
          if (result.endDate)   setEndDate(result.endDate);
        }
      } else {
        setError(result.message || 'Failed to fetch general ledger');
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

  // Filter sections + transactions by search term
  const { filteredSections, subTotalDebit, subTotalCredit } = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    let td = 0, tc = 0;

    const filtered = sections.map(sec => {
      const txns = q
        ? sec.transactions.filter(t =>
            t.trans_no?.toLowerCase().includes(q) ||
            t.responsibility_center?.toLowerCase().includes(q) ||
            String(t.doc_ref).toLowerCase().includes(q)
          )
        : sec.transactions;

      txns.forEach(t => { td += t.debit; tc += t.credit; });
      return { ...sec, transactions: txns };
    }).filter(sec => sec.transactions.length > 0);

    return { filteredSections: filtered, subTotalDebit: td, subTotalCredit: tc };
  }, [sections, searchTerm]);

  const totalRows = filteredSections.reduce((s, sec) => s + sec.transactions.length, 0);

  // Scroll to section function
  const scrollToSection = (sectionKey) => {
    const element = document.getElementById(`section-${sectionKey}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveSection(sectionKey);
    }
  };

  if (loading && sections.length === 0) return (
    <div className="h-full w-full flex flex-col items-center justify-center gap-4">
      <div className="w-10 h-10 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
      <p className="text-[10px] font-black uppercase tracking-[3px] text-gray-400">Loading Ledger Transactions...</p>
    </div>
  );

  if (error) return (
    <div className="p-10">
      <div className="bg-red-50 border-l-4 border-red-600 p-6 rounded-r-xl">
        <h3 className="text-red-800 font-bold uppercase text-sm">Error</h3>
        <p className="text-red-600 text-sm mt-1">{error}</p>
        <button onClick={fetchGeneralLedger} className="mt-3 px-4 py-2 bg-red-600 text-white text-xs font-black rounded-lg uppercase tracking-widest hover:bg-red-700">Retry</button>
      </div>
    </div>
  );

  const isBalanced = Math.abs(grandTotalDebit - grandTotalCredit) < 0.01;

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
              General <span className="text-red-600 italic">Ledger</span>
            </h1>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-[2px] mt-1">Transaction History & Audit</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 px-5 py-2.5 bg-white border border-gray-200 text-[11px] font-black text-black rounded-xl hover:bg-gray-50 uppercase tracking-widest">
            <Download size={13} /> Export PDF
          </button>
          <button onClick={fetchGeneralLedger}
            className="w-10 h-10 bg-red-600 text-white rounded-xl hover:bg-red-700 flex items-center justify-center transition-colors">
            <RefreshCcw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* STAT CARDS */}
      <div className="grid grid-cols-4 gap-3">
        <StatCard iconBg="bg-red-50" iconColor="text-red-600" icon={<FileText size={18} />}
          label="Total Transactions" value={totalRows} sub="Journal Entries" />
        <StatCard iconBg="bg-gray-100" iconColor="text-black" icon={<ArrowUpRight size={18} />}
          label="Total Debit" value={`₱${fmt(subTotalDebit)}`} sub="PHP" small />
        <StatCard iconBg="bg-red-50" iconColor="text-red-600" icon={<ArrowDownLeft size={18} />}
          label="Total Credit" value={`₱${fmt(subTotalCredit)}`} sub="PHP" small valueClass="text-red-600" />
        <StatCard
          iconBg={isBalanced ? 'bg-green-50' : 'bg-red-50'}
          iconColor={isBalanced ? 'text-green-600' : 'text-red-600'}
          icon={<Hash size={18} />}
          label="Balance Status"
          value={isBalanced ? 'Balanced' : 'Unbalanced'}
          sub="Audit Check"
          valueClass={isBalanced ? 'text-green-600' : 'text-red-600'}
        />
      </div>

      {/* TOOLBAR */}
      <div className="bg-white border border-gray-100 rounded-2xl px-4 py-3 flex items-center gap-3 flex-wrap shadow-sm">
        {/* Navigation Sidebar */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black text-gray-400 uppercase tracking-[2px]">Navigate:</span>
          <div className="relative">
            <button
              onClick={() => setActiveSection(activeSection === null ? 'dropdown' : null)}
              className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-[11px] font-black text-gray-700 hover:bg-gray-100 transition-all"
            >
              <span>All Sections</span>
              <ChevronDown size={12} className={`transition-transform ${activeSection === 'dropdown' ? 'rotate-180' : ''}`} />
            </button>
            {activeSection === 'dropdown' && sections.length > 0 && (
              <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 min-w-[200px]">
                {sections.map(sec => (
                  <button
                    key={sec.section_key}
                    onClick={() => scrollToSection(sec.section_key)}
                    className="w-full text-left px-4 py-2 text-[11px] font-black text-gray-700 hover:bg-red-50 hover:text-red-600 transition-all flex items-center justify-between"
                  >
                    <span>{sec.section_label}</span>
                    <span className="text-[9px] text-gray-400">({sec.transactions.length})</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="hidden md:block w-px h-7 bg-gray-100" />

        {/* Search */}
        <div className="flex-1 min-w-[200px] flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 h-8 focus-within:border-red-500 focus-within:bg-white transition-all">
          <Search size={14} className="text-gray-300 flex-shrink-0" />
          <input type="text" placeholder="Search transactions..."
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
          <span className="text-[10px] font-bold text-gray-600 ml-1">{totalRows} records</span>
          <div className="ml-auto">
            {isBalanced
              ? <span className="px-2.5 py-1 bg-green-100 text-green-800 text-[9px] font-black uppercase rounded-md tracking-widest">Balanced</span>
              : <span className="px-2.5 py-1 bg-red-100 text-red-800 text-[9px] font-black uppercase rounded-md tracking-widest">Unbalanced</span>
            }
          </div>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto overflow-x-auto custom-scrollbar" style={{ maxHeight: '460px' }}>
          <table className="w-full border-collapse" style={{ tableLayout: 'fixed', minWidth: '800px' }}>
            <colgroup>
              <col style={{ width: '11%' }} />
              <col style={{ width: '14%' }} />
              <col style={{ width: '11%' }} />
              <col style={{ width: '21%' }} />
              <col style={{ width: '17%' }} />
              <col style={{ width: '17%' }} />
              <col style={{ width: '9%' }} />
            </colgroup>
            <thead className="sticky top-0 z-10">
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="py-3 px-4 text-[12px] font-black uppercase tracking-[1.5px] text-black text-left">Trans. No.</th>
                <th className="py-3 px-4 text-[12px] font-black uppercase tracking-[1.5px] text-black text-left">Posted Date</th>
                <th className="py-3 px-4 text-[12px] font-black uppercase tracking-[1.5px] text-black text-left">Doc Ref</th>
                <th className="py-3 px-4 text-[12px] font-black uppercase tracking-[1.5px] text-black text-left">Vendor / Customer</th>
                <th className="py-3 px-4 text-[12px] font-black uppercase tracking-[1.5px] text-black text-right border-l border-gray-200">Debit</th>
                <th className="py-3 px-4 text-[12px] font-black uppercase tracking-[1.5px] text-black text-right border-l border-gray-200">Credit</th>
                <th className="py-3 px-4 text-[12px] font-black uppercase tracking-[1.5px] text-black text-center border-l border-gray-200">Center</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredSections.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-[12px] font-bold text-gray-300">
                    No transactions found
                  </td>
                </tr>
              ) : filteredSections.map(sec => (
                <React.Fragment key={sec.section_key}>

                  {/* Section header row */}
                  <tr id={`section-${sec.section_key}`} className="bg-gray-300">
                    <td colSpan={7} className="py-2 px-4">
                      <span className="text-[10px] font-black uppercase tracking-[3px] text-black">
                        {sec.section_label}
                      </span>
                    </td>
                  </tr>

                  {/* Transaction rows */}
                  {sec.transactions.map((t, i) => (
                    <tr key={i} className="hover:bg-red-50 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded bg-gray-100 flex items-center justify-center text-gray-500">
                            <Hash size={10} />
                          </div>
                          <span className="text-[12px] font-black text-black">{t.trans_no}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-[12px] font-bold text-black">{formatDate(t.posted_date)}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-[12px] font-black text-gray-600">{t.doc_ref || 'N/A'}</span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 rounded-full bg-red-50 flex items-center justify-center text-red-500">
                            <User size={8} />
                          </div>
                          <span className="text-[12px] font-bold text-gray-600 truncate">
                            {t.responsibility_center || '—'}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-[15px] font-black text-black border-l border-gray-200">
                        {t.debit > 0 ? fmt(t.debit) : <span className="text-gray-200">—</span>}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-[15px] font-black text-red-600 border-l border-gray-200">
                        {t.credit > 0 ? fmt(t.credit) : <span className="text-gray-200">—</span>}
                      </td>
                      <td className="py-3 px-4 text-center border-l border-gray-200">
                        <span className="px-2 py-1 bg-gray-100 text-[10px] font-black text-gray-500 rounded uppercase tracking-tighter">
                          {t.responsibility_center || 'HQ'}
                        </span>
                      </td>
                    </tr>
                  ))}

                  {/* Section subtotal row */}
                  <tr className="bg-gray-50 border-t border-gray-200">
                    <td colSpan={4} className="py-2 px-4 text-right text-[10px] font-black text-gray-400 uppercase tracking-[2px]">
                      {sec.section_label} Sub-Total
                    </td>
                    <td className="py-2 px-4 text-right font-mono text-[12px] font-black text-black border-l border-gray-200">
                      {fmt(sec.transactions.reduce((s, t) => s + t.debit, 0))}
                    </td>
                    <td className="py-2 px-4 text-right font-mono text-[12px] font-black text-red-600 border-l border-gray-200">
                      {fmt(sec.transactions.reduce((s, t) => s + t.credit, 0))}
                    </td>
                    <td className="border-l border-gray-200" />
                  </tr>

                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>

        {/* Grand totals footer */}
        <div className="border-t-4 border-red-600 bg-black flex-shrink-0">
          <table className="w-full border-collapse" style={{ tableLayout: 'fixed', minWidth: '800px' }}>
            <colgroup>
              <col style={{ width: '11%' }} />
              <col style={{ width: '14%' }} />
              <col style={{ width: '11%' }} />
              <col style={{ width: '21%' }} />
              <col style={{ width: '17%' }} />
              <col style={{ width: '17%' }} />
              <col style={{ width: '9%' }} />
            </colgroup>
            <tbody>
              <tr>
                <td colSpan={4} className="py-3 px-4 text-[12px] font-black text-white uppercase tracking-[3px]">Grand Total</td>
                <td className="py-3 px-4 text-right font-mono text-[15px] font-black text-white border-l border-gray-600">
                  PHP {fmt(grandTotalDebit)}
                </td>
                <td className="py-3 px-4 text-right font-mono text-[15px] font-black text-red-400 border-l border-gray-600">
                  PHP {fmt(grandTotalCredit)}
                </td>
                <td className="py-3 px-4 text-center text-[12px] font-black text-gray-400 border-l border-gray-600">—</td>
              </tr>
              <tr className="border-t border-gray-700">
                <td colSpan={4} className="py-2 px-4 text-[10px] font-black text-gray-400 uppercase tracking-[2px]">Net (Debit − Credit)</td>
                <td colSpan={2} className={`py-2 px-4 text-right font-mono text-[13px] font-black border-l border-gray-600 ${grandTotalDebit >= grandTotalCredit ? 'text-white' : 'text-red-400'}`}>
                  PHP {fmt(Math.abs(grandTotalDebit - grandTotalCredit))}
                  <span className="text-[10px] ml-1">{grandTotalDebit >= grandTotalCredit ? 'DR' : 'CR'}</span>
                </td>
                <td className="border-l border-gray-600" />
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
      <div className={`w-10 h-10 ${iconBg} ${iconColor} rounded-xl flex items-center justify-center flex-shrink-0`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-[9px] font-black uppercase tracking-[3px] text-gray-400 mb-1 whitespace-nowrap">{label}</p>
        <h4 className={`font-black ${valueClass} leading-none truncate ${small ? 'text-[13px]' : 'text-xl'}`}>{value}</h4>
        <p className="text-[9px] font-bold text-gray-300 uppercase mt-1">{sub}</p>
      </div>
    </div>
  );
}