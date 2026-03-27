const express = require('express')
const { getJournalEntries } = require('../controller/journal_entries.controller')

const journalEntriesRouter = express.Router()

journalEntriesRouter.get('/', getJournalEntries)

module.exports = {
  journalEntriesRouter,
}
