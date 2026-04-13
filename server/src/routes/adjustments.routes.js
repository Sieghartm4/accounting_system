const express = require('express')
const { getAdjustments, createAdjustment } = require('../controller/adjustments.controller')

const adjustmentsRouter = express.Router()

adjustmentsRouter.get('/', getAdjustments)
adjustmentsRouter.post('/', createAdjustment)

module.exports = {
  adjustmentsRouter
}
