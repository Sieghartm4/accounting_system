const os = require('os')
const {
  checkConnection,
  SelectAll,
  Transaction,
  Query,
  Insert,
} = require('../database/util/queries.util')
const {
  formatMemoryUsage,
  formatTime,
  DataModeling,
} = require('../util/helper.util')
const { Master } = require('../database/model/Master')
const { Accounting } = require('../database/model/Accounting')
const { SQLQueryBuilder } = require('../util/helper.util')
const { getTenantPool } = require('../database/util/tenantConnection.util')
const sql = new SQLQueryBuilder()

require('dotenv').config()

const normalizeAccountKey = (value) => {
  if (value === undefined || value === null) return null
  const normalized = String(value).trim()
  if (normalized === '') return null
  return normalized
}

const isNumericAccountKey = (value) => {
  const normalized = normalizeAccountKey(value)
  if (normalized === null) return false
  return !Number.isNaN(Number(normalized))
}

const resolveChartOfAccountIds = async (connection, journalEntries) => {
  const textAccountKeys = [
    ...new Set(
      journalEntries
        .map((entry) => normalizeAccountKey(entry.account_id))
        .filter((key) => key !== null && !isNumericAccountKey(key))
        .map((key) => key.toLowerCase()),
    ),
  ]

  if (textAccountKeys.length === 0) {
    return {}
  }

  const placeholders = textAccountKeys.map(() => '?').join(',')
  const sqlQuery = `SELECT ${Master.charts_of_accounts.selectOptionColumns.id} AS id,
                             ${Master.charts_of_accounts.selectOptionColumns.name} AS name,
                             ${Master.charts_of_accounts.selectOptionColumns.code} AS code
                      FROM ${Master.charts_of_accounts.tablename}
                      WHERE LOWER(${Master.charts_of_accounts.selectOptionColumns.name}) IN (${placeholders})
                         OR LOWER(${Master.charts_of_accounts.selectOptionColumns.code}) IN (${placeholders})`
  const params = [...textAccountKeys, ...textAccountKeys]
  const [rows] = await connection.execute(sqlQuery, params)

  const lookup = {}
  for (const row of rows) {
    if (row.name) {
      lookup[String(row.name).trim().toLowerCase()] = row.id
    }
    if (row.code) {
      lookup[String(row.code).trim().toLowerCase()] = row.id
    }
  }

  return lookup
}

const getAdjustments = async (req, res, next) => {
  try {
    const query = sql
      .select([
        { col: Accounting.adjustments.selectOptionColumns.id, as: 'id' },
        {
          col: Accounting.adjustments.selectOptionColumns.document_reference,
          as: 'document_reference',
        },
        {
          col: Accounting.adjustments.selectOptionColumns.posting_date,
          as: 'posting_date',
        },
        {
          col: Accounting.adjustments.selectOptionColumns.total_amount,
          as: 'total_amount',
        },
        {
          col: Accounting.adjustments.selectOptionColumns.created_by,
          as: 'prepared_by',
        },
        { col: Accounting.adjustments.selectOptionColumns.status, as: 'status' },
      ])
      .from(Accounting.adjustments.tablename)
      .build()

    let result = await Query(query, [], [Accounting.adjustments.prefix_])
    res.status(200).json({
      success: true,
      message: 'Adjustments retrieved successfully',
      data: result,
      count: result.length,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error fetching adjustments:', error)
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching adjustments',
      error:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Internal server error',
    })
  }
}

const getAdjustmentById = async (req, res, next) => {
  try {
    const { adjustment_id } = req.params
    console.log('adjustment_id', adjustment_id)
    const adjustmentId = Number(adjustment_id)
    if (!adjustment_id || isNaN(adjustmentId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid adjustment ID provided',
        timestamp: new Date().toISOString(),
      })
    }

    // Main adjustment query
    const adjustment_query = sql
      .select([
        { col: Accounting.adjustments.selectOptionColumns.id, as: 'id' },
        {
          col: Accounting.adjustments.selectOptionColumns.document_reference,
          as: 'document_reference',
        },
        {
          col: Accounting.adjustments.selectOptionColumns.posting_date,
          as: 'posting_date',
        },
        { col: Accounting.adjustments.selectOptionColumns.remarks, as: 'remarks' },
        { col: Accounting.adjustments.selectOptionColumns.status, as: 'status' },
        {
          col: Accounting.adjustments.selectOptionColumns.total_amount,
          as: 'total_amount',
        },
        {
          col: Accounting.adjustments.selectOptionColumns.created_date,
          as: 'created_date',
        },
        {
          col: Accounting.adjustments.selectOptionColumns.created_by,
          as: 'created_by',
        },
      ])
      .from(Accounting.adjustments.tablename)
      .where(Accounting.adjustments.selectOptionColumns.id)
      .build()

    let adjustment = await Query(
      adjustment_query,
      [adjustmentId],
      [Accounting.adjustments.prefix_],
    )

    // Attachments query
    const adjustment_attachments_query = sql
      .select([
        { col: Accounting.adjustment_attachments.selectOptionColumns.id, as: 'id' },
        {
          col: Accounting.adjustment_attachments.selectOptionColumns.name,
          as: 'name',
        },
        {
          col: Accounting.adjustment_attachments.selectOptionColumns.file,
          as: 'file',
        },
        {
          col: Accounting.adjustment_attachments.selectOptionColumns.remarks,
          as: 'remarks',
        },
        {
          col: Accounting.adjustment_attachments.selectOptionColumns.uploaded_by,
          as: 'uploaded_by',
        },
        {
          col: Accounting.adjustment_attachments.selectOptionColumns.uploaded_date,
          as: 'uploaded_date',
        },
      ])
      .from(Accounting.adjustment_attachments.tablename)
      .where(Accounting.adjustment_attachments.selectOptionColumns.adjustment_id)
      .build()

    let adjustment_attachments = await Query(
      adjustment_attachments_query,
      [adjustmentId],
      [Accounting.adjustment_attachments.prefix_],
    )

    // Journal entries query
    const journal_entries_query = sql
      .select([
        { col: Accounting.journal_entries.selectOptionColumns.id, as: 'id' },
        { col: Accounting.journal_entries.selectOptionColumns.coa_id, as: 'coa_id' },
        {
          col: Master.charts_of_accounts.selectOptionColumns.name,
          as: 'account_name',
        },
        {
          col: Accounting.journal_entries.selectOptionColumns.responsibility_center,
          as: 'responsibility_center',
        },
        { col: Accounting.journal_entries.selectOptionColumns.type, as: 'type' },
        { col: Accounting.journal_entries.selectOptionColumns.amount, as: 'amount' },
        { col: Accounting.journal_entries.selectOptionColumns.date, as: 'date' },
      ])
      .from(Accounting.journal_entries.tablename)
      .innerJoin(
        Master.charts_of_accounts.tablename,
        Accounting.journal_entries.selectOptionColumns.coa_id,
        Master.charts_of_accounts.selectOptionColumns.id,
      )
      .where(Accounting.journal_entries.selectOptionColumns.db_name)
      .andWhere(Accounting.journal_entries.selectOptionColumns.db_id)
      .build()

    let journal_entries = await Query(
      journal_entries_query,
      ['adjustments', adjustmentId],
      [Accounting.journal_entries.prefix_],
    )

    console.log(adjustment, adjustment_attachments, journal_entries)
    res.status(200).json({
      success: true,
      message: 'Adjustment retrieved successfully',
      data: adjustment,
      attachments: adjustment_attachments,
      journal_entries: journal_entries,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error fetching adjustment:', error)
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching adjustment',
      error:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Internal server error',
    })
  }
}

const createAdjustment = async (req, res, next) => {
  try {
    // Support both direct body and wrapped payloads: { data: { ... } }
    const payload = req.body && req.body.data ? req.body.data : req.body

    const {
      document_reference,
      posting_date,
      remarks,
      total_amount,
      created_by,
      checked_by,
      approved_by,
      adjustment_attachments,
      journal_entries,
    } = payload
    console.log('CREATE ADJUSTMENT: ', payload)

    if (!posting_date || !total_amount || !created_by) {
      return res.status(400).json({
        success: false,
        message: 'All required fields must be provided',
      })
    }

    let connection
    try {
      connection = await getTenantPool().getConnection()
      await connection.beginTransaction()

      const mainQuery = sql
        .insert(Accounting.adjustments.tablename, {
          columns: Accounting.adjustments.insertColumns,
          prefix: Accounting.adjustments.prefix,
          isTransaction: true,
        })
        .build()

      const mainValues = [
        document_reference || null,
        posting_date || null,
        remarks || null,
        'PREPARED',
        total_amount || null,
        new Date().toISOString().split('T')[0],
        created_by || null,
        checked_by || null,
        approved_by || null,
      ]

      const [mainResult] = await connection.execute(mainQuery, mainValues)
      const adjustmentId = mainResult.insertId

      if (adjustment_attachments && adjustment_attachments.length > 0) {
        for (const attachment of adjustment_attachments) {
          const attachmentQuery = sql
            .insert(Accounting.adjustment_attachments.tablename, {
              columns: Accounting.adjustment_attachments.insertColumns,
              prefix: Accounting.adjustment_attachments.prefix,
              isTransaction: true,
            })
            .build()

          const attachmentValues = [
            adjustmentId,
            attachment.file || null,
            attachment.name || null,
            attachment.remarks || null,
            attachment.uploaded_by || null,
            attachment.uploaded_date || new Date().toLocaleDateString(),
          ]

          await connection.execute(attachmentQuery, attachmentValues)
        }
      }

      if (journal_entries && journal_entries.length > 0) {
        const entriesNeedingLookup = journal_entries.filter(
          (entry) =>
            !entry.id &&
            normalizeAccountKey(entry.account_id) !== null &&
            !isNumericAccountKey(entry.account_id),
        )
        const accountLookup =
          entriesNeedingLookup.length > 0
            ? await resolveChartOfAccountIds(connection, entriesNeedingLookup)
            : {}

        for (const entry of journal_entries) {
          if (entry.id) {
            const updateQuery = sql
              .update(Accounting.journal_entries.tablename)
              .set([
                Accounting.journal_entries.selectOptionColumns.db_name,
                Accounting.journal_entries.selectOptionColumns.db_id,
              ])
              .where(Accounting.journal_entries.selectOptionColumns.id)
              .build()

            await connection.execute(updateQuery, [
              'adjustments',
              adjustmentId,
              entry.id,
            ])
            continue
          }

          const entryQuery = sql
            .insert(Accounting.journal_entries.tablename, {
              columns: Accounting.journal_entries.insertColumns,
              prefix: Accounting.journal_entries.prefix,
              isTransaction: true,
            })
            .build()

          const type = entry.debit > 0 ? 'debit' : 'credit'
          const amount = entry.debit > 0 ? entry.debit : entry.credit

          let accountId = normalizeAccountKey(entry.account_id)
          if (accountId !== null) {
            if (isNumericAccountKey(accountId)) {
              accountId = Number(accountId)
            } else {
              accountId = accountLookup[accountId.toLowerCase()] || null
            }
          }

          const entryValues = [
            'adjustments',
            adjustmentId,
            accountId,
            entry.responsibility_center || '',
            type,
            amount,
            new Date().toISOString().split('T')[0],
          ]

          await connection.execute(entryQuery, entryValues)
        }
      }

      // Commit transaction
      await connection.commit()

      // Audit trail for create
      const now = new Date()
      const auditQueries = []
      auditQueries.push({
        sql: sql
          .insert(Master.audit_trail.tablename, {
            columns: Master.audit_trail.insertColumns,
            prefix: Master.audit_trail.prefix,
            isTransaction: true,
          })
          .build(),
        values: [
          adjustmentId || null,
          'ADJUSTMENT',
          req.context?.username || null,
          now.toISOString().split('T')[0],
          now.toTimeString().split(' ')[0],
          `CREATE: ID ${adjustmentId}`,
        ],
      })
      await Transaction(auditQueries)

      res.status(201).json({
        success: true,
        message: 'Adjustment created successfully',
        data: { id: adjustmentId },
        timestamp: new Date().toISOString(),
      })
    } catch (error) {
      // Rollback transaction if error occurs
      if (connection) {
        await connection.rollback()
      }
      throw error
    } finally {
      // Release connection
      if (connection) {
        connection.release()
      }
    }
  } catch (error) {
    console.error('Error creating adjustment:', error)
    return res.status(500).json({
      success: false,
      message: 'Server error while creating adjustment',
      error:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Internal server error',
    })
  }
}

const updateAdjustment = async (req, res, next) => {
  try {
    const { updates } = req.body

    if (!updates || !Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Updates array is required',
      })
    }

    let connection
    try {
      connection = await getTenantPool().getConnection()
      await connection.beginTransaction()

      const updatePromises = updates.map(async (update) => {
        const { id, currentState } = update

        if (!id) {
          throw new Error('Each update requires id')
        }

        if (!currentState) {
          throw new Error(
            `Each update requires currentState. Received: ${JSON.stringify(update)}`,
          )
        }

        let nextState
        let updateQuery
        let updateValues

        if (currentState === 'PREPARED') {
          nextState = 'CHECKED'
          updateQuery = sql
            .update(Accounting.adjustments.tablename)
            .set([
              Accounting.adjustments.selectOptionColumns.status,
              Accounting.adjustments.selectOptionColumns.checked_by,
            ])
            .where(Accounting.adjustments.selectOptionColumns.id)
            .build()
          updateValues = [nextState, req.context.username, id]
        } else if (currentState === 'CHECKED') {
          nextState = 'APPROVED'
          updateQuery = sql
            .update(Accounting.adjustments.tablename)
            .set([
              Accounting.adjustments.selectOptionColumns.status,
              Accounting.adjustments.selectOptionColumns.approved_by,
            ])
            .where(Accounting.adjustments.selectOptionColumns.id)
            .build()
          updateValues = [nextState, req.context.username, id]
        } else {
          throw new Error(
            `Invalid current state: ${currentState}. Only PREPARED and CHECKED can be updated.`,
          )
        }

        return connection.execute(updateQuery, updateValues)
      })

      const results = await Promise.all(updatePromises)

      await connection.commit()

      // Audit trail for state update
      const now = new Date()

      const auditQueries = []

      updates.forEach((u) => {
        const nextState = u.currentState === 'PREPARED' ? 'CHECKED' : 'APPROVED'

        auditQueries.push({
          sql: sql
            .insert(Master.audit_trail.tablename, {
              columns: Master.audit_trail.insertColumns,
              prefix: Master.audit_trail.prefix,
              isTransaction: true,
            })
            .build(),

          values: [
            u.id, // FIXED: replace null with adjustment ID

            'ADJUSTMENT_STATE',

            req.context?.username || null,

            now.toISOString().split('T')[0],

            now.toTimeString().split(' ')[0],

            `STATE UPDATE: ${u.currentState} → ${nextState}`,
          ],
        })
      })

      await Transaction(auditQueries)
      res.status(200).json({
        success: true,
        message: `${results.length} adjustment(s) updated successfully`,
        data: {
          updatedCount: results.length,
          updates: results.map((result) => ({ id: result.insertId })),
        },
        timestamp: new Date().toISOString(),
      })
    } catch (error) {
      if (connection) {
        await connection.rollback()
      }
      throw error
    } finally {
      if (connection) {
        connection.release()
      }
    }
  } catch (error) {
    console.error('Error updating adjustments:', error)
    return res.status(500).json({
      success: false,
      message: 'Server error while updating adjustments',
      error:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Internal server error',
    })
  }
}

const updateAdjustmentData = async (req, res, next) => {
  try {
    const { adjustment_id } = req.params
    const {
      document_reference,
      posting_date,
      remarks,
      total_amount,
      adjustment_attachments,
      journal_entries,
    } = req.body

    console.log('Updating adjustment data:', req.body)

    const adjustmentId = Number(adjustment_id)
    if (!adjustment_id || isNaN(adjustmentId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid adjustment ID provided',
        timestamp: new Date().toISOString(),
      })
    }

    if (!document_reference || !posting_date || !total_amount) {
      return res.status(400).json({
        success: false,
        message: 'Required fields must be provided',
      })
    }

    let connection
    try {
      connection = await getTenantPool().getConnection()
      await connection.beginTransaction()

      // Fetch current data for audit trail BEFORE making any updates
      const currentAdjustmentQuery = sql
        .select([
          {
            col: Accounting.adjustments.selectOptionColumns.document_reference,
            as: 'document_reference',
          },
          {
            col: Accounting.adjustments.selectOptionColumns.posting_date,
            as: 'posting_date',
          },
          { col: Accounting.adjustments.selectOptionColumns.remarks, as: 'remarks' },
          {
            col: Accounting.adjustments.selectOptionColumns.total_amount,
            as: 'total_amount',
          },
        ])
        .from(Accounting.adjustments.tablename)
        .where(Accounting.adjustments.selectOptionColumns.id)
        .build()

      const [currentAdjustmentData] = await connection.execute(
        currentAdjustmentQuery,
        [adjustmentId],
      )

      // Fetch current journal entries BEFORE updates
      let currentJournalData = []
      if (journal_entries && journal_entries.length > 0) {
        const currentJournalQuery = sql
          .select([
            { col: Accounting.journal_entries.selectOptionColumns.id, as: 'id' },
            {
              col: Accounting.journal_entries.selectOptionColumns.coa_id,
              as: 'account_id',
            },
            {
              col: Accounting.journal_entries.selectOptionColumns
                .responsibility_center,
              as: 'responsibility_center',
            },
            {
              col: Accounting.journal_entries.selectOptionColumns.amount,
              as: 'amount',
            },
            { col: Accounting.journal_entries.selectOptionColumns.type, as: 'type' },
          ])
          .from(Accounting.journal_entries.tablename)
          .where(Accounting.journal_entries.selectOptionColumns.db_name)
          .andWhere(Accounting.journal_entries.selectOptionColumns.db_id)
          .build()

        currentJournalData = await connection.execute(currentJournalQuery, [
          'adjustments',
          adjustmentId,
        ])
      }

      // Fetch current attachments BEFORE updates
      let currentAttachmentsData = []
      const currentAttachmentsQuery = sql
        .select([
          {
            col: Accounting.adjustment_attachments.selectOptionColumns.id,
            as: 'id',
          },
          {
            col: Accounting.adjustment_attachments.selectOptionColumns.name,
            as: 'name',
          },
          {
            col: Accounting.adjustment_attachments.selectOptionColumns.remarks,
            as: 'remarks',
          },
        ])
        .from(Accounting.adjustment_attachments.tablename)
        .where(Accounting.adjustment_attachments.selectOptionColumns.adjustment_id)
        .build()

      currentAttachmentsData = await connection.execute(currentAttachmentsQuery, [
        adjustmentId,
      ])

      // Update adjustment header
      const updateHeaderQuery = sql
        .update(Accounting.adjustments.tablename)
        .set([
          Accounting.adjustments.selectOptionColumns.document_reference,
          Accounting.adjustments.selectOptionColumns.posting_date,
          Accounting.adjustments.selectOptionColumns.remarks,
          Accounting.adjustments.selectOptionColumns.total_amount,
        ])
        .where(Accounting.adjustments.selectOptionColumns.id)
        .build()

      const headerValues = [
        document_reference || null,
        posting_date || null,
        remarks || null,
        total_amount || null,
        adjustmentId,
      ]

      await connection.execute(updateHeaderQuery, headerValues)

      // Delete existing journal entries for this adjustment
      const deleteJournalQuery = sql
        .delete(Accounting.journal_entries.tablename)
        .where(Accounting.journal_entries.selectOptionColumns.db_name)
        .andWhere(Accounting.journal_entries.selectOptionColumns.db_id)
        .build()

      await connection.execute(deleteJournalQuery, ['adjustments', adjustmentId])

      // Insert new journal entries
      if (journal_entries && journal_entries.length > 0) {
        for (const entry of journal_entries) {
          const entryQuery = sql
            .insert(Accounting.journal_entries.tablename, {
              columns: Accounting.journal_entries.insertColumns,
              prefix: Accounting.journal_entries.prefix,
              isTransaction: true,
            })
            .build()

          const type = entry.debit > 0 ? 'debit' : 'credit'
          const amount = entry.debit > 0 ? entry.debit : entry.credit

          const entryValues = [
            'adjustments',
            adjustmentId,
            entry.account_id || null,
            entry.responsibility_center || '',
            type,
            amount,
            new Date().toISOString().split('T')[0],
          ]

          await connection.execute(entryQuery, entryValues)
        }
      }

      // Delete existing attachments for this adjustment
      const deleteAttachmentsQuery = sql
        .delete(Accounting.adjustment_attachments.tablename)
        .where(Accounting.adjustment_attachments.selectOptionColumns.adjustment_id)
        .build()

      await connection.execute(deleteAttachmentsQuery, [adjustmentId])

      // Insert new attachments
      if (adjustment_attachments && adjustment_attachments.length > 0) {
        for (const attachment of adjustment_attachments) {
          const attachmentQuery = sql
            .insert(Accounting.adjustment_attachments.tablename, {
              columns: Accounting.adjustment_attachments.insertColumns,
              prefix: Accounting.adjustment_attachments.prefix,
              isTransaction: true,
            })
            .build()

          const attachmentValues = [
            adjustmentId,
            attachment.file || null,
            attachment.name || null,
            attachment.remarks || null,
            attachment.uploaded_by || null,
            attachment.uploaded_date || new Date().toLocaleDateString(),
          ]

          await connection.execute(attachmentQuery, attachmentValues)
        }
      }

      // Commit transaction
      await connection.commit()

      // Track changes for audit trail using data fetched earlier
      const auditChanges = []

      // Helper function to normalize values for comparison
      const normalizeValue = (val) =>
        val === null || val === undefined ? '' : String(val).trim()
      const normalizeNumber = (val) =>
        val === null || val === undefined
          ? 0
          : parseFloat(parseFloat(val).toFixed(2))

      console.log('DEBUG: Current adjustment data:', currentAdjustmentData)
      console.log('DEBUG: Request body data:', {
        document_reference,
        posting_date,
        remarks,
        total_amount,
      })
      console.log('DEBUG: Journal entries data:', journal_entries)
      console.log('DEBUG: Attachments data:', adjustment_attachments)

      if (currentAdjustmentData.length > 0) {
        const current = currentAdjustmentData[0]

        const currentDocRef = normalizeValue(current.document_reference)
        const newDocRef = normalizeValue(document_reference)
        console.log('DEBUG: Doc Ref comparison:', {
          current: currentDocRef,
          new: newDocRef,
          changed: currentDocRef !== newDocRef,
        })
        if (currentDocRef !== newDocRef) {
          auditChanges.push(
            `Doc Ref: ${currentDocRef || 'NULL'} → ${newDocRef || 'NULL'}`,
          )
        }

        const currentPostingDate = normalizeValue(current.posting_date)
        const newPostingDate = normalizeValue(posting_date)
        if (currentPostingDate !== newPostingDate) {
          auditChanges.push(
            `Posting Date: ${currentPostingDate || 'NULL'} → ${newPostingDate || 'NULL'}`,
          )
        }

        const currentRemarks = normalizeValue(current.remarks)
        const newRemarks = normalizeValue(remarks)
        console.log('DEBUG: Remarks comparison:', {
          current: currentRemarks,
          new: newRemarks,
          changed: currentRemarks !== newRemarks,
        })
        if (currentRemarks !== newRemarks) {
          auditChanges.push(
            `Remarks: ${currentRemarks || 'NULL'} → ${newRemarks || 'NULL'}`,
          )
        }

        if (
          normalizeNumber(current.total_amount) !== normalizeNumber(total_amount)
        ) {
          auditChanges.push(
            `Total Amount: ${current.total_amount} → ${total_amount}`,
          )
        }
      }

      // Track journal entries changes using data fetched earlier
      console.log('DEBUG: Current journal data from DB:', currentJournalData)
      if (journal_entries && journal_entries.length > 0) {
        for (let i = 0; i < journal_entries.length; i++) {
          const entry = journal_entries[i]
          console.log('DEBUG: Processing journal entry:', entry)
          const type = entry.debit > 0 ? 'debit' : 'credit'
          const amount = entry.debit > 0 ? entry.debit : entry.credit
          let currentEntry = null

          if (entry.id) {
            // Find by ID if available
            currentEntry = currentJournalData[0]?.find((j) => j.id === entry.id)
          } else {
            // If no ID, try to match by account_id, type, and position
            currentEntry = currentJournalData[0]?.find(
              (existingEntry, index) =>
                existingEntry.account_id === entry.account_id &&
                existingEntry.type.toLowerCase() === type &&
                index === i,
            )

            // If still not found, try to match by account_id and type only
            if (!currentEntry && entry.account_id) {
              currentEntry = currentJournalData[0]?.find(
                (existingEntry) =>
                  existingEntry.account_id === entry.account_id &&
                  existingEntry.type.toLowerCase() === type,
              )
            }

            // If still not found, try to match by amount and type only
            if (!currentEntry) {
              currentEntry = currentJournalData[0]?.find(
                (existingEntry) =>
                  normalizeNumber(existingEntry.amount) ===
                    normalizeNumber(amount) &&
                  existingEntry.type.toLowerCase() === type,
              )
            }
          }

          console.log('DEBUG: Found current journal entry:', currentEntry)
          if (currentEntry) {
            const currentRespCenter = normalizeValue(
              currentEntry.responsibility_center,
            )
            const newRespCenter = normalizeValue(entry.responsibility_center)
            console.log('DEBUG: Journal resp center comparison:', {
              entryId: currentEntry.id,
              current: currentRespCenter,
              new: newRespCenter,
              changed: currentRespCenter !== newRespCenter,
            })
            if (currentRespCenter !== newRespCenter) {
              auditChanges.push(
                `Journal ${currentEntry.id} Resp Center: ${currentRespCenter || 'NULL'} → ${newRespCenter || 'NULL'}`,
              )
            }

            const currentAmount = normalizeNumber(currentEntry.amount)
            const newAmount = normalizeNumber(amount)
            if (currentAmount !== newAmount) {
              auditChanges.push(
                `Journal ${currentEntry.id} Amount: ${currentAmount} → ${newAmount}`,
              )
            }

            const currentType = normalizeValue(currentEntry.type)
            if (currentType.toLowerCase() !== type.toLowerCase()) {
              auditChanges.push(
                `Journal ${currentEntry.id} Type: ${currentType} → ${type}`,
              )
            }
          } else {
            auditChanges.push(
              `Added new journal entry: ${normalizeValue(entry.responsibility_center) || 'Unassigned'}`,
            )
          }
        }
      }

      // Track attachment changes
      console.log('DEBUG: Current attachments data from DB:', currentAttachmentsData)
      console.log('DEBUG: Request attachments data:', adjustment_attachments)

      // Get existing attachments for comparison
      const existingAttachmentsQuery = sql
        .select([Accounting.adjustment_attachments.selectOptionColumns.id])
        .from(Accounting.adjustment_attachments.tablename)
        .where(Accounting.adjustment_attachments.selectOptionColumns.adjustment_id)
        .build()

      const existingAttachments = await Query(
        existingAttachmentsQuery,
        [adjustmentId],
        [Accounting.adjustment_attachments.prefix_],
      )
      const existingAttachmentIds = existingAttachments.map(
        (attachment) => attachment.id,
      )

      console.log('DEBUG: Existing attachment IDs:', existingAttachmentIds)

      if (adjustment_attachments && adjustment_attachments.length > 0) {
        // Filter out attachments with invalid IDs (null, undefined, 'null', 'undefined', empty string)
        const validAttachments = adjustment_attachments.filter(
          (attachment) =>
            attachment.id &&
            attachment.id !== null &&
            attachment.id !== undefined &&
            attachment.id !== '' &&
            attachment.id !== 'null' &&
            attachment.id !== 'undefined',
        )
        const payloadAttachmentIds = validAttachments.map(
          (attachment) => attachment.id,
        )
        console.log('DEBUG: Valid payload attachments:', validAttachments)
        console.log('DEBUG: Payload attachment IDs:', payloadAttachmentIds)

        // Find deleted attachments - IDs in DB but not in valid payload
        const deletedAttachmentIds = existingAttachmentIds.filter(
          (id) => !payloadAttachmentIds.includes(id),
        )
        console.log('DEBUG: Deleted attachment IDs:', deletedAttachmentIds)
        if (deletedAttachmentIds.length > 0) {
          for (const deletedId of deletedAttachmentIds) {
            const deletedAttachment = currentAttachmentsData[0]?.find(
              (a) => a.id === deletedId,
            )
            console.log('DEBUG: Found deleted attachment:', deletedAttachment)
            if (deletedAttachment) {
              auditChanges.push(
                `Deleted attachment: ${normalizeValue(deletedAttachment.name) || 'Unknown'} (ID: ${deletedId})`,
              )
            }
          }
        }

        for (const attachment of adjustment_attachments) {
          console.log('DEBUG: Processing attachment:', attachment)
          console.log(
            'DEBUG: Attachment ID:',
            attachment.id,
            'Type:',
            typeof attachment.id,
          )

          // Check if ID is valid (not null, undefined, empty string, or string 'null')
          const hasValidId =
            attachment.id &&
            attachment.id !== null &&
            attachment.id !== undefined &&
            attachment.id !== '' &&
            attachment.id !== 'null' &&
            attachment.id !== 'undefined'

          console.log('DEBUG: Has valid ID:', hasValidId)

          if (hasValidId) {
            console.log('DEBUG: Attachment has valid ID, checking for updates...')
            const currentAttachment = currentAttachmentsData[0]?.find(
              (a) => a.id === attachment.id,
            )
            console.log('DEBUG: Found current attachment:', currentAttachment)
            if (currentAttachment) {
              // Only compare remarks if it's provided in the request (not undefined)
              if (attachment.remarks !== undefined) {
                const currentRemarks = normalizeValue(currentAttachment.remarks)
                const newRemarks = normalizeValue(attachment.remarks)
                console.log('DEBUG: Attachment remarks comparison:', {
                  attachmentId: attachment.id,
                  current: currentRemarks,
                  new: newRemarks,
                  changed: currentRemarks !== newRemarks,
                })
                if (currentRemarks !== newRemarks) {
                  auditChanges.push(
                    `Attachment ${attachment.id} Remarks: ${currentRemarks || 'NULL'} → ${newRemarks || 'NULL'}`,
                  )
                }
              }
            } else {
              console.log(
                'DEBUG: Attachment ID not found in current data, treating as new',
              )
              auditChanges.push(
                `Added new attachment: ${normalizeValue(attachment.name) || normalizeValue(attachment.fileName) || 'Unknown'}`,
              )
            }
          } else {
            console.log('DEBUG: No valid attachment ID, treating as new attachment')
            console.log(
              'DEBUG: Attachment name:',
              attachment.name,
              'fileName:',
              attachment.fileName,
            )
            auditChanges.push(
              `Added new attachment: ${normalizeValue(attachment.name) || normalizeValue(attachment.fileName) || 'Unknown'}`,
            )
          }
        }
      } else {
        console.log('DEBUG: No attachments in payload, checking for deletions')
        // All attachments were deleted
        if (existingAttachmentIds.length > 0) {
          for (const existingId of existingAttachmentIds) {
            const deletedAttachment = currentAttachmentsData[0]?.find(
              (a) => a.id === existingId,
            )
            console.log('DEBUG: Found deleted attachment (all):', deletedAttachment)
            if (deletedAttachment) {
              auditChanges.push(
                `Deleted attachment: ${normalizeValue(deletedAttachment.name) || 'Unknown'} (ID: ${existingId})`,
              )
            }
          }
        }
      }

      // Create audit trail entry
      if (auditChanges.length > 0) {
        const now = new Date()
        const auditQueries = [
          {
            sql: sql
              .insert(Master.audit_trail.tablename, {
                columns: Master.audit_trail.insertColumns,
                prefix: Master.audit_trail.prefix,
                isTransaction: true,
              })
              .build(),
            values: [
              adjustmentId,
              'ADJUSTMENT_UPDATE',
              req.context?.username || null,
              now.toISOString().split('T')[0],
              now.toTimeString().split(' ')[0],
              `UPDATE: ${auditChanges.join(', ')}`,
            ],
          },
        ]

        await Transaction(auditQueries)
      }

      res.status(200).json({
        success: true,
        message: 'Adjustment updated successfully',
        data: { id: adjustmentId },
        timestamp: new Date().toISOString(),
      })
    } catch (error) {
      if (connection) {
        await connection.rollback()
      }
      throw error
    } finally {
      if (connection) {
        connection.release()
      }
    }
  } catch (error) {
    console.error('Error updating adjustment:', error)
    return res.status(500).json({
      success: false,
      message: 'Server error while updating adjustment',
      error:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Internal server error',
    })
  }
}

module.exports = {
  getAdjustments,
  getAdjustmentById,
  createAdjustment,
  updateAdjustment,
  updateAdjustmentData,
}
