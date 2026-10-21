import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Bell,
  FilePlus,
  FileEdit,
  GitBranch,
  XCircle,
  AlertTriangle,
  Check,
  CheckCheck,
  Loader2,
} from 'lucide-react'

/**
 * The notification list, shared by the header dropdown and the full page so the
 * two can never drift apart in what they show or how a row behaves.
 *
 * Read state is never decided here. `isRead` and `unreadCount` come from the
 * server, and clicking a row posts the mark-read call - this component reflects
 * the answer rather than guessing, which is what stops two tabs disagreeing.
 */

const MODULE_ICONS = {
  receipts: FilePlus,
  sales: FilePlus,
  purchase: FilePlus,
  collections: FilePlus,
  payments: FilePlus,
  cash_disbursements: FilePlus,
  adjustments: FileEdit,
  recurring_journals: FileEdit,
}

const TYPE_ICONS = {
  DOCUMENT_CREATED: FilePlus,
  DOCUMENT_UPDATED: FileEdit,
  STATUS_CHANGED: GitBranch,
  CANCELLED: XCircle,
  SEVERITY: AlertTriangle,
  TASK: AlertTriangle,
}

/**
 * A plain word for what happened.
 *
 * The icons differ but are not self-explanatory, and "Receipt CR-1 edited" reads
 * like a label rather than an event - so the kind of change is spelled out. An
 * edit and a status change both touch the same document and mean very different
 * things to whoever has to act on it, which is exactly the distinction that was
 * missing.
 */
const TYPE_LABELS = {
  DOCUMENT_CREATED: 'Created',
  DOCUMENT_UPDATED: 'Edited',
  STATUS_CHANGED: 'Status',
  CANCELLED: 'Cancelled',
  SEVERITY: 'Alert',
  TASK: 'Task',
}

const SEVERITY_CLASS = {
  info: 'bg-blue-50 text-blue-600 border-blue-200',
  warning: 'bg-amber-50 text-amber-600 border-amber-200',
  critical: 'bg-red-50 text-red-600 border-red-200',
}

/**
 * "4m ago" / "3h ago" / "12 Mar". A notification list is scanned by recency, so
 * the exact second matters less than how long ago.
 */
export const relativeTime = (value) => {
  if (!value) return ''
  const then = new Date(value).getTime()
  if (Number.isNaN(then)) return ''
  const seconds = Math.max(0, Math.round((Date.now() - then) / 1000))

  if (seconds < 60) return 'just now'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(then).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
  })
}

const ChangeList = ({ changes }) => {
  if (!Array.isArray(changes) || changes.length === 0) return null
  return (
    <ul className="mt-1.5 space-y-0.5">
      {changes.slice(0, 4).map((change, i) => (
        <li key={i} className="text-[11px] text-slate-500 leading-snug">
          {change.note ? (
            <span>{change.note}</span>
          ) : (
            <span>
              <span className="font-semibold text-slate-600">{change.field}:</span>{' '}
              <span className="line-through text-slate-400">
                {change.from === null || change.from === undefined ? 'empty' : change.from}
              </span>{' '}
              <span className="text-slate-300">&rarr;</span>{' '}
              <span className="font-semibold text-slate-700">
                {change.to === null || change.to === undefined ? 'empty' : change.to}
              </span>
            </span>
          )}
        </li>
      ))}
      {changes.length > 4 && (
        <li className="text-[10px] text-slate-400">+{changes.length - 4} more</li>
      )}
    </ul>
  )
}

function NotificationList({
  items,
  unreadCount,
  loading,
  error,
  onRefresh,
  onMarkRead,
  onMarkAllRead,
  compact = false,
  emptyHint = 'Activity from other people in your company will appear here.',
}) {
  const navigate = useNavigate()
  const [busyId, setBusyId] = useState(null)

  /**
   * Unread / Read / All, filtered on the rows already in hand.
   *
   * This does not refetch: `isRead` arrives with every row, so filtering is a
   * local operation and the toggle cannot make the badge lag behind what is on
   * screen. Default is Unread, because the reason somebody opened the bell is
   * almost always "what is new" - and a list where read items outnumber unread
   * ones by ten is exactly what made the two states hard to tell apart.
   */
  const [showRead, setShowRead] = useState(false)
  const readCount = items.filter((n) => n.isRead !== false).length
  const visible = showRead ? items : items.filter((n) => n.isRead === false)

  const open = async (item) => {
    // Marked before navigating: the click that opens the document is the click
    // that counts as reading it.
    if (!item.isRead) {
      setBusyId(item.id)
      try {
        await onMarkRead(item.id)
      } finally {
        setBusyId(null)
      }
    }
    if (item.link) navigate(item.link)
  }

  /**
   * The Unread / Read tabs are the outer shell, not part of the list.
   *
   * They used to be rendered by the same branch that renders the rows, so when
   * there was nothing unread the whole tab bar disappeared and the only way
   * back to the Read tab was a "Show read" button in the empty state - a dead
   * end for anyone who wanted to see what they had already read, and it hid the
   * fact that there were two buckets at all.
   *
   * Now the tabs are always there, on every state including loading and error,
   * and the counts on them say how much is in each. An empty Unread tab is a
   * legitimate answer, not a reason to remove the navigation.
   *
   * Sticky, because the bar is the only way to change bucket and the dropdown
   * caps its list at 420px: without this, scrolling to the bottom of a long
   * Read tab leaves no way back to Unread. `bg-slate-50` is opaque for the same
   * reason - rows scrolling underneath a translucent bar are unreadable.
   */
  const tabBar = (
    <div className="sticky top-0 z-20 flex items-center gap-1 px-4 py-2 border-b border-slate-100 bg-slate-50">
      <button
        onClick={() => setShowRead(false)}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider transition-colors ${
          showRead ? 'text-slate-500 hover:bg-slate-200' : 'bg-blue-600 text-white'
        }`}
      >
        Unread
        <span
          className={`rounded-full px-1.5 py-0.5 text-[9px] tabular-nums ${
            showRead ? 'bg-slate-200 text-slate-600' : 'bg-white/25 text-white'
          }`}
        >
          {unreadCount}
        </span>
      </button>
      <button
        onClick={() => setShowRead(true)}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider transition-colors ${
          showRead ? 'bg-slate-700 text-white' : 'text-slate-500 hover:bg-slate-200'
        }`}
      >
        Read
        <span
          className={`rounded-full px-1.5 py-0.5 text-[9px] tabular-nums ${
            showRead ? 'bg-white/25 text-white' : 'bg-slate-200 text-slate-600'
          }`}
        >
          {readCount}
        </span>
      </button>

      <div className="ml-auto">
        {!compact && unreadCount > 0 && (
          <button
            onClick={onMarkAllRead}
            className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-red-600 transition-colors"
          >
            <CheckCheck size={12} />
            Mark all read
          </button>
        )}
      </div>
    </div>
  )

  const body = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center gap-2 py-10 text-slate-400 text-xs">
          <Loader2 size={14} className="animate-spin" />
          Loading notifications
        </div>
      )
    }

    if (error) {
      return (
        <div className="py-10 text-center">
          <p className="text-xs text-red-600 font-semibold">{error}</p>
          <button
            onClick={onRefresh}
            className="mt-2 text-[11px] font-black uppercase tracking-widest text-slate-500 hover:text-red-600"
          >
            Try again
          </button>
        </div>
      )
    }

    if (!items || items.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
          <Bell size={22} className="text-slate-300 mb-2" />
          <p className="text-xs font-bold text-slate-500">Nothing here yet</p>
          <p className="text-[11px] text-slate-400 mt-1">{emptyHint}</p>
        </div>
      )
    }

    // Empty Unread tab while there is history. The tabs stay put, so Read is one
    // click away and the counts above still show where the other rows are.
    if (visible.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
          <CheckCheck size={22} className="text-emerald-500 mb-2" />
          <p className="text-xs font-bold text-slate-600">You are all caught up</p>
          <p className="text-[11px] text-slate-400 mt-1">
            {readCount > 0
              ? `${readCount} notification${readCount === 1 ? '' : 's'} in Read.`
              : 'Nothing unread.'}
          </p>
        </div>
      )
    }

    return (
      <>
      <ul className={compact ? 'divide-y divide-gray-300' : 'divide-y divide-slate-100'}>
        {visible.map((item) => {
          const Icon =
            TYPE_ICONS[item.type] || MODULE_ICONS[item.module] || Bell
          const unread = item.isRead === false
          return (
            <li key={item.id}>
              <button
                onClick={() => open(item)}
                disabled={busyId === item.id}
                title={unread ? 'Unread - click to open' : 'Already read'}
                className={`w-full text-left flex gap-3 pl-4 pr-4 transition-colors ${
                  compact ? 'py-2.5' : 'py-3'
                } ${
                  // The two states have to be separable at a glance, not by
                  // reading: unread gets a tinted row and a solid accent bar down
                  // the leading edge, read is flat white and recedes.
                  unread
                    ? 'bg-blue-50 hover:bg-blue-100 border-l-[3px] border-l-blue-600'
                    : 'bg-white hover:bg-slate-50 border-l-[3px] border-l-transparent'
                } ${item.link ? 'cursor-pointer' : 'cursor-default'} ${
                  unread ? '' : 'opacity-75'
                }`}
              >
                <span
                  className={`shrink-0 h-8 w-8 rounded-lg border flex items-center justify-center ${
                    SEVERITY_CLASS[item.severity] || SEVERITY_CLASS.info
                  } ${unread ? '' : 'grayscale'}`}
                >
                  <Icon size={15} />
                </span>

                <span className="min-w-0 flex-1">
                  <span className="flex items-start justify-between gap-2">
                    <span
                      className={`text-[13px] leading-snug ${
                        unread ? 'font-extrabold text-slate-900' : 'font-medium text-slate-500'
                      }`}
                    >
                      {item.title}
                    </span>
                    <span className="shrink-0 text-[10px] text-slate-400 whitespace-nowrap">
                      {relativeTime(item.createdAt)}
                    </span>
                  </span>

                  {item.body && (
                    <span
                      className={`block text-[11px] leading-snug mt-0.5 ${
                        unread ? 'text-slate-600' : 'text-slate-400'
                      }`}
                    >
                      {item.body}
                    </span>
                  )}

                  <ChangeList changes={item.changes} />

                  <span className="flex items-center gap-2 mt-1 flex-wrap">
                    {TYPE_LABELS[item.type] && (
                      <span
                        className={`inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider ${
                          item.type === 'CANCELLED'
                            ? 'bg-red-100 text-red-700'
                            : item.type === 'STATUS_CHANGED'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {TYPE_LABELS[item.type]}
                      </span>
                    )}
                    {item.actorName && (
                      <span className="text-[10px] text-slate-400">
                        by{' '}
                        <span className="font-semibold text-slate-500">{item.actorName}</span>
                      </span>
                    )}
                    {unread ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-600 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-white">
                        New
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-slate-400">
                        <CheckCheck size={10} />
                        Read
                      </span>
                    )}
                  </span>
                </span>

                {busyId === item.id && (
                  <Loader2 size={13} className="shrink-0 mt-1 animate-spin text-slate-400" />
                )}
              </button>
            </li>
          )
        })}
      </ul>

      {compact && unreadCount > 0 && (
        <button
          onClick={onMarkAllRead}
          className="w-full py-2 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-red-600 border-t border-slate-100 transition-colors"
        >
          Mark all as read
        </button>
      )}
      </>
    )
  }

  return (
    <div>
      {tabBar}
      {body()}
    </div>
  )
}

export { NotificationList, Check }
export default NotificationList