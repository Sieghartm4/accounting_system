const express = require('express')
const {
  getResponsibilityCenters,
  createResponsibilityCenter,
  updateResponsibilityCenter,
  importResponsibilityCenters,
} = require('../controller/responsibility_center.controller')

const responsibilityCenterRouter = express.Router()

responsibilityCenterRouter.get('/', getResponsibilityCenters)
responsibilityCenterRouter.post('/', createResponsibilityCenter)
responsibilityCenterRouter.put('/:id', updateResponsibilityCenter)
responsibilityCenterRouter.post('/import', importResponsibilityCenters)

module.exports = {
  responsibilityCenterRouter,
}
