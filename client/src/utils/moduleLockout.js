import { useState, useEffect } from 'react'

/**
 * Records "the server just refused this module", so the route gate can show the
 * upgrade screen instead of the page that got the 402.
 *
 * ## Why this exists
 *
 * The gate decides from the client's cached entitlement, which can be up to a
 * minute behind the server. In that window the gate lets the page mount, the
 * page requests its data, and the server answers 402 - so the user saw a red
 * "System Error" toast reading the raw server text
 *
 *     accounting_periods is not included in your plan. Upgrade to add it.
 *
 * instead of the upgrade screen that was designed for exactly this.
 *
 * Revalidating on every navigation would close the window but put a request in
 * front of every page load, and it would still not help a plan changed while the
 * user sits on the page. Reading the answer off the response that was already
 * sent closes the window completely, for every page, without touching any page's
 * own error handling - which matters because each one formats the error
 * differently and most throw away the status and code.
 *
 * A lockout expires on its own so a plan upgrade does not leave the user stuck on
 * an upgrade screen: refreshing past the window re-checks with the server.
 */

const LOCKOUT_TTL_MS = 60 * 1000

/** @type {{ module: string, at: number } | null} */
let lockout = null
const listeners = new Set()

const emit = () => {
  for (const fn of listeners) {
    try {
      fn(lockout)
    } catch {
      // A subscriber must not be able to break the others.
    }
  }
}

/**
 * Record that the server refused a module.
 *
 * @param {string} moduleCode
 */
export const reportModuleLockout = (moduleCode) => {
  if (!moduleCode) return
  lockout = { module: String(moduleCode), at: Date.now() }
  emit()
}

/** Clear the recorded lockout, e.g. after a plan change. */
export const clearModuleLockout = () => {
  if (!lockout) return
  lockout = null
  emit()
}

/**
 * Whether a lockout is currently recorded for this module.
 *
 * Expiry is checked here rather than with a timer so an abandoned tab does not
 * keep a subscriber alive, and so the value is always evaluated fresh.
 *
 * @param {string} moduleCode
 * @param {number} [now]
 */
export const isModuleLockedOut = (moduleCode, now = Date.now()) => {
  if (!lockout || lockout.module !== String(moduleCode)) return false
  return now - lockout.at <= LOCKOUT_TTL_MS
}

/** Subscribe to lockout changes. Returns an unsubscribe function. */
export const subscribeToModuleLockout = (fn) => {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/**
 * React binding: true while a lockout is recorded for this module.
 *
 * Expiry is re-checked on a timer rather than only on notification, so a lockout
 * that lapses while the tab sits idle still clears on its own. Without it the
 * user would be stranded on the upgrade screen after subscribing.
 */
export const useModuleLockout = (moduleCode) => {
  const [locked, setLocked] = useState(() => isModuleLockedOut(moduleCode))

  useEffect(() => {
    if (!moduleCode) return undefined
    const sync = () => setLocked(isModuleLockedOut(moduleCode))
    sync()
    const unsubscribe = subscribeToModuleLockout(sync)
    const timer = setInterval(sync, Math.max(5000, Math.floor(LOCKOUT_TTL_MS / 4)))
    return () => {
      unsubscribe()
      clearInterval(timer)
    }
  }, [moduleCode])

  return locked
}

/** Test seam: the raw current record, or null. */
export const currentLockout = () => lockout

export { LOCKOUT_TTL_MS }