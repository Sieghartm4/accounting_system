const express = require('express')
const {
  getJournalEntries,
  getJournalEntriesByCoaId,
  createJournalEntries,
  reverseJournalEntries,
} = require('../controller/journal_entries.controller')

const journalEntriesRouter = express.Router()

journalEntriesRouter.get('/', getJournalEntries)
journalEntriesRouter.get('/coa/:coa_id', getJournalEntriesByCoaId)
journalEntriesRouter.post('/', createJournalEntries)
journalEntriesRouter.post('/reverse', reverseJournalEntries)

module.exports = {
  journalEntriesRouter,
}