const express = require('express')
const {
  getResponsibilityCenters,
  createResponsibilityCenter,
  updateResponsibilityCenter,
} = require('../controller/responsibility_center.controller')

const responsibilityCenterRouter = express.Router()

responsibilityCenterRouter.get('/', getResponsibilityCenters)
responsibilityCenterRouter.post('/', createResponsibilityCenter)
responsibilityCenterRouter.put('/:id', updateResponsibilityCenter)

module.exports = {
  responsibilityCenterRouter,
}
