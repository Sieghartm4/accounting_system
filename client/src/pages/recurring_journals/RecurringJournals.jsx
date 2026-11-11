import React from 'react'
import { motion } from 'framer-motion'
import {
  FilePlus,
  Download,
  CheckCircle,
  Repeat,
  Calendar,
  Play,
  Zap,
} from 'lucide-react'
import { DynamicConfirmModal, DynamicTable, DynamicToast, LoadingScreen } from '../../components/ui'
import { ProtectedAction, RouteProtection } from '../../components/access'
import useRecurringJournals from './useRecurringJournals'
import RecurringJournalsForm from './RecurringJournalsForm'

export default function RecurringJournals() {
  return (
    <RouteProtection routeName="recurring_journals">
      <RecurringJournalsContent />
    </RouteProtection>
  )
}

function RecurringJournalsContent() {
  const {
    templates,
    loading,
    loadingMore,
    error,
    hasMore,
    isAdding,
    startAdding,
    isViewing,
    isEditing,
    viewingTemplate,
    handleBack,
    handleFormSuccess,
    closeViewing,
    toast,
    closeToast,
    confirmModal,
    closeConfirmModal,
    confirmAndClose,
    activeTemplates,
    dueTemplates,
    handleGenerateAllDue,
    handleViewTemplate,
    handleEditTemplate,
    handleGenerateTemplate,
    handleDeleteTemplate,
    loadMore,
  } = useRecurringJournals()

  const fadeInUp = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
  }

  if (isAdding)
    return (
      <RouteProtection routeName="recurring_journals">
        <RecurringJournalsForm
          isEditMode={isEditing}
          templateData={isEditing ? viewingTemplate : null}
          onBack={handleBack}
          onSuccess={handleFormSuccess}
        />
      </RouteProtection>
    )

  if (isViewing)
    return (
      <RouteProtection routeName="recurring_journals">
        <RecurringJournalsForm
          isViewMode={true}
          templateData={viewingTemplate}
          onBack={closeViewing}
        />
      </RouteProtection>
    )

  if (loading) {
    return <LoadingScreen label="Loading Recurring Journals Data..." />
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
                <Repeat size={24} />
              </div>
              <h1 className="text-4xl font-black text-black tracking-tighter">
                <span className="text-red-600 italic">Recurring Journals</span>
              </h1>
            </div>
          </div>

          <div className="flex flex-col md:flex-row md:items-center gap-3">
            <button
              onClick={handleGenerateAllDue}
              className="flex items-center gap-2 px-5 py-3 bg-blue-600 border border-blue-700 text-xs font-bold text-white rounded-xl hover:bg-blue-700 transition-all shadow-sm"
            >
              <Play size={14} />
              Generate All Due
            </button>
            <button className="flex items-center gap-2 px-5 py-3 bg-white border border-gray-200 text-xs font-bold text-black rounded-xl hover:bg-gray-50 transition-all shadow-sm">
              <Download size={14} />
              EXPORT DATA
            </button>
            <ProtectedAction routeName="recurring_journals">
              <button
                onClick={startAdding}
                className="flex items-center gap-2 px-6 py-3 bg-black text-white text-xs font-bold rounded-xl hover:bg-red-600 transition-all shadow-lg tracking-widest uppercase"
              >
                <FilePlus size={14} />
                New Template
              </button>
            </ProtectedAction>
          </div>
        </motion.div>

        {/* --- SUMMARY TILES --- */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <SummaryCard
            icon={<Repeat className="text-red-600" size={20} />}
            label="Total Templates"
            value={templates?.length || 0}
            subText="Journal Templates"
          />
          <SummaryCard
            icon={<CheckCircle className="text-green-600" size={20} />}
            label="Active Templates"
            value={activeTemplates?.length || 0}
            subText="Currently Running"
          />
          <SummaryCard
            icon={<Calendar className="text-blue-600" size={20} />}
            label="Due for Generation"
            value={dueTemplates?.length || 0}
            subText="Ready to Process"
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
          data={templates}
          title="Recurring Journal Templates"
          enableAddButton={false}
          enableCheckbox={false}
          enableActionColumn={true}
          hiddenColumns={new Set(['created_date', 'created_by', 'updated_date', 'updated_by'])}
          columns={[
            { key: 'id', label: 'ID' },
            { key: 'reference', label: 'Reference' },
            { key: 'name', label: 'Template Name' },
            { key: 'frequency', label: 'Frequency' },
            { key: 'interval', label: 'Interval' },
            { key: 'start_date', label: 'Start Date' },
            { key: 'end_date', label: 'End Date' },
            { key: 'next_due_date', label: 'Next Due Date' },
            { key: 'item_count', label: 'Items' },
            { key: 'total_amount', label: 'Total Amount' },
            { key: 'status', label: 'Status' },
          ]}
          actionButtons={[
            {
              label: 'View',
              onClick: handleViewTemplate,
            },
            {
              label: 'Edit',
              onClick: handleEditTemplate,
            },
            {
              label: 'Generate',
              color: 'text-blue-600 hover:bg-blue-50',
              onClick: handleGenerateTemplate,
            },
            {
              label: 'Delete',
              color: 'text-red-600 hover:bg-red-50',
              onClick: handleDeleteTemplate,
            },
          ]}
          badgeColumns={[
            {
              column: 'status',
              values: {
                ACTIVE: 'green',
                INACTIVE: 'gray',
              },
            },
          ]}
          enableInfiniteScroll={true}
          hasMore={hasMore}
          isLoadingMore={loadingMore}
          onLoadMore={loadMore}
        />
      </motion.div>
    </div>
  )
}

// Reusable SummaryCard
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
