const os = require('os')

const {
  checkConnection,
  SelectAll,
  Query,
  Transaction,
} = require('../database/util/queries.util')
const { broadcastUpdates } = require('../startup/socket.startup')

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

const resolveCollectionPaymentAccountId = async (
  connection,
  modeOfPayment,
  bankName,
) => {
  const coaQuery = sql
    .select([
      { col: Master.charts_of_accounts.selectOptionColumns.id, as: 'id' },

      { col: Master.charts_of_accounts.selectOptionColumns.name, as: 'name' },
    ])

    .from(Master.charts_of_accounts.tablename)

    .build()

  const [coaRows] = await connection.execute(coaQuery, [])

  const norm = (s) => (s || '').toLowerCase()

  let paymentAccount = null

  if (modeOfPayment === 'CASH') {
    paymentAccount =
      coaRows.find((a) => norm(a.name).includes('cash on hand')) ??
      coaRows.find((a) => norm(a.name).includes('petty cash'))
  } else if (modeOfPayment === 'CHECK' || modeOfPayment === 'BANK_TRANSFER') {
    if (bankName) {
      paymentAccount = coaRows.find((a) => norm(a.name).includes(norm(bankName)))
    }

    paymentAccount ??= coaRows.find((a) => norm(a.name).includes('cash in bank'))
  }

  return paymentAccount?.id || null
}

const resolveAccountsReceivableId = async (connection) => {
  const coaQuery = sql
    .select([
      { col: Master.charts_of_accounts.selectOptionColumns.id, as: 'id' },

      { col: Master.charts_of_accounts.selectOptionColumns.name, as: 'name' },
    ])

    .from(Master.charts_of_accounts.tablename)

    .build()

  const [coaRows] = await connection.execute(coaQuery, [])

  const ar = coaRows.find((a) =>
    (a.name || '').toLowerCase().includes('accounts receivable'),
  )

  return ar?.id || null
}

const regenerateCollectionsJournalEntries = async (
  connection,
  collectionIds = [],
) => {
  if (!collectionIds.length) return

  const arId = await resolveAccountsReceivableId(connection)

  for (const collectionId of collectionIds) {
    const collectionHeaderQuery = sql
      .select([
        { col: Accounting.collections.selectOptionColumns.id, as: 'id' },

        {
          col: Accounting.collections.selectOptionColumns.mode_of_payment,
          as: 'mode_of_payment',
        },

        {
          col: Accounting.collections.selectOptionColumns.bank_name,
          as: 'bank_name',
        },
      ])

      .from(Accounting.collections.tablename)

      .where(Accounting.collections.selectOptionColumns.id)

      .build()

    const [headerRows] = await connection.execute(collectionHeaderQuery, [
      collectionId,
    ])

    const header = headerRows[0]

    if (!header) continue

    const paymentAccountId = await resolveCollectionPaymentAccountId(
      connection,
      header.mode_of_payment,
      header.bank_name,
    )

    // Pull remaining collection items with responsibility center (from sales_items)

    const itemsQuery = sql
      .select([
        {
          col: Accounting.collection_items.selectOptionColumns.amount,
          as: 'amount',
        },

        {
          col: Accounting.sales_items.selectOptionColumns.responsibility_center,
          as: 'responsibility_center',
        },
      ])

      .from(Accounting.collection_items.tablename)

      .innerJoin(
        Accounting.sales_items.tablename,

        Accounting.sales_items.selectOptionColumns.id,

        Accounting.collection_items.selectOptionColumns.sales_id,
      )

      .where(Accounting.collection_items.selectOptionColumns.collection_id)

      .build()

    const [itemRows] = await connection.execute(itemsQuery, [collectionId])

    const totalCash = itemRows.reduce(
      (sum, r) => sum + (parseFloat(r.amount) || 0),
      0,
    )

    // Delete existing persisted collection journal entries

    const deleteJournalQuery = sql
      .delete()

      .from(Accounting.journal_entries.tablename)

      .where(Accounting.journal_entries.selectOptionColumns.db_name)

      .andWhere(Accounting.journal_entries.selectOptionColumns.db_id)

      .build()

    await connection.execute(deleteJournalQuery, ['collections', collectionId])

    if (!arId || !paymentAccountId || totalCash <= 0) {
      continue
    }

    // Insert new persisted journal entries (same structure as collection form auto-JE)

    const insertEntryQuery = sql
      .insert(Accounting.journal_entries.tablename, {
        columns: Accounting.journal_entries.insertColumns,

        prefix: Accounting.journal_entries.prefix,

        isTransaction: true,
      })
      .build()

    // CR Accounts Receivable per item

    for (const r of itemRows) {
      const amount = parseFloat(r.amount) || 0

      if (amount <= 0) continue

      const entryValues = [
        'collections',

        collectionId,

        arId,

        r.responsibility_center || '',

        'credit',

        amount,

        new Date().toISOString().split('T')[0],
      ]

      await connection.execute(insertEntryQuery, entryValues)
    }

    // DR Cash/Bank one combined

    const debitValues = [
      'collections',

      collectionId,

      paymentAccountId,

      '',

      'debit',

      parseFloat(totalCash.toFixed(2)),

      new Date().toISOString().split('T')[0],
    ]

    await connection.execute(insertEntryQuery, debitValues)
  }
}

const getSales = async (req, res, next) => {
  try {
    // pagination params
    const { offset, limit } = req.query
    const shouldPaginate = offset !== undefined && limit !== undefined
    const offsetNum = shouldPaginate ? Math.max(0, parseInt(offset, 10) || 0) : 0
    const limitNum = shouldPaginate
      ? Math.max(1, Math.min(100, parseInt(limit, 10) || 50))
      : null

    const query = sql
      .select([
        { col: Accounting.sales.selectOptionColumns.id, as: 'id' },

        { col: Accounting.sales.selectOptionColumns.customer_id, as: 'customer_id' },

        { col: Master.customers.selectOptionColumns.name, as: 'customer' },

        {
          col: Accounting.sales.selectOptionColumns.document_reference,
          as: 'doc_ref',
        },

        { col: Accounting.sales.selectOptionColumns.terms, as: 'terms' },

        {
          col: Accounting.sales.selectOptionColumns.date_delivered,
          as: 'date_delivered',
        },

        { col: Accounting.sales.selectOptionColumns.date_due, as: 'date_due' },

        { col: Accounting.sales.selectOptionColumns.remarks, as: 'remarks' },

        {
          col: Accounting.sales.selectOptionColumns.total_amount_due,
          as: 'amount_due',
        },

        { col: Accounting.sales.selectOptionColumns.status, as: 'status' },

        { col: Accounting.sales.selectOptionColumns.state, as: 'state' },
      ])

      .from(Accounting.sales.tablename)

      .innerJoin(
        Master.customers.tablename,
        Accounting.sales.selectOptionColumns.customer_id,
        Master.customers.selectOptionColumns.id,
      )

      .build()

    const queryParams = shouldPaginate ? [limitNum, offsetNum] : []
    const paginatedQuery = shouldPaginate
      ? `${query} ORDER BY ${Accounting.sales.selectOptionColumns.id} DESC LIMIT ? OFFSET ?`
      : `${query} ORDER BY ${Accounting.sales.selectOptionColumns.id} DESC`

    let sales = await Query(paginatedQuery, queryParams, [
      Accounting.sales.prefix_,
      Master.customers.prefix_,
    ])

    // Apply optional date_due filtering from query params: date_from, date_to
    const { date_from, date_to } = req.query || {}
    if (date_from || date_to) {
      const from = date_from ? new Date(date_from) : null
      const to = date_to ? new Date(date_to) : null

      sales = (sales || []).filter((s) => {
        if (!s || !s.date_due) return false
        const due = new Date(s.date_due)
        if (from && to) return due >= from && due <= to
        if (from) return due >= from
        if (to) return due <= to
        return true
      })
    }

    res.status(200).json({
      success: true,

      message: 'Sales retrieved successfully',

      data: sales,

      count: sales.length,

      offset: offsetNum,

      limit: limitNum,

      hasMore: shouldPaginate ? sales.length === limitNum : false,

      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error fetching sales:', error)

    return res.status(500).json({
      success: false,

      message: 'Server error while fetching sales',

      error:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Internal server error',
    })
  }
}

const getAllSales = async (req, res, next) => {
  const { id } = req.params

  const salesId = Number(id)

  console.log('Converted sales_id:', salesId, 'type:', typeof salesId)

  try {
    const sales_query = sql
      .select([
        { col: Accounting.sales.selectOptionColumns.id, as: 'id' },

        { col: Accounting.sales.selectOptionColumns.customer_id, as: 'customer_id' },

        { col: Master.customers.selectOptionColumns.name, as: 'customer' },

        {
          col: Accounting.sales.selectOptionColumns.document_reference,
          as: 'doc_ref',
        },

        { col: Accounting.sales.selectOptionColumns.terms, as: 'terms' },

        {
          col: Accounting.sales.selectOptionColumns.date_delivered,
          as: 'date_delivered',
        },

        { col: Accounting.sales.selectOptionColumns.date_due, as: 'date_due' },

        { col: Accounting.sales.selectOptionColumns.remarks, as: 'remarks' },

        {
          col: Accounting.sales.selectOptionColumns.total_amount_due,
          as: 'amount_due',
        },

        { col: Accounting.sales.selectOptionColumns.status, as: 'status' },

        { col: Accounting.sales.selectOptionColumns.state, as: 'state' },
      ])

      .from(Accounting.sales.tablename)

      .innerJoin(
        Master.customers.tablename,
        Accounting.sales.selectOptionColumns.customer_id,
        Master.customers.selectOptionColumns.id,
      )

      .where(Accounting.sales.selectOptionColumns.id)

      .build()

    let sales = await Query(
      sales_query,
      [salesId],
      [Accounting.sales.prefix_, Master.customers.prefix_],
    )

    const sales_items_query = sql
      .select([
        { col: Accounting.sales_items.selectOptionColumns.id, as: 'id' },

        {
          col: Accounting.sales_items.selectOptionColumns.product_service,
          as: 'product_service_id',
        },

        {
          col: Master.products_service.selectOptionColumns.name,
          as: 'product_service_name',
        },

        {
          col: Accounting.sales_items.selectOptionColumns.charts_of_accounts,
          as: 'charts_of_accounts_id',
        },

        {
          col: Master.charts_of_accounts.selectOptionColumns.name,
          as: 'charts_of_accounts_name',
        },

        {
          col: Accounting.sales_items.selectOptionColumns.description,
          as: 'description',
        },

        { col: Accounting.sales_items.selectOptionColumns.quantity, as: 'quantity' },

        {
          col: Accounting.sales_items.selectOptionColumns.sales_price,
          as: 'sales_price',
        },

        { col: Accounting.sales_items.selectOptionColumns.discount, as: 'discount' },

        {
          col: Accounting.sales_items.selectOptionColumns.discount_type,
          as: 'discount_type',
        },

        { col: Accounting.sales_items.selectOptionColumns.vat, as: 'vat_id' },

        { col: Master.vat.selectOptionColumns.code, as: 'vat_code' },

        { col: Master.vat.selectOptionColumns.name, as: 'vat_name' },

        { col: Master.vat.selectOptionColumns.rate, as: 'vat_rate' },

        {
          col: Accounting.sales_items.selectOptionColumns.witholding_tax,
          as: 'witholding_tax_id',
        },

        {
          col: Master.withholding_tax.selectOptionColumns.code,
          as: 'withholding_tax_code',
        },

        {
          col: Master.withholding_tax.selectOptionColumns.rate,
          as: 'withholding_tax_rate',
        },

        {
          col: Accounting.sales_items.selectOptionColumns.responsibility_center,
          as: 'responsibility_center',
        },
      ])

      .from(Accounting.sales_items.tablename)

      .leftJoin(
        Master.withholding_tax.tablename,
        Accounting.sales_items.selectOptionColumns.witholding_tax,
        Master.withholding_tax.selectOptionColumns.id,
      )

      .leftJoin(
        Master.vat.tablename,
        Accounting.sales_items.selectOptionColumns.vat,
        Master.vat.selectOptionColumns.id,
      )

      .leftJoin(
        Master.products_service.tablename,
        Accounting.sales_items.selectOptionColumns.product_service,
        Master.products_service.selectOptionColumns.id,
      )

      .innerJoin(
        Master.charts_of_accounts.tablename,
        Accounting.sales_items.selectOptionColumns.charts_of_accounts,
        Master.charts_of_accounts.selectOptionColumns.id,
      )

      .where(Accounting.sales_items.selectOptionColumns.sales_id)

      .build()

    let sales_items = await Query(
      sales_items_query,
      [salesId],
      [Accounting.sales_items.prefix_],
    )

    const sales_journal_query = sql
      .select([
        { col: Accounting.journal_entries.selectOptionColumns.id, as: 'id' },

        { col: Accounting.journal_entries.selectOptionColumns.coa_id, as: 'coa_id' },

        {
          col: Master.charts_of_accounts.selectOptionColumns.name,
          as: 'charts_of_accounts_name',
        },

        { col: Accounting.journal_entries.selectOptionColumns.type, as: 'type' },

        { col: Accounting.journal_entries.selectOptionColumns.amount, as: 'amount' },

        {
          col: Accounting.journal_entries.selectOptionColumns.responsibility_center,
          as: 'responsibility_center',
        },
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

    let sales_journal = await Query(
      sales_journal_query,
      ['sales', salesId],
      [Accounting.journal_entries.prefix_],
    )

    const sales_attachments_query = sql
      .select([
        { col: Accounting.sales_attachments.selectOptionColumns.id, as: 'id' },

        { col: Accounting.sales_attachments.selectOptionColumns.file, as: 'file' },

        { col: Accounting.sales_attachments.selectOptionColumns.name, as: 'name' },

        {
          col: Accounting.sales_attachments.selectOptionColumns.remarks,
          as: 'remarks',
        },

        {
          col: Accounting.sales_attachments.selectOptionColumns.uploaded_by,
          as: 'uploaded_by',
        },

        {
          col: Accounting.sales_attachments.selectOptionColumns.uploaded_date,
          as: 'uploaded_date',
        },
      ])

      .from(Accounting.sales_attachments.tablename)

      .where(Accounting.sales_attachments.selectOptionColumns.sales_id)

      .build()

    let sales_attachments = await Query(
      sales_attachments_query,
      [salesId],
      [Accounting.sales_attachments.prefix_],
    )

    console.log(sales, sales_items, sales_journal, sales_attachments)

    res.status(200).json({
      success: true,

      message: 'Sales retrieved successfully',

      data: sales,

      items: sales_items,

      journal: sales_journal,

      attachments: sales_attachments,

      count: sales.length,

      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error fetching sales:', error)

    return res.status(500).json({
      success: false,

      message: 'Server error while fetching sales',

      error:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Internal server error',
    })
  }
}

const createSales = async (req, res, next) => {
  try {
    const {
      customer_id,

      document_reference,

      terms,

      date_delivered,

      date_due,

      remarks,

      total_amount_due,

      created_by,

      checked_by,

      approved_by,

      sales_items,

      journal_entries,

      attachments,
    } = req.body

    console.log(req.body)

    if (
      !customer_id ||
      !terms ||
      !date_delivered ||
      !date_due ||
      !total_amount_due ||
      !created_by
    ) {
      return res.status(400).json({
        success: false,

        message: 'All fields are required',
      })
    }

    let connection

    try {
      connection = await getTenantPool().getConnection()

      await connection.beginTransaction()

      const mainQuery = sql
        .insert(Accounting.sales.tablename, {
          columns: Accounting.sales.insertColumns,

          prefix: Accounting.sales.prefix,

          isTransaction: true,
        })
        .build()

      const mainValues = [
        customer_id || null,

        document_reference || ' ',

        terms || null,

        date_delivered || null,

        date_due || null,

        remarks || null,

        total_amount_due || null,

        'UNPAID',

        'PREPARED',

        new Date().toISOString().split('T')[0],

        created_by || null,

        checked_by || null,

        approved_by || null,
      ]

      const [mainResult] = await connection.execute(mainQuery, mainValues)

      const salesId = mainResult.insertId

      if (sales_items && sales_items.length > 0) {
        for (const item of sales_items) {
          const itemQuery = sql
            .insert(Accounting.sales_items.tablename, {
              columns: Accounting.sales_items.insertColumns,

              prefix: Accounting.sales_items.prefix,

              isTransaction: true,
            })
            .build()

          const itemValues = [
            salesId,

            item.product_id || null,

            item.account_id || null,

            item.description || null,

            item.qty || 0,

            item.price || 0,

            item.discount || 0,

            item.discount_type || null,

            item.vat || 0,

            item.wtax || 0,

            item.responsibility_center || '',
          ]

          await connection.execute(itemQuery, itemValues)
        }
      }

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
            'sales',

            salesId,

            entry.account_id || null,

            entry.responsibility_center || '',

            type,

            amount,

            new Date().toISOString().split('T')[0],
          ]

          await connection.execute(entryQuery, entryValues)
        }
      }

      if (attachments && attachments.length > 0) {
        for (const attachment of attachments) {
          const attachmentQuery = sql
            .insert(Accounting.sales_attachments.tablename, {
              columns: Accounting.sales_attachments.insertColumns,

              prefix: Accounting.sales_attachments.prefix,

              isTransaction: true,
            })
            .build()

          const attachmentValues = [
            salesId,

            attachment.file || null,

            attachment.fileName || null,

            attachment.remarks || null,

            attachment.uploadedBy || null,

            attachment.date || new Date().toLocaleDateString(),
          ]

          await connection.execute(attachmentQuery, attachmentValues)
        }
      }

      await connection.commit()

      const selectNewSalesQuery = sql
        .select([
          { col: Accounting.sales.selectOptionColumns.id, as: 'id' },
          {
            col: Accounting.sales.selectOptionColumns.customer_id,
            as: 'customer_id',
          },
          { col: Master.customers.selectOptionColumns.name, as: 'customer' },
          {
            col: Accounting.sales.selectOptionColumns.document_reference,
            as: 'doc_ref',
          },
          { col: Accounting.sales.selectOptionColumns.terms, as: 'terms' },
          {
            col: Accounting.sales.selectOptionColumns.date_delivered,
            as: 'date_delivered',
          },
          { col: Accounting.sales.selectOptionColumns.date_due, as: 'date_due' },
          { col: Accounting.sales.selectOptionColumns.remarks, as: 'remarks' },
          {
            col: Accounting.sales.selectOptionColumns.total_amount_due,
            as: 'amount_due',
          },
          { col: Accounting.sales.selectOptionColumns.status, as: 'status' },
          { col: Accounting.sales.selectOptionColumns.state, as: 'state' },
        ])
        .from(Accounting.sales.tablename)
        .innerJoin(
          Master.customers.tablename,
          Accounting.sales.selectOptionColumns.customer_id,
          Master.customers.selectOptionColumns.id,
        )
        .where(Accounting.sales.selectOptionColumns.id)
        .build()

      const createdSalesRows = await Query(
        selectNewSalesQuery,
        [salesId],
        [Accounting.sales.prefix_, Master.customers.prefix_],
      )
      const createdSales = Array.isArray(createdSalesRows)
        ? createdSalesRows[0]
        : createdSalesRows

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
          salesId || null,

          'SALES',

          req.context?.username || null,

          now.toISOString().split('T')[0],

          now.toTimeString().split(' ')[0],

          `CREATE: ID ${salesId}`,
        ],
      })

      await Transaction(auditQueries)

      res.status(201).json({
        success: true,

        message: 'Sales created successfully',

        data: { id: salesId },

        timestamp: new Date().toISOString(),
      })

      // Broadcast after response (non-blocking)
      setImmediate(() => {
        try {
          if (createdSales) {
            broadcastUpdates({ sale: createdSales }, 'sales_created')
          }
        } catch (err) {
          console.error('Error broadcasting sales creation:', err)
        }
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
    console.error('Error creating sales:', error)

    return res.status(500).json({
      success: false,

      message: 'Server error while creating sales',

      error:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Internal server error',
    })
  }
}

const updateSalesState = async (req, res, next) => {
  try {
    const { updates } = req.body

    console.log('body', req.body)

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

      const validUpdates = updates.filter(
        (update) =>
          update &&
          update.id &&
          (update.currentState === 'PREPARED' || update.currentState === 'CHECKED'),
      )

      const invalidUpdates = updates.filter(
        (update) =>
          !update ||
          !update.id ||
          (update.currentState !== 'PREPARED' && update.currentState !== 'CHECKED'),
      )

      if (validUpdates.length === 0) {
        return res.status(400).json({
          success: false,
          message:
            'No sales in PREPARED or CHECKED state were selected. No updates were performed.',
          ignored: invalidUpdates.map((u) => ({
            id: u?.id,
            currentState: u?.currentState,
          })),
        })
      }

      const updatePromises = validUpdates.map(async (update) => {
        const { id, currentState } = update

        if (!id || !currentState) {
          throw new Error('Each update requires id and currentState')
        }

        let nextState

        let updateQuery

        let updateValues

        if (currentState === 'PREPARED') {
          nextState = 'CHECKED'

          updateQuery = sql
            .update(Accounting.sales.tablename)

            .set([
              Accounting.sales.selectOptionColumns.state,
              Accounting.sales.selectOptionColumns.checked_by,
            ])

            .where(Accounting.sales.selectOptionColumns.id)

            .build()

          updateValues = [nextState, req.context.username, id]
        } else {
          nextState = 'APPROVED'

          updateQuery = sql
            .update(Accounting.sales.tablename)

            .set([
              Accounting.sales.selectOptionColumns.state,
              Accounting.sales.selectOptionColumns.approved_by,
            ])

            .where(Accounting.sales.selectOptionColumns.id)

            .build()

          updateValues = [nextState, req.context.username, id]
        }

        return connection.execute(updateQuery, updateValues)
      })

      const results = await Promise.all(updatePromises)

      await connection.commit()

      // Audit trail for state update

      const now = new Date()

      const stateTransitions = validUpdates
        .map(
          (u) =>
            `ID ${u.id}: ${u.currentState} → ${u.currentState === 'PREPARED' ? 'CHECKED' : 'APPROVED'}`,
        )
        .join(', ')

      const auditQueries = []

      validUpdates.forEach((u) => {
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
            u.id, // FIXED: use sales ID instead of null
            'SALES_STATE',
            req.context?.username || null,
            now.toISOString().split('T')[0],
            now.toTimeString().split(' ')[0],
            `STATE UPDATE:${u.currentState} → ${nextState}`,
          ],
        })
      })

      await Transaction(auditQueries)

      res.status(200).json({
        success: true,

        message: `${results.length} receipt(s) updated successfully`,

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
    console.error('Error updating sales:', error)

    return res.status(500).json({
      success: false,

      message: 'Server error while updating sales',

      error:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Internal server error',
    })
  }
}

const updateSale = async (req, res, next) => {
  const { sales_id } = req.params

  const salesId = Number(sales_id)

  console.log('Updating sales_id:', salesId, 'type:', typeof salesId)

  try {
    const {
      customer_id,

      document_reference,

      terms,

      date_delivered,

      date_due,

      remarks,

      total_amount_due,

      created_by,

      sales_items,

      journal_entries,

      attachments,
    } = req.body

    console.log('Update data:', req.body)

    if (
      !customer_id ||
      !document_reference ||
      !terms ||
      !date_delivered ||
      !date_due ||
      !total_amount_due
    ) {
      return res.status(400).json({
        success: false,

        message: 'All required fields must be provided',
      })
    }

    let connection

    try {
      connection = await getTenantPool().getConnection()

      await connection.beginTransaction()

      // Fetch current data for audit trail BEFORE making any updates

      const currentSalesQuery = sql
        .select([
          {
            col: Accounting.sales.selectOptionColumns.customer_id,
            as: 'customer_id',
          },

          {
            col: Accounting.sales.selectOptionColumns.document_reference,
            as: 'document_reference',
          },

          { col: Accounting.sales.selectOptionColumns.terms, as: 'terms' },

          {
            col: Accounting.sales.selectOptionColumns.date_delivered,
            as: 'date_delivered',
          },

          { col: Accounting.sales.selectOptionColumns.date_due, as: 'date_due' },

          { col: Accounting.sales.selectOptionColumns.remarks, as: 'remarks' },

          {
            col: Accounting.sales.selectOptionColumns.total_amount_due,
            as: 'total_amount_due',
          },
        ])

        .from(Accounting.sales.tablename)

        .where(Accounting.sales.selectOptionColumns.id)

        .build()

      const [currentSalesData] = await connection.execute(currentSalesQuery, [
        salesId,
      ])

      // Fetch current sales items BEFORE updates

      let currentItemsData = []

      if (sales_items && sales_items.length > 0) {
        const currentItemsQuery = sql
          .select([
            { col: Accounting.sales_items.selectOptionColumns.id, as: 'id' },

            {
              col: Accounting.sales_items.selectOptionColumns.charts_of_accounts,
              as: 'account_id',
            },

            {
              col: Accounting.sales_items.selectOptionColumns.quantity,
              as: 'quantity',
            },

            {
              col: Accounting.sales_items.selectOptionColumns.sales_price,
              as: 'sales_price',
            },

            {
              col: Accounting.sales_items.selectOptionColumns.description,
              as: 'description',
            },

            {
              col: Accounting.sales_items.selectOptionColumns.responsibility_center,
              as: 'responsibility_center',
            },
          ])

          .from(Accounting.sales_items.tablename)

          .where(Accounting.sales_items.selectOptionColumns.sales_id)

          .build()

        currentItemsData = await connection.execute(currentItemsQuery, [salesId])
      }

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
          'sales',
          salesId,
        ])
      }

      // Fetch current attachments BEFORE updates

      let currentAttachmentsData = []

      const currentAttachmentsQuery = sql
        .select([
          { col: Accounting.sales_attachments.selectOptionColumns.id, as: 'id' },

          { col: Accounting.sales_attachments.selectOptionColumns.name, as: 'name' },

          {
            col: Accounting.sales_attachments.selectOptionColumns.remarks,
            as: 'remarks',
          },
        ])

        .from(Accounting.sales_attachments.tablename)

        .where(Accounting.sales_attachments.selectOptionColumns.sales_id)

        .build()

      currentAttachmentsData = await connection.execute(currentAttachmentsQuery, [
        salesId,
      ])

      const updateMainQuery = sql
        .update(Accounting.sales.tablename)

        .set([
          Accounting.sales.selectOptionColumns.customer_id,

          Accounting.sales.selectOptionColumns.document_reference,

          Accounting.sales.selectOptionColumns.terms,

          Accounting.sales.selectOptionColumns.date_delivered,

          Accounting.sales.selectOptionColumns.date_due,

          Accounting.sales.selectOptionColumns.remarks,

          Accounting.sales.selectOptionColumns.total_amount_due,
        ])

        .where(Accounting.sales.selectOptionColumns.id)

        .build()

      const updateMainValues = [
        customer_id || null,

        document_reference || null,

        terms || null,

        date_delivered || null,

        date_due || null,

        remarks || null,

        total_amount_due || null,

        salesId,
      ]

      await connection.execute(updateMainQuery, updateMainValues)

      if (sales_items && sales_items.length > 0) {
        const existingItemsQuery = sql
          .select([Accounting.sales_items.selectOptionColumns.id])

          .from(Accounting.sales_items.tablename)

          .where(Accounting.sales_items.selectOptionColumns.sales_id)

          .build()

        const existingItems = await Query(
          existingItemsQuery,
          [salesId],
          [Accounting.sales_items.prefix_],
        )

        const existingItemIds = existingItems.map((item) => item.id)

        const payloadItemIds = sales_items
          .filter((item) => item.id)
          .map((item) => item.id)

        const itemsToDelete = existingItemIds.filter(
          (id) => !payloadItemIds.includes(id),
        )

        if (itemsToDelete.length > 0) {
          // Delete collection references first (cascade) so sales items can be removed

          // Also delete any stored collection journal entries that were based on those collection items

          // then regenerate persisted collection journal entries based on remaining collection items.

          const affectedCollectionsQuery = sql
            .select([
              {
                col: Accounting.collection_items.selectOptionColumns.collection_id,
                as: 'collection_id',
              },
            ])

            .from(Accounting.collection_items.tablename)

            .whereIn(
              Accounting.collection_items.selectOptionColumns.sales_id,
              itemsToDelete,
            )

            .build()

          const affectedCollections = await Query(
            affectedCollectionsQuery,

            itemsToDelete,

            [Accounting.collection_items.prefix_],
          )

          const affectedCollectionIds = [
            ...new Set(affectedCollections.map((r) => r.collection_id)),
          ]

          if (affectedCollectionIds.length > 0) {
            const placeholders = affectedCollectionIds.map(() => '?').join(',')

            const deleteCollectionJournalSql = `DELETE FROM ${Accounting.journal_entries.tablename} WHERE ${Accounting.journal_entries.selectOptionColumns.db_name} = ? AND ${Accounting.journal_entries.selectOptionColumns.db_id} IN (${placeholders})`

            await connection.execute(deleteCollectionJournalSql, [
              'collections',
              ...affectedCollectionIds,
            ])
          }

          const deleteCollectionItemsQuery = sql
            .delete()

            .from(Accounting.collection_items.tablename)

            .whereIn(
              Accounting.collection_items.selectOptionColumns.sales_id,
              itemsToDelete,
            )

            .build()

          await connection.execute(deleteCollectionItemsQuery, itemsToDelete)

          // Recreate persisted collection journal entries for affected collections after collection items change

          await regenerateCollectionsJournalEntries(
            connection,
            affectedCollectionIds,
          )

          const deleteItemsQuery = sql
            .delete()

            .from(Accounting.sales_items.tablename)

            .where(Accounting.sales_items.selectOptionColumns.id)

            .andWhere(Accounting.sales_items.selectOptionColumns.sales_id)

            .build()

          for (const itemId of itemsToDelete) {
            await connection.execute(deleteItemsQuery, [itemId, salesId])
          }
        }

        for (const item of sales_items) {
          if (item.id) {
            const updateItemQuery = sql
              .update(Accounting.sales_items.tablename)

              .set([
                Accounting.sales_items.selectOptionColumns.product_service,

                Accounting.sales_items.selectOptionColumns.charts_of_accounts,

                Accounting.sales_items.selectOptionColumns.description,

                Accounting.sales_items.selectOptionColumns.quantity,

                Accounting.sales_items.selectOptionColumns.sales_price,

                Accounting.sales_items.selectOptionColumns.discount,

                Accounting.sales_items.selectOptionColumns.discount_type,

                Accounting.sales_items.selectOptionColumns.vat,

                Accounting.sales_items.selectOptionColumns.witholding_tax,

                Accounting.sales_items.selectOptionColumns.responsibility_center,
              ])

              .where(Accounting.sales_items.selectOptionColumns.id)

              .build()

            const updateItemValues = [
              item.product_id || null,

              item.account_id,

              item.description,

              item.qty || null,

              item.price || 0,

              item.discount || 0,

              item.discount_type || null,

              item.vat || 0,

              item.wtax || 0,

              item.responsibility_center || '',

              item.id,
            ]

            await connection.execute(updateItemQuery, updateItemValues)
          } else {
            const itemQuery = sql
              .insert(Accounting.sales_items.tablename, {
                columns: Accounting.sales_items.insertColumns,

                prefix: Accounting.sales_items.prefix,

                isTransaction: true,
              })
              .build()

            const itemValues = [
              salesId,

              item.product_id || null,

              item.account_id,

              item.description,

              item.qty || null,

              item.price || 0,

              item.discount || 0,

              item.discount_type || null,

              item.vat || 0,

              item.wtax || 0,

              item.responsibility_center || '',
            ]

            await connection.execute(itemQuery, itemValues)
          }
        }
      } else if (
        req.body.hasOwnProperty('sales_items') &&
        sales_items.length === 0
      ) {
        // Delete collection references first (cascade) so sales items can be removed

        const salesItemIdsQuery = sql
          .select([Accounting.sales_items.selectOptionColumns.id])

          .from(Accounting.sales_items.tablename)

          .where(Accounting.sales_items.selectOptionColumns.sales_id)

          .build()

        const salesItemIds = await Query(
          salesItemIdsQuery,
          [salesId],
          [Accounting.sales_items.prefix_],
        )

        const idsToDelete = salesItemIds.map((r) => r.id)

        if (idsToDelete.length > 0) {
          // Delete any stored collection journal entries that were based on those collection items.

          const affectedCollectionsQuery = sql
            .select([
              {
                col: Accounting.collection_items.selectOptionColumns.collection_id,
                as: 'collection_id',
              },
            ])

            .from(Accounting.collection_items.tablename)

            .whereIn(
              Accounting.collection_items.selectOptionColumns.sales_id,
              idsToDelete,
            )

            .build()

          const affectedCollections = await Query(
            affectedCollectionsQuery,

            idsToDelete,

            [Accounting.collection_items.prefix_],
          )

          const affectedCollectionIds = [
            ...new Set(affectedCollections.map((r) => r.collection_id)),
          ]

          if (affectedCollectionIds.length > 0) {
            const placeholders = affectedCollectionIds.map(() => '?').join(',')

            const deleteCollectionJournalSql = `DELETE FROM ${Accounting.journal_entries.tablename} WHERE ${Accounting.journal_entries.selectOptionColumns.db_name} = ? AND ${Accounting.journal_entries.selectOptionColumns.db_id} IN (${placeholders})`

            await connection.execute(deleteCollectionJournalSql, [
              'collections',
              ...affectedCollectionIds,
            ])
          }

          const deleteCollectionItemsQuery = sql
            .delete()

            .from(Accounting.collection_items.tablename)

            .whereIn(
              Accounting.collection_items.selectOptionColumns.sales_id,
              idsToDelete,
            )

            .build()

          await connection.execute(deleteCollectionItemsQuery, idsToDelete)

          // Recreate persisted collection journal entries for affected collections after collection items change

          await regenerateCollectionsJournalEntries(
            connection,
            affectedCollectionIds,
          )
        }

        // Only delete all items if explicitly provided as empty array and no references exist

        const deleteAllItemsQuery = sql
          .delete()

          .from(Accounting.sales_items.tablename)

          .where(Accounting.sales_items.selectOptionColumns.sales_id)

          .build()

        await connection.execute(deleteAllItemsQuery, [salesId])
      }

      if (journal_entries && journal_entries.length > 0) {
        const existingEntriesQuery = sql
          .select([Accounting.journal_entries.selectOptionColumns.id])

          .from(Accounting.journal_entries.tablename)

          .where(Accounting.journal_entries.selectOptionColumns.db_name)

          .andWhere(Accounting.journal_entries.selectOptionColumns.db_id)

          .build()

        const existingEntries = await Query(
          existingEntriesQuery,
          ['sales', salesId],
          [Accounting.journal_entries.prefix_],
        )

        const existingEntryIds = existingEntries.map((entry) => entry.id)

        const payloadEntryIds = journal_entries
          .filter((entry) => entry.id)
          .map((entry) => entry.id)

        const entriesToDelete = existingEntryIds.filter(
          (id) => !payloadEntryIds.includes(id),
        )

        if (entriesToDelete.length > 0) {
          const deleteEntriesQuery = sql
            .delete()

            .from(Accounting.journal_entries.tablename)

            .where(Accounting.journal_entries.selectOptionColumns.id)

            .andWhere(Accounting.journal_entries.selectOptionColumns.db_name)

            .andWhere(Accounting.journal_entries.selectOptionColumns.db_id)

            .build()

          for (const entryId of entriesToDelete) {
            await connection.execute(deleteEntriesQuery, [entryId, 'sales', salesId])
          }
        }

        for (const entry of journal_entries) {
          const type = entry.debit > 0 ? 'debit' : 'credit'

          const amount = entry.debit > 0 ? entry.debit : entry.credit

          if (entry.id) {
            const updateEntryQuery = sql
              .update(Accounting.journal_entries.tablename)

              .set([
                Accounting.journal_entries.selectOptionColumns.coa_id,

                Accounting.journal_entries.selectOptionColumns.responsibility_center,

                Accounting.journal_entries.selectOptionColumns.type,

                Accounting.journal_entries.selectOptionColumns.amount,
              ])

              .where(Accounting.journal_entries.selectOptionColumns.id)

              .build()

            const updateEntryValues = [
              entry.account_id || null,

              entry.responsibility_center || '',

              type,

              amount,

              entry.id,
            ]

            await connection.execute(updateEntryQuery, updateEntryValues)
          } else {
            const entryQuery = sql
              .insert(Accounting.journal_entries.tablename, {
                columns: Accounting.journal_entries.insertColumns,

                prefix: Accounting.journal_entries.prefix,

                isTransaction: true,
              })
              .build()

            const entryValues = [
              'sales',

              salesId,

              entry.account_id || null,

              entry.responsibility_center || '',

              type,

              amount,

              new Date().toISOString().split('T')[0],
            ]

            await connection.execute(entryQuery, entryValues)
          }
        }
      } else {
        const deleteAllEntriesQuery = sql
          .delete()

          .from(Accounting.journal_entries.tablename)

          .where(Accounting.journal_entries.selectOptionColumns.db_name)

          .andWhere(Accounting.journal_entries.selectOptionColumns.db_id)

          .build()

        await connection.execute(deleteAllEntriesQuery, ['sales', salesId])
      }

      if (attachments && attachments.length > 0) {
        const existingAttachmentsQuery = sql
          .select([Accounting.sales_attachments.selectOptionColumns.id])

          .from(Accounting.sales_attachments.tablename)

          .where(Accounting.sales_attachments.selectOptionColumns.sales_id)

          .build()

        const existingAttachments = await Query(
          existingAttachmentsQuery,
          [salesId],
          [Accounting.sales_attachments.prefix_],
        )

        const existingAttachmentIds = existingAttachments.map((att) => att.id)

        const payloadAttachmentIds = attachments
          .filter((att) => att.id)
          .map((att) => att.id)

        const attachmentsToDelete = existingAttachmentIds.filter(
          (id) => !payloadAttachmentIds.includes(id),
        )

        if (attachmentsToDelete.length > 0) {
          // Get attachment names before deletion for audit trail
          const attachmentsToDeleteQuery = sql
            .select([
              Accounting.sales_attachments.selectOptionColumns.id,
              Accounting.sales_attachments.selectOptionColumns.name,
            ])
            .from(Accounting.sales_attachments.tablename)
            .where(Accounting.sales_attachments.selectOptionColumns.id)
            .andWhere(Accounting.sales_attachments.selectOptionColumns.sales_id)
            .build()

          const attachmentsToDeleteData = await Query(
            attachmentsToDeleteQuery,
            [...attachmentsToDelete, salesId],
            [Accounting.sales_attachments.prefix_],
          )

          const deleteAttachmentsQuery = sql
            .delete()
            .from(Accounting.sales_attachments.tablename)
            .where(Accounting.sales_attachments.selectOptionColumns.id)
            .andWhere(Accounting.sales_attachments.selectOptionColumns.sales_id)
            .build()

          for (const attachmentId of attachmentsToDelete) {
            await connection.execute(deleteAttachmentsQuery, [attachmentId, salesId])
          }

          // Log deleted attachments to audit trail
          for (const attachment of attachmentsToDeleteData) {
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
                salesId || null,
                'SALES',
                req.context?.username || null,
                now.toISOString().split('T')[0],
                now.toTimeString().split(' ')[0],
                `UPDATE SALE: Deleted attachment: "${attachment.name}"`,
              ],
            })
            await Transaction(auditQueries)
          }
        }

        for (const attachment of attachments) {
          // Check if this attachment ID exists in the database

          const isExistingAttachment = existingAttachmentIds.includes(attachment.id)

          if (attachment.id && isExistingAttachment) {
            const updateAttachmentQuery = sql
              .update(Accounting.sales_attachments.tablename)

              .set([
                Accounting.sales_attachments.selectOptionColumns.file,

                Accounting.sales_attachments.selectOptionColumns.name,

                Accounting.sales_attachments.selectOptionColumns.remarks,

                Accounting.sales_attachments.selectOptionColumns.uploaded_by,

                Accounting.sales_attachments.selectOptionColumns.uploaded_date,
              ])

              .where(Accounting.sales_attachments.selectOptionColumns.id)

              .build()

            const updateAttachmentValues = [
              attachment.file || null,

              attachment.fileName || null,

              attachment.remarks || null,

              attachment.uploadedBy || null,

              attachment.date || new Date().toLocaleDateString(),

              attachment.id,
            ]

            await connection.execute(updateAttachmentQuery, updateAttachmentValues)
          } else {
            const attachmentQuery = sql
              .insert(Accounting.sales_attachments.tablename, {
                columns: Accounting.sales_attachments.insertColumns,

                prefix: Accounting.sales_attachments.prefix,

                isTransaction: true,
              })
              .build()

            const attachmentValues = [
              salesId,

              attachment.file || null,

              attachment.fileName || null,

              attachment.remarks || null,

              attachment.uploadedBy || null,

              attachment.date || new Date().toLocaleDateString(),
            ]

            await connection.execute(attachmentQuery, attachmentValues)

            // Log new attachment to audit trail
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
                salesId || null,
                'SALES',
                req.context?.username || null,
                now.toISOString().split('T')[0],
                now.toTimeString().split(' ')[0],
                `UPDATE SALE: New attachment: "${attachment.fileName || 'Unknown'}"`,
              ],
            })
            await Transaction(auditQueries)
          }
        }
      } else {
        // Delete all attachments if none are provided

        // Get existing attachments for audit trail before deletion
        const existingAttachmentsForDeleteQuery = sql
          .select([Accounting.sales_attachments.selectOptionColumns.name])
          .from(Accounting.sales_attachments.tablename)
          .where(Accounting.sales_attachments.selectOptionColumns.sales_id)
          .build()

        const existingAttachmentsForDelete = await Query(
          existingAttachmentsForDeleteQuery,
          [salesId],
          [Accounting.sales_attachments.prefix_],
        )

        const deleteAllAttachmentsQuery = sql
          .delete()
          .from(Accounting.sales_attachments.tablename)
          .where(Accounting.sales_attachments.selectOptionColumns.sales_id)
          .build()

        await connection.execute(deleteAllAttachmentsQuery, [salesId])

        // Log all deleted attachments to audit trail
        for (const attachment of existingAttachmentsForDelete) {
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
              salesId || null,
              'SALES',
              req.context?.username || null,
              now.toISOString().split('T')[0],
              now.toTimeString().split(' ')[0],
              `UPDATE SALE: Deleted attachment: "${attachment.name}"`,
            ],
          })
          await Transaction(auditQueries)
        }
      }

      // Track changes for audit trail using data fetched earlier
      const auditChanges = []

      // Helper function to normalize values for comparison
      const normalizeValue = (val) =>
        val === null || val === undefined ? '' : String(val).trim()
      const normalizeNumber = (val) =>
        val === null || val === undefined ? 0 : parseFloat(val)

      console.log('DEBUG: Current sales data:', currentSalesData)
      console.log('DEBUG: Request body data:', {
        customer_id,
        document_reference,
        terms,
        date_delivered,
        date_due,
        remarks,
        total_amount_due,
      })
      console.log('DEBUG: Sales items data:', sales_items)
      console.log('DEBUG: Journal entries data:', journal_entries)
      console.log('DEBUG: Attachments data:', attachments)

      if (currentSalesData.length > 0) {
        const current = currentSalesData[0]

        if (current.customer_id !== customer_id) {
          auditChanges.push(`Customer ID: ${current.customer_id} → ${customer_id}`)
        }

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

        const currentTerms = normalizeValue(current.terms)
        const newTerms = normalizeValue(terms)
        console.log('DEBUG: Terms comparison:', {
          current: currentTerms,
          new: newTerms,
          changed: currentTerms !== newTerms,
        })
        if (currentTerms !== newTerms) {
          auditChanges.push(
            `Terms: ${currentTerms || 'NULL'} → ${newTerms || 'NULL'}`,
          )
        }

        const currentDateDelivered = normalizeValue(current.date_delivered)
        const newDateDelivered = normalizeValue(date_delivered)
        if (currentDateDelivered !== newDateDelivered) {
          auditChanges.push(
            `Date Delivered: ${currentDateDelivered || 'NULL'} → ${newDateDelivered || 'NULL'}`,
          )
        }

        const currentDateDue = normalizeValue(current.date_due)
        const newDateDue = normalizeValue(date_due)
        if (currentDateDue !== newDateDue) {
          auditChanges.push(
            `Date Due: ${currentDateDue || 'NULL'} → ${newDateDue || 'NULL'}`,
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
          normalizeNumber(current.total_amount_due) !==
          normalizeNumber(total_amount_due)
        ) {
          auditChanges.push(
            `Total Amount: ${current.total_amount_due} → ${total_amount_due}`,
          )
        }
      }

      // Track sales items changes using data fetched earlier
      console.log('DEBUG: Current items data from DB:', currentItemsData)
      if (sales_items && sales_items.length > 0) {
        for (let i = 0; i < sales_items.length; i++) {
          const item = sales_items[i]
          console.log('DEBUG: Processing item:', item)
          let currentItem = null

          if (item.id) {
            // Find by ID if available
            currentItem = currentItemsData[0]?.find((i) => i.id === item.id)
          } else {
            // If no ID, try to match by account_id and position
            currentItem = currentItemsData[0]?.find(
              (existingItem, index) =>
                existingItem.account_id === item.account_id && index === i,
            )

            // If still not found, try to match by account_id only
            if (!currentItem && item.account_id) {
              currentItem = currentItemsData[0]?.find(
                (existingItem) => existingItem.account_id === item.account_id,
              )
            }
          }

          console.log('DEBUG: Found current item:', currentItem)
          if (currentItem) {
            // Only compare qty if it's provided in the request (not undefined/null)
            if (item.qty !== undefined && item.qty !== null) {
              const currentQty = normalizeNumber(currentItem.quantity)
              const newQty = normalizeNumber(item.qty)
              console.log('DEBUG: Item qty comparison:', {
                itemId: currentItem.id,
                current: currentQty,
                new: newQty,
                changed: currentQty !== newQty,
              })
              if (currentQty !== newQty) {
                auditChanges.push(
                  `Item ${currentItem.id} Qty: ${currentQty} → ${newQty}`,
                )
              }
            }

            // Only compare price if it's provided in the request (not undefined/null)
            if (item.price !== undefined && item.price !== null) {
              const currentPrice = normalizeNumber(currentItem.sales_price)
              const newPrice = normalizeNumber(item.price)
              console.log('DEBUG: Item price comparison:', {
                itemId: currentItem.id,
                current: currentPrice,
                new: newPrice,
                changed: currentPrice !== newPrice,
              })
              if (currentPrice !== newPrice) {
                auditChanges.push(
                  `Item ${currentItem.id} Price: ${currentPrice} → ${newPrice}`,
                )
              }
            }

            // Only compare description if it's provided in the request (not undefined)
            if (item.description !== undefined) {
              const currentDesc = normalizeValue(currentItem.description)
              const newDesc = normalizeValue(item.description)
              console.log('DEBUG: Item desc comparison:', {
                itemId: currentItem.id,
                current: currentDesc,
                new: newDesc,
                changed: currentDesc !== newDesc,
              })
              if (currentDesc !== newDesc) {
                auditChanges.push(
                  `Item ${currentItem.id} Desc: ${currentDesc || 'NULL'} → ${newDesc || 'NULL'}`,
                )
              }
            }

            // Only compare responsibility_center if it's provided in the request (not undefined)
            if (item.responsibility_center !== undefined) {
              const currentRespCenter = normalizeValue(
                currentItem.responsibility_center,
              )
              const newRespCenter = normalizeValue(item.responsibility_center)
              console.log('DEBUG: Item resp center comparison:', {
                itemId: currentItem.id,
                current: currentRespCenter,
                new: newRespCenter,
                changed: currentRespCenter !== newRespCenter,
              })
              if (currentRespCenter !== newRespCenter) {
                auditChanges.push(
                  `Item ${currentItem.id} Resp Center: ${currentRespCenter || 'NULL'} → ${newRespCenter || 'NULL'}`,
                )
              }
            }
          } else {
            auditChanges.push(
              `Added new item: ${normalizeValue(item.description) || 'Unknown'}`,
            )
          }
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
      console.log('DEBUG: Request attachments data:', attachments)

      // Get existing attachments for comparison
      const existingAttachmentsQuery = sql
        .select([Accounting.sales_attachments.selectOptionColumns.id])
        .from(Accounting.sales_attachments.tablename)
        .where(Accounting.sales_attachments.selectOptionColumns.sales_id)
        .build()

      const existingAttachments = await Query(
        existingAttachmentsQuery,
        [salesId],
        [Accounting.sales_attachments.prefix_],
      )
      const existingAttachmentIds = existingAttachments.map(
        (attachment) => attachment.id,
      )

      console.log('DEBUG: Existing attachment IDs:', existingAttachmentIds)

      if (attachments && attachments.length > 0) {
        // Filter out attachments with invalid IDs (null, undefined, 'null', 'undefined', empty string)
        const validAttachments = attachments.filter(
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
            // Fix: Access currentAttachmentsData[0] since connection.execute returns array
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

        for (const attachment of attachments) {
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
            // Fix: Access currentAttachmentsData[0] since connection.execute returns array
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
            // Fix: Access currentAttachmentsData[0] since connection.execute returns array
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

      await connection.commit()

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
              salesId,
              'SALES_UPDATE',
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

        message: 'Sale updated successfully',

        data: { id: salesId },

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
    console.error('Error updating sale:', error)

    return res.status(500).json({
      success: false,

      message: 'Server error while updating sale',

      error:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Internal server error',
    })
  }
}

const getPrintSales = async (req, res, next) => {
  const { sales_id } = req.params

  const { copyType } = req.query

  const salesIds = sales_id
    .split(',')
    .map((id) => Number(id.trim()))
    .filter((id) => !isNaN(id))

  console.log('Converted sales_ids:', salesIds, 'type:', typeof salesIds)

  console.log('Copy type:', copyType)

  if (salesIds.length === 0) {
    return res.status(400).json({
      success: false,

      message: 'Invalid sales IDs provided',

      timestamp: new Date().toISOString(),
    })
  }

  try {
    const company_query =
      sql
        .select([
          { col: Master.master_company.selectOptionColumns.company_id, as: 'id' },

          {
            col: Master.master_company.selectOptionColumns.company_name,
            as: 'company_name',
          },

          { col: Master.master_company.selectOptionColumns.logo, as: 'logo' },

          { col: Master.master_company.selectOptionColumns.address, as: 'address' },

          { col: Master.master_company.selectOptionColumns.tin, as: 'tin' },

          { col: Master.master_company.selectOptionColumns.website, as: 'website' },

          { col: Master.master_company.selectOptionColumns.email, as: 'email' },

          { col: Master.master_company.selectOptionColumns.phone, as: 'phone' },

          { col: Master.master_company.selectOptionColumns.status, as: 'status' },
        ])

        .from(Master.master_company.tablename)

        .build() + ' LIMIT 1'

    let company = await Query(company_query, [], [Master.master_company.prefix_])

    company = company && company.length > 0 ? company[0] : null

    const sales_query = sql
      .select([
        { col: Accounting.sales.selectOptionColumns.id, as: 'id' },

        { col: Accounting.sales.selectOptionColumns.customer_id, as: 'customer_id' },

        { col: Master.customers.selectOptionColumns.name, as: 'customer' },

        {
          col: Accounting.sales.selectOptionColumns.document_reference,
          as: 'doc_ref',
        },

        { col: Accounting.sales.selectOptionColumns.terms, as: 'terms' },

        {
          col: Accounting.sales.selectOptionColumns.date_delivered,
          as: 'date_delivered',
        },

        { col: Accounting.sales.selectOptionColumns.date_due, as: 'date_due' },

        { col: Accounting.sales.selectOptionColumns.remarks, as: 'remarks' },

        {
          col: Accounting.sales.selectOptionColumns.total_amount_due,
          as: 'amount_due',
        },

        { col: Accounting.sales.selectOptionColumns.status, as: 'status' },

        { col: Accounting.sales.selectOptionColumns.state, as: 'state' },

        { col: Accounting.sales.selectOptionColumns.created_by, as: 'created_by' },

        { col: Accounting.sales.selectOptionColumns.checked_by, as: 'checked_by' },

        { col: Accounting.sales.selectOptionColumns.approved_by, as: 'approved_by' },
      ])

      .from(Accounting.sales.tablename)

      .innerJoin(
        Master.customers.tablename,
        Accounting.sales.selectOptionColumns.customer_id,
        Master.customers.selectOptionColumns.id,
      )

      .whereIn(Accounting.sales.selectOptionColumns.id, salesIds)

      .build()

    let sales = await Query(
      sales_query,
      [...salesIds],
      [Accounting.sales.prefix_, Master.customers.prefix_],
    )

    const sales_items_query = sql
      .select([
        { col: Accounting.sales_items.selectOptionColumns.id, as: 'id' },

        { col: Accounting.sales_items.selectOptionColumns.sales_id, as: 'sales_id' },

        {
          col: Accounting.sales_items.selectOptionColumns.product_service,
          as: 'product_service_id',
        },

        {
          col: Master.products_service.selectOptionColumns.name,
          as: 'product_service_name',
        },

        {
          col: Accounting.sales_items.selectOptionColumns.charts_of_accounts,
          as: 'charts_of_accounts_id',
        },

        {
          col: Master.charts_of_accounts.selectOptionColumns.name,
          as: 'charts_of_accounts_name',
        },

        {
          col: Accounting.sales_items.selectOptionColumns.description,
          as: 'description',
        },

        { col: Accounting.sales_items.selectOptionColumns.quantity, as: 'quantity' },

        {
          col: Accounting.sales_items.selectOptionColumns.sales_price,
          as: 'sales_price',
        },

        { col: Accounting.sales_items.selectOptionColumns.discount, as: 'discount' },

        {
          col: Accounting.sales_items.selectOptionColumns.discount_type,
          as: 'discount_type',
        },

        { col: Master.vat.selectOptionColumns.rate, as: 'vat_rate' },

        {
          col: Master.withholding_tax.selectOptionColumns.rate,
          as: 'withholding_tax_rate',
        },

        {
          col: Accounting.sales_items.selectOptionColumns.responsibility_center,
          as: 'responsibility_center',
        },
      ])

      .from(Accounting.sales_items.tablename)

      .innerJoin(
        Master.vat.tablename,
        Accounting.sales_items.selectOptionColumns.vat,
        Master.vat.selectOptionColumns.id,
      )

      .innerJoin(
        Master.withholding_tax.tablename,
        Accounting.sales_items.selectOptionColumns.witholding_tax,
        Master.withholding_tax.selectOptionColumns.id,
      )

      .leftJoin(
        Master.products_service.tablename,
        Accounting.sales_items.selectOptionColumns.product_service,
        Master.products_service.selectOptionColumns.id,
      )

      .innerJoin(
        Master.charts_of_accounts.tablename,
        Accounting.sales_items.selectOptionColumns.charts_of_accounts,
        Master.charts_of_accounts.selectOptionColumns.id,
      )

      .whereIn(Accounting.sales_items.selectOptionColumns.sales_id, salesIds)

      .build()

    let sales_items = await Query(
      sales_items_query,
      [...salesIds],
      [Accounting.sales_items.prefix_],
    )

    const sales_journal_query = sql
      .select([
        { col: Accounting.journal_entries.selectOptionColumns.id, as: 'id' },

        { col: Accounting.journal_entries.selectOptionColumns.db_id, as: 'db_id' },

        { col: Accounting.journal_entries.selectOptionColumns.coa_id, as: 'coa_id' },

        {
          col: Master.charts_of_accounts.selectOptionColumns.name,
          as: 'charts_of_accounts_name',
        },

        { col: Accounting.journal_entries.selectOptionColumns.type, as: 'type' },

        { col: Accounting.journal_entries.selectOptionColumns.amount, as: 'amount' },

        {
          col: Accounting.journal_entries.selectOptionColumns.responsibility_center,
          as: 'responsibility_center',
        },
      ])

      .from(Accounting.journal_entries.tablename)

      .innerJoin(
        Master.charts_of_accounts.tablename,
        Accounting.journal_entries.selectOptionColumns.coa_id,
        Master.charts_of_accounts.selectOptionColumns.id,
      )

      .where(Accounting.journal_entries.selectOptionColumns.db_name)

      .whereIn(Accounting.journal_entries.selectOptionColumns.db_id, salesIds)

      .build()

    let sales_journal = await Query(
      sales_journal_query,
      ['sales', ...salesIds],
      [Accounting.journal_entries.prefix_],
    )

    console.log('Raw journal data:', sales_journal)

    const sales_attachments_query = sql
      .select([
        { col: Accounting.sales_attachments.selectOptionColumns.id, as: 'id' },

        {
          col: Accounting.sales_attachments.selectOptionColumns.sales_id,
          as: 'sales_id',
        },

        { col: Accounting.sales_attachments.selectOptionColumns.file, as: 'file' },

        { col: Accounting.sales_attachments.selectOptionColumns.name, as: 'name' },

        {
          col: Accounting.sales_attachments.selectOptionColumns.remarks,
          as: 'remarks',
        },

        {
          col: Accounting.sales_attachments.selectOptionColumns.uploaded_by,
          as: 'uploaded_by',
        },

        {
          col: Accounting.sales_attachments.selectOptionColumns.uploaded_date,
          as: 'uploaded_date',
        },
      ])

      .from(Accounting.sales_attachments.tablename)

      .whereIn(Accounting.sales_attachments.selectOptionColumns.sales_id, salesIds)

      .build()

    let sales_attachments = await Query(
      sales_attachments_query,
      [...salesIds],
      [Accounting.sales_attachments.prefix_],
    )

    const groupedData = sales.map((sale) => {
      const saleItems = sales_items.filter((item) => item.sales_id === sale.id)

      const saleJournal =
        copyType === 'customer'
          ? []
          : sales_journal.filter((entry) => entry.db_id === sale.id)

      const mappedItems = saleItems.map((item) => {
        const quantity = parseFloat(item.quantity || 1)

        const salesPrice = parseFloat(item.sales_price || 0)

        const discount = parseFloat(item.discount || 0)

        const vatRate = parseFloat(item.vat_rate || 0)

        const whtRate = parseFloat(item.withholding_tax_rate || 0)

        const totalPrice = salesPrice * quantity

        const discountAmount = totalPrice * (discount / 100)

        const discountedPrice = totalPrice - discountAmount

        const vatAmount = discountedPrice * (vatRate / 100)

        const whtAmount = discountedPrice * (whtRate / 100)

        const amountDue = discountedPrice + vatAmount - whtAmount

        return {
          id: item.id,

          product_name: item.product_service_name || '—',

          description: item.description || '—',

          unit: 'pcs',

          quantity: quantity,

          purchase_price: salesPrice,

          total_price: totalPrice,

          discount_amount: discountAmount,

          vat_percentage: vatRate,

          vat_amount: vatAmount,

          wht_percentage: whtRate,

          wht_amount: whtAmount,

          amount_due: amountDue,

          vatable_sales: vatRate > 0 ? discountedPrice : 0,

          vat_exempt_sales: vatRate === 0 ? discountedPrice : 0,

          zero_rated_sales: 0,
        }
      })

      const mappedJournal = saleJournal.map((entry) => {
        const isDebit = entry.type === 'DEBIT'

        console.log('Processing journal entry:', {
          type: entry.type,
          amount: entry.amount,
          isDebit,
        })

        const mapped = {
          id: entry.id,

          account_name: entry.charts_of_accounts_name || '—',

          responsibility_center: entry.responsibility_center || 'Unassigned',

          debit: isDebit ? parseFloat(entry.amount || 0) : 0,

          credit: !isDebit ? parseFloat(entry.amount || 0) : 0,
        }

        console.log('Mapped journal entry:', mapped)

        return mapped
      })

      return {
        ...sale,

        items: mappedItems,

        journal: mappedJournal,

        attachments: sales_attachments.filter((att) => att.sales_id === sale.id),

        company: company,
      }
    })

    console.log('Grouped sales data:', groupedData)

    res.status(200).json({
      success: true,

      message: 'Sales retrieved successfully',

      company: company,

      data: groupedData,

      count: groupedData.length,

      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error fetching sales:', error)

    return res.status(500).json({
      success: false,

      message: 'Server error while fetching sales',

      error:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Internal server error',
    })
  }
}

module.exports = {
  getSales,

  getAllSales,

  createSales,

  updateSale,

  updateSalesState,

  getPrintSales,
}
