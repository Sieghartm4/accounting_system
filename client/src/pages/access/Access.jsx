import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, Lock, Key, ArrowRight, ShieldAlert, Fingerprint, X, Plus, Trash2, ShieldOff } from 'lucide-react';
import DynamicTable from '../../components/DynamicTable';
import RightSideModal from '../../components/RightSideModal';
import DynamicToast from '../../components/DynamicToast';
import RouteProtection from '../../components/RouteProtection';
import ProtectedAction from '../../components/ProtectedAction';
import useAccess from './useAccess';

export default function Access() {
  return (
    <RouteProtection routeName="access">
      <AccessContent />
    </RouteProtection>
  );
}

function AccessContent() {
  const {
    access,
    loading,
    error,
    handleAccessRowClick,
    selectedAccessId,
    routeAccessData,
    routeAccessLoading,
    createAccess,
    updateRouteAccess,
    updateSingleRouteAccess
  } = useAccess();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    access_name: '',
    status: 'Full Access'
  });
  const [toast, setToast] = useState(null);

  const fadeInUp = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } }
  };

  const handleNewRoleClick = () => {
    setFormData({ access_name: '', status: 'active' });
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const handleToastClose = () => {
    setToast(null);
  };

  // Define select options for route access
  const routeAccessOptions = [
    { value: 'Full Access', label: 'Full Access' },
    { value: 'No Access', label: 'No Access' },
    { value: 'View Access', label: 'View Access' },
    { value: 'Edit Access', label: 'Edit Access' },
    { value: 'Check Access', label: 'Check Access' },
    { value: 'Approve Access', label: 'Approve Access' }
  ];

  // Handle individual row status change
  const handleRouteStatusChange = async (routeId, newStatus, row) => {
    try {
      // Prepare single update data
      const route_access_Data = {
        updates: [{
          id: row.id, // Use the actual row.id from the data
          access_id: selectedAccessId,
          status: newStatus
        }]
      };

      // Call the API with single update
      const result = await updateRouteAccess(route_access_Data);

      if (result.success) {
        setToast({
          type: 'success',
          message: `Route access updated to "${newStatus}"`
        });
      } else {
        setToast({
          type: 'error',
          message: result.message || 'Failed to update route access'
        });
      }
    } catch (error) {
      console.error('Error updating single route access:', error);
      setToast({
        type: 'error',
        message: 'Network error occurred while updating route access'
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const result = await createAccess(formData.access_name, formData.status);

      if (result.success) {
        setToast({
          type: 'success',
          message: `Access role "${formData.access_name}" created successfully!`
        });
        setIsModalOpen(false);
      } else {
        setToast({
          type: 'error',
          message: result.message || 'Failed to create access role'
        });
      }
    } catch (error) {
      setToast({
        type: 'error',
        message: 'Network error occurred while creating access role'
      });
    }
  };

  // --- CHECKBOX ACTIONS for Route Privileges table ---
  // Each action receives the array of selected full row objects.
  const routeCheckboxActions = [
    {
      label: 'Set Access',
      icon: <ShieldOff size={12} />,
      type: 'dropdown',
      options: [
        { value: 'Full Access', label: 'Full Access' },
        { value: 'No Access', label: 'No Access' },
        { value: 'View Access', label: 'View Access' },
        { value: 'Edit Access', label: 'Edit Access' },
        { value: 'Check Access', label: 'Check Access' },
        { value: 'Approve Access', label: 'Approve Access' }
      ],
      onChange: async (selectedRows, selectedValue) => {
        console.log(`Setting access to "${selectedValue}" for:`, selectedRows);

        try {
          // Prepare data for bulk update - updates array at root level
          const route_access_Data = {
            updates: selectedRows.map(row => ({
              id: row.id, // Use correct id field
              access_id: selectedAccessId,
              status: selectedValue
            }))
          };

          // Call the API once with all updates
          const result = await updateRouteAccess(route_access_Data);

          if (result.success) {
            // Update the status for each selected row locally
            selectedRows.forEach(row => {
              row.status = selectedValue;
            });

            setToast({
              type: 'success',
              message: `Access set to "${selectedValue}" for ${selectedRows.length} route(s).`
            });
          } else {
            setToast({
              type: 'error',
              message: result.message || 'Failed to update route access'
            });
          }
        } catch (error) {
          console.error('Error updating route access:', error);
          setToast({
            type: 'error',
            message: 'Network error occurred while updating route access'
          });
        }
      }
    }
  ];

  if (loading) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs font-black uppercase tracking-[3px] text-gray-400">Loading Permissions...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-10 flex items-center justify-center">
        <div className="bg-red-50 border-l-4 border-red-600 p-6 rounded-r-xl shadow-sm">
          <h3 className="text-red-800 font-bold uppercase text-sm">Auth Error</h3>
          <p className="text-red-600 text-sm mt-1">{error}</p>
        </div>
      </div>
    );
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
            <div className="flex items-center gap-3">
              <div className="p-2 bg-black rounded-lg text-red-500 shadow-lg shadow-red-900/10">
                <ShieldCheck size={24} />
              </div>
              <h1 className="text-4xl font-black text-black tracking-tighter">
                Access <span className="text-red-600 italic">Management</span>
              </h1>
            </div>
            <p className="text-gray-500 text-sm font-medium">
              Define user roles, route permissions, and system-wide security protocols.
            </p>
          </div>

          <div className="flex gap-3">
            <ProtectedAction routeName="access">
              <button onClick={handleNewRoleClick} className="flex items-center gap-2 px-6 py-3 bg-black text-white text-xs font-bold rounded-xl hover:bg-red-600 transition-all shadow-lg tracking-widest uppercase">
                <Lock size={14} />
                New Role
              </button>
            </ProtectedAction>
          </div>
        </motion.div>

        {/* --- SECURITY STATUS TILES --- */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <SecurityCard
            icon={<Key className="text-red-600" size={20} />}
            label="Active Roles"
            value={access?.length || 0}
            subText="Defined"
          />
          <SecurityCard
            icon={<Fingerprint className="text-black" size={20} />}
            label="MFA Enabled"
            value="100%"
            subText="Strict Mode"
          />
          <SecurityCard
            icon={<ShieldAlert className="text-gray-400" size={20} />}
            label="Blocked IPs"
            value="0"
            subText="No threats"
          />
        </div>
      </div>

      {/* --- TWO-COLUMN GRID SECTION --- */}
      <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-2 gap-8 pb-4">

        {/* LEFT COLUMN: Main Access Table */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex flex-col min-h-0 bg-white rounded-2xl shadow-xl shadow-black/5 overflow-hidden border border-gray-100"
        >
          <DynamicTable
            data={access}
            title="System Roles"
            enableRowClick={true}
            enableAddButton={false}
            returnColumn="access_id"
            onRowClick={handleAccessRowClick}
            highlightRow={selectedAccessId ? { column: 'access_id', value: selectedAccessId } : null}
            badgeColumns={[
              {
                column: 'status',
                values: {
                  'ACTIVE': 'green',
                  'INACTIVE': 'red',
                  'PENDING': 'yellow'
                }
              }
            ]}
          />
        </motion.div>

        {/* RIGHT COLUMN: Route Access Details */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex flex-col min-h-0"
        >
          {selectedAccessId ? (
            routeAccessLoading ? (
              <div className="h-full w-full flex flex-col items-center justify-center bg-white rounded-2xl border border-dashed border-gray-200">
                <div className="w-8 h-8 border-2 border-red-600 border-t-transparent rounded-full animate-spin mb-2"></div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Fetching Routes...</p>
              </div>
            ) : (
              <div className="flex-1 min-h-0 bg-white rounded-2xl shadow-xl shadow-black/5 overflow-hidden border border-gray-100 border-l-4">
                <DynamicTable
                  data={routeAccessData}
                  title="Route Privileges"
                  enableRowClick={false}
                  enableAddButton={false}
                  optionColumns={new Set(['status'])}
                  onOptionChange={handleRouteStatusChange}
                  selectOptions={routeAccessOptions}
                  enableCheckbox={true}
                  checkboxColumn="route_id"
                  checkboxActions={routeCheckboxActions}
                />
              </div>
            )
          ) : (
            <div className="h-full flex flex-col items-center justify-center bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200 p-10 text-center">
              <div className="p-4 bg-white rounded-full shadow-sm mb-4">
                <ShieldCheck className="text-gray-200" size={40} />
              </div>
              <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest">Select a Role</h3>
              <p className="text-xs text-gray-400 mt-2 max-w-[200px]">
                Choose an access level from the left to inspect specific route permissions.
              </p>
            </div>
          )}
        </motion.div>
      </div>

      {/* Add Role Modal */}
      <RightSideModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title="Create New Role"
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-gray-700 mb-2">
                Role Name <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                value={formData.access_name}
                onChange={(e) => setFormData({ ...formData, access_name: e.target.value })}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all"
                placeholder="Enter role name..."
                required
              />
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-gray-700 mb-2">
                Status <span className="text-red-600">*</span>
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all appearance-none cursor-pointer"
                required
              >
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
              </select>
            </div>
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
              Create Role
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
  );
}

function SecurityCard({ icon, label, value, subText }) {
  return (
    <div className="bg-white p-4 rounded-xl border border-gray-100 flex items-center gap-4 shadow-sm hover:border-red-100 transition-colors">
      <div className="p-3 bg-gray-50 rounded-xl">{icon}</div>
      <div>
        <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 leading-none mb-1">{label}</p>
        <div className="flex items-baseline gap-2">
          <h4 className="text-xl font-black text-black">{value}</h4>
          <span className="text-[9px] font-bold text-gray-400 uppercase">{subText}</span>
        </div>
      </div>
    </div>
  );
}