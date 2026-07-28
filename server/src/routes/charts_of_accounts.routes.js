const express = require('express')
const { getChartsOfAccounts, createChartsOfAccount, updateChartsOfAccount, importChartsOfAccounts } = require('../controller/charts_of_accounts.controller')

const chartsOfAccountsRouter = express.Router()

chartsOfAccountsRouter.get('/', getChartsOfAccounts)
chartsOfAccountsRouter.post('/', createChartsOfAccount)
chartsOfAccountsRouter.put('/:id', updateChartsOfAccount)
chartsOfAccountsRouter.post('/import', importChartsOfAccounts)
module.exports = {
  chartsOfAccountsRouter,
}
