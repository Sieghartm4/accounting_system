import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { FileText, ClipboardCheck, ShieldCheck, Clock, ArrowRight, Download, Plus, X, Edit2 } from 'lucide-react';
import DynamicTable from '../../components/DynamicTable';
import RouteProtection from '../../components/RouteProtection';
import ProtectedAction from '../../components/ProtectedAction';
import RightSideModal from '../../components/RightSideModal';
import DynamicToast from '../../components/DynamicToast';
import useProforma from './useProforma';

function ProformaContent() {
  const { proforma, loading, error, chartsOfAccounts, coaLoading, createProformaEntry, updateProformaEntry } = useProforma();

  const fadeInUp = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } }
  };

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProforma, setEditingProforma] = useState(null);
  const [formData, setFormData] = useState({
    module: '',
    name: '',
    coa_id: '',
    t_account: ''
  });
  const [toast, setToast] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [coaSearchTerm, setCoaSearchTerm] = useState('');
  const [showCoaDropdown, setShowCoaDropdown] = useState(false);
  const coaDropdownRef = useRef(null);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    const result = editingProforma
      ? await updateProformaEntry(editingProforma.id, formData)
      : await createProformaEntry(formData);
    
    if (result.success) {
      setToast({ type: 'success', message: `Proforma entry ${editingProforma ? 'updated' : 'created'} successfully!` });
      setFormData({ module: '', name: '', coa_id: '', t_account: '' });
      setCoaSearchTerm('');
      setIsModalOpen(false);
      setEditingProforma(null);
    } else {
      setToast({ type: 'error', message: result.error || `Failed to ${editingProforma ? 'update' : 'create'} proforma entry` });
    }
    
    setIsSubmitting(false);
  };

  const openModal = (proformaData = null) => {
    if (proformaData) {
      setEditingProforma(proformaData);
      setFormData({
        module: proformaData.module || '',
        name: proformaData.name || proformaData.entry_name || '',
        coa_id: proformaData.coa_id || proformaData.chart_of_accounts_id || '',
        t_account: proformaData.t_account || ''
      });
      // Find and set COA search term for the selected COA
      const coaId = proformaData.coa_id || proformaData.chart_of_accounts_id;
      const coaName = proformaData.charts_of_accounts || proformaData.chart_of_accounts_name;
      
      // First try to match by ID
      let selectedCoa = chartsOfAccounts.find(coa => String(coa.id) === String(coaId));
      
      // If ID match fails, try to match by name
      if (!selectedCoa && coaName) {
        selectedCoa = chartsOfAccounts.find(coa => coa.name === coaName);
      }
      
      if (selectedCoa) {
        setCoaSearchTerm(`${selectedCoa.code} - ${selectedCoa.name}`);
        setFormData(prev => ({ ...prev, coa_id: selectedCoa.id }));
      } else {
        setCoaSearchTerm('');
      }
    } else {
      setEditingProforma(null);
      setFormData({ module: '', name: '', coa_id: '', t_account: '' });
      setCoaSearchTerm('');
    }
    setShowCoaDropdown(false);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingProforma(null);
    setFormData({ module: '', name: '', coa_id: '', t_account: '' });
    setCoaSearchTerm('');
  };

  const handleCoaSearch = (e) => {
    const value = e.target.value;
    setCoaSearchTerm(value);
    setShowCoaDropdown(true);
  };

  const handleCoaSelect = (coa) => {
    setFormData(prev => ({ ...prev, coa_id: coa.id }));
    setCoaSearchTerm(`${coa.code} - ${coa.name}`);
    setShowCoaDropdown(false);
  };

  const filteredCoa = chartsOfAccounts.filter(coa => 
    coa.code?.toLowerCase().includes(coaSearchTerm.toLowerCase()) ||
    coa.name?.toLowerCase().includes(coaSearchTerm.toLowerCase())
  );

  // Click outside handler for COA dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (coaDropdownRef.current && !coaDropdownRef.current.contains(event.target)) {
        setShowCoaDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (loading) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs font-black uppercase tracking-[3px] text-gray-400">Fetching Proforma Data...</p>
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
          <span>Billing & Invoicing</span>
          <ArrowRight size={10} />
          <span className="text-black">Proforma Entries</span>
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
                <FileText size={24} />
              </div>
              <h1 className="text-4xl font-black text-black tracking-tighter">
                Proforma <span className="text-red-600 italic">Invoicing</span>
              </h1>
            </div>
            {/* <p className="text-xs font-bold text-gray-400 uppercase tracking-tight">
              Review and manage preliminary invoices and draft financial entries.
            </p> */}
          </div>

          <div className="flex gap-3">
            <button className="flex items-center gap-2 px-5 py-3 bg-white border border-gray-200 text-xs font-bold text-black rounded-xl hover:bg-gray-50 transition-all shadow-sm">
              <Download size={14} />
              EXPORT DRAFTS
            </button>
            <ProtectedAction routeName="proforma_entries">
              <button onClick={openModal} className="flex items-center gap-2 px-6 py-3 bg-black text-white text-xs font-bold rounded-xl hover:bg-red-600 transition-all shadow-lg tracking-widest uppercase">
                <ClipboardCheck size={14} />
                New Entry
              </button>
            </ProtectedAction>
          </div>
        </motion.div>

        {/* --- SUMMARY TILES --- */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <SummaryCard 
            icon={<FileText className="text-red-600" size={20} />} 
            label="Draft Entries" 
            value={proforma?.length || 0} 
            subText="Pending Review"
          />
          <SummaryCard 
            icon={<Clock className="text-black" size={20} />} 
            label="Awaiting Approval" 
            value="12" 
            subText="Queue"
          />
          <SummaryCard 
            icon={<ShieldCheck className="text-gray-400" size={20} />} 
            label="Verification" 
            value="Active" 
            subText="System Status"
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
          data={proforma}
          title="Proforma Ledger"
          enableAddButton={false}
          enableActionColumn={true}
          actionButtons={[
            {
              label: 'Edit',
              onClick: (row) => openModal(row),
              icon: <Edit2 size={16} />
            }
          ]}
        />
      </motion.div>

      {/* Right Side Modal for Creating/Editing Entry */}
      <RightSideModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={editingProforma ? "Edit Proforma Entry" : "Create New Proforma Entry"}
        size="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-gray-700 mb-2">
              Module
            </label>
            <input
              type="text"
              name="module"
              value={formData.module}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-bold focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none"
              placeholder="Enter module name"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-gray-700 mb-2">
              Entry Name
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-bold focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none"
              placeholder="Enter entry name"
              required
            />
          </div>

          <div className="relative" ref={coaDropdownRef}>
            <label className="block text-xs font-black uppercase tracking-wider text-gray-700 mb-2">
              Chart of Accounts
            </label>
            <div className="relative">
              <input
                type="text"
                value={coaSearchTerm}
                onChange={handleCoaSearch}
                onFocus={() => setShowCoaDropdown(true)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-bold focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none"
                placeholder="Search Chart of Accounts..."
                required
              />
              {coaLoading && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin"></div>
                </div>
              )}
            </div>
            
            {/* Dropdown */}
            {showCoaDropdown && (
              <div className="absolute z-50 mt-1 w-full bg-white border border-gray-300 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {filteredCoa.length > 0 ? (
                  filteredCoa.map((coa) => (
                    <div
                      key={coa.id}
                      onClick={() => handleCoaSelect(coa)}
                      className="px-3 py-2 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                    >
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-bold text-gray-900">{coa.code}</span>
                        <span className="text-xs text-gray-600">{coa.type}</span>
                      </div>
                      <div className="text-xs text-gray-700 mt-1">{coa.name}</div>
                    </div>
                  ))
                ) : (
                  <div className="px-3 py-4 text-center text-gray-500 text-sm">
                    {coaLoading ? 'Loading...' : 'No Chart of Accounts found'}
                  </div>
                )}
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-gray-700 mb-2">
              T-Account
            </label>
            <input
              type="text"
              name="t_account"
              value={formData.t_account}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-bold focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none"
              placeholder="Enter T-account"
              required
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={handleCloseModal}
              className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 text-xs font-bold rounded-lg hover:bg-gray-50 transition-colors"
            >
              CANCEL
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-4 py-3 bg-black text-white text-xs font-bold rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (editingProforma ? 'UPDATING...' : 'CREATING...') : (editingProforma ? 'UPDATE ENTRY' : 'CREATE ENTRY')}
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

export default function Proforma() {
  return (
    <RouteProtection routeName="proforma_entries">
      <ProformaContent />
    </RouteProtection>
  );
}