const express = require('express')
const {
  getJournalEntries,
  getJournalEntriesByCoaId,
} = require('../controller/journal_entries.controller')

const journalEntriesRouter = express.Router()

journalEntriesRouter.get('/', getJournalEntries)
journalEntriesRouter.get('/coa/:coa_id', getJournalEntriesByCoaId)

module.exports = {
  journalEntriesRouter,
}
