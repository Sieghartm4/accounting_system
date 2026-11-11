import React from 'react'
import { motion } from 'framer-motion'
import {
  FilePlus,
  Download,
  CheckCircle,
  XCircle,
  Layers,
  ShieldCheck,
  ClipboardList,
  Wallet,
  ListStart,
} from 'lucide-react'
import { DynamicConfirmModal, DynamicTable, DynamicToast, LoadingScreen } from '../../components/ui'
import { SequenceSettingsModal } from '../../components/modals'
import { ProtectedAction, RouteProtection } from '../../components/access'
import useAdjustments from './useAdjustments'
import AdjustmentsForm from './AdjustmentsForm'

export default function Adjustments() {
  return (
    <RouteProtection routeName="adjustments">
      <AdjustmentsContent />
    </RouteProtection>
  )
}

function AdjustmentsContent() {
  const {
    adjustments,
    loading,
    loadingMore,
    error,
    hasMore,
    isAdding,
    startAdding,
    isViewing,
    isEditing,
    isPostedEdit,
    viewingAdjustment,
    initialJournalEntries,
    handleBack,
    handleFormSuccess,
    closeViewing,
    toast,
    closeToast,
    isSequenceModalOpen,
    openSequenceModal,
    closeSequenceModal,
    handleSequenceSaved,
    pendingDateFrom,
    pendingDateTo,
    setPendingDateFrom,
    setPendingDateTo,
    activeDateFrom,
    activeDateTo,
    applyDateFilters,
    clearDateFilters,
    confirmModal,
    closeConfirmModal,
    confirmAndClose,
    unreadRowMap,
    enableCheckboxes,
    checkboxCondition,
    activeFilter,
    setActiveFilter,
    filteredAdjustments,
    filteredTotalAmount,
    handleApproveSelected,
    handleCancelSelected,
    handleViewAdjustment,
    handleEditAdjustment,
    handleReverseAdjustment,
    loadMore,
  } = useAdjustments()

  const fadeInUp = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
  }

  if (isAdding)
    return (
      <RouteProtection routeName="adjustments">
        <AdjustmentsForm
          isEditMode={isEditing}
          isPostedLocked={isPostedEdit}
          adjustmentData={isEditing ? viewingAdjustment : null}
          initialJournalEntries={initialJournalEntries}
          onBack={handleBack}
          onSuccess={handleFormSuccess}
        />
      </RouteProtection>
    )

  if (isViewing)
    return (
      <RouteProtection routeName="adjustments">
        <AdjustmentsForm
          isViewMode={true}
          adjustmentData={viewingAdjustment}
          onBack={closeViewing}
        />
      </RouteProtection>
    )

  if (loading) {
    return <LoadingScreen label="Loading Journal Vouchers Data..." />
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
      {toast && (
        <DynamicToast
          type={toast.type}
          message={toast.message}
          onClose={closeToast}
        />
      )}
      <DynamicConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={closeConfirmModal}
        onConfirm={confirmAndClose}
        title={confirmModal.title}
        message={confirmModal.message}
        type="warning"
      />

      <SequenceSettingsModal
        isOpen={isSequenceModalOpen}
        onClose={closeSequenceModal}
        module="adjustments"
        onSaved={handleSequenceSaved}
      />

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
                <Layers size={24} />
              </div>
              <h1 className="text-4xl font-black text-black tracking-tighter">
                Journal <span className="text-red-600 italic">Vouchers</span>
              </h1>
            </div>
          </div>

          <div className="flex flex-col md:flex-row md:items-center gap-3">
            <button
              onClick={openSequenceModal}
              className="flex items-center gap-2 px-5 py-3 bg-white border border-gray-200 text-xs font-bold text-black rounded-xl hover:bg-gray-50 transition-all shadow-sm"
            >
              <ListStart size={14} />
              Edit Sequence
            </button>
            <button className="flex items-center gap-2 px-5 py-3 bg-white border border-gray-200 text-xs font-bold text-black rounded-xl hover:bg-gray-50 transition-all shadow-sm">
              <Download size={14} />
              EXPORT DATA
            </button>
            <ProtectedAction routeName="adjustments">
              <button
                onClick={startAdding}
                className="flex items-center gap-2 px-6 py-3 bg-black text-white text-xs font-bold rounded-xl hover:bg-red-600 transition-all shadow-lg tracking-widest uppercase"
              >
                <FilePlus size={14} />
                New Journal Voucher
              </button>
            </ProtectedAction>
          </div>
        </motion.div>

{/* ── SUMMARY TILES ──────────────────────────────────────────────────── */}
<div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
  <SummaryTile
    label="Total Adjustments"
    value={activeFilter ? filteredAdjustments?.length || 0 : adjustments?.length || 0}
    subText="Fetched"
    color="emerald"
    onClick={() => setActiveFilter(null)}
    isActive={activeFilter === null}
    icon={Layers}
  />
  <SummaryTile
    label="Prepared"
    value={
      activeFilter === 'PREPARED'
        ? filteredAdjustments?.length || 0
        : adjustments?.filter((a) => a.status === 'PREPARED').length || 0
    }
    subText="Transactions"
    color="rose"
    onClick={() => setActiveFilter('PREPARED')}
    isActive={activeFilter === 'PREPARED'}
    icon={ClipboardList}
  />
  <SummaryTile
    label="Checked"
    value={
      activeFilter === 'CHECKED'
        ? filteredAdjustments?.length || 0
        : adjustments?.filter((a) => a.status === 'CHECKED').length || 0
    }
    subText="Transactions"
    color="blue"
    onClick={() => setActiveFilter('CHECKED')}
    isActive={activeFilter === 'CHECKED'}
    icon={CheckCircle}
  />
  <SummaryTile
    label="Cancelled"
    value={
      activeFilter === 'CANCELLED'
        ? filteredAdjustments?.length || 0
        : adjustments?.filter((a) => a.status === 'CANCELLED').length || 0
    }
    subText="Transactions"
    color="orange"
    onClick={() => setActiveFilter('CANCELLED')}
    isActive={activeFilter === 'CANCELLED'}
    icon={XCircle}
  />
  <SummaryTile
    label="Approved"
    value={
      activeFilter === 'APPROVED'
        ? filteredAdjustments?.length || 0
        : adjustments?.filter((a) => a.status === 'APPROVED').length || 0
    }
    subText="Transactions"
    color="emerald"
    onClick={() => setActiveFilter('APPROVED')}
    isActive={activeFilter === 'APPROVED'}
    icon={ShieldCheck}
  />
  <SummaryTile
    label="Total Amount"
    value={`₱ ${filteredTotalAmount.toLocaleString('en-PH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }) || '0.00'}`}
    subText="PHP"
    color="dark"
    icon={Wallet}
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
          data={filteredAdjustments}
          title="Journal Vouchers"
          unreadRowMap={unreadRowMap}
          enableDateFilter={true}
          dateFrom={pendingDateFrom}
          dateTo={pendingDateTo}
          onDateFromChange={setPendingDateFrom}
          onDateToChange={setPendingDateTo}
          onApplyDateFilter={applyDateFilters}
          onClearDateFilter={clearDateFilters}
          enableAddButton={false}
          enableCheckbox={enableCheckboxes}
          enableActionColumn={true}
          checkboxColumn="id"
          checkboxCondition={checkboxCondition}
          actionButtons={[
            {
              label: 'View',
              onClick: handleViewAdjustment,
            },
            {
              label: 'Edit',
              onClick: handleEditAdjustment,
            },
            {
              label: 'Reverse',
              onClick: handleReverseAdjustment,
            },
          ]}
          badgeColumns={[
            {
              column: 'status',
              values: {
                PREPARED: 'yellow',
                CHECKED: 'blue',
                APPROVED: 'green',
                REJECTED: 'red',
                CANCELLED: 'orange',
              },
            },
          ]}
          checkboxActions={[
            {
              label: 'Approve Selected',
              onClick: handleApproveSelected,
            },
            {
              label: 'Cancel Selected',
              style: 'orange',
              onClick: handleCancelSelected,
            },
          ]}
          enableInfiniteScroll={true}
          hasMore={hasMore}
          isLoadingMore={loadingMore}
          onLoadMore={() =>
            loadMore({ dateFrom: activeDateFrom, dateTo: activeDateTo })
          }
        />
      </motion.div>
    </div>
  )
}

function SummaryTile({ label, value, subText, color, onClick, isActive, icon: Icon }) {
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

  const activeBgClass = isActive
    ? `${theme.bg} text-white border-transparent`
    : bgClass

  const isClickable = label !== 'Total Amount'

  return (
    <div
      onClick={isClickable ? onClick : undefined}
      className={`${activeBgClass} p-3 rounded-xl border relative overflow-hidden flex flex-col justify-between h-full ${isClickable ? 'cursor-pointer hover:scale-105 hover:shadow-lg group' : ''} transition-all duration-300`}
    >
      {/* Bottom Accent Indicator - Animates on hover (behind content) */}
      <div className={`absolute bottom-0 left-0 right-0 h-1 ${theme.bar} ${isClickable ? 'group-hover:h-full' : ''} transition-all duration-300 z-0`} />

      {/* Content wrapper with higher z-index */}
      <div className="relative z-10 flex flex-col justify-between h-full">
        {/* Top Header Row */}
        <div className="flex items-center justify-between gap-2 mb-2">
          {label === 'Total Amount' ? (
            <span className={`text-xs font-semibold tracking-wide uppercase text-white`}>
              {label}
            </span>
          ) : (
            <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full border ${isActive ? 'bg-white text-gray-900 border-white' : theme.badgeBg} ${isClickable ? 'group-hover:bg-white group-hover:text-gray-900 group-hover:border-white' : ''}`}>
              {label}
            </span>
          )}
          <span className={`text-xs font-medium ${isActive ? 'text-white/80' : 'text-gray-400'} ${isClickable ? 'group-hover:text-white/80' : ''}`}>
            {subText}
          </span>
        </div>

        {/* Value Row with Icon */}
        <div className="flex items-center gap-2 my-1">
          {Icon && (
            <Icon size={20} className={`${isActive ? 'text-white' : (label === 'Total Amount' ? theme.text : 'text-gray-600')} ${isClickable ? 'group-hover:text-white' : ''} transition-colors`} />
          )}
          <span className={`text-2xl font-bold font-mono tracking-tight ${isActive ? 'text-white' : (label === 'Total Amount' ? theme.text : 'text-black')} ${isClickable ? 'group-hover:text-white' : ''}`}>
            {value}
          </span>
        </div>
      </div>
    </div>
  )
}
