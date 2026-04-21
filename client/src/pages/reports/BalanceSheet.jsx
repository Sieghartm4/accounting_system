import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  Download, 
  RefreshCcw, 
  ShieldCheck, 
  ShieldAlert, 
  PieChart,
  Layers,
  Briefcase,
} from 'lucide-react';

export default function BalanceSheet() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    fetchBalanceSheet();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchBalanceSheet();
    }, 500);
    return () => clearTimeout(timer);
  }, [startDate, endDate]);

  const fetchBalanceSheet = async () => {
    try {
      setLoading(true);
      setError('');
      const token = localStorage.getItem('token');
      
      const params = new URLSearchParams();
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);
      
      const url = `${import.meta.env.VITE_SERVER_LINK}/reports/balance-sheet${params.toString() ? '?' + params.toString() : ''}`;
      
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      const result = await response.json();
      if (result.success) {
        setData(result.data);
      } else {
        setError(result.message || 'Failed to fetch balance sheet');
      }
    } catch (err) {
      setError('Connection Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const fmt = (n) => new Intl.NumberFormat('en-PH', { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2 
  }).format(n || 0);

  if (loading && !data) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center gap-4 min-h-[400px]">
        <div className="w-10 h-10 border-4 border-orange-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-[10px] font-black uppercase tracking-[3px] text-gray-400">
          Recalculating Balance Sheet...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-10">
        <div className="bg-red-50 border-l-4 border-red-600 p-6 rounded-r-xl shadow-sm">
          <h3 className="text-red-800 font-bold uppercase text-sm">Error Loading Statement</h3>
          <p className="text-red-600 text-[12px] mt-1 font-medium">{error}</p>
          <button
            onClick={fetchBalanceSheet}
            className="mt-4 px-5 py-2 bg-red-600 text-white text-[10px] font-black rounded-lg uppercase tracking-widest hover:bg-red-700 transition-all"
          >
            Retry Fetch
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  // Backend returns credit-normal accounts (liabilities, equity) as negatives.
  // The accounting equation  Assets = Liabilities + Equity  must be checked using
  // absolute values so the sign convention from the API doesn't break the comparison.
  const absAssets      = Math.abs(data.totalAssets);
  const absLiabilities = Math.abs(data.totalLiabilities);
  const absEquity      = Math.abs(data.totalEquity);
  const absLiabEquity  = absLiabilities + absEquity;
  const balanceDiff    = Math.abs(absAssets - absLiabEquity);
  const isBalanced     = balanceDiff < 0.01;

  const Section = ({ title, icon: Icon, color, items, total, totalLabel, netIncome }) => (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col h-full custom-scrollbar">
      <div className="flex items-center gap-2 px-5 py-3 bg-black">
        <Icon size={14} className={color} />
        <span className="text-[11px] font-black uppercase tracking-[3px] text-white">{title}</span>
      </div>
      
      <div className="overflow-y-auto custom-scrollbar" style={{ maxHeight: '480px' }}>
        <table className="w-full border-collapse">
          <thead className="sticky top-0 bg-gray-50 z-10">
            <tr className="border-b border-gray-100">
              <th className="py-3 px-5 text-[11px] font-black uppercase text-gray-400 text-left">Code</th>
              <th className="py-3 px-5 text-[11px] font-black uppercase text-gray-400 text-left">Account Name</th>
              <th className="py-3 px-5 text-[11px] font-black uppercase text-gray-400 text-right">Balance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {items?.map((item, i) => (
              <tr key={i} className="hover:bg-gray-50/80 transition-colors">
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

      {/* FIX: show absolute value of section total with ₱ symbol */}
      <div className="mt-auto bg-gray-50 border-t border-gray-100 px-5 py-3 flex justify-between items-center">
        <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest">{totalLabel}</span>
        <span className={`text-lg font-black ${color}`}>
          ₱ {fmt(Math.abs(total))}
        </span>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-5 bg-[#F3F4F6] min-h-full custom-scrollbar">
      
      {/* HEADER */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-black rounded-2xl flex items-center justify-center shadow-xl shadow-gray-200">
            <BarChart3 size={24} className="text-orange-500" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-black tracking-tighter leading-none">
              Balance <span className="text-orange-600 italic">Sheet</span>
            </h1>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-[3px] mt-1">
              Statement of Financial Position
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 px-5 py-2.5 bg-white border border-gray-200 text-[11px] font-black text-black rounded-xl hover:bg-gray-50 uppercase tracking-widest shadow-sm transition-all active:scale-95">
            <Download size={14} /> Export CSV
          </button>
          <button
            onClick={fetchBalanceSheet}
            className="w-11 h-11 bg-orange-600 text-white rounded-xl hover:bg-orange-700 flex items-center justify-center transition-all shadow-lg shadow-orange-100 active:scale-95"
          >
            <RefreshCcw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* TOOLBAR */}
      <div className="bg-white border border-gray-100 rounded-2xl px-4 py-3 flex items-center gap-3 flex-wrap shadow-sm">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-black text-gray-400 uppercase tracking-[2px]">From</span>
          <input
            type="date"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
            className="px-3 py-2 border border-gray-100 rounded-xl bg-gray-50 text-[11px] font-bold text-black outline-none focus:border-orange-500 focus:bg-white transition-all"
          />
          <span className="text-[10px] font-black text-gray-400 uppercase tracking-[2px]">To</span>
          <input
            type="date"
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
            className="px-3 py-2 border border-gray-100 rounded-xl bg-gray-50 text-[11px] font-bold text-black outline-none focus:border-orange-500 focus:bg-white transition-all"
          />
        </div>

        <div className="hidden md:block w-px h-7 bg-gray-100" />

        <button
          onClick={() => { setStartDate(''); setEndDate(''); }}
          className="px-4 py-2 border border-gray-900 rounded-xl text-[10px] font-black text-gray-900 uppercase tracking-widest hover:border-orange-500 hover:text-orange-600 transition-all bg-white cursor-pointer"
        >
          Reset
        </button>
        <button
          onClick={() => {
            const t = new Date().toISOString().split('T')[0];
            setStartDate(t);
            setEndDate(t);
          }}
          className="px-4 py-2 bg-black rounded-xl text-[10px] font-black text-white uppercase tracking-widest hover:bg-orange-600 cursor-pointer"
        >
          Today
        </button>
      </div>

      {/* THREE-COLUMN FINANCIALS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
        <Section
          title="Assets"
          icon={Briefcase}
          color="text-blue-500"
          items={data.assets}
          total={data.totalAssets}
          totalLabel="Sum of Assets"
        />
        <Section
          title="Liabilities"
          icon={Layers}
          color="text-orange-500"
          items={data.liabilities}
          total={data.totalLiabilities}
          totalLabel="Sum of Liabilities"
        />
        <Section
          title="Equity"
          icon={PieChart}
          color="text-green-500"
          items={data.equity}
          total={data.totalEquity}
          totalLabel="Sum of Equity"
        />
      </div>

      {/* BALANCE VERIFICATION */}
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3 bg-black">
          <BarChart3 size={14} className="text-orange-500" />
          <span className="text-[11px] font-black uppercase tracking-[3px] text-white">
            Balance Verification
          </span>
        </div>
        <div className="p-6">
          <div className="space-y-4">

            {/* FIX: all values now show absolute amounts with ₱ symbol */}
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-600">Total Assets:</span>
              <span className="text-lg font-semibold text-blue-600">
                ₱ {fmt(absAssets)}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-600">Total Liabilities:</span>
              <span className="text-lg font-semibold text-orange-600">
                ₱ {fmt(absLiabilities)}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-600">Total Equity:</span>
              <span className="text-lg font-semibold text-green-600">
                ₱ {fmt(absEquity)}
              </span>
            </div>

            <div className="border-t border-gray-200 pt-4">
              <div className="flex justify-between items-center">
                <span className="text-base font-semibold text-gray-900">Liabilities + Equity:</span>
                <span className="text-xl font-bold text-gray-900">
                  ₱ {fmt(absLiabEquity)}
                </span>
              </div>
            </div>

            {data.netIncome !== undefined && (
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-600">Current Period Net Income:</span>
                <span className={`text-lg font-semibold ${data.netIncome >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  ₱ {fmt(data.netIncome)}
                </span>
              </div>
            )}

            {/* FIX: isBalanced now correctly compares Assets vs |Liabilities| + |Equity| */}
            <div className={`mt-4 p-4 rounded-lg ${
              isBalanced
                ? 'bg-green-50 border border-green-200'
                : 'bg-red-50 border border-red-200'
            }`}>
              <div className="flex items-center gap-3">
                {isBalanced
                  ? <ShieldCheck size={20} className="text-green-700" />
                  : <ShieldAlert size={20} className="text-red-700" />
                }
                <span className={`text-lg font-bold ${
                  isBalanced ? 'text-green-800' : 'text-red-800'
                }`}>
                  {isBalanced ? '✓ BALANCED' : '✗ OUT OF BALANCE'}
                </span>
                <span className={`text-sm ${
                  isBalanced ? 'text-green-700' : 'text-red-700'
                }`}>
                  Difference: ₱ {fmt(balanceDiff)}
                </span>
              </div>
            </div>

          </div>
        </div>
      </div>

    </div>
  );
}