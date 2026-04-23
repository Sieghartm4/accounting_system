import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ShoppingCart, Package, ShieldCheck, TrendingDown, ArrowRight, Download } from 'lucide-react';
import DynamicTable from '../../components/DynamicTable';
import DynamicToast from '../../components/DynamicToast';
import RouteProtection from '../../components/RouteProtection';
import ProtectedAction from '../../components/ProtectedAction';
import usePurchase from './usePurchase';
import PurchaseForm from './PurchaseForm';
import { getAccessLevel } from '../../utils/routeProtection';

export default function Purchase() {
  return (
    <RouteProtection routeName="purchase">
      <PurchaseContent />
    </RouteProtection>
  );
}

function PurchaseContent() {
  const { purchases, loading, error, refetchPurchases } = usePurchase();
  
  console.log('PurchaseContent - purchases:', purchases);
  console.log('PurchaseContent - loading:', loading);
  console.log('PurchaseContent - error:', error);
  const [isAdding, setIsAdding] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingPurchase, setEditingPurchase] = useState(null);
  const [isViewing, setIsViewing] = useState(false);
  const [viewingPurchase, setViewingPurchase] = useState(null);
  const [toast, setToast] = useState(null);

  // Check if user has access to enable checkboxes
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const accessLevel = getAccessLevel('purchase', user);
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
    <RouteProtection routeName="purchase">
      <PurchaseForm
        onBack={() => setIsAdding(false)}
        onSuccess={async (nextToast) => {
          if (nextToast) setToast(nextToast);
          await refetchPurchases();
        }}
      />
    </RouteProtection>
  );

  if (isEditing) return (
    <RouteProtection routeName="purchase">
      <PurchaseForm
        isViewMode={false}
        isEditMode={true}
        purchaseData={editingPurchase}
        onBack={() => setIsEditing(false)}
        onSuccess={async (nextToast) => {
          if (nextToast) setToast(nextToast);
          await refetchPurchases();
          setIsEditing(false);
        }}
      />
    </RouteProtection>
  );

  if (isViewing) return (
    <RouteProtection routeName="purchase">
      <PurchaseForm
        isViewMode={true}
        purchaseData={viewingPurchase}
        onBack={() => setIsViewing(false)}
        onSuccess={async (nextToast) => {
          if (nextToast) setToast(nextToast);
          await refetchPurchases();
          setIsViewing(false);
        }}
      />
    </RouteProtection>
  );

  if (loading) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs font-black uppercase tracking-[3px] text-gray-400">Loading Purchase Ledger...</p>
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
                <ShoppingCart size={24} />
              </div>
              <h1 className="text-4xl font-black text-black tracking-tighter">
                Purchase <span className="text-red-600 italic">Management</span>
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
            <ProtectedAction routeName="purchase">
              <button onClick={() => setIsAdding(true)} className="flex items-center gap-2 px-6 py-3 bg-black text-white text-xs font-bold rounded-xl hover:bg-red-600 transition-all shadow-lg tracking-widest uppercase">
                <Package size={14} />
                New Purchase
              </button>
            </ProtectedAction>
          </div>
        </motion.div>

        {/* --- SUMMARY TILES --- */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <SummaryCard
            icon={<ShoppingCart className="text-red-600" size={20} />}
            label="Total Purchases"
            value={purchases?.length || 0}
            subText="Transactions"
          />
          <SummaryCard
            icon={<TrendingDown className="text-black" size={20} />}
            label="Spending"
            value="Active"
            subText="Budget Flow"
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
        {console.log('About to render DynamicTable with data:', purchases)}
        <DynamicTable
          data={purchases}
          title="Purchase Ledger"
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
                  console.log('View purchase:', row);

                  const authToken = localStorage.getItem('token');
                  if (!authToken) {
                    throw new Error('No authentication token found');
                  }

                  const viewResponse = await fetch(
                    `${import.meta.env.VITE_SERVER_LINK}/purchase/${Number(row.id)}`,
                    {
                      method: "GET",
                      headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${authToken}`,
                      },
                    }
                  );

                  const viewResult = await viewResponse.json();

                  if (!viewResponse.ok) {
                    throw new Error(viewResult.message || 'Failed to fetch purchase details');
                  }

                  console.log('Purchase details:', viewResult);

                  // Set purchase data for viewing
                  setViewingPurchase(viewResult);
                  setIsViewing(true);

                } catch (error) {
                  console.error('Error fetching purchase details:', error);
                  setToast({
                    type: 'error',
                    message: error.message || 'Failed to fetch purchase details'
                  });
                }
              }
            },
            {
              label: 'Edit',
              onClick: async (row) => {
                try {
                  console.log('Editing purchase:', row);

                  const authToken = localStorage.getItem('token');
                  if (!authToken) {
                    throw new Error('No authentication token found');
                  }

                  const editResponse = await fetch(
                    `${import.meta.env.VITE_SERVER_LINK}/purchase/${Number(row.id)}`,
                    {
                      method: "GET",
                      headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${authToken}`,
                      },
                    }
                  );

                  const editResult = await editResponse.json();

                  if (!editResponse.ok) {
                    throw new Error(editResult.message || 'Failed to fetch purchase details');
                  }

                  console.log('Purchase details for editing:', editResult);

                  // Set purchase data for editing
                  setEditingPurchase(editResult);
                  setIsEditing(true);

                } catch (error) {
                  console.error('Error fetching purchase details for editing:', error);
                  setToast({
                    type: 'error',
                    message: error.message || 'Failed to fetch purchase details'
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
                'REJECTED': 'yellow'
              }
            },
            {
              column: 'state',
              values: {
                'PREPARED': 'orange',
                'CHECKED': 'blue',
                'APPROVED': 'green',
                'REJECTED': 'red'
              }
            }
          ]}
          checkboxActions={[
            {
              label: 'Approve Selected',
              onClick: async (selectedRows) => {
                try {
                  console.log('Approving purchases:', selectedRows);

                  const approveToken = localStorage.getItem('token');
                  if (!approveToken) {
                    throw new Error('No authentication token found');
                  }

                  const updates = selectedRows.map(row => ({
                    id: row.id,
                    currentState: row.state
                  }));

                  const approveResponse = await fetch(
                    `${import.meta.env.VITE_SERVER_LINK}/purchase/purchase-state`,
                    {
                      method: "PUT",
                      headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${approveToken}`,
                      },
                      body: JSON.stringify({ updates })
                    }
                  );

                  const approveResult = await approveResponse.json();

                  if (!approveResponse.ok) {
                    throw new Error(approveResult.message || 'Failed to approve purchases');
                  }

                  // Refresh purchases data
                  await refetchPurchases();

                  setToast({
                    type: 'success',
                    message: approveResult.message || `${selectedRows.length} purchase(s) approved successfully`
                  });

                } catch (error) {
                  console.error('Error approving purchases:', error);
                  setToast({
                    type: 'error',
                    message: error.message || 'Failed to approve purchases'
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
