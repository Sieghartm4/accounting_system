'use strict'

const mysql = require('mysql2/promise')
const { DecryptString } = require('./cryptography.util')
const { SQLQueryBuilder } = require('./helper.util')
const { getTenantPool } = require('../database/util/tenantConnection.util')
const { Accounting } = require('../database/model/Accounting')
const { Master } = require('../database/model/Master')
const { broadcastUpdates } = require('../startup/socket.startup')

const sql = new SQLQueryBuilder()

require('dotenv').config()

const FREQUENCIES = [
  'DAILY',
  'WEEKLY',
  'BIWEEKLY',
  'MONTHLY',
  'QUARTERLY',
  'SEMI_ANNUAL',
  'ANNUAL',
]

const MAX_OCCURRENCES_PER_RUN = 200

const toDateStr = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`

const todayStr = () => toDateStr(new Date())

const parseDate = (str) => {
  if (!str) return null
  const [y, m, d] = String(str).split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d, 12, 0, 0, 0)
}

const makeDate = (y, m, d) => new Date(y, m - 1, Math.min(d, 31), 12, 0, 0, 0)

const addDays = (date, days) =>
  makeDate(date.getFullYear(), date.getMonth() + 1, date.getDate() + days)

const daysInMonth = (year, month) => new Date(year, month, 0).getDate()

const addMonthsClamped = (date, months, day) => {
  const total = (date.getFullYear() * 12 + date.getMonth()) + months
  const year = Math.floor(total / 12)
  const month = total % 12
  const dim = daysInMonth(year, month + 1)
  return new Date(year, month, Math.min(day || date.getDate(), dim), 12, 0, 0, 0)
}

const getDayValue = (template, fallbackDate) =>
  template.day !== null && template.day !== undefined && template.day !== ''
    ? template.day
    : fallbackDate

const getWeekdayValue = (template, fallbackDate) =>
  template.day !== null && template.day !== undefined && template.day !== ''
    ? template.day
    : fallbackDate.getDay()

const firstOccurrence = (template) => {
  const start = parseDate(template.start_date) || new Date()
  const frequency = String(template.frequency || 'MONTHLY').toUpperCase()

  if (frequency === 'DAILY') {
    return start
  }

  if (frequency === 'WEEKLY' || frequency === 'BIWEEKLY') {
    const wd = getWeekdayValue(template, start)
    const delta = ((wd - start.getDay()) + 7) % 7
    return addDays(start, delta)
  }

  const dom = getDayValue(template, start.getDate())
  const dim = daysInMonth(start.getFullYear(), start.getMonth() + 1)
  const target = Math.min(dom, dim)
  const candidate = new Date(
    start.getFullYear(),
    start.getMonth(),
    target,
    12,
    0,
    0,
    0,
  )
  if (candidate.getTime() < start.getTime()) {
    return addMonthsClamped(start, 1, target)
  }
  return candidate
}

const alignWeekday = (date, wd) => {
  const delta = ((wd - date.getDay()) + 7) % 7
  return addDays(date, delta)
}

const nextOccurrence = (current, template) => {
  const interval = Math.max(1, parseInt(template.interval, 10) || 1)
  const frequency = String(template.frequency || 'MONTHLY').toUpperCase()

  switch (frequency) {
    case 'DAILY':
      return addDays(current, interval)
    case 'WEEKLY':
      return alignWeekday(addDays(current, interval * 7), getWeekdayValue(template, current))
    case 'BIWEEKLY':
      return alignWeekday(addDays(current, interval * 14), getWeekdayValue(template, current))
    case 'MONTHLY':
      return addMonthsClamped(current, interval, getDayValue(template, current.getDate()))
    case 'QUARTERLY':
      return addMonthsClamped(current, interval * 3, getDayValue(template, current.getDate()))
    case 'SEMI_ANNUAL':
      return addMonthsClamped(current, interval * 6, getDayValue(template, current.getDate()))
    case 'ANNUAL':
      return addMonthsClamped(current, interval * 12, getDayValue(template, current.getDate()))
    default:
      return addMonthsClamped(current, interval, getDayValue(template, current.getDate()))
  }
}

const isBeforeOrEqual = (a, b) => a && b && a.getTime() <= b.getTime()

const isDue = (template, today) => {
  if (String(template.status || 'ACTIVE').toUpperCase() !== 'ACTIVE') {
    console.log('❌ Template not active:', template.status)
    return false
  }

  // A NULL next_due_date means the schedule was fully consumed (no future
  // cadence within the window). NULL is the "caught up" marker, never "due".
  const nextDue = parseDate(template.next_due_date)
  console.log('📅 isDue check - next_due:', template.next_due_date, 'parsed:', nextDue, 'today:', todayStr())
  
  if (!nextDue) {
    console.log('❌ No next_due_date')
    return false
  }
  if (nextDue.getTime() > today.getTime()) {
    console.log('❌ next_due is in the future')
    return false
  }

  console.log('✅ Template is due')
  return true
}

const computeNextDue = (template, cursor, today) => {
  const endDate = parseDate(template.end_date)
  let draft = cursor
  let guard = 0
  while (draft && draft.getTime() <= today.getTime() && guard < 1000) {
    draft = nextOccurrence(draft, template)
    guard += 1
  }
  if (!draft) return null
  if (endDate && draft.getTime() > endDate.getTime()) return null
  return toDateStr(draft)
}

const nextReference = async (connection, prefix, column, table, year) => {
  const like = `${prefix}${year}-%`
  const [rows] = await connection.execute(
    `SELECT ${column} FROM ${table} WHERE ${column} LIKE ? ORDER BY ${column} DESC LIMIT 1`,
    [like],
  )
  let seq = 1
  if (rows && rows.length > 0) {
    const last = rows[0][column]
    const parts = String(last).split('-')
    const lastSeq = parseInt(parts[parts.length - 1], 10) || 0
    seq = lastSeq + 1
  }
  return `${prefix}${year}-${String(seq).padStart(4, '0')}`
}

const generateTemplateReference = async (connection) => {
  const year = new Date().getFullYear()
  return nextReference(connection, 'RJR-', 'rj_reference', 'recurring_journals', year)
}

const generateAdjustmentId = async (connection, occurrence) => {
  const mm = String(occurrence.getMonth() + 1).padStart(2, '0')
  const dd = String(occurrence.getDate()).padStart(2, '0')
  const yy = String(occurrence.getFullYear()).slice(-2)
  const idPrefix = `JV-${mm}${dd}${yy}-`
  const [existing] = await connection.execute(
    `SELECT a_id FROM adjustments WHERE a_id LIKE ? ORDER BY a_id DESC LIMIT 1`,
    [`${idPrefix}%`],
  )
  let seq = 1
  if (existing && existing.length > 0) {
    const lastId = existing[0].a_id
    const parts = lastId.split('-')
    const lastSeq = parseInt(parts[parts.length - 1], 10) || 0
    seq = lastSeq + 1
  }
  return `${idPrefix}${String(seq).padStart(4, '0')}`
}

const modelItems = (rows, prefix) => {
  const prefixArray = Array.isArray(prefix) ? prefix : [prefix]
  return (rows || []).map((row) => {
    const out = {}
    for (const key in row) {
      if (Object.prototype.hasOwnProperty.call(row, key)) {
        let newKey = key
        for (const p of prefixArray) {
          if (key.startsWith(p)) {
            newKey = key.replace(p, '')
            break
          }
        }
        out[newKey] = row[key]
      }
    }
    return out
  })
}

const insertAdjustmentForOccurrence = async (
  connection,
  template,
  items,
  occurrence,
  actor,
) => {
  const occurrenceDate = toDateStr(occurrence)
  const adjustmentId = await generateAdjustmentId(connection, occurrence)

  const totalDebit = items
    .filter((i) => String(i.type).toLowerCase() === 'debit')
    .reduce((sum, i) => sum + (parseFloat(i.amount) || 0), 0)
  const totalCredit = items
    .filter((i) => String(i.type).toLowerCase() === 'credit')
    .reduce((sum, i) => sum + (parseFloat(i.amount) || 0), 0)
  const totalAmount = Math.max(totalDebit, totalCredit)
  const now = new Date()

  const remarks =
    `[RECURRING ${template.reference}] ${template.name || ''} — occurrence ${occurrenceDate}`.trim()

  const mainQuery = sql
    .insert(Accounting.adjustments.tablename, {
      columns: Accounting.adjustments.insertColumns,
      prefix: Accounting.adjustments.prefix,
      isTransaction: true,
    })
    .build()
  await connection.execute(mainQuery, [
    adjustmentId,
    template.reference || null,
    occurrenceDate,
    remarks,
    'PREPARED',
    totalAmount,
    toDateStr(now),
    actor,
    null,
    null,
  ])

  for (const item of items) {
    const entryQuery = sql
      .insert(Accounting.journal_entries.tablename, {
        columns: Accounting.journal_entries.insertColumns,
        prefix: Accounting.journal_entries.prefix,
        isTransaction: true,
      })
      .build()
    await connection.execute(entryQuery, [
      'adjustments',
      adjustmentId,
      item.coa_id || null,
      item.responsibility_center || '',
      String(item.type).toLowerCase(),
      parseFloat(item.amount) || 0,
      occurrenceDate,
    ])
  }

  const dateLogQuery = sql
    .insert(Accounting.recurring_journal_dates.tablename, {
      columns: Accounting.recurring_journal_dates.insertColumns,
      prefix: Accounting.recurring_journal_dates.prefix,
      isTransaction: true,
    })
    .build()
  await connection.execute(dateLogQuery, [
    template.id,
    occurrenceDate,
    adjustmentId,
    toDateStr(now),
    actor,
  ])

  const auditQuery = sql
    .insert(Master.audit_trail.tablename, {
      columns: Master.audit_trail.insertColumns,
      prefix: Master.audit_trail.prefix,
      isTransaction: true,
    })
    .build()
  await connection.execute(auditQuery, [
    adjustmentId,
    'RECURRING_JOURNAL',
    actor || null,
    toDateStr(now),
    now.toTimeString().split(' ')[0],
    `CREATE: RECURRING ${template.reference} → ADJUSTMENT ${adjustmentId} (${occurrenceDate})`,
  ])

  return { id: adjustmentId, occurrenceDate, postingDate: occurrenceDate }
}

const loadTemplateItems = async (connection, journalId) => {
  const itemsQuery = sql
    .selectAll()
    .from(Accounting.recurring_journal_items.tablename)
    .where(Accounting.recurring_journal_items.selectOptionColumns.journal_id)
    .orderBy(Accounting.recurring_journal_items.selectOptionColumns.id, 'ASC')
    .build()
  const [rows] = await connection.execute(itemsQuery, [journalId])
  return modelItems(rows, Accounting.recurring_journal_items.prefix_)
}

const loadExistingOccurrences = async (connection, journalId) => {
  const query = sql
    .select([`${Accounting.recurring_journal_dates.selectOptionColumns.occurrence_date} AS occurrence_date`])
    .from(Accounting.recurring_journal_dates.tablename)
    .where(Accounting.recurring_journal_dates.selectOptionColumns.journal_id)
    .build()
  const [rows] = await connection.execute(query, [journalId])
  return new Set((rows || []).map((r) => String(r.occurrence_date)))
}

const updateTemplateProgress = async (
  connection,
  template,
  lastGeneratedDate,
  nextDue,
  actor,
) => {
  const updQuery = sql
    .update(Accounting.recurring_journals.tablename)
    .set([
      Accounting.recurring_journals.selectOptionColumns.last_generated_date,
      Accounting.recurring_journals.selectOptionColumns.next_due_date,
      Accounting.recurring_journals.selectOptionColumns.updated_date,
      Accounting.recurring_journals.selectOptionColumns.updated_by,
    ])
    .where(Accounting.recurring_journals.selectOptionColumns.id)
    .build()
  await connection.execute(updQuery, [
    lastGeneratedDate,
    nextDue,
    todayStr(),
    actor,
    template.id,
  ])
}

const broadcastGeneratedAdjustments = (generated) => {
  for (const g of generated) {
    broadcastUpdates(
      {
        adjustment: {
          id: g.id,
          document_reference: g.reference || null,
          posting_date: g.occurrenceDate,
          total_amount: g.totalAmount,
          prepared_by: g.actor,
          status: 'PREPARED',
        },
      },
      'adjustment_created',
    )
  }
  if (generated.length > 0) {
    broadcastUpdates({ count: generated.length }, 'recurring_journal_generated')
  }
}

/**
 * Generate all due occurrences for a single template. Runs inside the caller's
 * transaction (connection must already have begun a transaction).
 *
 * @returns {Promise<Array>} generated adjustment summaries
 */
const generateDueRecurringJournalEntries = async (connection, template, actor = 'SYSTEM (Recurring)') => {
  const today = new Date()
  console.log('🔄 Generating for template:', template.reference, 'next_due:', template.next_due_date, 'today:', todayStr())

  if (!isDue(template, today)) {
    console.log('❌ Template not due - skipping')
    return []
  }

  const items = await loadTemplateItems(connection, template.id)
  console.log('📝 Loaded items count:', items.length)
  if (!items || items.length === 0) {
    console.log('❌ No journal items found - cannot generate')
    return []
  }

  const existingOccurrences = await loadExistingOccurrences(connection, template.id)
  console.log('📅 Existing occurrences:', Array.from(existingOccurrences))

  let cursor = firstOccurrence(template)
  console.log('📅 First occurrence:', toDateStr(cursor))
  
  const storedNextDue = parseDate(template.next_due_date)
  if (storedNextDue && storedNextDue.getTime() > cursor.getTime()) {
    cursor = storedNextDue
    console.log('📅 Using stored next_due as cursor:', toDateStr(cursor))
  }

  const endDate = parseDate(template.end_date)
  console.log('📅 End date:', template.end_date, 'parsed:', endDate)
  
  const generated = []
  let guard = 0

  while (
    cursor &&
    cursor.getTime() <= today.getTime() &&
    guard < MAX_OCCURRENCES_PER_RUN
  ) {
    guard += 1
    console.log(`🔄 Loop iteration ${guard}: cursor=${toDateStr(cursor)}, today=${todayStr()}`)
    
    if (endDate && cursor.getTime() > endDate.getTime()) {
      console.log('❌ Cursor past end date, breaking')
      break
    }

    const occurrenceStr = toDateStr(cursor)
    console.log('📅 Checking occurrence:', occurrenceStr, 'already exists:', existingOccurrences.has(occurrenceStr))
    
    if (!existingOccurrences.has(occurrenceStr)) {
      console.log('✅ Generating adjustment for:', occurrenceStr)
      const result = await insertAdjustmentForOccurrence(
        connection,
        template,
        items,
        cursor,
        actor,
      )
      generated.push({
        ...result,
        reference: template.reference,
        actor,
        totalAmount: items
          .filter((i) => String(i.type).toLowerCase() === 'debit')
          .reduce((sum, i) => sum + (parseFloat(i.amount) || 0), 0),
      })
      existingOccurrences.add(occurrenceStr)
    } else {
      console.log('⏭️ Skipping already generated occurrence:', occurrenceStr)
    }
    cursor = nextOccurrence(cursor, template)
  }

  if (generated.length > 0 || template.next_due_date) {
    const lastGenerated = generated.length
      ? generated[generated.length - 1].occurrenceDate
      : template.last_generated_date || null
    const nextDue = computeNextDue(template, cursor, today)
    console.log('📅 Updating template progress - lastGenerated:', lastGenerated, 'nextDue:', nextDue)
    await updateTemplateProgress(connection, template, lastGenerated, nextDue, actor)
  }

  console.log('🎉 Generation complete - generated count:', generated.length)
  return generated
}

/**
 * Run due-generations for every active template in a tenant database.
 * Opens its own connection + transaction; commits all templates atomically.
 */
const generateDueForTenant = async (tenantDb = null, actor = 'SYSTEM (Recurring)') => {
  const pool = getTenantPool(tenantDb)
  const connection = await pool.getConnection()
  let allGenerated = []
  try {
    await connection.beginTransaction()

    const nowValue = todayStr()
    const [dueRows] = await connection.execute(
      `SELECT * FROM recurring_journals
       WHERE rj_status = 'ACTIVE'
         AND rj_start_date <= ?
         AND (rj_end_date IS NULL OR rj_end_date >= ?)
         AND (rj_next_due_date IS NULL OR rj_next_due_date <= ?)`,
      [nowValue, nowValue, nowValue],
    )

    for (const row of dueRows) {
      const tpl = modelItems([row], [Accounting.recurring_journals.prefix_])[0]
      const generated = await generateDueRecurringJournalEntries(connection, tpl, actor)
      allGenerated = allGenerated.concat(generated)
    }

    await connection.commit()
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback()
      } catch (rbError) {
        console.error('Recurring rollback error:', rbError)
      }
    }
    throw error
  } finally {
    if (connection) connection.release()
  }

  broadcastGeneratedAdjustments(allGenerated)
  return allGenerated
}

const listTenantDatabases = async () => {
  const host = process.env._HOST_ADMIN
  const user = process.env._USER_ADMIN
  const password = DecryptString(process.env._PASSWORD_ADMIN)
  const database = process.env._DATABASE_ADMIN

  const dbs = new Set()
  if (database) dbs.add(database)

  let connection
  try {
    connection = await mysql.createConnection({ host, user, password, database })
    const [rows] = await connection.query(
      `SELECT DISTINCT db_name FROM master_user WHERE db_name IS NOT NULL AND db_name <> ''`,
    )
    for (const r of rows || []) {
      if (r.db_name) dbs.add(r.db_name)
    }
  } catch (error) {
    console.error('Error listing tenant databases:', error.message)
  } finally {
    if (connection) await connection.end()
  }

  return [...dbs]
}

/**
 * Scheduler tick: runs due-generation for all tenant databases. Guarded against
 * overlapping runs.
 */
const runRecurringSchedulerTick = async () => {
  if (runRecurringSchedulerTick.isRunning) {
    console.log('⏰ Recurring scheduler: previous run still active, skipping tick')
    return { skipped: true }
  }
  runRecurringSchedulerTick.isRunning = true
  const failures = []
  let totalGenerated = 0
  try {
    const dbs = await listTenantDatabases()
    console.log(`⏰ Recurring scheduler tick: processing ${dbs.length} tenant DB(s)`)
    for (const db of dbs) {
      try {
        const generated = await generateDueForTenant(db, 'SYSTEM (Recurring)')
        totalGenerated += generated.length
        if (generated.length > 0) {
          console.log(
            `⏰ Recurring scheduler: generated ${generated.length} adjustment(s) in ${db}`,
          )
        }
      } catch (error) {
        console.error(`⏰ Recurring scheduler: failed for ${db}:`, error.message)
        failures.push(db)
      }
    }
    console.log(`⏰ Recurring scheduler tick complete: ${totalGenerated} generated`)
  } finally {
    runRecurringSchedulerTick.isRunning = false
  }
  return { totalGenerated, failures }
}

module.exports = {
  FREQUENCIES,
  todayStr,
  toDateStr,
  parseDate,
  firstOccurrence,
  nextOccurrence,
  computeNextDue,
  generateTemplateReference,
  generateDueRecurringJournalEntries,
  generateDueForTenant,
  listTenantDatabases,
  runRecurringSchedulerTick,
}