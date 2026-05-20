const express = require('express')
const {
  getAuditTrail,
  createAuditTrail,
  getAuditTrailById,
} = require('../controller/audit_trail.controller')

const auditTrailRouter = express.Router()

auditTrailRouter.get('/', getAuditTrail)
auditTrailRouter.post('/', createAuditTrail)
auditTrailRouter.get('/:id', getAuditTrailById)

module.exports = {
  auditTrailRouter,
}
