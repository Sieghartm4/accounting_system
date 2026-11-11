import React from 'react'

function FlipDigit({ digit }) {
  return (
    <div className="relative bg-gradient-to-b from-[#242930] to-[#111317] border border-[#2b313a] rounded-md px-1.5 py-1.5 shadow-[0_2px_5px_rgba(0,0,0,0.5)] flex items-center justify-center min-w-[20px] h-[30px] overflow-hidden">
      <div className="absolute inset-x-0 top-1/2 h-[1px] bg-black/80 z-10 shadow-[0_0.5px_0_rgba(255,255,255,0.06)]" />
      <div className="absolute inset-x-0 top-0 h-1/2 bg-white/[0.03] pointer-events-none z-0" />
      <span className="font-mono text-[13px] font-black text-gray-100 tracking-wider z-0 leading-none select-none drop-shadow-[0_1.5px_2px_rgba(0,0,0,0.95)]">
        {digit}
      </span>
    </div>
  )
}

function FlipUnitGroup({ value, label }) {
  const padValue = String(value).padStart(2, '0')
  const digit1 = padValue.charAt(0)
  const digit2 = padValue.charAt(1)

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex gap-0.5">
        <FlipDigit digit={digit1} />
        <FlipDigit digit={digit2} />
      </div>
      <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest leading-none mt-0.5">
        {label}
      </span>
    </div>
  )
}

export function AgingTimerCell({ dueDate, now }) {
  const dueTime = new Date(dueDate).getTime()
  const timeDiff = Number.isFinite(dueTime) ? now - dueTime : 0
  const isFuture = timeDiff < 0
  const absMs = Math.abs(timeDiff)
  const totalSeconds = Math.floor(absMs / 1000)
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  const statusLabel = isFuture ? 'Due in' : 'Overdue'
  const badgeClasses = isFuture
    ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
    : 'bg-rose-500/10 text-rose-600 border-rose-500/20'

  return (
    <div className="inline-flex items-stretch">
      {/* LEFT STATUS */}
      <span
        className={`flex items-center justify-center gap-1.5 
      rounded-l-xl border border-r-0 
      px-3 h-14 
      text-[9px] font-black uppercase tracking-wider 
      leading-none
      ${badgeClasses}`}
      >
        <span
          className={`h-1.5 w-1.5 rounded-full animate-pulse ${
            isFuture ? 'bg-emerald-500' : 'bg-rose-500'
          }`}
        />
        {statusLabel}
      </span>

      {/* RIGHT TIMER */}
      <div
        className="flex items-center gap-1.5 
      rounded-r-xl bg-[#0b0c0e] px-3 
      h-14 border border-[#1b1c20] 
      shadow-[inset_0_2px_8px_rgba(0,0,0,0.8),0_4px_12px_rgba(0,0,0,0.15)]"
      >
        <FlipUnitGroup value={days} label="Days" />

        <span className="text-xs font-mono text-gray-500 font-bold select-none">
          :
        </span>

        <FlipUnitGroup value={hours} label="Hours" />

        <span className="text-xs font-mono text-gray-500 font-bold select-none">
          :
        </span>

        <FlipUnitGroup value={minutes} label="Mins" />

        <span className="text-xs font-mono text-gray-500 font-bold select-none">
          :
        </span>

        <FlipUnitGroup value={seconds} label="Secs" />
      </div>
    </div>
  )
}
