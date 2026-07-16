import React from 'react'
import { canCreateEdit } from '../utils/routeProtection'

const ProtectedAction = ({ children, routeName, fallback = null, user = null }) => {
  const currentUser = user || JSON.parse(localStorage.getItem('user'))

  if (!currentUser) {
    return fallback
  }

  if (!canCreateEdit(routeName, currentUser)) {
    return fallback
  }

  return children
}

export default ProtectedAction
