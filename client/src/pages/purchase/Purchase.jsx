import React from 'react';
import DynamicTable from '../../components/DynamicTable';
import usePurchase from './usePurchase';

export default function Purchase() {
  const { purchase, loading, error } = usePurchase();

  if (loading) {
    return (
      <div className="p-5 flex items-center justify-center">
        <div className="text-gray-600">Loading purchase...</div>
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
      data={purchase}
      title="Purchase"
      enableAddButton={false}/>
    </div>
  );
}
