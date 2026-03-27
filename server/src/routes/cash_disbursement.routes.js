const express = require('express')
const { getCashDisbursements } = require('../controller/cash_disbursement.controller')

const cashDisbursementRouter = express.Router()

cashDisbursementRouter.get('/', getCashDisbursements)

module.exports = {
  cashDisbursementRouter,
}
