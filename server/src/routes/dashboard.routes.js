const express = require('express')
const { getDashboardData } = require('../controller/dashboard.controller')
const {
  validateReportQuery,
} = require('../middlewares/reportQueryValidation.middleware')

const dashboardRouter = express.Router()

dashboardRouter.get('/', validateReportQuery, getDashboardData)

module.exports = {
  dashboardRouter,
}
