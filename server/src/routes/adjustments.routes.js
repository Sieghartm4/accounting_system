const express = require('express')
const { getAdjustments, createAdjustment, getAdjustmentById, getAdjustmentAttachments, updateAdjustment, updateAdjustmentData, cancelAdjustmentState } = require('../controller/adjustments.controller')

const adjustmentsRouter = express.Router()

adjustmentsRouter.get('/', getAdjustments)
adjustmentsRouter.post('/', createAdjustment)
adjustmentsRouter.put('/adjustment-state', updateAdjustment)
adjustmentsRouter.put('/cancel-state', cancelAdjustmentState)
adjustmentsRouter.get('/:adjustment_id/attachments', getAdjustmentAttachments)
adjustmentsRouter.get('/:adjustment_id', getAdjustmentById)
adjustmentsRouter.put('/:adjustment_id', updateAdjustmentData)

module.exports = {
  adjustmentsRouter
}
