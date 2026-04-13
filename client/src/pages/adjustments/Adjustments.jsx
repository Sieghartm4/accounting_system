import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Plus, Eye, Edit, Trash2, FileText, Download, CheckCircle, XCircle, Clock, AlertCircle } from 'lucide-react';
import DynamicTable from '../../components/DynamicTable';
import DynamicToast from '../../components/DynamicToast';
import RouteProtection from '../../components/RouteProtection';
import ProtectedAction from '../../components/ProtectedAction';
import useAdjustments from './useAdjustments';
import AdjustmentsForm from './AdjustmentsForm';
import { getAccessLevel } from '../../utils/routeProtection';

const Adjustments = () => {
  const [isAdding, setIsAdding] = useState(false);
  const [isViewing, setIsViewing] = useState(false);
  const [viewingAdjustment, setViewingAdjustment] = useState(null);
  const [toast, setToast] = useState(null);

  const {
    adjustments,
    loading,
    error,
    selectedAdjustmentId,
    adjustmentData,
    adjustmentLoading,
    handleAdjustmentRowClick,
    refetchAdjustments,
  } = useAdjustments();

  const user = JSON.parse(localStorage.getItem('user') || '{}');
const accessLevel = getAccessLevel('adjustments', user);

  // Determine checkbox condition based on access level
  const checkboxCondition = accessLevel
    ? { column: 'a_status', value: accessLevel === 'Check Access' ? 'PREPARED BY' : 'CHECKED BY' }
    : null;

  const fadeInUp = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.5 }
  };

  const actionButtons = [
    {
      label: 'View',
      icon: Eye,
      onClick: (adjustment) => {
        setViewingAdjustment(adjustment);
        setIsViewing(true);
      },
      color: 'text-blue-600 hover:bg-blue-50'
    },
    {
      label: 'Edit',
      icon: Edit,
      onClick: (adjustment) => {
        setViewingAdjustment(adjustment);
        setIsAdding(true);
      },
      color: 'text-green-600 hover:bg-green-50',
      condition: accessLevel !== 'View Only'
    },
    {
      label: 'Delete',
      icon: Trash2,
      onClick: (adjustment) => {
        // Handle delete
        setToast({ type: 'warning', message: 'Delete functionality not implemented yet' });
      },
      color: 'text-red-600 hover:bg-red-50',
      condition: accessLevel === 'Full Access'
    }
  ];

  const badgeColumns = [
    {
      column: 'a_status',
      values: {
        'PREPARED BY': 'gray',
        'CHECKED BY': 'blue',
        'APPROVED BY': 'green',
        'REJECTED BY': 'red',
        'CANCELLED': 'orange'
      }
    }
  ];

  const checkboxActions = [
    {
      label: 'Approve',
      icon: CheckCircle,
      onClick: async (selectedIds) => {
        setToast({ type: 'success', message: `${selectedIds.length} adjustment(s) approved` });
        refetchAdjustments();
      },
      color: 'text-green-600 hover:bg-green-50',
      condition: accessLevel === 'Full Access'
    },
    {
      label: 'Reject',
      icon: XCircle,
      onClick: async (selectedIds) => {
        setToast({ type: 'warning', message: `${selectedIds.length} adjustment(s) rejected` });
        refetchAdjustments();
      },
      color: 'text-red-600 hover:bg-red-50',
      condition: accessLevel === 'Full Access'
    }
  ];

  const handleBack = () => {
    setIsAdding(false);
    setIsViewing(false);
    setViewingAdjustment(null);
  };

  const handleSuccess = (toastMessage) => {
    setToast(toastMessage);
    handleBack();
    refetchAdjustments();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto mb-4"></div>
          <p className="text-gray-600 text-sm">Loading adjustments...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-600 mx-auto mb-4" />
          <p className="text-red-600 text-sm mb-2">Error loading adjustments</p>
          <p className="text-gray-500 text-xs">{error}</p>
          <button 
            onClick={refetchAdjustments}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (isAdding || isViewing) {
    return (
      <RouteProtection routeName="adjustments">
        <AdjustmentsForm
          onBack={handleBack}
          onSuccess={handleSuccess}
          isViewMode={isViewing}
          adjustmentData={adjustmentData}
        />
      </RouteProtection>
    );
  }

  return (
    <RouteProtection routeName="adjustments">
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-4">
              <div className="flex items-center space-x-4">
                <h1 className="text-2xl font-bold text-gray-900">Adjustments</h1>
                <span className="text-sm text-gray-500">
                  {adjustments.length} record{adjustments.length !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => setToast({ type: 'info', message: 'Export functionality not implemented yet' })}
                  className="flex items-center px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </button>
                <ProtectedAction accessLevel={accessLevel} minLevel="Add Access">
                  <button
                    onClick={() => setIsAdding(true)}
                    className="flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    New Adjustment
                  </button>
                </ProtectedAction>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <motion.div {...fadeInUp}>
            <DynamicTable
              data={adjustments}
              columns={[
                { key: 'a_document_reference', label: 'Document Reference' },
                { key: 'a_posting_date', label: 'Posting Date' },
                { key: 'a_total_amount', label: 'Total Amount', type: 'currency' },
                { key: 'a_status', label: 'Status', type: 'badge' },
                { key: 'a_created_by', label: 'Created By' },
                { key: 'a_created_date', label: 'Created Date' }
              ]}
              actionButtons={actionButtons}
              badgeColumns={badgeColumns}
              checkboxCondition={checkboxCondition}
              checkboxActions={checkboxActions}
              onRowClick={handleAdjustmentRowClick}
              emptyState={{
                icon: FileText,
                title: 'No adjustments found',
                description: 'Get started by creating your first adjustment entry.'
              }}
            />
          </motion.div>
        </div>

        {/* Toast */}
        {toast && (
          <DynamicToast
            type={toast.type}
            message={toast.message}
            onClose={() => setToast(null)}
          />
        )}
      </div>
    </RouteProtection>
  );
};

export default Adjustments;
