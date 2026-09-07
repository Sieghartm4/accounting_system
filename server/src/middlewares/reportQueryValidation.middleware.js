'use strict'

const DATE_KEYS = ['start_date', 'end_date', 'startDate', 'endDate']
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

const isRealDate = (value) => {
  if (!DATE_PATTERN.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

const validateReportQuery = (req, res, next) => {
  for (const key of DATE_KEYS) {
    const value = req.query[key]
    if (value !== undefined && value !== '' && !isRealDate(String(value))) {
      return res.status(400).json({
        success: false,
        message: `${key} must use YYYY-MM-DD format`,
        code: 'INVALID_REPORT_DATE',
      })
    }
  }

  if (
    req.query.type &&
    !['DEBIT', 'CREDIT'].includes(String(req.query.type).toUpperCase())
  ) {
    return res.status(400).json({
      success: false,
      message: 'type must be DEBIT or CREDIT',
      code: 'INVALID_REPORT_TYPE',
    })
  }

  if (
    req.query.account_code &&
    !/^[A-Za-z0-9._-]{1,100}$/.test(String(req.query.account_code))
  ) {
    return res.status(400).json({
      success: false,
      message: 'Invalid account_code',
      code: 'INVALID_ACCOUNT_CODE',
    })
  }

  next()
}

module.exports = { validateReportQuery }
