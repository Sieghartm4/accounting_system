import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Menu, Search, Bell, ChevronDown, LogOut, User, Building2, Calendar, X, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function Header({ isCollapsed, onToggleSidebar }) {
    const navigate = useNavigate();
    const [showDropdown, setShowDropdown] = useState(false);
    const [user, setUser] = useState(null);
    const [companies, setCompanies] = useState([]);
    const [selectedCompany, setSelectedCompany] = useState(null);
    const dropdownRef = useRef(null);
    
    // Search states
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [showSearchResults, setShowSearchResults] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    const [searchStartDate, setSearchStartDate] = useState('');
    const [searchEndDate, setSearchEndDate] = useState('');
    const [showSearchModal, setShowSearchModal] = useState(false);
    const searchRef = useRef(null);

    useEffect(() => {
        const userData = localStorage.getItem('user');
        if (userData) setUser(JSON.parse(userData));
        fetchCompanies();

        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setShowDropdown(false);
            if (searchRef.current && !searchRef.current.contains(e.target)) {
                setShowSearchResults(false);
                setShowSearchModal(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Set default date range
    useEffect(() => {
        const today = new Date();
        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
        setSearchStartDate(firstDay.toISOString().split('T')[0]);
        setSearchEndDate(today.toISOString().split('T')[0]);
    }, []);

    const fetchCompanies = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${import.meta.env.VITE_SERVER_LINK}/company`, {
                headers: { 'Authorization': `Bearer ${token}` },
            });
            if (response.ok) {
                const result = await response.json();
                if (result.success) {
                    setCompanies(result.data);
                    if (result.data.length > 0 && !selectedCompany) setSelectedCompany(result.data[0]);
                }
            }
        } catch (error) { console.error('Error:', error); }
    };

    const handleSearch = async () => {
        if (!searchQuery.trim() || !searchStartDate || !searchEndDate) {
            return;
        }

        setIsSearching(true);
        try {
            const token = localStorage.getItem('token');
            const params = new URLSearchParams({
                startDate: searchStartDate,
                endDate: searchEndDate,
                search: searchQuery.trim()
            });

            const response = await fetch(`${import.meta.env.VITE_SERVER_LINK}/reports/search?${params}`, {
                headers: { 'Authorization': `Bearer ${token}` },
            });

            if (response.ok) {
                const result = await response.json();
                if (result.success) {
                    setSearchResults(result.data);
                    setShowSearchResults(true);
                }
            }
        } catch (error) {
            console.error('Search error:', error);
        } finally {
            setIsSearching(false);
        }
    };

    const handleSearchInputChange = (e) => {
        setSearchQuery(e.target.value);
        if (e.target.value.trim().length > 2) {
            setShowSearchModal(true);
        } else {
            setShowSearchModal(false);
            setShowSearchResults(false);
        }
    };

    const handleSearchInputKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (searchQuery.trim().length > 0) {
                handleSearch();
            }
        }
    };

    const handleSearchSubmit = (e) => {
        e.preventDefault();
        if (searchQuery.trim().length > 0) {
            handleSearch();
        }
    };

    const handleSearchResultClick = (result) => {
        // Map document types to routes
        const routeMap = {
            'Sales': 'sales',
            'Collection': 'collections',
            'Receipt': 'receipts',
            'Purchase': 'purchase',
            'Cash Disbursement': 'disbursement',
            'Payment': 'payments',
            'Adjustment': 'adjustments'
        };

        const route = routeMap[result.document_type];
        if (route) {
            const id = result.id ?? result.document_id;
            if (!id) return;

            // Navigate to the page with record id so it opens view mode and fetches data
            navigate(`/${route}?id=${encodeURIComponent(id)}`);
            setShowSearchModal(false);
            setShowSearchResults(false);
        }
    };

    const handleLogout = () => {
        // Preserve remembered credentials before clearing
        const rememberedUser = localStorage.getItem('rememberedUser');
        const rememberedPassword = localStorage.getItem('rememberedPassword');
        
        // Clear all localStorage
        localStorage.clear();
        
        // Restore remembered credentials if they existed
        if (rememberedUser && rememberedPassword) {
            localStorage.setItem('rememberedUser', rememberedUser);
            localStorage.setItem('rememberedPassword', rememberedPassword);
        }
        
        window.location.href = '/';
    };

    return (
        <header className="h-16 bg-white border-b border-gray-200 flex items-center px-6 gap-4 shrink-0 shadow-sm z-30">
            <button 
                className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors" 
                onClick={onToggleSidebar}
            >
                <Menu size={20} />
            </button>

            {/* Company Selector - Key for Accounting Systems */}
            <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg cursor-pointer hover:border-red-600 transition-all">
                <Building2 size={16} className="text-red-600" />
                <span className="text-sm font-bold text-gray-700">{selectedCompany?.name || 'Select Entity'}</span>
                <ChevronDown size={14} className="text-gray-400" />
            </div>

            <div className="flex-1" />

            <div className="hidden md:flex items-center relative max-w-xs w-full" ref={searchRef}>
                <Search className="absolute left-3 text-gray-400" size={16} />
                <input 
                    className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-red-600/10 focus:border-red-600 outline-none transition-all" 
                    placeholder="Search ledgers, invoices..." 
                    type="text" 
                    value={searchQuery}
                    onChange={handleSearchInputChange}
                    onKeyDown={handleSearchInputKeyDown}
                    onFocus={() => searchQuery.trim().length > 2 && setShowSearchModal(true)}
                />
                
                {/* Search Modal */}
                <AnimatePresence>
                    {showSearchModal && (
                        <motion.div 
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 10 }}
                            className="absolute top-full mt-2 left-0 right-0 bg-white rounded-xl shadow-2xl border border-gray-100 p-4 z-50 w-96"
                        >
                            <form onSubmit={handleSearchSubmit} className="space-y-3">
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">Date Range</label>
                                    <div className="flex gap-2">
                                        <div className="flex-1">
                                            <input 
                                                type="date" 
                                                value={searchStartDate}
                                                onChange={(e) => setSearchStartDate(e.target.value)}
                                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-red-600/10 focus:border-red-600 outline-none"
                                            />
                                        </div>
                                        <div className="flex-1">
                                            <input 
                                                type="date" 
                                                value={searchEndDate}
                                                onChange={(e) => setSearchEndDate(e.target.value)}
                                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-red-600/10 focus:border-red-600 outline-none"
                                            />
                                        </div>
                                    </div>
                                </div>
                                <button 
                                    type="submit"
                                    disabled={isSearching || !searchQuery.trim()}
                                    className="w-full bg-red-600 text-white py-2 px-4 rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                                >
                                    {isSearching ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                            Searching...
                                        </>
                                    ) : (
                                        <>
                                            <Search size={16} />
                                            Search Documents
                                        </>
                                    )}
                                </button>
                                {showSearchResults && (
                                    <div className="mt-4 border-t border-gray-100 pt-4">
                                        <div className="flex items-center justify-between mb-2">
                                            <h4 className="text-xs font-semibold text-gray-700">
                                                Results ({searchResults.length})
                                            </h4>
                                            <button 
                                                type="button"
                                                onClick={() => setShowSearchModal(false)}
                                                className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
                                            >
                                                <X size={14} className="text-gray-400" />
                                            </button>
                                        </div>
                                        <div className="max-h-60 overflow-y-auto space-y-2">
                                            {searchResults.length > 0 ? (
                                                searchResults.map((result, index) => (
                                                    <div 
                                                        key={index}
                                                        className="p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                                                        onClick={() => handleSearchResultClick(result)}
                                                    >
                                                        <div className="flex items-start gap-2">
                                                            <FileText size={14} className="text-red-600 mt-0.5 flex-shrink-0" />
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-center gap-2 mb-1">
                                                                    <span className="text-xs font-semibold text-gray-900">
                                                                        {result.document_type}
                                                                    </span>
                                                                    <span className="text-xs text-gray-500">
                                                                        {result.document_date}
                                                                    </span>
                                                                </div>
                                                                <p className="text-xs text-gray-700 font-medium truncate">
                                                                    {result.document_reference}
                                                                </p>
                                                                <p className="text-xs text-gray-500 truncate">
                                                                    {result.customer_name || result.vendor_name}
                                                                </p>
                                                                {result.amount && (
                                                                    <p className="text-xs font-semibold text-red-600">
                                                                        ₱{parseFloat(result.amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                                                                    </p>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))
                                            ) : (
                                                <p className="text-xs text-gray-500 text-center py-4">
                                                    No results found for "{searchQuery}"
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </form>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            <div className="flex items-center gap-3">
                <button className="p-2 rounded-full hover:bg-gray-100 text-gray-500 relative transition-all">
                    <Bell size={20} />
                    <span className="absolute top-2 right-2 w-2 h-2 bg-red-600 rounded-full border-2 border-white"></span>
                </button>
                
                <div className="h-8 w-px bg-gray-200 mx-1"></div>

                <div className="relative" ref={dropdownRef}>
                    <button 
                        className="flex items-center gap-3 p-1 rounded-full hover:bg-gray-50 transition-all"
                        onClick={() => setShowDropdown(!showDropdown)}
                    >
                        <div className="w-9 h-9 rounded-xl bg-black flex items-center justify-center text-white text-xs font-bold shadow-lg shadow-black/10 border-b-2 border-red-600">
                            {user?.username?.charAt(0)?.toUpperCase() || 'A'}
                        </div>
                        <div className="hidden sm:block text-left">
                            <p className="text-xs font-bold text-gray-900 leading-none">{user?.username || 'User'}</p>
                        </div>
                        <ChevronDown size={14} className={`text-gray-400 transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
                    </button>
                    
                    <AnimatePresence>
                        {showDropdown && (
                            <motion.div 
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 10 }}
                                className="absolute right-0 mt-3 w-56 bg-white rounded-xl shadow-2xl border border-gray-100 py-2 z-50 overflow-hidden"
                            >
                                <button className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                                    <User size={16} className="text-gray-400" /> My Profile
                                </button>
                                <button 
                                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                                    onClick={() => navigate('/company')}
                                >
                                    <Building2 size={16} className="text-gray-400" /> Company
                                </button>
                                <div className="h-px bg-gray-100 my-1 mx-2"></div>
                                <button 
                                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-600 hover:bg-red-50 transition-colors font-bold"
                                    onClick={handleLogout}
                                >
                                    <LogOut size={16} /> Log Out
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </header>
    );
}