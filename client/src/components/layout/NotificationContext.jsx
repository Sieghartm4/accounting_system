import { createContext, useContext, useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import useNotifications, { moduleForPath } from '../../hooks/useNotifications'

/**
 * One notification state for the whole shell.
 *
 * The header bell, the sidebar badges and the notifications page all read the
 * same unread counts. If each called useNotifications itself, the layout would
 * open three WebSockets, fetch three times, and the sidebar badge could disagree
 * with the header for a moment after a push.
 *
 * The hook is called once, here.
 */

const NotificationContext = createContext(null)

export const NotificationProvider = ({ children }) => {
  const value = useNotifications()
  const { pathname } = useLocation()

  /**
   * Arriving at a screen clears its badge. Staying on it does not.
   *
   * A badge that survives arriving at the page it warns you about is
   * indistinguishable from one that is stuck, so landing on Receipts has to clear
   * the Receipts count.
   *
   * But clearing was originally keyed on the unread count, which meant any
   * notification that arrived *while you were on the page* was wiped as soon as
   * it landed. Editing a purchase is done from the Purchase screen, so every
   * edit notification was marked read within a second of being created and the
   * badge never appeared - which looked exactly like no notification at all.
   *
   * The distinction that matters is arriving versus staying:
   *   - a real navigation into the module clears whatever was waiting;
   *   - a notification that arrives afterwards stays unread, because you are
   *     already looking at that screen and have not acted on it yet.
   *
   * The badge then clears when you navigate away and back, which is also when it
   * stopped being information.
   */
  const prevPathRef = useRef(null)
  // Monotonic arrival counter. Keying "already cleared" on the pathname did not
  // work: coming back to the same screen presents the same pathname, so the
  // second visit was mistaken for the first and never cleared.
  const arrivalRef = useRef(0)
  const clearedArrivalRef = useRef(new Map())
  const companyId = value.companyId

  useEffect(() => {
    const previousPath = prevPathRef.current
    if (previousPath !== pathname) {
      prevPathRef.current = pathname
      arrivalRef.current += 1
    }
    const arrival = arrivalRef.current

    if (!companyId) return
    const module = moduleForPath(pathname)
    if (!module) return

    // Only a navigation counts. This effect also runs when the counts change,
    // and that is precisely the case that must not clear anything.
    if (previousPath === pathname) return

    const count = value.unreadByModule[module] || 0
    if (count === 0) return

    // The arrival id, not the path: StrictMode runs effects twice, and only one
    // of those should clear.
    const key = `${companyId}:${module}`
    if (clearedArrivalRef.current.get(key) === arrival) return
    clearedArrivalRef.current.set(key, arrival)

    value.markModuleRead(module)
  }, [pathname, companyId, value.unreadByModule, value.markModuleRead])

  return (
    <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>
  )
}

/**
 * @returns the same shape as useNotifications, or a safe empty value when used
 *          outside the provider so a component cannot crash on a missing context.
 */
export const useNotificationsState = () => {
  const value = useContext(NotificationContext)
  return (
    value || {
      items: [],
      unreadCount: 0,
      unreadByModule: {},
      loading: false,
      error: null,
      companyId: null,
      refresh: () => {},
      markRead: () => {},
      markModuleRead: () => {},
      markAllRead: () => {},
    }
  )
}

export default NotificationContext