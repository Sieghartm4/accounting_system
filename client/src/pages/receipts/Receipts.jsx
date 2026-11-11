import React from 'react'
import { motion } from 'framer-motion'
import {
  Receipt,
  FilePlus,
  ShieldCheck,
  Download,
  Check,
  FileText,
  Building,
  Wallet,
  CheckCircle,
  XCircle,
  ClipboardList,
  ListStart,
} from 'lucide-react'
import { DynamicConfirmModal, DynamicTable, DynamicToast, LoadingScreen, SummaryTile } from '../../components/ui'
import { SequenceSettingsModal } from '../../components/modals'
import { ProtectedAction, RouteProtection } from '../../components/access'
import useReceipts from './useReceipts'
import ReceiptsForm from './ReceiptsForm'

export default function Receipts() {
  return (
    <RouteProtection routeName="receipts">
      <ReceiptsContent />
    </RouteProtection>
  )
}

function ReceiptsContent() {
  const {
    receipts,
    loading,
    loadingMore,
    error,
    hasMore,
    isAdding,
    startAdding,
    closeAdding,
    viewingReceipt,
    isEditMode,
    isPostedEdit,
    closeViewing,
    handleFormSuccess,
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
    filteredReceipts,
    filteredTotalAmount,
    handleViewReceipt,
    handleEditReceipt,
    handleReverseReceipt,
    handleApproveSelected,
    handleCancelSelected,
    fetchAndDownloadPDF,
    loadMore,
  } = useReceipts()

  const checkboxCondition = null // Always show checkboxes

  // Function to filter checkbox actions based on selected rows' states
  const getFilteredCheckboxActions = (selectedRows) => {
    const allActions = [
      {
        label: 'Approve Selected',
        icon: <Check size={14} />,
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
        // ── Internal Copy → fetch data → generate + download PDF directly
        label: 'Internal Copy',
        icon: <FileText size={14} />,
        onClick: (selectedRows) => fetchAndDownloadPDF(selectedRows, 'internal'),
        style: 'blue', // Blue color for internal copy
      },
      {
        // ── Customer Copy → same but labelled differently in PDF
        label: 'Customer Copy',
        icon: <Building size={14} />,
        onClick: (selectedRows) => fetchAndDownloadPDF(selectedRows, 'customer'),
        style: 'orange', // Orange color for customer copy
      },
    ]

    // Filter Approve Selected button - show if at least one selected row is PREPARED or CHECKED
    return allActions.filter((action) => {
      if (action.label === 'Approve Selected') {
        // Show approve button if at least one selected row has state PREPARED or CHECKED
        return selectedRows.some(
          (row) => row.state === 'PREPARED' || row.state === 'CHECKED',
        )
      }
      if (action.label === 'Cancel Selected') {
        return selectedRows.some(
          (row) => row.state !== 'CANCELLED' && row.state !== 'REJECTED' && row.state !== 'APPROVED',
        )
      }
      return true // Always show other actions
    })
  }

  const fadeInUp = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
  }

  if (isAdding)
    return (
      <RouteProtection routeName="receipts">
        <ReceiptsForm
          onBack={closeAdding}
          onSuccess={handleFormSuccess}
        />
      </RouteProtection>
    )

  if (viewingReceipt)
    return (
      <RouteProtection routeName="receipts">
        <ReceiptsForm
          isViewMode={!isEditMode}
          isEditMode={isEditMode}
          isPostedLocked={isPostedEdit}
          receiptData={viewingReceipt}
          onBack={closeViewing}
          onSuccess={handleFormSuccess}
        />
      </RouteProtection>
    )

  if (loading) {
    return <LoadingScreen label="Loading Receipts Data..." />
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
        module="receipts"
        onSaved={handleSequenceSaved}
      />

      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
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
                <Receipt size={24} />
              </div>
              <h1 className="text-4xl font-black text-black tracking-tighter">
                Cash <span className="text-red-600 italic">Receipts</span>
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
            <ProtectedAction routeName="receipts">
              <button
                onClick={startAdding}
                className="flex items-center gap-2 px-6 py-3 bg-black text-white text-xs font-bold rounded-xl hover:bg-red-600 transition-all shadow-lg tracking-widest uppercase"
              >
                <FilePlus size={14} />
                New Receipt
              </button>
            </ProtectedAction>
          </div>
        </motion.div>

{/* ── SUMMARY TILES ──────────────────────────────────────────────────── */}
<div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
  <SummaryTile
    label="Total Receipts"
    value={activeFilter ? filteredReceipts?.length || 0 : receipts?.length || 0}
    subText="Fetched"
    color="emerald"
    onClick={() => setActiveFilter(null)}
    isActive={activeFilter === null}
    icon={Receipt}
  />
  <SummaryTile
    label="Prepared"
    value={
      activeFilter === 'PREPARED'
        ? filteredReceipts?.length || 0
        : receipts?.filter((r) => r.state === 'PREPARED').length || 0
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
        ? filteredReceipts?.length || 0
        : receipts?.filter((r) => r.state === 'CHECKED').length || 0
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
        ? filteredReceipts?.length || 0
        : receipts?.filter((r) => r.state === 'CANCELLED').length || 0
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
        ? filteredReceipts?.length || 0
        : receipts?.filter((r) => r.state === 'APPROVED').length || 0
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

      {/* ── TABLE ──────────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="flex-1 min-h-0 bg-white rounded-2xl shadow-xl shadow-black/5 overflow-hidden border border-gray-100"
      >
        <DynamicTable
          data={filteredReceipts}
          title="Receipt Ledger"
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
          enableInfiniteScroll={true}
          hasMore={hasMore}
          isLoadingMore={loadingMore}
          onLoadMore={() =>
            loadMore({ dateFrom: activeDateFrom, dateTo: activeDateTo })
          }
          enableActionColumn={true}
          badgeColumns={[
            {
              column: 'state',
              values: {
                PREPARED: 'yellow',
                CHECKED: 'blue',
                APPROVED: 'green',
                REJECTED: 'red',
                CANCELLED: 'orange',
              },
            },
          ]}
          actionButtons={[
            {
              label: 'View',
              onClick: handleViewReceipt,
            },
            {
              label: 'Edit',
              onClick: handleEditReceipt,
            },
            {
              label: 'Reverse',
              onClick: handleReverseReceipt,
            },
          ]}
          checkboxActions={getFilteredCheckboxActions([])}
          checkboxActionsFilter={getFilteredCheckboxActions}
        />
      </motion.div>
    </div>
  )
}
