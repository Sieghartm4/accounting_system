import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  CalendarRange,
  CalendarPlus,
  RefreshCw,
  Lock,
  RotateCcw,
  XCircle,
  Clock3,
  CheckCircle,
  Save,
  X,
  Calendar,
} from 'lucide-react'
import DynamicTable from '../../components/DynamicTable'
import DynamicToast from '../../components/DynamicToast'
import DynamicConfirmModal from '../../components/DynamicConfirmModal'
import RightSideModal from '../../components/RightSideModal'
import RouteProtection from '../../components/RouteProtection'
import ProtectedAction from '../../components/ProtectedAction'
import LoadingScreen from '../../components/LoadingScreen'
import useAccountingPeriods from './useAccountingPeriods'

export default function AccountingPeriods() {
  return (
    <RouteProtection routeName="accounting_periods">
      <AccountingPeriodsContent />
    </RouteProtection>
  )
}

const STATUS_ACTIONS = {
  OPEN: ['soft_close', 'close', 'lock'],
  SOFT_CLOSED: ['close', 'lock', 'reopen'],
  CLOSED: ['lock', 'reopen'],
  LOCKED: ['reopen'],
}

const STATUS_BADGES = {
  OPEN: 'green',
  SOFT_CLOSED: 'yellow',
  CLOSED: 'orange',
  LOCKED: 'red',
}

const ACTION_META = {
  soft_close: {
    label: 'Soft Close',
    icon: Clock3,
    color: 'text-amber-600 hover:bg-amber-50 border-amber-200',
    message:
      'The period can still be reopened later, but further posting will be blocked until then.',
  },
  close: {
    label: 'Close',
    icon: XCircle,
    color: 'text-red-600 hover:bg-red-50 border-red-200',
    message:
      'A closed period is final and should only be reopened with a documented reason.',
  },
  lock: {
    label: 'Lock',
    icon: Lock,
    color: 'text-purple-600 hover:bg-purple-50 border-purple-200',
    message:
      'A locked period is immutable. Reopening will require a clear reason.',
  },
  reopen: {
    label: 'Reopen',
    icon: RotateCcw,
    color: 'text-blue-600 hover:bg-blue-50 border-blue-200',
  },
}

const ACTION_PAST = {
  soft_close: 'soft closed',
  close: 'closed',
  lock: 'locked',
  reopen: 'reopened',
}

const formatDate = (value) => {
  if (!value) return ''
  const stringValue = String(value)
  return stringValue.length >= 10 ? stringValue.slice(0, 10) : stringValue
}

function AccountingPeriodsContent() {
  const {
    fiscalYears,
    periods,
    currentPeriod,
    selectedFiscalYearId,
    setSelectedFiscalYearId,
    statusFilter,
    setStatusFilter,
    loadingFiscalYears,
    loadingPeriods,
    error,
    periodsError,
    fetchFiscalYears,
    fetchPeriods,
    fetchCurrentPeriod,
    createFiscalYear,
    updatePeriodStatus,
  } = useAccountingPeriods()

  const [toast, setToast] = useState(null)
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    onConfirm: null,
    title: '',
    message: '',
    type: 'warning',
  })
  const [reopenModal, setReopenModal] = useState({
    isOpen: false,
    period: null,
  })
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [form, setForm] = useState({
    code: '',
    name: '',
    start_date: '',
    end_date: '',
    status: 'ACTIVE',
    is_current: false,
  })

  const fadeInUp = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
  }

  const refreshAll = () => {
    fetchFiscalYears()
    fetchPeriods()
    fetchCurrentPeriod()
  }

  const runStatusAction = async (row, action, reopenReason = '') => {
    try {
      const result = await updatePeriodStatus(row.period_id, action, reopenReason)
      setToast({
        type: 'success',
        message:
          result.message ||
          `Period ${row.period} successfully ${ACTION_PAST[action]}.`,
      })
      fetchPeriods()
      fetchCurrentPeriod()
      return true
    } catch (err) {
      setToast({
        type: 'error',
        message: err.message || `Failed to ${action.replace(/_/g, ' ')} period`,
      })
      return false
    }
  }

  const handleAction = (row, action) => {
    if (action === 'reopen') {
      setReopenModal({ isOpen: true, period: row })
      return
    }
    const meta = ACTION_META[action]
    setConfirmModal({
      isOpen: true,
      title: `${meta.label} Period ${row.period}`,
      message: `Are you sure you want to ${meta.label.toLowerCase()} accounting period ${row.period}? ${meta.message || ''
        }`,
      type: action === 'close' ? 'danger' : 'warning',
      onConfirm: () => runStatusAction(row, action),
    })
  }

  const rowActionButtons = (row) => {
    const actions = STATUS_ACTIONS[String(row.status || '').toUpperCase()] || []
    if (actions.length === 0) {
      return <span className="text-gray-300 italic text-xs">N/A</span>
    }
    return (
      <div className="flex items-center justify-center gap-1.5">
        <ProtectedAction routeName="accounting_periods">
          {actions.map((action) => {
            const meta = ACTION_META[action]
            const Icon = meta.icon
            return (
              <button
                key={action}
                onClick={(e) => {
                  e.stopPropagation()
                  handleAction(row, action)
                }}
                title={`${meta.label} ${row.period || ''}`}
                className={`flex items-center justify-center w-8 h-8 rounded-lg transition-all border cursor-pointer ${meta.color} bg-white`}
              >
                <Icon size={15} />
              </button>
            )
          })}
        </ProtectedAction>
      </div>
    )
  }

  const columns = [
    { key: 'period', label: 'Period' },
    { key: 'year', label: 'Year' },
    {
      key: 'start_date',
      label: 'Start Date',
      render: (value) => formatDate(value) || 'N/A',
    },
    {
      key: 'end_date',
      label: 'End Date',
      render: (value) => formatDate(value) || 'N/A',
    },
    { key: 'status', label: 'Status' },
    { key: 'closed_by', label: 'Closed By' },
    {
      key: 'closed_date',
      label: 'Closed Date',
      render: (value) => formatDate(value) || 'N/A',
    },
    { key: 'reopened_by', label: 'Reopened By' },
    {
      key: 'reopened_date',
      label: 'Reopened Date',
      render: (value) => formatDate(value) || 'N/A',
    },
    { key: 'reopen_reason', label: 'Reopen Reason' },
    {
      key: 'actions',
      label: 'Actions',
      render: (value, row) => rowActionButtons(row),
    },
  ]

  const openPeriodCount = periods.filter(
    (p) => String(p.status || '').toUpperCase() === 'OPEN',
  ).length
  const lockedPeriodCount = periods.filter(
    (p) => String(p.status || '').toUpperCase() === 'LOCKED',
  ).length

  const handleCreateFiscalYear = async (e) => {
    e.preventDefault()
    if (
      !form.code.trim() ||
      !form.name.trim() ||
      !form.start_date ||
      !form.end_date
    ) {
      setToast({
        type: 'warning',
        message: 'Code, Name, Start Date and End Date are required',
      })
      return
    }
    if (form.end_date < form.start_date) {
      setToast({
        type: 'warning',
        message: 'End date must be on or after the start date',
      })
      return
    }
    setIsSubmitting(true)
    try {
      const result = await createFiscalYear({
        code: form.code.trim(),
        name: form.name.trim(),
        start_date: form.start_date,
        end_date: form.end_date,
        status: form.status,
        is_current: form.is_current,
      })
      setToast({
        type: 'success',
        message: result.message || 'Fiscal year created successfully',
      })
      setIsCreateOpen(false)
      setForm({
        code: '',
        name: '',
        start_date: '',
        end_date: '',
        status: 'ACTIVE',
        is_current: false,
      })
      refreshAll()
    } catch (err) {
      setToast({
        type: 'error',
        message: err.message || 'Failed to create fiscal year',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (loadingFiscalYears) {
    return <LoadingScreen label="Loading Accounting Periods..." />
  }

  if (error && fiscalYears.length === 0) {
    return (
      <div className="p-10 flex items-center justify-center">
        <div className="bg-red-50 border-l-4 border-red-600 p-6 rounded-r-xl shadow-sm">
          <h3 className="text-red-800 font-bold uppercase text-sm">
            System Error
          </h3>
          <p className="text-red-600 text-sm mt-1">{error}</p>
        </div>
      </div>
    )
  }

  const inputStyle =
    'w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all [color-scheme:light]'
  const labelStyle =
    'block text-[10px] font-black uppercase tracking-widest text-gray-700 mb-2'

  return (
    <div className="h-full flex flex-col bg-transparent overflow-hidden">
      {toast && (
        <DynamicToast
          type={toast.type}
          message={toast.message}
          onClose={() => setToast(null)}
        />
      )}

      <DynamicConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
        onConfirm={() => {
          if (confirmModal.onConfirm) confirmModal.onConfirm()
          setConfirmModal({ ...confirmModal, isOpen: false })
        }}
        title={confirmModal.title}
        message={confirmModal.message}
        type={confirmModal.type}
      />

      {reopenModal.isOpen && (
        <ReopenModal
          period={reopenModal.period}
          onClose={() => setReopenModal({ isOpen: false, period: null })}
          onReopen={async (reason) => {
            const ok = await runStatusAction(
              reopenModal.period,
              'reopen',
              reason,
            )
            if (ok) setReopenModal({ isOpen: false, period: null })
          }}
        />
      )}

      <RightSideModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Create Fiscal Year"
        size="md"
      >
        <form onSubmit={handleCreateFiscalYear} className="space-y-6">
          <div className="space-y-4">
            <div>
              <label className={labelStyle}>
                Code <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. FY-2026"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                className={inputStyle}
                required
              />
            </div>

            <div>
              <label className={labelStyle}>
                Name <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Fiscal Year 2026"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className={inputStyle}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelStyle}>
                  Start Date <span className="text-red-600">*</span>
                </label>
                <input
                  type="date"
                  value={form.start_date}
                  onChange={(e) =>
                    setForm({ ...form, start_date: e.target.value })
                  }
                  className={inputStyle}
                  required
                />
              </div>
              <div>
                <label className={labelStyle}>
                  End Date <span className="text-red-600">*</span>
                </label>
                <input
                  type="date"
                  value={form.end_date}
                  onChange={(e) =>
                    setForm({ ...form, end_date: e.target.value })
                  }
                  className={inputStyle}
                  required
                />
              </div>
            </div>

            <div>
              <label className={labelStyle}>Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className={`${inputStyle} appearance-none cursor-pointer`}
              >
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </div>

            <label className="flex items-center gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={form.is_current}
                onChange={(e) =>
                  setForm({ ...form, is_current: e.target.checked })
                }
                className="w-4 h-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
              />
              <span className="text-xs font-bold text-gray-700">
                Set as Current Fiscal Year
              </span>
            </label>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={() => setIsCreateOpen(false)}
              className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 text-xs font-black rounded-xl hover:bg-gray-200 transition-all uppercase tracking-widest"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-4 py-3 bg-black text-white text-xs font-black rounded-xl hover:bg-red-600 transition-all uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save size={14} />
              {isSubmitting ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </RightSideModal>

      {/* --- HEADER SECTION --- */}
      <div className="shrink-0">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={fadeInUp}
          className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-4"
        >
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-black rounded-lg text-red-500 shadow-lg shadow-black/20">
                <CalendarRange size={24} />
              </div>
              <h1 className="text-4xl font-black text-black tracking-tighter">
                <span className="text-red-600 italic">Accounting</span> Periods
              </h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Current Period Indicator */}
            <div
              className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border ${currentPeriod
                  ? 'bg-green-50 border-green-200'
                  : 'bg-gray-50 border-gray-200'
                }`}
            >
              <div
                className={`p-1.5 rounded-lg ${currentPeriod ? 'bg-green-600' : 'bg-gray-400'
                  }`}
              >
                <Calendar className="text-white" size={14} />
              </div>
              <div className="min-w-0">
                <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">
                  Current Period
                </p>
                <p className="text-xs font-black text-gray-800 truncate">
                  {currentPeriod
                    ? `${currentPeriod.period} · ${currentPeriod.year}`
                    : 'None'}
                </p>
              </div>
              {currentPeriod && (
                <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border bg-green-100 text-green-800 border-green-200">
                  {currentPeriod.status || 'OPEN'}
                </span>
              )}
            </div>
            {/* Fiscal Year Filter */}
            <div>
              <label className={labelStyle}>Fiscal Year</label>
              <select
                value={selectedFiscalYearId}
                onChange={(e) => setSelectedFiscalYearId(e.target.value)}
                className="px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-800 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all cursor-pointer min-w-[220px]"
              >
                <option value="">All Fiscal Years</option>
                {fiscalYears.map((fy) => {
                  const id = fy.fiscal_year_id ?? fy.id
                  return (
                    <option key={id} value={id}>
                      {`${fy.code || ''} — ${fy.name || 'Fiscal Year'}${fy.is_current ? ' (Current)' : ''
                        }`}
                    </option>
                  )
                })}
              </select>
            </div>

            {/* Status Filter */}
            <div>
              <label className={labelStyle}>Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-800 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all cursor-pointer min-w-[160px]"
              >
                <option value="">All Statuses</option>
                <option value="OPEN">OPEN</option>
                <option value="SOFT_CLOSED">SOFT CLOSED</option>
                <option value="CLOSED">CLOSED</option>
                <option value="LOCKED">LOCKED</option>
              </select>
            </div>



            <button
              onClick={refreshAll}
              className="flex items-center gap-2 px-5 py-3 bg-white border border-gray-200 text-xs font-bold text-black rounded-xl hover:bg-gray-50 transition-all shadow-sm"
            >
              <RefreshCw size={14} />
              REFRESH
            </button>
            <ProtectedAction routeName="accounting_periods">
              <button
                onClick={() => setIsCreateOpen(true)}
                className="flex items-center gap-2 px-6 py-3 bg-black text-white text-xs font-bold rounded-xl hover:bg-red-600 transition-all shadow-lg tracking-widest uppercase"
              >
                <CalendarPlus size={14} />
                Create Fiscal Year
              </button>
            </ProtectedAction>
          </div>
        </motion.div>

        {/* --- SUMMARY TILES --- */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <SummaryCard
            icon={<CalendarRange className="text-red-600" size={20} />}
            label="Fiscal Years"
            value={fiscalYears?.length || 0}
            subText="Configured"
          />
          <SummaryCard
            icon={<CheckCircle className="text-green-600" size={20} />}
            label="Open Periods"
            value={openPeriodCount}
            subText="Currently Open"
          />
          <SummaryCard
            icon={<Lock className="text-purple-600" size={20} />}
            label="Locked Periods"
            value={lockedPeriodCount}
            subText="Immutable"
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
        {periodsError ? (
          <div className="h-full flex flex-col items-center justify-center p-10 text-center">
            <div className="bg-red-50 border-l-4 border-red-600 p-6 rounded-r-xl shadow-sm max-w-md">
              <h3 className="text-red-800 font-bold uppercase text-sm">
                Failed to load periods
              </h3>
              <p className="text-red-600 text-sm mt-1">{periodsError}</p>
              <button
                onClick={fetchPeriods}
                className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-black rounded-lg uppercase tracking-widest transition-all"
              >
                <RefreshCw size={12} className="inline mr-1" />
                Retry
              </button>
            </div>
          </div>
        ) : periods.length === 0 && !loadingPeriods ? (
          <div className="h-full flex flex-col items-center justify-center bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200 p-10 text-center">
            <div className="p-4 bg-white rounded-full shadow-sm mb-4">
              <CalendarRange className="text-gray-200" size={40} />
            </div>
            <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest">
              No Accounting Periods
            </h3>
            <p className="text-xs text-gray-400 mt-2 max-w-[260px]">
              Create a fiscal year to generate monthly accounting periods, or
              adjust the filters above.
            </p>
          </div>
        ) : (
          <DynamicTable
            data={periods}
            title="Accounting Periods"
            enableAddButton={false}
            enableCheckbox={false}
            enableActionColumn={false}
            columns={columns}
            badgeColumns={[
              {
                column: 'status',
                values: STATUS_BADGES,
              },
            ]}
            isLoading={loadingPeriods}
          />
        )}
      </motion.div>
    </div>
  )
}

function ReopenModal({ period, onClose, onReopen }) {
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (period) {
      setReason('')
      setError('')
    }
  }, [period])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!reason.trim()) {
      setError('A reopen reason is required')
      return
    }
    setSubmitting(true)
    try {
      await onReopen(reason.trim())
    } catch (err) {
      setError(err.message || 'Failed to reopen period')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[80] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-lg shadow-[-10px_0_30px_rgba(0,0,0,0.2)] max-w-md w-full overflow-hidden"
      >
        <div className="bg-black px-6 py-5 flex items-center justify-between relative">
          <div className="absolute bottom-0 left-0 w-full h-[3px] bg-blue-500" />
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-gray-800">
              <RotateCcw className="w-5 h-5 text-blue-500" />
            </div>
            <h3 className="text-lg font-black text-white uppercase tracking-tight">
              Reopen Period {period?.period}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-800 text-gray-400 hover:text-red-500 transition-all duration-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4">
            <p className="text-sm text-gray-700 leading-relaxed">
              Reopening period <strong>{period?.period}</strong> will make it
              available for posting again. This action is logged for audit
              purposes.
            </p>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-gray-700 mb-2">
                Reopen Reason <span className="text-red-600">*</span>
              </label>
              <textarea
                rows={3}
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value)
                  if (error) setError('')
                }}
                placeholder="Explain why this period is being reopened..."
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all resize-none"
                autoFocus
              />
              {error && (
                <p className="text-xs font-bold text-red-600 mt-1">{error}</p>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3 p-4 bg-gray-50 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 hover:bg-gray-100 rounded-lg transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-white rounded-lg transition-colors font-medium bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Reopening...' : 'Reopen Period'}
            </button>
          </div>
        </form>
      </motion.div>
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