import { useState, useEffect, useCallback } from 'react'
import { fetchWithAuth } from '../utils/api'

/**
 * The current company's plan, fetched once per tab.
 *
 * The client needs this to decide what to render *before* a page issues its
 * first request. Previously the only signal was a 402 arriving after mount,
 * which surfaced as a red error toast rather than an explanation.
 *
 * Cached in sessionStorage because the sidebar, the route guard and the upgrade
 * screen all read it and one request per navigation would be wasteful.
 *
 * The cache is timestamped and revalidated, NOT trusted for the life of the
 * tab. It used to be read-and-never-refetched, which meant that when an operator
 * changed a plan - adding a module to PREMIUM, say - a user who was already
 * logged in kept the module list they had at login and was refused the module
 * they had just been sold. Plan name and seat count were unchanged by that edit,
 * so the upgrade screen showed the right plan and still said the module was not
 * included, which reads as a server bug and is not one.
 *
 * A plan can change while a session is open, so the cache is an optimisation
 * with an expiry, never an authority.
 */

const CACHE_KEY = 'auth_entitlement'

/**
 * How long a cached answer is trusted before being revalidated.
 *
 * Matches the server's own resolver TTL so the client can never be holding a
 * view the server itself would already have discarded.
 */
const REVALIDATE_AFTER_MS = 60 * 1000

/** The cached entitlement, or null. Tolerates the old un-timestamped shape. */
const readCache = () => {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    // Entries written before the timestamp existed are treated as stale so they
    // are replaced on the next mount rather than trusted indefinitely.
    if (!parsed || typeof parsed !== 'object' || typeof parsed.fetchedAt !== 'number') {
      return null
    }
    return parsed.data ?? null
  } catch {
    // Corrupt entry, or storage unavailable. Treated as "not cached" so the
    // hook refetches rather than trusting an unreadable value.
    return null
  }
}

/** When the cached answer was fetched, or 0 when there is nothing usable. */
const cacheAge = () => {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(CACHE_KEY) || 'null')
    return typeof parsed?.fetchedAt === 'number' ? parsed.fetchedAt : 0
  } catch {
    return 0
  }
}

const isCacheStale = () => Date.now() - cacheAge() > REVALIDATE_AFTER_MS

const writeCache = (data) => {
  try {
    if (data) {
      sessionStorage.setItem(
        CACHE_KEY,
        JSON.stringify({ data, fetchedAt: Date.now() }),
      )
    } else {
      sessionStorage.removeItem(CACHE_KEY)
    }
  } catch {
    // Storage disabled (private mode, quota). The gate simply refetches.
  }
}

/** Drop the cache so the next reader refetches. Call after subscribe/upgrade. */
export const invalidateEntitlement = () => writeCache(null)

/**
 * Ask the server to drop its cached entitlement and return the fresh one.
 *
 * The server caches entitlement for 60 seconds, so after a plan is chosen the
 * old module set would still be enforced and the customer who just paid would
 * be shown the upgrade screen again. Called once the plan has been recorded.
 */
export const refreshEntitlement = async () => {
  try {
    const response = await fetchWithAuth('/entitlement/refresh', { method: 'POST' })
    const payload = await response.json()
    if (!response.ok || !payload.success) return null
    writeCache(payload.data)
    return payload.data
  } catch {
    // A failed refresh is not fatal: the 60s TTL still expires on its own, and
    // the cache is left holding the previous answer rather than nothing.
    return null
  }
}

export const useEntitlement = () => {
  const [entitlement, setEntitlement] = useState(readCache)
  const [loading, setLoading] = useState(!readCache())
  const [error, setError] = useState(null)
  // False while a cold load or a revalidation is in flight. Lets a caller
  // refuse to make a decision on an answer it has not checked with the server.
  const [validated, setValidated] = useState(!readCache())

  const load = useCallback(async () => {
    // Only the cold path reports loading. A revalidation over a warm cache must
    // not flip the gate back to "no entitlement", which would flash the upgrade
    // screen at a user who already has access.
    if (!readCache()) setLoading(true)
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
      // A failed revalidation keeps the last good answer rather than clearing it:
      // replacing a working entitlement with null would lock the user out of
      // pages they can reach purely because a request blipped.
      return null
    } finally {
      setLoading(false)
      // Settled either way: the caller may now act on whatever it holds.
      setValidated(true)
    }
  }, [])

  useEffect(() => {
    // Revalidate whenever the cached answer is missing or older than the TTL.
    // This runs per navigation because every protected route mounts the gate, so
    // a plan change made by an operator reaches a user who is already signed in.
    if (!readCache() || isCacheStale()) load()
  }, [load])

  const hasModule = useCallback(
    (code) => {
      if (!entitlement || !Array.isArray(entitlement.modules)) return false
      return entitlement.modules.includes(code)
    },
    [entitlement],
  )

  return {
    entitlement,
    loading,
    error,
    hasModule,
    // True once a request has completed on this mount. False means "this answer
    // has not been checked with the server yet".
    validated,
    reload: load,
    invalidate: invalidateEntitlement,
  }
}

export default useEntitlement
