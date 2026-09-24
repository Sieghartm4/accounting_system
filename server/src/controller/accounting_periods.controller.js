'use strict'

const { SQLQueryBuilder } = require('../util/helper.util')
const { getTenantPool } = require('../database/util/tenantConnection.util')
const { Query } = require('../database/util/queries.util')
const { Accounting } = require('../database/model/Accounting')
const {
  PERIOD_STATUSES,
  NON_POSTABLE_STATUSES,
  toPeriodKey,
  periodRange,
  inferStatusFromDates,
  assertPeriodIsOpen,
  getPeriodKeyForDate,
} = require('../util/accountingPeriod.util')

const sql = new SQLQueryBuilder()

const FISCAL_YEAR_STATUSES = ['ACTIVE', 'INACTIVE', 'ARCHIVED']
const ACTION_OPTIONS = ['soft_close', 'close', 'lock', 'reopen']

const stripPrefix = (row, prefix) => {
  const out = {}
  for (const key in row) {
    if (Object.prototype.hasOwnProperty.call(row, key)) {
      out[key.startsWith(prefix) ? key.replace(prefix, '') : key] = row[key]
    }
  }
  return out
}

const httpError = (status, message) => {
  const err = new Error(message)
  err.status = status
  return err
}

const getCurrentFiscalYear = async (connection) => {
  const query = sql
    .select(Accounting.accounting_fiscal_years.selectColumns)
    .from(Accounting.accounting_fiscal_years.tablename)
    .where(Accounting.accounting_fiscal_years.selectOptionColumns.is_current)
    .build()
  const [rows] = await connection.execute(query, [true])
  if (!rows || rows.length === 0) {
    const allQuery = sql
      .select(Accounting.accounting_fiscal_years.selectColumns)
      .from(Accounting.accounting_fiscal_years.tablename)
      .orderByDesc(Accounting.accounting_fiscal_years.selectOptionColumns.id)
      .build()
    const [all] = await connection.execute(allQuery)
    return all && all[0] ? all[0] : null
  }
  return rows[0]
}

const findPeriodByQuery = async (connection, column, value) => {
  const query = sql
    .select(Accounting.accounting_periods.selectColumns)
    .from(Accounting.accounting_periods.tablename)
    .where(column)
    .build()
  const [rows] = await connection.execute(query, [value])
  if (!rows || rows.length === 0) return null
  return stripPrefix(rows[0], Accounting.accounting_periods.prefix_)
}

const getFiscalYears = async (req, res, next) => {
  try {
    const { status: statusFilter } = req.query
    const values = []

    let fiscalQuery = sql
      .select(Accounting.accounting_fiscal_years.selectColumns)
      .from(Accounting.accounting_fiscal_years.tablename)

    if (statusFilter) {
      const parsed = String(statusFilter).trim().toUpperCase()
      if (!FISCAL_YEAR_STATUSES.includes(parsed)) {
        return res.status(400).json({
          success: false,
          message: `Invalid status filter: must be one of ${FISCAL_YEAR_STATUSES.join(', ')}`,
        })
      }
      fiscalQuery = fiscalQuery.where(
        Accounting.accounting_fiscal_years.selectOptionColumns.status,
      )
      values.push(parsed)
    }

    const query = fiscalQuery
      .orderByDesc(Accounting.accounting_fiscal_years.selectOptionColumns.id)
      .build()

    const result = await Query(query, values, [
      Accounting.accounting_fiscal_years.prefix_,
    ])

    res.status(200).json({
      success: true,
      message: 'Fiscal years retrieved successfully',
      data: result,
      count: result.length,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error fetching fiscal years:', error)
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching fiscal years',
      error:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Internal server error',
    })
  }
}

const createFiscalYear = async (req, res, next) => {
  let connection
  try {
    const payload = req.body && req.body.data ? req.body.data : req.body
    const code = String(payload.code || '').trim()
    const name = String(payload.name || '').trim()
    const startDate = String(payload.start_date || '').trim()
    const endDate = String(payload.end_date || '').trim()
    const status = String(payload.status || 'ACTIVE').trim().toUpperCase()
    const isCurrent =
      payload.is_current === true ||
      payload.is_current === 1 ||
      String(payload.is_current) === 'true'

    if (!code) {
      return res
        .status(400)
        .json({ success: false, message: 'Fiscal year code is required' })
    }
    if (code.length > 20) {
      return res.status(400).json({
        success: false,
        message: 'Fiscal year code must be 20 characters or fewer',
      })
    }
    if (!name) {
      return res
        .status(400)
        .json({ success: false, message: 'Fiscal year name is required' })
    }
    if (!startDate || !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
      return res.status(400).json({
        success: false,
        message: 'A valid start date (YYYY-MM-DD) is required',
      })
    }
    if (!endDate || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
      return res.status(400).json({
        success: false,
        message: 'A valid end date (YYYY-MM-DD) is required',
      })
    }
    if (startDate >= endDate) {
      return res.status(400).json({
        success: false,
        message: 'End date must be after start date',
      })
    }
    if (!FISCAL_YEAR_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status: must be one of ${FISCAL_YEAR_STATUSES.join(', ')}`,
      })
    }

    connection = await getTenantPool().getConnection()
    await connection.beginTransaction()

    const now = new Date().toISOString()
    const actor = req.context?.username || 'Unknown User'

    const fyQuery = sql
      .insert(Accounting.accounting_fiscal_years.tablename, {
        columns: Accounting.accounting_fiscal_years.insertColumns,
        prefix: Accounting.accounting_fiscal_years.prefix,
        isTransaction: true,
      })
      .build()
    await connection.execute(fyQuery, [
      code,
      name,
      startDate,
      endDate,
      status,
      isCurrent ? 1 : 0,
      now,
      actor,
      now,
      actor,
    ])

    const [[{ afy_id: fiscalYearId }]] = await connection.execute(
      `SELECT LAST_INSERT_ID() AS afy_id`,
    )

    const startParts = startDate.split('-').map(Number)
    const endParts = endDate.split('-').map(Number)
    const cursor = new Date(startParts[0], startParts[1] - 1, 1)
    const stop = new Date(endParts[0], endParts[1] - 1, 1)

    const periodKeys = []
    let guard = 0
    let current = new Date(cursor)
    while (current.getTime() <= stop.getTime() && guard < 1200) {
      periodKeys.push(
        `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`,
      )
      current = new Date(current.getFullYear(), current.getMonth() + 1, 1)
      guard += 1
    }

    const placeholders = periodKeys.map(() => '?').join(',')
    const [existingRows] = await connection.execute(
      `SELECT ap_period FROM accounting_periods WHERE ap_period IN (${placeholders})`,
      periodKeys,
    )
    const existingSet = new Set(
      (existingRows || []).map((row) => row.ap_period),
    )

    const periodQuery = sql
      .insert(Accounting.accounting_periods.tablename, {
        columns: Accounting.accounting_periods.insertColumns,
        prefix: Accounting.accounting_periods.prefix,
        isTransaction: true,
      })
      .build()

    const todayKey = getPeriodKeyForDate(new Date().toISOString().slice(0, 10))

    for (const key of periodKeys) {
      if (existingSet.has(key)) continue
      const [year, month] = key.split('-').map(Number)
      const { startDate: periodStart, endDate: periodEnd } = periodRange(
        year,
        month,
      )
      const defaultStatus =
        key >= todayKey ? 'OPEN' : inferStatusFromDates(year, month)
      await connection.execute(periodQuery, [
        fiscalYearId,
        key,
        year,
        month,
        periodStart,
        periodEnd,
        defaultStatus,
        now,
        actor,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        now,
        actor,
        now,
        actor,
      ])
    }

    await connection.commit()

    const fySelect = sql
      .select(Accounting.accounting_fiscal_years.selectColumns)
      .from(Accounting.accounting_fiscal_years.tablename)
      .where(Accounting.accounting_fiscal_years.selectOptionColumns.id)
      .build()
    const [fyRows] = await connection.execute(fySelect, [fiscalYearId])
    const fiscalYear =
      fyRows && fyRows[0]
        ? stripPrefix(fyRows[0], Accounting.accounting_fiscal_years.prefix_)
        : null

    const periodsQuery = sql
      .select(Accounting.accounting_periods.selectColumns)
      .from(Accounting.accounting_periods.tablename)
      .where(Accounting.accounting_periods.selectOptionColumns.fiscal_year_id)
      .orderBy(Accounting.accounting_periods.selectOptionColumns.period)
      .build()
    const [periodRows] = await connection.execute(periodsQuery, [
      fiscalYearId,
    ])
    const periods = (periodRows || []).map((row) =>
      stripPrefix(row, Accounting.accounting_periods.prefix_),
    )

    res.status(201).json({
      success: true,
      message: `Fiscal year ${code} created successfully with ${periods.length} monthly period(s)`,
      data: { fiscal_year: fiscalYear, periods },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback()
      } catch (rollbackError) {
        console.error('Rollback failed:', rollbackError)
      }
    }
    console.error('Error creating fiscal year:', error)
    const status =
      error.code === 'ER_DUP_ENTRY' || error.errno === 1062 ? 409 : 500
    return res.status(status).json({
      success: false,
      message: error.message || 'Server error while creating fiscal year',
      error:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Internal server error',
    })
  } finally {
    if (connection) connection.release()
  }
}

const getPeriods = async (req, res, next) => {
  try {
    const {
      fiscal_year_id,
      year,
      status,
      period,
      offset,
      limit,
    } = req.query
    const shouldPaginate = offset !== undefined && limit !== undefined
    const offsetNum = shouldPaginate ? Math.max(0, parseInt(offset, 10) || 0) : 0
    const limitNum = shouldPaginate
      ? Math.max(1, Math.min(100, parseInt(limit, 10) || 50))
      : null

    const wheres = []
    const values = []

    if (fiscal_year_id) {
      wheres.push('ap_fiscal_year_id = ?')
      values.push(fiscal_year_id)
    }
    if (year) {
      wheres.push('ap_year = ?')
      values.push(year)
    }
    if (status) {
      const parsed = String(status).trim().toUpperCase()
      if (!PERIOD_STATUSES.includes(parsed)) {
        return res.status(400).json({
          success: false,
          message: `Invalid status filter: must be one of ${PERIOD_STATUSES.join(', ')}`,
        })
      }
      wheres.push('ap_status = ?')
      values.push(parsed)
    }
    if (period) {
      wheres.push('ap_period = ?')
      values.push(period)
    }

    const whereClause = wheres.length ? ` WHERE ${wheres.join(' AND ')}` : ''
    const orderBy = ` ORDER BY ap_year ASC, ap_month ASC`
    const pagination = shouldPaginate ? ` LIMIT ? OFFSET ?` : ''
    const params = shouldPaginate ? [...values, limitNum, offsetNum] : values
    const query = `SELECT * FROM accounting_periods${whereClause}${orderBy}${pagination}`

    const result = await Query(query, params, [
      Accounting.accounting_periods.prefix_,
    ])

    res.status(200).json({
      success: true,
      message: 'Accounting periods retrieved successfully',
      data: result,
      count: result.length,
      offset: offsetNum,
      limit: limitNum,
      hasMore: shouldPaginate ? result.length === limitNum : false,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error fetching accounting periods:', error)
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching accounting periods',
      error:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Internal server error',
    })
  }
}

const getPeriodById = async (req, res, next) => {
  try {
    const { period_id } = req.params
    if (!period_id) {
      return res
        .status(400)
        .json({ success: false, message: 'Invalid period ID provided' })
    }

    const pool = getTenantPool()
    const connection = await pool.getConnection()
    try {
      const period = await findPeriodByQuery(
        connection,
        Accounting.accounting_periods.selectOptionColumns.id,
        period_id,
      )
      if (!period) {
        return res
          .status(404)
          .json({ success: false, message: 'Accounting period not found' })
      }
      res.status(200).json({
        success: true,
        message: 'Accounting period retrieved successfully',
        data: [period],
        timestamp: new Date().toISOString(),
      })
    } finally {
      connection.release()
    }
  } catch (error) {
    console.error('Error fetching accounting period:', error)
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching accounting period',
      error:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Internal server error',
    })
  }
}

const updatePeriodStatus = async (req, res, next) => {
  let connection
  try {
    const { period_id } = req.params
    if (!period_id) {
      return res
        .status(400)
        .json({ success: false, message: 'Invalid period ID provided' })
    }

    const payload = req.body && req.body.data ? req.body.data : req.body
    const action = String(payload.action || '').trim().toLowerCase()
    const reopenReason = String(payload.reopen_reason || '').trim()

    if (!ACTION_OPTIONS.includes(action)) {
      return res.status(400).json({
        success: false,
        message: `Invalid action "${action}". Must be one of: ${ACTION_OPTIONS.join(', ')}`,
      })
    }

    const actor = req.context?.username || 'Unknown User'
    const now = new Date().toISOString()
    const cols = Accounting.accounting_periods.selectOptionColumns

    connection = await getTenantPool().getConnection()
    await connection.beginTransaction()

    const period = await findPeriodByQuery(
      connection,
      Accounting.accounting_periods.selectOptionColumns.id,
      period_id,
    )
    if (!period) {
      await connection.rollback()
      return res
        .status(404)
        .json({ success: false, message: 'Accounting period not found' })
    }

    const currentStatus = String(period.status || '').toUpperCase()
    let newStatus = null
    let setColumns = []
    let setValues = []

    if (action === 'soft_close') {
      if (currentStatus !== 'OPEN') {
        throw httpError(
          400,
          `Cannot soft-close period ${period.period}: current status is ${currentStatus}. Only OPEN periods can be soft-closed.`,
        )
      }
      newStatus = 'SOFT_CLOSED'
      setColumns = [
        cols.status,
        cols.soft_closed_date,
        cols.soft_closed_by,
        cols.updated_date,
        cols.updated_by,
      ]
      setValues = [newStatus, now, actor, now, actor]
    } else if (action === 'close') {
      if (!['OPEN', 'SOFT_CLOSED'].includes(currentStatus)) {
        throw httpError(
          400,
          `Cannot close period ${period.period}: current status is ${currentStatus}. Only OPEN or SOFT_CLOSED periods can be closed.`,
        )
      }
      newStatus = 'CLOSED'
      setColumns = [
        cols.status,
        cols.closed_date,
        cols.closed_by,
        cols.updated_date,
        cols.updated_by,
      ]
      setValues = [newStatus, now, actor, now, actor]
    } else if (action === 'lock') {
      if (!['OPEN', 'SOFT_CLOSED', 'CLOSED'].includes(currentStatus)) {
        throw httpError(
          400,
          `Cannot lock period ${period.period}: current status is ${currentStatus}. Only OPEN, SOFT_CLOSED or CLOSED periods can be locked.`,
        )
      }
      newStatus = 'LOCKED'
      setColumns = [
        cols.status,
        cols.locked_date,
        cols.locked_by,
        cols.updated_date,
        cols.updated_by,
      ]
      setValues = [newStatus, now, actor, now, actor]
    } else if (action === 'reopen') {
      if (!NON_POSTABLE_STATUSES.includes(currentStatus)) {
        throw httpError(
          400,
          `Cannot reopen period ${period.period}: current status is ${currentStatus}. Only SOFT_CLOSED, CLOSED or LOCKED periods can be reopened.`,
        )
      }
      if (!reopenReason) {
        throw httpError(
          400,
          `reopen_reason is required when reopening period ${period.period}`,
        )
      }
      newStatus = 'OPEN'
      setColumns = [
        cols.status,
        cols.reopened_date,
        cols.reopened_by,
        cols.reopen_reason,
        cols.soft_closed_date,
        cols.soft_closed_by,
        cols.closed_date,
        cols.closed_by,
        cols.locked_date,
        cols.locked_by,
        cols.updated_date,
        cols.updated_by,
      ]
      setValues = [
        newStatus,
        now,
        actor,
        reopenReason,
        null,
        null,
        null,
        null,
        null,
        null,
        now,
        actor,
      ]
    }

    const updateQuery = sql
      .update(Accounting.accounting_periods.tablename)
      .set(setColumns)
      .where(Accounting.accounting_periods.selectOptionColumns.id)
      .build()
    await connection.execute(updateQuery, [...setValues, period_id])

    const confirmed = await findPeriodByQuery(
      connection,
      Accounting.accounting_periods.selectOptionColumns.id,
      period_id,
    )
    if (!confirmed || String(confirmed.status).toUpperCase() !== newStatus) {
      throw new Error(
        'Period status update could not be confirmed after write',
      )
    }

    await connection.commit()

    res.status(200).json({
      success: true,
      message: `Period ${confirmed.period} ${action} succeeded — status is now ${confirmed.status}`,
      data: [confirmed],
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback()
      } catch (rollbackError) {
        console.error('Rollback failed:', rollbackError)
      }
    }
    console.error('Error updating period status:', error)
    const status = error.status || 500
    return res.status(status).json({
      success: false,
      message: error.message || 'Server error while updating period status',
      error:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Internal server error',
    })
  } finally {
    if (connection) connection.release()
  }
}

const getCurrentPeriod = async (req, res, next) => {
  let connection
  try {
    connection = await getTenantPool().getConnection()

    const fiscalYear = await getCurrentFiscalYear(connection)
    if (!fiscalYear) {
      return res.status(200).json({
        success: true,
        message: 'No current fiscal year is configured',
        data: [],
        timestamp: new Date().toISOString(),
      })
    }

    const today = new Date().toISOString().slice(0, 10)
    const todayKey = getPeriodKeyForDate(today)

    const periodQuery = sql
      .select(Accounting.accounting_periods.selectColumns)
      .from(Accounting.accounting_periods.tablename)
      .where(Accounting.accounting_periods.selectOptionColumns.period)
      .andWhere(Accounting.accounting_periods.selectOptionColumns.status)
      .build()
    const [rows] = await connection.execute(periodQuery, [todayKey, 'OPEN'])
    let period =
      rows && rows[0]
        ? stripPrefix(rows[0], Accounting.accounting_periods.prefix_)
        : null

    if (!period) {
      const fallbackQuery = sql
        .select(Accounting.accounting_periods.selectColumns)
        .from(Accounting.accounting_periods.tablename)
        .where(Accounting.accounting_periods.selectOptionColumns.status)
        .orderByDesc(Accounting.accounting_periods.selectOptionColumns.period)
        .build()
      const [fallbackRows] = await connection.execute(fallbackQuery, ['OPEN'])
      if (fallbackRows && fallbackRows[0]) {
        period = stripPrefix(
          fallbackRows[0],
          Accounting.accounting_periods.prefix_,
        )
      }
    }

    if (period) {
      assertPeriodIsOpen(period, 'use current period')
    }

    res.status(200).json({
      success: true,
      message: period
        ? 'Current accounting period retrieved successfully'
        : 'No open accounting period is available for the current date',
      data: period ? [period] : [],
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error fetching current accounting period:', error)
    const status = error.status || 500
    return res.status(status).json({
      success: false,
      message:
        error.message ||
        'Server error while fetching current accounting period',
      error:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Internal server error',
    })
  } finally {
    if (connection) connection.release()
  }
}

module.exports = {
  getFiscalYears,
  createFiscalYear,
  getPeriods,
  getPeriodById,
  updatePeriodStatus,
  getCurrentPeriod,
}