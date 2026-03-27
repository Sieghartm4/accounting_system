const express = require('express')
const { getChartsOfAccounts, createChartsOfAccount } = require('../controller/charts_of_accounts.controller')

const chartsOfAccountsRouter = express.Router()

chartsOfAccountsRouter.get('/', getChartsOfAccounts)
chartsOfAccountsRouter.post('/', createChartsOfAccount)
module.exports = {
  chartsOfAccountsRouter,
}
