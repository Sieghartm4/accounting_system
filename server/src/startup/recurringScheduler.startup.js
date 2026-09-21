'use strict'

const { runRecurringSchedulerTick } = require('../util/recurringJournal.util')

require('dotenv').config()

let timer = null

const DEFAULT_INTERVAL_MIN = 10

const getIntervalMs = () => {
  const raw = parseInt(process.env.RECURRING_SCHEDULER_INTERVAL_MIN, 10)
  const minutes = Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_INTERVAL_MIN
  return minutes * 60 * 1000
}

const initRecurringScheduler = () => {
  if (timer) {
    console.log('⏰ Recurring scheduler already initialized, skipping')
    return timer
  }

  // Run the first tick shortly after startup (delayed so the server is ready).
  setTimeout(() => {
    runRecurringSchedulerTick().catch((err) => {
      console.error('⏰ Recurring scheduler initial tick failed:', err.message)
    })
  }, 60 * 1000)

  timer = setInterval(() => {
    runRecurringSchedulerTick().catch((err) => {
      console.error('⏰ Recurring scheduler tick failed:', err.message)
    })
  }, getIntervalMs())

  console.log(
    `⏰ Recurring scheduler started (interval: ${getIntervalMs() / 60000} min)`,
  )

  return timer
}

const stopRecurringScheduler = () => {
  if (timer) {
    clearInterval(timer)
    timer = null
    console.log('⏰ Recurring scheduler stopped')
  }
}

module.exports = { initRecurringScheduler, stopRecurringScheduler }