import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { hasRouteAccess, getAccessLevel } from '../utils/routeProtection';

const RouteProtection = ({ children, routeName }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const userData = JSON.parse(localStorage.getItem('user'));
    setUser(userData);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (!isLoading && user) {
      if (!hasRouteAccess(routeName, user)) {
        // Redirect to dashboard if no access
        navigate('/dashboard');
        return;
      }
    }
  }, [user, isLoading, navigate, routeName]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0B0B0B]">
        <div className="text-white text-center">
          <div className="w-8 h-8 border-2 border-red-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
          <p className="text-sm">Checking access...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    navigate('/login');
    return null;
  }

  if (!hasRouteAccess(routeName, user)) {
    return null; // Will redirect in useEffect
  }

  return children;
};

export default RouteProtection;
