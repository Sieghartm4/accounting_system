import { useState, useEffect, useCallback } from 'react'
import { fetchWithAuth } from '../utils/api'

/**
 * The current company's plan, fetched once per tab.
 *
 * The client needs this to decide what to render *before* a page issues its
 * first request. Previously the only signal was a 402 arriving after mount,
 * which surfaced as a red error toast rather than an explanation.
 *
 * Cached in sessionStorage because it cannot change within a session and the
 * sidebar, the route guard and the upgrade screen all need it. The cache is
 * cleared on plan change and on logout rather than aged out on a timer.
 */

const CACHE_KEY = 'auth_entitlement'

const readCache = () => {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    // Corrupt entry, or storage unavailable. Treated as "not cached" so the
    // hook refetches rather than trusting an unreadable value.
    return null
  }
}

const writeCache = (data) => {
  try {
    if (data) sessionStorage.setItem(CACHE_KEY, JSON.stringify(data))
    else sessionStorage.removeItem(CACHE_KEY)
  } catch {
    // Storage disabled (private mode, quota). The gate simply refetches.
  }
}

/** Drop the cache so the next reader refetches. Call after subscribe/upgrade. */
export const invalidateEntitlement = () => writeCache(null)

export const useEntitlement = () => {
  const [entitlement, setEntitlement] = useState(readCache)
  const [loading, setLoading] = useState(!readCache())
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetchWithAuth('/entitlement')
      const payload = await response.json()
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || `HTTP ${response.status}`)
      }
      const data = payload.data
      writeCache(data)
      setEntitlement(data)
      return data
    } catch (e) {
      setError(e.message)
      // Fail closed. Leaving entitlement null makes hasModule return false,
      // which shows the upgrade screen rather than leaking a locked page.
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!readCache()) load()
  }, [load])

  const hasModule = useCallback(
    (code) => {
      if (!entitlement || !Array.isArray(entitlement.modules)) return false
      return entitlement.modules.includes(code)
    },
    [entitlement],
  )

  return { entitlement, loading, error, hasModule, reload: load, invalidate: invalidateEntitlement }
}

export default useEntitlement
