import React from 'react';
import DynamicTable from '../../components/DynamicTable';
import usePayments from './usePayments';

export default function Payments() {
  const { payments, loading, error } = usePayments();

  if (loading) {
    return (
      <div className="p-5 flex items-center justify-center">
        <div className="text-gray-600">Loading payments...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-5 flex items-center justify-center">
        <div className="text-red-600">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="p-5 h-[100%]">
      <DynamicTable
      data={payments}
      title="Payments"
      enableAddButton={false}/>
    </div>
  );
}
