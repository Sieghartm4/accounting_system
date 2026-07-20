// Route protection utility for checking user access

const normalizeText = (value) => {
  if (typeof value === 'string') {
    return value.toLowerCase().trim()
  }
  if (value && typeof value === 'object') {
    if (typeof value.status === 'string') {
      return value.status.toLowerCase().trim()
    }
    if (typeof value.value === 'string') {
      return value.value.toLowerCase().trim()
    }
    return JSON.stringify(value).toLowerCase().trim()
  }
  return ''
}

const normalizeAccessStatus = (status) => {
  const normalized = normalizeText(status)
  if (normalized === 'add') return 'add access'
  return normalized
}

const titleCaseStatus = (status) => {
  const normalized = normalizeAccessStatus(status)
  if (!normalized) return null
  return normalized
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

/**
 * Check if user has access to a specific route (Full Access, Edit Access, View Access, Check Access, Approve Access, or Add Access)
 * @param {string} routeName - The route name to check
 * @param {Object} user - User object with route_access array
 * @returns {boolean} - Whether user has access
 */
export const hasRouteAccess = (routeName, user) => {
  if (Array.isArray(routeName)) {
    return routeName.some((name) => hasRouteAccess(name, user))
  }

  if (!user || !user.route_access || !routeName || typeof routeName !== 'string') {
    return false
  }

  const normalizedRouteName = routeName.toLowerCase().trim()
  const truthyStatuses = new Set([
    'full access',
    'edit access',
    'view access',
    'check access',
    'approve access',
    'add access',
  ])

  return user.route_access.some((route) => {
    if (!route || typeof route !== 'object') {
      console.warn('Invalid route object:', route)
      return false
    }
    if (!route.name || typeof route.name !== 'string') {
      console.warn('Invalid route.name:', route.name)
      return false
    }
    const status =
      route.status && typeof route.status === 'string'
        ? route.status.toLowerCase().trim()
        : ''
    return (
      route.name.toLowerCase().trim() === normalizedRouteName &&
      truthyStatuses.has(status)
    )
  })
}

/**
 * Normalize an access status value from the DB or UI.
 * Accepts string status values and JSON/string-wrapped values.
 */
const normalizeStatus = (status) => {
  if (!status) {
    return ''
  }

  if (typeof status === 'string') {
    const normalized = status.toLowerCase().trim()
    if (normalized === 'add') return 'add access'
    return normalized
  }

  if (typeof status === 'object') {
    if (typeof status.status === 'string') {
      return normalizeStatus(status.status)
    }
    if (typeof status.value === 'string') {
      return normalizeStatus(status.value)
    }
    try {
      const value = JSON.stringify(status)
      return normalizeStatus(value)
    } catch (error) {
      return ''
    }
  }

  return ''
}

const normalizeRouteName = (routeName) => {
  if (!routeName || typeof routeName !== 'string') {
    return ''
  }

  return routeName.toLowerCase().trim()
}

const hasRouteStatus = (route, expectedStatus) => {
  if (!route || typeof route !== 'object') {
    return false
  }
  const status = normalizeStatus(route.status)
  return status === expectedStatus
}

/**
 * Check if user has full access to a specific route (can create/edit)
 * @param {string} routeName - The route name to check
 * @param {Object} user - User object with route_access array
 * @returns {boolean} - Whether user has full access
 */
export const hasFullAccess = (routeName, user) => {
  if (!user || !user.route_access || !routeName || typeof routeName !== 'string') {
    return false
  }

  const normalizedRouteName = normalizeRouteName(routeName)
  return user.route_access.some((route) => {
    if (!route || typeof route !== 'object') {
      console.warn('Invalid route object:', route)
      return false
    }
    if (!route.name || typeof route.name !== 'string') {
      console.warn('Invalid route.name:', route.name)
      return false
    }
    return (
      normalizeRouteName(route.name) === normalizedRouteName &&
      hasRouteStatus(route, 'full access')
    )
  })
}

/**
 * Check if user has check access to a specific route (can only view)
 * @param {string} routeName - The route name to check
 * @param {Object} user - User object with route_access array
 * @returns {boolean} - Whether user has check access
 */
export const hasCheckAccess = (routeName, user) => {
  if (!user || !user.route_access || !routeName || typeof routeName !== 'string') {
    return false
  }

  const normalizedRouteName = normalizeRouteName(routeName)
  return user.route_access.some((route) => {
    if (!route || typeof route !== 'object') {
      console.warn('Invalid route object:', route)
      return false
    }
    if (!route.name || typeof route.name !== 'string') {
      console.warn('Invalid route.name:', route.name)
      return false
    }
    return (
      normalizeRouteName(route.name) === normalizedRouteName &&
      hasRouteStatus(route, 'check access')
    )
  })
}

/**
 * Check if user has approve access to a specific route (can only view and approve)
 * @param {string} routeName - The route name to check
 * @param {Object} user - User object with route_access array
 * @returns {boolean} - Whether user has approve access
 */
export const hasApproveAccess = (routeName, user) => {
  if (!user || !user.route_access || !routeName || typeof routeName !== 'string') {
    return false
  }

  const normalizedRouteName = normalizeRouteName(routeName)
  return user.route_access.some((route) => {
    if (!route || typeof route !== 'object') {
      console.warn('Invalid route object:', route)
      return false
    }
    if (!route.name || typeof route.name !== 'string') {
      console.warn('Invalid route.name:', route.name)
      return false
    }
    return (
      normalizeRouteName(route.name) === normalizedRouteName &&
      hasRouteStatus(route, 'approve access')
    )
  })
}

/**
 * Check if user has edit access to a specific route (can view and edit)
 * @param {string} routeName - The route name to check
 * @param {Object} user - User object with route_access array
 * @returns {boolean} - Whether user has edit access
 */
export const hasEditAccess = (routeName, user) => {
  if (!user || !user.route_access || !routeName || typeof routeName !== 'string') {
    return false
  }

  const normalizedRouteName = normalizeRouteName(routeName)
  return user.route_access.some((route) => {
    if (!route || typeof route !== 'object') {
      console.warn('Invalid route object:', route)
      return false
    }
    if (!route.name || typeof route.name !== 'string') {
      console.warn('Invalid route.name:', route.name)
      return false
    }
    return (
      normalizeRouteName(route.name) === normalizedRouteName &&
      hasRouteStatus(route, 'edit access')
    )
  })
}

/**
 * Check if user has add-only access to a specific route (can create only)
 */
export const hasAddAccess = (routeName, user) => {
  if (!user || !user.route_access || !routeName || typeof routeName !== 'string') {
    return false
  }

  const normalizedRouteName = normalizeRouteName(routeName)
  return user.route_access.some((route) => {
    if (!route || typeof route !== 'object') {
      console.warn('Invalid route object:', route)
      return false
    }
    if (!route.name || typeof route.name !== 'string') {
      console.warn('Invalid route.name:', route.name)
      return false
    }
    return (
      normalizeRouteName(route.name) === normalizedRouteName &&
      hasRouteStatus(route, 'add access')
    )
  })
}

/**
 * Check if user has view access to a specific route (can only view)
 * @param {string} routeName - The route name to check
 * @param {Object} user - User object with route_access array
 * @returns {boolean} - Whether user has view access
 */
export const hasViewAccess = (routeName, user) => {
  if (!user || !user.route_access || !routeName || typeof routeName !== 'string') {
    return false
  }

  const normalizedRouteName = normalizeRouteName(routeName)
  return user.route_access.some((route) => {
    if (!route || typeof route !== 'object') {
      console.warn('Invalid route object:', route)
      return false
    }
    if (!route.name || typeof route.name !== 'string') {
      console.warn('Invalid route.name:', route.name)
      return false
    }
    return (
      normalizeRouteName(route.name) === normalizedRouteName &&
      hasRouteStatus(route, 'view access')
    )
  })
}

/**
 * Check if user can create/edit on a specific route
 * @param {string} routeName - The route name to check
 * @param {Object} user - User object with route_access array
 * @returns {boolean} - Whether user can create/edit
 */
export const canCreateEdit = (routeName, user) => {
  // Allow create when user has Full, Edit, or Add access. Edit requires Edit or Full.
  return (
    hasFullAccess(routeName, user) ||
    hasEditAccess(routeName, user) ||
    hasAddAccess(routeName, user)
  )
}

/**
 * Get user's access level for a specific route
 * @param {string} routeName - The route name to check
 * @param {Object} user - User object with route_access array
 * @returns {string|null} - Access level: 'Full Access', 'Check Access', 'Approve Access', or null
 */
export const getAccessLevel = (routeName, user) => {
  if (!user || !user.route_access || !routeName || typeof routeName !== 'string') {
    return null
  }

  const normalizedRouteName = normalizeRouteName(routeName)
  const route = user.route_access.find(
    (route) =>
      route &&
      route.name &&
      typeof route.name === 'string' &&
      normalizeRouteName(route.name) === normalizedRouteName,
  )
  return route ? titleCaseStatus(route.status) : null
}

/**
 * Get all accessible routes for a user
 * @param {Object} user - User object with route_access array
 * @returns {Array} - Array of accessible route names
 */
export const getAccessibleRoutes = (user) => {
  if (!user || !user.route_access) {
    return []
  }

  return user.route_access
    .filter(
      (route) =>
        route &&
        route.name &&
        normalizeStatus(route.status) &&
        [
          'full access',
          'edit access',
          'view access',
          'check access',
          'approve access',
          'add access',
        ].includes(normalizeStatus(route.status)),
    )
    .map((route) => route.name)
}

/**
 * Route configuration mapping
 */
export const ROUTE_CONFIG = {
  dashboard: { name: 'dashboard', label: 'Dashboard', icon: 'LayoutDashboard' },
  access: { name: 'access', label: 'Access Control', icon: 'ShieldCheck' },
  users: { name: 'users', label: 'User Management', icon: 'Users' },
  customers: { name: 'customers', label: 'Customer Management', icon: 'Users' },
  vendors: { name: 'vendors', label: 'Vendor Management', icon: 'Warehouse' },
  charts: { name: 'charts', label: 'Charts of Accounts', icon: 'BarChart' },
  proforma_entries: {
    name: 'proforma_entries',
    label: 'Proforma Entries',
    icon: 'FileText',
  },
  product_service: {
    name: 'product_service',
    label: 'Product & Service',
    icon: 'Package',
  },
  company: { name: 'company', label: 'Company Management', icon: 'Building' },
  vat: { name: 'vat', label: 'VAT Management', icon: 'Percent' },
  responsibility_center: {
    name: 'responsibility_center',
    label: 'Responsibility Center',
    icon: 'MapPin',
  },
  witholding_tax: {
    name: 'witholding_tax',
    label: 'Withholding Tax',
    icon: 'Receipt',
  },
  customer_transactions: {
    name: 'customer_transactions',
    label: 'Customer Transactions',
    icon: 'FileText',
  },
  vendor_transactions: {
    name: 'vendor_transactions',
    label: 'Vendor Transactions',
    icon: 'FileText',
  },
  receipts: { name: 'receipts', label: 'Receipts', icon: 'CreditCard' },
  disbursement: { name: 'disbursement', label: 'Disbursements', icon: 'DollarSign' },
  sales: { name: 'sales', label: 'Sales', icon: 'TrendingUp' },
  collections: { name: 'collections', label: 'Collections', icon: 'HandCoins' },
  aging_receivables: {
    name: 'aging_receivables',
    label: 'Aging Receivables',
    icon: 'Clock3',
  },
  purchase: { name: 'purchase', label: 'Purchase', icon: 'ShoppingCart' },
  payments: { name: 'payments', label: 'Payments', icon: 'PaymentCard' },
  adjustments: {
    name: 'adjustments',
    label: 'Adjustments',
    icon: 'FileSpreadsheet',
  },
  trial_balance: { name: 'trial_balance', label: 'Trial Balance', icon: 'Scale' },
  income_statement: {
    name: 'income_statement',
    label: 'Income Statement',
    icon: 'FileText',
  },
  general_ledger: {
    name: 'general_ledger',
    label: 'General Ledger',
    icon: 'BookOpen',
  },
  balance_sheet: { name: 'balance_sheet', label: 'Balance Sheet', icon: 'PieChart' },
  statement_of_comprehensive_income: {
    name: 'statement_of_comprehensive_income',
    label: 'Comprehensive Income',
    icon: 'BarChart3',
  },
  journal_entries: {
    name: 'journal_entries',
    label: 'Journal Entries',
    icon: 'FileText',
  },
  bank_reconciliation: {
    name: 'bank_reconciliation',
    label: 'Bank Reconciliation',
    icon: 'Landmark',
  },
  advances: {
    name: 'advances',
    label: 'Advances',
    icon: 'ArrowRight',
  },
  audit_trail: {
    name: 'audit_trail',
    label: 'Audit Trail',
    icon: 'History',
  },
}

/**
 * Get sidebar items based on user access
 * @param {Object} user - User object with route_access array
 * @returns {Object} - Grouped sidebar items
 */
export const getSidebarItems = (user) => {
  const accessibleRoutes = getAccessibleRoutes(user)

  const items = {
    main: [],
    masters: [],
    partners: [],
    receipts: [],
    sales: [],
    purchase: [],
    adjustments: [],
    reports: [],
    settings: [],
  }

  // Main navigation
  if (hasRouteAccess('dashboard', user)) {
    items.main.push(ROUTE_CONFIG.dashboard)
  }

  // Masters section
  const masterRoutes = [
    'access',
    'users',
    'charts',
    'proforma_entries',
    'product_service',
    'company',
    'vat',
    'responsibility_center',
    'witholding_tax',
  ]

  const partnerRoutes = [
    'customers',
    'customer_transactions',
    'vendors',
    'vendor_transactions',
  ]
  masterRoutes.forEach((route) => {
    if (hasRouteAccess(route, user)) {
      items.masters.push(ROUTE_CONFIG[route])
    }
  })

  // Receipts & Disbursements section
  const receiptRoutes = ['receipts', 'disbursement']
  receiptRoutes.forEach((route) => {
    if (hasRouteAccess(route, user)) {
      items.receipts.push(ROUTE_CONFIG[route])
    }
  })

  // Sales & Collections section
  const salesRoutes = ['sales', 'collections', 'aging_receivables']
  salesRoutes.forEach((route) => {
    if (hasRouteAccess(route, user)) {
      items.sales.push(ROUTE_CONFIG[route])
    }
  })

  // Purchase & Payments section
  const purchaseRoutes = ['purchase', 'payments']
  purchaseRoutes.forEach((route) => {
    if (hasRouteAccess(route, user)) {
      items.purchase.push(ROUTE_CONFIG[route])
    }
  })

  // Partner section for customers and vendors
  partnerRoutes.forEach((route) => {
    const hasAccess =
      route === 'customer_transactions'
        ? hasRouteAccess('customers', user)
        : route === 'vendor_transactions'
          ? hasRouteAccess('vendors', user)
          : hasRouteAccess(route, user)

    if (hasAccess) {
      items.partners.push(ROUTE_CONFIG[route])
    }
  })

  // Adjustments section
  const adjustmentRoutes = ['adjustments', 'bank_reconciliation', 'advances']
  adjustmentRoutes.forEach((route) => {
    const hasAccess =
      route === 'advances'
        ? hasRouteAccess('adjustments', user) || hasRouteAccess('advances', user)
        : hasRouteAccess(route, user)

    if (hasAccess) {
      items.adjustments.push(ROUTE_CONFIG[route])
    }
  })

  // Reports section
  const reportRoutes = [
    'trial_balance',
    'income_statement',
    'general_ledger',
    'balance_sheet',
    'statement_of_comprehensive_income',
    'journal_entries',
  ]
  reportRoutes.forEach((route) => {
    if (hasRouteAccess(route, user)) {
      items.reports.push(ROUTE_CONFIG[route])
    }
  })

  // Settings section
  const settingRoutes = ['audit_trail']
  settingRoutes.forEach((route) => {
    if (hasRouteAccess(route, user)) {
      items.settings.push(ROUTE_CONFIG[route])
    }
  })

  return items
}
