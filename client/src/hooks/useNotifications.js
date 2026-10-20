import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchWithAuth } from '../utils/api'
import { API } from '../api/endpoints'
import connectRealtime from '../utils/realtimeSocket'

/**
 * The signed-in user's notifications and unread count.
 *
 * ## Read state is the server's
 *
 * Nothing here decides whether a notification is read. The server returns
 * `isRead` per item and an `unreadCount` derived from the same join, so the
 * badge cannot disagree with the list. Marking read posts to the server and then
 * takes the count the server returns, rather than decrementing locally - a
 * second tab may have read something in between, and guessing would put the
 * number out of step with the database.
 *
 * ## Push is an optimisation, not the source of truth
 *
 * A `notification:new` event inserts the row and bumps the count. If the socket
 * is down the row is still on the server, so the next load or manual refresh
 * shows it. Nothing is lost by missing a push, which is why the effect does not
 * treat a socket error as an error state - it would mean the page was broken
 * when it is only the live update that is not arriving.
 */

const COMPANY_CACHE_KEY = 'notifications_company_id'

/**
 * Which notification module a URL belongs to.
 *
 * The three vocabularies do not line up, which is why this is written out rather
 * than derived:
 *
 *   - the server groups notifications by module code: `collection`, not
 *     `collections`;
 *   - the router and the sidebar use the plural: `/collections`;
 *   - `recurring_journals` is routed as `/recurring-journals`.
 *
 * Assuming path === module silently produced a Collections row that could never
 * show a badge, because it looked up `collections` in a map keyed `collection`.
 */
export const PATH_TO_MODULE = {
  receipts: 'receipts',
  disbursement: 'disbursement',
  sales: 'sales',
  collections: 'collection',
  purchase: 'purchase',
  purchase_order: 'purchase_order',
  payments: 'payments',
  adjustments: 'adjustments',
  'recurring-journals': 'recurring_journals',
  recurring_journals: 'recurring_journals',
}

/**
 * Sidebar row name -> notification module.
 *
 * Same reason: a nav row is named after its route, the server groups by module.
 */
export const NAV_TO_MODULE = {
  receipts: 'receipts',
  disbursement: 'disbursement',
  sales: 'sales',
  collections: 'collection',
  purchase: 'purchase',
  purchase_order: 'purchase_order',
  payments: 'payments',
  adjustments: 'adjustments',
  recurring_journals: 'recurring_journals',
}

/** The notification module a pathname belongs to, or null. */
export const moduleForPath = (pathname) => {
  const segment = String(pathname || '').split('/').filter(Boolean)[0]
  return segment ? PATH_TO_MODULE[segment] || null : null
}

const resolveCompanyId = async () => {
  const cached = sessionStorage.getItem(COMPANY_CACHE_KEY)
  if (cached) return Number(cached)

    const res = await fetchWithAuth(API.companySingle())
    if (!res.ok) throw new Error('Could not resolve the company for notifications')
    const json = await res.json().catch(() => null)
    // /company/single returns the company object. This used to arrive wrapped in
    // an array, and the unwrap below is kept so a tenant still served by an
    // older build keeps its notifications rather than losing the badge.
    const company = Array.isArray(json?.data) ? json.data[0] : json?.data
    const id = Number(company?.company_id ?? company?.mc_company_id)
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error('No company is available for this account')
  }
  sessionStorage.setItem(COMPANY_CACHE_KEY, String(id))
  return id
}

const useNotifications = ({ companyId: providedCompanyId } = {}) => {
  const [items, setItems] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [unreadByModule, setUnreadByModule] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [companyId, setCompanyId] = useState(
    providedCompanyId ? Number(providedCompanyId) : null,
  )

  // Kept in a ref so the socket subscription does not have to be torn down and
  // rebuilt every time the list changes.
  const companyRef = useRef(companyId)
  companyRef.current = companyId

  // Read inside markRead/markModuleRead without making them depend on the item
  // list, which would rebuild them on every push.
  const itemsRef = useRef(items)
  itemsRef.current = items
  const unreadByModuleRef = useRef(unreadByModule)
  unreadByModuleRef.current = unreadByModule

  const load = useCallback(async (filter = 'all') => {
    const id = providedCompanyId ? Number(providedCompanyId) : await resolveCompanyId()
    if (!companyRef.current) setCompanyId(id)

    const [res, moduleRes] = await Promise.all([
      fetchWithAuth(`${API.notifications()}?filter=${filter}&companyId=${id}`),
      fetchWithAuth(`${API.notificationsUnreadByModule()}?companyId=${id}`),
    ])

    if (!res.ok) throw new Error('Could not load notifications')
    const json = await res.json().catch(() => null)
    if (!json?.success) throw new Error(json?.message || 'Could not load notifications')

    setItems(json.data?.items ?? [])
    setUnreadCount(Number(json.data?.unreadCount ?? 0))

    if (moduleRes.ok) {
      const moduleJson = await moduleRes.json().catch(() => null)
      if (moduleJson?.success) {
        setUnreadByModule(moduleJson.data?.unreadByModule ?? {})
      }
    }

    return json.data
  }, [providedCompanyId])

  const refresh = useCallback(async () => {
    try {
      setError(null)
      await load('all')
    } catch (err) {
      setError(err.message || 'Failed to load notifications')
    }
  }, [load])

  // Initial load.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        await load('all')
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load notifications')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [load])

  // Live updates. Only once a company is known, so the first notification cannot
  // arrive before there is anything to attach it to.
  useEffect(() => {
    if (!companyId) return undefined
    const close = connectRealtime({
      onMessage: (type, data) => {
        if (type !== 'notification:new') return
        const incoming = data?.notification
        if (!incoming) return
        setItems((current) => {
          // The push is addressed to this socket, but a reconnect can replay one
          // already in the list, so de-duplicate on id.
          if (current.some((n) => n.id === incoming.id)) return current
          return [{ ...incoming, isRead: false }, ...current]
        })
        setUnreadCount((count) => count + 1)
        setUnreadByModule((current) => {
          const module = incoming.module
          if (!module) return current
          return {
            ...current,
            [module]: (current[module] || 0) + 1,
          }
        })
      },
    })
    return close
  }, [companyId])

  const markRead = useCallback(async (id) => {
    const cid = companyId
    if (!cid || !id) return
    const target = items.find((n) => n.id === id)
    // Optimistic: the row moves out of the unread list immediately, and the
    // server's count replaces ours below.
    setItems((current) =>
      current.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
    )
    // The sidebar badge for that module has to come down with it, or the row
    // still shows a number after the notification has been read.
    if (target && target.isRead === false && target.module) {
      setUnreadByModule((current) => {
        const remaining = (current[target.module] || 0) - 1
        const next = { ...current }
        // Drop the key at zero so it matches what the server returns rather than
        // leaving a stale `receipts: 0` to disagree with a later response.
        if (remaining > 0) next[target.module] = remaining
        else delete next[target.module]
        return next
      })
    }
    const res = await fetchWithAuth(`${API.notificationsRead(id)}?companyId=${cid}`, {
      method: 'POST',
    })
    if (!res.ok) {
      // Roll back rather than leave the badge lying.
      await refresh()
      return
    }
    const json = await res.json().catch(() => null)
    if (json?.success && json.data?.unreadCount !== undefined) {
      setUnreadCount(Number(json.data.unreadCount))
    }
  }, [companyId, items, refresh])

  /**
   * Clear every unread notification in one module.
   *
   * Called when the reader opens the screen the notifications belong to, so the
   * sidebar badge for that screen goes away on arrival. Opening Receipts does not
   * mean you opened each of the five receipts waiting for you.
   *
   * The server decides what counts; it returns both totals so the header badge
   * and the sidebar badge are corrected from one answer.
   */
  const markModuleRead = useCallback(
    async (module) => {
      const cid = companyId
      const target = String(module || '').trim()
      if (!cid || !target) return
      // Nothing unread in that module: no request, no flicker on every visit.
      if (!unreadByModuleRef.current[target]) return

      const res = await fetchWithAuth(
        `${API.notificationsReadByModule()}?module=${encodeURIComponent(target)}&companyId=${cid}`,
        { method: 'POST' },
      )
      if (!res.ok) return
      const json = await res.json().catch(() => null)
      if (!json?.success) return

      setUnreadCount(Number(json.data?.unreadCount ?? 0))
      if (json.data?.unreadByModule) setUnreadByModule(json.data.unreadByModule)
      // The rows themselves stay listed; they are now read, and the page and
      // dropdown both re-derive that from isRead.
      const wasUnread = new Set(
        itemsRef.current.filter((n) => n.module === target && n.isRead === false).map((n) => n.id),
      )
      if (wasUnread.size > 0) {
        setItems((current) =>
          current.map((n) => (wasUnread.has(n.id) ? { ...n, isRead: true } : n)),
        )
      }
    },
    [companyId],
  )

  const markAllRead = useCallback(async () => {
    const cid = companyId
    if (!cid) return
    const res = await fetchWithAuth(`${API.notificationsReadAll()}?companyId=${cid}`, {
      method: 'POST',
    })
    if (!res.ok) return
    const json = await res.json().catch(() => null)
    if (json?.success) {
      setItems((current) => current.map((n) => ({ ...n, isRead: true })))
      setUnreadCount(0)
    }
  }, [companyId])

  return {
    items,
    unreadCount,
    unreadByModule,
    loading,
    error,
    companyId,
    refresh,
    markRead,
    markModuleRead,
    markAllRead,
  }
}

export default useNotifications