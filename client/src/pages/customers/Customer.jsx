import React, { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Users,
  UserPlus,
  ShieldCheck,
  Search,
  ArrowRight,
  Download,
  X,
  Plus,
  Edit2,
} from 'lucide-react'
import DynamicTable from '../../components/DynamicTable'
import RightSideModal from '../../components/RightSideModal'
import DynamicToast from '../../components/DynamicToast'
import RouteProtection from '../../components/RouteProtection'
import ProtectedAction from '../../components/ProtectedAction'
import useCustomer from './useCustomer'

function CustomerContent() {
  const { customers, loading, error, createCustomer, updateCustomer } = useCustomer()

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState(null)
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    category: '',
    type: '',
    address: '',
    tin: '',
    details: '',
    contact: '',
    status: 'active',
  })
  const [toast, setToast] = useState(null)

  const fadeInUp = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
  }

  const handleAddCustomerClick = () => {
    setEditingCustomer(null)
    setFormData({
      code: '',
      name: '',
      category: '',
      type: '',
      address: '',
      tin: '',
      details: '',
      contact: '',
      status: 'active',
    })
    setIsModalOpen(true)
  }

  const handleEditCustomerClick = (row) => {
    setEditingCustomer(row)
    setFormData({
      code: row.code || '',
      name: row.name || '',
      category: row.category || '',
      type: row.type || '',
      address: row.address || '',
      tin: row.tin || '',
      details: row.details || '',
      contact: row.contact || '',
      status:
        row.status?.toLowerCase() === 'inactive'
          ? 'inactive'
          : row.status?.toLowerCase() === 'active'
            ? 'active'
            : 'active',
    })
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setEditingCustomer(null)
  }

  const handleToastClose = () => {
    setToast(null)
  }

  const formatTinInput = (value) => {
    const digits = value.replace(/\D/g, '').slice(0, 12)
    let formatted = ''
    if (digits.length > 0) formatted += digits.substring(0, 3)
    if (digits.length > 3) formatted += '-' + digits.substring(3, 6)
    if (digits.length > 6) formatted += '-' + digits.substring(6, 9)
    if (digits.length > 9) formatted += '-' + digits.substring(9, 12)
    return formatted
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      const result = editingCustomer
        ? await updateCustomer(
            editingCustomer.id,
            formData.code,
            formData.name,
            formData.category,
            formData.type,
            formData.address,
            formData.tin,
            formData.details,
            formData.contact,
            formData.status,
          )
        : await createCustomer(
            formData.code,
            formData.name,
            formData.category,
            formData.type,
            formData.address,
            formData.tin,
            formData.details,
            formData.contact,
          )

      if (result.success) {
        setToast({
          type: 'success',
          message: `Customer "${formData.name}" ${editingCustomer ? 'updated' : 'created'} successfully!`,
        })
        setIsModalOpen(false)
        setEditingCustomer(null)
      } else {
        setToast({
          type: 'error',
          message:
            result.message ||
            `Failed to ${editingCustomer ? 'update' : 'create'} customer`,
        })
      }
    } catch (error) {
      setToast({
        type: 'error',
        message: `Network error occurred while ${editingCustomer ? 'updating' : 'creating'} customer`,
      })
    }
  }

  if (loading) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs font-black uppercase tracking-[3px] text-gray-400">
          Syncing Database...
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

  return (
    <div className="h-full flex flex-col bg-transparent overflow-hidden">
      {/* --- HEADER SECTION (Fixed height) --- */}
      <div className="flex-shrink-0">
        {/* <nav className="flex items-center gap-2 mb-6 text-[10px] font-bold uppercase tracking-widest text-gray-400">
          <span>Directory</span>
          <ArrowRight size={10} />
          <span className="text-black">Customer Masterlist</span>
        </nav> */}

        <motion.div
          initial="hidden"
          animate="visible"
          variants={fadeInUp}
          className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-4"
        >
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-black rounded-lg text-red-500">
                <Users size={24} />
              </div>
              <h1 className="text-4xl font-black text-black tracking-tighter">
                Customer <span className="text-red-600 italic">Management</span>
              </h1>
            </div>
          </div>

          <div className="flex gap-3">
            <button className="flex items-center gap-2 px-5 py-3 bg-white border border-gray-200 text-xs font-bold text-black rounded-xl hover:bg-gray-50 transition-all shadow-sm">
              <Download size={14} />
              EXPORT
            </button>
            <ProtectedAction routeName="customers">
              <button
                onClick={handleAddCustomerClick}
                className="flex items-center gap-2 px-6 py-3 bg-black text-white text-xs font-bold rounded-xl hover:bg-red-600 transition-all shadow-lg tracking-widest uppercase"
              >
                <UserPlus size={14} />
                Add Account
              </button>
            </ProtectedAction>
          </div>
        </motion.div>

        {/* --- SUMMARY TILES --- */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <SummaryCard
            icon={<Users className="text-red-600" size={20} />}
            label="Total Entities"
            value={customers?.length || 0}
            subText="Accounts"
          />
          <SummaryCard
            icon={<ShieldCheck className="text-black" size={20} />}
            label="Verified"
            value={Math.floor((customers?.length || 0) * 0.9)}
            subText="Compliance"
          />
          <SummaryCard
            icon={<Search className="text-gray-400" size={20} />}
            label="Pending"
            value="3"
            subText="Queue"
          />
        </div>
      </div>

      {/* --- TABLE SECTION (Flex-1 tells it to take remaining space) --- */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="flex-1 min-h-0 bg-white rounded-2xl shadow-xl shadow-black/5 overflow-hidden border border-gray-100"
      >
        <DynamicTable
          data={customers}
          title="Customers"
          enableAddButton={false}
          enableActionColumn={true}
          actionButtons={[
            {
              label: 'Edit',
              onClick: (row) => handleEditCustomerClick(row),
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

      {/* Add Customer Modal */}
      <RightSideModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={editingCustomer ? 'Edit Customer' : 'Create New Customer'}
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-gray-700 mb-2">
                Customer Code <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all"
                placeholder="Enter customer code..."
                required
              />
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-gray-700 mb-2">
                Customer Name <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all"
                placeholder="Enter customer name..."
                required
              />
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-gray-700 mb-2">
                Category
              </label>
              <input
                type="text"
                value={formData.category}
                onChange={(e) =>
                  setFormData({ ...formData, category: e.target.value })
                }
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all"
                placeholder="Enter category..."
              />
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-gray-700 mb-2">
                Type
              </label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
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
                value={formData.address}
                onChange={(e) =>
                  setFormData({ ...formData, address: e.target.value })
                }
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all"
                placeholder="Enter address..."
                required
              />
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-gray-700 mb-2">
                TIN <span className="text-red-600">*</span>{' '}
                <span className="text-[9px] text-gray-400">(max 15 chars)</span>
              </label>
              <input
                type="text"
                value={formData.tin}
                onChange={(e) =>
                  setFormData({ ...formData, tin: formatTinInput(e.target.value) })
                }
                maxLength={15}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all"
                placeholder="Enter TIN (XXX-XXX-XXX-XXX)"
                required
              />
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-gray-700 mb-2">
                Details <span className="text-red-600">*</span>
              </label>
              <textarea
                value={formData.details}
                onChange={(e) =>
                  setFormData({ ...formData, details: e.target.value })
                }
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all min-h-[120px]"
                placeholder="Enter additional details..."
                required
              />
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-gray-700 mb-2">
                Contact <span className="text-red-600">*</span>{' '}
                <span className="text-[9px] text-gray-400">(max 15 chars)</span>
              </label>
              <input
                type="text"
                value={formData.contact}
                onChange={(e) =>
                  setFormData({ ...formData, contact: e.target.value.slice(0, 15) })
                }
                maxLength={15}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all"
                placeholder="Enter contact number..."
                required
              />
            </div>

            {editingCustomer && (
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-gray-700 mb-2">
                  Status <span className="text-red-600">*</span>
                </label>
                <select
                  value={formData.status}
                  onChange={(e) =>
                    setFormData({ ...formData, status: e.target.value })
                  }
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
              onClick={handleCloseModal}
              className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 text-xs font-black rounded-xl hover:bg-gray-200 transition-all uppercase tracking-widest"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-3 bg-black text-white text-xs font-black rounded-xl hover:bg-red-600 transition-all uppercase tracking-widest flex items-center justify-center gap-2"
            >
              <Plus size={14} />
              {editingCustomer ? 'Save Customer' : 'Create Customer'}
            </button>
          </div>
        </form>
      </RightSideModal>

      {/* Toast Notification */}
      {toast && (
        <DynamicToast
          type={toast.type}
          message={toast.message}
          onClose={handleToastClose}
          duration={4000}
        />
      )}
    </div>
  )
}

function SummaryCard({ icon, label, value, subText }) {
  return (
    <div className="bg-white p-4 rounded-xl border border-gray-100 flex items-center gap-4 shadow-sm">
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

export default function Customer() {
  return (
    <RouteProtection routeName="customers">
      <CustomerContent />
    </RouteProtection>
  )
}
