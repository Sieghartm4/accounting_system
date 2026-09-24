const express = require('express')
const {
  getFiscalYears,
  createFiscalYear,
  getPeriods,
  getPeriodById,
  updatePeriodStatus,
  getCurrentPeriod,
} = require('../controller/accounting_periods.controller')

const accountingPeriodsRouter = express.Router()

accountingPeriodsRouter.get('/', getPeriods)
accountingPeriodsRouter.get('/fiscal-years', getFiscalYears)
accountingPeriodsRouter.post('/fiscal-years', createFiscalYear)
accountingPeriodsRouter.get('/current-period', getCurrentPeriod)
accountingPeriodsRouter.get('/:period_id', getPeriodById)
accountingPeriodsRouter.patch('/:period_id/status', updatePeriodStatus)

module.exports = {
  accountingPeriodsRouter,
}