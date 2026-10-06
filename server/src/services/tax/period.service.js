'use strict'

/**
 * Period arithmetic and filing deadlines.
 *
 * All period math here is done with local-time components and string
 * formatting. It never round-trips through `new Date(x).toISOString()` for a
 * period key: that converts through UTC and silently moves a month back by one
 * in any timezone ahead of UTC (PHT is +8), which is exactly how a quarter
 * anchored on September 1 becomes "2026-06/07/08" instead of
 * "2026-07/08/09".
 */

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/

const isDateOnly = (value) => DATE_ONLY.test(String(value || ''))

const pad = (n) => String(n).padStart(2, '0')

/** YYYY-MM without constructing a Date. */
const ym = (year, monthIndexZeroBased) => `${year}-${pad(monthIndexZeroBased + 1)}`

/** Parse `YYYY-MM-DD` into local components. Rejects impossible dates. */
const parseDateOnly = (value) => {
  if (!isDateOnly(value)) return null
  const [year, month, day] = String(value).split('-').map(Number)
  const date = new Date(year, month - 1, day)
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null
  }
  return { year, month, day, date }
}

const toDateOnly = (date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`

const lastDayOfMonth = (year, monthIndexZeroBased) =>
  new Date(year, monthIndexZeroBased + 1, 0).getDate()

// ---------------------------------------------------------------------------
// Period kinds
// ---------------------------------------------------------------------------

const CALENDAR_MONTH = 'CALENDAR_MONTH'
const CALENDAR_QUARTER = 'CALENDAR_QUARTER'
const CALENDAR_YEAR = 'CALENDAR_YEAR'
const FISCAL_YEAR = 'FISCAL_YEAR'
const FISCAL_QUARTER = 'FISCAL_QUARTER'
const PER_CREDENTIAL = 'PER_CREDENTIAL'

/**
 * Expand a period basis into a concrete { start, end, label } window.
 *
 * @param {string} basis    one of the PERIOD_* constants
 * @param {string} anchor    any YYYY-MM-DD inside the desired period
 * @param {object} profile   { fiscal_year_end_month } for the FISCAL_* bases
 */
const resolvePeriod = (basis, anchor, profile = {}) => {
  const parsed = parseDateOnly(anchor)
  if (!parsed) {
    return { error: `Invalid period anchor "${anchor}"; expected YYYY-MM-DD` }
  }
  const { year, month, day } = parsed

  switch (basis) {
    case CALENDAR_MONTH:
      return {
        period_type: 'MONTH',
        start: `${year}-${pad(month)}-01`,
        end: `${year}-${pad(month)}-${pad(lastDayOfMonth(year, month - 1))}`,
        label: `${monthName(month)} ${year}`,
        months: [ym(year, month - 1)],
        year,
        quarter: quarterOf(month),
      }

    case CALENDAR_QUARTER: {
      const qStartIndex = Math.floor((month - 1) / 3) * 3
      const months = [0, 1, 2].map((offset) => ym(year, qStartIndex + offset))
      const endYear = year
      const endMonth = qStartIndex + 3
      return {
        period_type: 'QUARTER',
        start: `${months[0]}-01`,
        end: `${endYear}-${pad(endMonth)}-${pad(lastDayOfMonth(endYear, endMonth - 1))}`,
        label: `Q${quarterOf(month)} ${year}`,
        months,
        year,
        quarter: quarterOf(month),
      }
    }

    case CALENDAR_YEAR:
      return {
        period_type: 'YEAR',
        start: `${year}-01-01`,
        end: `${year}-12-31`,
        label: `Taxable Year ${year}`,
        months: Array.from({ length: 12 }, (_, i) => ym(year, i)),
        year,
        quarter: quarterOf(month),
      }

    case FISCAL_YEAR: {
      const endMonth = Number(profile.fiscal_year_end_month) || 12
      // A fiscal year is labelled by the calendar year in which it ENDS, so a
      // year ending 30 June 2026 is "FY 2026" and spans Jul 2025 - Jun 2026.
      const fyStartYear = endMonth === 12 ? year : year - 1
      const fyEndYear = endMonth === 12 ? year : year
      return {
        period_type: 'YEAR',
        start: `${fyStartYear}-${pad(endMonth === 12 ? 1 : endMonth + 1)}-01`,
        end: `${fyEndYear}-${pad(endMonth)}-${pad(lastDayOfMonth(fyEndYear, endMonth - 1))}`,
        label: `Fiscal Year ${fyEndYear}`,
        months: fiscalMonths(fyStartYear, endMonth),
        year: fyEndYear,
        quarter: quarterOf(month),
        fiscal: true,
      }
    }

    case FISCAL_QUARTER: {
      const endMonth = Number(profile.fiscal_year_end_month) || 12
      // Anchor to a fiscal year first, then locate the quarter within it.
      const fyLabelYear = endMonth === 12 ? year : month > endMonth ? year : year - 1
      const fyStartYear = endMonth === 12 ? year : year - 1
      const fyEndYear = endMonth === 12 ? year : year
      const fyMonths = fiscalMonths(fyStartYear, endMonth)
      const indexInFy = fyMonths.indexOf(ym(year, month - 1))
      const qIndex = indexInFy >= 0 ? Math.floor(indexInFy / 3) * 3 : 0
      const months = fyMonths.slice(qIndex, qIndex + 3)
      const last = months[2]
      const [ly, lm] = last.split('-').map(Number)
      return {
        period_type: 'QUARTER',
        start: `${months[0]}-01`,
        end: `${ly}-${pad(lm)}-${pad(lastDayOfMonth(ly, lm - 1))}`,
        label: `Q${qIndex / 3 + 1} FY${fyLabelYear}`,
        months,
        year: fyEndYear,
        quarter: qIndex / 3 + 1,
        fiscal: true,
      }
    }

    case PER_CREDENTIAL:
      // A 2307 covers one payee for one tax year, so the period is the year.
      return {
        period_type: 'YEAR',
        start: `${year}-01-01`,
        end: `${year}-12-31`,
        label: `Tax Year ${year}`,
        months: Array.from({ length: 12 }, (_, i) => ym(year, i)),
        year,
        quarter: quarterOf(month),
      }

    default:
      return { error: `Unknown period basis "${basis}"` }
  }
}

const fiscalMonths = (startYear, endMonth) => {
  const months = []
  if (endMonth === 12) {
    for (let i = 0; i < 12; i += 1) months.push(ym(startYear, i))
    return months
  }
  // e.g. endMonth 6 → Jul 2025 .. Jun 2026
  for (let i = endMonth; i < 12; i += 1) months.push(ym(startYear, i))
  for (let i = 0; i < endMonth; i += 1) months.push(ym(startYear + 1, i))
  return months
}

const quarterOf = (month) => Math.floor((month - 1) / 3) + 1

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const monthName = (month) => MONTH_NAMES[month - 1] || ''

/** Split a period into the months it spans — 2550Q and 1601-C need these. */
const monthsInPeriod = (period) => {
  if (Array.isArray(period.months) && period.months.length) return period.months
  const start = parseDateOnly(period.start)
  const end = parseDateOnly(period.end)
  if (!start || !end) return []
  const months = []
  let year = start.year
  let month = start.month
  while (year < end.year || (year === end.year && month <= end.month)) {
    months.push(ym(year, month - 1))
    month += 1
    if (month > 12) {
      month = 1
      year += 1
    }
  }
  return months
}

// ---------------------------------------------------------------------------
// Deadlines
// ---------------------------------------------------------------------------

/**
 * Statutory filing deadline for a form in a period.
 *
 * `offset_months` moves the reference month forward before the day is applied,
 * because a 2550M for March is due in April and a 1701 for 2025 is due in
 * April of 2026.
 *
 * `grace_weekend_to` implements the BIR's "if the last day falls on a Saturday
 * or Sunday, the deadline moves to the following Monday" rule. It is applied
 * to the computed day only, never to a day the user typed in.
 */
const filingDeadline = (form, period, profile = {}) => {
  if (!form || !form.deadline) return null

  const { day, offset_months: offsetMonths = 0, grace_weekend_to: graceTo = null } = form.deadline
  const lastMonth = period.months && period.months.length
    ? period.months[period.months.length - 1]
    : String(period.end || '').slice(0, 7)

  const [refYear, refMonth] = lastMonth.split('-').map(Number)
  const target = new Date(refYear, refMonth - 1 + offsetMonths, 1)
  let dueDay = day

  if (graceTo) {
    const candidate = new Date(target.getFullYear(), target.getMonth(), dueDay)
    const dow = candidate.getDay()
    if (dow === 6) {
      dueDay = graceTo
    } else if (dow === 0) {
      dueDay = graceTo + 1
    }
  }

  const lastDay = lastDayOfMonth(target.getFullYear(), target.getMonth())
  dueDay = Math.min(dueDay, lastDay)

  const dueDate = new Date(target.getFullYear(), target.getMonth(), dueDay)

  return {
    due_date: toDateOnly(dueDate),
    due_label: `${monthName(dueDate.getMonth() + 1)} ${dueDay}, ${dueDate.getFullYear()}`,
    grace_applied: graceTo ? dueDay !== day : false,
    statutory_day: day,
    statutory_month_offset: offsetMonths,
  }
}

/**
 * Days from today until a deadline, and the filing's standing relative to it.
 * `today` is injectable so this is testable without freezing the clock.
 */
const deadlineStanding = (deadline, status, today = new Date()) => {
  if (!deadline) return { state: 'not_applicable', days_remaining: null }
  if (status === 'filed' || status === 'filed_with_bir') {
    return { state: 'filed', days_remaining: null }
  }

  const due = parseDateOnly(deadline.due_date)
  if (!due) return { state: 'unknown', days_remaining: null }

  // Compare on date-only values so a filing is not "overdue" purely because
  // of the time of day the page was loaded.
  const todayKey = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const msPerDay = 24 * 60 * 60 * 1000
  const days = Math.round((due.date - todayKey) / msPerDay)

  if (days < 0) return { state: 'overdue', days_remaining: days }
  if (days === 0) return { state: 'due_today', days_remaining: 0 }
  if (days <= 7) return { state: 'due_soon', days_remaining: days }
  return { state: 'upcoming', days_remaining: days }
}

module.exports = {
  CALENDAR_MONTH,
  CALENDAR_QUARTER,
  CALENDAR_YEAR,
  FISCAL_YEAR,
  FISCAL_QUARTER,
  PER_CREDENTIAL,
  PERIOD_BASES: {
    CALENDAR_MONTH,
    CALENDAR_QUARTER,
    CALENDAR_YEAR,
    FISCAL_YEAR,
    FISCAL_QUARTER,
    PER_CREDENTIAL,
  },
  parseDateOnly,
  toDateOnly,
  isDateOnly,
  resolvePeriod,
  monthsInPeriod,
  filingDeadline,
  deadlineStanding,
  monthName,
  quarterOf,
  ym,
  lastDayOfMonth,
  MONTH_NAMES,
}
