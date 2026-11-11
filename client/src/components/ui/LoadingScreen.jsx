import React from 'react'

export default function LoadingScreen({
  label = 'Loading',
  fullPage = true,
  subLabel,
  minHeight,
}) {
  return (
    <div
      className={
        fullPage
          ? 'h-full w-full flex flex-col items-center justify-center bg-transparent'
          : 'flex flex-col items-center justify-center'
      }
      style={minHeight ? { minHeight } : undefined}
    >
      <div className="relative flex items-center justify-center">
        <div className="w-16 h-16 rounded-full border-4 border-black/10 border-t-red-600 border-r-red-600 animate-spin" />
        <div className="absolute w-8 h-8 rounded-full bg-black flex items-center justify-center">
          <div className="w-3 h-3 rounded-full bg-red-600 animate-pulse" />
        </div>
      </div>
      <div
        className="mt-6 flex items-center gap-2"
        style={{ animation: 'pulse 1.5s ease-in-out infinite' }}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-red-600" />
        <p className="text-xs font-black uppercase tracking-[4px] text-black">
          {label}
        </p>
        <span className="w-1.5 h-1.5 rounded-full bg-red-600" />
      </div>
      <div className="mt-2 h-px w-32 bg-gradient-to-r from-transparent via-red-600 to-transparent" />
      {subLabel && (
        <p className="mt-3 text-[10px] font-bold uppercase tracking-[2px] text-gray-400">
          {subLabel}
        </p>
      )}
      <div className="mt-4 flex items-center gap-1.5">
        <span
          className="w-2 h-2 rounded-full bg-red-600 animate-bounce"
          style={{ animationDelay: '0ms' }}
        />
        <span
          className="w-2 h-2 rounded-full bg-black animate-bounce"
          style={{ animationDelay: '150ms' }}
        />
        <span
          className="w-2 h-2 rounded-full bg-gray-400 animate-bounce"
          style={{ animationDelay: '300ms' }}
        />
      </div>
    </div>
  )
}
