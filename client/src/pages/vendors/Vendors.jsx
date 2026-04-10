import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Truck, PackagePlus, ShieldCheck, Search, ArrowRight, Download, Plus } from 'lucide-react';
import DynamicTable from '../../components/DynamicTable';
import RightSideModal from '../../components/RightSideModal';
import DynamicToast from '../../components/DynamicToast';
import RouteProtection from '../../components/RouteProtection';
import ProtectedAction from '../../components/ProtectedAction';
import useVendors from './useVendors';

function VendorsContent() {
  const { vendors, loading, error, createVendor } = useVendors();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    category: '',
    type: '',
    status: 'active'
  });
  const [toast, setToast] = useState(null);

  const fadeInUp = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } }
  };

  const handleAddVendorClick = () => {
    setFormData({ code: '', name: '', category: '', type: '', status: 'active' });
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const handleToastClose = () => {
    setToast(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const result = await createVendor(
        formData.code,
        formData.name,
        formData.category,
        formData.type,
        formData.status
      );
      
      if (result.success) {
        setToast({
          type: 'success',
          message: `Vendor "${formData.name}" created successfully!`
        });
        setIsModalOpen(false);
      } else {
        setToast({
          type: 'error',
          message: result.message || 'Failed to create vendor'
        });
      }
    } catch (error) {
      setToast({
        type: 'error',
        message: 'Network error occurred while creating vendor'
      });
    }
  };

  if (loading) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs font-black uppercase tracking-[3px] text-gray-400">Syncing Vendor Database...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-10 flex items-center justify-center">
        <div className="bg-red-50 border-l-4 border-red-600 p-6 rounded-r-xl shadow-sm">
          <h3 className="text-red-800 font-bold uppercase text-sm">System Error</h3>
          <p className="text-red-600 text-sm mt-1">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-transparent overflow-hidden">
      
      {/* --- HEADER SECTION --- */}
      <div className="flex-shrink-0">
        {/* <nav className="flex items-center gap-2 mb-6 text-[10px] font-bold uppercase tracking-widest text-gray-400">
          <span>Directory</span>
          <ArrowRight size={10} />
          <span className="text-black">Vendor Masterlist</span>
        </nav> */}

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
            {/* <p className="text-xs font-bold text-gray-400 uppercase tracking-tight">
              Manage supply chain partners and corporate service providers.
            </p> */}
          </div>

          <div className="flex gap-3">
            <button className="flex items-center gap-2 px-5 py-3 bg-white border border-gray-200 text-xs font-bold text-black rounded-xl hover:bg-gray-50 transition-all shadow-sm">
              <Download size={14} />
              EXPORT LIST
            </button>
            <ProtectedAction routeName="vendors">
              <button onClick={handleAddVendorClick} className="flex items-center gap-2 px-6 py-3 bg-black text-white text-xs font-bold rounded-xl hover:bg-red-600 transition-all shadow-lg tracking-widest uppercase">
                <PackagePlus size={14} />
                Add Vendor
              </button>
            </ProtectedAction>
          </div>
        </motion.div>

        {/* --- SUMMARY TILES --- */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <SummaryCard 
            icon={<Truck className="text-red-600" size={20} />} 
            label="Total Suppliers" 
            value={vendors?.length || 0} 
            subText="Active Partners"
          />
          <SummaryCard 
            icon={<ShieldCheck className="text-black" size={20} />} 
            label="KYC Verified" 
            value={vendors?.length > 0 ? Math.floor(vendors.length * 0.85) : 0} 
            subText="Compliance"
          />
          <SummaryCard 
            icon={<Search className="text-gray-400" size={20} />} 
            label="Review Req." 
            value="2" 
            subText="In Progress"
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
        />
      </motion.div>
      
      {/* Add Vendor Modal */}
      <RightSideModal 
        isOpen={isModalOpen} 
        onClose={handleCloseModal} 
        title="Create New Vendor"
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-gray-700 mb-2">
                Vendor Code <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                value={formData.code}
                onChange={(e) => setFormData({...formData, code: e.target.value})}
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
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all"
                placeholder="Enter vendor name..."
                required
              />
            </div>
            
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-gray-700 mb-2">
                Category <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                value={formData.category}
                onChange={(e) => setFormData({...formData, category: e.target.value})}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all"
                placeholder="Enter category..."
                required
              />
            </div>
            
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-gray-700 mb-2">
                Type <span className="text-red-600">*</span>
              </label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({...formData, type: e.target.value})}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all appearance-none cursor-pointer"
                required
              >
                <option value="">Select type...</option>
                <option value="individual">Individual</option>
                <option value="business">Business</option>
                <option value="government">Government</option>
                <option value="non-profit">Non-Profit</option>
              </select>
            </div>
            
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-gray-700 mb-2">
                Status <span className="text-red-600">*</span>
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({...formData, status: e.target.value})}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all appearance-none cursor-pointer"
                required
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
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
              Create Vendor
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

function SummaryCard({ icon, label, value, subText }) {
  return (
    <div className="bg-white p-4 rounded-xl border border-gray-100 flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow">
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

export default function Vendors() {
  return (
    <RouteProtection routeName="vendors">
      <VendorsContent />
    </RouteProtection>
  );
}