import React from 'react';
import { DynamicTable, LoadingScreen } from '../../components/ui';
import useBranch from './useBranch';

export default function Branch() {
  const { branch, loading, error } = useBranch();

  if (loading) {
    return <LoadingScreen label="Loading Branch Data..." />;
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
