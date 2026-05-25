import React, { useState, useEffect } from 'react'

import { Link, useLocation } from 'react-router-dom'

import {
  LayoutDashboard,
  Database,
  ShieldCheck,
  Users,
  Warehouse,
  ChevronRight,
  BarChart,
  FileText,
  Package,
  DollarSign,
  CreditCard,
  TrendingUp,
  HandCoins,
  ShoppingCart,
  CreditCard as PaymentCard,
  Settings,
  FileSpreadsheet,
  Percent,
  Receipt,
  Scale,
  FileSearch,
  BookOpen,
  PieChart,
  BarChart3,
  Landmark,
  Clock3,
} from 'lucide-react'

import { getSidebarItems } from '../../utils/routeProtection'

export default function Sidebar({ isCollapsed }) {
  const [isMastersOpen, setIsMastersOpen] = useState(false)

  const [isReceiptsOpen, setIsReceiptsOpen] = useState(false)

  const [isSalesOpen, setIsSalesOpen] = useState(false)

  const [isPurchaseOpen, setIsPurchaseOpen] = useState(false)

  const [isAdjustmentsOpen, setIsAdjustmentsOpen] = useState(false)

  const [isReportsOpen, setIsReportsOpen] = useState(false)

  const [isPartnersOpen, setIsPartnersOpen] = useState(false)

  const [isSettingsOpen, setIsSettingsOpen] = useState(false)

  const location = useLocation()

  const [user, setUser] = useState(null)

  const [sidebarItems, setSidebarItems] = useState({})

  const [company, setCompany] = useState(null)

  const [manualStates, setManualStates] = useState({
    masters: null,

    receipts: null,

    sales: null,

    purchase: null,

    adjustments: null,

    reports: null,

    partners: null,

    settings: null,
  })

  useEffect(() => {
    try {
      const userData = JSON.parse(localStorage.getItem('user'))

      setUser(userData)

      if (userData) {
        const items = getSidebarItems(userData)

        setSidebarItems(items)

        console.log('Sidebar items loaded:', items)
      }
    } catch (error) {
      console.error('Error loading sidebar items:', error)

      setSidebarItems({
        main: [],
        masters: [],
        partners: [],
        receipts: [],
        sales: [],
        purchase: [],
        adjustments: [],
        reports: [],
        settings: [],
      })
    }
  }, [])

  // Fetch company data

  useEffect(() => {
    const fetchCompany = async () => {
      try {
        const token = localStorage.getItem('token')

        const response = await fetch(
          `${import.meta.env.VITE_SERVER_LINK}/company/single`,
          {
            method: 'GET',

            headers: {
              'Content-Type': 'application/json',

              Authorization: `Bearer ${token}`,
            },
          },
        )

        if (response.ok) {
          const result = await response.json()

          if (result.success && result.data) {
            setCompany(result.data)

            console.log('Company data loaded:', result.data)
          }
        }
      } catch (error) {
        console.error('Error fetching company data:', error)
      }
    }

    fetchCompany()
  }, [])

  // Auto-open collapsible based on current route

  useEffect(() => {
    const currentPath = location.pathname

    // Check if user has manually set a state for this section

    const checkAndSetState = (sectionKey, routes, setState) => {
      const manualState = manualStates[sectionKey]

      if (manualState !== null) {
        // Use manual state if user has manually set it

        setState(manualState)
      } else {
        // Auto-open if current path matches any route in this section

        const shouldOpen =
          routes.some((route) => currentPath === `/${route}`) ||
          routes.some((route) => currentPath === `/${route.replace(/_/g, '-')}`)

        setState(shouldOpen)
      }
    }

    if (sidebarItems.masters?.length > 0) {
      checkAndSetState(
        'masters',
        sidebarItems.masters.map((item) => item.name),
        setIsMastersOpen,
      )
    }

    if (sidebarItems.receipts?.length > 0) {
      checkAndSetState(
        'receipts',
        sidebarItems.receipts.map((item) => item.name),
        setIsReceiptsOpen,
      )
    }

    if (sidebarItems.sales?.length > 0) {
      checkAndSetState(
        'sales',
        sidebarItems.sales.map((item) => item.name),
        setIsSalesOpen,
      )
    }

    if (sidebarItems.purchase?.length > 0) {
      checkAndSetState(
        'purchase',
        sidebarItems.purchase.map((item) => item.name),
        setIsPurchaseOpen,
      )
    }

    if (sidebarItems.adjustments?.length > 0) {
      checkAndSetState(
        'adjustments',
        sidebarItems.adjustments.map((item) => item.name),
        setIsAdjustmentsOpen,
      )
    }

    if (sidebarItems.partners?.length > 0) {
      checkAndSetState(
        'partners',
        sidebarItems.partners.map((item) => item.name),
        setIsPartnersOpen,
      )
    }

    if (sidebarItems.reports?.length > 0) {
      checkAndSetState(
        'reports',
        sidebarItems.reports.map((item) => item.name),
        setIsReportsOpen,
      )
    }

    if (sidebarItems.settings?.length > 0) {
      checkAndSetState(
        'settings',
        sidebarItems.settings.map((item) => item.name),
        setIsSettingsOpen,
      )
    }
  }, [location.pathname, sidebarItems, manualStates])

  // Handle manual state changes

  const handleManualToggle = (sectionKey, currentState, setState) => {
    const newState = !currentState

    setState(newState)

    setManualStates((prev) => ({
      ...prev,

      [sectionKey]: newState,
    }))
  }

  const NavLink = ({ to, icon: Icon, children }) => {
    const isActive = location.pathname === to

    return (
      <Link
        to={to}
        className={`flex items-center gap-3 px-3 py-3 rounded-xl font-semibold transition-all duration-200 group ${
          isActive
            ? 'bg-red-600 text-white shadow-lg shadow-red-900/20'
            : 'text-gray-400 hover:bg-white/5 hover:text-white'
        }`}
      >
        <Icon
          size={20}
          className={isActive ? 'text-white' : 'group-hover:text-red-500'}
        />

        {!isCollapsed && <span className="text-sm">{children}</span>}
      </Link>
    )
  }

  return (
    <aside
      className={`${isCollapsed ? 'w-20' : 'w-72'} bg-[#0B0B0B] text-white flex flex-col shrink-0 transition-all duration-300 ease-in-out`}
    >
      <style
        dangerouslySetInnerHTML={{
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

            `,
        }}
      />

      {/* Branding Area */}

      <div className="flex items-center h-16 px-6 border-b-2 border-red-600 bg-black">
        {company?.logo ? (
          <img
            src={company.logo}
            alt={company.company_name || 'Company Logo'}
            className="w-12 h-12 rounded-lg object-cover shadow-inner"
          />
        ) : (
          <div className="w-12 h-12 rounded-lg flex items-center justify-center text-white font-black text-2xl shadow-inner">
            &nbsp;
          </div>
        )}

        {!isCollapsed && (
          <div className="ml-3">
            <span className="font-bold tracking-tight text-white text-2xl block">
              {company?.company_name || '\u00A0'}
            </span>
            <span className="text-[11px] text-red-600 font-bold tracking-[0.2em] block">
              {company?.email || '\u00A0'}
            </span>
          </div>
        )}
      </div>

      <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto custom-sidebar-scrollbar">
        {/* Main Navigation */}

        {sidebarItems.main?.map((item, index) => {
          if (!item || !item.name) return null

          return (
            <NavLink
              key={item.name || index}
              to={`/${item.name}`}
              icon={LayoutDashboard}
            >
              {item.label || item.name}
            </NavLink>
          )
        })}

        {/* Masters Section */}

        {sidebarItems.masters?.length > 0 && (
          <div className="pt-4">
            {!isCollapsed && (
              <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest px-3 mb-2">
                Internal Systems
              </p>
            )}

            <button
              onClick={() =>
                handleManualToggle('masters', isMastersOpen, setIsMastersOpen)
              }
              className={`w-full flex items-center justify-between px-3 py-3 rounded-xl font-semibold transition-all ${isMastersOpen ? 'text-white' : 'text-gray-400 hover:bg-white/5'}`}
            >
              <div className="flex items-center gap-3">
                <Database
                  size={20}
                  className={isMastersOpen ? 'text-red-600' : ''}
                />

                {!isCollapsed && <span className="text-sm">Masters</span>}
              </div>

              {!isCollapsed && (
                <ChevronRight
                  size={14}
                  className={`transition-transform ${isMastersOpen ? 'rotate-90' : ''}`}
                />
              )}
            </button>

            {isMastersOpen && !isCollapsed && (
              <div className="mt-2 ml-4 space-y-1 border-l border-white/10 pl-4">
                {sidebarItems.masters

                  ?.filter((item) => item?.name !== 'company')

                  ?.map((item, index) => {
                    if (!item || !item.name) return null

                    const iconMap = {
                      access: ShieldCheck,

                      users: Users,

                      customers: Users,

                      vendors: Warehouse,

                      charts: BarChart,

                      proforma_entries: FileText,

                      product_service: Package,

                      vat: Percent,

                      withholding_tax: Receipt,
                    }

                    const Icon = iconMap[item.name] || Settings

                    return (
                      <Link
                        key={item.name || index}
                        to={`/${item.name}`}
                        className={`flex items-center gap-3 py-2 text-sm transition-colors ${location.pathname === `/${item.name}` ? 'text-red-500 font-semibold' : 'text-gray-400 hover:text-red-500'}`}
                      >
                        <Icon size={14} /> {item.label || item.name}
                      </Link>
                    )
                  })}
              </div>
            )}
          </div>
        )}

        {/* Customers & Vendors Section */}

        {sidebarItems.partners?.length > 0 && (
          <div className="pt-4">
            {!isCollapsed && (
              <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest px-3 mb-2">
                Partners
              </p>
            )}

            <button
              onClick={() =>
                handleManualToggle('partners', isPartnersOpen, setIsPartnersOpen)
              }
              className={`w-full flex items-center justify-between px-3 py-3 rounded-xl font-semibold transition-all ${isPartnersOpen ? 'text-white' : 'text-gray-400 hover:bg-white/5'}`}
            >
              <div className="flex items-center gap-3">
                <Users size={20} className={isPartnersOpen ? 'text-red-600' : ''} />

                {!isCollapsed && (
                  <span className="text-sm">Customers & Vendors</span>
                )}
              </div>

              {!isCollapsed && (
                <ChevronRight
                  size={14}
                  className={`transition-transform ${isPartnersOpen ? 'rotate-90' : ''}`}
                />
              )}
            </button>

            {isPartnersOpen && !isCollapsed && (
              <div className="mt-2 ml-4 space-y-1 border-l border-white/10 pl-4">
                {sidebarItems.partners?.map((item, index) => {
                  if (!item || !item.name) return null

                  const iconMap = {
                    customers: Users,
                    customer_transactions: FileText,
                    vendors: Warehouse,
                    vendor_transactions: FileText,
                  }

                  const Icon = iconMap[item.name] || Settings

                  return (
                    <Link
                      key={item.name || index}
                      to={`/${item.name.replace(/_/g, '-')}`}
                      className={`flex items-center gap-3 py-2 text-sm transition-colors ${location.pathname === `/${item.name.replace(/_/g, '-')}` ? 'text-red-500 font-semibold' : 'text-gray-400 hover:text-red-500'}`}
                    >
                      <Icon size={14} /> {item.label || item.name}
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Receipts & Disbursements Section */}

        {sidebarItems.receipts?.length > 0 && (
          <div className="pt-4">
            {!isCollapsed && (
              <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest px-3 mb-2">
                Financial Operations
              </p>
            )}

            <button
              onClick={() =>
                handleManualToggle('receipts', isReceiptsOpen, setIsReceiptsOpen)
              }
              className={`w-full flex items-center justify-between px-3 py-3 rounded-xl font-semibold transition-all ${isReceiptsOpen ? 'text-white' : 'text-gray-400 hover:bg-white/5'}`}
            >
              <div className="flex items-center gap-3">
                <DollarSign
                  size={20}
                  className={isReceiptsOpen ? 'text-red-600' : ''}
                />

                {!isCollapsed && (
                  <span className="text-sm">Receipts & Disbursements</span>
                )}
              </div>

              {!isCollapsed && (
                <ChevronRight
                  size={14}
                  className={`transition-transform ${isReceiptsOpen ? 'rotate-90' : ''}`}
                />
              )}
            </button>

            {isReceiptsOpen && !isCollapsed && (
              <div className="mt-2 ml-4 space-y-1 border-l border-white/10 pl-4">
                {sidebarItems.receipts?.map((item, index) => {
                  if (!item || !item.name) return null

                  const iconMap = {
                    receipts: CreditCard,

                    disbursement: DollarSign,
                  }

                  const Icon = iconMap[item.name] || Settings

                  return (
                    <Link
                      key={item.name || index}
                      to={`/${item.name}`}
                      className={`flex items-center gap-3 py-2 text-sm transition-colors ${location.pathname === `/${item.name}` ? 'text-red-500 font-semibold' : 'text-gray-400 hover:text-red-500'}`}
                    >
                      <Icon size={14} /> {item.label || item.name}
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Sales & Collections Section */}

        {sidebarItems.sales?.length > 0 && (
          <div className="pt-4">
            {!isCollapsed && (
              <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest px-3 mb-2">
                Revenue Management
              </p>
            )}

            <button
              onClick={() =>
                handleManualToggle('sales', isSalesOpen, setIsSalesOpen)
              }
              className={`w-full flex items-center justify-between px-3 py-3 rounded-xl font-semibold transition-all ${isSalesOpen ? 'text-white' : 'text-gray-400 hover:bg-white/5'}`}
            >
              <div className="flex items-center gap-3">
                <TrendingUp
                  size={20}
                  className={isSalesOpen ? 'text-red-600' : ''}
                />

                {!isCollapsed && (
                  <span className="text-sm">Sales & Collections</span>
                )}
              </div>

              {!isCollapsed && (
                <ChevronRight
                  size={14}
                  className={`transition-transform ${isSalesOpen ? 'rotate-90' : ''}`}
                />
              )}
            </button>

            {isSalesOpen && !isCollapsed && (
              <div className="mt-2 ml-4 space-y-1 border-l border-white/10 pl-4">
                {sidebarItems.sales?.map((item, index) => {
                  if (!item || !item.name) return null

                  const iconMap = {
                    sales: TrendingUp,

                    collections: HandCoins,

                    aging_receivables: Clock3,
                  }

                  const Icon = iconMap[item.name] || Settings

                  return (
                    <Link
                      key={item.name || index}
                      to={`/${item.name}`}
                      className={`flex items-center gap-3 py-2 text-sm transition-colors ${location.pathname === `/${item.name}` ? 'text-red-500 font-semibold' : 'text-gray-400 hover:text-red-500'}`}
                    >
                      <Icon size={14} /> {item.label || item.name}
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Purchase & Payments Section */}

        {sidebarItems.purchase?.length > 0 && (
          <div className="pt-4">
            {!isCollapsed && (
              <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest px-3 mb-2">
                Procurement & Treasury
              </p>
            )}

            <button
              onClick={() =>
                handleManualToggle('purchase', isPurchaseOpen, setIsPurchaseOpen)
              }
              className={`w-full flex items-center justify-between px-3 py-3 rounded-xl font-semibold transition-all ${isPurchaseOpen ? 'text-white' : 'text-gray-400 hover:bg-white/5'}`}
            >
              <div className="flex items-center gap-3">
                <ShoppingCart
                  size={20}
                  className={isPurchaseOpen ? 'text-red-600' : ''}
                />

                {!isCollapsed && (
                  <span className="text-sm">Purchase & Payments</span>
                )}
              </div>

              {!isCollapsed && (
                <ChevronRight
                  size={14}
                  className={`transition-transform ${isPurchaseOpen ? 'rotate-90' : ''}`}
                />
              )}
            </button>

            {isPurchaseOpen && !isCollapsed && (
              <div className="mt-2 ml-4 space-y-1 border-l border-white/10 pl-4">
                {sidebarItems.purchase?.map((item, index) => {
                  if (!item || !item.name) return null

                  const iconMap = {
                    purchase: ShoppingCart,

                    payments: PaymentCard,
                  }

                  const Icon = iconMap[item.name] || Settings

                  return (
                    <Link
                      key={item.name || index}
                      to={`/${item.name}`}
                      className={`flex items-center gap-3 py-2 text-sm transition-colors ${location.pathname === `/${item.name}` ? 'text-red-500 font-semibold' : 'text-gray-400 hover:text-red-500'}`}
                    >
                      <Icon size={14} /> {item.label || item.name}
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Adjustments Section */}

        {sidebarItems.adjustments?.length > 0 && (
          <div className="pt-4">
            {!isCollapsed && (
              <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest px-3 mb-2">
                Adjustments
              </p>
            )}

            <button
              onClick={() =>
                handleManualToggle(
                  'adjustments',
                  isAdjustmentsOpen,
                  setIsAdjustmentsOpen,
                )
              }
              className={`w-full flex items-center justify-between px-3 py-3 rounded-xl font-semibold transition-all ${isAdjustmentsOpen ? 'text-white' : 'text-gray-400 hover:bg-white/5'}`}
            >
              <div className="flex items-center gap-3">
                <FileSpreadsheet
                  size={20}
                  className={isAdjustmentsOpen ? 'text-red-600' : ''}
                />

                {!isCollapsed && <span className="text-sm">Adjustments</span>}
              </div>

              {!isCollapsed && (
                <ChevronRight
                  size={14}
                  className={`transition-transform ${isAdjustmentsOpen ? 'rotate-90' : ''}`}
                />
              )}
            </button>

            {isAdjustmentsOpen && !isCollapsed && (
              <div className="mt-2 ml-4 space-y-1 border-l border-white/10 pl-4">
                {sidebarItems.adjustments?.map((item, index) => {
                  if (!item || !item.name) return null

                  const iconMap = {
                    adjustments: FileSpreadsheet,

                    bank_reconciliation: Landmark,
                  }

                  const Icon = iconMap[item.name] || Settings

                  return (
                    <Link
                      key={item.name || index}
                      to={`/${item.name.replace(/_/g, '-')}`}
                      className={`flex items-center gap-3 py-2 text-sm transition-colors ${location.pathname === `/${item.name.replace(/_/g, '-')}` ? 'text-red-500 font-semibold' : 'text-gray-400 hover:text-red-500'}`}
                    >
                      <Icon size={14} /> {item.label || item.name}
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Reports Section */}

        {sidebarItems.reports?.length > 0 && (
          <div className="pt-4">
            {!isCollapsed && (
              <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest px-3 mb-2">
                Reports
              </p>
            )}

            <button
              onClick={() =>
                handleManualToggle('reports', isReportsOpen, setIsReportsOpen)
              }
              className={`w-full flex items-center justify-between px-3 py-3 rounded-xl font-semibold transition-all ${isReportsOpen ? 'text-white' : 'text-gray-400 hover:bg-white/5'}`}
            >
              <div className="flex items-center gap-3">
                <FileSearch
                  size={20}
                  className={isReportsOpen ? 'text-red-600' : ''}
                />

                {!isCollapsed && <span className="text-sm">Reports</span>}
              </div>

              {!isCollapsed && (
                <ChevronRight
                  size={14}
                  className={`transition-transform ${isReportsOpen ? 'rotate-90' : ''}`}
                />
              )}
            </button>

            {isReportsOpen && !isCollapsed && (
              <div className="mt-2 ml-4 space-y-1 border-l border-white/10 pl-4">
                {sidebarItems.reports?.map((item, index) => {
                  if (!item || !item.name) return null

                  const iconMap = {
                    trial_balance: Scale,

                    income_statement: FileText,

                    general_ledger: BookOpen,

                    balance_sheet: PieChart,

                    statement_of_comprehensive_income: BarChart3,

                    journal_entries: FileText,

                    bank_reconciliation: Landmark,
                  }

                  const Icon = iconMap[item.name] || Settings

                  return (
                    <Link
                      key={item.name || index}
                      to={`/${item.name.replace(/_/g, '-')}`}
                      className={`flex items-center gap-3 py-2 text-sm transition-colors ${location.pathname === `/${item.name.replace(/_/g, '-')}` ? 'text-red-500 font-semibold' : 'text-gray-400 hover:text-red-500'}`}
                    >
                      <Icon size={14} /> {item.label || item.name}
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Settings Section */}

        {sidebarItems.settings?.length > 0 && (
          <div className="pt-4">
            {!isCollapsed && (
              <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest px-3 mb-2">
                System
              </p>
            )}

            <button
              onClick={() =>
                handleManualToggle('settings', isSettingsOpen, setIsSettingsOpen)
              }
              className={`w-full flex items-center justify-between px-3 py-3 rounded-xl font-semibold transition-all ${isSettingsOpen ? 'text-white' : 'text-gray-400 hover:bg-white/5'}`}
            >
              <div className="flex items-center gap-3">
                <Settings
                  size={20}
                  className={isSettingsOpen ? 'text-red-600' : ''}
                />

                {!isCollapsed && <span className="text-sm">Settings</span>}
              </div>

              {!isCollapsed && (
                <ChevronRight
                  size={14}
                  className={`transition-transform ${isSettingsOpen ? 'rotate-90' : ''}`}
                />
              )}
            </button>

            {isSettingsOpen && !isCollapsed && (
              <div className="mt-2 ml-4 space-y-1 border-l border-white/10 pl-4">
                {sidebarItems.settings?.map((item, index) => {
                  if (!item || !item.name) return null

                  const iconMap = {
                    audit_trail: FileSearch,
                  }

                  const Icon = iconMap[item.name] || Settings

                  return (
                    <Link
                      key={item.name || index}
                      to={`/${item.name.replace(/_/g, '-')}`}
                      className={`flex items-center gap-3 py-2 text-sm transition-colors ${location.pathname === `/${item.name.replace(/_/g, '-')}` ? 'text-red-500 font-semibold' : 'text-gray-400 hover:text-red-500'}`}
                    >
                      <Icon size={14} /> {item.label || item.name}
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Show "No Access" message if no routes available */}

        {Object.values(sidebarItems).every(
          (items) => !items || items.length === 0,
        ) && (
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
  )
}
