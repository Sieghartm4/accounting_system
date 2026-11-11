import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { MapPin, Plus, Download, Edit2, ShieldCheck, Clock, Upload } from 'lucide-react'
import { DynamicTable, DynamicToast, LoadingScreen, RightSideModal } from '../../components/ui'
import { ProtectedAction, RouteProtection } from '../../components/access'
import useResponsibilityCenter, {
  STATUS_OPTIONS,
  DEPARTMENT_OPTIONS,
} from './useResponsibilityCenter'

function ResponsibilityCenterContent() {
  const {
    responsibilityCenters,
    loading,
    error,
    isModalOpen,
    editingCenter,
    formData,
    toast,
    isSubmitting,
    importing,
    openModal,
    closeModal,
    handleInputChange,
    handleSubmit,
    handleExport,
    handleImportResponsibilityCenter,
    closeToast,
  } = useResponsibilityCenter()

  if (loading) {
    return <LoadingScreen label="Loading Responsibility Center Data..." />
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

  const transformedData = responsibilityCenters.map((item) => ({
    ...item,
  }))

  const fadeInUp = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
  }

  return (
    <div className="h-full flex flex-col bg-transparent overflow-hidden">
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
                <MapPin size={24} />
              </div>
              <h1 className="text-4xl font-black text-black tracking-tighter">
                Responsibility Center{' '}
                <span className="text-red-600 italic">Management</span>
              </h1>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-5 py-3 bg-green-600 text-white text-xs font-bold rounded-xl hover:bg-green-700 transition-all shadow-sm"
            >
              <Download size={14} />
              EXPORT DATA
            </button>
            <ProtectedAction routeName="responsibility_center">
              <label className="flex items-center gap-2 px-5 py-3 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-700 transition-all shadow-sm cursor-pointer">
                <Upload size={14} />
                {importing ? 'IMPORTING...' : 'IMPORT DATA'}
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleImportResponsibilityCenter}
                  className="hidden"
                  disabled={importing}
                />
              </label>
            </ProtectedAction>
            <ProtectedAction routeName="responsibility_center">
              <button
                onClick={() => openModal()}
                className="flex items-center gap-2 px-6 py-3 bg-black text-white text-xs font-bold rounded-xl hover:bg-red-600 transition-all shadow-lg tracking-widest uppercase"
              >
                <Plus size={14} />
                New Center
              </button>
            </ProtectedAction>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <SummaryCard
            icon={<MapPin className="text-red-600" size={20} />}
            label="Total Centers"
            value={responsibilityCenters?.length || 0}
            subText="Configured"
          />
          <SummaryCard
            icon={<ShieldCheck className="text-green-600" size={20} />}
            label="Active Centers"
            value={
              responsibilityCenters?.filter((item) => item.status === 'ACTIVE')
                .length || 0
            }
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

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="flex-1 min-h-0 bg-white rounded-2xl shadow-xl shadow-black/5 overflow-hidden border border-gray-100"
      >
        <DynamicTable
          data={transformedData}
          title="Responsibility Center Configuration"
          enableAddButton={false}
          enableActionColumn={true}
          actionButtons={[
            {
              label: 'Edit',
              onClick: (row) =>
                openModal(responsibilityCenters.find((item) => item.id === row.id)),
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
          ]}
        />
      </motion.div>

      <RightSideModal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={
          editingCenter
            ? 'Edit Responsibility Center'
            : 'Create New Responsibility Center'
        }
        size="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-gray-700 mb-2">
              Center Code
            </label>
            <input
              type="text"
              name="code"
              value={formData.code}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-bold focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none"
              placeholder={
                editingCenter
                  ? 'Leave blank to keep current code or auto-generate a new one'
                  : 'Leave blank to auto-generate code'
              }
            />
          </div>

          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-gray-700 mb-2">
              Center Name
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-bold focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none"
              placeholder="Enter center name"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-gray-700 mb-2">
              Department
            </label>
            <SearchableDropdown
              placeholder="Search or select department"
              value={formData.department}
              options={DEPARTMENT_OPTIONS}
              onChange={(value) => handleInputChange({ target: { name: 'department', value } })}
              onSelect={(option) =>
                handleInputChange({ target: { name: 'department', value: option.value } })
              }
              emptyText="No matching departments"
            />
          </div>

          {editingCenter && (
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
                {STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>
          )}

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
              {isSubmitting
                ? 'SAVING...'
                : editingCenter
                  ? 'UPDATE CENTER'
                  : 'CREATE CENTER'}
            </button>
          </div>
        </form>
      </RightSideModal>

      {toast && (
        <DynamicToast
          type={toast.type}
          message={toast.message}
          onClose={closeToast}
        />
      )}
    </div>
  )
}

function SearchableDropdown({
  placeholder,
  value,
  onChange,
  onSelect,
  options,
  emptyText = 'No results found',
}) {
  const [open, setOpen] = useState(false)
  const searchTerm = String(value || '').toLowerCase()
  const filteredOptions = (options || []).filter((option) =>
    option.label.toLowerCase().includes(searchTerm),
  )

  return (
    <div className="relative w-full">
      <input
        type="text"
        value={value}
        onChange={(event) => {
          onChange(event.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-bold focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none"
        autoComplete="off"
      />
      {open && (
        <div className="absolute z-50 mt-1 w-full max-h-56 overflow-auto rounded-2xl border border-gray-200 bg-white shadow-xl">
          {(filteredOptions || []).length > 0 ? (
            filteredOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault()
                  onSelect(option)
                  setOpen(false)
                }}
                className="w-full text-left px-4 py-3 text-sm text-black hover:bg-gray-100"
              >
                {option.label}
              </button>
            ))
          ) : (
            <div className="px-4 py-3 text-sm text-gray-500">{emptyText}</div>
          )}
        </div>
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

export default function ResponsibilityCenter() {
  return (
    <RouteProtection routeName="responsibility_center">
      <ResponsibilityCenterContent />
    </RouteProtection>
  )
}
