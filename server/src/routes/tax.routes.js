const express = require('express')
const { auth } = require('../middlewares/auth.middleware')
const {
  getRegistry,
  getOneForm,
  getRegistryDrift,
  getApplicability,
  getDeadlines,
  readProfile,
  writeProfile,
  postCompute,
  getFilings,
  getFilingById,
  postAcknowledge,
  postMarkFiled,
  getInputs,
  putInputs,
  getRemittances,
  postRemittance,
  getCertificates,
} = require('../controller/tax.controller')

const taxRouter = express.Router()

/**
 * Registry-driven tax compliance API.
 *
 * Every route requires authentication, and every route that touches a filing
 * requires an explicit `companyId` that is verified against the tenant. The
 * company is a parameter rather than an implicit default because the JWT does
 * not carry one and `master_company` holds more than one company per tenant.
 *
 * The legacy `tax_compliance.routes.js` remains mounted for the old client.
 * It is the only place left that hardcodes a TIN and defaults a company to 1;
 * it should come out with the client rewrite, not before.
 */

// --- registry / metadata ---------------------------------------------------
taxRouter.get('/registry', auth, getRegistry)
taxRouter.get('/registry/drift', auth, getRegistryDrift)
taxRouter.get('/forms/:formCode', auth, getOneForm)

// --- what applies, and when it is due --------------------------------------
taxRouter.get('/applicability', auth, getApplicability)
taxRouter.get('/deadlines', auth, getDeadlines)

// --- taxpayer profile ------------------------------------------------------
taxRouter.get('/profile', auth, readProfile)
taxRouter.put('/profile', auth, writeProfile)

// --- compute and file ------------------------------------------------------
// Preview does not persist. `{"save": true}` is the only way to create filing
// rows, so loading a page never creates filings as a side effect.
taxRouter.post('/compute', auth, postCompute)
taxRouter.get('/filings', auth, getFilings)
taxRouter.get('/filings/:filingId', auth, getFilingById)
taxRouter.post('/filings/:filingId/acknowledge', auth, postAcknowledge)
taxRouter.post('/filings/:filingId/file', auth, postMarkFiled)

// --- inputs and remittances ------------------------------------------------
taxRouter.get('/inputs', auth, getInputs)
taxRouter.put('/inputs', auth, putInputs)
taxRouter.get('/remittances', auth, getRemittances)
taxRouter.post('/remittances', auth, postRemittance)

// 2307 certificates. `latest` in the response is the generation each payee is
// actually entitled to hold, which is what a payee-facing lookup needs.
taxRouter.get('/certificates', auth, getCertificates)

module.exports = { taxRouter }
