import { useState } from 'react'
import { motion } from 'framer-motion'
import { ListStart, PlusSquare, Download, Edit2 } from 'lucide-react'
import DynamicTable from '../../components/DynamicTable'
import RouteProtection from '../../components/RouteProtection'
import ProtectedAction from '../../components/ProtectedAction'
import LoadingScreen from '../../components/LoadingScreen'
import DynamicToast from '../../components/DynamicToast'
import SequenceSettingsModal from '../../components/SequenceSettingsModal'
import useSequenceSettings, {
  SEQUENCE_MODULES,
  moduleLabel,
} from './useSequenceSettings'

export default function SequenceSettings() {
  return (
    <RouteProtection routeName="sequence_settings">
      <SequenceSettingsContent />
    </RouteProtection>
  )
}

const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
}

function SequenceSettingsContent() {
  const { settings, loading, error, fetchSequenceSettings } = useSequenceSettings()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingModule, setEditingModule] = useState(null)
  const [toast, setToast] = useState(null)

  const handleModalClosed = () => {
    setIsModalOpen(false)
    setEditingModule(null)
    fetchSequenceSettings()
  }

  const handleModalSaved = () => {
    setToast({ type: 'success', message: 'Sequence saved successfully!' })
  }

  const handleExportSequences = () => {
    try {
      if (settings.length === 0) {
        setToast({ type: 'error', message: 'No sequences to export' })
        return
      }

      const rows = settings.map((row) => ({ ...row, module: moduleLabel(row.module) }))
      const headers = Object.keys(rows[0] || {}).filter((h) => !['id', 'action'].includes(h))

      const csvRows = [headers.join(',')]
      rows.forEach((row) => {
        const values = headers.map((h) => {
          let val = row[h]
          if (val === null || val === undefined) return ''
          if (typeof val === 'object') {
            try {
              val = JSON.stringify(val)
            } catch {
              val = String(val)
            }
          }
          const escaped = String(val).replace(/"/g, '""')
          return /[",\n]/.test(escaped) ? `"${escaped}"` : escaped
        })
        csvRows.push(values.join(','))
      })

      const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `sequence_settings_${Date.now()}.csv`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      setToast({ type: 'success', message: 'Export started' })
    } catch {
      setToast({ type: 'error', message: 'Failed to export CSV' })
    }
  }

  if (loading) {
    return <LoadingScreen label="Loading Sequence Settings..." />
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
                <ListStart size={24} />
              </div>
              <h1 className="text-4xl font-black text-black tracking-tighter">
                Sequence <span className="text-red-600 italic">Settings</span>
              </h1>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleExportSequences}
              className="flex items-center gap-2 px-5 py-3 bg-green-600 text-white text-xs font-bold rounded-xl hover:bg-green-700 transition-all shadow-sm"
            >
              <Download size={14} />
              EXPORT DATA
            </button>
            <ProtectedAction routeName="sequence_settings">
              <button
                onClick={() => {
                  setEditingModule(null)
                  setIsModalOpen(true)
                }}
                className="flex items-center gap-2 px-6 py-3 bg-black text-white text-xs font-bold rounded-xl hover:bg-red-600 transition-all shadow-lg tracking-widest uppercase"
              >
                <PlusSquare size={14} />
                Add New
              </button>
            </ProtectedAction>
          </div>
        </motion.div>

        {/* --- SUMMARY TILES --- */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <SummaryCard
            label="Modules Configured"
            value={`${settings.length} / ${SEQUENCE_MODULES.length}`}
            subText="With Sequences"
          />
          <SummaryCard
            label="Default Format"
            value="PREFIX-MMDDYY-0001"
            subText="Legacy Shape"
          />
          <SummaryCard
            label="Scope"
            value="This Company"
            subText="Per Module"
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
          data={settings.map((row) => ({ ...row, _code: row.module, module: moduleLabel(row.module) }))}
          hiddenColumns={new Set(['_code', 'id', 'created_at', 'updated_at'])}
          title="Document Number Sequence"
          enableAddButton={false}
          enableActionColumn={true}
          actionButtons={[
            {
              label: 'Edit',
              onClick: (row) => {
                setEditingModule(row._code || row.module)
                setIsModalOpen(true)
              },
              icon: <Edit2 size={16} />,
            },
          ]}
        />
      </motion.div>

      {/* Add/Edit Sequence Modal - the same one the transaction pages open */}
      <SequenceSettingsModal
        isOpen={isModalOpen}
        onClose={handleModalClosed}
        module={editingModule}
        onSaved={handleModalSaved}
      />

      {/* Toast Notification */}
      {toast && (
        <DynamicToast
          type={toast.type}
          message={toast.message}
          onClose={() => setToast(null)}
          duration={4000}
        />
      )}
    </div>
  )
}

function SummaryCard({ label, value, subText }) {
  return (
    <div className="bg-white p-4 rounded-xl border border-gray-100 flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow">
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
