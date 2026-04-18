// Route protection utility for checking user access

/**
 * Check if user has access to a specific route (Full Access, Check Access, or Approve Access)
 * @param {string} routeName - The route name to check
 * @param {Object} user - User object with route_access array
 * @returns {boolean} - Whether user has access
 */
export const hasRouteAccess = (routeName, user) => {
  if (!user || !user.route_access || !routeName || typeof routeName !== 'string') {
    return false;
  }

  return user.route_access.some(route => {
    if (!route || typeof route !== 'object') {
      console.warn('Invalid route object:', route);
      return false;
    }
    if (!route.name || typeof route.name !== 'string') {
      console.warn('Invalid route.name:', route.name);
      return false;
    }
    return route.name === routeName && 
      (route.status === 'Full Access' || route.status === 'Check Access' || route.status === 'Approve Access');
  });
};

/**
 * Check if user has full access to a specific route (can create/edit)
 * @param {string} routeName - The route name to check
 * @param {Object} user - User object with route_access array
 * @returns {boolean} - Whether user has full access
 */
export const hasFullAccess = (routeName, user) => {
  if (!user || !user.route_access || !routeName || typeof routeName !== 'string') {
    return false;
  }

  return user.route_access.some(route => {
    if (!route || typeof route !== 'object') {
      console.warn('Invalid route object:', route);
      return false;
    }
    if (!route.name || typeof route.name !== 'string') {
      console.warn('Invalid route.name:', route.name);
      return false;
    }
    return route.name.toLowerCase() === routeName.toLowerCase() && route.status === 'Full Access';
  });
};

/**
 * Check if user has check access to a specific route (can only view)
 * @param {string} routeName - The route name to check
 * @param {Object} user - User object with route_access array
 * @returns {boolean} - Whether user has check access
 */
export const hasCheckAccess = (routeName, user) => {
  if (!user || !user.route_access || !routeName || typeof routeName !== 'string') {
    return false;
  }

  return user.route_access.some(route => {
    if (!route || typeof route !== 'object') {
      console.warn('Invalid route object:', route);
      return false;
    }
    if (!route.name || typeof route.name !== 'string') {
      console.warn('Invalid route.name:', route.name);
      return false;
    }
    return route.name.toLowerCase() === routeName.toLowerCase() && route.status === 'Check Access';
  });
};

/**
 * Check if user has approve access to a specific route (can only view and approve)
 * @param {string} routeName - The route name to check
 * @param {Object} user - User object with route_access array
 * @returns {boolean} - Whether user has approve access
 */
export const hasApproveAccess = (routeName, user) => {
  if (!user || !user.route_access || !routeName || typeof routeName !== 'string') {
    return false;
  }

  return user.route_access.some(route => {
    if (!route || typeof route !== 'object') {
      console.warn('Invalid route object:', route);
      return false;
    }
    if (!route.name || typeof route.name !== 'string') {
      console.warn('Invalid route.name:', route.name);
      return false;
    }
    return route.name.toLowerCase() === routeName.toLowerCase() && route.status === 'Approve Access';
  });
};

/**
 * Check if user can create/edit on a specific route
 * @param {string} routeName - The route name to check
 * @param {Object} user - User object with route_access array
 * @returns {boolean} - Whether user can create/edit
 */
export const canCreateEdit = (routeName, user) => {
  return hasFullAccess(routeName, user);
};

/**
 * Get user's access level for a specific route
 * @param {string} routeName - The route name to check
 * @param {Object} user - User object with route_access array
 * @returns {string|null} - Access level: 'Full Access', 'Check Access', 'Approve Access', or null
 */
export const getAccessLevel = (routeName, user) => {
  if (!user || !user.route_access || !routeName || typeof routeName !== 'string') {
    return null;
  }

  const route = user.route_access.find(route => 
    route && route.name && typeof route.name === 'string' && route.name.toLowerCase() === routeName.toLowerCase()
  );
  return route ? route.status : null;
};

/**
 * Get all accessible routes for a user
 * @param {Object} user - User object with route_access array
 * @returns {Array} - Array of accessible route names
 */
export const getAccessibleRoutes = (user) => {
  if (!user || !user.route_access) {
    return [];
  }

  return user.route_access
    .filter(route => route && route.name && route.status && (route.status === 'Full Access' || route.status === 'Check Access' || route.status === 'Approve Access'))
    .map(route => route.name);
};

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
  proforma_entries: { name: 'proforma_entries', label: 'Proforma Entries', icon: 'FileText' },
  product_service: { name: 'product_service', label: 'Product & Service', icon: 'Package' },
  company: { name: 'company', label: 'Company Management', icon: 'Building' },
  vat: { name: 'vat', label: 'VAT Management', icon: 'Percent' },
  witholding_tax: { name: 'witholding_tax', label: 'Withholding Tax', icon: 'Receipt' },
  receipts: { name: 'receipts', label: 'Receipts', icon: 'CreditCard' },
  disbursement: { name: 'disbursement', label: 'Disbursements', icon: 'DollarSign' },
  sales: { name: 'sales', label: 'Sales', icon: 'TrendingUp' },
  collections: { name: 'collections', label: 'Collections', icon: 'HandCoins' },
  purchase: { name: 'purchase', label: 'Purchase', icon: 'ShoppingCart' },
  payments: { name: 'payments', label: 'Payments', icon: 'PaymentCard' },
  adjustments: { name: 'adjustments', label: 'Adjustments', icon: 'FileSpreadsheet' },
  trial_balance: { name: 'trial_balance', label: 'Trial Balance', icon: 'Scale' },
  income_statement: { name: 'income_statement', label: 'Income Statement', icon: 'FileText' },
  general_ledger: { name: 'general_ledger', label: 'General Ledger', icon: 'BookOpen' },
  balance_sheet: { name: 'balance_sheet', label: 'Balance Sheet', icon: 'PieChart' }
};

/**
 * Get sidebar items based on user access
 * @param {Object} user - User object with route_access array
 * @returns {Object} - Grouped sidebar items
 */
export const getSidebarItems = (user) => {
  const accessibleRoutes = getAccessibleRoutes(user);
  
  const items = {
    main: [],
    masters: [],
    receipts: [],
    sales: [],
    purchase: [],
    adjustments: [],
    reports: []
  };

  // Main navigation
  if (hasRouteAccess('dashboard', user)) {
    items.main.push(ROUTE_CONFIG.dashboard);
  }

  // Masters section
  const masterRoutes = ['access', 'users', 'customers', 'vendors', 'charts', 'proforma_entries', 'product_service', 'company', 'vat', 'witholding_tax'];
  masterRoutes.forEach(route => {
    if (hasRouteAccess(route, user)) {
      items.masters.push(ROUTE_CONFIG[route]);
    }
  });

  // Receipts & Disbursements section
  const receiptRoutes = ['receipts', 'disbursement'];
  receiptRoutes.forEach(route => {
    if (hasRouteAccess(route, user)) {
      items.receipts.push(ROUTE_CONFIG[route]);
    }
  });

  // Sales & Collections section
  const salesRoutes = ['sales', 'collections'];
  salesRoutes.forEach(route => {
    if (hasRouteAccess(route, user)) {
      items.sales.push(ROUTE_CONFIG[route]);
    }
  });

  // Purchase & Payments section
  const purchaseRoutes = ['purchase', 'payments'];
  purchaseRoutes.forEach(route => {
    if (hasRouteAccess(route, user)) {
      items.purchase.push(ROUTE_CONFIG[route]);
    }
  });

  // Adjustments section
  if (hasRouteAccess('adjustments', user)) {
    items.adjustments.push(ROUTE_CONFIG.adjustments);
  }

  // Reports section
  const reportRoutes = ['trial_balance', 'income_statement', 'general_ledger', 'balance_sheet'];
  reportRoutes.forEach(route => {
    if (hasRouteAccess(route, user)) {
      items.reports.push(ROUTE_CONFIG[route]);
    }
  });

  return items;
};
