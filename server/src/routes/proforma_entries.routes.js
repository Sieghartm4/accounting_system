const express = require('express')
const { getProformaEntries, createProformaEntries } = require('../controller/proforma_entries.controller')

const proformaEntriesRouter = express.Router()

proformaEntriesRouter.get('/', getProformaEntries)
proformaEntriesRouter.post('/', createProformaEntries)

module.exports = {
  proformaEntriesRouter,
}
