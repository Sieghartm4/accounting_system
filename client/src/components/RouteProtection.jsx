import React, { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import LoadingScreen from './LoadingScreen'
import { hasRouteAccess, getAccessLevel } from '../utils/routeProtection'

const RouteProtection = ({ children, routeName }) => {
  const navigate = useNavigate()
  const location = useLocation()
  const [user, setUser] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const userData = JSON.parse(sessionStorage.getItem('auth_user') || 'null')
    setUser(userData)
    setIsLoading(false)
  }, [])

  useEffect(() => {
    if (!isLoading && user) {
      if (!hasRouteAccess(routeName, user)) {
        // Redirect to dashboard if no access
        navigate('/dashboard')
        return
      }
    }
  }, [user, isLoading, navigate, routeName])

  if (isLoading) {
    return <LoadingScreen label="Checking Access..." />
  }

  if (!user) {
    navigate('/login')
    return null
  }

  if (!hasRouteAccess(routeName, user)) {
    return null // Will redirect in useEffect
  }

  return children
}

export default RouteProtection
