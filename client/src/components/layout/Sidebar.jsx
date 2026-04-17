import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Database, ShieldCheck, Users, Building, Warehouse, ChevronRight, BarChart, FileText, Package, DollarSign, CreditCard, TrendingUp, HandCoins, ShoppingCart, CreditCard as PaymentCard, Settings, FileSpreadsheet, Percent, Receipt } from 'lucide-react';
import { getSidebarItems } from '../../utils/routeProtection';

export default function Sidebar({ isCollapsed }) {
    const [isMastersOpen, setIsMastersOpen] = useState(false);
    const [isReceiptsOpen, setIsReceiptsOpen] = useState(false);
    const [isSalesOpen, setIsSalesOpen] = useState(false);
    const [isPurchaseOpen, setIsPurchaseOpen] = useState(false);
    const [isAdjustmentsOpen, setIsAdjustmentsOpen] = useState(false);
    const location = useLocation();
    const [user, setUser] = useState(null);
    const [sidebarItems, setSidebarItems] = useState({});

    useEffect(() => {
        try {
            const userData = JSON.parse(localStorage.getItem('user'));
            setUser(userData);
            if (userData) {
                const items = getSidebarItems(userData);
                setSidebarItems(items);
                console.log('Sidebar items loaded:', items);
            }
        } catch (error) {
            console.error('Error loading sidebar items:', error);
            setSidebarItems({ main: [], masters: [], receipts: [], sales: [], purchase: [], adjustments: [] });
        }
    }, []);

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
                {/* Main Navigation */}
                {sidebarItems.main?.map((item, index) => {
                    if (!item || !item.name) return null;
                    return (
                        <NavLink key={item.name || index} to={`/${item.name}`} icon={LayoutDashboard}>
                            {item.label || item.name}
                        </NavLink>
                    );
                })}

                {/* Masters Section */}
                {sidebarItems.masters?.length > 0 && (
                    <div className="pt-4">
                        {!isCollapsed && <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest px-3 mb-2">Internal Systems</p>}
                        <button
                            onClick={() => setIsMastersOpen(!isMastersOpen)}
                            className={`w-full flex items-center justify-between px-3 py-3 rounded-xl font-semibold transition-all ${isMastersOpen ? 'text-white' : 'text-gray-400 hover:bg-white/5'}`}
                        >
                            <div className="flex items-center gap-3">
                                <Database size={20} className={isMastersOpen ? 'text-red-600' : ''} />
                                {!isCollapsed && <span className="text-sm">Masters</span>}
                            </div>
                            {!isCollapsed && <ChevronRight size={14} className={`transition-transform ${isMastersOpen ? 'rotate-90' : ''}`} />}
                        </button>

                        {isMastersOpen && !isCollapsed && (
                            <div className="mt-2 ml-4 space-y-1 border-l border-white/10 pl-4">
                                {sidebarItems.masters?.map((item, index) => {
                                    if (!item || !item.name) return null;
                                    const iconMap = {
                                        access: ShieldCheck,
                                        users: Users,
                                        customers: Users,
                                        vendors: Warehouse,
                                        charts: BarChart,
                                        proforma_entries: FileText,
                                        product_service: Package,
                                        company: Building,
                                        vat: Percent,
                                        withholding_tax: Receipt
                                    };
                                    const Icon = iconMap[item.name] || Settings;
                                    return (
                                        <Link
                                            key={item.name || index}
                                            to={`/${item.name}`}
                                            className={`flex items-center gap-3 py-2 text-sm transition-colors ${location.pathname === `/${item.name}` ? 'text-red-500 font-semibold' : 'text-gray-400 hover:text-red-500'}`}
                                        >
                                            <Icon size={14} /> {item.label || item.name}
                                        </Link>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* Receipts & Disbursements Section */}
                {sidebarItems.receipts?.length > 0 && (
                    <div className="pt-4">
                        {!isCollapsed && <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest px-3 mb-2">Financial Operations</p>}
                        <button
                            onClick={() => setIsReceiptsOpen(!isReceiptsOpen)}
                            className={`w-full flex items-center justify-between px-3 py-3 rounded-xl font-semibold transition-all ${isReceiptsOpen ? 'text-white' : 'text-gray-400 hover:bg-white/5'}`}
                        >
                            <div className="flex items-center gap-3">
                                <DollarSign size={20} className={isReceiptsOpen ? 'text-red-600' : ''} />
                                {!isCollapsed && <span className="text-sm">Receipts & Disbursements</span>}
                            </div>
                            {!isCollapsed && <ChevronRight size={14} className={`transition-transform ${isReceiptsOpen ? 'rotate-90' : ''}`} />}
                        </button>

                        {isReceiptsOpen && !isCollapsed && (
                            <div className="mt-2 ml-4 space-y-1 border-l border-white/10 pl-4">
                                {sidebarItems.receipts?.map((item, index) => {
                                    if (!item || !item.name) return null;
                                    const iconMap = {
                                        receipts: CreditCard,
                                        disbursement: DollarSign
                                    };
                                    const Icon = iconMap[item.name] || Settings;
                                    return (
                                        <Link
                                            key={item.name || index}
                                            to={`/${item.name}`}
                                            className={`flex items-center gap-3 py-2 text-sm transition-colors ${location.pathname === `/${item.name}` ? 'text-red-500 font-semibold' : 'text-gray-400 hover:text-red-500'}`}
                                        >
                                            <Icon size={14} /> {item.label || item.name}
                                        </Link>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* Sales & Collections Section */}
                {sidebarItems.sales?.length > 0 && (
                    <div className="pt-4">
                        {!isCollapsed && <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest px-3 mb-2">Revenue Management</p>}
                        <button
                            onClick={() => setIsSalesOpen(!isSalesOpen)}
                            className={`w-full flex items-center justify-between px-3 py-3 rounded-xl font-semibold transition-all ${isSalesOpen ? 'text-white' : 'text-gray-400 hover:bg-white/5'}`}
                        >
                            <div className="flex items-center gap-3">
                                <TrendingUp size={20} className={isSalesOpen ? 'text-red-600' : ''} />
                                {!isCollapsed && <span className="text-sm">Sales & Collections</span>}
                            </div>
                            {!isCollapsed && <ChevronRight size={14} className={`transition-transform ${isSalesOpen ? 'rotate-90' : ''}`} />}
                        </button>

                        {isSalesOpen && !isCollapsed && (
                            <div className="mt-2 ml-4 space-y-1 border-l border-white/10 pl-4">
                                {sidebarItems.sales?.map((item, index) => {
                                    if (!item || !item.name) return null;
                                    const iconMap = {
                                        sales: TrendingUp,
                                        collections: HandCoins
                                    };
                                    const Icon = iconMap[item.name] || Settings;
                                    return (
                                        <Link
                                            key={item.name || index}
                                            to={`/${item.name}`}
                                            className={`flex items-center gap-3 py-2 text-sm transition-colors ${location.pathname === `/${item.name}` ? 'text-red-500 font-semibold' : 'text-gray-400 hover:text-red-500'}`}
                                        >
                                            <Icon size={14} /> {item.label || item.name}
                                        </Link>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* Purchase & Payments Section */}
                {sidebarItems.purchase?.length > 0 && (
                    <div className="pt-4">
                        {!isCollapsed && <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest px-3 mb-2">Procurement & Treasury</p>}
                        <button
                            onClick={() => setIsPurchaseOpen(!isPurchaseOpen)}
                            className={`w-full flex items-center justify-between px-3 py-3 rounded-xl font-semibold transition-all ${isPurchaseOpen ? 'text-white' : 'text-gray-400 hover:bg-white/5'}`}
                        >
                            <div className="flex items-center gap-3">
                                <ShoppingCart size={20} className={isPurchaseOpen ? 'text-red-600' : ''} />
                                {!isCollapsed && <span className="text-sm">Purchase & Payments</span>}
                            </div>
                            {!isCollapsed && <ChevronRight size={14} className={`transition-transform ${isPurchaseOpen ? 'rotate-90' : ''}`} />}
                        </button>

                        {isPurchaseOpen && !isCollapsed && (
                            <div className="mt-2 ml-4 space-y-1 border-l border-white/10 pl-4">
                                {sidebarItems.purchase?.map((item, index) => {
                                    if (!item || !item.name) return null;
                                    const iconMap = {
                                        purchase: ShoppingCart,
                                        payments: PaymentCard
                                    };
                                    const Icon = iconMap[item.name] || Settings;
                                    return (
                                        <Link
                                            key={item.name || index}
                                            to={`/${item.name}`}
                                            className={`flex items-center gap-3 py-2 text-sm transition-colors ${location.pathname === `/${item.name}` ? 'text-red-500 font-semibold' : 'text-gray-400 hover:text-red-500'}`}
                                        >
                                            <Icon size={14} /> {item.label || item.name}
                                        </Link>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}
                {/* Adjustments Section */}
                {sidebarItems.adjustments?.length > 0 && (
                    <div className="pt-4">
                        {!isCollapsed && <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest px-3 mb-2">Adjustments</p>}
                        <button
                            onClick={() => setIsAdjustmentsOpen(!isAdjustmentsOpen)}
                            className={`w-full flex items-center justify-between px-3 py-3 rounded-xl font-semibold transition-all ${isAdjustmentsOpen ? 'text-white' : 'text-gray-400 hover:bg-white/5'}`}
                        >
                            <div className="flex items-center gap-3">
                                <FileSpreadsheet size={20} className={isAdjustmentsOpen ? 'text-red-600' : ''} />
                                {!isCollapsed && <span className="text-sm">Adjustments</span>}
                            </div>
                            {!isCollapsed && <ChevronRight size={14} className={`transition-transform ${isAdjustmentsOpen ? 'rotate-90' : ''}`} />}
                        </button>

                        {isAdjustmentsOpen && !isCollapsed && (
                            <div className="mt-2 ml-4 space-y-1 border-l border-white/10 pl-4">
                                {sidebarItems.adjustments?.map((item, index) => {
                                    if (!item || !item.name) return null;
                                    const iconMap = {
                                        adjustments: FileSpreadsheet
                                    };
                                    const Icon = iconMap[item.name] || Settings;
                                    return (
                                        <Link
                                            key={item.name || index}
                                            to={`/${item.name}`}
                                            className={`flex items-center gap-3 py-2 text-sm transition-colors ${location.pathname === `/${item.name}` ? 'text-red-500 font-semibold' : 'text-gray-400 hover:text-red-500'}`}
                                        >
                                            <Icon size={14} /> {item.label || item.name}
                                        </Link>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}
                {/* Show "No Access" message if no routes available */}
                {Object.values(sidebarItems).every(items => !items || items.length === 0) && (
                    <div className="text-center py-8">
                        <div className="w-12 h-12 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-3">
                            <ShieldCheck size={20} className="text-gray-600" />
                        </div>
                        <p className="text-gray-500 text-sm">No Access</p>
                        <p className="text-gray-600 text-xs mt-1">Contact administrator</p>
                    </div>
                )}
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