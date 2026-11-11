import React from 'react'
import { motion } from 'framer-motion'
import {
  FilePlus,
  ShoppingCart,
  ShieldCheck,
  Download,
  FileText,
  Building,
  CheckCircle,
  XCircle,
  ClipboardList,
  Wallet,
  ListStart,
} from 'lucide-react'
import { DynamicConfirmModal, DynamicTable, DynamicToast, LoadingScreen } from '../../components/ui'
import { SequenceSettingsModal } from '../../components/modals'
import { ProtectedAction, RouteProtection } from '../../components/access'
import usePurchase from './usePurchase'
import PurchaseForm from './PurchaseForm'

export default function Purchase() {
  return (
    <RouteProtection routeName="purchase">
      <PurchaseContent />
    </RouteProtection>
  )
}

function PurchaseContent() {
  const {
    purchases,
    loading,
    loadingMore,
    hasMore,
    error,
    isAdding,
    startAdding,
    closeAdding,
    handleAddFormSuccess,
    prefillPurchaseData,
    isEditing,
    isPostedEdit,
    editingPurchase,
    closeEditing,
    handleEditFormSuccess,
    isViewing,
    viewingPurchase,
    closeViewing,
    handleViewFormSuccess,
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
    activeFilter,
    setActiveFilter,
    filteredPurchases,
    filteredTotalAmount,
    fetchAndDownloadPDF,
    handleApproveSelected,
    handleCancelSelected,
    handleViewPurchase,
    handleEditPurchase,
    handleReversePurchase,
    loadMore,
  } = usePurchase()

  const checkboxCondition = null // Always show checkboxes (match other pages)

  // Function to filter checkbox actions based on selected rows
  const getFilteredCheckboxActions = (selectedRows) => {
    const allActions = [
      {
        label: 'Approve Selected',
        onClick: handleApproveSelected,
      },
      {
        label: 'Cancel Selected',
        style: 'orange',
        onClick: handleCancelSelected,
      },
      {
        separator: true,
      },
      {
        label: 'Internal Copy',
        icon: <FileText size={14} />,
        onClick: (selectedRows) => fetchAndDownloadPDF(selectedRows, 'internal'),
        style: 'blue',
      },
      {
        label: 'Vendor Copy',
        icon: <Building size={14} />,
        onClick: (selectedRows) => fetchAndDownloadPDF(selectedRows, 'customer'),
        style: 'orange',
      },
    ]

    return allActions.filter((action) => {
      if (action.label === 'Approve Selected') {
        return selectedRows.some(
          (row) => row.state === 'PREPARED' || row.state === 'CHECKED',
        )
      }
      if (action.label === 'Cancel Selected') {
        return selectedRows.some(
          (row) => row.state !== 'CANCELLED' && row.state !== 'REJECTED' && row.state !== 'APPROVED',
        )
      }
      return true
    })
  }

  const fadeInUp = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
  }

  if (isAdding)
    return (
      <RouteProtection routeName="purchase">
        <PurchaseForm
          purchaseData={prefillPurchaseData}
          onBack={closeAdding}
          onSuccess={handleAddFormSuccess}
        />
      </RouteProtection>
    )

  if (isEditing)
    return (
      <RouteProtection routeName="purchase">
        <PurchaseForm
          isViewMode={false}
          isEditMode={true}
          isPostedLocked={isPostedEdit}
          purchaseData={editingPurchase}
          onBack={closeEditing}
          onSuccess={handleEditFormSuccess}
        />
      </RouteProtection>
    )

  if (isViewing)
    return (
      <RouteProtection routeName="purchase">
        <PurchaseForm
          isViewMode={true}
          purchaseData={viewingPurchase}
          onBack={closeViewing}
          onSuccess={handleViewFormSuccess}
        />
      </RouteProtection>
    )

  if (loading) {
    return <LoadingScreen label="Loading Purchase Data..." />
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
        module="purchase"
        onSaved={handleSequenceSaved}
      />

      {/* --- HEADER SECTION --- */}
      <div className="shrink-0">
        {/* <nav className="flex items-center gap-2 mb-6 text-[10px] font-bold uppercase tracking-widest text-gray-400">
          <span>Commerce</span>
          <ArrowRight size={10} />
          <span className="text-black">Sales Performance</span>
        </nav> */}

        <motion.div
          initial="hidden"
          animate="visible"
          variants={fadeInUp}
          className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-4"
        >
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-black rounded-lg text-red-500 shadow-lg shadow-black/20">
                <ShoppingCart size={24} />
              </div>
              <h1 className="text-4xl font-black text-black tracking-tighter">
                Purchase <span className="text-red-600 italic">Order</span>
              </h1>
            </div>
            {/* <p className="text-xs font-bold text-gray-400 uppercase tracking-tight">
              Monitor real-time sales transactions and commercial volume.
            </p> */}
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
            <ProtectedAction routeName="purchase">
              <button
                onClick={startAdding}
                className="flex items-center gap-2 px-6 py-3 bg-black text-white text-xs font-bold rounded-xl hover:bg-red-600 transition-all shadow-lg tracking-widest uppercase"
              >
                <FilePlus size={14} />
                New Purchase
              </button>
            </ProtectedAction>
          </div>
        </motion.div>

        {/* --- SUMMARY TILES --- */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
          <SummaryTile
            label="Total Purchases"
            value={activeFilter ? filteredPurchases?.length || 0 : purchases?.length || 0}
            subText="Fetched"
            color="emerald"
            onClick={() => setActiveFilter(null)}
            isActive={activeFilter === null}
            icon={ShoppingCart}
          />
          <SummaryTile
            label="Prepared"
            value={
              activeFilter === 'PREPARED'
                ? filteredPurchases?.length || 0
                : purchases?.filter((p) => p.state === 'PREPARED').length || 0
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
                ? filteredPurchases?.length || 0
                : purchases?.filter((p) => p.state === 'CHECKED').length || 0
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
                ? filteredPurchases?.length || 0
                : purchases?.filter((p) => p.state === 'CANCELLED').length || 0
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
                ? filteredPurchases?.length || 0
                : purchases?.filter((p) => p.state === 'APPROVED').length || 0
            }
            subText="Transactions"
            color="emerald"
            onClick={() => setActiveFilter('APPROVED')}
            isActive={activeFilter === 'APPROVED'}
            icon={ShieldCheck}
          />
          <SummaryTile
            label="Total Amount Due"
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
          data={filteredPurchases}
          title="Purchase Ledger"
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
          checkboxColumn="id"
          checkboxCondition={checkboxCondition}
          enableActionColumn={true}
          actionButtons={[
            {
              label: 'View',
              onClick: handleViewPurchase,
            },
            {
              label: 'Edit',
              onClick: handleEditPurchase,
            },
            {
              label: 'Reverse',
              onClick: handleReversePurchase,
            },
          ]}
          badgeColumns={[
            {
              column: 'status',
              values: {
                PAID: 'green',
                UNPAID: 'red',
                'PARTIALLY PAID': 'yellow',
                OVERPAID: 'orange',
                REJECTED: 'red',
              },
            },
            {
              column: 'state',
              values: {
                PREPARED: 'orange',
                CHECKED: 'blue',
                APPROVED: 'green',
                REJECTED: 'red',
                CANCELLED: 'orange',
              },
            },
          ]}
          checkboxActions={getFilteredCheckboxActions([])}
          checkboxActionsFilter={getFilteredCheckboxActions}
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

  const isClickable = label !== 'Total Amount Due'

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
          {label === 'Total Amount Due' ? (
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
            <Icon size={20} className={`${isActive ? 'text-white' : (label === 'Total Amount Due' ? theme.text : color === 'dark' ? theme.text : 'text-gray-600')} ${isClickable ? 'group-hover:text-white' : ''} transition-colors`} />
          )}
          <span className={`text-2xl font-bold font-mono tracking-tight ${isActive ? 'text-white' : (label === 'Total Amount Due' ? theme.text : 'text-black')} ${isClickable ? 'group-hover:text-white' : ''}`}>
            {value}
          </span>
        </div>
      </div>
    </div>
  )
}
