const express = require('express')
const { getCashDisbursements, createCashDisbursement, updateCashDisbursement, updateDisbursementState, getAllCashDisbursements } = require('../controller/cash_disbursement.controller')

const cashDisbursementRouter = express.Router()

cashDisbursementRouter.get('/', getCashDisbursements)
cashDisbursementRouter.get('/:cash_disbursement_id', getAllCashDisbursements)
cashDisbursementRouter.post('/', createCashDisbursement)
cashDisbursementRouter.put('/:cash_disbursement_id', updateCashDisbursement)
cashDisbursementRouter.put('/disbursement-state', updateDisbursementState)

module.exports = {
  cashDisbursementRouter,
}
