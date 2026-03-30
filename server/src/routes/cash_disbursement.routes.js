const express = require('express')
const { getCashDisbursements, createCashDisbursement } = require('../controller/cash_disbursement.controller')

const cashDisbursementRouter = express.Router()

cashDisbursementRouter.get('/', getCashDisbursements)
cashDisbursementRouter.post('/', createCashDisbursement)

module.exports = {
  cashDisbursementRouter,
}
