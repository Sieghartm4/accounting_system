const express = require('express')
const {
  getJournalEntries,
  getJournalEntriesByCoaId,
  createJournalEntries,
} = require('../controller/journal_entries.controller')

const journalEntriesRouter = express.Router()

journalEntriesRouter.get('/', getJournalEntries)
journalEntriesRouter.get('/coa/:coa_id', getJournalEntriesByCoaId)
journalEntriesRouter.post('/', createJournalEntries)

module.exports = {
  journalEntriesRouter,
}
