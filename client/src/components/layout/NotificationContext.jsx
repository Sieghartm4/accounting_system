import { createContext, useContext } from 'react'
import useNotifications from '../../hooks/useNotifications'

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
      markReadForDocument: () => {},
      markAllRead: () => {},
      markAllRead: () => {},
    }
  )
}

export default NotificationContext