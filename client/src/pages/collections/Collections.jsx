import React from 'react'
import { motion } from 'framer-motion'
import {
  FilePlus,
  Layers,
  CheckCircle,
  ShieldCheck,
  Wallet,
  Download,
  FileText,
  Building,
  ClipboardList,
  XCircle,
  Clock3,
  ListStart,
} from 'lucide-react'
import { DynamicConfirmModal, DynamicTable, DynamicToast, LoadingScreen } from '../../components/ui'
import { SequenceSettingsModal } from '../../components/modals'
import { ProtectedAction, RouteProtection } from '../../components/access'
import useCollections from './useCollections'
import CollectionsForm from './CollectionsForm'

export default function Collections() {
  return (
    <RouteProtection routeName="collections">
      <CollectionsContent />
    </RouteProtection>
  )
}

function CollectionsContent() {
  const {
    collections,
    loading,
    loadingMore,
    hasMore,
    error,
    isAdding,
    closeAdding,
    handleAddFormSuccess,
    selectedSales,
    selectedSalesItems,
    isViewing,
    viewingCollection,
    closeViewing,
    isEditing,
    editingCollection,
    isPostedEdit,
    closeEditing,
    handleEditFormSuccess,
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
    activeTab,
    setActiveTab,
    toBeCollectedData,
    loadingToBeCollected,
    expandedCustomer,
    toggleCustomerExpansion,
    handleCustomerCheckboxChange,
    handleSalesCheckboxChange,
    sameCustomerOnlyCondition,
    handleCollectSelectedCustomers,
    startCollectForSales,
    filteredCollections,
    filteredTotalCollectedAmount,
    fetchAndDownloadPDF,
    handleApproveSelected,
    handleCancelSelected,
    handleViewCollection,
    handleEditCollection,
    handleReverseCollection,
    loadMore,
  } = useCollections()

  const checkboxCondition = null // Always show checkboxes (match Receipts/Sales behavior)

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
        label: 'Customer Copy',
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
          (row) =>
            row.state !== 'CANCELLED' &&
            row.state !== 'REJECTED' &&
            row.state !== 'APPROVED',
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
      <RouteProtection routeName="collections">
        <CollectionsForm
          onBack={closeAdding}
          onSuccess={handleAddFormSuccess}
          preSelectedSales={selectedSales}
          preSelectedSalesItems={selectedSalesItems}
        />
      </RouteProtection>
    )

  if (isViewing)
    return (
      <RouteProtection routeName="collections">
        <CollectionsForm
          isViewMode={true}
          collectionData={viewingCollection}
          onBack={closeViewing}
        />
      </RouteProtection>
    )

  if (isEditing)
    return (
      <RouteProtection routeName="collections">
        <CollectionsForm
          isEditMode={true}
          isPostedLocked={isPostedEdit}
          collectionData={editingCollection}
          onBack={closeEditing}
          onSuccess={handleEditFormSuccess}
        />
      </RouteProtection>
    )

  if (loading) {
    return <LoadingScreen label="Loading Collections Data..." />
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

  // Tab switcher shared by both tab headers — sits beside the page title
  // (no extra vertical space), inset slate track with distinct active pill
  // and per-tab count badges so the switch is hard to miss.
  const tabPills = (
    <div className="ml-4 flex items-center bg-slate-100 p-1.5 rounded-xl border border-slate-200 shadow-inner">
      <button
        onClick={() => setActiveTab('collections')}
        className={`transition-all duration-200 ease-in-out pl-5 pr-1 py-2.5 rounded-lg text-xs font-black tracking-wider uppercase flex items-center gap-2 focus:outline-none ${
          activeTab === 'collections'
            ? 'bg-red-600 text-white shadow'
            : 'text-slate-600 hover:text-black hover:bg-white/70'
        }`}
      >
        <CheckCircle size={14} />
        <span>Collected</span>
        <span
          className={`ml-1 text-[10px] px-2 py-0.5 rounded-full font-bold ${
            activeTab === 'collections'
              ? 'bg-white/20 text-white'
              : 'bg-slate-200 text-slate-700'
          }`}
        >
          {collections?.length || 0}
        </span>
      </button>

      <button
        onClick={() => setActiveTab('toBeCollected')}
        className={`transition-all duration-200 ease-in-out pl-5 pr-1 py-2.5 rounded-lg text-xs font-black tracking-wider uppercase flex items-center gap-2 focus:outline-none ${
          activeTab === 'toBeCollected'
            ? 'bg-red-600 text-white shadow'
            : 'text-slate-600 hover:text-black hover:bg-white/70'
        }`}
      >
        <Clock3 size={14} />
        <span>To Be Collected</span>
        <span
          className={`ml-1 text-[10px] px-2 py-0.5 rounded-full font-bold ${
            activeTab === 'toBeCollected'
              ? 'bg-white/20 text-white'
              : 'bg-slate-200 text-slate-700'
          }`}
        >
          {toBeCollectedData?.length || 0}
        </span>
      </button>
    </div>
  )

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
        module="collections"
        onSaved={handleSequenceSaved}
      />

      {/* --- HEADER SECTION --- */}
      <div className="shrink-0">
        {/* Tab Navigation */}

        {activeTab === 'collections' && (
          <>
            <motion.div
              initial="hidden"
              animate="visible"
              variants={fadeInUp}
              className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-4"
            >
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="p-2 bg-black rounded-lg text-red-500 shadow-lg shadow-black/20">
                    <Layers size={24} />
                  </div>
                  <h1 className="text-4xl font-black text-black tracking-tighter leading-tight self-center">
                    <span className="text-red-600 italic">Collections</span>
                  </h1>
                  {tabPills}
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
                <ProtectedAction routeName="collections">
                  <button
                    onClick={() => setActiveTab('toBeCollected')}
                    className="flex items-center gap-2 px-6 py-3 bg-black text-white text-xs font-bold rounded-xl hover:bg-red-600 transition-all shadow-lg tracking-widest uppercase"
                  >
                    <FilePlus size={14} />
                    New Collection
                  </button>
                </ProtectedAction>
              </div>
            </motion.div>

            {/* --- SUMMARY TILES --- */}
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
              <SummaryTile
                label="Total Collections"
                value={activeFilter ? filteredCollections?.length || 0 : collections?.length || 0}
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
                    ? filteredCollections?.length || 0
                    : collections?.filter((c) => c.state === 'PREPARED').length || 0
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
                    ? filteredCollections?.length || 0
                    : collections?.filter((c) => c.state === 'CHECKED').length || 0
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
                    ? filteredCollections?.length || 0
                    : collections?.filter((c) => c.state === 'CANCELLED').length || 0
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
                    ? filteredCollections?.length || 0
                    : collections?.filter((c) => c.state === 'APPROVED').length || 0
                }
                subText="Transactions"
                color="emerald"
                onClick={() => setActiveFilter('APPROVED')}
                isActive={activeFilter === 'APPROVED'}
                icon={ShieldCheck}
              />
              <SummaryTile
                label="Total Collected"
                value={`₱ ${filteredTotalCollectedAmount.toLocaleString('en-PH', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  }) || '0.00'}`}
                subText="PHP"
                color="dark"
                icon={Wallet}
              />
            </div>
          </>
        )}

        {activeTab === 'toBeCollected' && (
          <>
            <motion.div
              initial="hidden"
              animate="visible"
              variants={fadeInUp}
              className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-4"
            >
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="p-2 bg-black rounded-lg text-red-500 shadow-lg shadow-black/20">
                    <Wallet size={24} />
                  </div>
                  <h1 className="text-4xl font-black text-black tracking-tighter leading-tight self-center">
                    <span className="text-red-600 italic">To Be Collected</span>
                  </h1>
                  {tabPills}
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
                <ProtectedAction routeName="collections">
                  <button
                    onClick={() => setActiveTab('toBeCollected')}
                    className="flex items-center gap-2 px-6 py-3 bg-black text-white text-xs font-bold rounded-xl hover:bg-red-600 transition-all shadow-lg tracking-widest uppercase"
                  >
                    <FilePlus size={14} />
                    New Collection
                  </button>
                </ProtectedAction>
              </div>
            </motion.div>

            {/* --- SUMMARY TILES --- */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <SummaryTile
                label="Approved Sales"
                value={
                  toBeCollectedData?.reduce((count, c) => {
                    return (
                      count +
                      (c.sales?.filter((s) => s.state === 'APPROVED').length || 0)
                    )
                  }, 0) || 0
                }
                subText="Transactions"
                color="blue"
                icon={CheckCircle}
              />
              <SummaryTile
                label="Total Customers"
                value={toBeCollectedData?.length || 0}
                subText="Clients"
                color="orange"
                icon={Building}
              />
              <SummaryTile
                label="Total Unpaid Amount"
                value={`₱ ${toBeCollectedData
                    ?.reduce((sum, c) => sum + (parseFloat(c.totalUnpaid) || 0), 0)
                    .toLocaleString('en-PH', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    }) || '0.00'}`}
                subText="PHP"
                color="dark"
                icon={Wallet}
              />
            </div>
          </>
        )}
      </div>
      {/* --- TABLE SECTION --- */}
      {activeTab === 'collections' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="flex-1 min-h-0 bg-white rounded-2xl shadow-xl shadow-black/5 overflow-hidden border border-gray-100"
        >
          <DynamicTable
            data={filteredCollections}
            title="Collections Ledger"
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
            columns={[
              {
                key: 'id',
                label: 'ID',
              },
              {
                key: 'document_reference',
                label: 'Document Reference',
              },
              {
                key: 'customer',
                label: 'Customer',
              },
              {
                key: 'collection_date',
                label: 'Collection Date',
              },
              {
                key: 'mode_of_payment',
                label: 'Mode of Payment',
              },
              {
                key: 'collected_amount',
                label: 'Collected Amount',
              },
              {
                key: 'remarks',
                label: 'Remarks',
              },
              {
                key: 'state',
                label: 'State',
              },
            ]}
            badgeColumns={[
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
            actionButtons={[
              {
                label: 'View',
                onClick: handleViewCollection,
              },
              {
                label: 'Edit',
                onClick: handleEditCollection,
              },
              {
                label: 'Reverse',
                onClick: handleReverseCollection,
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
      )}

      {activeTab === 'toBeCollected' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-12 gap-8 pb-4"
        >
          {loadingToBeCollected ? (
            <div className="col-span-1 md:col-span-12 h-full w-full flex flex-col items-center justify-center space-y-4">
              <div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-xs font-black uppercase tracking-[3px] text-gray-400">
                Loading To Be Collected...
              </p>
            </div>
          ) : (
            <>
              {/* LEFT COLUMN: Customer Table */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="col-span-1 md:col-span-4 flex flex-col min-h-0 bg-white rounded-2xl shadow-xl shadow-black/5 overflow-hidden border border-gray-100"
              >
                <DynamicTable
                  data={toBeCollectedData}
                  title=""
                  enableDateFilter={false}
                  enableAddButton={false}
                  enableCheckbox={false}
                  enableActionColumn={true}
                  enableRowClick={true}
                  returnColumn="customerId"
                  onRowClick={toggleCustomerExpansion}
                  checkboxColumn="customerId"
                  checkboxCondition={sameCustomerOnlyCondition}
                  onCheckboxChange={handleCustomerCheckboxChange}
                  checkboxActions={[
                    {
                      label: 'Collect Selected',
                      onClick: handleCollectSelectedCustomers,
                      style: 'red',
                    },
                  ]}
                  actionButtons={[
                    {
                      label: 'Collect',
                      icon: <Layers size={14} />,
                      onClick: (row) => startCollectForSales(row.sales),
                    },
                  ]}
                  columns={[
                    { key: 'customerName', label: 'Customer' },
                    {
                      key: 'totalUnpaid',
                      label: 'Total Unpaid',
                      render: (value) => (
                        <span>
                          <span className="text-green-600">₱</span>
                          <span className="ml-1">
                            {isNaN(value)
                              ? '0.00'
                              : parseFloat(value).toLocaleString('en-US', {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                          </span>
                        </span>
                      ),
                    },
                  ]}
                  hiddenColumns={new Set(['customerId', 'sales'])}
                  highlightRow={{ column: 'customerId', value: expandedCustomer }}
                />
              </motion.div>

              {/* RIGHT COLUMN: Sales Table */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="col-span-1 md:col-span-8 flex flex-col min-h-0 bg-white rounded-2xl shadow-xl shadow-black/5 overflow-hidden border border-gray-100"
              >
                <DynamicTable
                  data={
                    expandedCustomer
                      ? toBeCollectedData.find(
                          (c) => c.customerId === expandedCustomer,
                        )?.sales || []
                      : []
                  }
                  title=""
                  enableDateFilter={false}
                  enableAddButton={false}
                  enableCheckbox={true}
                  enableActionColumn={false}
                  checkboxColumn="id"
                  checkboxCondition={sameCustomerOnlyCondition}
                  onCheckboxChange={handleSalesCheckboxChange}
                  checkboxActions={[
                    {
                      label: 'Collect Selected',
                      onClick: startCollectForSales,
                      style: 'red',
                    },
                  ]}
                  columns={[
                    { key: 'id', label: 'Sales ID' },
                    { key: 'doc_ref', label: 'Doc Ref' },
                    { key: 'terms', label: 'Terms' },
                    { key: 'date_delivered', label: 'Date Delivered' },
                    { key: 'date_due', label: 'Date Due' },
                    { key: 'remarks', label: 'Remarks' },
                    {
                      key: 'amount_due',
                      label: 'Amount Due',
                      render: (value) => (
                        <span>
                          <span className="text-green-600">₱</span>
                          <span className="ml-1">
                            {isNaN(value)
                              ? '0.00'
                              : parseFloat(value).toLocaleString('en-US', {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                          </span>
                        </span>
                      ),
                    },
                    { key: 'status', label: 'Status' },
                    { key: 'state', label: 'State' },
                  ]}
                  hiddenColumns={
                    new Set([
                      'customer_id',
                      'customer_name',
                      'totalUnpaid',
                      'unpaidAmount',
                      'sales_number',
                    ])
                  }
                  badgeColumns={[
                    {
                      column: 'status',
                      values: {
                        COLLECTED: 'green',
                        'NOT COLLECTED': 'red',
                        'PARTIALLY COLLECTED': 'yellow',
                        PAID: 'green',
                        UNPAID: 'red',
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
                />
              </motion.div>
            </>
          )}
        </motion.div>
      )}
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

  const isClickable = label !== 'Total Collected' && label !== 'Total Unpaid Amount'

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
          {(label === 'Total Collected' || label === 'Total Unpaid Amount') ? (
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
            <Icon size={20} className={`${isActive ? 'text-white' : ((label === 'Total Collected' || label === 'Total Unpaid Amount') ? theme.text : color === 'dark' ? theme.text : 'text-gray-600')} ${isClickable ? 'group-hover:text-white' : ''} transition-colors`} />
          )}
          <span className={`text-2xl font-bold font-mono tracking-tight ${isActive ? 'text-white' : ((label === 'Total Collected' || label === 'Total Unpaid Amount') ? theme.text : 'text-black')} ${isClickable ? 'group-hover:text-white' : ''}`}>
            {value}
          </span>
        </div>
      </div>
    </div>
  )
}
