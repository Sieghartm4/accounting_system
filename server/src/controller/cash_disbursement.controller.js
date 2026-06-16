const os = require('os')

const {
  checkConnection,
  SelectAll,
  Transaction,
  Query,
  Insert,
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

const getCashDisbursements = async (req, res, next) => {
  try {
    const { offset, limit, dateFrom, dateTo } = req.query
    const shouldPaginate = offset !== undefined && limit !== undefined
    const offsetNum = shouldPaginate ? Math.max(0, parseInt(offset, 10) || 0) : 0
    const limitNum = shouldPaginate
      ? Math.max(1, Math.min(100, parseInt(limit, 10) || 15))
      : null

    const baseQuery = sql
      .select([
        { col: Accounting.cash_disbursements.selectOptionColumns.id, as: 'id' },

        { col: Master.vendors.selectOptionColumns.name, as: 'vendor' },

        {
          col: Accounting.cash_disbursements.selectOptionColumns.document_reference,
          as: 'doc_ref',
        },

        {
          col: Accounting.cash_disbursements.selectOptionColumns.payment_date,
          as: 'payment_date',
        },

        {
          col: Accounting.cash_disbursements.selectOptionColumns.mode_of_payment,
          as: 'mode',
        },

        {
          col: Accounting.cash_disbursements.selectOptionColumns.bank_name,
          as: 'bank_name',
        },

        {
          col: Accounting.cash_disbursements.selectOptionColumns.check_number,
          as: 'check_number',
        },

        {
          col: Accounting.cash_disbursements.selectOptionColumns.remarks,
          as: 'remarks',
        },

        {
          col: Accounting.cash_disbursements.selectOptionColumns.total_amount_due,
          as: 'amount_due',
        },

        {
          col: Accounting.cash_disbursements.selectOptionColumns.state,
          as: 'state',
        },
      ])

      .from(Accounting.cash_disbursements.tablename)

      .innerJoin(
        Master.vendors.tablename,
        Accounting.cash_disbursements.selectOptionColumns.vendor_id,
        Master.vendors.selectOptionColumns.id,
      )

      .build()

    let whereClause = ''
    const queryParams = []

    if (dateFrom) {
      whereClause += ` WHERE ${Accounting.cash_disbursements.selectOptionColumns.payment_date} >= ?`
      queryParams.push(dateFrom)
    }

    if (dateTo) {
      whereClause = whereClause
        ? `${whereClause} AND ${Accounting.cash_disbursements.selectOptionColumns.payment_date} <= ?`
        : ` WHERE ${Accounting.cash_disbursements.selectOptionColumns.payment_date} <= ?`
      queryParams.push(dateTo)
    }

    const query = baseQuery + whereClause

    const paginatedQuery = shouldPaginate
      ? `${query} ORDER BY ${Accounting.cash_disbursements.selectOptionColumns.id} DESC LIMIT ? OFFSET ?`
      : `${query} ORDER BY ${Accounting.cash_disbursements.selectOptionColumns.id} DESC`

    if (shouldPaginate) {
      queryParams.push(limitNum)
      queryParams.push(offsetNum)
    }

    let result = await Query(paginatedQuery, [
      ...queryParams,
      Accounting.cash_disbursements.prefix_,
      Master.vendors.prefix_,
    ])

    res.status(200).json({
      success: true,

      message: 'Cash disbursements retrieved successfully',

      data: result,

      count: result.length,

      offset: offsetNum,

      limit: limitNum,

      hasMore: shouldPaginate ? result.length === limitNum : false,

      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error fetching cash disbursements:', error)

    return res.status(500).json({
      success: false,

      message: 'Server error while fetching cash disbursements',

      error:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Internal server error',
    })
  }
}

const getAllCashDisbursements = async (req, res, next) => {
  const { cash_disbursement_id } = req.params

  const cashDisbursementId = cash_disbursement_id

  console.log(
    'Using cash_disbursement_id:',
    cashDisbursementId,
    'type:',
    typeof cashDisbursementId,
  )

  try {
    const cash_disbursements_query = sql
      .select([
        { col: Accounting.cash_disbursements.selectOptionColumns.id, as: 'id' },

        {
          col: Accounting.cash_disbursements.selectOptionColumns.vendor_id,
          as: 'vendor_id',
        },

        { col: Master.vendors.selectOptionColumns.name, as: 'vendor' },

        {
          col: Accounting.cash_disbursements.selectOptionColumns.document_reference,
          as: 'doc_ref',
        },

        {
          col: Accounting.cash_disbursements.selectOptionColumns.payment_date,
          as: 'payment_date',
        },

        {
          col: Accounting.cash_disbursements.selectOptionColumns.mode_of_payment,
          as: 'mode',
        },

        {
          col: Accounting.cash_disbursements.selectOptionColumns.bank_name,
          as: 'bank_name',
        },

        {
          col: Accounting.cash_disbursements.selectOptionColumns.check_number,
          as: 'check_number',
        },

        {
          col: Accounting.cash_disbursements.selectOptionColumns.remarks,
          as: 'remarks',
        },

        {
          col: Accounting.cash_disbursements.selectOptionColumns.total_amount_due,
          as: 'amount_due',
        },

        {
          col: Accounting.cash_disbursements.selectOptionColumns.state,
          as: 'state',
        },
      ])

      .from(Accounting.cash_disbursements.tablename)

      .innerJoin(
        Master.vendors.tablename,
        Accounting.cash_disbursements.selectOptionColumns.vendor_id,
        Master.vendors.selectOptionColumns.id,
      )

      .where(Accounting.cash_disbursements.selectOptionColumns.id)

      .build()

    let cash_disbursement = await Query(
      cash_disbursements_query,
      [cashDisbursementId],
      [Accounting.cash_disbursements.prefix_, Master.vendors.prefix_],
    )

    const cash_disbursement_items_query = sql
      .select([
        { col: Accounting.cash_disbursement_items.selectOptionColumns.id, as: 'id' },

        {
          col: Accounting.cash_disbursement_items.selectOptionColumns
            .product_service,
          as: 'product_service_id',
        },

        {
          col: Master.products_service.selectOptionColumns.name,
          as: 'product_service_name',
        },

        {
          col: Accounting.cash_disbursement_items.selectOptionColumns
            .charts_of_accounts,
          as: 'charts_of_accounts_id',
        },

        {
          col: Master.charts_of_accounts.selectOptionColumns.name,
          as: 'charts_of_accounts_name',
        },

        {
          col: Accounting.cash_disbursement_items.selectOptionColumns.description,
          as: 'description',
        },

        {
          col: Accounting.cash_disbursement_items.selectOptionColumns.quantity,
          as: 'quantity',
        },

        {
          col: Accounting.cash_disbursement_items.selectOptionColumns.purchase_price,
          as: 'purchase_price',
        },

        {
          col: Accounting.cash_disbursement_items.selectOptionColumns.discount,
          as: 'discount',
        },

        {
          col: Accounting.cash_disbursement_items.selectOptionColumns.discount_type,
          as: 'discount_type',
        },

        { col: Master.vat.selectOptionColumns.id, as: 'vat_id' },

        { col: Master.vat.selectOptionColumns.code, as: 'vat_code' },

        { col: Master.vat.selectOptionColumns.name, as: 'vat_name' },

        { col: Master.vat.selectOptionColumns.rate, as: 'vat_rate' },

        {
          col: Master.withholding_tax.selectOptionColumns.id,
          as: 'withholding_tax_id',
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
          col: Accounting.cash_disbursement_items.selectOptionColumns
            .responsibility_center,
          as: 'responsibility_center',
        },
      ])

      .from(Accounting.cash_disbursement_items.tablename)

      .innerJoin(
        Master.withholding_tax.tablename,
        Accounting.cash_disbursement_items.selectOptionColumns.witholding_tax,
        Master.withholding_tax.selectOptionColumns.id,
      )

      .innerJoin(
        Master.vat.tablename,
        Accounting.cash_disbursement_items.selectOptionColumns.vat,
        Master.vat.selectOptionColumns.id,
      )

      .leftJoin(
        Master.products_service.tablename,
        Accounting.cash_disbursement_items.selectOptionColumns.product_service,
        Master.products_service.selectOptionColumns.id,
      )

      .innerJoin(
        Master.charts_of_accounts.tablename,
        Accounting.cash_disbursement_items.selectOptionColumns.charts_of_accounts,
        Master.charts_of_accounts.selectOptionColumns.id,
      )

      .where(
        Accounting.cash_disbursement_items.selectOptionColumns.cash_disbursement_id,
      )

      .build()

    let cash_disbursement_items = await Query(
      cash_disbursement_items_query,
      [cashDisbursementId],
      [Accounting.cash_disbursement_items.prefix_],
    )

    const cash_disbursement_journal_query = sql
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

    let cash_disbursement_journal = await Query(
      cash_disbursement_journal_query,
      ['cash_disbursements', cashDisbursementId],
      [Accounting.journal_entries.prefix_],
    )

    const cash_disbursement_attachments_query = sql
      .select([
        {
          col: Accounting.cash_disbursement_attachments.selectOptionColumns.id,
          as: 'id',
        },

        {
          col: Accounting.cash_disbursement_attachments.selectOptionColumns.file,
          as: 'file',
        },

        {
          col: Accounting.cash_disbursement_attachments.selectOptionColumns.name,
          as: 'name',
        },

        {
          col: Accounting.cash_disbursement_attachments.selectOptionColumns.remarks,
          as: 'remarks',
        },

        {
          col: Accounting.cash_disbursement_attachments.selectOptionColumns
            .uploaded_by,
          as: 'uploaded_by',
        },

        {
          col: Accounting.cash_disbursement_attachments.selectOptionColumns
            .uploaded_date,
          as: 'uploaded_date',
        },
      ])

      .from(Accounting.cash_disbursement_attachments.tablename)

      .where(
        Accounting.cash_disbursement_attachments.selectOptionColumns
          .cash_disburssement_id,
      )

      .build()

    let cash_disbursement_attachments = await Query(
      cash_disbursement_attachments_query,
      [cashDisbursementId],
      [Accounting.cash_disbursement_attachments.prefix_],
    )

    console.log(
      cash_disbursement,
      cash_disbursement_items,
      cash_disbursement_journal,
      cash_disbursement_attachments,
    )

    res.status(200).json({
      success: true,

      message: 'Cash disbursements retrieved successfully',

      data: cash_disbursement,

      items: cash_disbursement_items,

      journal: cash_disbursement_journal,

      attachments: cash_disbursement_attachments,

      count: cash_disbursement.length,

      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error fetching cash disbursements:', error)

    return res.status(500).json({
      success: false,

      message: 'Server error while fetching receipts',

      error:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Internal server error',
    })
  }
}

const createCashDisbursement = async (req, res, next) => {
  try {
    const {
      vendor_id,

      document_reference,

      payment_date,

      mode_of_payment,

      bank_name,

      check_number,

      remarks,

      total_amount_due,

      created_by,

      checked_by,

      approved_by,

      disbursement_items,

      journal_entries,

      attachments,
    } = req.body

    console.log(req.body)

    if (
      !vendor_id ||
      !payment_date ||
      !mode_of_payment ||
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

      const nowForId = new Date()
      const mm = String(nowForId.getMonth() + 1).padStart(2, '0')
      const dd = String(nowForId.getDate()).padStart(2, '0')
      const yy = String(nowForId.getFullYear()).slice(-2)
      const datePart = `${mm}${dd}${yy}`
      const idPrefix = `CD-${datePart}-`

      const [existing] = await connection.execute(
        `SELECT cd_id FROM cash_disbursements WHERE cd_id LIKE ? ORDER BY cd_id DESC LIMIT 1`,
        [`${idPrefix}%`],
      )

      let seq = 1
      if (existing && existing.length > 0) {
        const lastId = existing[0].cd_id
        const parts = lastId.split('-')
        const lastSeq = parseInt(parts[parts.length - 1], 10) || 0
        seq = lastSeq + 1
      }

      const seqStr = String(seq).padStart(4, '0')
      const newCashDisbursementId = `${idPrefix}${seqStr}`

      const mainQuery = sql
        .insert(Accounting.cash_disbursements.tablename, {
          columns: Accounting.cash_disbursements.insertColumns,

          prefix: Accounting.cash_disbursements.prefix,

          isTransaction: true,
        })
        .build()

      const mainValues = [
        newCashDisbursementId,
        vendor_id || null,

        document_reference || '0',

        payment_date || null,

        mode_of_payment || null,

        bank_name || null,

        check_number || null,

        remarks || null,

        total_amount_due || null,

        'PREPARED',

        new Date().toISOString().split('T')[0],

        created_by || null,

        checked_by || null,

        approved_by || null,
      ]

      const [mainResult] = await connection.execute(mainQuery, mainValues)

      const cashDisbursementId = newCashDisbursementId

      if (disbursement_items && disbursement_items.length > 0) {
        for (const item of disbursement_items) {
          const itemQuery = sql
            .insert(Accounting.cash_disbursement_items.tablename, {
              columns: Accounting.cash_disbursement_items.insertColumns,

              prefix: Accounting.cash_disbursement_items.prefix,

              isTransaction: true,
            })
            .build()

          const itemValues = [
            cashDisbursementId,

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
            'cash_disbursements',

            cashDisbursementId,

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
            .insert(Accounting.cash_disbursement_attachments.tablename, {
              columns: Accounting.cash_disbursement_attachments.insertColumns,

              prefix: Accounting.cash_disbursement_attachments.prefix,

              isTransaction: true,
            })
            .build()

          const attachmentValues = [
            cashDisbursementId,

            attachment.file || null,

            attachment.fileName || null,

            attachment.remarks || null,

            attachment.uploadedBy || null,

            attachment.date || new Date().toLocaleDateString(),
          ]

          await connection.execute(attachmentQuery, attachmentValues)
        }
      }

      // Commit transaction

      await connection.commit()

      const selectNewDisbursementQuery = sql
        .select([
          { col: Accounting.cash_disbursements.selectOptionColumns.id, as: 'id' },
          {
            col: Accounting.cash_disbursements.selectOptionColumns.vendor_id,
            as: 'vendor_id',
          },
          { col: Master.vendors.selectOptionColumns.name, as: 'vendor' },
          {
            col: Accounting.cash_disbursements.selectOptionColumns
              .document_reference,
            as: 'doc_ref',
          },
          {
            col: Accounting.cash_disbursements.selectOptionColumns.payment_date,
            as: 'payment_date',
          },
          {
            col: Accounting.cash_disbursements.selectOptionColumns.mode_of_payment,
            as: 'mode',
          },
          {
            col: Accounting.cash_disbursements.selectOptionColumns.bank_name,
            as: 'bank_name',
          },
          {
            col: Accounting.cash_disbursements.selectOptionColumns.check_number,
            as: 'check_number',
          },
          {
            col: Accounting.cash_disbursements.selectOptionColumns.remarks,
            as: 'remarks',
          },
          {
            col: Accounting.cash_disbursements.selectOptionColumns.total_amount_due,
            as: 'amount_due',
          },
          {
            col: Accounting.cash_disbursements.selectOptionColumns.state,
            as: 'state',
          },
        ])
        .from(Accounting.cash_disbursements.tablename)
        .innerJoin(
          Master.vendors.tablename,
          Accounting.cash_disbursements.selectOptionColumns.vendor_id,
          Master.vendors.selectOptionColumns.id,
        )
        .where(Accounting.cash_disbursements.selectOptionColumns.id)
        .build()

      const createdDisbursementRows = await Query(
        selectNewDisbursementQuery,
        [cashDisbursementId],
        [Accounting.cash_disbursements.prefix_, Master.vendors.prefix_],
      )
      const createdDisbursement = Array.isArray(createdDisbursementRows)
        ? createdDisbursementRows[0]
        : createdDisbursementRows

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
          cashDisbursementId || null,

          'CASH_DISBURSEMENT',

          req.context?.username || null,

          now.toISOString().split('T')[0],

          now.toTimeString().split(' ')[0],

          `CREATE: ID ${cashDisbursementId}`,
        ],
      })

      await Transaction(auditQueries)

      res.status(201).json({
        success: true,

        message: 'Cash disbursement created successfully',

        data: { id: cashDisbursementId },

        timestamp: new Date().toISOString(),
      })

      // Broadcast after response (non-blocking)
      setImmediate(() => {
        try {
          if (createdDisbursement) {
            broadcastUpdates(
              { disbursement: createdDisbursement },
              'disbursement_created',
            )
          }
        } catch (err) {
          console.error('Error broadcasting disbursement creation:', err)
        }
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
    console.error('Error creating cash disbursement:', error)

    return res.status(500).json({
      success: false,

      message: 'Server error while creating cash disbursement',

      error:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Internal server error',
    })
  }
}

const updateCashDisbursement = async (req, res, next) => {
  const { cash_disbursement_id } = req.params

  const disbursementId = cash_disbursement_id

  console.log(
    'Updating cash_disbursement_id:',
    disbursementId,
    'type:',
    typeof disbursementId,
  )

  try {
    const {
      vendor_id,

      document_reference,

      payment_date,

      mode_of_payment,

      bank_name,

      check_number,

      remarks,

      total_amount_due,

      created_by,

      disbursement_items,

      journal_entries,

      attachments,
    } = req.body

    console.log('Update data:', req.body)

    if (
      !vendor_id ||
      !document_reference ||
      !payment_date ||
      !mode_of_payment ||
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
      const currentDisbursementQuery = sql
        .select([
          {
            col: Accounting.cash_disbursements.selectOptionColumns
              .document_reference,
            as: 'doc_ref',
          },
          {
            col: Accounting.cash_disbursements.selectOptionColumns.remarks,
            as: 'remarks',
          },
          {
            col: Accounting.cash_disbursements.selectOptionColumns.vendor_id,
            as: 'vendor_id',
          },
          {
            col: Accounting.cash_disbursements.selectOptionColumns.payment_date,
            as: 'payment_date',
          },
          {
            col: Accounting.cash_disbursements.selectOptionColumns.mode_of_payment,
            as: 'mode_of_payment',
          },
          {
            col: Accounting.cash_disbursements.selectOptionColumns.bank_name,
            as: 'bank_name',
          },
          {
            col: Accounting.cash_disbursements.selectOptionColumns.check_number,
            as: 'check_number',
          },
          {
            col: Accounting.cash_disbursements.selectOptionColumns.total_amount_due,
            as: 'total_amount_due',
          },
        ])
        .from(Accounting.cash_disbursements.tablename)
        .where(Accounting.cash_disbursements.selectOptionColumns.id)
        .build()

      const [currentDisbursementData] = await connection.execute(
        currentDisbursementQuery,
        [disbursementId],
      )

      // Fetch current disbursement items BEFORE updates
      let currentItemsData = []
      if (disbursement_items && disbursement_items.length > 0) {
        const currentItemsQuery = sql
          .select([
            {
              col: Accounting.cash_disbursement_items.selectOptionColumns.id,
              as: 'id',
            },
            {
              col: Accounting.cash_disbursement_items.selectOptionColumns
                .charts_of_accounts,
              as: 'account_id',
            },
            {
              col: Accounting.cash_disbursement_items.selectOptionColumns.quantity,
              as: 'quantity',
            },
            {
              col: Accounting.cash_disbursement_items.selectOptionColumns
                .purchase_price,
              as: 'purchase_price',
            },
            {
              col: Accounting.cash_disbursement_items.selectOptionColumns
                .description,
              as: 'description',
            },
            {
              col: Accounting.cash_disbursement_items.selectOptionColumns
                .responsibility_center,
              as: 'responsibility_center',
            },
          ])
          .from(Accounting.cash_disbursement_items.tablename)
          .where(
            Accounting.cash_disbursement_items.selectOptionColumns
              .cash_disbursement_id,
          )
          .build()

        currentItemsData = await connection.execute(currentItemsQuery, [
          disbursementId,
        ])
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
          'cash_disbursements',
          disbursementId,
        ])
      }

      // Fetch current attachments BEFORE updates
      let currentAttachmentsData = []
      const currentAttachmentsQuery = sql
        .select([
          {
            col: Accounting.cash_disbursement_attachments.selectOptionColumns.id,
            as: 'id',
          },
          {
            col: Accounting.cash_disbursement_attachments.selectOptionColumns.name,
            as: 'name',
          },
          {
            col: Accounting.cash_disbursement_attachments.selectOptionColumns
              .remarks,
            as: 'remarks',
          },
        ])
        .from(Accounting.cash_disbursement_attachments.tablename)
        .where(
          Accounting.cash_disbursement_attachments.selectOptionColumns
            .cash_disburssement_id,
        )
        .build()

      currentAttachmentsData = await connection.execute(currentAttachmentsQuery, [
        disbursementId,
      ])

      const updateMainQuery = sql
        .update(Accounting.cash_disbursements.tablename)
        .set([
          Accounting.cash_disbursements.selectOptionColumns.vendor_id,
          Accounting.cash_disbursements.selectOptionColumns.document_reference,
          Accounting.cash_disbursements.selectOptionColumns.payment_date,
          Accounting.cash_disbursements.selectOptionColumns.mode_of_payment,
          Accounting.cash_disbursements.selectOptionColumns.bank_name,
          Accounting.cash_disbursements.selectOptionColumns.check_number,
          Accounting.cash_disbursements.selectOptionColumns.remarks,
          Accounting.cash_disbursements.selectOptionColumns.total_amount_due,
        ])
        .where(Accounting.cash_disbursements.selectOptionColumns.id)
        .build()

      const updateMainValues = [
        vendor_id || null,
        document_reference || null,
        payment_date || null,
        mode_of_payment || null,
        bank_name || null,
        check_number || null,
        remarks || null,
        total_amount_due || null,
        disbursementId,
      ]

      await connection.execute(updateMainQuery, updateMainValues)

      // ... rest of the code remains the same ...

      if (disbursement_items && disbursement_items.length > 0) {
        const existingItemsQuery = sql
          .select([Accounting.cash_disbursement_items.selectOptionColumns.id])

          .from(Accounting.cash_disbursement_items.tablename)

          .where(
            Accounting.cash_disbursement_items.selectOptionColumns
              .cash_disbursement_id,
          )

          .build()

        const existingItems = await Query(
          existingItemsQuery,
          [disbursementId],
          [Accounting.cash_disbursement_items.prefix_],
        )

        const existingItemIds = existingItems.map((item) => item.id)

        const payloadItemIds = disbursement_items
          .filter((item) => item.id)
          .map((item) => item.id)

        const itemsToDelete = existingItemIds.filter(
          (id) => !payloadItemIds.includes(id),
        )

        if (itemsToDelete.length > 0) {
          const deleteItemsQuery = sql
            .delete()

            .from(Accounting.cash_disbursement_items.tablename)

            .where(Accounting.cash_disbursement_items.selectOptionColumns.id)

            .andWhere(
              Accounting.cash_disbursement_items.selectOptionColumns
                .cash_disbursement_id,
            )

            .build()

          for (const itemId of itemsToDelete) {
            await connection.execute(deleteItemsQuery, [itemId, disbursementId])
          }
        }

        for (const item of disbursement_items) {
          if (item.id) {
            const updateItemQuery = sql
              .update(Accounting.cash_disbursement_items.tablename)

              .set([
                Accounting.cash_disbursement_items.selectOptionColumns
                  .product_service,

                Accounting.cash_disbursement_items.selectOptionColumns
                  .charts_of_accounts,

                Accounting.cash_disbursement_items.selectOptionColumns.description,

                Accounting.cash_disbursement_items.selectOptionColumns.quantity,

                Accounting.cash_disbursement_items.selectOptionColumns
                  .purchase_price,

                Accounting.cash_disbursement_items.selectOptionColumns.discount,

                Accounting.cash_disbursement_items.selectOptionColumns.discount_type,

                Accounting.cash_disbursement_items.selectOptionColumns.vat,

                Accounting.cash_disbursement_items.selectOptionColumns
                  .withholding_tax,

                Accounting.cash_disbursement_items.selectOptionColumns
                  .responsibility_center,
              ])

              .where(Accounting.cash_disbursement_items.selectOptionColumns.id)

              .build()

            const updateItemValues = [
              item.product_id || null,

              item.account_id || null,

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
              .insert(Accounting.cash_disbursement_items.tablename, {
                columns: Accounting.cash_disbursement_items.insertColumns,

                prefix: Accounting.cash_disbursement_items.prefix,

                isTransaction: true,
              })
              .build()

            const itemValues = [
              disbursementId,

              item.product_id || null,

              item.account_id || null,

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
      } else {
        const deleteAllItemsQuery = sql
          .delete()

          .from(Accounting.cash_disbursement_items.tablename)

          .where(
            Accounting.cash_disbursement_items.selectOptionColumns
              .cash_disbursement_id,
          )

          .build()

        await connection.execute(deleteAllItemsQuery, [disbursementId])
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
          ['cash_disbursements', disbursementId],
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
            await connection.execute(deleteEntriesQuery, [
              entryId,
              'cash_disbursements',
              disbursementId,
            ])
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
              'cash_disbursements',

              disbursementId,

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

        await connection.execute(deleteAllEntriesQuery, [
          'cash_disbursements',
          disbursementId,
        ])
      }

      if (attachments && attachments.length > 0) {
        const existingAttachmentsQuery = sql
          .select([Accounting.cash_disbursement_attachments.selectOptionColumns.id])

          .from(Accounting.cash_disbursement_attachments.tablename)

          .where(
            Accounting.cash_disbursement_attachments.selectOptionColumns
              .cash_disburssement_id,
          )

          .build()

        const existingAttachments = await Query(
          existingAttachmentsQuery,
          [disbursementId],
          [Accounting.cash_disbursement_attachments.prefix_],
        )

        const existingAttachmentIds = existingAttachments.map((att) => att.id)

        const payloadAttachmentIds = attachments
          .filter((att) => att.id)
          .map((att) => att.id)

        const attachmentsToDelete = existingAttachmentIds.filter(
          (id) => !payloadAttachmentIds.includes(id),
        )

        if (attachmentsToDelete.length > 0) {
          const deleteAttachmentsQuery = sql
            .delete()

            .from(Accounting.cash_disbursement_attachments.tablename)

            .where(Accounting.cash_disbursement_attachments.selectOptionColumns.id)

            .andWhere(
              Accounting.cash_disbursement_attachments.selectOptionColumns
                .cash_disburssement_id,
            )

            .build()

          for (const attachmentId of attachmentsToDelete) {
            await connection.execute(deleteAttachmentsQuery, [
              attachmentId,
              disbursementId,
            ])
          }
        }

        for (const attachment of attachments) {
          const isExistingAttachment = existingAttachmentIds.includes(attachment.id)

          if (attachment.id && isExistingAttachment) {
            const updateAttachmentQuery = sql
              .update(Accounting.cash_disbursement_attachments.tablename)

              .set([
                Accounting.cash_disbursement_attachments.selectOptionColumns.file,

                Accounting.cash_disbursement_attachments.selectOptionColumns.name,

                Accounting.cash_disbursement_attachments.selectOptionColumns.remarks,

                Accounting.cash_disbursement_attachments.selectOptionColumns
                  .uploaded_by,

                Accounting.cash_disbursement_attachments.selectOptionColumns
                  .uploaded_date,
              ])

              .where(Accounting.cash_disbursement_attachments.selectOptionColumns.id)

              .build()

            const updateAttachmentValues = [
              attachment.file || null,

              attachment.fileName || null,

              attachment.remarks || '',

              attachment.uploadedBy || null,

              attachment.date || new Date().toLocaleDateString(),

              attachment.id,
            ]

            await connection.execute(updateAttachmentQuery, updateAttachmentValues)
          } else {
            const attachmentQuery = sql
              .insert(Accounting.cash_disbursement_attachments.tablename, {
                columns: Accounting.cash_disbursement_attachments.insertColumns,

                prefix: Accounting.cash_disbursement_attachments.prefix,

                isTransaction: true,
              })
              .build()

            const attachmentValues = [
              disbursementId,

              attachment.file || null,

              attachment.fileName || null,

              attachment.remarks || '',

              attachment.uploadedBy || null,

              attachment.date || new Date().toLocaleDateString(),
            ]

            await connection.execute(attachmentQuery, attachmentValues)
          }
        }
      } else {
        // Delete all attachments if none are provided

        const deleteAllAttachmentsQuery = sql
          .delete()

          .from(Accounting.cash_disbursement_attachments.tablename)

          .where(
            Accounting.cash_disbursement_attachments.selectOptionColumns
              .cash_disburssement_id,
          )

          .build()
      }

      // Track changes for audit trail using data fetched earlier
      const auditChanges = []

      // Helper function to normalize values for comparison
      const normalizeValue = (val) =>
        val === null || val === undefined ? '' : String(val).trim()
      const normalizeNumber = (val) =>
        val === null || val === undefined
          ? 0
          : parseFloat(parseFloat(val).toFixed(2))

      console.log('DEBUG: Current disbursement data:', currentDisbursementData)
      console.log('DEBUG: Request body data:', {
        document_reference,
        remarks,
        vendor_id,
        payment_date,
        mode_of_payment,
        bank_name,
        check_number,
        total_amount_due,
      })
      console.log('DEBUG: Disbursement items data:', disbursement_items)
      console.log('DEBUG: Journal entries data:', journal_entries)
      console.log('DEBUG: Attachments data:', attachments)

      if (currentDisbursementData.length > 0) {
        const current = currentDisbursementData[0]

        const currentDocRef = normalizeValue(current.doc_ref)
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

        if (current.vendor_id !== vendor_id) {
          auditChanges.push(`Vendor ID: ${current.vendor_id} → ${vendor_id}`)
        }

        const currentPaymentDate = normalizeValue(current.payment_date)
        const newPaymentDate = normalizeValue(payment_date)
        if (currentPaymentDate !== newPaymentDate) {
          auditChanges.push(
            `Payment Date: ${currentPaymentDate || 'NULL'} → ${newPaymentDate || 'NULL'}`,
          )
        }

        const currentModePayment = normalizeValue(current.mode_of_payment)
        const newModePayment = normalizeValue(mode_of_payment)
        if (currentModePayment !== newModePayment) {
          auditChanges.push(
            `Mode of Payment: ${currentModePayment || 'NULL'} → ${newModePayment || 'NULL'}`,
          )
        }

        const currentBankName = normalizeValue(current.bank_name)
        const newBankName = normalizeValue(bank_name)
        if (currentBankName !== newBankName) {
          auditChanges.push(
            `Bank Name: ${currentBankName || 'NULL'} → ${newBankName || 'NULL'}`,
          )
        }

        const currentCheckNumber = normalizeValue(current.check_number)
        const newCheckNumber = normalizeValue(check_number)
        if (currentCheckNumber !== newCheckNumber) {
          auditChanges.push(
            `Check Number: ${currentCheckNumber || 'NULL'} → ${newCheckNumber || 'NULL'}`,
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

      // Track disbursement items changes using data fetched earlier
      console.log('DEBUG: Current items data from DB:', currentItemsData)
      if (disbursement_items && disbursement_items.length > 0) {
        for (let i = 0; i < disbursement_items.length; i++) {
          const item = disbursement_items[i]
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
              const currentPrice = normalizeNumber(currentItem.purchase_price)
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
      // Get existing attachments for comparison
      const existingAttachmentsQuery = sql
        .select([Accounting.cash_disbursement_attachments.selectOptionColumns.id])
        .from(Accounting.cash_disbursement_attachments.tablename)
        .where(
          Accounting.cash_disbursement_attachments.selectOptionColumns
            .cash_disburssement_id,
        )
        .build()

      const existingAttachments = await Query(
        existingAttachmentsQuery,
        [disbursementId],
        [Accounting.cash_disbursement_attachments.prefix_],
      )
      const existingAttachmentIds = existingAttachments.map(
        (attachment) => attachment.id,
      )

      // currentAttachmentsData and currentAttachmentsQuery are already declared earlier in the function

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
        // All attachments were deleted
        if (existingAttachmentIds.length > 0) {
          for (const existingId of existingAttachmentIds) {
            const deletedAttachment = currentAttachmentsData[0]?.find(
              (a) => a.id === existingId,
            )
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
              disbursementId,
              'CASH_DISBURSEMENT_UPDATE',
              req.context?.username || null,
              now.toISOString().split('T')[0],
              now.toTimeString().split(' ')[0],
              `UPDATE: ${auditChanges.join(', ')}`, // Use a unique string pattern here
            ],
          },
        ]

        await Transaction(auditQueries)
      }

      res.status(200).json({
        success: true,

        message: 'Cash disbursement updated successfully',

        data: { id: disbursementId },

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
    console.error('Error updating cash disbursement:', error)

    return res.status(500).json({
      success: false,

      message: 'Server error while updating cash disbursement',

      error:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Internal server error',
    })
  }
}

const updateDisbursementState = async (req, res, next) => {
  try {
    console.log('updateDisbursementState called')

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

      const updatePromises = updates.map(async (update) => {
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
            .update(Accounting.cash_disbursements.tablename)

            .set([
              Accounting.cash_disbursements.selectOptionColumns.state,
              Accounting.cash_disbursements.selectOptionColumns.checked_by,
            ])

            .where(Accounting.cash_disbursements.selectOptionColumns.id)

            .build()

          updateValues = [nextState, req.context.username, id]
        } else if (currentState === 'CHECKED') {
          nextState = 'APPROVED'

          updateQuery = sql
            .update(Accounting.cash_disbursements.tablename)

            .set([
              Accounting.cash_disbursements.selectOptionColumns.state,
              Accounting.cash_disbursements.selectOptionColumns.approved_by,
            ])

            .where(Accounting.cash_disbursements.selectOptionColumns.id)

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
            u.id, // FIXED: use disbursement ID

            'CASH_DISBURSEMENT_STATE',

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
    console.error('Error updating receipts:', error)

    return res.status(500).json({
      success: false,

      message: 'Server error while updating receipts',

      error:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Internal server error',
    })
  }
}

const getPrintDisbursements = async (req, res, next) => {
  const { cash_disbursement_id } = req.params

  const { copyType } = req.query

  const disbursementIds = cash_disbursement_id
    .split(',')
    .map((id) => Number(id.trim()))
    .filter((id) => !isNaN(id))

  console.log(
    'Converted disbursement_ids:',
    disbursementIds,
    'type:',
    typeof disbursementIds,
  )

  console.log('Copy type:', copyType)

  if (disbursementIds.length === 0) {
    return res.status(400).json({
      success: false,

      message: 'Invalid disbursement IDs provided',

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

    const disbursements_query = sql
      .select([
        { col: Accounting.cash_disbursements.selectOptionColumns.id, as: 'id' },

        {
          col: Accounting.cash_disbursements.selectOptionColumns.vendor_id,
          as: 'vendor_id',
        },

        { col: Master.vendors.selectOptionColumns.name, as: 'vendor' },

        {
          col: Accounting.cash_disbursements.selectOptionColumns.document_reference,
          as: 'doc_ref',
        },

        {
          col: Accounting.cash_disbursements.selectOptionColumns.payment_date,
          as: 'payment_date',
        },

        {
          col: Accounting.cash_disbursements.selectOptionColumns.mode_of_payment,
          as: 'mode',
        },

        {
          col: Accounting.cash_disbursements.selectOptionColumns.bank_name,
          as: 'bank_name',
        },

        {
          col: Accounting.cash_disbursements.selectOptionColumns.check_number,
          as: 'check_number',
        },

        {
          col: Accounting.cash_disbursements.selectOptionColumns.remarks,
          as: 'remarks',
        },

        {
          col: Accounting.cash_disbursements.selectOptionColumns.total_amount_due,
          as: 'amount_due',
        },

        {
          col: Accounting.cash_disbursements.selectOptionColumns.state,
          as: 'state',
        },

        {
          col: Accounting.cash_disbursements.selectOptionColumns.created_by,
          as: 'created_by',
        },

        {
          col: Accounting.cash_disbursements.selectOptionColumns.checked_by,
          as: 'checked_by',
        },

        {
          col: Accounting.cash_disbursements.selectOptionColumns.approved_by,
          as: 'approved_by',
        },
      ])

      .from(Accounting.cash_disbursements.tablename)

      .innerJoin(
        Master.vendors.tablename,
        Accounting.cash_disbursements.selectOptionColumns.vendor_id,
        Master.vendors.selectOptionColumns.id,
      )

      .whereIn(Accounting.cash_disbursements.selectOptionColumns.id, disbursementIds)

      .build()

    let disbursements = await Query(
      disbursements_query,
      [...disbursementIds],
      [Accounting.cash_disbursements.prefix_, Master.vendors.prefix_],
    )

    const disbursement_items_query = sql
      .select([
        { col: Accounting.cash_disbursement_items.selectOptionColumns.id, as: 'id' },

        {
          col: Accounting.cash_disbursement_items.selectOptionColumns
            .cash_disbursement_id,
          as: 'cash_disbursement_id',
        },

        {
          col: Accounting.cash_disbursement_items.selectOptionColumns
            .product_service,
          as: 'product_service_id',
        },

        {
          col: Master.products_service.selectOptionColumns.name,
          as: 'product_service_name',
        },

        {
          col: Accounting.cash_disbursement_items.selectOptionColumns
            .charts_of_accounts,
          as: 'charts_of_accounts_id',
        },

        {
          col: Master.charts_of_accounts.selectOptionColumns.name,
          as: 'charts_of_accounts_name',
        },

        {
          col: Accounting.cash_disbursement_items.selectOptionColumns.description,
          as: 'description',
        },

        {
          col: Accounting.cash_disbursement_items.selectOptionColumns.quantity,
          as: 'quantity',
        },

        {
          col: Accounting.cash_disbursement_items.selectOptionColumns.purchase_price,
          as: 'purchase_price',
        },

        {
          col: Accounting.cash_disbursement_items.selectOptionColumns.discount,
          as: 'discount',
        },

        {
          col: Accounting.cash_disbursement_items.selectOptionColumns.discount_type,
          as: 'discount_type',
        },

        { col: Master.vat.selectOptionColumns.rate, as: 'vat_rate' },

        {
          col: Master.withholding_tax.selectOptionColumns.rate,
          as: 'withholding_tax_rate',
        },

        {
          col: Accounting.cash_disbursement_items.selectOptionColumns
            .responsibility_center,
          as: 'responsibility_center',
        },
      ])

      .from(Accounting.cash_disbursement_items.tablename)

      .innerJoin(
        Master.withholding_tax.tablename,
        Accounting.cash_disbursement_items.selectOptionColumns.witholding_tax,
        Master.withholding_tax.selectOptionColumns.id,
      )

      .innerJoin(
        Master.vat.tablename,
        Accounting.cash_disbursement_items.selectOptionColumns.vat,
        Master.vat.selectOptionColumns.id,
      )

      .leftJoin(
        Master.products_service.tablename,
        Accounting.cash_disbursement_items.selectOptionColumns.product_service,
        Master.products_service.selectOptionColumns.id,
      )

      .innerJoin(
        Master.charts_of_accounts.tablename,
        Accounting.cash_disbursement_items.selectOptionColumns.charts_of_accounts,
        Master.charts_of_accounts.selectOptionColumns.id,
      )

      .whereIn(
        Accounting.cash_disbursement_items.selectOptionColumns.cash_disbursement_id,
        disbursementIds,
      )

      .build()

    let disbursement_items = await Query(
      disbursement_items_query,
      [...disbursementIds],
      [Accounting.cash_disbursement_items.prefix_],
    )

    const disbursement_journal_query = sql
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

      .whereIn(Accounting.journal_entries.selectOptionColumns.db_id, disbursementIds)

      .build()

    let disbursement_journal = await Query(
      disbursement_journal_query,
      ['cash_disbursements', ...disbursementIds],
      [Accounting.journal_entries.prefix_],
    )

    console.log('Raw journal data:', disbursement_journal)

    // Group items and journal by disbursement ID

    const groupedData = disbursements.map((disbursement) => {
      const disbursementItems = disbursement_items.filter(
        (item) => item.cash_disbursement_id === disbursement.id,
      )

      // Filter journal entries: exclude for vendor copies, include for internal copies

      const disbursementJournal =
        copyType === 'vendor'
          ? [] // No journal entries for vendor copies
          : disbursement_journal.filter((entry) => entry.db_id === disbursement.id)

      // Map items to PDF expected format

      const mappedItems = disbursementItems.map((item) => {
        const quantity = parseFloat(item.quantity || 1)

        const purchasePrice = parseFloat(item.purchase_price || 0)

        const discount = parseFloat(item.discount || 0)

        const vatRate = parseFloat(item.vat_rate || 0)

        const whtRate = parseFloat(item.withholding_tax_rate || 0)

        const totalPrice = purchasePrice * quantity

        const discountAmount =
          item.discount_type === 'PERCENT' ? totalPrice * (discount / 100) : discount

        const discountedPrice = totalPrice - discountAmount

        const vatAmount = discountedPrice * (vatRate / 100)

        const whtAmount = discountedPrice * (whtRate / 100)

        const amountDue = discountedPrice + vatAmount - whtAmount

        return {
          id: item.id,

          product_name: item.product_service_name || '—',

          description: item.description || '—',

          unit: 'pcs', // Default unit since not in DB

          quantity: quantity,

          purchase_price: purchasePrice,

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

      // Map journal to PDF expected format

      const mappedJournal = disbursementJournal.map((entry) => {
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
        ...disbursement,

        items: mappedItems,

        journal: mappedJournal,

        company: company,
      }
    })

    console.log('Grouped disbursements data:', groupedData)

    res.status(200).json({
      success: true,

      message: 'Disbursements retrieved successfully for printing',

      company: company,

      data: groupedData,

      count: groupedData.length,

      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error fetching disbursements for printing:', error)

    return res.status(500).json({
      success: false,

      message: 'Server error while fetching disbursements',

      error:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Internal server error',
    })
  }
}

module.exports = {
  getCashDisbursements,

  getAllCashDisbursements,

  createCashDisbursement,

  updateCashDisbursement,

  updateDisbursementState,

  getPrintDisbursements,
}
