import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Database, ShieldCheck, Users, Building, Warehouse, ChevronRight, BarChart, FileText, Package, DollarSign, CreditCard, TrendingUp, HandCoins, ShoppingCart, CreditCard as PaymentCard } from 'lucide-react';

export default function Sidebar({ isCollapsed }) {
    const [isMastersOpen, setIsMastersOpen] = useState(false);
    const [isReceiptsOpen, setIsReceiptsOpen] = useState(false);
    const [isSalesOpen, setIsSalesOpen] = useState(false);
    const [isPurchaseOpen, setIsPurchaseOpen] = useState(false);
    const location = useLocation();

    const NavLink = ({ to, icon: Icon, children }) => {
        const isActive = location.pathname === to;
        return (
            <Link
                to={to}
                className={`flex items-center gap-3 px-3 py-3 rounded-xl font-semibold transition-all duration-200 group ${isActive ? 'bg-red-600 text-white shadow-lg shadow-red-900/20' : 'text-gray-400 hover:bg-white/5 hover:text-white'
                    }`}
            >
                <Icon size={20} className={isActive ? 'text-white' : 'group-hover:text-red-500'} />
                {!isCollapsed && <span className="text-sm">{children}</span>}
            </Link>
        );
    };

    return (
        <aside className={`${isCollapsed ? 'w-20' : 'w-72'} bg-[#0B0B0B] text-white flex flex-col shrink-0 transition-all duration-300 ease-in-out`}>
            <style dangerouslySetInnerHTML={{
                __html: `
                .custom-sidebar-scrollbar::-webkit-scrollbar {
                    width: 5px;
                }
                .custom-sidebar-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-sidebar-scrollbar::-webkit-scrollbar-thumb {
                    background: #dc2626; /* red-600 */
                    border-radius: 10px;
                }
                .custom-sidebar-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: #b91c1c; /* red-700 */
                }
            `}} />
            {/* Branding Area */}
            <div className="flex items-center h-16 px-6 border-b-2 border-red-600 bg-black">
                <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center text-white font-black text-lg shadow-inner">5L</div>
                {!isCollapsed && (
                    <div className="ml-3 overflow-hidden whitespace-nowrap">
                        <span className="font-bold tracking-tight text-white block">5L SOLUTIONS</span>
                        <span className="text-[10px] text-red-600 font-bold tracking-[0.2em] -mt-1 block">CORP.</span>
                    </div>
                )}
            </div>

            <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto custom-sidebar-scrollbar">
                <NavLink to="/dashboard" icon={LayoutDashboard}>Dashboard</NavLink>

                <div className="pt-4">
                    {!isCollapsed && <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest px-3 mb-2">Internal Systems</p>}
                    <button
                        onClick={() => setIsMastersOpen(!isMastersOpen)}
                        className={`w-full flex items-center justify-between px-3 py-3 rounded-xl font-semibold transition-all ${isMastersOpen ? 'text-white' : 'text-gray-400 hover:bg-white/5'
                            }`}
                    >
                        <div className="flex items-center gap-3">
                            <Database size={20} className={isMastersOpen ? 'text-red-600' : ''} />
                            {!isCollapsed && <span className="text-sm">Masters</span>}
                        </div>
                        {!isCollapsed && <ChevronRight size={14} className={`transition-transform ${isMastersOpen ? 'rotate-90' : ''}`} />}
                    </button>

                    {isMastersOpen && !isCollapsed && (
                        <div className="mt-2 ml-4 space-y-1 border-l border-white/10 pl-4">
                            <Link to="/access" className={`flex items-center gap-3 py-2 text-sm transition-colors ${location.pathname === '/access' ? 'text-red-500 font-semibold' : 'text-gray-400 hover:text-red-500'}`}>
                                <ShieldCheck size={14} /> Access Control
                            </Link>
                            <Link to="/users" className={`flex items-center gap-3 py-2 text-sm transition-colors ${location.pathname === '/users' ? 'text-red-500 font-semibold' : 'text-gray-400 hover:text-red-500'}`}>
                                <Users size={14} /> User Management
                            </Link>
                            <Link to="/customer" className={`flex items-center gap-3 py-2 text-sm transition-colors ${location.pathname === '/customer' ? 'text-red-500 font-semibold' : 'text-gray-400 hover:text-red-500'}`}>
                                <Users size={14} /> Customer Management
                            </Link>
                            <Link to="/vendors" className={`flex items-center gap-3 py-2 text-sm transition-colors ${location.pathname === '/vendors' ? 'text-red-500 font-semibold' : 'text-gray-400 hover:text-red-500'}`}>
                                <Warehouse size={14} /> Vendor Management
                            </Link>
                            <Link to="/charts" className={`flex items-center gap-3 py-2 text-sm transition-colors ${location.pathname === '/charts' ? 'text-red-500 font-semibold' : 'text-gray-400 hover:text-red-500'}`}>
                                <BarChart size={14} /> Charts of Accounts
                            </Link>
                            <Link to="/proforma" className={`flex items-center gap-3 py-2 text-sm transition-colors ${location.pathname === '/proforma' ? 'text-red-500 font-semibold' : 'text-gray-400 hover:text-red-500'}`}>
                                <FileText size={14} /> Proforma Entries
                            </Link>
                            <Link to="/products" className={`flex items-center gap-3 py-2 text-sm transition-colors ${location.pathname === '/products' ? 'text-red-500 font-semibold' : 'text-gray-400 hover:text-red-500'}`}>
                                <Package size={14} /> Product & Service
                            </Link>
                            <Link to="/company" className={`flex items-center gap-3 py-2 text-sm transition-colors ${location.pathname === '/company' ? 'text-red-500 font-semibold' : 'text-gray-400 hover:text-red-500'}`}>
                                <Building size={14} /> Company Management
                            </Link>
                        </div>
                    )}
                </div>

                <div className="pt-4">
                    {!isCollapsed && <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest px-3 mb-2">Financial Operations</p>}
                    <button
                        onClick={() => setIsReceiptsOpen(!isReceiptsOpen)}
                        className={`w-full flex items-center justify-between px-3 py-3 rounded-xl font-semibold transition-all ${isReceiptsOpen ? 'text-white' : 'text-gray-400 hover:bg-white/5'
                            }`}
                    >
                        <div className="flex items-center gap-3">
                            <DollarSign size={20} className={isReceiptsOpen ? 'text-red-600' : ''} />
                            {!isCollapsed && <span className="text-sm">Receipts & Disbursements</span>}
                        </div>
                        {!isCollapsed && <ChevronRight size={14} className={`transition-transform ${isReceiptsOpen ? 'rotate-90' : ''}`} />}
                    </button>

                    {isReceiptsOpen && !isCollapsed && (
                        <div className="mt-2 ml-4 space-y-1 border-l border-white/10 pl-4">
                            <Link to="/receipts" className={`flex items-center gap-3 py-2 text-sm transition-colors ${location.pathname === '/receipts' ? 'text-red-500 font-semibold' : 'text-gray-400 hover:text-red-500'}`}>
                                <CreditCard size={14} /> Receipts
                            </Link>
                            <Link to="/disbursements" className={`flex items-center gap-3 py-2 text-sm transition-colors ${location.pathname === '/disbursements' ? 'text-red-500 font-semibold' : 'text-gray-400 hover:text-red-500'}`}>
                                <DollarSign size={14} /> Disbursements
                            </Link>
                        </div>
                    )}
                </div>

                <div className="pt-4">
                    {!isCollapsed && <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest px-3 mb-2">Revenue Management</p>}
                    <button
                        onClick={() => setIsSalesOpen(!isSalesOpen)}
                        className={`w-full flex items-center justify-between px-3 py-3 rounded-xl font-semibold transition-all ${isSalesOpen ? 'text-white' : 'text-gray-400 hover:bg-white/5'
                            }`}
                    >
                        <div className="flex items-center gap-3">
                            <TrendingUp size={20} className={isSalesOpen ? 'text-red-600' : ''} />
                            {!isCollapsed && <span className="text-sm">Sales & Collections</span>}
                        </div>
                        {!isCollapsed && <ChevronRight size={14} className={`transition-transform ${isSalesOpen ? 'rotate-90' : ''}`} />}
                    </button>

                    {isSalesOpen && !isCollapsed && (
                        <div className="mt-2 ml-4 space-y-1 border-l border-white/10 pl-4">
                            <Link to="/sales" className={`flex items-center gap-3 py-2 text-sm transition-colors ${location.pathname === '/sales' ? 'text-red-500 font-semibold' : 'text-gray-400 hover:text-red-500'}`}>
                                <TrendingUp size={14} /> Sales
                            </Link>
                            <Link to="/collections" className={`flex items-center gap-3 py-2 text-sm transition-colors ${location.pathname === '/collections' ? 'text-red-500 font-semibold' : 'text-gray-400 hover:text-red-500'}`}>
                                <HandCoins size={14} /> Collections
                            </Link>
                        </div>
                    )}
                </div>

                <div className="pt-4">
                    {!isCollapsed && <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest px-3 mb-2">Procurement & Treasury</p>}
                    <button
                        onClick={() => setIsPurchaseOpen(!isPurchaseOpen)}
                        className={`w-full flex items-center justify-between px-3 py-3 rounded-xl font-semibold transition-all ${isPurchaseOpen ? 'text-white' : 'text-gray-400 hover:bg-white/5'
                            }`}
                    >
                        <div className="flex items-center gap-3">
                            <ShoppingCart size={20} className={isPurchaseOpen ? 'text-red-600' : ''} />
                            {!isCollapsed && <span className="text-sm">Purchase & Payments</span>}
                        </div>
                        {!isCollapsed && <ChevronRight size={14} className={`transition-transform ${isPurchaseOpen ? 'rotate-90' : ''}`} />}
                    </button>

                    {isPurchaseOpen && !isCollapsed && (
                        <div className="mt-2 ml-4 space-y-1 border-l border-white/10 pl-4">
                            <Link to="/purchase" className={`flex items-center gap-3 py-2 text-sm transition-colors ${location.pathname === '/purchase' ? 'text-red-500 font-semibold' : 'text-gray-400 hover:text-red-500'}`}>
                                <ShoppingCart size={14} /> Purchase
                            </Link>
                            <Link to="/payments" className={`flex items-center gap-3 py-2 text-sm transition-colors ${location.pathname === '/payments' ? 'text-red-500 font-semibold' : 'text-gray-400 hover:text-red-500'}`}>
                                <PaymentCard size={14} /> Payments
                            </Link>
                        </div>
                    )}
                </div>
            </nav>

            {/* Version Footer */}
            {!isCollapsed && (
                <div className="p-4 border-t border-white/5 text-[10px] text-gray-600 text-center uppercase tracking-widest">
                    v2.0.4 Allied Services
                </div>
            )}
        </aside>
    );
}