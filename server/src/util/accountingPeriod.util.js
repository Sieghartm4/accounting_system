'use strict'

const { Accounting } = require('../database/model/Accounting')
const { getTenantPool } = require('../database/util/tenantConnection.util')
const { SQLQueryBuilder } = require('./helper.util')

const sql = new SQLQueryBuilder()

const PERIOD_STATUSES = ['OPEN', 'SOFT_CLOSED', 'CLOSED', 'LOCKED']

const NON_POSTABLE_STATUSES = ['SOFT_CLOSED', 'CLOSED', 'LOCKED']

const STATUS_WEIGHT = {
  OPEN: 0,
  SOFT_CLOSED: 1,
  CLOSED: 2,
  LOCKED: 3,
}

const toPeriodKey = (dateStr) => {
  if (!dateStr || typeof dateStr !== 'string') return null
  const match = String(dateStr).trim().match(/^(\d{4})-(\d{2})/)
  return match ? `${match[1]}-${match[2]}` : null
}

const periodRange = (year, month, fiscalYear) => {
  const y = Number(year)
  const m = Number(month)
  const startDay = 1
  const endDay = new Date(y, m, 0).getDate()
  const start = new Date(y, m - 1, startDay)
  const end = new Date(y, m - 1, endDay)
  const pad = (n) => String(n).padStart(2, '0')
  const startDate = `${y}-${pad(m)}-${pad(startDay)}`
  const endDate = `${y}-${pad(m)}-${pad(endDay)}`
  const todayStr = new Date()
    .toISOString()
    .slice(0, 10)
  const fyStart = fiscalYear ? String(fiscalYear.afy_start_date || fiscalYear.start_date || '') : ''
  const fyEnd = fiscalYear ? String(fiscalYear.afy_end_date || fiscalYear.end_date || '') : ''
  return { startDate, endDate, todayStr, fyStart, fyEnd }
}

const buildPeriodReference = (year, month, fyYear) => {
  const suffix = String(fyYear || year).slice(-2)
  return `${year}-${month}-FY${suffix}`
}

/**
 * (Re)computes a period's default status from its date range against today.
 * OPEN when today is within [startDate, endDate]; otherwise SOFT_CLOSED.
 * Hinted to keep the period failing-open unless explicitly CLOSED/LOCKED.
 */
const inferStatusFromDates = (y, m, today) => {
  const todayKey = String(today || new Date().toISOString().slice(0, 10)).slice(0, 7)
  const periodKey = `${y}-${String(m).padStart(2, '0')}`
  return periodKey === todayKey ? 'OPEN' : 'SOFT_CLOSED'
}

const assertPeriodIsOpen = (period, action = 'post') => {
  const status = String(period && period.status || 'OPEN').toUpperCase()
  if (status !== 'OPEN') {
    const err = new Error(
      `Cannot ${action}: period ${period.period} (${period.year}-${String(period.month).padStart(2, '0')}) is ${status}.`,
    )
    err.status = 409
    err.code = 'PERIOD_NOT_OPEN'
    err.period = period
    throw err
  }
  return period
}

const getPeriodKeyForDate = (dateStr) => {
  const key = toPeriodKey(dateStr)
  if (!key) {
    const err = new Error(`Invalid date "${dateStr}". Expected a YYYY-MM-DD date.`)
    err.status = 400
    throw err
  }
  return key
}

const findPeriodById = async (connection, periodId) => {
  const query = sql
    .select(Accounting.accounting_periods.tablename, {
      columns: Accounting.accounting_periods.selectColumns,
      prefix: Accounting.accounting_periods.prefix,
    })
    .where(Accounting.accounting_periods.selectOptionColumns.id)
    .build()
  const [rows] = await connection.execute(query, [periodId])
  if (!rows || rows.length === 0) return null
  const row = rows[0]
  const strip = prefix_.replace = (key) =>
    key.startsWith(Accounting.accounting_periods.prefix_)
      ? key.replace(Accounting.accounting_periods.prefix_, '')
      : key
  const period = {}
  for (const key of Object.keys(row)) {
    period[strip(key)] = row[key]
  }
  return period
}

const findPeriodForDateKey = async (connection, dateKey) => {
  const query = sql
    .select(Accounting.accounting_periods.selectColumns)
    .from(Accounting.accounting_periods.tablename)
    .where(Accounting.accounting_periods.selectOptionColumns.period)
    .build()
  const [rows] = await connection.execute(query, [dateKey])
  if (!rows || rows.length === 0) return null
  const row = rows[0]
  const strip = (key) =>
    key.startsWith(Accounting.accounting_periods.prefix_)
      ? key.replace(Accounting.accounting_periods.prefix_, '')
      : key
  const period = {}
  for (const key of Object.keys(row)) {
    period[strip(key)] = row[key]
  }
  return period
}

const assertTransactionDateIsOpen = (period, action = 'record a transaction') => {
  const status = String((period && period.status) || 'OPEN').toUpperCase()
  if (status !== 'OPEN' && NON_POSTABLE_STATUSES.includes(status)) {
    const err = new Error(
      `Cannot ${action}: the accounting period ${period.period} (${period.year}-${String(period.month).padStart(2, '0')}) is ${status}. ` +
        `Transactions are blocked in ${status} periods. Reopen the period before recording.`,
    )
    err.status = 409
    err.code = 'PERIOD_LOCKED'
    err.period = period
    throw err
  }
  return period
}

const assertTransactionDateIsAllowed = async (
  connection,
  dateKey,
  action = 'record a transaction',
) => {
  const period = await findPeriodForDateKey(connection, dateKey)
  if (!period) return null
  return assertTransactionDateIsOpen(period, action)
}

const getCurrentFiscalYear = async (connection) => {
  const query = sql
    .select(Accounting.accounting_fiscal_years.tablename, {
      columns: Accounting.accounting_fiscal_years.selectColumns,
      prefix: Accounting.accounting_fiscal_years.prefix,
    })
    .where(Accounting.accounting_fiscal_years.selectOptionColumns.is_current)
    .build()
  const [rows] = await connection.execute(query, [true])
  if (!rows || rows.length === 0) {
    const [all] = await connection.execute(
      sql
        .select(Accounting.accounting_fiscal_years.tablename, {
          columns: Accounting.accounting_fiscal_years.selectColumns,
          prefix: Accounting.accounting_fiscal_years.prefix,
        })
        .where(Accounting.accounting_fiscal_years.selectOptionColumns.is_current)
        .build(),
    )
    return all && all[0] ? all[0] : null
  }
  return rows[0]
}

const ensurePeriodsExist = async (connection, actor) => {
  const fy = await getCurrentFiscalYear(connection)
  if (!fy) {
    const fyQuery = sql
      .insert(Accounting.accounting_fiscal_years.tablename, {
        columns: Accounting.accounting_fiscal_years.insertColumns,
        prefix: Accounting.accounting_fiscal_years.prefix,
        isTransaction: true,
      })
      .build()
    const fyId = await generateRef(connection, fyQuery, Accounting.accounting_fiscal_years.prefix, 'FISCAL')
    const now = new Date().toISOString()
    await connection.execute(fyQuery, [
      fyId,
      `FY-${String(now).slice(0, 4)}`,
      `Fiscal Year ${now.slice(0, 4)}`,
      `${now.slice(0, 4)}-01-01`,
      `${now.slice(0, 4)}-12-31`,
      'ACTIVE',
      '1',
      now,
      actor,
      now,
      actor,
    ])
    return { created: true }
  }
  return { created: false, fiscal_year_id: fy.afy_id || fy.id }
}

module.exports = {
  PERIOD_STATUSES,
  NON_POSTABLE_STATUSES,
  STATUS_WEIGHT,
  toPeriodKey,
  periodRange,
  buildPeriodReference,
  inferStatusFromDates,
  assertPeriodIsOpen,
  getPeriodKeyForDate,
  findPeriodById,
  getCurrentFiscalYear,
  ensurePeriodsExist,
  findPeriodForDateKey,
  assertTransactionDateIsOpen,
}
