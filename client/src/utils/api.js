// API utility with automatic 401/token expired handling

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

  // Redirect to login page
  window.location.href = '/login'
}
