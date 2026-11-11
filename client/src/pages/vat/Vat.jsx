import React from 'react'
import { motion } from 'framer-motion'
import {
  Percent,
  ShieldCheck,
  Clock,
  Download,
  Plus,
  Edit2,
  Upload,
} from 'lucide-react'
import { DynamicTable, DynamicToast, LoadingScreen, RightSideModal } from '../../components/ui'
import { ProtectedAction, RouteProtection } from '../../components/access'
import useVat, { VAT_TYPES, VAT_SUB_TYPES, VAT_STATUSES } from './useVat'

function VatContent() {
  const {
    vat,
    vatDisplay,
    loading,
    error,
    toast,
    isModalOpen,
    editingVat,
    formData,
    isSubmitting,
    importing,
    exportVat,
    importVatFromFile,
    handleInputChange,
    handleSubmit,
    openModal,
    closeModal,
    setToast,
  } = useVat()

  const fadeInUp = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
  }

  if (loading) {
    return <LoadingScreen label="Loading VAT Data..." />
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
                <Percent size={24} />
              </div>
              <h1 className="text-4xl font-black text-black tracking-tighter">
                VAT <span className="text-red-600 italic">Management</span>
              </h1>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={exportVat}
              className="flex items-center gap-2 px-5 py-3 bg-green-600 text-white text-xs font-bold rounded-xl hover:bg-green-700 transition-all shadow-sm"
            >
              <Download size={14} />
              EXPORT DATA
            </button>
            <ProtectedAction routeName="vat">
              <label className="flex items-center gap-2 px-5 py-3 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-700 transition-all shadow-sm cursor-pointer">
                <Upload size={14} />
                {importing ? 'IMPORTING...' : 'IMPORT DATA'}
                <input
                  type="file"
                  accept=".csv"
                  onChange={importVatFromFile}
                  className="hidden"
                  disabled={importing}
                />
              </label>
            </ProtectedAction>
            <ProtectedAction routeName="vat">
              <button
                onClick={() => openModal()}
                className="flex items-center gap-2 px-6 py-3 bg-black text-white text-xs font-bold rounded-xl hover:bg-red-600 transition-all shadow-lg tracking-widest uppercase"
              >
                <Plus size={14} />
                New VAT
              </button>
            </ProtectedAction>
          </div>
        </motion.div>

        {/* --- SUMMARY TILES --- */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <SummaryCard
            icon={<Percent className="text-red-600" size={20} />}
            label="Total VAT Rates"
            value={vat?.length || 0}
            subText="Configured"
          />
          <SummaryCard
            icon={<ShieldCheck className="text-green-600" size={20} />}
            label="Active Rates"
            value={vat?.filter((v) => v.status === 'ACTIVE').length || 0}
            subText="In Use"
          />
          <SummaryCard
            icon={<Clock className="text-black" size={20} />}
            label="System Status"
            value="Active"
            subText="Operational"
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
          data={vatDisplay}
          title="VAT Configuration"
          enableAddButton={false}
          enableActionColumn={true}
          actionButtons={[
            {
              label: 'Edit',
              onClick: (row) => openModal(vat.find((item) => item.id === row.id)),
              icon: <Edit2 size={16} />,
            },
          ]}
          badgeColumns={[
            {
              column: 'status',
              values: {
                ACTIVE: 'green',
                INACTIVE: 'red',
              },
            },
            {
              column: 'type',
              values: {
                'Zero-rated': 'blue',
                Vatable: 'green',
                Exempt: 'gray',
              },
            },
          ]}
        />
      </motion.div>

      {/* Right Side Modal for Creating/Editing VAT Entry */}
      <RightSideModal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={editingVat ? 'Edit VAT Entry' : 'Create New VAT Entry'}
        size="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-gray-700 mb-2">
              VAT Code
            </label>
            <input
              type="text"
              name="code"
              value={formData.code}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-bold focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none"
              placeholder="Enter VAT code"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-gray-700 mb-2">
              VAT Name
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-bold focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none"
              placeholder="Enter VAT name"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-gray-700 mb-2">
              Rate (%)
            </label>
            <input
              type="number"
              name="rate"
              value={formData.rate}
              onChange={handleInputChange}
              step="0.01"
              min="0"
              max="100"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-bold focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none"
              placeholder="Enter rate"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-gray-700 mb-2">
              VAT Type
            </label>
            <select
              name="type"
              value={formData.type}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-bold focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none"
              required
            >
              <option value="">Select Type</option>
              {VAT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-gray-700 mb-2">
              Sub Type
            </label>
            <select
              name="sub_type"
              value={formData.sub_type}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-bold focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none"
            >
              <option value="">Select Sub Type</option>
              {VAT_SUB_TYPES.map((subType) => (
                <option key={subType} value={subType}>
                  {subType}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-gray-700 mb-2">
              Description
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-bold focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none resize-none"
              placeholder="Enter description"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-gray-700 mb-2">
              Status
            </label>
            <select
              name="status"
              value={formData.status}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-bold focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none"
              required
            >
              {VAT_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={closeModal}
              className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 text-xs font-bold rounded-lg hover:bg-gray-50 transition-colors"
            >
              CANCEL
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-4 py-3 bg-black text-white text-xs font-bold rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'SAVING...' : editingVat ? 'UPDATE VAT' : 'CREATE VAT'}
            </button>
          </div>
        </form>
      </RightSideModal>

      {/* Toast Notifications */}
      {toast && (
        <DynamicToast
          type={toast.type}
          message={toast.message}
          onClose={() => setToast(null)}
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

export default function Vat() {
  return (
    <RouteProtection routeName="vat">
      <VatContent />
    </RouteProtection>
  )
}
