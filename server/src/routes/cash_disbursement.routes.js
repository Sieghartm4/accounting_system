const express = require('express')
const { getCashDisbursements, createCashDisbursement, updateCashDisbursement, updateDisbursementState, getAllCashDisbursements, getPrintDisbursements } = require('../controller/cash_disbursement.controller')

const cashDisbursementRouter = express.Router()

cashDisbursementRouter.get('/', getCashDisbursements)
cashDisbursementRouter.get('/:cash_disbursement_id', getAllCashDisbursements)
cashDisbursementRouter.post('/', createCashDisbursement)
cashDisbursementRouter.put('/disbursement-state', updateDisbursementState)
cashDisbursementRouter.put('/:cash_disbursement_id', updateCashDisbursement)
cashDisbursementRouter.get('/print/:cash_disbursement_id', getPrintDisbursements)

module.exports = {
  cashDisbursementRouter,
}
