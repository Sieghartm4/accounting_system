import React from 'react';
import DynamicTable from '../../components/DynamicTable';
import useBranch from './useBranch';

export default function Branch() {
  const { branch, loading, error } = useBranch();

  if (loading) {
    return (
      <div className="p-5 flex items-center justify-center">
        <div className="text-gray-600">Loading branch...</div>
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
      data={branch}
      title="Branch"
      enableAddButton={false}/>
    </div>
  );
}
