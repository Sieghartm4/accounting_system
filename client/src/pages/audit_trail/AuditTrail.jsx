import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { History, Eye, Download, ArrowRight } from 'lucide-react'
import DynamicTable from '../../components/DynamicTable'
import DynamicToast from '../../components/DynamicToast'
import RouteProtection from '../../components/RouteProtection'
import useAuditTrail from './useAuditTrail'

function AuditTrailContent() {
  const { auditTrails, loading, error, refetch } = useAuditTrail()
  const [toast, setToast] = useState(null)

  const fadeInUp = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
  }

  const handleToastClose = () => {
    setToast(null)
  }

  if (loading) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs font-black uppercase tracking-[3px] text-gray-400">
          Syncing Audit Trail Database...
        </p>
      </div>
    )
  }

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
          <SummaryCard
            icon={<History className="text-red-600" size={20} />}
            label="Total Entries"
            value={auditTrails?.length || 0}
            subText="Logged Activities"
          />
          <SummaryCard
            icon={<Eye className="text-black" size={20} />}
            label="Modules Tracked"
            value={
              auditTrails?.length > 0
                ? new Set(auditTrails.map((a) => a.module)).size
                : 0
            }
            subText="Active Systems"
          />
          <SummaryCard
            icon={<Download className="text-gray-400" size={20} />}
            label="Last Update"
            value={
              auditTrails?.length > 0
                ? auditTrails[0]?.created_date?.slice(-5)
                : 'N/A'
            }
            subText="Today"
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

function SummaryCard({ icon, label, value, subText }) {
  return (
    <div className="bg-white p-4 rounded-xl border border-gray-100 flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="p-3 bg-gray-50 rounded-xl">{icon}</div>
      <div>
        <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 leading-none mb-1">
          {label}
        </p>
        <div className="flex items-baseline gap-2">
          <h4 className="text-xl font-black text-black">{value}</h4>
          <span className="text-[9px] font-bold text-gray-400 uppercase">
            {subText}
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
