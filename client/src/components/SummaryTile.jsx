import React from 'react'

/**
 * The summary tile used above the tables.
 *
 * Taken from the Receipts page, which was the first to get this treatment, and
 * shared so the other list pages stop each carrying their own plainer copy.
 * A page-local duplicate is how four tables ended up with four different cards
 * while one had the real design.
 *
 * A tile is clickable when it is given an onClick - which is how a page turns a
 * status tile into a filter for the table below it - and inert otherwise. There
 * is no label sniffing here: the Receipts page used to decide this by testing
 * `label !== 'Total Amount Due'`, so renaming that tile silently made it
 * clickable.
 *
 * `plainLabel` drops the pill badge for a tile that should read as a headline
 * figure rather than a filter, such as the dark money total.
 */
const THEMES = {
  emerald: {
    text: 'text-emerald-600 dark:text-emerald-400',
    badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    bar: 'bg-emerald-500',
    bg: 'bg-emerald-500',
  },
  amber: {
    text: 'text-amber-600 dark:text-amber-400',
    badgeBg: 'bg-amber-50 text-amber-700 border-amber-200',
    bar: 'bg-amber-500',
    bg: 'bg-amber-500',
  },
  orange: {
    text: 'text-orange-600 dark:text-orange-400',
    badgeBg: 'bg-orange-50 text-orange-700 border-orange-200',
    bar: 'bg-orange-500',
    bg: 'bg-orange-500',
  },
  rose: {
    text: 'text-rose-600 dark:text-rose-400',
    badgeBg: 'bg-rose-50 text-rose-700 border-rose-200',
    bar: 'bg-rose-500',
    bg: 'bg-rose-500',
  },
  blue: {
    text: 'text-blue-600 dark:text-blue-400',
    badgeBg: 'bg-blue-50 text-blue-700 border-blue-200',
    bar: 'bg-blue-500',
    bg: 'bg-blue-500',
  },
  dark: {
    text: 'text-emerald-400',
    badgeBg: 'bg-emerald-950 text-emerald-300 border-emerald-800/50',
    bar: 'bg-emerald-400',
    bg: 'bg-emerald-400',
  },
}

const FALLBACK = {
  text: 'text-gray-700',
  badgeBg: 'bg-gray-50 text-gray-700 border-gray-200',
  bar: 'bg-gray-400',
  bg: 'bg-gray-400',
}

function SummaryTile({
  label,
  value,
  subText,
  color = 'gray',
  onClick,
  isActive = false,
  icon: Icon,
  plainLabel = false,
  hoverable = false,
}) {
  const theme = THEMES[color] || FALLBACK

  const bgClass =
    color === 'dark'
      ? 'bg-slate-900 text-white border-slate-800'
      : 'bg-white text-gray-900 border-gray-200/80 shadow-xs'

  const activeBgClass = isActive ? `${theme.bg} text-white border-transparent` : bgClass

  const isClickable = Boolean(onClick)
  // Hover is a separate concern from clickability. A tile that only reports a
  // figure still wants the sweep and the colour change; it just must not
  // claim to be pressable.
  const showHover = isClickable || hoverable

  const iconColor = isActive
    ? 'text-white'
    : plainLabel || color === 'dark'
      ? theme.text
      : 'text-gray-600'

  return (
    <div
      onClick={isClickable ? onClick : undefined}
      className={`${activeBgClass} p-3 rounded-xl border relative overflow-hidden flex flex-col justify-between h-full ${showHover ? 'hover:scale-105 hover:shadow-lg group' : ''} ${isClickable ? 'cursor-pointer' : ''} transition-all duration-300`}
    >
      {/* Bottom accent bar, sweeping up on hover. Behind the content. */}
      <div
        className={`absolute bottom-0 left-0 right-0 h-1 ${theme.bar} ${showHover ? 'group-hover:h-full' : ''} transition-all duration-300 z-0`}
      />

      <div className="relative z-10 flex flex-col justify-between h-full">
        <div className="flex items-center justify-between gap-2 mb-2">
          {plainLabel ? (
            <span className={`text-xs font-semibold tracking-wide uppercase text-white`}>
              {label}
            </span>
          ) : (
            <span
              className={`px-2.5 py-0.5 text-xs font-semibold rounded-full border ${isActive ? 'bg-white text-gray-900 border-white' : theme.badgeBg} ${showHover ? 'group-hover:bg-white group-hover:text-gray-900 group-hover:border-white' : ''}`}
            >
              {label}
            </span>
          )}
          <span
            className={`text-xs font-medium ${isActive ? 'text-white/80' : 'text-gray-400'} ${showHover ? 'group-hover:text-white/80' : ''}`}
          >
            {subText}
          </span>
        </div>

        <div className="flex items-center gap-2 my-1">
          {Icon && (
            <Icon
              size={20}
              className={`${iconColor} ${showHover ? 'group-hover:text-white' : ''} transition-colors`}
            />
          )}
          <span
            className={`text-2xl font-bold font-mono tracking-tight ${isActive ? 'text-white' : plainLabel ? theme.text : 'text-black'} ${showHover ? 'group-hover:text-white' : ''}`}
          >
            {value}
          </span>
        </div>
      </div>
    </div>
  )
}

export default SummaryTile