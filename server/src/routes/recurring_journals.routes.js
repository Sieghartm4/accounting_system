const express = require('express')
const {
  getRecurringJournals,
  getRecurringJournalById,
  createRecurringJournal,
  updateRecurringJournal,
  deleteRecurringJournal,
  generateNow,
  generateAllNow,
} = require('../controller/recurring_journals.controller')

const recurringJournalsRouter = express.Router()

recurringJournalsRouter.get('/', getRecurringJournals)
recurringJournalsRouter.post('/generate-all', generateAllNow)
recurringJournalsRouter.get('/:journal_id', getRecurringJournalById)
recurringJournalsRouter.post('/', createRecurringJournal)
recurringJournalsRouter.post('/:journal_id/generate', generateNow)
recurringJournalsRouter.put('/:journal_id', updateRecurringJournal)
recurringJournalsRouter.delete('/:journal_id', deleteRecurringJournal)

module.exports = {
  recurringJournalsRouter,
}