import React from 'react';
import DynamicTable from '../../components/DynamicTable';
import RightSideModal from '../../components/RightSideModal';
import RouteProtection from '../../components/RouteProtection';
import ProtectedAction from '../../components/ProtectedAction';
import useCompany from './useCompany';

function CompanyContent() {
    const { 
        company, 
        loading, 
        error,
        isModalOpen,
        logoPreview,
        status,
        formData,
        handleAddClick,
        handleCloseModal,
        handleLogoChange,
        handleInputChange,
        handleSubmit
    } = useCompany();

    if (loading) {
        return (
            <div className="p-5 flex items-center justify-center">
                <div className="text-gray-600">Loading company...</div>
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
            <ProtectedAction routeName="company" fallback={
              <DynamicTable
                  data={company}
                  enableAddButton={false}
                  title="Company"
              />
            }>
              <DynamicTable
                  data={company}
                  enableAddButton={true}
                  title="Company"
                  onAddClick={handleAddClick}
              />
            </ProtectedAction>

            <RightSideModal
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                title="Add New Company"
            >
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Company Name
                        </label>
                        <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => handleInputChange('name', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="Enter company name"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Owner Name
                        </label>
                        <input
                            type="text"
                            value={formData.owner_name}
                            onChange={(e) => handleInputChange('owner_name', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="Enter owner name"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Logo
                        </label>
                        <div className="relative">
                            <input
                                type="file"
                                id="logo-input"
                                className="absolute w-full h-full opacity-0 cursor-pointer"
                                onChange={handleLogoChange}
                            />
                            <label
                                htmlFor="logo-input"
                                className="flex items-center justify-center cursor-pointer w-full px-3 py-12 border-2 border-dashed border-gray-300 rounded-md bg-gray-50 hover:bg-gray-100 transition-colors duration-200 relative overflow-hidden"
                            >
                                {logoPreview ? (
                                    <img
                                        src={logoPreview}
                                        alt="Logo Preview"
                                        className="absolute inset-0 w-full h-full object-cover"
                                    />
                                ) : (
                                    <div className="text-center">
                                        <svg className="w-8 h-8 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                        </svg>
                                        <p className="text-sm text-gray-500">Click to upload logo</p>
                                    </div>
                                )}
                            </label>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Address
                        </label>
                        <textarea
                            value={formData.address}
                            onChange={(e) => handleInputChange('address', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            rows={4}
                            placeholder="Enter company address"
                        />
                    </div>

                    <div className="flex flex-col gap-2">
                        <label className="block text-sm font-medium text-gray-700">Status</label>
                        <div className="flex gap-3 w-full">
                            <label className="flex-1 cursor-pointer">
                                <input type="radio" name="status" value="active" className="sr-only peer" checked={status === 'active'} onChange={(e) => {
                                    handleInputChange('status', e.target.value);
                                }} />
                                <div className="relative px-4 py-4 bg-white border border-gray-300 rounded-lg transition-all duration-200 hover:border-gray-400">
                                    <span className="block text-sm font-medium text-center text-gray-700">ACTIVE</span>
                                    <div className={`absolute bottom-2 left-1/2 -translate-x-1/2 w-[60%] h-[5px] bg-${status === 'active' ? 'green-500' : 'gray-300'}`}></div>
                                </div>
                            </label>
                            <label className="flex-1 cursor-pointer">
                                <input type="radio" name="status" value="inactive" className="sr-only peer" checked={status === 'inactive'} onChange={(e) => {
                                    handleInputChange('status', e.target.value);
                                }} />
                                <div className="relative px-4 py-4 bg-white border border-gray-300 rounded-lg transition-all duration-200 hover:border-gray-400">
                                    <span className="block text-sm font-medium text-center text-gray-700">INACTIVE</span>
                                    <div className={`absolute bottom-2 left-1/2 -translate-x-1/2 w-[60%] h-[5px] bg-${status === 'inactive' ? 'green-500' : 'gray-300'}`}></div>
                                </div>
                            </label>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={handleCloseModal}
                            className="flex-1 px-4 py-2 text-gray-700 bg-gray-200 hover:bg-gray-300 rounded-md transition-colors duration-200"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="flex-1 px-4 py-2 text-white bg-emerald-600 hover:bg-emerald-500 rounded-md transition-colors duration-200"
                        >
                            Save Company
                        </button>
                    </form>
                </div>
            </RightSideModal>
        </div>
    );
}

export default function Company() {
  return (
    <RouteProtection routeName="company">
      <CompanyContent />
    </RouteProtection>
  );
}
