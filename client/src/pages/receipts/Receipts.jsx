import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Receipt, FilePlus, ShieldCheck, CreditCard, ArrowRight, Download, Check, FileText, Building } from 'lucide-react';
import DynamicTable from '../../components/DynamicTable';
import DynamicToast from '../../components/DynamicToast';
import RouteProtection from '../../components/RouteProtection';
import ProtectedAction from '../../components/ProtectedAction';
import useReceipts from './useReceipts';
import ReceiptsForm from './ReceiptsForm';
import { hasRouteAccess, getAccessLevel } from '../../utils/routeProtection';
import { generateReceiptPDF } from '../../utils/generateReceiptPDF'; // <-- import PDF util

export default function Receipts() {
  return (
    <RouteProtection routeName="receipts">
      <ReceiptsContent />
    </RouteProtection>
  );
}

function ReceiptsContent() {
  const { receipts, loading, error, refetchReceipts } = useReceipts();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isAdding, setIsAdding] = useState(false);
  const [viewingReceipt, setViewingReceipt] = useState(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    const id = searchParams.get('id');
    if (!id) return;

    const fetchReceipt = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) throw new Error('No authentication token found');

        const response = await fetch(
          `${import.meta.env.VITE_SERVER_LINK}/receipt/${Number(id)}`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const result = await response.json();
        if (!response.ok) throw new Error(result.message || 'Failed to fetch receipt details');

        setViewingReceipt(result);
        setIsEditMode(false);
        setSearchParams(prev => {
          const next = new URLSearchParams(prev);
          next.delete('id');
          return next;
        }, { replace: true });
      } catch (err) {
        setToast({ type: 'error', message: err.message || 'Failed to fetch receipt details' });
      }
    };

    fetchReceipt();
  }, [searchParams, setSearchParams]);

  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const accessLevel = getAccessLevel('receipts', user);
  const enableCheckboxes =
    accessLevel === 'Check Access'   ||
    accessLevel === 'Approve Access' ||
    accessLevel === 'Edit Access'    ||
    accessLevel === 'Full Access';

  const checkboxCondition = null; // Always show checkboxes

  // Function to filter checkbox actions based on selected rows' states
  const getFilteredCheckboxActions = (selectedRows) => {
    const allActions = [
      {
        label: 'Approve Selected',
        icon: <Check size={14} />,
        onClick: async (selectedRows) => {
          try {
            const token = localStorage.getItem('token');
            if (!token) throw new Error('No authentication token found');

            // Filter to only include approvable rows (PREPARED or CHECKED)
            const approvableRows = selectedRows.filter(row => row.state === 'PREPARED' || row.state === 'CHECKED');
            
            if (approvableRows.length === 0) {
              setToast({ type: 'error', message: 'No receipts are eligible for approval' });
              return;
            }

            const updates = approvableRows.map(row => ({ id: row.id, currentState: row.state }));

            const response = await fetch(
              `${import.meta.env.VITE_SERVER_LINK}/receipt/receipt-state`,
              {
                method: 'PUT',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ updates }),
              }
            );

            const result = await response.json();
            if (!response.ok) throw new Error(result.message || 'Failed to approve receipts');

            await refetchReceipts();
            setToast({
              type: 'success',
              message: result.message || `${approvableRows.length} receipt(s) approved successfully`,
            });
          } catch (error) {
            setToast({ type: 'error', message: error.message || 'Failed to approve receipts' });
          }
        },
      },
      {
        // ── Internal Copy → fetch data → generate + download PDF directly
        label: 'Internal Copy',
        icon: <FileText size={14} />,
        onClick: (selectedRows) => fetchAndDownloadPDF(selectedRows, 'internal'),
        style: 'blue', // Blue color for internal copy
      },
      {
        // ── Customer Copy → same but labelled differently in PDF
        label: 'Customer Copy',
        icon: <Building size={14} />,
        onClick: (selectedRows) => fetchAndDownloadPDF(selectedRows, 'customer'),
        style: 'orange', // Orange color for customer copy
      },
    ];

    // Filter Approve Selected button - show if at least one selected row is PREPARED or CHECKED
    return allActions.filter(action => {
      if (action.label === 'Approve Selected') {
        // Show approve button if at least one selected row has state PREPARED or CHECKED
        return selectedRows.some(row => row.state === 'PREPARED' || row.state === 'CHECKED');
      }
      return true; // Always show other actions
    });
  };

  const fadeInUp = {
    hidden:  { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
  };

  // ─── Helper: fetch full receipt data then download as PDF ─────────────────
  const fetchAndDownloadPDF = async (selectedRows, copyType) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('No authentication token found');

      const receiptIds = selectedRows.map(row => row.id).join(',');

      const response = await fetch(
        `${import.meta.env.VITE_SERVER_LINK}/receipt/print/${receiptIds}?copyType=${copyType}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Failed to fetch receipts for printing');

      // Extract the actual receipt data from the response
      const data = result.data || [];
      console.log('PDF Data received:', data);
      console.log('First receipt items:', data[0]?.items);
      console.log('First receipt journal:', data[0]?.journal);
      if (!Array.isArray(data)) throw new Error('Invalid data format received from server');

      // Generate & auto-download PDFs (one per receipt)
      await generateReceiptPDF(data, copyType);

      setToast({
        type: 'success',
        message: `${data.length} receipt PDF(s) downloaded (${copyType === 'customer' ? 'Customer' : 'Internal'} Copy)`,
      });
    } catch (error) {
      console.error('Error generating receipt PDF:', error);
      setToast({ type: 'error', message: error.message || 'Failed to generate PDF' });
    }
  };

  if (isAdding) return (
    <RouteProtection routeName="receipts">
      <ReceiptsForm
        onBack={() => setIsAdding(false)}
        onSuccess={async (nextToast) => {
          if (nextToast) setToast(nextToast);
          await refetchReceipts();
        }}
      />
    </RouteProtection>
  );

  if (viewingReceipt) return (
    <RouteProtection routeName="receipts">
      <ReceiptsForm
        isViewMode={!isEditMode}
        isEditMode={isEditMode}
        receiptData={viewingReceipt}
        onBack={() => { setViewingReceipt(null); setIsEditMode(false); }}
        onSuccess={async (nextToast) => {
          if (nextToast) setToast(nextToast);
          await refetchReceipts();
        }}
      />
    </RouteProtection>
  );

  if (loading) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs font-black uppercase tracking-[3px] text-gray-400">Syncing Receipt Ledger...</p>
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

      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
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
                <Receipt size={24} />
              </div>
              <h1 className="text-4xl font-black text-black tracking-tighter">
                Cash <span className="text-red-600 italic">Receipts</span>
              </h1>
            </div>
          </div>

          <div className="flex gap-3">
            <button className="flex items-center gap-2 px-5 py-3 bg-white border border-gray-200 text-xs font-bold text-black rounded-xl hover:bg-gray-50 transition-all shadow-sm">
              <Download size={14} />
              EXPORT DATA
            </button>
            <ProtectedAction routeName="receipts">
              <button
                onClick={() => setIsAdding(true)}
                className="flex items-center gap-2 px-6 py-3 bg-black text-white text-xs font-bold rounded-xl hover:bg-red-600 transition-all shadow-lg tracking-widest uppercase"
              >
                <FilePlus size={14} />
                New Receipt
              </button>
            </ProtectedAction>
          </div>
        </motion.div>

        {/* ── SUMMARY TILES ──────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <SummaryCard
            icon={<Receipt className="text-red-600" size={20} />}
            label="Total Receipts"
            value={receipts?.length || 0}
            subText="Processed"
          />
          <SummaryCard
            icon={<CreditCard className="text-black" size={20} />}
            label="Transactions"
            value="Today"
            subText="Live Feed"
          />
          <SummaryCard
            icon={<ShieldCheck className="text-gray-400" size={20} />}
            label="Status"
            value="Verified"
            subText="Audit Compliant"
          />
        </div>
      </div>

      {/* ── TABLE ──────────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="flex-1 min-h-0 bg-white rounded-2xl shadow-xl shadow-black/5 overflow-hidden border border-gray-100"
      >
        <DynamicTable
          data={receipts}
          title="Receipt Ledger"
          enableAddButton={false}
          enableCheckbox={enableCheckboxes}
          checkboxColumn="id"
          checkboxCondition={checkboxCondition}
          enableActionColumn={true}
          badgeColumns={[
            {
              column: 'state',
              values: {
                'PREPARED':  'yellow',
                'CHECKED':   'blue',
                'APPROVED':  'green',
                'REJECTED':  'red',
                'CANCELLED': 'orange',
              },
            },
          ]}
          actionButtons={[
            {
              label: 'View',
              onClick: async (row) => {
                try {
                  const token = localStorage.getItem('token');
                  if (!token) throw new Error('No authentication token found');

                  const response = await fetch(
                    `${import.meta.env.VITE_SERVER_LINK}/receipt/${Number(row.id)}`,
                    {
                      method: 'GET',
                      headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`,
                      },
                    }
                  );

                  const result = await response.json();
                  if (!response.ok) throw new Error(result.message || 'Failed to fetch receipt details');

                  setViewingReceipt(result);
                  setIsEditMode(false);
                } catch (error) {
                  setToast({ type: 'error', message: error.message || 'Failed to fetch receipt details' });
                }
              },
            },
            {
              label: 'Edit',
              onClick: async (row) => {
                try {
                  const token = localStorage.getItem('token');
                  if (!token) throw new Error('No authentication token found');

                  const response = await fetch(
                    `${import.meta.env.VITE_SERVER_LINK}/receipt/${Number(row.id)}`,
                    {
                      method: 'GET',
                      headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`,
                      },
                    }
                  );

                  const result = await response.json();
                  if (!response.ok) throw new Error(result.message || 'Failed to fetch receipt details');

                  setViewingReceipt(result);
                  setIsEditMode(true);
                } catch (error) {
                  setToast({ type: 'error', message: error.message || 'Failed to fetch receipt details' });
                }
              },
            },
          ]}
          checkboxActions={getFilteredCheckboxActions([])}
          checkboxActionsFilter={getFilteredCheckboxActions}
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