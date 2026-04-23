const express = require('express')
const { getProformaEntries, createProformaEntries, updateProformaEntries } = require('../controller/proforma_entries.controller')

const proformaEntriesRouter = express.Router()

proformaEntriesRouter.get('/', getProformaEntries)
proformaEntriesRouter.post('/', createProformaEntries)
proformaEntriesRouter.put('/:id', updateProformaEntries)

module.exports = {
  proformaEntriesRouter,
}
