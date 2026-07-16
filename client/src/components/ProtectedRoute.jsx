import React from 'react';
import { Navigate } from 'react-router-dom';
import { hasRouteAccess, getAccessibleRoutes } from '../utils/routeProtection';

const ProtectedRoute = ({ children, routeName }) => {
  // Get user from localStorage
  const user = JSON.parse(localStorage.getItem('user'));
  
  if (!user) {
    return <Navigate to="/" replace />;
  }
  
  if (!hasRouteAccess(routeName, user)) {
    // Get all accessible routes for this user
    const accessibleRoutes = getAccessibleRoutes(user);
    
    // Find the first accessible route
    let redirectTo = '/dashboard'; // default fallback
    
    if (accessibleRoutes.length > 0) {
      // Priority order: dashboard first, then first available route
      if (accessibleRoutes.includes('dashboard')) {
        redirectTo = '/dashboard';
      } else {
        redirectTo = `/${accessibleRoutes[0]}`;
      }
    }
    
    // Redirect to first accessible page
    return <Navigate to={redirectTo} replace />;
  }
  
  return children;
};

export default ProtectedRoute;
