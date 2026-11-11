import React from 'react'
import { motion } from 'framer-motion'
import {
  BookOpen,
  FilePlus,
  ShieldCheck,
  PieChart,
  Download,
  Plus,
  Edit2,
  Upload,
} from 'lucide-react'
import { DynamicTable, DynamicToast, LoadingScreen, RightSideModal } from '../../components/ui'
import { ProtectedAction, RouteProtection } from '../../components/access'
import useChartsOfAccounts from './useChartsOfAccounts'

function ChartsOfAccountsContent() {
  const {
    chartsOfAccounts,
    loading,
    error,
    isModalOpen,
    editingChart,
    formData,
    toast,
    importing,
    openModal,
    closeModal,
    exportChartsOfAccounts,
    importChartsOfAccountsFromFile,
    handleInputChange,
    handleSubmit,
    closeToast,
  } = useChartsOfAccounts()

  const fadeInUp = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
  }

  if (loading) {
    return <LoadingScreen label="Loading Financial Structure..." />
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
                <BookOpen size={24} />
              </div>
              <h1 className="text-4xl font-black text-black tracking-tighter">
                Chart of <span className="text-red-600 italic">Accounts</span>
              </h1>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={exportChartsOfAccounts}
              className="flex items-center gap-2 px-5 py-3 bg-green-600 text-white text-xs font-bold rounded-xl hover:bg-green-700 transition-all shadow-sm"
            >
              <Download size={14} />
              EXPORT COA
            </button>
            <ProtectedAction routeName="charts">
              <label className="flex items-center gap-2 px-5 py-3 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-700 transition-all shadow-sm cursor-pointer">
                <Upload size={14} />
                {importing ? 'IMPORTING...' : 'IMPORT COA'}
                <input
                  type="file"
                  accept=".csv"
                  onChange={importChartsOfAccountsFromFile}
                  className="hidden"
                  disabled={importing}
                />
              </label>
            </ProtectedAction>
            <ProtectedAction routeName="charts">
              <button
                onClick={() => openModal()}
                className="flex items-center gap-2 px-6 py-3 bg-black text-white text-xs font-bold rounded-xl hover:bg-red-600 transition-all shadow-lg tracking-widest uppercase"
              >
                <FilePlus size={14} />
                New Account
              </button>
            </ProtectedAction>
          </div>
        </motion.div>

        {/* --- SUMMARY TILES --- */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <SummaryCard
            icon={<BookOpen className="text-red-600" size={20} />}
            label="Total Accounts"
            value={chartsOfAccounts?.length || 0}
            subText="Active COA"
          />
          <SummaryCard
            icon={<PieChart className="text-black" size={20} />}
            label="Main Categories"
            value="5"
            subText="Asset/Liab/Eq/Inc/Exp"
          />
          <SummaryCard
            icon={<ShieldCheck className="text-gray-400" size={20} />}
            label="Status"
            value="Audit"
            subText="Verified Ready"
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
          data={chartsOfAccounts}
          title="Master Ledger"
          enableAddButton={false}
          enableActionColumn={true}
          actionButtons={[
            {
              label: 'Edit',
              onClick: (row) => openModal(row),
              icon: <Edit2 size={16} />,
            },
          ]}
        />
      </motion.div>

      {/* Add/Edit Chart of Account Modal */}
      <RightSideModal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={
          editingChart ? 'Edit Chart of Account' : 'Create New Chart of Account'
        }
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-gray-700 mb-2">
                Account Code <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                name="code"
                value={formData.code}
                onChange={handleInputChange}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all"
                placeholder="Enter account code..."
                required
              />
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-gray-700 mb-2">
                Account Name <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all"
                placeholder="Enter account name..."
                required
              />
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-gray-700 mb-2">
                Account Type <span className="text-red-600">*</span>
              </label>
              <select
                name="type"
                value={formData.type}
                onChange={handleInputChange}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all appearance-none cursor-pointer"
                required
              >
                <option value="">Select account type...</option>
                <option value="ASSETS">Assets</option>
                <option value="LIABILITIES">Liabilities</option>
                <option value="EQUITY">Equity</option>
                <option value="REVENUE">Revenue</option>
                <option value="EXPENSES">Expenses</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-gray-700 mb-2">
                Description <span className="text-red-600">*</span>
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all resize-none"
                placeholder="Enter account description..."
                rows={3}
                required
              />
            </div>

            {editingChart && (
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-gray-700 mb-2">
                  Status <span className="text-red-600">*</span>
                </label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all appearance-none cursor-pointer"
                  required
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={closeModal}
              className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 text-xs font-black rounded-xl hover:bg-gray-200 transition-all uppercase tracking-widest"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-3 bg-black text-white text-xs font-black rounded-xl hover:bg-red-600 transition-all uppercase tracking-widest flex items-center justify-center gap-2"
            >
              <Plus size={14} />
              {editingChart ? 'Update Account' : 'Create Account'}
            </button>
          </div>
        </form>
      </RightSideModal>

      {/* Toast Notification */}
      {toast && (
        <DynamicToast
          type={toast.type}
          message={toast.message}
          onClose={closeToast}
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

export default function ChartsOfAccounts() {
  return (
    <RouteProtection routeName="charts">
      <ChartsOfAccountsContent />
    </RouteProtection>
  )
}
