import React, { useState, useRef, useEffect } from 'react';
import { Menu, Search, Bell, ChevronDown, LogOut, User, Building2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function Header({ isCollapsed, onToggleSidebar }) {
    const [showDropdown, setShowDropdown] = useState(false);
    const [user, setUser] = useState(null);
    const [companies, setCompanies] = useState([]);
    const [selectedCompany, setSelectedCompany] = useState(null);
    const dropdownRef = useRef(null);

    useEffect(() => {
        const userData = localStorage.getItem('user');
        if (userData) setUser(JSON.parse(userData));
        fetchCompanies();

        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setShowDropdown(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
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

    const handleLogout = () => {
        localStorage.clear();
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

            <div className="hidden md:flex items-center relative max-w-xs w-full">
                <Search className="absolute left-3 text-gray-400" size={16} />
                <input 
                    className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-red-600/10 focus:border-red-600 outline-none transition-all" 
                    placeholder="Search ledgers, invoices..." 
                    type="text" 
                />
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
                            {user?.mu_first_name?.charAt(0) || 'A'}
                        </div>
                        <div className="hidden sm:block text-left">
                            <p className="text-xs font-bold text-gray-900 leading-none">{user?.mu_first_name} {user?.mu_last_name}</p>
                            <p className="text-[10px] text-gray-400 uppercase tracking-tighter mt-1 font-semibold">Accounting Admin</p>
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