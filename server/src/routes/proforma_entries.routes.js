const express = require('express')
const { getProformaEntries, createProformaEntries, updateProformaEntries, importProformaEntries } = require('../controller/proforma_entries.controller')

const proformaEntriesRouter = express.Router()

proformaEntriesRouter.get('/', getProformaEntries)
proformaEntriesRouter.post('/', createProformaEntries)
proformaEntriesRouter.put('/:id', updateProformaEntries)
proformaEntriesRouter.post('/import', importProformaEntries)

module.exports = {
  proformaEntriesRouter,
}
