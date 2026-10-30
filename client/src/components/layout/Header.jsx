import React, { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useNotificationsState } from './NotificationContext'
import { NotificationList } from '../NotificationList'
import {
  Menu,
  Search,
  Bell,
  ChevronDown,
  LogOut,
  User,
  X,
  FileText,
  Shield,
  LayoutDashboard,
  Database,
  ShieldCheck,
  Users,
  Warehouse,
  BarChart,
  Package,
  DollarSign,
  CreditCard,
  TrendingUp,
  HandCoins,
  ShoppingCart,
  FileSpreadsheet,
  Scale,
  BookOpen,
  PieChart,
  BarChart3,
  Landmark,
  Clock3,
  ArrowRight,
  Repeat,
  CalendarRange,
  History,
  Receipt,
  Percent,
  MapPin,
  Building2,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import RightSideModal from '../RightSideModal'
import { hasRouteAccess, getAccessibleRoutes, ROUTE_CONFIG } from '../../utils/routeProtection'
import { API, SUBSCRIPTION_API } from '../../api/endpoints'
import LoadingScreen from '../LoadingScreen'

const SEARCH_ROUTE_DOCUMENT_TYPE_MAP = {
  sales: 'Sales',
  collections: 'Collection',
  receipts: 'Receipt',
  purchase: 'Purchase',
  disbursement: 'Cash Disbursement',
  payments: 'Payment',
  adjustments: 'Journal Voucher',
}

const ICON_MAP = {
  LayoutDashboard,
  ShieldCheck,
  Users,
  Warehouse,
  BarChart,
  FileText,
  Package,
  Percent,
  Receipt,
  Scale,
  BookOpen,
  PieChart,
  BarChart3,
  Landmark,
  Clock3,
  ArrowRight,
  Repeat,
  CalendarRange,
  History,
  Database,
  DollarSign,
  CreditCard,
  TrendingUp,
  HandCoins,
  ShoppingCart,
  FileSpreadsheet,
  MapPin,
  PaymentCard: CreditCard, // Use CreditCard as fallback for PaymentCard
}

// Map ROUTE_CONFIG names to actual route paths in App.jsx
const ROUTE_PATH_MAP = {
  dashboard: 'dashboard',
  access: 'access',
  users: 'users',
  customers: 'customers',
  vendors: 'vendors',
  charts: 'charts',
  proforma_entries: 'proforma_entries',
  product_service: 'product_service',
  vat: 'vat',
  responsibility_center: 'responsibility_center',
  withholding_tax: 'withholding-tax',
  witholding_tax: 'withholding-tax', // Legacy alias for backward compatibility
  tax_compliance: 'tax-compliance',
  customer_transactions: 'customer-transactions',
  vendor_transactions: 'vendor-transactions',
  receipts: 'receipts',
  disbursement: 'disbursement',
  sales: 'sales',
  collections: 'collections',
  aging_receivables: 'aging_receivables',
  aging_payables: 'aging_payables',
  purchase: 'purchase',
  purchase_order: 'purchase_order',
  payments: 'payments',
  adjustments: 'adjustments',
  trial_balance: 'trial-balance',
  income_statement: 'income-statement',
  general_ledger: 'general-ledger',
  balance_sheet: 'balance-sheet',
  statement_of_comprehensive_income: 'statement-of-comprehensive-income',
  journal_entries: 'journal-entries',
  bank_reconciliation: 'bank-reconciliation',
  advances: 'advances',
  recurring_journals: 'recurring-journals',
  accounting_periods: 'accounting-periods',
  audit_trail: 'audit-trail',
}

export default function Header({ isCollapsed, onToggleSidebar }) {
  const navigate = useNavigate()
  const [showDropdown, setShowDropdown] = useState(false)
  const [user, setUser] = useState(null)
  const [canAccessCompany, setCanAccessCompany] = useState(false)
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [profile, setProfile] = useState({
    fullname: '',
    username: '',
    email: '',
    status: '',
    access_id: '',
    access_name: '',
  })
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileSaving, setProfileSaving] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const [profileError, setProfileError] = useState('')
  const [profileSuccess, setProfileSuccess] = useState('')
  const [showChangePasswordFields, setShowChangePasswordFields] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const dropdownRef = useRef(null)
  const bellRef = useRef(null)
  const [showBell, setShowBell] = useState(false)
  // Read from the shell's provider rather than calling the hook here, so the
  // header bell and the sidebar badge cannot hold different counts.
  const {
    items: notifications,
    unreadCount,
    loading: notificationsLoading,
    error: notificationsError,
    refresh: refreshNotifications,
    markRead,
    markAllRead,
  } = useNotificationsState()

  // Search states
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [showSearchResults, setShowSearchResults] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const [searchStartDate, setSearchStartDate] = useState('')
  const [searchEndDate, setSearchEndDate] = useState('')
  const [showSearchModal, setShowSearchModal] = useState(false)
  const searchRef = useRef(null)
  const [selectedIndex, setSelectedIndex] = useState(-1)

  // Remove unused company-related state since we removed the company selector

  useEffect(() => {
    const userData = sessionStorage.getItem('auth_user')
    if (userData) {
      const parsedUser = JSON.parse(userData)
      setUser(parsedUser)
      // Check if user has access to company management
      setCanAccessCompany(hasRouteAccess('company', parsedUser))
    }

    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target))
        setShowDropdown(false)
      if (bellRef.current && !bellRef.current.contains(e.target)) setShowBell(false)
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setShowSearchResults(false)
        setShowSearchModal(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Set default date range (empty to allow searching without date filters)
  useEffect(() => {
    setSearchStartDate('')
    setSearchEndDate('')
  }, [])

  // Reset selection when search modal closes or search query changes
  useEffect(() => {
    if (!showSearchModal) {
      setSelectedIndex(-1)
    }
  }, [showSearchModal])

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      
      return
    }

    const accessibleRoutes = getAccessibleRoutes(user).map((route) =>
      route.toLowerCase(),
    )
    const allowedRoutes = Object.keys(SEARCH_ROUTE_DOCUMENT_TYPE_MAP).filter(
      (route) => accessibleRoutes.includes(route),
    )

    // Always include adjustments in search regardless of route access
    if (!allowedRoutes.includes('adjustments')) {
      allowedRoutes.push('adjustments')
    }

    if (allowedRoutes.length === 0) {
      setSearchResults([])
      setShowSearchResults(true)
      return
    }

    setIsSearching(true)
    try {
      const token = sessionStorage.getItem('authenticated')
      const params = new URLSearchParams({
        search: searchQuery.trim(),
        allowedRoutes: allowedRoutes.join(','),
      })

      // Only include dates if they are set
      if (searchStartDate && searchEndDate) {
        params.append('startDate', searchStartDate)
        params.append('endDate', searchEndDate)
      }

      const response = await fetch(
        `${API.reportsSearch()}?${params}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      )

      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          setSearchResults(result.data)
          setShowSearchResults(true)
        }
      }
    } catch (error) {
      console.error('Search error:', error)
    } finally {
      setIsSearching(false)
    }
  }

  const handleSearchInputChange = (e) => {
    setSearchQuery(e.target.value)
    if (e.target.value.trim().length > 2) {
      setShowSearchModal(true)
    } else {
      setShowSearchModal(false)
      setShowSearchResults(false)
    }
  }

  const getPageMatches = (query) => {
    const term = query.trim().toLowerCase()
    if (term.length < 2 || !user) return []

    const matches = []

    // Use ROUTE_CONFIG to get all possible pages and filter by user access
    for (const [key, config] of Object.entries(ROUTE_CONFIG)) {
      if (!config || !config.name) continue

      // Check if user has access to this route
      if (!hasRouteAccess(config.name, user)) continue

      const itemName = config.name?.toLowerCase() || ''
      const itemLabel = config.label?.toLowerCase() || ''

      if (itemName.includes(term) || itemLabel.includes(term)) {
        // Use ROUTE_PATH_MAP to get the correct route path
        const routePath = ROUTE_PATH_MAP[config.name] || config.name.replace(/_/g, '-')
        // Ensure witholding_tax maps to withholding-tax
        const finalRoutePath = routePath === 'witholding-tax' ? 'withholding-tax' : routePath
        const label = config.label || config.name

        // Deduplicate by label to prevent duplicate entries
        if (!matches.some((match) => match.label === label)) {
          matches.push({
            type: 'page',
            route: `/${finalRoutePath}`,
            label: label,
            icon: config.icon,
          })
        }
      }
    }

    return matches
  }

  const handleSearchInputKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (searchQuery.trim().length > 0) {
        handleSearch()
      }
    }
  }

  const handleSearchSubmit = (e) => {
    e.preventDefault()
    if (searchQuery.trim().length > 0) {
      handleSearch()
    }
  }

  const handleSearchResultClick = (result) => {
    // Map document types to routes
    const routeMap = {
      Sales: 'sales',
      Collection: 'collections',
      Receipt: 'receipts',
      Purchase: 'purchase',
      'Cash Disbursement': 'disbursement',
      Payment: 'payments',
      'Journal Voucher': 'adjustments',
    }

    const route = routeMap[result.document_type]
    if (route) {
      const id = result.id ?? result.document_id
      if (!id) return

      // Navigate to the page with record id so it opens view mode and fetches data
      navigate(`/${route}?id=${encodeURIComponent(id)}`)
      setShowSearchModal(false)
      setShowSearchResults(false)
    }
  }

  const fetchProfile = async () => {
    setProfileLoading(true)
    setProfileError('')
    try {
      const token = sessionStorage.getItem('authenticated')
      const response = await fetch(
        API.userProfile(),
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      )

      if (!response.ok) {
        // If server lookup fails, fall back to local cached user so modal still shows
        const errorData = await response.json().catch(() => ({}))
        try {
          const fallback = JSON.parse(sessionStorage.getItem('auth_user') || '{}')
          if (fallback && Object.keys(fallback).length > 0) {
            setProfile((prev) => ({ ...prev, ...fallback }))
          }
        } catch (e) {
          // ignore JSON parse errors
        }

        throw new Error(errorData.message || 'Failed to fetch profile')
      }

      const result = await response.json()
      if (result.success) {
        setProfile((prev) => ({ ...prev, ...result.data }))
      } else {
        throw new Error(result.message || 'Failed to load profile')
      }
    } catch (error) {
      console.error('Profile fetch error:', error)
      setProfileError(error.message)
    } finally {
      setProfileLoading(false)
    }
  }

  const handleProfileOpen = () => {
    setShowDropdown(false)
    setShowProfileModal(true)

    const storedUser = JSON.parse(sessionStorage.getItem('auth_user') || '{}')
    if (storedUser && Object.keys(storedUser).length > 0) {
      setProfile(storedUser)
    }
    setShowChangePasswordFields(false)
    setCurrentPassword('')
    setNewPassword('')

    fetchProfile()
  }

  /**
   * Open the company record from the profile dropdown.
   *
   * The dropdown previously offered only My Profile and Log Out, so the company
   * record was reachable only through the sidebar's Masters group - which is
   * collapsed on smaller screens and easy to miss entirely.
   */
  const handleCompanyOpen = () => {
    setShowDropdown(false)
    navigate('/company')
  }

  const handleProfileChange = (e) => {
    const { name, value } = e.target
    setProfile((prev) => ({ ...prev, [name]: value }))
  }

  const handleProfileSubmit = async (e) => {
    e.preventDefault()
    setProfileSaving(true)
    setProfileError('')
    setProfileSuccess('')

    try {
      if (showChangePasswordFields) {
        if (!currentPassword.trim() || !newPassword.trim()) {
          setProfileError('Please enter both current password and new password.')
          setProfileSaving(false)
          return
        }
      }

      const token = sessionStorage.getItem('authenticated')
      const requestBody = {
        fullname: profile.fullname,
        username: profile.username,
        email: profile.email,
      }

      if (showChangePasswordFields) {
        requestBody.current_password = currentPassword
        requestBody.new_password = newPassword
      }

      const response = await fetch(
        API.userProfile(),
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(requestBody),
        },
      )

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || 'Failed to update profile')
      }

      const result = await response.json()
      if (result.success) {
        const currentUser = JSON.parse(sessionStorage.getItem('auth_user') || '{}')
        const updatedUser = {
          ...currentUser,
          fullname: result.data.fullname ?? profile.fullname ?? currentUser.fullname,
          username: result.data.username ?? profile.username ?? currentUser.username,
          email: result.data.email ?? profile.email ?? currentUser.email,
          token: result.data.token ?? currentUser.token,
        }

        if (result.data.token) {
          localStorage.setItem('token', result.data.token)
        }

        localStorage.setItem('user', JSON.stringify(updatedUser))
        setUser(updatedUser)
        setProfile((prev) => ({
          ...prev,
          fullname: updatedUser.fullname,
          username: updatedUser.username,
          email: updatedUser.email,
        }))
        setCurrentPassword('')
        setNewPassword('')
        setShowChangePasswordFields(false)
        setProfileSuccess('Profile updated successfully')
      } else {
        throw new Error(result.message || 'Unable to save profile')
      }
    } catch (error) {
      console.error('Profile update error:', error)
      setProfileError(error.message)
    } finally {
      setProfileSaving(false)
    }
  }

  const handleLogout = async () => {
    setLoggingOut(true)
    try {
      const token = sessionStorage.getItem('authenticated')
      const userData = sessionStorage.getItem('auth_user')
      const userId = userData ? JSON.parse(userData).id : null

      if (token) {
        // Logout from main server
        await fetch(API.credentialsLogout(), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ userId }),
        })

        // Logout from subscription server
        await fetch(SUBSCRIPTION_API.credentialsLogout(), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ userId }),
        })
      }
    } catch (error) {
      console.error('Logout API error:', error)
    }

    // Preserve remembered credentials before clearing
    const rememberedUser = localStorage.getItem('rememberedUser')
    const rememberedPassword = localStorage.getItem('rememberedPassword')

    // Clear all localStorage
    localStorage.clear()

    // Restore remembered credentials if they existed
    if (rememberedUser && rememberedPassword) {
      localStorage.setItem('rememberedUser', rememberedUser)
      localStorage.setItem('rememberedPassword', rememberedPassword)
    }

    window.location.href = '/'
  }

  return (
    <>
      {loggingOut && (
        <div className="fixed inset-0 z-[200] bg-white flex items-center justify-center">
          <LoadingScreen label="Logging Out..." />
        </div>
      )}
      <header className="h-16 bg-white border-b border-gray-200 flex items-center px-6 gap-4 shrink-0 shadow-sm z-30">
        <button
          className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
          onClick={onToggleSidebar}
        >
          <Menu size={20} />
        </button>

        <div className="flex-1 flex justify-center px-4">
          <div
            className="hidden md:flex items-center relative max-w-xl w-full"
            ref={searchRef}
          >
            <button
              type="button"
              onClick={() => searchQuery.trim().length > 0 && handleSearch()}
              className="bg-black border border-r-0 border-black rounded-l-xl px-3 h-9 flex items-center justify-center shrink-0 cursor-pointer"
            >
              <Search className="text-white" size={16} />
            </button>
            <input
              className="w-full pl-4 pr-4 h-9 bg-white border border-black rounded-r-xl text-sm focus:ring-2 focus:ring-black/10 focus:border-black outline-none transition-all placeholder-gray-400"
              placeholder="Search pages, ledgers, invoices..."
              type="text"
              value={searchQuery}
              onChange={(e) => {
                handleSearchInputChange(e);
                setSelectedIndex(-1);
              }}
              onKeyDown={(e) => {
                const pageMatches = searchQuery.trim().length >= 2 ? getPageMatches(searchQuery) : [];
                const docResults = showSearchResults ? searchResults : [];
                const totalItems = pageMatches.length + docResults.length;

                if (showSearchModal && totalItems > 0) {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setSelectedIndex((prev) => (prev < totalItems - 1 ? prev + 1 : 0));
                    return;
                  }
                  if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setSelectedIndex((prev) => (prev > 0 ? prev - 1 : totalItems - 1));
                    return;
                  }
                  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                    e.preventDefault();
                    setSelectedIndex((prev) => (prev < pageMatches.length ? pageMatches.length : 0));
                    return;
                  }
                  if (e.key === 'Enter') {
                    if (selectedIndex >= 0 && selectedIndex < totalItems) {
                      e.preventDefault();
                      if (selectedIndex < pageMatches.length) {
                        const match = pageMatches[selectedIndex];
                        navigate(match.route);
                        setShowSearchModal(false);
                        setSearchQuery('');
                      } else {
                        const docIndex = selectedIndex - pageMatches.length;
                        const result = docResults[docIndex];
                        handleSearchResultClick(result);
                      }
                      return;
                    }
                  }
                }
                handleSearchInputKeyDown(e);
              }}
              onFocus={() => {
                if (searchQuery.trim().length > 2) {
                  setShowSearchModal(true);
                  setSelectedIndex(-1);
                }
              }}
            />

            {/* Search Modal */}
            <AnimatePresence>
              {showSearchModal && (() => {
                const pageMatches = searchQuery.trim().length >= 2 ? getPageMatches(searchQuery) : [];
                const hasPageData = pageMatches.length > 0;
                const hasDocData = showSearchResults && searchResults.length > 0;

                const hidePages = showSearchResults && !hasPageData && hasDocData;
                const hideDocuments = hasPageData && showSearchResults && !hasDocData;

                return (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 6 }}
                    className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl p-5 z-50 w-full overflow-hidden"
                  >
                    <div className={`grid grid-cols-1 ${hidePages || hideDocuments ? 'grid-cols-1' : 'md:grid-cols-12'} gap-5`}>

                      {/* Column 1: Page Matches */}
                      {!hidePages && (
                        <div className={`${hideDocuments ? 'col-span-12 flex flex-col items-center text-center' : 'md:col-span-5 flex flex-col'}`}>
                          <div className={`flex items-center gap-1.5 mb-2.5 pb-1.5 border-b border-gray-100 ${hideDocuments ? 'w-full justify-center' : ''}`}>
                            <FileText size={13} className="text-red-600" />
                            <h4 className="text-xs font-bold text-gray-800 tracking-wide uppercase">Pages</h4>
                          </div>
                          {searchQuery.trim().length >= 2 ? (
                            <div className={`space-y-1.5 flex-1 ${hideDocuments ? 'w-full max-w-md mx-auto' : ''}`}>
                              {hasPageData ? (
                                pageMatches.map((match, index) => {
                                  const IconComponent = ICON_MAP[match.icon] || FileText;
                                  const isSelected = selectedIndex === index;
                                  return (
                                    <button
                                      key={index}
                                      type="button"
                                      onClick={() => {
                                        navigate(match.route);
                                        setShowSearchModal(false);
                                        setSearchQuery('');
                                      }}
                                      className={`w-full flex items-center ${hideDocuments ? 'justify-center' : ''} gap-2.5 px-3 py-2.5 text-left rounded-xl transition-all group cursor-pointer ${isSelected ? 'bg-red-100 border-red-300' : 'bg-gray-50/50 hover:bg-red-50/80 hover:border-red-200 border border-transparent'
                                        }`}
                                    >
                                      <IconComponent size={14} className="text-red-600 shrink-0 group-hover:text-red-700" />
                                      <span className="text-xs font-medium text-gray-700 group-hover:text-red-900 truncate">{match.label}</span>
                                    </button>
                                  );
                                })
                              ) : (
                                <p className="text-xs text-gray-400 text-center py-4 bg-gray-50/50 rounded-xl">No matching pages</p>
                              )}
                            </div>
                          ) : (
                            <p className="text-xs text-gray-400 italic py-4 text-center bg-gray-50/50 rounded-xl w-full">Type at least 2 characters...</p>
                          )}
                        </div>
                      )}

                      {/* Column 2: Document Search */}
                      {!hideDocuments && (
                        <div className={`${hidePages ? 'col-span-12' : 'md:col-span-7 border-t md:border-t-0 md:border-l border-gray-100 pt-4 md:pt-0 md:pl-5'} flex flex-col`}>
                          <div className="flex items-center justify-between mb-2.5 pb-1.5 border-b border-gray-100">
                            <div className="flex items-center gap-1.5">
                              <Search size={13} className="text-red-600" />
                              <h4 className="text-xs font-bold text-gray-800 tracking-wide uppercase">Documents</h4>
                            </div>
                            {showSearchResults && (
                              <button
                                type="button"
                                onClick={() => setShowSearchModal(false)}
                                className="p-1 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                              >
                                <X size={14} className="text-gray-400" />
                              </button>
                            )}
                          </div>

                          <form onSubmit={handleSearchSubmit} className="space-y-3 flex-1 flex flex-col">
                            <div>
                              <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                                Date Range
                              </label>
                              <div className="flex gap-2">
                                <div className="flex-1">
                                  <input
                                    type="date"
                                    value={searchStartDate}
                                    onChange={(e) => setSearchStartDate(e.target.value)}
                                    className="w-full px-2.5 py-1.5 bg-gray-50/50 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-red-600/10 focus:border-red-600 outline-none transition-all"
                                  />
                                </div>
                                <div className="flex-1">
                                  <input
                                    type="date"
                                    value={searchEndDate}
                                    onChange={(e) => setSearchEndDate(e.target.value)}
                                    className="w-full px-2.5 py-1.5 bg-gray-50/50 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-red-600/10 focus:border-red-600 outline-none transition-all"
                                  />
                                </div>
                              </div>
                            </div>

                            <button
                              type="submit"
                              disabled={isSearching || !searchQuery.trim()}
                              className="w-full bg-red-600 text-white py-2 px-4 rounded-xl text-xs font-semibold hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 shadow-sm shadow-red-600/20 cursor-pointer"
                            >
                              {isSearching ? (
                                <>
                                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                  Searching...
                                </>
                              ) : (
                                <>
                                  <Search size={14} />
                                  Search Documents
                                </>
                              )}
                            </button>

                            {showSearchResults && (
                              <div className="mt-2 border-t border-gray-100 pt-3 flex-1">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-[11px] font-bold text-gray-700 uppercase tracking-wide">
                                    Results ({searchResults.length})
                                  </span>
                                </div>
                                <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                                  {searchResults.length > 0 ? (
                                    searchResults.map((result, index) => {
                                      const globalIndex = pageMatches.length + index;
                                      const isSelected = selectedIndex === globalIndex;
                                      return (
                                        <div
                                          key={index}
                                          ref={(el) => {
                                            if (isSelected && el) {
                                              el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                                            }
                                          }}
                                          className={`p-2.5 rounded-xl transition-all cursor-pointer group ${isSelected ? 'bg-red-100 border-red-300' : 'bg-gray-50/80 hover:bg-red-50/50 hover:border-red-200 border border-transparent'
                                            }`}
                                          onClick={() => handleSearchResultClick(result)}
                                        >
                                          <div className="flex items-start gap-2.5">
                                            <FileText
                                              size={14}
                                              className="text-red-600 mt-0.5 shrink-0 group-hover:text-red-700"
                                            />
                                            <div className="flex-1 min-w-0">
                                              <div className="flex items-center justify-between mb-0.5">
                                                <span className="text-[11px] font-semibold text-gray-900 truncate group-hover:text-red-900">
                                                  {result.document_type}
                                                </span>
                                                <span className="text-[10px] text-gray-500 shrink-0">
                                                  {result.document_date}
                                                </span>
                                              </div>
                                              <div className="flex items-center justify-between gap-2">
                                                <div className="flex-1 min-w-0">
                                                  <p className="text-[11px] text-gray-700 font-medium truncate">
                                                    {result.id}
                                                  </p>
                                                  <p className="text-[10px] text-gray-500 truncate">
                                                    {result.customer_name || result.vendor_name}
                                                  </p>
                                                </div>
                                                <div className="text-right shrink-0">
                                                  {result.amount && (
                                                    <p className="text-[11px] font-bold text-red-600">
                                                      ₱
                                                      {parseFloat(result.amount).toLocaleString(
                                                        'en-PH',
                                                        { minimumFractionDigits: 2 },
                                                      )}
                                                    </p>
                                                  )}
                                                </div>
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    })
                                  ) : (
                                    <p className="text-xs text-gray-500 text-center py-4 bg-gray-50/50 rounded-xl">
                                      No results found
                                    </p>
                                  )}
                                </div>
                              </div>
                            )}
                          </form>
                        </div>
                      )}

                    </div>
                  </motion.div>
                );
              })()}
            </AnimatePresence>
          </div>
        </div>

        <div className="flex items-center gap-3 ml-auto">
          <div className="relative" ref={bellRef}>
            <button
              onClick={() => setShowBell((open) => !open)}
              aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`}
              className={`p-2 rounded-full transition-colors relative ${showBell ? 'bg-gray-100 text-gray-800 cursor-pointer ' : 'cursor-pointer hover:bg-gray-100 text-gray-500'
                }`}
            >
              <Bell size={20} />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[10px] font-black flex items-center justify-center border-2 border-white tabular-nums">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>

            {showBell && (
              <div className="fixed inset-x-4 top-20 sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-3 sm:w-[380px] bg-white rounded-2xl shadow-[0_20px_50px_rgba(8,112,184,0.15)] ring-1 ring-slate-900/10 overflow-hidden z-50">
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
                  <span className="text-[11px] font-black uppercase tracking-[2px] text-slate-700">
                    Notifications
                  </span>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={refreshNotifications}
                      className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-700 transition-colors"
                    >
                      Refresh
                    </button>
                  </div>
                </div>

                <div className="max-h-[420px] overflow-y-auto custom-scrollbar">
                  <NotificationList
                    compact
                    items={notifications.slice(0, 12)}
                    unreadCount={unreadCount}
                    loading={notificationsLoading}
                    error={notificationsError}
                    onRefresh={refreshNotifications}
                    onMarkRead={markRead}
                    onMarkAllRead={markAllRead}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="h-8 w-px bg-gray-200 mx-1"></div>

          <div className="relative" ref={dropdownRef}>
            <button
              className="flex items-center gap-3 p-1 rounded-full hover:bg-gray-50 transition-all"
              onClick={() => setShowDropdown(!showDropdown)}
            >
              <div className="w-10 h-10 rounded-2xl bg-black flex items-center justify-center text-white text-sm font-semibold shadow-lg shadow-black/10 border-b-2 border-red-600">
                {user?.fullname?.charAt(0)?.toUpperCase() ||
                  user?.username?.charAt(0)?.toUpperCase() ||
                  'A'}
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-xs font-bold text-gray-900 leading-none">
                  {user?.fullname || user?.username || 'User'}
                </p>
              </div>
              <ChevronDown
                size={14}
                className={`text-gray-400 transition-transform ${showDropdown ? 'rotate-180' : ''}`}
              />
            </button>

            <AnimatePresence>
              {showDropdown && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute right-0 mt-3 w-56 bg-white rounded-xl shadow-2xl border border-gray-100 py-2 z-50 overflow-hidden"
                >
                  <button
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                    onClick={handleProfileOpen}
                  >
                    <User size={16} className="text-gray-400" /> My Profile
                  </button>
                  {/* Only shown when the tenant actually grants company access,
                      so the entry cannot lead to a redirect for a user who has
                      never been given the route. canAccessCompany is derived once
                      when the user loads, rather than recomputed per render. */}
                  {canAccessCompany && (
                    <button
                      className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                      onClick={handleCompanyOpen}
                    >
                      <Building2 size={16} className="text-gray-400" /> Company
                    </button>
                  )}
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

      <RightSideModal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        title="My Profile"
      >
        <div className="space-y-6 pb-2">
          {profileError ? (
            <div className="rounded-2xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">
              {profileError}
            </div>
          ) : null}

          {profileSuccess ? (
            <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 text-sm text-emerald-700">
              {profileSuccess}
            </div>
          ) : null}

          <form onSubmit={handleProfileSubmit} className="space-y-6">
            {/* Account Information Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
                <User size={16} className="text-red-600" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-600">
                  Account Information
                </h3>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-gray-600">
                  Username
                </label>
                <input
                  name="username"
                  type="text"
                  value={profile.username || ''}
                  onChange={handleProfileChange}
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-800 outline-none transition focus:border-red-600 focus:ring-2 focus:ring-red-600/10 hover:border-gray-300"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-gray-600">
                  Full Name
                </label>
                <input
                  name="fullname"
                  type="text"
                  value={profile.fullname || ''}
                  onChange={handleProfileChange}
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-800 outline-none transition focus:border-red-600 focus:ring-2 focus:ring-red-600/10 hover:border-gray-300"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-gray-600">
                  Email
                </label>
                <input
                  name="email"
                  type="email"
                  value={profile.email || ''}
                  onChange={handleProfileChange}
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-800 outline-none transition focus:border-red-600 focus:ring-2 focus:ring-red-600/10 hover:border-gray-300"
                  placeholder="Email (optional)"
                />
              </div>
            </div>

            {/* Security Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
                <Shield size={16} className="text-red-600" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-600">Security</h3>
              </div>

              {!showChangePasswordFields ? (
                <button
                  type="button"
                  onClick={() => setShowChangePasswordFields(true)}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm"
                >
                  Change Password
                </button>
              ) : (
                <div className="space-y-3.5 p-4 rounded-2xl bg-gray-50/95 border border-gray-200/80 shadow-inner">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-gray-600">
                      Current Password
                    </label>
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-800 outline-none transition focus:border-red-600 focus:ring-2 focus:ring-red-600/10"
                      placeholder="Enter current password"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-gray-600">
                      New Password
                    </label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-800 outline-none transition focus:border-red-600 focus:ring-2 focus:ring-red-600/10"
                      placeholder="Enter new password"
                      required
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowChangePasswordFields(false)
                      setCurrentPassword('')
                      setNewPassword('')
                    }}
                    className="w-full mt-1 inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 transition-colors shadow-sm"
                  >
                    Cancel Password Change
                  </button>
                </div>
              )}
            </div>

            {/* System Information Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
                <Shield size={16} className="text-red-600" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-600">
                  System Information
                </h3>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-gray-600">
                    Role
                  </label>
                  <input
                    type="text"
                    value={profile.access_name || ''}
                    readOnly
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-600 outline-none cursor-not-allowed font-medium"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-gray-600">
                    Status
                  </label>
                  <input
                    type="text"
                    value={profile.status || ''}
                    readOnly
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-600 outline-none cursor-not-allowed font-medium capitalize"
                  />
                </div>
              </div>
            </div>

            {/* Full-width Footer Actions with Equal Split */}
            <div className="grid grid-cols-2 gap-3 pt-5 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setShowProfileModal(false)}
                className="w-full inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-all shadow-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={profileSaving}
                className="w-full inline-flex items-center justify-center rounded-xl bg-red-600 py-3 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed transition-all shadow-sm shadow-red-600/20"
              >
                {profileSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </RightSideModal>
    </>
  )
}
