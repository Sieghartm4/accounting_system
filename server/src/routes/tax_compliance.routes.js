const express = require('express')
const { auth } = require('../middlewares/auth.middleware')
const {
  saveTaxFormDraft,
  exportTaxFormPDF,
  exportTaxFormDAT,
  exportTaxFormXML,
  markTaxFormFiled,
  getTaxFormDraft,
  calculateTaxFromJournalEntries,
} = require('../controller/tax_compliance.controller')

const taxComplianceRouter = express.Router()

// Protected routes - all require authentication
taxComplianceRouter.get('/calculate-tax', auth, calculateTaxFromJournalEntries)
taxComplianceRouter.post('/save-draft', auth, saveTaxFormDraft)
taxComplianceRouter.post('/export-pdf', auth, exportTaxFormPDF)
taxComplianceRouter.post('/export-dat', auth, exportTaxFormDAT)
taxComplianceRouter.post('/export-xml', auth, exportTaxFormXML)
taxComplianceRouter.post('/mark-filed', auth, markTaxFormFiled)
taxComplianceRouter.get('/draft/:id', auth, getTaxFormDraft)

module.exports = { taxComplianceRouter }
