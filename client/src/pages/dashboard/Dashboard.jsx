import React, { useState, useEffect, useRef } from 'react';

import { motion, AnimatePresence } from 'framer-motion';

import {

  TrendingUp, TrendingDown, DollarSign, AlertTriangle,

  Wallet, Receipt, ShoppingCart, BarChart3, Users,

  Settings, ArrowUpRight, ArrowDownRight, Activity,

  PieChart, Calendar, RefreshCw, CheckCircle2, XCircle,

  AlertCircle, Clock, ChevronRight, Zap, Target, CreditCard

} from 'lucide-react';

import RouteProtection from '../../components/RouteProtection';



/* ─── Skeleton shimmer ───────────────────────────────────────────── */

function Skeleton({ className = '' }) {

  return (

    <div className={`rounded-lg bg-white/10 relative overflow-hidden ${className}`} style={{ minHeight: 12 }}>

      <div className="absolute inset-0" style={{

        background: 'linear-gradient(90deg,transparent 0%,rgba(255,255,255,0.15) 50%,transparent 100%)',

        animation: 'shimmer 1.4s infinite',

      }} />

    </div>

  );

}



/* ─── Animated counter ───────────────────────────────────────────── */

function AnimatedNumber({ value, prefix = '₱', decimals = 2 }) {

  const [display, setDisplay] = useState(0);

  const start = useRef(0);

  const raf = useRef(null);



  useEffect(() => {

    const target = parseFloat(value) || 0;

    const duration = 900;

    const begin = performance.now();

    const from = start.current;

    const run = (now) => {

      const t = Math.min((now - begin) / duration, 1);

      const ease = 1 - Math.pow(1 - t, 3);

      setDisplay(from + (target - from) * ease);

      if (t < 1) raf.current = requestAnimationFrame(run);

      else { start.current = target; setDisplay(target); }

    };

    raf.current = requestAnimationFrame(run);

    return () => cancelAnimationFrame(raf.current);

  }, [value]);



  const fmt = (n) =>

    new Intl.NumberFormat('en-PH', {

      minimumFractionDigits: decimals,

      maximumFractionDigits: decimals,

    }).format(n);



  return <span>{prefix}{fmt(display)}</span>;

}



const fadeUp = {

  hidden: { opacity: 0, y: 20 },

  show: (i = 0) => ({

    opacity: 1, y: 0,

    transition: { duration: 0.45, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] },

  }),

};



export default function Dashboard() {

  return (

    <RouteProtection routeName="dashboard">

      <DashboardContent />

    </RouteProtection>

  );

}



function DashboardContent() {

  const [data, setData] = useState(null);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState('');

  const [period, setPeriod] = useState('current');

  const [startDate, setStartDate] = useState('');

  const [endDate, setEndDate] = useState('');

  const [refreshing, setRefreshing] = useState(false);



  useEffect(() => { fetchDashboardData(); }, [period, startDate, endDate]);



  const fetchDashboardData = async (isRefresh = false) => {

    try {

      isRefresh ? setRefreshing(true) : setLoading(true);

      setError('');

      const token = localStorage.getItem('token');

      const now = new Date();

      let queryStartDate, queryEndDate;



      if (startDate && endDate) {

        queryStartDate = startDate;

        queryEndDate = endDate;

      } else if (period === 'current') {

        queryStartDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];

        queryEndDate   = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

      } else {

        queryStartDate = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];

        queryEndDate   = now.toISOString().split('T')[0];

      }



      const params = new URLSearchParams({ start_date: queryStartDate, end_date: queryEndDate });

      const res = await fetch(

        `${import.meta.env.VITE_SERVER_LINK}/dashboard?${params}`,

        { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } }

      );

      if (!res.ok) throw new Error(`Server responded with ${res.status}`);

      const result = await res.json();

      if (result.success) setData(result.data);

      else setError(result.message || 'Failed to fetch dashboard data');

    } catch (err) {

      setError('Connection Error: ' + err.message);

    } finally {

      setLoading(false);

      setRefreshing(false);

    }

  };



  if (loading && !data) return <DashboardSkeleton />;



  if (error) return (

    <div className="flex items-center justify-center min-h-screen bg-[#0a0a0f] p-10">

      <div className="bg-[#111118] border border-red-900/40 rounded-2xl p-8 shadow-2xl max-w-md w-full text-center">

        <div className="w-14 h-14 bg-red-950/60 rounded-2xl flex items-center justify-center mx-auto mb-4">

          <XCircle className="text-red-500" size={28} />

        </div>

        <h3 className="text-white font-black uppercase tracking-widest text-xs mb-2">Connection Error</h3>

        <p className="text-gray-500 text-sm mb-5">{error}</p>

        <button onClick={() => fetchDashboardData()}

          className="inline-flex items-center gap-2 px-5 py-2.5 bg-red-600 text-white text-xs font-bold rounded-xl hover:bg-red-500 transition-colors">

          <RefreshCw size={13} /> Retry

        </button>

      </div>

    </div>

  );



  const fh  = data?.financialHealth    || {};

  const cf  = data?.cashFlowActivity   || {};

  const tv  = data?.transactionVolume  || {};

  const al  = data?.alerts             || {};

  const tr  = data?.trends             || {};



  const maxCF  = Math.max(cf.totalCollections || 1, cf.totalDisbursements || 1);

  const colPct = ((cf.totalCollections   || 0) / maxCF) * 100;

  const disPct = ((cf.totalDisbursements || 0) / maxCF) * 100;



  const totalTxn = (tv.salesCount || 0) + (tv.purchaseCount || 0) +

                   (tv.disbursementCount || 0) + (tv.adjustmentCount || 0) || 1;

  const donutData = [

    { label: 'Sales & Collections',   count: tv.salesCount        || 0, color: '#22c55e' },

    { label: 'Purchases & Payments',  count: tv.purchaseCount     || 0, color: '#3b82f6' },

    { label: 'Disbursements',         count: tv.disbursementCount || 0, color: '#ef4444' },

    { label: 'Adjustments',           count: tv.adjustmentCount   || 0, color: '#f59e0b' },

  ];



  const revenueExpenses = (tr.revenueVsExpenses || []).slice(-6);

  const cashTrend       = tr.cashFlowTrend || [];

  const collections     = cashTrend.filter(t => t.type === 'collection').slice(-6);

  const disbursements   = cashTrend.filter(t => t.type === 'disbursement').slice(-6);



  const isHealthy = (fh.netIncome || 0) >= 0;



  return (

    <>

      <style>{`

        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Syne:wght@700;800&family=DM+Sans:wght@400;500;600&display=swap');

        @keyframes shimmer { 0% { transform:translateX(-100%); } 100% { transform:translateX(200%); } }

        @keyframes pulse-ring { 0%,100% { opacity:1; transform:scale(1); } 50% { opacity:.4; transform:scale(1.4); } }

        @keyframes scanline { 0% { top:-10%; } 100% { top:110%; } }

        @keyframes ticker { 0% { transform:translateX(0); } 100% { transform:translateX(-50%); } }

        .live-ring { animation: pulse-ring 2s ease-in-out infinite; }

        .scanline::after {

          content:''; position:absolute; left:0; right:0; height:1px;

          background:linear-gradient(90deg,transparent,rgba(239,68,68,0.3),transparent);

          animation: scanline 3s linear infinite;

        }

        * { font-family: 'DM Sans', sans-serif; }

        .font-display { font-family: 'Syne', sans-serif; }

        .font-mono { font-family: 'DM Mono', monospace; }

        ::-webkit-scrollbar { width:4px; }

        ::-webkit-scrollbar-track { background:#f1f1f1; }

        ::-webkit-scrollbar-thumb { background:#d1d5db; border-radius:999px; }

        .soft-card {

          box-shadow:

            0 10px 30px rgba(0,0,0,0.06),

            0 2px 8px rgba(0,0,0,0.03);

        }

      `}</style>



      <div className="min-h-screen bg-[#f5f5f7] space-y-5"
>



        {/* ── TOP HEADER BAR ─────────────────────────────────── */}

        <motion.div variants={fadeUp} initial="hidden" animate="show" custom={0}

          className="flex items-center justify-between gap-3 bg-white border border-gray-200 rounded-3xl px-5 py-4 shadow-[0_10px_30px_rgba(0,0,0,0.06)] relative overflow-hidden">

          <div className="absolute inset-0 opacity-30"

            style={{ backgroundImage: 'radial-gradient(ellipse 60% 100% at 0% 50%, rgba(220,38,38,0.06), transparent)' }} />



          {/* Left: brand */}

          <div className="flex items-center gap-3 relative z-10">

            <div className="w-10 h-10 bg-gradient-to-br from-red-600 to-red-700 rounded-2xl flex items-center justify-center shadow-lg shadow-red-300 flex-shrink-0">

              <Zap size={16} className="text-white" fill="white" />

            </div>

            <div>

              <div className="font-display text-[#111111] text-lg font-black tracking-tight">Financial Dashboard</div>

              <div className="text-[10px] text-gray-500 uppercase tracking-[0.18em] mt-0.5 font-mono">Real-time Overview</div>

            </div>

            <div className="flex items-center gap-1.5 ml-1 bg-green-50 border border-green-200 rounded-full px-2.5 py-1">

              <div className="relative w-1.5 h-1.5">

                <div className="w-1.5 h-1.5 rounded-full bg-green-500 absolute live-ring" />

                <div className="w-1.5 h-1.5 rounded-full bg-green-500 relative" />

              </div>

              <span className="text-[9px] text-green-600 font-bold uppercase tracking-widest font-mono">Live</span>

            </div>

          </div>



          {/* Right: controls */}

          <div className="flex items-center gap-2 relative z-10">

            <div className="flex items-center gap-1.5 bg-[#fafafa] border border-gray-300 rounded-2xl px-3 py-2">

              <Calendar size={11} className="text-red-600 flex-shrink-0" />

              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}

                className="text-[12px] font-semibold text-[#111] outline-none bg-transparent cursor-pointer w-28" />

              <span className="text-[9px] text-gray-400">–</span>

              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}

                className="text-[12px] font-semibold text-[#111] outline-none bg-transparent cursor-pointer w-28" />

            </div>

            <select value={period} onChange={e => { setPeriod(e.target.value); setStartDate(''); setEndDate(''); }}

              className="text-[12px] font-semibold text-[#111] outline-none bg-white border border-gray-300 rounded-xl px-3 py-2 cursor-pointer">

              <option value="" className="bg-white">Custom</option>

              <option value="current" className="bg-white">This Month</option>

              <option value="ytd" className="bg-white">Year to Date</option>

            </select>

            <button onClick={() => fetchDashboardData(true)}

              className="w-9 h-9 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-center text-gray-400 hover:text-red-600 hover:border-red-200 transition-all">

              <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />

            </button>

          </div>

        </motion.div>



        {/* ── TICKER / STATUS BAR ─────────────────────────────── */}

        <motion.div variants={fadeUp} initial="hidden" animate="show" custom={0.5}

          className="bg-[#111111] border border-black/10 rounded-2xl overflow-hidden h-10 flex items-center gap-3 px-4 shadow-lg">

          <div className="bg-red-600 rounded-lg px-3 py-1 flex-shrink-0">

            <span className="text-[11px] text-white font-black uppercase tracking-widest font-mono">LIVE DATA</span>

          </div>

          <div className="overflow-hidden flex-1 relative">

            <div className="flex gap-8 whitespace-nowrap" style={{ animation: 'ticker 20s linear infinite' }}>

              {[

                `Net Income: ₱${fmt2(fh.netIncome)}`,

                `Cash Position: ₱${fmt2(fh.totalCashPosition)}`,

                `AR: ₱${fmt2(fh.totalReceivables)}`,

                `AP: ₱${fmt2(fh.totalPayables)}`,

                `Collections: ₱${fmt2(cf.totalCollections)}`,

                `Disbursements: ₱${fmt2(cf.totalDisbursements)}`,

                `Total Txns: ${totalTxn}`,

                `Net Income: ₱${fmt2(fh.netIncome)}`,

                `Cash Position: ₱${fmt2(fh.totalCashPosition)}`,

                `AR: ₱${fmt2(fh.totalReceivables)}`,

                `AP: ₱${fmt2(fh.totalPayables)}`,

              ].map((item, i) => (

                <span key={i} className="text-[11px] text-gray-300 font-mono">

                  <span className="text-red-500 mr-1">◆</span>{item}

                </span>

              ))}

            </div>

          </div>

        </motion.div>



        {/* ── SECTION: FINANCIAL HEALTH KPIs ─────────────────── */}

        <Label icon={<Activity size={11} />} text="Financial Health" delay={1} />

        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">

          {[

            {

              title: 'Net Income', value: fh.netIncome,

              sub: fh.netIncome >= 0 ? '+12% vs last period' : 'Loss this period',

              up: fh.netIncome >= 0, icon: <TrendingUp size={14} />,

              variant: fh.netIncome >= 0 ? 'green' : 'red',

            },

            {

              title: 'Cash Position', value: fh.totalCashPosition,

              sub: fh.totalCashPosition < 1000 ? 'Critical — review now' : 'Banks + petty + COH',

              warn: fh.totalCashPosition < 1000, icon: <Wallet size={14} />,

              variant: 'gold',

            },

            {

              title: 'Receivables (AR)', value: fh.totalReceivables,

              sub: 'Customers owe you', icon: <Receipt size={14} />,

              variant: 'blue',

            },

            {

              title: 'Payables (AP)', value: fh.totalPayables,

              sub: 'Owed to vendors', icon: <ShoppingCart size={14} />,

              variant: 'orange',

            },

          ].map((card, i) => (

            <KPICard key={card.title} {...card} delay={i + 2} />

          ))}

        </div>



        {/* ── CASH POSITION BREAKDOWN + CASH FLOW ─────────────── */}

        <Label icon={<Wallet size={11} />} text="Cash Breakdown + Flow" delay={6} />

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">



          {/* Cash breakdown — takes 1 col */}

          <motion.div variants={fadeUp} initial="hidden" animate="show" custom={7}

            className="lg:col-span-1 bg-white border border-gray-200 rounded-3xl p-4 relative overflow-hidden shadow-[0_10px_30px_rgba(0,0,0,0.05)]">

            <div className="absolute top-0 right-0 w-32 h-32 opacity-10"

              style={{ background: 'radial-gradient(circle, #ca8a04, transparent)' }} />

            <div className="flex items-center justify-between mb-4">

              <span className="text-[10px] font-black text-gray-500 uppercase tracking-[0.18em] font-mono">Cash Breakdown</span>

              <span className="text-[9px] text-yellow-600 bg-yellow-50 border border-yellow-200 rounded-full px-2 py-0.5 font-mono font-bold uppercase tracking-wider">Pie Chart</span>

            </div>

            <CashBreakdownPieChart data={fh.cashBreakdown || {}} />

          </motion.div>



          {/* Cash flow bars — takes 4 cols */}

          <div className="lg:col-span-4 grid grid-cols-1 sm:grid-cols-3 gap-4 p-4">

            <CashFlowBar title="Collections" value={cf.totalCollections} pct={colPct} type="in" delay={12}

              sub={`${Math.round(colPct)}% relative`} />

            <CashFlowBar title="Disbursements" value={cf.totalDisbursements} pct={disPct} type="out" delay={13}

              sub={`${Math.round(disPct)}% relative`} />

            <NetCashCard value={cf.netCashMovement} inflow={cf.totalCollections} outflow={cf.totalDisbursements} delay={14} />

          </div>

        </div>



        {/* ── TRANSACTION VOLUME + DONUT ───────────────────────── */}

        <Label icon={<PieChart size={11} />} text="Transaction Volume" delay={15} />

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">



          {/* Donut */}

          <motion.div variants={fadeUp} initial="hidden" animate="show" custom={16}

            className="bg-white border border-gray-200 rounded-3xl p-4 flex flex-col shadow-[0_10px_30px_rgba(0,0,0,0.05)]">

            <div className="flex items-center justify-between mb-4">

              <span className="text-[10px] font-black text-gray-500 uppercase tracking-[0.18em] font-mono">Breakdown</span>

              <span className="text-[9px] text-blue-600 bg-blue-50 border border-blue-200 rounded-full px-2 py-0.5 font-mono font-bold uppercase tracking-wider">Donut</span>

            </div>

            <div className="flex items-center gap-4 flex-1">

              <DonutChart data={donutData} total={totalTxn} />

              <div className="flex-1 space-y-2">

                {donutData.map(d => (

                  <div key={d.label} className="flex items-center justify-between gap-2">

                    <div className="flex items-center gap-1.5">

                      <div className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: d.color }} />

                      <span className="text-[11px] text-gray-500 leading-tight">{d.label}</span>

                    </div>

                    <span className="text-sm font-black text-[#111111] font-mono">{d.count}</span>

                  </div>

                ))}

              </div>

            </div>

          </motion.div>



          {/* Transaction stat cards */}

          {[

            { title: 'Sales',      value: tv.salesCount,        icon: <Receipt size={14} />,      color: '#22c55e', bg: 'rgba(34,197,94,0.08)',  border: 'rgba(34,197,94,0.15)' },

            { title: 'Purchases',  value: tv.purchaseCount,     icon: <ShoppingCart size={14} />, color: '#3b82f6', bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.15)' },

            { title: 'Disburse.',  value: tv.disbursementCount, icon: <ArrowDownRight size={14}/>,color: '#ef4444', bg: 'rgba(239,68,68,0.08)',   border: 'rgba(239,68,68,0.15)' },

          ].map((s, i) => (

            <motion.div key={s.title} variants={fadeUp} initial="hidden" animate="show" custom={17 + i}

              className="rounded-3xl p-4 border flex flex-col justify-between shadow-[0_10px_30px_rgba(0,0,0,0.05)]"

              style={{ background: s.bg, borderColor: s.border }}>

              <div className="flex items-center justify-between mb-3">

                <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: s.color + '20', color: s.color }}>

                  {s.icon}

                </div>

                <span className="text-[11px] text-gray-600 font-mono uppercase tracking-wider">This period</span>

              </div>

              <div>

                <div className="text-[11px] text-gray-500 uppercase tracking-widest font-mono mb-1">{s.title}</div>

                <div className="text-4xl font-black font-display leading-none" style={{ color: s.color }}>{s.value || 0}</div>

                <div className="text-[11px] text-gray-600 mt-1 font-mono">transactions</div>

              </div>

            </motion.div>

          ))}

        </div>



        {/* ── ALERTS ──────────────────────────────────────────── */}

        <Label icon={<AlertTriangle size={11} />} text="Alerts & Red Flags" delay={21} />

        <motion.div variants={fadeUp} initial="hidden" animate="show" custom={22}

          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">

          <AlertTile type="error"   title="Trial Balance"      detail={`Diff: ₱${fmt2(al.trialBalance?.difference)}`}     active={!al.trialBalance?.balanced} />

          <AlertTile type="error"   title="Balance Sheet"      detail={`Gap: ₱${fmt2(al.balanceSheet?.difference)}`}       active={!al.balanceSheet?.balanced} />

          <AlertTile type="warning" title="Overdue AR"         detail={`${al.overdueReceivables?.count||0} invoices · ₱${fmt2(al.overdueReceivables?.amount)}`} active={(al.overdueReceivables?.count||0)>0} />

          <AlertTile type="info"    title="System Status"      detail="All systems operational"                             active={true} forceGood />

        </motion.div>



        {/* ── TRENDS ──────────────────────────────────────────── */}

        <Label icon={<BarChart3 size={11} />} text="Period Trends" delay={23} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">



          {/* Revenue vs Expenses grouped bar */}

          <motion.div variants={fadeUp} initial="hidden" animate="show" custom={24}

            className="bg-white border border-gray-200 rounded-3xl p-4 shadow-[0_10px_30px_rgba(0,0,0,0.05)]">

            <div className="flex items-center justify-between mb-3">

              <div>

                <div className="text-[10px] font-black text-gray-500 uppercase tracking-[0.18em] font-mono">Revenue vs Expenses</div>

                <div className="text-[9px] text-gray-600 mt-0.5">Monthly comparison</div>

              </div>

              <div className="flex items-center gap-3">

                <Legend color="#3b82f6" label="Revenue" />

                <Legend color="#ef4444" label="Expenses" />

              </div>

            </div>

            <GroupedBarChart data={revenueExpenses} />

          </motion.div>



          {/* Cash In vs Out line */}

          <motion.div variants={fadeUp} initial="hidden" animate="show" custom={25}

            className="bg-white border border-gray-200 rounded-3xl p-4 shadow-[0_10px_30px_rgba(0,0,0,0.05)]">

            <div className="flex items-center justify-between mb-3">

              <div>

                <div className="text-[10px] font-black text-gray-500 uppercase tracking-[0.18em] font-mono">Cash In vs Out</div>

                <div className="text-[9px] text-gray-600 mt-0.5">Trend line</div>

              </div>

              <div className="flex items-center gap-3">

                <Legend color="#22c55e" label="In" />

                <Legend color="#ef4444" label="Out" dashed />

              </div>

            </div>

            <DualLineChart collections={collections} disbursements={disbursements} />

          </motion.div>



          {/* Radial / summary panel */}

          <motion.div variants={fadeUp} initial="hidden" animate="show" custom={26}

            className="bg-[#111111] border border-black/10 rounded-3xl p-4 relative overflow-hidden shadow-[0_15px_40px_rgba(0,0,0,0.18)]">

            <div className="absolute inset-0 opacity-20"

              style={{ backgroundImage: isHealthy

                ? 'radial-gradient(ellipse 80% 80% at 50% 100%, rgba(34,197,94,0.3), transparent)'

                : 'radial-gradient(ellipse 80% 80% at 50% 100%, rgba(239,68,68,0.3), transparent)' }} />

            <div className="relative z-10 flex flex-col h-full">

              <div className="text-[10px] font-black text-gray-300 uppercase tracking-[0.18em] font-mono mb-4">Health Score</div>

              <div className="flex-1 flex flex-col items-center justify-center py-2">

                <RadialGauge value={isHealthy ? 78 : 32} color={isHealthy ? '#22c55e' : '#ef4444'} />

                <div className={`text-xs font-black uppercase tracking-widest mt-3 font-mono ${isHealthy ? 'text-green-400' : 'text-red-400'}`}>

                  {isHealthy ? 'Healthy' : 'At Risk'}

                </div>

              </div>

              <div className="border-t border-black/10 pt-3 grid grid-cols-2 gap-2">

                <div className="text-center">

                  <div className="text-[11px] text-gray-300 uppercase tracking-widest font-mono">AR/AP</div>

                  <div className="text-xs font-black text-white font-mono">

                    {fh.totalPayables ? ((fh.totalReceivables||0)/(fh.totalPayables||1)).toFixed(2) : '—'}x

                  </div>

                </div>

                <div className="text-center">

                  <div className="text-[11px] text-gray-300 uppercase tracking-widest font-mono">Txns</div>

                  <div className="text-sm font-black text-white font-mono">{totalTxn}</div>

                </div>

              </div>

            </div>

          </motion.div>

        </div>



        {/* ── ADJUSTMENTS COUNT (bottom ribbon) ────────────────── */}

        <motion.div variants={fadeUp} initial="hidden" animate="show" custom={27}

          className="bg-[#111111] border border-black/10 rounded-3xl px-5 py-4 flex items-center justify-between shadow-[0_15px_40px_rgba(0,0,0,0.18)]">

          <div className="flex items-center gap-3">

            <div className="w-8 h-8 bg-yellow-950/60 border border-yellow-900/40 rounded-xl flex items-center justify-center">

              <Settings size={14} className="text-yellow-500" />

            </div>

            <div>

              <div className="text-[11px] font-black text-gray-300 uppercase tracking-[0.18em] font-mono">Adjustments Posted</div>

              <div className="text-[11px] text-gray-400">Journal entries & corrections this period</div>

            </div>

          </div>

          <div className="flex items-center gap-3">

            <div className="text-3xl font-black font-display text-yellow-400">{tv.adjustmentCount || 0}</div>

            <div className="text-[11px] text-gray-400 font-mono uppercase tracking-wider">entries</div>

          </div>

        </motion.div>



      </div>

    </>

  );

}



/* ═══════════════════════════════════════════════════════════════════

   SUB-COMPONENTS

══════════════════════════════════════════════════════════════════════ */



function Label({ icon, text, delay }) {

  return (

    <motion.div

      variants={fadeUp}

      initial="hidden"

      animate="show"

      custom={delay}

      className="flex items-center gap-3"

    >

      <div className="w-7 h-7 rounded-xl bg-red-600 text-white flex items-center justify-center shadow-md">

        {icon}

      </div>

      <span className="text-[11px] font-black text-[#111] uppercase tracking-[0.18em] font-mono">{text}</span>

      <div

        className="flex-1 h-[2px] rounded-full"

        style={{

          background: 'linear-gradient(90deg, rgba(220,38,38,0.25), transparent)',

        }}

      />

    </motion.div>

  );

}



function Legend({ color, label, dashed }) {

  return (

    <div className="flex items-center gap-1">

      <div className="w-4 h-1.5 rounded-sm" style={{

        background: dashed ? 'transparent' : color,

        border: dashed ? `1.5px dashed ${color}` : 'none',

      }} />

      <span className="text-[9px] text-gray-500 font-mono">{label}</span>

    </div>

  );

}



const VARIANTS = {

  green: {

    border: 'rgba(34,197,94,0.3)',

    bg: '#22c55e',

    accent: '#ffffff',

    glow: 'rgba(34,197,94,0.25)',

  },



  blue: {

    border: 'rgba(59,130,246,0.3)',

    bg: '#3b82f6',

    accent: '#ffffff',

    glow: 'rgba(59,130,246,0.25)',

  },



  red: {

    border: 'rgba(239,68,68,0.3)',

    bg: '#ef4444',

    accent: '#ffffff',

    glow: 'rgba(239,68,68,0.25)',

  },



  gold: {

    border: 'rgba(202,138,4,0.18)',

    bg: '#ffffff',

    accent: '#ca8a04',

    glow: 'rgba(202,138,4,0.15)',

  },



  orange: {

    border: 'rgba(251,146,60,0.3)',

    bg: '#fb923c',

    accent: '#ffffff',

    glow: 'rgba(251,146,60,0.25)',

  },

};



function KPICard({ title, value, sub, up, warn, icon, variant = 'blue', delay }) {

  const v = VARIANTS[variant];

  const darkCard = variant === 'red';

  const coloredCard = ['green', 'blue', 'orange'].includes(variant);



  return (

    <motion.div

      variants={fadeUp} initial="hidden" animate="show" custom={delay}

      whileHover={{ y: -4, scale: 1.01, transition: { duration: 0.2 } }}

      className="rounded-3xl p-5 border relative overflow-hidden cursor-default shadow-[0_10px_30px_rgba(0,0,0,0.06)]"

      style={{ background: v.bg, borderColor: v.border }}

    >

      <div

        className="absolute inset-0 opacity-100"

        style={{

          background: `radial-gradient(circle at top right, ${v.glow}, transparent 40%)`,

        }}

      />



      <div className="relative z-10">

        <div className="flex items-center justify-between mb-5">

          <div

            className="w-11 h-11 rounded-2xl flex items-center justify-center"

            style={{

              background: darkCard

                ? ' rgba(0, 0, 0, 0.35)'

                : coloredCard ? 'rgba(0,0,0,0.35)' : v.accent + '15',

              color: v.accent,

            }}

          >

            {icon}

          </div>



          {warn && (

            <AlertTriangle

              size={15}

              className="text-yellow-500"

            />

          )}

        </div>



        <div

          className={`text-[11px] uppercase tracking-[0.18em] font-mono mb-2 ${

            title === 'Net Income' ? 'text-white' : (darkCard ? 'text-gray-300' : coloredCard ? 'text-white' : 'text-gray-500')

          }`}

        >

          {title}

        </div>



        <div

          className="text-3xl font-black font-display leading-none mb-3"

          style={{ color: title === 'Net Income' ? '#ffffff' : v.accent }}

        >

          <AnimatedNumber value={value} />

        </div>



        <div

          className={`text-[11px] leading-relaxed font-medium ${

            darkCard ? 'text-gray-300' : coloredCard ? 'text-white' : 'text-gray-600'

          }`}

        >

          {sub}

        </div>

      </div>

    </motion.div>

  );

}



function CashFlowBar({ title, value, pct, type, sub, delay }) {

  const isIn = type === 'in';

  const color = isIn ? '#22c55e' : '#ef4444';

  const bg    = isIn ? 'rgba(34,197,94,0.06)' : 'rgba(239,68,68,0.06)';

  const border = isIn ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)';

  return (

    <motion.div variants={fadeUp} initial="hidden" animate="show" custom={delay}

      className="rounded-2xl p-4 border" style={{ background: bg, borderColor: border }}>

      <div className="text-[12px] text-gray-500 uppercase tracking-[0.18em] font-mono mb-2">{title}</div>

      <div className="text-2xl font-black font-display mb-1" style={{ color }}>

        <AnimatedNumber value={value} />

      </div>

      <div className="text-[12px] text-gray-600 font-mono mb-3">{sub}</div>

      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: color + '20' }}>

        <motion.div className="h-full rounded-full" style={{ background: color }}

          initial={{ width: 0 }} animate={{ width: `${Math.min(pct, 100)}%` }}

          transition={{ duration: 1.2, delay: delay * 0.06 + 0.4, ease: [0.22, 1, 0.36, 1] }} />

      </div>

      <div className="flex justify-between mt-1">

        <span className="text-[12px] text-gray-600 font-mono">0%</span>

        <span className="text-[12px] font-black font-mono" style={{ color }}>{Math.round(pct)}%</span>

        <span className="text-[12px] text-gray-600 font-mono">100%</span>

      </div>

    </motion.div>

  );

}



function NetCashCard({ value, inflow, outflow, delay }) {

  const isPos = (value || 0) >= 0;

  const color = isPos ? '#22c55e' : '#ef4444';

  return (

    <motion.div variants={fadeUp} initial="hidden" animate="show" custom={delay}

      className="rounded-2xl p-4 border relative overflow-hidden"

      style={{ background: isPos ? 'rgba(34,197,94,0.06)' : 'rgba(239,68,68,0.06)', borderColor: isPos ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)' }}>

      <div className="absolute bottom-0 left-0 right-0 h-16 opacity-20"

        style={{ background: `linear-gradient(0deg, ${color}, transparent)` }} />

      <div className="relative z-10">

        <div className="text-[12px] text-gray-500 uppercase tracking-[0.18em] font-mono mb-2">Net Movement</div>

        <div className="text-2xl font-black font-display mb-1" style={{ color }}>

          <AnimatedNumber value={value} />

        </div>

        <div className={`inline-flex items-center gap-1 text-[12px] font-bold rounded-full px-2 py-0.5 mb-3 font-mono`}

          style={{ background: color + '20', color }}>

          {isPos ? <ArrowUpRight size={9} /> : <ArrowDownRight size={9} />}

          {isPos ? 'Net inflow' : 'Net outflow'}

        </div>

        <div className="space-y-1.5 pt-2 border-t border-white/[0.06]">

          <div className="flex justify-between text-[12px]">

            <span className="text-gray-600 font-mono">In</span>

            <span className="font-black text-green-400 font-mono">₱{fmt2(inflow)}</span>

          </div>

          <div className="flex justify-between text-[12px]">

            <span className="text-gray-600 font-mono">Out</span>

            <span className="font-black text-red-400 font-mono">₱{fmt2(outflow)}</span>

          </div>

        </div>

      </div>

    </motion.div>

  );

}



function DonutChart({ data, total }) {

  const R = 38, cx = 44, cy = 44, stroke = 11;

  const circumference = 2 * Math.PI * R;

  let offset = 0;

  return (

    <div className="relative flex-shrink-0" style={{ width: 88, height: 88 }}>

      <svg width="88" height="88" viewBox="0 0 88 88">

        <circle cx={cx} cy={cy} r={R} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={stroke} />

        {data.map((d, i) => {

          const pct = d.count / total;

          const dash = pct * circumference;

          const seg = (

            <motion.circle key={d.label} cx={cx} cy={cy} r={R}

              fill="none" stroke={d.color} strokeWidth={stroke}

              strokeDasharray={`${dash} ${circumference - dash}`}

              strokeDashoffset={-offset * circumference}

              transform={`rotate(-90 ${cx} ${cy})`}

              initial={{ strokeDasharray: `0 ${circumference}` }}

              animate={{ strokeDasharray: `${dash} ${circumference - dash}` }}

              transition={{ duration: 1.1, delay: i * 0.15 + 0.3, ease: [0.22, 1, 0.36, 1] }}

            />

          );

          offset += pct;

          return seg;

        })}

      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center">

        <div className="text-sm font-black text-white font-display leading-none">{total}</div>

        <div className="text-[9px] text-gray-500 font-mono uppercase tracking-wider">total</div>

      </div>

    </div>

  );

}



function AlertTile({ type, title, detail, active, forceGood }) {

  const cfg = {

    error: {

      bg: '#111111',

      border: 'rgba(239,68,68,0.25)',

      text: '#ef4444',

      badgeBg: '#dc2626',

    },

    warning: {

      bg: '#ffffff',

      border: 'rgba(245,158,11,0.25)',

      text: '#d97706',

      badgeBg: '#f59e0b',

    },

    info: {

      bg: '#ffffff',

      border: 'rgba(34,197,94,0.2)',

      text: '#16a34a',

      badgeBg: '#16a34a',

    },

  };



  if (!active && !forceGood) {

    return (

      <div className="flex items-center gap-3 p-3 rounded-xl bg-white border border-gray-200">

        <CheckCircle2 size={13} className="text-gray-400 flex-shrink-0" />

        <div className="flex-1 min-w-0">

          <div className="text-[11px] font-bold text-gray-500 font-mono">{title}</div>

          <div className="text-[11px] text-gray-600">No issues</div>

        </div>

        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 font-black uppercase font-mono tracking-wider flex-shrink-0">OK</span>

      </div>

    );

  }



  const c = cfg[type];

  return (

    <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3 }}

      className="flex items-center gap-3 p-3 rounded-xl border shadow-sm"

      style={{ background: c.bg, borderColor: c.border }}>

      <div style={{ color: c.text }} className="flex-shrink-0">

        {type === 'error' ? <XCircle size={14} /> : type === 'warning' ? <AlertCircle size={14} /> : <CheckCircle2 size={14} />}

      </div>

      <div className="flex-1 min-w-0">

        <div className="text-[11px] font-black font-mono" style={{ color: c.text }}>{title}</div>

        <div className="text-[10px] opacity-70 mt-0.5 font-mono truncate" style={{ color: c.text }}>{detail}</div>

      </div>

      <span className="text-[10px] px-1.5 py-0.5 rounded-full text-white font-black uppercase tracking-wider font-mono flex-shrink-0"

        style={{ background: c.badgeBg }}>{type === 'error' ? 'CRITICAL' : type === 'warning' ? 'WARNING' : 'OK'}</span>

    </motion.div>

  );

}



function GroupedBarChart({ data }) {

  if (!data.length) return (

    <div className="h-28 flex items-center justify-center text-gray-600 text-[10px] font-mono">No data</div>

  );

  const allVals = data.flatMap(d => [Math.abs(d.revenue || 0), Math.abs(d.expenses || 0)]);

  const maxVal  = Math.max(...allVals, 1);



  return (

    <div className="flex items-end justify-between gap-1" style={{ height: 110 }}>

      {data.map((item, i) => {

        const rev = Math.abs(item.revenue  || 0);

        const exp = Math.abs(item.expenses || 0);

        const label = item.month?.slice(5) || `M${i + 1}`;

        return (

          <div key={i} className="flex-1 flex flex-col items-center gap-1">

            <div className="w-full flex gap-0.5 justify-center items-end" style={{ height: 90 }}>

              <motion.div className="flex-1 rounded-t-sm" style={{ background: '#3b82f6', maxWidth: 14 }}

                initial={{ height: 0 }} animate={{ height: `${(rev / maxVal) * 100}%` }}

                transition={{ duration: 0.8, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }} />

              <motion.div className="flex-1 rounded-t-sm" style={{ background: '#ef4444', maxWidth: 14 }}

                initial={{ height: 0 }} animate={{ height: `${(exp / maxVal) * 100}%` }}

                transition={{ duration: 0.8, delay: i * 0.08 + 0.05, ease: [0.22, 1, 0.36, 1] }} />

            </div>

            <span className="text-[10px] text-gray-600 font-mono">{label}</span>

          </div>

        );

      })}

    </div>

  );

}



function DualLineChart({ collections, disbursements }) {

  const all  = [...collections, ...disbursements].map(t => t.amount || 0);

  const maxV = Math.max(...all, 1);

  const W = 260, H = 85, pad = 8;



  const pts = (arr) =>

    arr.map((t, i) => {

      const x = arr.length < 2 ? W / 2 : pad + (i / (arr.length - 1)) * (W - pad * 2);

      const y = pad + (1 - (t.amount || 0) / maxV) * (H - pad * 2);

      return `${x},${y}`;

    }).join(' ');



  if (!collections.length && !disbursements.length) return (

    <div className="h-28 flex items-center justify-center text-gray-600 text-[10px] font-mono">No data</div>

  );



  return (

    <div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 100 }}>

        {[0, 0.33, 0.66, 1].map(t => {

          const y = pad + t * (H - pad * 2);

          return <line key={t} x1={pad} y1={y} x2={W - pad} y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />;

        })}

        {collections.length > 1 && (

          <motion.polyline fill="none" stroke="#22c55e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"

            points={pts(collections)}

            initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 1 }}

            transition={{ duration: 1.4, ease: 'easeInOut' }} />

        )}

        {disbursements.length > 1 && (

          <motion.polyline fill="none" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"

            strokeDasharray="4,2"

            points={pts(disbursements)}

            initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 1 }}

            transition={{ duration: 1.4, delay: 0.2, ease: 'easeInOut' }} />

        )}

        {collections.map((t, i) => {

          const arr = collections;

          const x = arr.length < 2 ? W / 2 : pad + (i / (arr.length - 1)) * (W - pad * 2);

          const y = pad + (1 - (t.amount || 0) / maxV) * (H - pad * 2);

          return <motion.circle key={i} cx={x} cy={y} r="2.5" fill="#22c55e"

            initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ duration: 0.3, delay: 1.2 + i * 0.05 }} />;

        })}

      </svg>

      <div className="flex justify-between px-1 mt-0.5">

        {['Jan','Feb','Mar','Apr','May','Jun'].slice(0, Math.max(collections.length, 3)).map((m, i) => (

          <span key={i} className="text-[10px] text-gray-600 font-mono">{m}</span>

        ))}

      </div>

    </div>

  );

}



/* Radial gauge SVG */

function RadialGauge({ value = 0, color = '#22c55e' }) {

  const R = 36, cx = 50, cy = 50;

  const startAngle = -220;

  const sweepAngle = 260;

  const circumference = 2 * Math.PI * R;

  const totalArc = (sweepAngle / 360) * circumference;

  const valueArc = (value / 100) * totalArc;

  const toRad = (deg) => (deg * Math.PI) / 180;



  const arcPath = (start, sweep) => {

    const s = toRad(start);

    const e = toRad(start + sweep);

    const x1 = cx + R * Math.cos(s), y1 = cy + R * Math.sin(s);

    const x2 = cx + R * Math.cos(e), y2 = cy + R * Math.sin(e);

    const large = sweep > 180 ? 1 : 0;

    return `M ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2}`;

  };



  return (

    <svg width="100" height="100" viewBox="0 0 100 100">

      <path d={arcPath(startAngle, sweepAngle)} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="6" strokeLinecap="round" />

      <motion.path d={arcPath(startAngle, sweepAngle)} fill="none" stroke={color} strokeWidth="6" strokeLinecap="round"

        style={{ filter: `drop-shadow(0 0 4px ${color})` }}

        initial={{ pathLength: 0 }} animate={{ pathLength: value / 100 }}

        transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1], delay: 0.3 }} />

      <text x="50" y="53" textAnchor="middle" dominantBaseline="middle"

        style={{ fontSize: 18, fontWeight: 900, fill: color, fontFamily: 'Syne, sans-serif' }}>

        {value}

      </text>

      <text x="50" y="66" textAnchor="middle" dominantBaseline="middle"

        style={{ fontSize: 7, fill: 'rgba(156,163,175,1)', fontFamily: 'DM Mono, monospace', textTransform: 'uppercase', letterSpacing: '0.1em' }}>

        /100

      </text>

    </svg>

  );

}



/* ── SKELETON ──────────────────────────────────────────────────────── */

function DashboardSkeleton() {

  return (

    <>

      <style>{`@keyframes shimmer { 0% { transform:translateX(-100%); } 100% { transform:translateX(200%); } }`}</style>

      <div className="min-h-screen bg-[#f5f5f7] p-5 pb-16 space-y-5">

        <div className="bg-white border border-gray-200 rounded-3xl p-3 flex justify-between items-center shadow-[0_10px_30px_rgba(0,0,0,0.06)]">

          <div className="flex items-center gap-3">

            <Skeleton className="w-10 h-10 rounded-2xl" />

            <div><Skeleton className="w-40 h-3.5 mb-1.5 rounded" /><Skeleton className="w-28 h-2.5 rounded" /></div>

          </div>

          <Skeleton className="w-52 h-9 rounded-2xl" />

        </div>

        <Skeleton className="w-full h-10 rounded-2xl" />

        <div className="flex items-center gap-3"><Skeleton className="w-3 h-3 rounded" /><Skeleton className="w-36 h-2.5 rounded" /></div>

        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">

          {[...Array(4)].map((_, i) => (

            <div key={i} className="bg-white border border-gray-200 rounded-3xl p-4 shadow-[0_10px_30px_rgba(0,0,0,0.05)] space-y-4">

              <div className="flex justify-between">

                <Skeleton className="w-11 h-11 rounded-2xl" />

                <Skeleton className="w-4 h-4 rounded" />

              </div>

              <Skeleton className="w-28 h-3 rounded" />

              <Skeleton className="w-36 h-8 rounded" />

              <Skeleton className="w-44 h-4 rounded-full" />

            </div>

          ))}

        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">

          <div className="lg:col-span-2 bg-white border border-gray-200 rounded-3xl p-4 shadow-[0_10px_30px_rgba(0,0,0,0.05)]">

            <Skeleton className="w-28 h-2.5 rounded mb-4" />

            <div className="grid grid-cols-2 gap-3">

              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}

            </div>

          </div>

          <div className="lg:col-span-3 grid grid-cols-3 gap-3">

            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-36 rounded-2xl" />)}

          </div>

        </div>

      </div>

    </>

  );

}



function CashBreakdownPieChart({ data }) {

  const cashData = [

    { label: 'Cash on Hand', value: data.cashOnHand || 0, color: '#22c55e' },

    { label: 'Petty Cash', value: data.pettyCash || 0, color: '#3b82f6' },

    { label: 'Bank Accts', value: data.bankAccounts || 0, color: '#a855f7' },

    { label: 'Checks', value: data.checks || 0, color: '#f97316' },

  ].filter(item => item.value !== 0);

  

  const total = cashData.reduce((sum, item) => sum + Math.abs(item.value), 0) || 1;

  const R = 32, cx = 44, cy = 44, stroke = 8;

  const circumference = 2 * Math.PI * R;

  let offset = 0;



  return (

    <div className="flex flex-col items-center">

      <div className="relative" style={{ width: 88, height: 88 }}>

        <svg width="88" height="88" viewBox="0 0 88 88">

          <circle cx={cx} cy={cy} r={R} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={stroke} />

          {cashData.map((item, i) => {

            const pct = Math.abs(item.value) / total;

            const dash = pct * circumference;

            const seg = (

              <motion.circle key={item.label} cx={cx} cy={cy} r={R}

                fill="none" stroke={item.color} strokeWidth={stroke}

                strokeDasharray={`${dash} ${circumference - dash}`}

                strokeDashoffset={-offset * circumference}

                transform={`rotate(-90 ${cx} ${cy})`}

                initial={{ strokeDasharray: `0 ${circumference}` }}

                animate={{ strokeDasharray: `${dash} ${circumference - dash}` }}

                transition={{ duration: 1.1, delay: i * 0.15 + 0.3, ease: [0.22, 1, 0.36, 1] }}

              />

            );

            offset += pct;

            return seg;

          })}

        </svg>

      </div>

      <div className="mt-4 space-y-2 w-full">

        {cashData.map((item, i) => (

          <div key={item.label} className="flex items-center justify-between gap-2">

            <div className="flex items-center gap-2">

              <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: item.color }} />

              <span className="text-[10px] text-gray-600 leading-tight font-mono">{item.label}</span>

            </div>

            <span className="text-[10px] font-black text-[#111111] font-mono">

              ₱{fmt2(item.value)}

            </span>

          </div>

        ))}

      </div>

    </div>

  );

}



function fmt2(n) {

  return new Intl.NumberFormat('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);

}