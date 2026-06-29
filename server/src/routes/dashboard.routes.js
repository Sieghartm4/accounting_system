const express = require('express')
const { getDashboardData } = require('../controller/dashboard.controller')

const dashboardRouter = express.Router()

dashboardRouter.get('/', getDashboardData)

module.exports = {
  dashboardRouter,
} 
