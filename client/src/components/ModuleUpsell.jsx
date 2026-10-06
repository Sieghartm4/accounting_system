import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Lock,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  ShieldCheck,
  CreditCard,
  Users,
  LayoutGrid,
} from 'lucide-react'
import { ROUTE_CONFIG } from '../utils/routeProtection'
import { fetchWithAuth } from '../utils/api'

/**
 * Display name for a module code, from the same registry the nav uses.
 *
 * Static import rather than a lazy require: this is a plain util module with no
 * dependency on this component, so there is no cycle to avoid. A registry entry
 * that is missing or malformed must not take the upgrade screen down, so the
 * raw code is the fallback.
 */
const labelFor = (code) => ROUTE_CONFIG[code]?.label || code

const CATALOG_KEY = 'auth_module_catalog'

/** Cached catalog for this tab, or null. */
const readCatalogCache = () => {
  try {
    const raw = sessionStorage.getItem(CATALOG_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    // Unreadable entry: treated as absent so the fetch runs.
    return null
  }
}

const writeCatalogCache = (data) => {
  try {
    sessionStorage.setItem(CATALOG_KEY, JSON.stringify(data))
  } catch {
    // Storage unavailable (private mode, quota). The in-memory copy suffices.
  }
}

/**
 * The module catalog, fetched on demand and cached for the tab.
 *
 * Loaded here rather than passed in so the component works standalone: a caller
 * only has to supply a module code. The screen degrades to a plan-only layout if
 * the fetch fails, because the upgrade call to action must never depend on a
 * cosmetic list.
 */
const useCatalog = (provided) => {
  // Seeded from the cache during initialisation rather than in an effect, so a
  // cached catalog renders on the first pass instead of arriving a tick later.
  const [catalog, setCatalog] = useState(() => provided || readCatalogCache())

  useEffect(() => {
    // A caller-supplied catalog wins, and its presence means there is nothing to
    // fetch. Resolved during render below rather than by copying it into state,
    // which would be a synchronous setState inside this effect.
    if (provided || catalog) return

    let cancelled = false
    fetchWithAuth('/entitlement/module-catalog')
      .then((r) => r.json())
      .then((payload) => {
        if (cancelled || !payload?.success) return
        setCatalog(payload.data)
        writeCatalogCache(payload.data)
      })
      .catch(() => {
        // No catalog: the screen still explains the lock and offers the upgrade,
        // so a failure here must not block the call to action.
      })

    return () => {
      cancelled = true
    }
  }, [provided, catalog])

  return provided || catalog
}

/**
 * Friendly, actionable screen shown instead of a module page the tenant's plan
 * does not include.
 *
 * Replaces what used to happen: the page mounted, fired its requests, got a 402,
 * and surfaced a red "System Error" toast reading "accounting_periods is not
 * included in your plan. Upgrade to add it." That was a raw module code, an
 * accusation, and no way forward - the user still had to guess where to go.
 *
 * This component is generic on purpose. It takes a module code and whatever
 * entitlement detail is known, and resolves the rest from the registry, so any
 * page can render it without knowing anything about subscriptions:
 *
 *   <ModuleUpsell moduleCode="accounting_periods" />
 *
 * Props:
 *   moduleCode  - the locked module, e.g. 'accounting_periods'
 *   entitlement - optional; plan name/status/expiry so the screen can be specific
 *   catalog    - optional; the module catalog, to list what an upgrade adds
 *   onUpgrade   - optional; override the destination (defaults to the plan page)
 *   variant     - 'page' (default, centred card) or 'inline' (fills a panel)
 */

const ModuleUpsell = ({
  moduleCode,
  entitlement = null,
  catalog = null,
  onUpgrade = null,
  variant = 'page',
}) => {
  const navigate = useNavigate()
  const resolvedCatalog = useCatalog(catalog)

  // The component must work from the module code alone, because the server's
  // 402 body carries the code and nothing else.
  const label = labelFor(moduleCode)

  const planName = entitlement?.planName || entitlement?.planCode || null
  const status = entitlement?.status || null
  const maxUsers = entitlement?.maxUsers || 0

  const goToPlans = () => {
    if (typeof onUpgrade === 'function') return onUpgrade()
    // The plan picker is where the existing subscribe flow already lives.
    return navigate('/register?step=plan')
  }

  // What an upgrade would add. Derived from the catalog's default-on set minus
  // what this tenant already has, so the list reflects real modules rather than
  // generic marketing copy.
  const alreadyHas = Array.isArray(entitlement?.modules) ? entitlement.modules : []
  const upgradeAdds = Array.isArray(resolvedCatalog?.defaultOn)
    ? resolvedCatalog.defaultOn.filter((m) => !alreadyHas.includes(m))
    : []

  const statusNote = (() => {
    if (status === 'trial') return 'Your trial is active.'
    if (status === 'expired') return 'Your subscription has expired.'
    if (status === 'past_due') return 'Payment is past due.'
    if (status === 'cancelled') return 'Your subscription was cancelled.'
    return null
  })()

  const benefits = [
    { icon: Sparkles, text: 'Add modules to your current plan, no data migration needed' },
    { icon: ShieldCheck, text: 'Your existing records and users stay exactly as they are' },
    maxUsers > 0
      ? { icon: Users, text: `Plan for up to ${maxUsers} user${maxUsers === 1 ? '' : 's'}` }
      : null,
    { icon: CreditCard, text: 'Change plan and come straight back to this page' },
  ].filter(Boolean)

  const wrapper =
    variant === 'inline'
      ? 'w-full h-full flex items-center justify-center p-6'
      : 'min-h-[70vh] w-full flex items-center justify-center p-6'

  return (
    <div className={wrapper}>
      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-[0_24px_70px_-20px_rgba(15,23,42,0.28)] border border-slate-200 overflow-hidden">
        {/* Accent band */}
        <div className="h-1.5 w-full bg-gradient-to-r from-slate-700 via-slate-800 to-slate-900" />

        <div className="p-8 sm:p-10">
          {/* Icon */}
          <div className="flex items-start gap-5">
            <div className="shrink-0 w-14 h-14 rounded-2xl bg-slate-900 text-white flex items-center justify-center shadow-lg shadow-slate-900/20">
              <Lock size={26} />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[2px] text-amber-600">
                <span>Not in your plan</span>
              </div>
              <h1 className="mt-1.5 text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                {label} isn&rsquo;t included
              </h1>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                Your current plan doesn&rsquo;t include{' '}
                <span className="font-semibold text-slate-800">{label}</span>. Upgrade to a
                plan that does and this page will open straight away.
              </p>
            </div>
          </div>

          {/* Current plan context */}
          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <LayoutGrid size={16} className="text-slate-500 shrink-0" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Current plan
                </span>
                <span className="text-sm font-black text-slate-900 truncate">
                  {planName || 'No active plan'}
                </span>
              </div>
              {statusNote && (
                <span className="shrink-0 text-xs font-semibold text-amber-700 bg-amber-100 px-2.5 py-1 rounded-full">
                  {statusNote}
                </span>
              )}
            </div>
          </div>

          {/* What upgrading adds */}
          {upgradeAdds.length > 0 && (
            <div className="mt-6">
              <h2 className="text-xs font-black uppercase tracking-[2px] text-slate-400">
                Modules an upgrade can add
              </h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {upgradeAdds.map((m) => (
                  <ModuleChip key={m} code={m} />
                ))}
              </div>
            </div>
          )}

          {/* Reassurance */}
          <ul className="mt-6 space-y-2.5">
            {benefits.map((b, i) => {
              const Icon = b.icon
              return (
                <li key={i} className="flex items-start gap-2.5 text-sm text-slate-600">
                  <Icon size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                  <span>{b.text}</span>
                </li>
              )
            })}
          </ul>

          {/* Actions */}
          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={goToPlans}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-6 py-3 text-sm font-black text-white shadow-lg shadow-slate-900/20 transition hover:bg-slate-800 focus:outline-none focus:ring-4 focus:ring-slate-900/20"
            >
              See plans and upgrade
              <ArrowRight size={16} />
            </button>

            <button
              type="button"
              onClick={() => navigate(-1)}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-6 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-slate-200"
            >
              Go back
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/** A single module in the "upgrade adds" list, labelled from the registry. */
const ModuleChip = ({ code }) => {
  const label = labelFor(code)
  return (
    <span className="inline-flex items-center gap-1.5 rounded-lg border border-emlate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700">
      <CheckCircle2 size={13} className="text-emerald-600" />
      {label}
    </span>
  )
}

export default ModuleUpsell
