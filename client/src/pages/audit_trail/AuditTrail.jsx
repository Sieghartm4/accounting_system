import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { History, Eye, Download, ArrowRight, ClipboardList, Clock } from 'lucide-react'
import DynamicTable from '../../components/DynamicTable'
import DynamicToast from '../../components/DynamicToast'
import RouteProtection from '../../components/RouteProtection'
import useAuditTrail from './useAuditTrail'
import LoadingScreen from '../../components/LoadingScreen'

function AuditTrailContent() {
  const { auditTrails, loading, loadingMore, error, hasMore, refetch, loadMore } = useAuditTrail()
  const [toast, setToast] = useState(null)

  const fadeInUp = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
  }

  const handleToastClose = () => {
    setToast(null)
  }

  if (loading)
    return <LoadingScreen label="Loading Audit Trail..." />

  if (error) {
    return (
      <div className="p-10 flex items-center justify-center">
        <div className="bg-red-50 border-l-4 border-red-600 p-6 rounded-r-xl shadow-sm">
          <h3 className="text-red-800 font-bold uppercase text-sm">System Error</h3>
          <p className="text-red-600 text-sm mt-1">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-transparent overflow-hidden">
      {/* --- HEADER SECTION --- */}
      <div className="flex-shrink-0">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={fadeInUp}
          className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-4"
        >
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-black rounded-lg text-red-500 shadow-lg shadow-black/20">
                <History size={24} />
              </div>
              <h1 className="text-4xl font-black text-black tracking-tighter">
                Audit <span className="text-red-600 italic">Trail</span>
              </h1>
            </div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-tight">
              Track all system activities and transactions across the platform.
            </p>
          </div>

          <div className="flex gap-3">
            <button className="flex items-center gap-2 px-5 py-3 bg-white border border-gray-200 text-xs font-bold text-black rounded-xl hover:bg-gray-50 transition-all shadow-sm">
              <Download size={14} />
              EXPORT REPORT
            </button>
          </div>
        </motion.div>

        {/* --- SUMMARY TILES --- */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <SummaryTile
            label="Total Entries"
            value={auditTrails?.length || 0}
            subText="Logged Activities"
            color="emerald"
            icon={History}
          />
          <SummaryTile
            label="Modules Tracked"
            value={
              auditTrails?.length > 0
                ? new Set(auditTrails.map((a) => a.module)).size
                : 0
            }
            subText="Active Systems"
            color="blue"
            icon={ClipboardList}
          />
          <SummaryTile
            label="Last Update"
            value={
              auditTrails?.length > 0
                ? auditTrails[0]?.created_date?.slice(-5)
                : 'N/A'
            }
            subText="Today"
            color="dark"
            icon={Clock}
          />
        </div>
      </div>

      {/* --- TABLE SECTION --- */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="flex-1 min-h-0 bg-white rounded-2xl shadow-xl shadow-black/5 overflow-hidden border border-gray-100"
      >
        <DynamicTable
          data={auditTrails}
          title="Audit Trail table"
          enableAddButton={false}
          enableActionColumn={false}
          badgeColumns={[
            {
              column: 'module',
              values: {
                ACCESS: 'blue',
                USERS: 'purple',
                SALES: 'green',
                PURCHASE: 'orange',
                PAYMENTS: 'red',
                COLLECTIONS: 'indigo',
                RECEIPTS: 'green',
                DISBURSEMENT: 'orange',
              },
            },
          ]}
          enableInfiniteScroll={true}
          hasMore={hasMore}
          isLoadingMore={loadingMore}
          onLoadMore={() => loadMore()}
        />
      </motion.div>

      {/* Toast Notification */}
      {toast && (
        <DynamicToast
          type={toast.type}
          message={toast.message}
          onClose={handleToastClose}
          duration={4000}
        />
      )}
    </div>
  )
}

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

export default function AuditTrail() {
  return (
    <RouteProtection routeName="audit_trail">
      <AuditTrailContent />
    </RouteProtection>
  )
}
