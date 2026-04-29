import React, { useState } from 'react';
import { Building2, Mail, Phone, Globe, FileText, ShieldCheck, Edit2, Save, X } from 'lucide-react';
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

    const [selectedCompany, setSelectedCompany] = useState(null);

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
                <div className="flex flex-col gap-6">
                    {/* Company Cards Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {company?.map((comp, index) => (
                            <div 
                                key={comp.mc_company_id || index}
                                className={`bg-white rounded-xl shadow-lg border-2 transition-all duration-200 hover:shadow-xl cursor-pointer ${
                                    selectedCompany?.mc_company_id === comp.mc_company_id 
                                        ? 'border-red-500 shadow-red-100' 
                                        : 'border-gray-200 hover:border-red-300'
                                }`}
                                onClick={() => setSelectedCompany(comp)}
                            >
                                {/* Company Header */}
                                <div className="p-6 border-b border-gray-100">
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-center gap-4">
                                            {comp.mc_logo ? (
                                                <img 
                                                    src={comp.mc_logo} 
                                                    alt={comp.mc_company_name}
                                                    className="w-16 h-16 object-cover rounded-lg border-2 border-gray-200"
                                                />
                                            ) : (
                                                <div className="w-16 h-16 bg-gray-100 rounded-lg border-2 border-gray-200 flex items-center justify-center">
                                                    <Building2 size={24} className="text-gray-400" />
                                                </div>
                                            )}
                                            <div>
                                                <h3 className="text-lg font-bold text-gray-900">{comp.mc_company_name}</h3>
                                                <p className="text-sm text-gray-500">Owner: {comp.mc_owner_name}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className={`px-3 py-1 text-xs font-bold rounded-full ${
                                                comp.mc_status === 'active' 
                                                    ? 'bg-green-100 text-green-800' 
                                                    : 'bg-gray-100 text-gray-800'
                                            }`}>
                                                {comp.mc_status?.toUpperCase()}
                                            </span>
                                            <button 
                                                className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleAddClick(comp);
                                                }}
                                            >
                                                <Edit2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Company Details */}
                                <div className="p-6 space-y-4">
                                    {/* Address */}
                                    {comp.mc_address && (
                                        <div className="flex items-start gap-3">
                                            <FileText size={16} className="text-gray-400 mt-1 flex-shrink-0" />
                                            <div>
                                                <p className="text-xs text-gray-500 uppercase tracking-wider">Address</p>
                                                <p className="text-sm text-gray-700 line-clamp-2">{comp.mc_address}</p>
                                            </div>
                                        </div>
                                    )}

                                    {/* TIN */}
                                    {comp.mc_tin && (
                                        <div className="flex items-start gap-3">
                                            <ShieldCheck size={16} className="text-gray-400 mt-1 flex-shrink-0" />
                                            <div>
                                                <p className="text-xs text-gray-500 uppercase tracking-wider">Tax ID</p>
                                                <p className="text-sm text-gray-700">{comp.mc_tin}</p>
                                            </div>
                                        </div>
                                    )}

                                    {/* Contact Info */}
                                    <div className="space-y-3">
                                        {comp.mc_email && (
                                            <div className="flex items-start gap-3">
                                                <Mail size={16} className="text-gray-400 mt-1 flex-shrink-0" />
                                                <div>
                                                    <p className="text-xs text-gray-500 uppercase tracking-wider">Email</p>
                                                    <p className="text-sm text-gray-700">{comp.mc_email}</p>
                                                </div>
                                            </div>
                                        )}

                                        {comp.mc_phone && (
                                            <div className="flex items-start gap-3">
                                                <Phone size={16} className="text-gray-400 mt-1 flex-shrink-0" />
                                                <div>
                                                    <p className="text-xs text-gray-500 uppercase tracking-wider">Phone</p>
                                                    <p className="text-sm text-gray-700">{comp.mc_phone}</p>
                                                </div>
                                            </div>
                                        )}

                                        {comp.mc_website && (
                                            <div className="flex items-start gap-3">
                                                <Globe size={16} className="text-gray-400 mt-1 flex-shrink-0" />
                                                <div>
                                                    <p className="text-xs text-gray-500 uppercase tracking-wider">Website</p>
                                                    <a 
                                                        href={comp.mc_website.startsWith('http') ? comp.mc_website : `https://${comp.mc_website}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
                                                    >
                                                        {comp.mc_website}
                                                    </a>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Add Company Button */}
                    <button
                        onClick={() => handleAddClick()}
                        className="fixed bottom-8 right-8 bg-red-600 hover:bg-red-700 text-white p-4 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 group"
                    >
                        <div className="flex items-center gap-2">
                            <Building2 size={20} />
                            <span className="font-bold">Add Company</span>
                        </div>
                    </button>
                </div>
            }>
                {/* Fallback content if no access */}
                <div className="flex flex-col items-center justify-center h-64 text-center">
                    <Building2 size={48} className="text-gray-300 mb-4" />
                    <h3 className="text-xl font-bold text-gray-600 mb-2">No Access to Company Module</h3>
                    <p className="text-gray-500">Please contact your administrator to get access to company management.</p>
                </div>
            </ProtectedAction>

            {/* Edit Modal */}
            <RightSideModal
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                title={selectedCompany ? "Edit Company" : "Add New Company"}
            >
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Company Name
                        </label>
                        <input
                            type="text"
                            value={formData.company_name}
                            onChange={(e) => handleInputChange('company_name', e.target.value)}
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
                                        <Building2 size={32} className="text-gray-400 mb-2" />
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

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Tax ID (TIN)
                        </label>
                        <input
                            type="text"
                            value={formData.tin}
                            onChange={(e) => handleInputChange('tin', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="Enter tax identification number"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Website
                        </label>
                        <input
                            type="text"
                            value={formData.website}
                            onChange={(e) => handleInputChange('website', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="Enter company website"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Email
                        </label>
                        <input
                            type="email"
                            value={formData.email}
                            onChange={(e) => handleInputChange('email', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="Enter company email"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Phone
                        </label>
                        <input
                            type="tel"
                            value={formData.phone}
                            onChange={(e) => handleInputChange('phone', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="Enter company phone"
                        />
                    </div>

                    <div className="flex flex-col gap-2">
                        <label className="block text-sm font-medium text-gray-700">Status</label>
                        <div className="flex gap-3 w-full">
                            <label className="flex-1 cursor-pointer">
                                <input 
                                    type="radio" 
                                    name="status" 
                                    value="active" 
                                    className="sr-only peer" 
                                    checked={status === 'active'} 
                                    onChange={(e) => {
                                        handleInputChange('status', e.target.value);
                                    }} 
                                />
                                <div className="relative px-4 py-4 bg-white border border-gray-300 rounded-lg transition-all duration-200 hover:border-gray-400">
                                    <span className="block text-sm font-medium text-center text-gray-700">ACTIVE</span>
                                    <div className={`absolute bottom-2 left-1/2 -translate-x-1/2 w-[60%] h-[5px] bg-${status === 'active' ? 'green-500' : 'gray-300'}`}></div>
                                </div>
                            </label>
                            <label className="flex-1 cursor-pointer">
                                <input 
                                    type="radio" 
                                    name="status" 
                                    value="inactive" 
                                    className="sr-only peer" 
                                    checked={status === 'inactive'} 
                                    onChange={(e) => {
                                        handleInputChange('status', e.target.value);
                                    }} 
                                />
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
                            <Save size={16} className="mr-2" />
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
