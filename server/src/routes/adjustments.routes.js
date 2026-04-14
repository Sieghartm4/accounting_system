const express = require('express')
const { getAdjustments, createAdjustment, getAdjustmentById } = require('../controller/adjustments.controller')

const adjustmentsRouter = express.Router()

adjustmentsRouter.get('/', getAdjustments)
adjustmentsRouter.get('/:adjustment_id', getAdjustmentById)
adjustmentsRouter.post('/', createAdjustment)

module.exports = {
  adjustmentsRouter
}
