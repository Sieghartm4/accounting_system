import React, { useState } from 'react'
import DynamicToast from '../../components/DynamicToast'
import {
  AlertCircle,
  AlertTriangle,
  ArrowUpRight,
  BadgePercent,
  Building2,
  CalendarClock,
  Calculator,
  CheckCircle2,
  ChevronDown,
  Download,
  FileCheck2,
  FolderOpen,
  IdCard,
  Info,
  ListChecks,
  Loader2,
  Percent,
  ReceiptText,
  Save,
  ShieldCheck,
  Wallet,
} from 'lucide-react'
import LoadingScreen from '../../components/LoadingScreen'
import ProtectedAction from '../../components/ProtectedAction'
import useTaxRegistry from './useTaxRegistry'

/**
 * Registry-driven BIR tax page.
 *
 * There is no form list in this file. Every form shown comes from
 * GET /tax/registry, and each form's header fields, line layout, filing
 * frequency and deadline come from its registry entry — so adding a form to the
 * catalogue makes it appear here with no client change.
 *
 * The company is chosen explicitly in the header. It used to default to
 * company 1, which filed every tenant's returns against the same company.
 */

// A failed render must never leave the page spinning. React logs an error for
// a throw inside render and remounts, so any unguarded read here produced a
// loading-screen loop instead of a visible failure.
class Boundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { message: null }
  }

  static getDerivedStateFromError(err) {
    return { message: err?.message || 'This page failed to render.' }
  }

  render() {
    if (this.state.message) {
      return (
        <div className="h-full flex items-center justify-center bg-[#f4f5f7] p-6">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 max-w-lg">
            <h2 className="font-black uppercase tracking-wide text-red-600 text-sm flex items-center gap-2">
              <AlertCircle size={16} />
              Tax page could not render
            </h2>
            <p className="text-[13px] font-medium text-gray-600 mt-2">{this.state.message}</p>
            <button
              onClick={() => this.setState({ message: null })}
              className="mt-4 text-[10px] font-black uppercase tracking-widest px-3 py-2 rounded-lg bg-black text-white hover:bg-red-600 transition-colors"
            >
              Try again
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

const STATUS_STYLE = {
  applicable: 'ring-1 ring-gray-200 bg-gray-50 text-black',
  conflict: 'ring-1 ring-amber-200 bg-amber-50 text-amber-800',
  not_applicable: 'ring-1 ring-gray-200 bg-gray-100 text-gray-400',
}

const FILING_STATUS_STYLE = {
  draft: 'ring-1 ring-gray-200 bg-gray-100 text-gray-600',
  computed: 'ring-1 ring-red-200 bg-red-50 text-red-700',
  acknowledged: 'ring-1 ring-gray-200 bg-gray-50 text-black',
  filed: 'ring-1 ring-gray-900 bg-black text-white',
  filed_with_bir: 'ring-1 ring-gray-900 bg-black text-white',
  rejected: 'ring-1 ring-red-200 bg-red-50 text-red-700',
  superseded: 'ring-1 ring-gray-200 bg-gray-100 text-gray-400',
}

const CATEGORY_ORDER = [
  'VAT',
  'Withholding',
  'Income Tax',
  'Certificate',
  'Supporting Schedule',
]

/** Category glyphs, so each sidebar group is recognisable without reading it. */
const CATEGORY_ICON = {
  VAT: Percent,
  Withholding: Wallet,
  'Income Tax': ReceiptText,
  Certificate: BadgePercent,
  'Supporting Schedule': ListChecks,
}

/** Which workspace tab a form's supporting panels belong under. */
const TAB_IDS = ['computation', 'profile', 'deadlines', 'filings']

/**
 * The tax form registry sidebar.
 *
 * Every entry comes from GET /tax/registry, grouped by the category the server
 * assigns. The filter matches on form code or title, because a user looking for
 * a return knows "2550M" or "withholding" and rarely the exact wording of the
 * catalogue's short title.
 */
const RegistrySidebar = ({ byCategory, totalForms, activeForm, onSelect, resultByForm }) => {
  const [filter, setFilter] = useState('')
  const term = filter.trim().toLowerCase()

  const matches = (form) =>
    !term ||
    form.form_code.toLowerCase().includes(term) ||
    (form.short_title || '').toLowerCase().includes(term)

  const groups = byCategory
    .map(({ cat, forms }) => ({ cat, forms: forms.filter(matches) }))
    .filter((g) => g.forms.length > 0)

  return (
    <aside className="w-72 shrink-0 flex flex-col overflow-hidden bg-white border-r border-slate-200">
      <div className="p-3 border-b border-slate-200 bg-slate-50">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Tax Form Registry
          </h2>
          <span className="text-[10px] bg-zinc-200 text-zinc-700 px-2 py-0.5 rounded font-mono font-medium">
            {totalForms} Forms
          </span>
        </div>
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter by code or title..."
          className="w-full bg-white border border-slate-200 rounded px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-brand-red focus:ring-1 focus:ring-brand-red"
        />
      </div>

      <nav className="flex-1 overflow-y-auto p-3 space-y-4 tax-scroll">
        {groups.length === 0 && (
          <p className="text-xs text-slate-400 px-2 py-4 text-center">No form matches “{filter}”.</p>
        )}

        {groups.map(({ cat, forms }) => {
          const Icon = CATEGORY_ICON[cat] || ListChecks
          return (
            <div key={cat}>
              <div className="flex items-center justify-between px-2 py-1 bg-zinc-900 text-white rounded text-[11px] font-bold tracking-wider uppercase border-l-4 border-brand-red">
                <span className="flex items-center gap-1.5">
                  <Icon size={11} className="text-brand-red" />
                  {cat}
                </span>
                <span className="text-[10px] opacity-70 font-normal">
                  {forms.length} {forms.length === 1 ? 'item' : 'items'}
                </span>
              </div>

              <div className="space-y-0.5 mt-1">
                {forms.map((f) => {
                  const isActive = activeForm === f.form_code
                  const status = resultByForm.get(f.form_code)?.status ?? 'not_applicable'
                  return (
                    <button
                      key={f.form_code}
                      onClick={() => onSelect(f.form_code)}
                      title={f.short_title}
                      className={`w-full text-left px-3 py-2 rounded text-xs flex items-center justify-between transition ${
                        isActive
                          ? 'bg-brand-red text-white shadow-md font-medium'
                          : 'hover:bg-slate-100 text-slate-600'
                      }`}
                    >
                      <span className="truncate pr-1">
                        <span
                          className={`font-mono font-bold mr-2 ${
                            isActive ? 'text-white' : 'text-brand-red'
                          }`}
                        >
                          {f.form_code}
                        </span>
                        <span className={isActive ? 'text-white' : ''}>{f.short_title}</span>
                      </span>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded font-mono shrink-0 ${
                          isActive
                            ? 'bg-black/30 text-white uppercase'
                            : 'bg-slate-100 text-slate-400'
                        }`}
                      >
                        {isActive ? 'Active' : status === 'not_applicable' ? 'N/A' : status}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </nav>
    </aside>
  )
}

/**
 * The strip above the workspace.
 *
 * It answers one question at a glance: why are these the numbers I am looking
 * at? A form that does not apply, a profile fact that is still unconfirmed and
 * a stale computation all look like a normal return otherwise, and the user has
 * to read the whole form to find out which one they are looking at.
 */
const StatusBanner = ({ formDetail, status, reason, conflict, preview, gapCount }) => {
  let tone = 'ready'
  let message = preview
    ? `Displaying the computed figures for BIR Form ${formDetail?.form_code}. Every amount links to the ledger lines it was summed from.`
    : `Displaying tax compliance requirements and rules for Form ${formDetail?.form_code}. Choose a period and compute to fill the return.`
  let pill = preview ? 'Computed' : 'No computation yet'
  let Icon = Info

  if (status === 'not_applicable') {
    tone = 'muted'
    Icon = AlertCircle
    pill = 'Not applicable'
    message = `This form does not apply to the selected company: ${reason || 'no reason given'}. It stays viewable for reference.`
  } else if (status === 'conflict') {
    tone = 'warn'
    Icon = AlertTriangle
    pill = 'Conflict'
    message = [reason, conflict].filter(Boolean).join('. ') || 'The profile contradicts this form.'
  } else if (gapCount > 0) {
    tone = 'warn'
    Icon = AlertTriangle
    pill = `${gapCount} open item${gapCount === 1 ? '' : 's'}`
    message = `${gapCount} fact${gapCount === 1 ? '' : 's'} behind these figures could not be confirmed from the ledger. They are listed under the form.`
  }

  const pillTone = {
    ready: 'bg-zinc-800 text-zinc-300 border-zinc-700',
    warn: 'bg-amber-500/15 text-amber-300 border-amber-500/40',
    muted: 'bg-zinc-800 text-zinc-400 border-zinc-700',
  }[tone]

  return (
    <div className="bg-gradient-to-r from-zinc-900 via-zinc-900 to-black text-white rounded-xl p-4 shadow-md border-l-4 border-brand-red flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
      <div className="flex items-start gap-3">
        <div className="p-2 bg-brand-red/20 text-brand-red rounded-lg">
          <Icon size={16} />
        </div>
        <div>
          <h3 className="text-xs font-bold text-white tracking-wide uppercase">Form Status Notice</h3>
          <p className="text-xs text-zinc-300 mt-0.5">{message}</p>
        </div>
      </div>
      <span
        className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold border shrink-0 ${pillTone}`}
      >
        <span
          className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
            tone === 'warn' ? 'bg-amber-400' : 'bg-brand-red'
          } ${preview && tone === 'ready' ? '' : 'animate-pulse'}`}
        />
        {pill}
      </span>
    </div>
  )
}

/**
 * The prompt a first-time user actually needs.
 *
 * Until the taxpayer profile names the taxpayer type and the VAT/income-tax
 * positions, every form reads "not applicable" and the registry looks empty of
 * work. That is honest — the engine will not recommend a return on a guess —
 * but it leaves a new user on a dead form with no idea why. This says what is
 * missing and offers the one click that fixes it.
 */
const ProfilePrompt = ({ missing, onOpen }) => {
  if (!missing || missing.length === 0) return null
  return (
    <div className="bg-amber-50 border border-amber-300 border-l-4 border-l-amber-500 rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
      <div className="flex items-start gap-2.5 min-w-0">
        <AlertTriangle size={16} className="shrink-0 mt-0.5 text-amber-600" />
        <div className="min-w-0">
          <p className="text-[12px] font-black text-amber-900">
            Finish the taxpayer profile to see which returns apply
          </p>
          <p className="text-[12px] font-medium text-amber-800 mt-0.5">
            Still unknown: <strong>{missing.join(', ')}</strong>. Until these are
            confirmed, every form reads “not applicable” — nothing here says you
            have no obligations, it says nobody has told the system what you are.
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onOpen}
        className="shrink-0 self-start sm:self-auto text-[10px] font-black uppercase tracking-widest px-3 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white transition-colors"
      >
        Complete profile
      </button>
    </div>
  )
}

/**
 * A panel that folds away to a single header line.
 *
 * A 2550 return is read against the figures in the middle of the page. The
 * profile and deadline panels sit below it and are needed occasionally, not
 * every time, and left open they pushed the return itself below the fold. They
 * default to closed and show whatever summary is worth knowing at a glance -
 * how many profile fields are still blank, how many returns are due - so the
 * thing that justifies opening them is visible without opening them.
 */
const CollapsiblePanel = ({ title, icon, summary, defaultOpen = false, children }) => {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="w-full flex items-center gap-2 px-5 py-2 bg-black border-l-4 border-red-600 text-left hover:bg-gray-900 transition-colors"
      >
        {React.createElement(icon, { size: 13, className: 'text-red-600 shrink-0' })}
        <span className="text-[10px] font-black uppercase tracking-[3px] text-white">{title}</span>
        {!open && summary && (
          <span className="text-[10px] font-bold text-gray-500 truncate ml-1">{summary}</span>
        )}
        <ChevronDown
          size={15}
          className={`ml-auto shrink-0 text-gray-500 transition-transform ${open ? '' : '-rotate-90'}`}
        />
      </button>
      {open && <div className="p-5">{children}</div>}
    </div>
  )
}

const ProfilePanel = ({ profile, applicability, onSave, busy, defaultOpen = false }) => {
  const [draft, setDraft] = useState(null)
  const p = draft || profile || {}
  const set = (k) => (e) => setDraft({ ...p, [k]: e.target.value })

  const missing = applicability?.missing_profile_facts ?? []
  const summary = missing.length > 0 ? `${missing.length} field(s) still unknown` : 'complete'

  return (
    <CollapsiblePanel title="Taxpayer profile" icon={IdCard} summary={summary} defaultOpen={defaultOpen}>
      <div className="flex items-center justify-end mb-3">
        <ProtectedAction routeName="tax_compliance" fallback={null}>
          <button
            onClick={() => onSave(draft || profile)}
            disabled={busy}
            className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg bg-red-600 text-white hover:bg-black disabled:opacity-50 transition-colors"
          >
            <Save size={13} />
            Save profile
          </button>
        </ProtectedAction>
      </div>

      <div className="space-y-4">
        {missing.length > 0 && (
          <p className="text-[12px] font-medium bg-amber-50 text-amber-900 border-l-4 border-amber-500 rounded-r-lg px-3 py-2">
            Still unknown: <strong>{missing.join(', ')}</strong>. Forms that depend on these stay
            unclassified until you confirm them.
          </p>
        )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {[
          ['tin', 'TIN', 'text'],
          ['legal_name', 'Registered name', 'text'],
          ['rdo_code', 'RDO code', 'text'],
          ['taxpayer_type', 'Taxpayer type', 'text'],
          ['registered_address', 'Registered address', 'text'],
        ].map(([key, label, type]) => (
          <label key={key} className="block">
            <span className="text-[9px] font-black uppercase tracking-[2px] text-gray-400">
              {label}
            </span>
            <input
              type={type}
              value={p[key] ?? ''}
              onChange={set(key)}
              placeholder="not set"
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-[13px] font-bold text-black focus:outline-none focus:border-red-600 focus:ring-2 focus:ring-red-600/20"
            />
          </label>
        ))}

        {[
          ['vat_registered', 'VAT registered'],
          ['subject_to_income_tax', 'Subject to income tax'],
          ['ewt_remitter', 'EWT remitter'],
        ].map(([key, label]) => (
          <label key={key} className="flex items-center gap-2 text-[13px] font-bold text-gray-800">
            <input
              type="checkbox"
              checked={p[key] === true}
              onChange={(e) => setDraft({ ...p, [key]: e.target.checked })}
              className="rounded border-gray-300 accent-red-600"
            />
            {label}
          </label>
        ))}
      </div>

      {applicability?.conflicts?.length > 0 && (
          <div className="space-y-2">
            {applicability.conflicts.map((c) => (
              <p
                key={c.id}
                className="text-[12px] font-medium bg-amber-50 text-amber-900 border-l-4 border-amber-500 rounded-r-lg px-3 py-2 flex gap-2"
              >
                <AlertTriangle size={15} className="shrink-0 mt-0.5 text-amber-600" />
                <span>{c.message}</span>
              </p>
            ))}
          </div>
        )}
      </div>
    </CollapsiblePanel>
  )
}

const DeadlinesPanel = ({ deadlines, defaultOpen = false }) => {
  const rows = deadlines?.deadlines ?? []
  if (rows.length === 0) return null

  const soonest = [...rows].sort(
    (a, b) => new Date(a.deadline.due_date || 0) - new Date(b.deadline.due_date || 0),
  )[0]
  const summary = soonest
    ? `${rows.length} due · next ${soonest.form_code} ${soonest.deadline.due_label}`
    : `${rows.length} due`

  return (
    <CollapsiblePanel title="Filing deadlines" icon={CalendarClock} summary={summary} defaultOpen={defaultOpen}>
      <p className="text-[10px] font-black uppercase tracking-[2px] text-gray-400 mb-2">
        for {deadlines?.year}
        {deadlines?.month ? `, month ${deadlines.month}` : ''}
      </p>
      <div>
        {rows.map((d) => (
          <div
            key={d.form_code}
            className="flex items-center justify-between py-1.5 px-2 -mx-2 rounded border-b border-gray-100 last:border-0 hover:bg-red-50 transition-colors"
          >
            <div className="flex items-baseline gap-1.5 min-w-0">
              <span className="font-mono text-[11px] font-bold text-gray-400">
                {d.form_code}
              </span>
              <span className="text-[12px] font-bold text-black truncate">{d.short_title}</span>
              <span className="text-[9px] font-black uppercase tracking-widest text-gray-400">
                {d.period_label}
              </span>
            </div>
            <div className="text-right shrink-0">
              <div className="text-[12px] font-black text-red-600 leading-tight">
                {d.deadline.due_label}
              </div>
              {(() => {
                // A date that has already passed is the one thing on this panel
                // that demands action, so it is called out rather than left to
                // be inferred from the date. Computed against the start of the
                // day so a return due today is not flagged as missed.
                const due = new Date(`${d.deadline.due_date}T00:00:00`)
                if (Number.isNaN(due.getTime())) return null
                const today = new Date()
                today.setHours(0, 0, 0, 0)
                const days = Math.round((due - today) / 86400000)
                if (days > 0) {
                  return (
                    <div className="text-[9px] font-black uppercase tracking-widest text-gray-400">
                      in {days} day{days === 1 ? '' : 's'}
                    </div>
                  )
                }
                return (
                  <div className="text-[9px] font-black uppercase tracking-widest text-red-700">
                    {days === 0 ? 'due today' : `${Math.abs(days)} days overdue`}
                  </div>
                )
              })()}
              {d.deadline.grace_applied && (
                <div className="text-[9px] font-black uppercase tracking-widest text-gray-400">
                  grace rule applied
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </CollapsiblePanel>
  )
}

const FormViewer = ({
  formDetail,
  layout,
  preview,
  inputs,
  setInputs,
  readOnly,
  formatPHP,
}) => {
  const values = preview?.result?.lines ?? {}
  const gapKeys = new Set((preview?.result?.gaps ?? []).map((g) => g.key))
  const period = preview?.period ?? null

  /**
   * Drill-down target for a printed figure.
   *
   * The server records, per fact path, the chart-of-accounts codes the figure
   * was summed from, so the taxpayer can open the exact ledger lines behind
   * the number rather than taking it on trust. The period travels with the
   * link: a 2550 figure is the reduction over one period, and a general ledger
   * showing every year would not answer "where did this come from".
   */
  const ledgerHref = (accountCode) => {
    const params = new URLSearchParams()
    if (accountCode) params.set('account_code', accountCode)
    // resolvePeriod() names the bounds `start`/`end`; a saved filing names them
    // `period_start`/`period_end`. Accepting only the query-shaped names silently
    // dropped the period, leaving a link to the whole history instead of the
    // month being filed.
    const start = period?.start ?? period?.period_start ?? period?.start_date
    const end = period?.end ?? period?.period_end ?? period?.end_date
    if (start) params.set('start_date', start)
    if (end) params.set('end_date', end)
    return `/general-ledger?${params.toString()}`
  }

  // Resolved by the same dotted path the catalogue stores as `source`, so a
  // line finds its own provenance without a second mapping table.
  const traceFor = (source) => preview?.result?.trace?.[source] ?? null

  /**
   * Where clicking a figure should land.
   *
   * A Trial Balance row is always one account, so its amount can name an
   * account outright. A 2550 line is often a reduction across several — output
   * tax across a liability account, vatable sales across every revenue account
   * carrying a vatable code. Narrowing to the first of those would hide the
   * rest and quietly understate the figure, so a multi-account line opens the
   * period unfiltered and the account chips below break it down. Debit/credit
   * is deliberately not passed: the offsetting entry that explains an
   * adjustment is exactly what a taxpayer needs to see, and a type filter
   * would hide it.
   */
  const figureHref = (accounts) =>
    ledgerHref(accounts.length === 1 ? accounts[0].code : null)

  const figureTitle = (accounts) =>
    accounts.length === 1
      ? `View ${accounts[0].code} ${accounts[0].name} in the general ledger`
      : `View the ${accounts.length} accounts behind this figure in the general ledger`

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-2 bg-black border-b border-gray-100">
        <FileCheck2 size={13} className="text-red-600" />
        <span className="font-mono text-[11px] font-black text-white">{formDetail.form_code}</span>
        <span className="text-[11px] font-black uppercase tracking-[3px] text-white truncate">
          {formDetail.short_title || formDetail.title}
        </span>
        <span className="text-[10px] font-bold text-gray-500 ml-1 hidden sm:inline">
          {String(formDetail.frequency || '').toLowerCase()} · rev {formDetail.form_revision}
        </span>
        {preview?.period && (
          <span className="ml-auto text-[10px] font-black uppercase tracking-widest px-2 py-0.5 bg-red-600 text-white rounded-md whitespace-nowrap">
            {preview.period.label} · {preview.period.start} → {preview.period.end}
          </span>
        )}
      </div>

      {layout.headerFields.length > 0 && (
        <div className="px-5 py-2.5 bg-gray-50 border-b border-gray-100">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-x-4 gap-y-1.5">
            {layout.headerFields.map((f) => (
              <div key={f.key} className="flex items-baseline gap-1.5 min-w-0">
                <span className="text-[9px] font-black uppercase tracking-[1.5px] text-gray-400 whitespace-nowrap">
                  {f.label}
                </span>
                <span className="text-[12px] font-bold text-black truncate">
                  {formDetail[f.key] ?? formDetail.header_values?.[f.key] ?? '—'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        {layout.sections.map((section) => (
          <div key={section.name}>
            <div className="flex items-center gap-2 px-5 py-1.5 bg-black border-l-4 border-red-600">
              <span className="text-[10px] font-black uppercase tracking-[3px] text-white">
                Section {section.name}
              </span>
            </div>
            {section.lines.map((line) => {
              const value = values[line.key]
              const editable = line.kind === 'input' && !readOnly
              const trace = traceFor(line.source)
              const accounts = trace?.accounts ?? []
              const hasValue = value !== undefined && value !== null
              // A figure is only drillable when it was actually produced. A
              // zero bucket with no ledger lines behind it gets no link, and a
              // line the server sent no value for gets neither a link nor the
              // account chips, which would otherwise advertise figures that
              // are not on the form.
              const linkable = hasValue && !editable && accounts.length > 0
              return (
                <div
                  key={line.key}
                  title={line.source ? `Computed from ${line.source}` : undefined}
                  className={`px-5 py-1.5 flex items-center justify-between gap-4 border-b border-gray-100 leading-tight transition-colors ${
                    line.emphasis ? 'bg-gray-50 hover:bg-gray-100' : 'hover:bg-red-50'
                  }`}
                >
                  <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
                    <span
                      className={`text-[12px] font-bold ${line.emphasis ? 'text-black' : 'text-gray-800'}`}
                    >
                      {line.label}
                    </span>
                    {linkable && accounts.length > 1 && (
                      <span className="flex flex-wrap items-center gap-0.5">
                        {accounts.map((account) => (
                          <a
                            key={account.code}
                            href={ledgerHref(account.code)}
                            title={`View ${account.code} ${account.name} in the general ledger`}
                            className="inline-flex items-center gap-0.5 rounded-sm border border-gray-200 bg-white px-1 py-px font-mono text-[9px] font-bold text-gray-400 no-underline leading-tight hover:border-red-600 hover:text-red-600"
                          >
                            {account.code}
                            <ArrowUpRight size={8} className="text-gray-300" />
                          </a>
                        ))}
                      </span>
                    )}
                    {line.gap_key && gapKeys.has(line.gap_key) && (
                      <span className="inline-block px-1.5 py-px bg-amber-100 text-amber-800 text-[9px] font-black uppercase tracking-widest rounded">
                        needs a fact
                      </span>
                    )}
                  </div>
                  <div className="w-32 shrink-0 text-right">
                    {editable ? (
                      <input
                        type="number"
                        step="0.01"
                        value={inputs[line.key] ?? ''}
                        placeholder="0.00"
                        onChange={(e) =>
                          setInputs({
                            ...inputs,
                            [line.key]: e.target.value === '' ? '' : Number(e.target.value),
                          })
                        }
                        className="w-full rounded-md border border-gray-200 px-1.5 py-1 text-right font-mono text-[13px] font-black text-black focus:outline-none focus:ring-2 focus:ring-red-600/30 focus:border-red-600"
                      />
                    ) : linkable ? (
                      <a
                        href={figureHref(accounts)}
                        title={figureTitle(accounts)}
                        className={`group inline-flex items-center justify-end gap-1 rounded px-1.5 py-0.5 font-mono text-[13px] font-black no-underline leading-tight hover:bg-red-50 hover:text-red-600 hover:underline transition-colors ${
                          line.emphasis ? 'text-red-600' : 'text-black'
                        }`}
                      >
                        {formatPHP(value)}
                        <ArrowUpRight
                          size={10}
                          className="text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                        />
                      </a>
                    ) : (
                      <span
                        className={`font-mono text-[13px] font-black leading-tight ${
                          hasValue
                            ? line.emphasis
                              ? 'text-red-600'
                              : 'text-black'
                            : 'text-gray-200'
                        }`}
                      >
                        {hasValue ? formatPHP(value) : '—'}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ))}
      </div>

      {preview?.result?.totals && (
        <div className="border-t-4 border-red-600 bg-black px-5 py-2.5 flex flex-wrap gap-x-8 gap-y-1">
          {Object.entries(preview.result.totals).map(([k, v]) => (
            <div key={k} className="flex items-baseline gap-2">
              <span className="text-[9px] font-black uppercase tracking-[2px] text-gray-500">
                {k.replace(/_/g, ' ')}
              </span>
              <span className="font-mono text-[15px] font-black text-white leading-tight">
                {formatPHP(v)}
              </span>
            </div>
          ))}
        </div>
      )}

      {preview?.result?.gaps?.length > 0 && (
        <div className="px-5 py-2.5 bg-gray-50 border-t border-gray-100 space-y-1.5">
          <h4 className="text-[10px] font-black uppercase tracking-[3px] text-gray-400">Open items</h4>
          {preview.result.gaps.map((g) => (
            <p
              key={g.key}
              className={`text-[11px] font-medium rounded px-2.5 py-1.5 border-l-4 ${
                g.severity === 'info'
                  ? 'bg-white text-gray-600 border-gray-300'
                  : 'bg-amber-50 text-amber-900 border-amber-500'
              }`}
            >
              {g.message}
            </p>
          ))}
        </div>
      )}

      {layout.notes && (
        <p className="px-5 py-2 bg-gray-50 border-t border-gray-100 text-[11px font-medium text-gray-500 flex gap-2">
          <Info size={13} className="shrink-0 mt-0.5 text-red-600" />
          <span>{layout.notes}</span>
        </p>
      )}
    </div>
  )
}

const FilingsPanel = ({
  filings,
  filingsActive,
  onAcknowledge,
  onMarkFiled,
  busy,
  monthDay,
  formatPHP,
}) => {
  const [note, setNote] = useState('')

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-2 bg-black border-l-4 border-red-600">
        <FileCheck2 size={14} className="text-red-600" />
        <span className="text-[11px] font-black uppercase tracking-[3px] text-white truncate">
          Filings for {formCodeOf(filingsActive)}
        </span>
        <span className="text-[10px] font-bold text-gray-500 ml-1">{filings.length} on record</span>
      </div>

      <div className="p-5">
        {filings.length === 0 ? (
          <p className="text-[12px] font-bold text-gray-300">No filings yet for this form.</p>
        ) : (
          <div>
            {filings.map((f) => (
              <div
                key={f.id}
                className="py-1.5 flex items-center justify-between gap-3 border-b border-gray-100 hover:bg-red-50 transition-colors"
              >
                <div className="min-w-0">
                  <div className="text-[13px] font-black text-black">{f.period_label}</div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                    {monthDay(f.period_start)} – {monthDay(f.period_end)}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[15px] font-black text-red-600">
                    {formatPHP(f.amount_still_due)}
                  </span>
                  <span
                    className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-md ${
                      FILING_STATUS_STYLE[f.status] || FILING_STATUS_STYLE.draft
                    }`}
                  >
                    {String(f.status).replace(/_/g, ' ')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

      {filingsActive && (
        <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
          <div className="text-[12px] font-medium text-gray-600">
            Filing <strong className="font-black text-black">#{filingsActive.id}</strong> —{' '}
            <span className="font-black uppercase tracking-widest text-gray-800">
              {filingsActive.status.replace(/_/g, ' ')}
            </span>
            {filingsActive.acknowledgement_note && (
              <span className="block text-[11px] text-gray-400 mt-1">
                note: {filingsActive.acknowledgement_note}
              </span>
            )}
          </div>

          {filingsActive.has_blocking_gaps && (
            <>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                placeholder="Why is this acceptable? Acknowledging records your name and note."
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-[13px] focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
              />
              <button
                onClick={() => onAcknowledge(filingsActive.id, note)}
                disabled={busy || !note.trim()}
                className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-3 py-2 rounded-lg bg-amber-500 text-white hover:bg-black disabled:opacity-50 transition-colors"
              >
                <CheckCircle2 size={13} />
                Acknowledge open items
              </button>
            </>
          )}

          {!filingsActive.has_blocking_gaps &&
            !['filed', 'filed_with_bir'].includes(filingsActive.status) && (
              <button
                onClick={() => onMarkFiled(filingsActive.id)}
                disabled={busy}
                className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-3 py-2 rounded-lg bg-black text-white hover:bg-red-600 disabled:opacity-50 transition-colors"
              >
                <FileCheck2 size={13} />
                Mark as filed with BIR
              </button>
            )}

          {['filed', 'filed_with_bir'].includes(filingsActive.status) && (
            <p className="text-[11px] font-medium text-gray-400 flex items-center gap-1.5">
              <ShieldCheck size={13} className="text-red-600" />
              Filed {monthDay(filingsActive.filed_at)}. A filed return is immutable and cannot be
              recomputed.
            </p>
          )}
        </div>
      )}
      </div>
    </div>
  )
}

const formCodeLabel = (code) => (code ? code : 'this form')

/** A filing's own form code, falling back to the page's label for no filing. */
const formCodeOf = (filing) => formCodeLabel(filing && filing.form_code)

function TaxRegistryContent() {
  const t = useTaxRegistry()
  const {
    companyId,
    companyName,
    registry,
    applicability,
    profile,
    deadlines,
    filings,
    filingDetail,
    activeForm,
    setActiveForm,
    formDetail,
    layout,
    resultByForm,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    inputs,
    setInputs,
    preview,
    loading,
    busy,
    toast,
    setToast,
    runPreview,
    saveFiling,
    refreshFiling,
    acknowledge,
    markFiled,
    saveProfile,
    exportPdf,
  } = t

  // Declared above the loading early-return: a hook that only runs once the
  // registry has landed would unmount and remount the page on every load.
  const [tab, setTab] = useState('computation')

  if (loading) return <LoadingScreen label="Loading tax registry..." />

  const forms = registry?.forms ?? []
  const byCategory = CATEGORY_ORDER.map((cat) => ({
    cat,
    forms: forms.filter((f) => f.category === cat),
  })).filter((g) => g.forms.length > 0)

  const filingsActive = filingDetail?.filing ?? null
  const filingsForForm = filings.filter((f) => f.form_code === activeForm)
  const activeResult = resultByForm.get(activeForm)
  const activeCategory =
    byCategory.find((g) => g.forms.some((f) => f.form_code === activeForm))?.cat ?? 'registry'

  return (
      <>
        {toast && (
          <DynamicToast
            type={toast.type}
            message={toast.message}
            onClose={() => setToast(null)}
          />
        )}
        <div className="flex h-full -m-4 overflow-hidden bg-slate-50">
        <RegistrySidebar
          byCategory={byCategory}
          totalForms={forms.length}
          activeForm={activeForm}
          onSelect={(code) => {
            setActiveForm(code)
            // Switching forms changes every panel below; leaving the user on the
            // deadlines tab would show one form's figures against another's dates.
            setTab('computation')
          }}
          resultByForm={resultByForm}
        />

        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* breadcrumb + form identity + the whole toolbar */}
          <div className="bg-white border-b border-slate-200 p-4 shadow-sm">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
                  <span>Tax Registry</span>
                  <ChevronDown size={10} className="-rotate-90" />
                  <span className="uppercase font-semibold text-brand-red">{activeCategory}</span>
                  <ChevronDown size={10} className="-rotate-90" />
                  <span className="font-mono font-bold text-slate-700">{activeForm}</span>
                </div>
                <h1 className="text-xl lg:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2 flex-wrap">
                  <span className="truncate">{formDetail?.short_title || formDetail?.title || '—'}</span>
                  {formDetail && (
                    <span className="text-xs font-normal bg-zinc-900 text-white px-2 py-0.5 rounded font-mono">
                      BIR FORM {formDetail.form_code}
                    </span>
                  )}
                </h1>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-2 bg-slate-100 border border-slate-200 rounded-lg px-3 py-1.5">
                  <Building2 size={12} className="text-brand-red shrink-0" />
                  <span className="text-xs font-semibold text-slate-500 uppercase">Company</span>
                  <span className="text-xs font-semibold text-slate-800">
                    {companyName || `Company ${companyId}`}
                  </span>
                </div>

                <div className="flex items-center gap-2 bg-slate-100 border border-slate-200 rounded-lg px-3 py-1.5">
                  <CalendarClock size={12} className="text-brand-red" />
                  <span className="text-xs font-semibold text-slate-500 uppercase">Period</span>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="bg-transparent text-xs font-mono font-semibold text-slate-800 focus:outline-none cursor-pointer"
                  />
                  <span className="text-xs font-semibold text-slate-400">to</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="bg-transparent text-xs font-mono font-semibold text-slate-800 focus:outline-none cursor-pointer"
                  />
                </div>

                <button
                  onClick={runPreview}
                  disabled={busy}
                  title="Recompute this form from the ledger for the chosen period"
                  className="bg-brand-red hover:bg-brand-red-hover text-white px-4 py-2 rounded-lg text-xs font-semibold shadow-md flex items-center gap-2 transition active:scale-95 disabled:opacity-50 disabled:active:scale-100"
                >
                  {busy ? <Loader2 size={12} className="animate-spin" /> : <Calculator size={12} />}
                  <span>{busy ? 'Computing' : 'Compute'}</span>
                </button>

                <ProtectedAction routeName="tax_compliance" fallback={null}>
                  <button
                    onClick={saveFiling}
                    disabled={busy}
                    className="bg-zinc-900 hover:bg-black text-white px-4 py-2 rounded-lg text-xs font-semibold shadow flex items-center gap-2 transition border border-zinc-800 disabled:opacity-50"
                  >
                    <Save size={12} />
                    <span>Save as draft</span>
                  </button>
                </ProtectedAction>

                <button
                  onClick={exportPdf}
                  disabled={busy}
                  className="bg-white text-slate-700 hover:bg-slate-100 px-3.5 py-2 rounded-lg text-xs font-semibold border border-slate-300 flex items-center gap-2 transition disabled:opacity-50"
                >
                  <Download size={12} className="text-brand-red" />
                  <span>Export PDF</span>
                </button>

                {filingsForForm.length > 0 && (
                  <select
                    value={filingsActive?.id ?? ''}
                    onChange={(e) => refreshFiling(Number(e.target.value))}
                    className="text-xs font-semibold rounded-lg border border-slate-300 bg-white px-2 py-2 text-slate-700 focus:outline-none focus:border-brand-red"
                  >
                    <option value="">View a saved filing…</option>
                    {filingsForForm.map((f) => (
                      <option key={f.id} value={f.id}>
                        #{f.id} {f.period_label} ({f.status})
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-6 tax-scroll">
            <ProfilePrompt
              missing={applicability?.missing_profile_facts}
              onOpen={() => setTab('profile')}
            />

            <StatusBanner
              formDetail={formDetail}
              status={activeResult?.status}
              reason={activeResult?.reason}
              conflict={activeResult?.conflict?.message}
              preview={preview}
              gapCount={preview?.result?.gaps?.length ?? 0}
            />

            <div className="flex border-b border-slate-200 space-x-2 overflow-x-auto">
              {[
                ['computation', Calculator, 'Tax Computation Engine'],
                ['profile', IdCard, 'Taxpayer Profile'],
                ['deadlines', CalendarClock, 'Filing Deadlines Schedule'],
                ['filings', FolderOpen, `Filing History (${filingsForForm.length})`],
              ].map(([id, Icon, label]) => (
                <button
                  key={id}
                  onClick={() => setTab(id)}
                  aria-current={tab === id}
                  className={`px-4 py-2.5 text-xs font-bold border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors ${
                    tab === id
                      ? 'border-brand-red text-brand-red'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Icon size={12} />
                  <span>{label}</span>
                </button>
              ))}
            </div>

          {tab === 'computation' && (
            <div className="space-y-6">
              {formDetail && layout ? (
                preview ? (
                  <FormViewer
                    formDetail={formDetail}
                    layout={layout}
                    preview={preview}
                    inputs={inputs}
                    setInputs={setInputs}
                    formatPHP={t.formatPHP}
                  />
                ) : (
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
                    <p className="text-[10px] font-black uppercase tracking-[3px] text-red-600 mb-1">
                      No computation yet
                    </p>
                    <p className="text-[13px] font-bold text-gray-400">
                      Choose a period and press <strong className="text-black">Compute</strong> to fill
                      this form. Computing does not save anything.
                    </p>
                  </div>
                )
              ) : (
                <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-brand-red mb-1">
                    Pick a form
                  </p>
                  <p className="text-xs text-slate-500">
                    Choose a BIR return from the registry to begin.
                  </p>
                </div>
              )}
            </div>
          )}

          {tab === 'profile' && (
            <ProfilePanel
              profile={profile}
              applicability={applicability}
              onSave={saveProfile}
              busy={busy}
              defaultOpen
            />
          )}

          {tab === 'deadlines' && <DeadlinesPanel deadlines={deadlines} defaultOpen />}

          {tab === 'filings' && (
            <div className="space-y-6">
              {filingsActive && (
                <CollapsiblePanel
                  title={`Filing #${filingsActive.id} — as filed`}
                  icon={FileCheck2}
                  defaultOpen
                  summary={`${String(filingsActive.status).replace(/_/g, ' ')} · due ${t.formatPHP(filingsActive.amount_still_due)}`}
                >
                  <div>
                    {(filingsActive.lines ?? []).map((line) => (
                      <div
                        key={line.id}
                        className={`py-1 flex justify-between border-b border-gray-100 last:border-0 ${
                          line.emphasis ? 'bg-red-50 -mx-2 px-2' : ''
                        }`}
                      >
                        <span
                          className={`text-[12px] ${
                            line.emphasis ? 'font-black text-black' : 'font-bold text-gray-700'
                          }`}
                        >
                          {line.label}
                        </span>
                        <span
                          className={`font-mono ${
                            line.emphasis
                              ? 'text-[13px] font-black text-red-600'
                              : 'text-[13px] font-black text-black'
                          }`}
                        >
                          {t.formatPHP(line.value)}
                        </span>
                      </div>
                    ))}
                  </div>
                  {filingsActive.is_override && (
                    <p className="text-[10px] font-black uppercase tracking-widest text-amber-600 mt-2">
                      Includes at least one manual override
                    </p>
                  )}
                </CollapsiblePanel>
              )}
              <FilingsPanel
                filings={filingsForForm}
                filingsActive={filingsActive}
                onAcknowledge={acknowledge}
                onMarkFiled={markFiled}
                busy={busy}
                monthDay={t.monthDay}
                formatPHP={t.formatPHP}
              />
            </div>
          )}
        </div>
      </main>
    </div>
      </>
  )
}

export default function TaxRegistry() {
  return (
    <Boundary>
      <ProtectedAction routeName="tax_compliance" fallback={null}>
        {/* The toast is mounted by the content component, next to the state
            that raises it, rather than here: it is a single DynamicToast with
            no global registry, matching every other page in this app. */}
        <TaxRegistryContent />
      </ProtectedAction>
    </Boundary>
  )
}
