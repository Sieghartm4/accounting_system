import React from 'react';
import { motion } from 'framer-motion';
import { Package, PlusSquare, ShieldCheck, Layers, ArrowRight, Download } from 'lucide-react';
import DynamicTable from '../../components/DynamicTable';
import useProductService from './useProductService';

export default function ProductService() {
  const { productService, loading, error } = useProductService();

  const fadeInUp = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } }
  };

  if (loading) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs font-black uppercase tracking-[3px] text-gray-400">Syncing Inventory & Services...</p>
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
          <span>Masters</span>
          <ArrowRight size={10} />
          <span className="text-black">Product & Service Masterlist</span>
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
                <Package size={24} />
              </div>
              <h1 className="text-4xl font-black text-black tracking-tighter">
                Product & <span className="text-red-600 italic">Service</span>
              </h1>
            </div>
            {/* <p className="text-xs font-bold text-gray-400 uppercase tracking-tight">
              Manage your global catalog of physical goods and professional service offerings.
            </p> */}
          </div>

          <div className="flex gap-3">
            <button className="flex items-center gap-2 px-5 py-3 bg-white border border-gray-200 text-xs font-bold text-black rounded-xl hover:bg-gray-50 transition-all shadow-sm">
              <Download size={14} />
              EXPORT CATALOG
            </button>
            <button className="flex items-center gap-2 px-6 py-3 bg-black text-white text-xs font-bold rounded-xl hover:bg-red-600 transition-all shadow-lg tracking-widest uppercase">
              <PlusSquare size={14} />
              Add New
            </button>
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
        />
      </motion.div>
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