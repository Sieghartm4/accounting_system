import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Layers, CheckCircle, ShieldCheck, Wallet, ArrowRight, Download, Plus } from 'lucide-react';
import DynamicTable from '../../components/DynamicTable';
import DynamicToast from '../../components/DynamicToast';
import RouteProtection from '../../components/RouteProtection';
import ProtectedAction from '../../components/ProtectedAction';
import usePayments from './usePayments';
import PaymentsForm from './PaymentsForm';
import { getAccessLevel } from '../../utils/routeProtection';

export default function Payments() {
  return (
    <RouteProtection routeName="payments">
      <PaymentsContent />
    </RouteProtection>
  );
}

function PaymentsContent() {
  const { payments, loading, error, refetchPayments } = usePayments();
  const [isAdding, setIsAdding] = useState(false);
  const [isViewing, setIsViewing] = useState(false);
  const [viewingPayment, setViewingPayment] = useState(null);
  const [toast, setToast] = useState(null);

  // Check if user has access to enable checkboxes
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const accessLevel = getAccessLevel('payments', user);
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
    <RouteProtection routeName="payments">
      <PaymentsForm
        onBack={() => setIsAdding(false)}
        onSuccess={async (nextToast) => {
          if (nextToast) setToast(nextToast);
          await refetchPayments();
        }}
      />
    </RouteProtection>
  );

  if (isViewing) return (
    <RouteProtection routeName="payments">
      <PaymentsForm
        isViewMode={true}
        paymentData={viewingPayment}
        onBack={() => {
          setIsViewing(false);
          setViewingPayment(null);
        }}
      />
    </RouteProtection>
  );

  if (loading) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs font-black uppercase tracking-[3px] text-gray-400">Retrieving Payments...</p>
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
        <motion.div
          initial="hidden"
          animate="visible"
          variants={fadeInUp}
          className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-4"
        >
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-black rounded-lg text-red-500 shadow-lg shadow-black/20">
                <Layers size={24} />
              </div>
              <h1 className="text-4xl font-black text-black tracking-tighter">
                <span className="text-red-600 italic">Payments</span>
              </h1>
            </div>
          </div>

          <div className="flex gap-3">
            <button className="flex items-center gap-2 px-5 py-3 bg-white border border-gray-200 text-xs font-bold text-black rounded-xl hover:bg-gray-50 transition-all shadow-sm">
              <Download size={14} />
              EXPORT LEDGER
            </button>
            <ProtectedAction routeName="payments">
              <button onClick={() => setIsAdding(true)} className="flex items-center gap-2 px-6 py-3 bg-black text-white text-xs font-bold rounded-xl hover:bg-red-600 transition-all shadow-lg tracking-widest uppercase">
                <CheckCircle size={14} />
                Process Payment
              </button>
            </ProtectedAction>
          </div>
        </motion.div>

        {/* --- SUMMARY TILES --- */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <SummaryCard
            icon={<Wallet className="text-red-600" size={20} />}
            label="Total Paid"
            value={payments?.length || 0}
            subText="Entries"
          />
          <SummaryCard
            icon={<CheckCircle className="text-black" size={20} />}
            label="Verified"
            value="Active"
            subText="Compliance"
          />
          <SummaryCard
            icon={<ShieldCheck className="text-gray-400" size={20} />}
            label="Integrity"
            value="Valid"
            subText="Audit Status"
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
          data={payments}
          title="Payments Ledger"
          enableAddButton={false}
          enableCheckbox={enableCheckboxes}
          enableActionColumn={true}
          checkboxColumn="id"
          checkboxCondition={checkboxCondition}
          actionButtons={[
            {
              label: 'View',
              onClick: async (row) => {
                try {
                  console.log('Viewing payment:', row);
                  
                  const token = localStorage.getItem('token');
                  if (!token) {
                    throw new Error('No authentication token found');
                  }

                  const response = await fetch(
                    `${import.meta.env.VITE_SERVER_LINK}/payments/${row.id}`,
                    {
                      method: "GET",
                      headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                      }
                    }
                  );

                  const result = await response.json();

                  if (!response.ok) {
                    throw new Error(result.message || 'Failed to fetch payment details');
                  }

                  console.log('Payment details fetched:', result);
                  setViewingPayment(result);
                  setIsViewing(true);

                } catch (error) {
                  console.error('Error fetching payment details:', error);
                  setToast({
                    type: 'error',
                    message: error.message || 'Failed to fetch payment details'
                  });
                }
              }
            },
            {
              label: 'Edit',
              onClick: async (row) => {
                try {
                  console.log('Editing payment:', row);
                  
                  const token = localStorage.getItem('token');
                  if (!token) {
                    throw new Error('No authentication token found');
                  }

                  const response = await fetch(
                    `${import.meta.env.VITE_SERVER_LINK}/payments/${row.id}`,
                    {
                      method: "GET",
                      headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                      }
                    }
                  );

                  const result = await response.json();

                  if (!response.ok) {
                    throw new Error(result.message || 'Failed to fetch payment details');
                  }

                  console.log('Payment details fetched for editing:', result);
                  setViewingPayment(result);
                  setIsAdding(true);

                } catch (error) {
                  console.error('Error fetching payment details for editing:', error);
                  setToast({
                    type: 'error',
                    message: error.message || 'Failed to fetch payment details'
                  });
                }
              }
            }
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
                  console.log('Approving payments:', selectedRows);

                  const token = localStorage.getItem('token');
                  if (!token) {
                    throw new Error('No authentication token found');
                  }

                  const updates = selectedRows.map(row => ({
                    id: row.id,
                    currentState: row.state
                  }));

                  const response = await fetch(
                    `${import.meta.env.VITE_SERVER_LINK}/payments/payment-state`,
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
                    throw new Error(result.message || 'Failed to approve payments');
                  }

                  // Refresh payments data
                  await refetchPayments();

                  setToast({
                    type: 'success',
                    message: result.message || `${selectedRows.length} payment(s) approved successfully`
                  });

                } catch (error) {
                  console.error('Error approving payments:', error);
                  setToast({
                    type: 'error',
                    message: error.message || 'Failed to approve payments'
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

// Reusable SummaryCard (Same as used in other pages)
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
