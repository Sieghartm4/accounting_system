import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, ShoppingBag, ShieldCheck, Zap, ArrowRight, Download } from 'lucide-react';
import DynamicTable from '../../components/DynamicTable';
import DynamicToast from '../../components/DynamicToast';
import RouteProtection from '../../components/RouteProtection';
import ProtectedAction from '../../components/ProtectedAction';
import useSales from './useSales';
import SalesForm from './SalesForm';
import { getAccessLevel } from '../../utils/routeProtection';

export default function Sales() {
  return (
    <RouteProtection routeName="sales">
      <SalesContent />
    </RouteProtection>
  );
}

function SalesContent() {
  const { sales, loading, error, refetchSales } = useSales();
  const [isAdding, setIsAdding] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingSales, setEditingSales] = useState(null);
  const [isViewing, setIsViewing] = useState(false);
  const [viewingSales, setViewingSales] = useState(null);
  const [toast, setToast] = useState(null);

  // Check if user has access to enable checkboxes
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const accessLevel = getAccessLevel('sales', user);
  const enableCheckboxes = accessLevel === 'Check Access' || accessLevel === 'Approve Access' || accessLevel === 'Full Access';

  // Determine checkbox condition based on access level
  const checkboxCondition = enableCheckboxes
    ? accessLevel === 'Full Access' 
      ? { column: 'state', value: 'APPROVED', exclude: true } // Exclude APPROVED state for Full Access
      : { column: 'state', value: accessLevel === 'Check Access' ? 'PREPARED' : 'CHECKED' }
    : null;

  const fadeInUp = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } }
  };

  if (isAdding) return (
    <RouteProtection routeName="sales">
      <SalesForm
        onBack={() => setIsAdding(false)}
        onSuccess={async (nextToast) => {
          if (nextToast) setToast(nextToast);
          await refetchSales();
        }}
      />
    </RouteProtection>
  );

  if (isEditing) return (
    <RouteProtection routeName="sales">
      <SalesForm
        isViewMode={false}
        salesData={editingSales}
        onBack={() => setIsEditing(false)}
        onSuccess={async (nextToast) => {
          if (nextToast) setToast(nextToast);
          await refetchSales();
          setIsEditing(false);
        }}
      />
    </RouteProtection>
  );

  if (isViewing) return (
    <RouteProtection routeName="sales">
      <SalesForm
        isViewMode={true}
        salesData={viewingSales}
        onBack={() => setIsViewing(false)}
        onSuccess={async (nextToast) => {
          if (nextToast) setToast(nextToast);
          await refetchSales();
          setIsViewing(false);
        }}
      />
    </RouteProtection>
  );

  if (loading) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs font-black uppercase tracking-[3px] text-gray-400">Loading Revenue Stream...</p>
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

      {toast && (
        <DynamicToast
          type={toast.type}
          message={toast.message}
          onClose={() => setToast(null)}
        />
      )}

      {/* --- HEADER SECTION --- */}
      <div className="flex-shrink-0">
        {/* <nav className="flex items-center gap-2 mb-6 text-[10px] font-bold uppercase tracking-widest text-gray-400">
          <span>Commerce</span>
          <ArrowRight size={10} />
          <span className="text-black">Sales Performance</span>
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
                <TrendingUp size={24} />
              </div>
              <h1 className="text-4xl font-black text-black tracking-tighter">
                Revenue <span className="text-red-600 italic">Tracking</span>
              </h1>
            </div>
            {/* <p className="text-xs font-bold text-gray-400 uppercase tracking-tight">
              Monitor real-time sales transactions and commercial volume.
            </p> */}
          </div>

          <div className="flex gap-3">
            <button className="flex items-center gap-2 px-5 py-3 bg-white border border-gray-200 text-xs font-bold text-black rounded-xl hover:bg-gray-50 transition-all shadow-sm">
              <Download size={14} />
              EXPORT REPORT
            </button>
            <ProtectedAction routeName="sales">
              <button onClick={() => setIsAdding(true)} className="flex items-center gap-2 px-6 py-3 bg-black text-white text-xs font-bold rounded-xl hover:bg-red-600 transition-all shadow-lg tracking-widest uppercase">
                <ShoppingBag size={14} />
                New Sale
              </button>
            </ProtectedAction>
          </div>
        </motion.div>

        {/* --- SUMMARY TILES --- */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <SummaryCard
            icon={<TrendingUp className="text-red-600" size={20} />}
            label="Gross Sales"
            value={sales?.length || 0}
            subText="Orders"
          />
          <SummaryCard
            icon={<Zap className="text-black" size={20} />}
            label="Velocity"
            value="High"
            subText="Demand Scale"
          />
          <SummaryCard
            icon={<ShieldCheck className="text-gray-400" size={20} />}
            label="Verification"
            value="Secure"
            subText="Certified"
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
          data={sales}
          title="Sales Ledger"
          enableAddButton={false}
          enableCheckbox={enableCheckboxes}
          checkboxColumn="id"
          checkboxCondition={checkboxCondition}
          enableActionColumn={true}
          actionButtons={[
            {
              label: 'View',
              onClick: async (row) => {
                try {
                  console.log('View sales:', row);

                  const token = localStorage.getItem('token');
                  if (!token) {
                    throw new Error('No authentication token found');
                  }

                  const response = await fetch(
                    `${import.meta.env.VITE_SERVER_LINK}/sales/${Number(row.id)}`,
                    {
                      method: "GET",
                      headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                      },
                    }
                  );

                  const result = await response.json();

                  if (!response.ok) {
                    throw new Error(result.message || 'Failed to fetch sales details');
                  }

                  console.log('Sales details:', result);

                  // Set sales data for viewing
                  setViewingSales(result);
                  setIsViewing(true);

                } catch (error) {
                  console.error('Error fetching sales details:', error);
                  setToast({
                    type: 'error',
                    message: error.message || 'Failed to fetch sales details'
                  });
                }
              }
            },
          ]}
          badgeColumns={[
            {
              column: 'status',
              values: {
                'PAID': 'green',
                'UNPAID': 'red',
                'PARTIALLY PAID': 'yellow'
              }
            },
            {
              column: 'state',
              values: {
                'PREPARED': 'orange',
                'CHECKED': 'blue',
                'APPROVED': 'green',
                'REJECTED': 'red',
                'CANCELLED': 'orange'
              }
            }
          ]}
          checkboxActions={[
            {
              label: 'Approve Selected',
              onClick: async (selectedRows) => {
                try {
                  console.log('Approving sales:', selectedRows);

                  const token = localStorage.getItem('token');
                  if (!token) {
                    throw new Error('No authentication token found');
                  }

                  const updates = selectedRows.map(row => ({
                    id: row.id,
                    currentState: row.state
                  }));

                  const response = await fetch(
                    `${import.meta.env.VITE_SERVER_LINK}/sales/sales-state`,
                    {
                      method: "PUT",
                      headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                      },
                      body: JSON.stringify({ updates })
                    }
                  );

                  const result = await response.json();

                  if (!response.ok) {
                    throw new Error(result.message || 'Failed to approve sales');
                  }

                  // Refresh sales data
                  await refetchSales();

                  setToast({
                    type: 'success',
                    message: result.message || `${selectedRows.length} sale(s) approved successfully`
                  });

                } catch (error) {
                  console.error('Error approving sales:', error);
                  setToast({
                    type: 'error',
                    message: error.message || 'Failed to approve sales'
                  });
                }
              }
            }
          ]}
        />
      </motion.div>
    </div>
  );
}

{/* --- HELPER COMPONENT (Fixed: This was likely missing) --- */ }
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