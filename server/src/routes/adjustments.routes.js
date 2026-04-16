const express = require('express')
const { getAdjustments, createAdjustment, getAdjustmentById, updateAdjustment } = require('../controller/adjustments.controller')

const adjustmentsRouter = express.Router()

adjustmentsRouter.get('/', getAdjustments)
adjustmentsRouter.get('/:adjustment_id', getAdjustmentById)
adjustmentsRouter.post('/', createAdjustment)
adjustmentsRouter.put('/adjustment-state', updateAdjustment)

module.exports = {
  adjustmentsRouter
}
