const express = require('express')
const { getProformaEntries } = require('../controller/proforma_entries.controller')

const proformaEntriesRouter = express.Router()

proformaEntriesRouter.get('/', getProformaEntries)

module.exports = {
  proformaEntriesRouter,
}
