import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { MapPin, Plus, Download, Edit2, ShieldCheck, Clock } from 'lucide-react'
import DynamicTable from '../../components/DynamicTable'
import RouteProtection from '../../components/RouteProtection'
import ProtectedAction from '../../components/ProtectedAction'
import RightSideModal from '../../components/RightSideModal'
import DynamicToast from '../../components/DynamicToast'
import useResponsibilityCenter from './useResponsibilityCenter'

function ResponsibilityCenterContent() {
  const {
    responsibilityCenters,
    loading,
    error,
    createResponsibilityCenter,
    updateResponsibilityCenter,
  } = useResponsibilityCenter()

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingCenter, setEditingCenter] = useState(null)
  const [formData, setFormData] = useState({
    id: '',
    code: '',
    name: '',
    department: '',
    status: 'ACTIVE',
  })
  const [toast, setToast] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const statusOptions = ['ACTIVE', 'INACTIVE']
  const departmentOptions = [
    { label: 'IT', value: 'IT' },
    { label: 'CABLING', value: 'CABLING' },
    { label: 'SHELL', value: 'SHELL' },
    { label: 'FINANCE', value: 'FINANCE' },
    { label: 'R&D', value: 'R&D' },
    { label: 'ADMIN', value: 'ADMIN' },
    { label: 'PERSONAL', value: 'PERSONAL' },
    { label: 'SALES', value: 'SALES' },
  ]

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsSubmitting(true)

    let result
    if (editingCenter) {
      result = await updateResponsibilityCenter(editingCenter.id, formData)
    } else {
      result = await createResponsibilityCenter(formData)
    }

    if (result.success) {
      setToast({
        type: 'success',
        message: `Responsibility center ${editingCenter ? 'updated' : 'created'} successfully`,
      })
      setFormData({
        id: '',
        code: '',
        name: '',
        department: '',
        status: 'ACTIVE',
      })
      setEditingCenter(null)
      setIsModalOpen(false)
    } else {
      setToast({
        type: 'error',
        message:
          result.error ||
          `Failed to ${editingCenter ? 'update' : 'create'} responsibility center`,
      })
    }

    setIsSubmitting(false)
  }

  const openModal = (center = null) => {
    if (center) {
      setEditingCenter(center)
      setFormData({
        id: center.id || '',
        code: center.code || '',
        name: center.name || '',
        department: center.department || '',
        status: center.status || 'ACTIVE',
      })
    } else {
      setEditingCenter(null)
      setFormData({
        id: '',
        code: '',
        name: '',
        department: '',
        status: 'ACTIVE',
      })
    }
    setIsModalOpen(true)
  }

  const handleExport = () => {
    try {
      if (
        !Array.isArray(responsibilityCenters) ||
        responsibilityCenters.length === 0
      ) {
        setToast({
          type: 'error',
          message: 'No responsibility center data to export',
        })
        return
      }

      const exclude = new Set(['id', '_id', 'action'])
      const rawHeaders = Object.keys(responsibilityCenters[0] || {})
      const headers = rawHeaders.filter((h) => !exclude.has(h))

      const csvRows = []
      csvRows.push(headers.join(','))

      responsibilityCenters.forEach((row) => {
        const values = headers.map((h) => {
          let val = row[h]
          if (val === null || val === undefined) return ''
          if (typeof val === 'object') {
            try {
              val = JSON.stringify(val)
            } catch (e) {
              val = String(val)
            }
          }
          const escaped = String(val).replace(/"/g, '""')
          return /[",\n]/.test(escaped) ? `"${escaped}"` : escaped
        })
        csvRows.push(values.join(','))
      })

      const csvContent = csvRows.join('\n')
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `responsibility_center_${Date.now()}.csv`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      setToast({ type: 'success', message: 'Export started' })
    } catch (err) {
      setToast({
        type: 'error',
        message: 'Failed to export responsibility center data',
      })
    }
  }

  if (loading) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs font-black uppercase tracking-[3px] text-gray-400">
          Fetching Responsibility Center Data...
        </p>
      </div>
    )
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

  return (
    <div className="h-full flex flex-col bg-transparent overflow-hidden">
      <div className="shrink-0">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={{
            hidden: { opacity: 0, y: 20 },
            visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
          }}
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
              className="flex items-center gap-2 px-5 py-3 bg-white border border-gray-200 text-xs font-bold text-black rounded-xl hover:bg-gray-50 transition-all shadow-sm"
            >
              <Download size={14} />
              EXPORT DATA
            </button>
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
        onClose={() => setIsModalOpen(false)}
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
              options={departmentOptions}
              onChange={(value) =>
                setFormData((prev) => ({ ...prev, department: value }))
              }
              onSelect={(option) =>
                setFormData((prev) => ({ ...prev, department: option.value }))
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
                {statusOptions.map((status) => (
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
              onClick={() => setIsModalOpen(false)}
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
          onClose={() => setToast(null)}
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
