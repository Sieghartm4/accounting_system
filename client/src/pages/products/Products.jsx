import React from 'react'
import { motion } from 'framer-motion'
import {
  Package,
  PlusSquare,
  ShieldCheck,
  Layers,
  ArrowRight,
  Download,
  Upload,
  Plus,
  Edit2,
  Search,
} from 'lucide-react'
import { DynamicTable, DynamicToast, LoadingScreen, RightSideModal } from '../../components/ui'
import { ProtectedAction, RouteProtection } from '../../components/access'
import useProductService from './useProductService'

export default function ProductService() {
  return (
    <RouteProtection routeName="product_service">
      <ProductServiceContent />
    </RouteProtection>
  )
}

function ProductServiceContent() {
  const {
    productService,
    loading,
    error,
    isModalOpen,
    editingProductService,
    formData,
    toast,
    openModal,
    closeModal,
    handleInputChange,
    exportCatalog,
    handleImportCatalog,
    importing,
    handleSubmit,
    closeToast,
    syncModalOpen,
    syncCategories,
    selectedCategoryKeys,
    selectedSyncItems,
    syncSearchTerm,
    syncPreviewLoading,
    filteredSyncPreviewItems,
    allSyncChecked,
    someSyncChecked,
    loadSyncPreview,
    closeSyncModal,
    setSyncSearch,
    toggleCategorySelection,
    togglePreviewRow,
    isCategorySelected,
    handleToggleAllVisibleRows,
    handleSyncImport,
  } = useProductService()

  const fadeInUp = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
  }

  if (loading) {
    return <LoadingScreen label="Loading Product Catalog..." />
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
                <Package size={24} />
              </div>
              <h1 className="text-4xl font-black text-black tracking-tighter">
                Product & <span className="text-red-600 italic">Service</span>
              </h1>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={loadSyncPreview}
              disabled={syncPreviewLoading}
              className="flex items-center gap-2 px-5 py-3 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-700 transition-all shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <ArrowRight size={14} />
              {syncPreviewLoading ? 'Loading...' : 'Preview Sync'}
            </button>
            <button
              onClick={exportCatalog}
              className="flex items-center gap-2 px-5 py-3 bg-green-600 text-white text-xs font-bold rounded-xl hover:bg-green-700 transition-all shadow-sm"
            >
              <Download size={14} />
              EXPORT CATALOG
            </button>
            <ProtectedAction routeName="product_service">
              <label className="flex items-center gap-2 px-5 py-3 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-700 transition-all shadow-sm cursor-pointer">
                <Upload size={14} />
                {importing ? 'IMPORTING...' : 'IMPORT CATALOG'}
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleImportCatalog}
                  className="hidden"
                  disabled={importing}
                />
              </label>
            </ProtectedAction>
            <ProtectedAction routeName="product_service">
              <button
                onClick={() => openModal()}
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
            icon={<Package className="text-red-600" size={20} />}
            label="Total Items"
            value={productService?.length || 0}
            subText="SKUs / Services"
          />
          <SummaryCard
            icon={<Layers className="text-black" size={20} />}
            label="Categories"
            value="8"
            subText="Departmental Groups"
          />
          <SummaryCard
            icon={<ShieldCheck className="text-gray-400" size={20} />}
            label="Inventory Status"
            value="Synced"
            subText="Global Database"
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
          data={productService}
          title="Catalog Ledger"
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

      {/* Add Product/Service Modal */}
      <RightSideModal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={
          editingProductService
            ? 'Edit Product/Service'
            : 'Create New Product/Service'
        }
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-gray-700 mb-2">
                Product/Service Code <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                name="code"
                value={formData.code}
                onChange={handleInputChange}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all"
                placeholder="Enter product/service code..."
                required
              />
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-gray-700 mb-2">
                Product/Service Name <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all"
                placeholder="Enter product/service name..."
                required
              />
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-gray-700 mb-2">
                Type <span className="text-red-600">*</span>
              </label>
              <select
                name="type"
                value={formData.type}
                onChange={handleInputChange}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all appearance-none cursor-pointer"
                required
              >
                <option value="">Select type...</option>
                <option value="product">Product</option>
                <option value="service">Service</option>
              </select>
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

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-gray-700 mb-2">
                  Sales Price
                </label>
                <input
                  type="number"
                  name="sales_price"
                  step="0.01"
                  value={formData.sales_price}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-gray-700 mb-2">
                  Purchase Price
                </label>
                <input
                  type="number"
                  name="purchase_price"
                  step="0.01"
                  value={formData.purchase_price}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all"
                  placeholder="0.00"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-gray-700 mb-2">
                Unit
              </label>
              <select
                name="unit"
                value={formData.unit}
                onChange={handleInputChange}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all appearance-none cursor-pointer"
              >
                <option value="">Select unit...</option>
                <option value="pcs">Pieces</option>
                <option value="kg">Kilograms</option>
                <option value="l">Liters</option>
                <option value="m">Meters</option>
                <option value="box">Box</option>
                <option value="hour">Hour</option>
                <option value="day">Day</option>
                <option value="service">Service</option>
              </select>
            </div>
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
              Create Product/Service
            </button>
          </div>
        </form>
      </RightSideModal>

      <RightSideModal
        isOpen={syncModalOpen}
        onClose={closeSyncModal}
        title="Preview Inventory Sync"
        size="5xl"
      >
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            {syncCategories.map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => toggleCategorySelection(category)}
                className={`px-4 py-2 text-[10px] font-black uppercase tracking-[2px] rounded-full transition-all border ${
                  isCategorySelected(category)
                    ? 'bg-red-600 text-white border-red-600'
                    : 'bg-white text-red-600 border-red-600 hover:bg-red-50'
                }`}
              >
                {category}
              </button>
            ))}
          </div>

          <div className="overflow-x-auto border border-gray-100 rounded-3xl shadow-sm">
            <div className="p-4 border-b border-gray-100 bg-white">
              <div className="relative max-w-md w-full">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={syncSearchTerm}
                  onChange={(e) => setSyncSearch(e.target.value)}
                  placeholder="Search products, categories, company..."
                  className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
                />
              </div>
            </div>
            <table className="min-w-full border-collapse text-left">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-4 w-12">
                    <input
                      type="checkbox"
                      checked={allSyncChecked}
                      ref={(input) => {
                        if (input)
                          input.indeterminate = someSyncChecked && !allSyncChecked
                      }}
                      onChange={handleToggleAllVisibleRows}
                      className="h-4 w-4 accent-red-600"
                    />
                  </th>
                  <th className="px-3 py-4 text-[10px] font-black uppercase tracking-[2px] text-gray-500">
                    Code
                  </th>
                  <th className="px-3 py-4 text-[10px] font-black uppercase tracking-[2px] text-gray-500">
                    Name
                  </th>
                  <th className="px-3 py-4 text-[10px] font-black uppercase tracking-[2px] text-gray-500">
                    Category
                  </th>
                  <th className="px-3 py-4 text-[10px] font-black uppercase tracking-[2px] text-gray-500">
                    Unit
                  </th>
                  <th className="px-3 py-4 hidden xl:table-cell text-[10px] font-black uppercase tracking-[2px] text-gray-500">
                    Company
                  </th>
                  <th className="px-3 py-4 text-[10px] font-black uppercase tracking-[2px] text-gray-500">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredSyncPreviewItems.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-6 py-8 text-center text-sm text-gray-500"
                    >
                      No inventory items match your current filters.
                    </td>
                  </tr>
                ) : (
                  filteredSyncPreviewItems.map((item) => {
                    const key = String(item.code)
                    const checked = selectedSyncItems.has(key)
                    const visibleByCategory =
                      selectedCategoryKeys.size === 0 ||
                      selectedCategoryKeys.has(item.category)
                    if (!visibleByCategory) return null
                    return (
                      <tr
                        key={key}
                        className={`border-b border-gray-100 transition-colors ${checked ? 'bg-red-50' : 'hover:bg-gray-50'}`}
                      >
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => togglePreviewRow(item)}
                            className="h-4 w-4 accent-red-600"
                          />
                        </td>
                        <td className="px-3 py-3 text-sm font-bold text-gray-700">
                          {item.code}
                        </td>
                        <td className="px-3 py-3 text-sm text-gray-700">
                          {item.name}
                        </td>
                        <td className="px-3 py-3 text-sm text-gray-700">
                          {item.category}
                        </td>
                        <td className="px-3 py-3 text-sm text-gray-700">
                          {item.unit}
                        </td>
                        <td className="px-3 py-3 text-sm text-gray-700 hidden xl:table-cell">
                          {item.sourceCompanyName || '—'}
                        </td>
                        <td className="px-3 py-3 text-sm text-gray-700">
                          <span
                            className={`inline-flex rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-[1px] ${item.existsInDb ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}
                          >
                            {item.existsInDb ? 'Existing' : 'New'}
                          </span>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-xs text-gray-500">
              {selectedSyncItems.size} item(s) selected
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={closeSyncModal}
                className="px-4 py-3 bg-gray-100 text-gray-700 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-gray-200 transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSyncImport}
                className="px-4 py-3 bg-black text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-red-600 transition-all"
              >
                Import Selected
              </button>
            </div>
          </div>
        </div>
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
