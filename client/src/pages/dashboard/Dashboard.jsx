import React from 'react';
import { motion } from 'framer-motion';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Package, 
  ArrowUpRight, 
  Users, 
  Clock, 
  CheckCircle2 
} from 'lucide-react';

export default function Dashboard() {
  // Container animation for staggered children
  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const item = {
    hidden: { y: 20, opacity: 0 },
    show: { y: 0, opacity: 1 }
  };

  return (
    <motion.div 
      variants={container}
      initial="hidden"
      animate="show"
      className="space-y-8 pb-10"
    >
      {/* --- Section 1: Top Level Financial Metrics --- */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Total Revenue" 
          value="₱4,285,900.00" 
          trend="+12.5%" 
          isPositive={true} 
          icon={<DollarSign size={20}/>} 
        />
        <StatCard 
          title="Supply Expenses" 
          value="₱1,102,450.00" 
          trend="+4.2%" 
          isPositive={false} 
          icon={<Package size={20}/>} 
        />
        <StatCard 
          title="Active Accounts" 
          value="184" 
          trend="+8" 
          isPositive={true} 
          icon={<Users size={20}/>} 
        />
        <StatCard 
          title="Pending Invoices" 
          value="23" 
          trend="Action Required" 
          isPositive={null} 
          icon={<Clock size={20}/>} 
        />
      </div>

      {/* --- Section 2: Main Analytics Grid --- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Cash Flow Preview (recommended for Accounting) */}
        <motion.div variants={item} className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-lg font-bold text-black tracking-tight">Financial Performance</h3>
              <p className="text-xs text-gray-400 uppercase tracking-widest font-semibold mt-1">Monthly Supply vs Services</p>
            </div>
            <select className="bg-gray-50 border border-gray-200 text-xs font-bold py-1.5 px-3 rounded-lg outline-none focus:ring-2 focus:ring-red-600/10 transition-all">
              <option>Last 6 Months</option>
              <option>Year to Date</option>
            </select>
          </div>
          
          {/* Mock Chart Visual */}
          <div className="h-64 w-full bg-slate-50 rounded-xl border border-dashed border-gray-200 flex items-end justify-between p-4 gap-2">
            {[40, 70, 45, 90, 65, 85].map((h, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-2">
                <div className="w-full bg-red-600/10 rounded-t-md relative group transition-all hover:bg-red-600" style={{ height: `${h}%` }}>
                  <div className="opacity-0 group-hover:opacity-100 absolute -top-8 left-1/2 -translate-x-1/2 bg-black text-white text-[10px] py-1 px-2 rounded whitespace-nowrap">
                    ₱{(h * 10).toFixed(1)}k
                  </div>
                </div>
                <span className="text-[10px] font-bold text-gray-400">MON-0{i+1}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Recent Transactions / Allied Services Updates */}
        <motion.div variants={item} className="bg-black rounded-3xl p-6 text-white shadow-2xl">
          <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
            <CheckCircle2 size={18} className="text-red-500" />
            Audit Log
          </h3>
          <div className="space-y-6">
            <TransactionItem label="INV-9021-X" desc="Allied Services Payment" amount="+₱45,000" date="2 mins ago" />
            <TransactionItem label="SUP-4421-B" desc="Office Supplies Acquisition" amount="-₱12,300" date="1 hour ago" />
            <TransactionItem label="PAY-5520-C" desc="Payroll Processing (Batch A)" amount="-₱850,000" date="4 hours ago" />
            <TransactionItem label="INV-8832-Z" desc="Consultancy Service" amount="+₱120,000" date="Yesterday" />
          </div>
          <button className="w-full mt-8 py-3 bg-red-600 hover:bg-red-700 rounded-xl text-xs font-bold tracking-widest uppercase transition-all">
            View Full Ledger
          </button>
        </motion.div>

      </div>
    </motion.div>
  );
}

// --- Internal Reusable Components ---

function StatCard({ title, value, trend, isPositive, icon }) {
  return (
    <motion.div 
      variants={{ hidden: { scale: 0.9, opacity: 0 }, show: { scale: 1, opacity: 1 }}}
      className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow group"
    >
      <div className="flex justify-between items-start mb-4">
        <div className="p-2.5 bg-gray-50 rounded-xl group-hover:bg-red-50 group-hover:text-red-600 transition-colors text-gray-500">
          {icon}
        </div>
        {trend && (
          <div className={`flex items-center text-xs font-bold ${
            isPositive === null ? 'text-gray-400' : isPositive ? 'text-green-600' : 'text-red-600'
          }`}>
            {isPositive === true && <TrendingUp size={12} className="mr-1" />}
            {isPositive === false && <TrendingDown size={12} className="mr-1" />}
            {trend}
          </div>
        )}
      </div>
      <div>
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{title}</p>
        <h4 className="text-2xl font-black text-black mt-1 tracking-tight">{value}</h4>
      </div>
    </motion.div>
  );
}

function TransactionItem({ label, desc, amount, date }) {
  const isNegative = amount.startsWith('-');
  return (
    <div className="flex justify-between items-center group cursor-pointer">
      <div className="flex flex-col">
        <span className="text-xs font-bold text-white group-hover:text-red-500 transition-colors">{label}</span>
        <span className="text-[10px] text-gray-500">{desc}</span>
      </div>
      <div className="text-right">
        <span className={`text-xs font-bold ${isNegative ? 'text-gray-300' : 'text-red-500'}`}>{amount}</span>
        <p className="text-[10px] text-gray-600">{date}</p>
      </div>
    </div>
  );
}