const express = require('express')
const { getChartsOfAccounts, createChartsOfAccount, updateChartsOfAccount } = require('../controller/charts_of_accounts.controller')

const chartsOfAccountsRouter = express.Router()

chartsOfAccountsRouter.get('/', getChartsOfAccounts)
chartsOfAccountsRouter.post('/', createChartsOfAccount)
chartsOfAccountsRouter.put('/:id', updateChartsOfAccount)
module.exports = {
  chartsOfAccountsRouter,
}
