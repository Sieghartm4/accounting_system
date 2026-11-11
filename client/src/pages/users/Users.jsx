import React, { useState } from 'react'
import { motion } from 'framer-motion'
import {
  UserCheck,
  UserPlus,
  Shield,
  ArrowRight,
  UserCog,
  Activity,
  Mail,
  X,
} from 'lucide-react'
import { DynamicTable, LoadingScreen, RightSideModal } from '../../components/ui'
import { ProtectedAction, RouteProtection } from '../../components/access'
import useUsers from './useUsers'

export default function Users() {
  return (
    <RouteProtection routeName="users">
      <UsersContent />
    </RouteProtection>
  )
}

function UsersContent() {
  const {
    users,
    loading,
    error,
    handleUserRowClick,
    showCreateForm,
    accessOptions,
    accessSearch,
    formData,
    formError,
    formSuccess,
    submitting,
    accessError,
    openCreateForm,
    closeCreateForm,
    handleAccessSearchChange,
    handleAccessSelect,
    handleCreateFormChange,
    handleCreateUserSubmit,
    showEditForm,
    editFormData,
    editAccessSearch,
    editFormError,
    editFormSuccess,
    editSubmitting,
    openEditForm,
    closeEditForm,
    handleEditAccessSearchChange,
    handleEditAccessSelect,
    handleEditFormChange,
    handleEditUserSubmit,
  } = useUsers()

  const fadeInUp = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
  }

  if (loading) {
    return <LoadingScreen label="Loading User Base..." />
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
      {/* --- PAGE HEADER & ACTIONS --- */}
      <div className="shrink-0">
        <RightSideModal
          isOpen={showCreateForm}
          onClose={closeCreateForm}
          title="Register New User"
          size="xl"
        >
          <div className="space-y-4">
            <p className="text-sm text-gray-500">
              Use the search dropdown to select an access role.
            </p>

            {formError && (
              <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">
                {formError}
              </div>
            )}
            {formSuccess && (
              <div className="rounded-xl bg-green-50 border border-green-200 p-4 text-sm text-green-700">
                {formSuccess}
              </div>
            )}

            <form onSubmit={handleCreateUserSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="block text-sm font-semibold text-gray-700">
                  Full Name
                  <input
                    name="fullname"
                    value={formData.fullname}
                    onChange={handleCreateFormChange}
                    className="mt-2 w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-black focus:border-red-500 focus:outline-none"
                    placeholder="Full Name"
                  />
                </label>

                <label className="block text-sm font-semibold text-gray-700">
                  Username
                  <input
                    name="username"
                    value={formData.username}
                    onChange={handleCreateFormChange}
                    className="mt-2 w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-black focus:border-red-500 focus:outline-none"
                    placeholder="Username"
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="block text-sm font-semibold text-gray-700">
                  Email
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleCreateFormChange}
                    className="mt-2 w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-black focus:border-red-500 focus:outline-none"
                    placeholder="Email (optional)"
                  />
                </label>

                <label className="block text-sm font-semibold text-gray-700">
                  Password
                  <input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleCreateFormChange}
                    className="mt-2 w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-black focus:border-red-500 focus:outline-none"
                    placeholder="Password"
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="block text-sm font-semibold text-gray-700">
                  Access Role
                  <SearchableDropdown
                    placeholder="Search access role"
                    value={accessSearch}
                    onChange={handleAccessSearchChange}
                    onSelect={handleAccessSelect}
                    options={accessOptions}
                    emptyText={accessError || 'No access roles found'}
                  />
                </label>
              </div>

              <div className="flex flex-col gap-3 md:flex-row md:justify-end">
                <button
                  type="button"
                  onClick={closeCreateForm}
                  className="rounded-2xl border border-gray-200 bg-white px-6 py-3 text-sm font-bold text-black hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-2xl bg-black px-6 py-3 text-sm font-bold text-white hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? 'Saving...' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </RightSideModal>

        <RightSideModal
          isOpen={showEditForm}
          onClose={closeEditForm}
          title="Edit User Role"
          size="xl"
        >
          <div className="space-y-4">
            <p className="text-sm text-gray-500">
              Update the user's access role and account status.
            </p>

            {editFormError && (
              <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">
                {editFormError}
              </div>
            )}
            {editFormSuccess && (
              <div className="rounded-xl bg-green-50 border border-green-200 p-4 text-sm text-green-700">
                {editFormSuccess}
              </div>
            )}

            <form onSubmit={handleEditUserSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="block text-sm font-semibold text-gray-700">
                  Access Role
                  <SearchableDropdown
                    placeholder="Search access role"
                    value={editAccessSearch}
                    onChange={handleEditAccessSearchChange}
                    onSelect={handleEditAccessSelect}
                    options={accessOptions}
                    emptyText={accessError || 'No access roles found'}
                  />
                </label>

                <label className="block text-sm font-semibold text-gray-700">
                  Status
                  <select
                    name="status"
                    value={editFormData.status}
                    onChange={handleEditFormChange}
                    className="mt-2 w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-black focus:border-red-500 focus:outline-none"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                    <option value="PENDING">PENDING</option>
                  </select>
                </label>
              </div>

              <div className="flex flex-col gap-3 md:flex-row md:justify-end">
                <button
                  type="button"
                  onClick={closeEditForm}
                  className="rounded-2xl border border-gray-200 bg-white px-6 py-3 text-sm font-bold text-black hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editSubmitting}
                  className="rounded-2xl bg-black px-6 py-3 text-sm font-bold text-white hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {editSubmitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </RightSideModal>

        <motion.div
          initial="hidden"
          animate="visible"
          variants={fadeInUp}
          className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-4"
        >
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-black rounded-xl text-red-500 shadow-xl shadow-black/20">
                <UserCog size={26} />
              </div>
              <h1 className="text-4xl font-black text-black tracking-tighter">
                Personnel <span className="text-red-600 italic">Accounts</span>
              </h1>
            </div>
          </div>

          <div className="flex gap-3">
            <button className="flex items-center gap-2 px-5 py-3 bg-white border border-gray-200 text-xs font-bold text-black rounded-xl hover:bg-gray-50 transition-all shadow-sm">
              <Mail size={16} className="text-red-600" />
              SEND INVITE
            </button>
            <ProtectedAction routeName="users">
              <button
                type="button"
                onClick={openCreateForm}
                className="flex items-center gap-2 px-6 py-3 bg-black text-white text-xs font-bold rounded-xl hover:bg-red-600 transition-all shadow-xl tracking-widest uppercase"
              >
                <UserPlus size={16} />
                Register User
              </button>
            </ProtectedAction>
          </div>
        </motion.div>

        {/* --- USER STATISTICS TILES --- */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <AccountCard
            icon={<UserCheck className="text-red-600" size={20} />}
            label="Total Personnel"
            value={users?.length || 0}
            subText="Active Profiles"
          />
          <AccountCard
            icon={<Shield className="text-black" size={20} />}
            label="Super Admins"
            value="2"
            subText="Elevated Access"
          />
          <AccountCard
            icon={<Activity className="text-green-600" size={20} />}
            label="Online Now"
            value="Active"
            subText="Live Sync"
          />
        </div>
      </div>

      {/* --- TABLE SECTION (The "Fixed" Container) --- */}
      <motion.div
        initial={{ opacity: 0, scale: 0.99 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2 }}
        className="flex-1 min-h-0 bg-white rounded-2xl shadow-2xl shadow-gray-200/50 overflow-hidden border border-gray-100"
      >
        <DynamicTable
          data={users}
          title="Users table"
          enableAddButton={false}
          enableRowClick={false}
          enableActionColumn={true}
          hiddenColumns={new Set(['access_id'])}
          actionButtons={[
            {
              label: 'Edit',
              onClick: openEditForm,
            },
          ]}
          returnColumn="username"
          onRowClick={handleUserRowClick}
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
    </div>
  )
}

function AccountCard({ icon, label, value, subText }) {
  return (
    <div className="bg-white p-4 rounded-xl border border-gray-100 flex items-center gap-4 shadow-sm hover:border-red-100 transition-colors group">
      <div className="p-3 bg-gray-50 rounded-xl group-hover:bg-red-50/50 transition-colors">
        {icon}
      </div>
      <div>
        <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-1 leading-none">
          {label}
        </p>
        <div className="flex items-baseline gap-2">
          <h4 className="text-xl font-black text-black leading-none">{value}</h4>
          <span className="text-[9px] font-bold text-gray-400 uppercase">
            {subText}
          </span>
        </div>
      </div>
    </div>
  )
}

function SearchableDropdown({
  placeholder,
  value,
  onChange,
  onSelect,
  options,
  emptyText,
}) {
  const [open, setOpen] = useState(false)

  const searchTerm = String(value || '').toLowerCase()
  const filteredOptions = (options || []).filter((option) =>
    option?.label?.toLowerCase().includes(searchTerm),
  )

  return (
    <div className="relative">
      <input
        type="text"
        value={value}
        onChange={(event) => {
          onChange(event.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        className="mt-2 w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-black focus:border-red-500 focus:outline-none"
      />
      {open && (
        <div className="absolute z-50 mt-2 max-h-56 w-full overflow-auto rounded-2xl border border-gray-200 bg-white shadow-xl">
          {filteredOptions.length > 0 ? (
            filteredOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
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
