import React from 'react'
import { motion } from 'framer-motion'
import {
  Truck,
  PackagePlus,
  ShieldCheck,
  Search,
  ArrowRight,
  Download,
  Plus,
  Edit2,
  Upload,
} from 'lucide-react'
import { DynamicTable, DynamicToast, LoadingScreen, RightSideModal, SummaryTile } from '../../components/ui'
import { ProtectedAction, RouteProtection } from '../../components/access'
import useVendors from './useVendors'

function VendorsContent() {
  const {
    vendors,
    loading,
    error,
    isModalOpen,
    editingVendor,
    formData,
    toast,
    importing,
    openModal,
    closeModal,
    handleInputChange,
    handleTinChange,
    handleContactChange,
    handleExportVendors,
    handleImportVendors,
    handleSubmit,
    closeToast,
  } = useVendors()

  const fadeInUp = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
  }

  if (loading) {
    return <LoadingScreen label="Loading Vendor Database..." />
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
                <Truck size={24} />
              </div>
              <h1 className="text-4xl font-black text-black tracking-tighter">
                Vendor <span className="text-red-600 italic">Registry</span>
              </h1>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleExportVendors}
              className="flex items-center gap-2 px-5 py-3 bg-green-600 text-white text-xs font-bold rounded-xl hover:bg-green-700 transition-all shadow-sm"
            >
              <Download size={14} />
              EXPORT LIST
            </button>
            <ProtectedAction routeName="vendors">
              <label className="flex items-center gap-2 px-5 py-3 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-700 transition-all shadow-sm cursor-pointer">
                <Upload size={14} />
                {importing ? 'IMPORTING...' : 'IMPORT'}
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleImportVendors}
                  className="hidden"
                  disabled={importing}
                />
              </label>
            </ProtectedAction>
            <ProtectedAction routeName="vendors">
              <button
                onClick={() => openModal()}
                className="flex items-center gap-2 px-6 py-3 bg-black text-white text-xs font-bold rounded-xl hover:bg-red-600 transition-all uppercase tracking-widest"
              >
                <PackagePlus size={14} />
                Add Vendor
              </button>
            </ProtectedAction>
          </div>
        </motion.div>

        {/* --- SUMMARY TILES --- */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <SummaryTile
            label="Total Suppliers"
            value={vendors?.length || 0}
            subText="Active Partners"
            color="rose"
            icon={Truck}
            hoverable
          />
          <SummaryTile
            label="KYC Verified"
            value={vendors?.length > 0 ? Math.floor(vendors.length * 0.85) : 0}
            subText="Compliance"
            color="blue"
            icon={ShieldCheck}
            hoverable
          />
          <SummaryTile
            label="Review Req."
            value={"2"}
            subText="In Progress"
            color="amber"
            icon={Search}
            hoverable
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
          data={vendors}
          title="Vendor table"
          enableAddButton={false}
          enableActionColumn={true}
          actionButtons={[
            {
              label: 'Edit',
              onClick: (row) => openModal(row),
              icon: <Edit2 size={16} />,
            },
          ]}
          badgeColumns={[
            {
              column: 'status',
              values: {
                ACTIVE: 'green',
                INACTIVE: 'red',
                PENDING: 'yellow',
              },
            },
          ]}
        />
      </motion.div>

      {/* Add Vendor Modal */}
      <RightSideModal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={editingVendor ? 'Edit Vendor' : 'Create New Vendor'}
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-gray-700 mb-2">
                Vendor Code <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                name="code"
                value={formData.code}
                onChange={handleInputChange}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all"
                placeholder="Enter vendor code..."
                required
              />
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-gray-700 mb-2">
                Vendor Name <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all"
                placeholder="Enter vendor name..."
                required
              />
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-gray-700 mb-2">
                Category
              </label>
              <input
                type="text"
                name="category"
                value={formData.category}
                onChange={handleInputChange}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all"
                placeholder="Enter category..."
              />
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-gray-700 mb-2">
                Type
              </label>
              <select
                name="type"
                value={formData.type}
                onChange={handleInputChange}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all appearance-none cursor-pointer"
              >
                <option value="">Select type...</option>
                <option value="Individual">Individual</option>
                <option value="Partnership">Partnership</option>
                <option value="Corporation">Corporation</option>
                <option value="Government">Government</option>
                <option value="Non - Profit">Non - Profit</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-gray-700 mb-2">
                Address <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                name="address"
                value={formData.address}
                onChange={handleInputChange}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all"
                placeholder="Enter address..."
                required
              />
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-gray-700 mb-2">
                TIN <span className="text-red-600">*</span>{' '}
                <span className="text-[9px] text-gray-400">(max 14 chars)</span>
              </label>
              <input
                type="text"
                value={formData.tin}
                onChange={handleTinChange}
                inputMode="numeric"
                maxLength={18}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all"
                placeholder="Enter TIN (XXX-XXX-XXX-XXXXX)"
                required
              />
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-gray-700 mb-2">
                Details
              </label>
              <textarea
                name="details"
                value={formData.details}
                onChange={handleInputChange}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all min-h-[120px]"
                placeholder="Enter additional details..."
              />
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-gray-700 mb-2">
                Contact{' '}
                <span className="text-[9px] text-gray-400">(max 15 chars)</span>
              </label>
              <input
                type="text"
                value={formData.contact}
                onChange={handleContactChange}
                maxLength={15}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all"
                placeholder="Enter contact number..."
              />
            </div>

            {editingVendor && (
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
              {editingVendor ? 'Save Vendor' : 'Create Vendor'}
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

export default function Vendors() {
  return (
    <RouteProtection routeName="vendors">
      <VendorsContent />
    </RouteProtection>
  )
}
