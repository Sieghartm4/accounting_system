import React from 'react'
import { Navigate } from 'react-router-dom'
import { hasRouteAccess, getAccessibleRoutes } from '../utils/routeProtection'
import ModuleUpsell from './ModuleUpsell'
import useEntitlement from '../hooks/useEntitlement'

/**
 * Gate for a module page.
 *
 * Two independent checks, in order:
 *   1. Route access from master_route_access - the permission question, which
 *      this file already handled.
 *   2. Plan entitlement - whether the tenant's plan includes the module.
 *
 * The second check is what turns a 402 arriving after mount (surfaced as a red
 * "System Error" toast) into a proper explanation with a route to upgrade.
 *
 * `moduleCode` defaults to `routeName` because they are the same identifier in
 * practice - master_route_access and plan_modules both use module codes. Pass it
 * explicitly only where the route and the module differ.
 */
const ProtectedRoute = ({ children, routeName, moduleCode }) => {
  const user = JSON.parse(sessionStorage.getItem('auth_user') || 'null')

  if (!user) {
    return <Navigate to="/" replace />
  }

  // Allow ADMIN users from subscription database to access subscription page
  if (routeName === 'subscription') {
    if (user.role === 'ADMIN') {
      return children
    }
  }

  if (!hasRouteAccess(routeName, user)) {
    // Get all accessible routes for this user
    const accessibleRoutes = getAccessibleRoutes(user)

    // Find the first accessible route
    let redirectTo = '/dashboard' // default fallback

    if (accessibleRoutes.length > 0) {
      // Priority order: dashboard first, then first available route
      if (accessibleRoutes.includes('dashboard')) {
        redirectTo = '/dashboard'
      } else {
        redirectTo = `/${accessibleRoutes[0]}`
      }
    }

    // Redirect to first accessible page
    return <Navigate to={redirectTo} replace />
  }

  // Permission granted. Now decide whether the plan covers this module.
  //
  // moduleCode must be a single string. routeName is sometimes an array (a page
  // reachable through several route_access codes), and hasModule on an array is
  // always false, which would show the upgrade screen to every tenant including
  // ones who paid. Such routes therefore have to pass moduleCode explicitly; the
  // array is only ever used for the permission check above.
  const resolvedModule = moduleCode || (Array.isArray(routeName) ? routeName[0] : routeName)

  return <ModuleGate moduleCode={resolvedModule}>{children}</ModuleGate>
}

/**
 * Renders children when the plan includes the module, the upgrade screen when it
 * does not, and nothing while the entitlement is still being fetched.
 *
 * Rendering nothing during the fetch is deliberate. It is a short window on a
 * page load, and rendering a spinner here would flash on every navigation.
 * `loading` renders the children optimistically only when the entitlement is
 * already cached, which it is for all but the first page of a session.
 */
const ModuleGate = ({ moduleCode, children }) => {
  const { entitlement, loading, hasModule } = useEntitlement()

  if (!entitlement) {
    if (loading) return null
    // Entitlement unreadable. Fail closed with an explanation rather than
    // rendering a page whose every request will 402.
    return <ModuleUpsell moduleCode={moduleCode} entitlement={entitlement} />
  }

  if (!hasModule(moduleCode)) {
    return <ModuleUpsell moduleCode={moduleCode} entitlement={entitlement} />
  }

  return children
}

export default ProtectedRoute
