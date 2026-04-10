const express = require('express')
const { getCashDisbursements, createCashDisbursement, updateDisbursementState } = require('../controller/cash_disbursement.controller')

const cashDisbursementRouter = express.Router()

cashDisbursementRouter.get('/', getCashDisbursements)
cashDisbursementRouter.post('/', createCashDisbursement)
cashDisbursementRouter.put('/disbursement-state', updateDisbursementState)

module.exports = {
  cashDisbursementRouter,
}
