import React, { useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { hasRouteAccess, getAccessibleRoutes } from '../utils/routeProtection'
import ModuleUpsell from './ModuleUpsell'
import useEntitlement from '../hooks/useEntitlement'
import { useModuleLockout } from '../utils/moduleLockout'

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
  const { entitlement, loading, hasModule, validated, invalidate } = useEntitlement()
  const lockedOut = useModuleLockout(moduleCode)

  // The server refused this module on a request the page made. That is
  // authoritative and beats the cached entitlement, which said the opposite -
  // otherwise the page keeps rendering and its own error toast shows the raw
  // server text ("accounting_periods is not included in your plan") in a red
  // "System Error" instead of the upgrade screen.
  //
  // The cached entitlement is dropped at the same time so the next navigation
  // starts from the server's answer rather than the one just proven wrong.
  useEffect(() => {
    if (lockedOut) invalidate()
  }, [lockedOut, invalidate])

  if (lockedOut) {
    return <ModuleUpsell moduleCode={moduleCode} entitlement={entitlement} />
  }

  if (!entitlement) {
    if (loading) return null
    // Entitlement unreadable. Fail closed with an explanation rather than
    // rendering a page whose every request will 402.
    return <ModuleUpsell moduleCode={moduleCode} entitlement={entitlement} />
  }

  if (!hasModule(moduleCode)) {
    // Never deny on an answer that has not been checked with the server.
    //
    // The cached entitlement can be older than a plan change - an operator
    // adding a module to a plan reaches a user who was already signed in. Saying
    // "not in your plan" on a stale cache showed the correct plan name and the
    // wrong module list, which reads as a server fault. Waiting one revalidation
    // is cheaper than wrongly turning away a paying customer.
    if (!validated) return null
    return <ModuleUpsell moduleCode={moduleCode} entitlement={entitlement} />
  }

  return children
}

export default ProtectedRoute
