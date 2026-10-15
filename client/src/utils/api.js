// API utility with automatic 401/token expired handling

import { reportModuleLockout } from './moduleLockout'

// Global fetch interceptor for auto-logout on token expiration
const originalFetch = window.fetch
window.fetch = async function (...args) {
  const requestOptions = args[1] || {}
  const requestHeaders = new Headers(requestOptions.headers || {})

  // The server authenticates through the httpOnly session cookie. Remove any
  // legacy bearer header that older feature code may still construct.
  if (sessionStorage.getItem('authenticated') === 'session') {
    requestHeaders.delete('Authorization')
  }

  args[1] = {
    ...requestOptions,
    credentials: 'include',
    headers: requestHeaders,
  }

  // Normalize insecure http requests when the page is served over HTTPS
  try {
    const pageIsSecure = window.location && window.location.protocol === 'https:'
    if (
      pageIsSecure &&
      typeof args[0] === 'string' &&
      args[0].startsWith('http://')
    ) {
      args[0] = args[0].replace(/^http:/i, 'https:')
    }
  } catch (e) {
    // ignore
  }

  const response = await originalFetch.apply(this, args)

  // Handle 402 MODULE_NOT_IN_PLAN here, alongside the 401 handling below, rather
  // than in a second wrapper or in each page.
  //
  // The route gate decides from a cached entitlement that can be up to a minute
  // behind the server, so in that window a page mounts and its first request is
  // the one that discovers the module is withheld. Catching it here means the
  // gate can swap in the upgrade screen. Doing it per page is not possible: each
  // page formats its own error and most throw away the status and code, keeping
  // only the message text - which is how the raw server wording ended up in a
  // red "System Error" toast.
  if (response.status === 402) {
    response
      .clone()
      .json()
      .then((body) => {
        if (body && body.code === 'MODULE_NOT_IN_PLAN' && body.module) {
          reportModuleLockout(body.module)
        }
      })
      .catch(() => {
        // Not JSON, or the clone failed. The page handles it as it sees fit.
      })
  }

  // Handle 401 responses globally
  if (response.status === 401) {
    // Clone response to read body without consuming original
    const clonedResponse = response.clone()
    try {
      const data = await clonedResponse.json()

      // If token expired, force logout
      if (data.code === 'TOKEN_EXPIRED' || data.message === 'Token expired') {
        console.log('Token expired, forcing logout')
        handleLogout()
        throw new Error('Session expired. Please login again.')
      }
    } catch (e) {
      // If JSON parsing fails or it's not a token expired error,
      // still redirect to login on 401
      if (e.message !== 'Session expired. Please login again.') {
        handleLogout()
        throw new Error('Authentication failed. Please login again.')
      }
      throw e
    }
  }

  return response
}

// A 402 means the request was well-formed and authenticated but the account
// cannot pay for it: the subscription has lapsed, or the module is not in the
// plan. These are not errors to retry, and leaving them to bubble up as failed
// requests is what made the old gate invisible - the page just stopped working
// with no explanation.
//
// The module case is handled in the fetch wrapper at the top of this file, which
// sees the status and code before the page discards them. By the time a page
// throws, it has usually kept only the message text, which is why the raw server
// wording used to reach a red "System Error" toast instead of the upgrade screen.
//
// The remaining case here is a lapsed subscription: routed to the plan picker
// rather than to /login, because the credentials are still valid and the tenant's
// data is untouched; only the plan needs choosing. The 403 variant raised at
// login is handled in useLogin.js, which must not store a password, so it is
// deliberately not handled here.
if (typeof window !== 'undefined' && !window.__subscriptionGateInstalled) {
  window.__subscriptionGateInstalled = true

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event && event.reason
    const status = reason && (reason.status || reason.statusCode)
    const payload = reason && (reason.payload || reason.data)
    if (status !== 402 && !(payload && payload.requiresSubscription)) return

    // A module the plan does not include is NOT handled here. ProtectedRoute now
    // renders the upgrade screen for that case before the page issues a request,
    // so redirecting here would yank the user off a screen that explains the
    // situation and offers the upgrade. These 402s are swallowed instead: the
    // page is already showing the right thing.
    if (payload && payload.code === 'MODULE_NOT_IN_PLAN') {
      event.preventDefault?.()
      return
    }

    // Already on the plan page: re-announcing would fight the user's clicks.
    if (window.location.pathname.startsWith('/register')) return

    // Remember who they are so the plan step can prefill and name them, exactly
    // as the login 403 path does. existingAccount stops the plan step from
    // implying they still need to register. The password is never stored, and is
    // not needed: authentication is the session cookie.
    const authUser = (() => {
      try {
        return JSON.parse(sessionStorage.getItem('auth_user') || 'null')
      } catch {
        return null
      }
    })()
    const username = (payload && payload.username) || (authUser && authUser.username)

    if (username) {
      sessionStorage.setItem(
        'pendingUser',
        JSON.stringify({
          username,
          tenantDb: (authUser && authUser.tenantDb) || null,
          email: (authUser && authUser.email) || null,
          fullname: (authUser && authUser.fullname) || null,
          existingAccount: true,
        }),
      )
    }
    window.location.href = '/register?step=plan'
  })
}

export async function fetchWithAuth(url, options = {}) {
  if (typeof url === 'string' && url.startsWith('/')) {
    const serverLink = import.meta.env.VITE_SERVER_LINK || ''
    url = `${serverLink.replace(/\/$/, '')}${url}`
  }

  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  }

  // If page is secure and caller passed an http URL, normalize to https
  try {
    const pageIsSecure = window.location && window.location.protocol === 'https:'
    if (pageIsSecure && typeof url === 'string' && url.startsWith('http://')) {
      url = url.replace(/^http:/i, 'https:')
    }
  } catch (e) {
    // ignore
  }

  const response = await fetch(url, {
    ...options,
    credentials: 'include',
    headers,
  })

  return response
}

// Expose normalized server links for client-side code to use when building
// WebSocket connections or other runtime URLs. This is set from VITE_SERVER_LINK
// and adjusted to use https/wss when the page is secure.
try {
  const raw = import.meta.env.VITE_SERVER_LINK || ''
  const pageIsSecure = window.location && window.location.protocol === 'https:'
  let normalized = raw
  if (pageIsSecure && raw.startsWith('http://')) {
    normalized = raw.replace(/^http:/i, 'https:')
  }
  // Provide explicit values for other modules
  window.SERVER_LINK = normalized
  // WS link: convert http(s):// to ws(s)://
  if (normalized) {
    if (pageIsSecure) {
      window.WS_SERVER_LINK = normalized
        .replace(/^http:/i, 'wss:')
        .replace(/^https:/i, 'wss:')
    } else {
      window.WS_SERVER_LINK = normalized
        .replace(/^http:/i, 'ws:')
        .replace(/^https:/i, 'ws:')
    }
  } else {
    window.WS_SERVER_LINK = ''
  }
} catch (e) {
  // ignore in exotic environments
}

function handleLogout() {
  // Clear all auth data
  localStorage.removeItem('token')
  localStorage.removeItem('user')

  // The cached entitlement is per-tab and survives logout, so without this the
  // next login as a different company renders navigation from the previous
  // company's plan until the cache expires.
  try {
    sessionStorage.removeItem('auth_entitlement')
    sessionStorage.removeItem('auth_module_catalog')
  } catch {
    // Storage unavailable; the hook simply refetches.
  }

  // Redirect to login page
  window.location.href = '/login'
}
