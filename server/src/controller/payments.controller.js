const os = require('os')

const {
  checkConnection,
  SelectAll,
  Query,
  Transaction,
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

const { broadcastUpdates } = require('../startup/socket.startup')

const sql = new SQLQueryBuilder()

require('dotenv').config()

const getPayments = async (req, res, next) => {
  try {
    const { offset, limit, dateFrom, dateTo, date_from, date_to } = req.query
    const paymentsDateFrom = dateFrom || date_from
    const paymentsDateTo = dateTo || date_to
    const shouldPaginate = offset !== undefined && limit !== undefined
    const offsetNum = shouldPaginate ? Math.max(0, parseInt(offset, 10) || 0) : 0
    const limitNum = shouldPaginate
      ? Math.max(1, Math.min(100, parseInt(limit, 10) || 50))
      : null

    const paymentDateColumn = `DATE(${Accounting.payments.tablename}.${Accounting.payments.selectOptionColumns.payment_date})`
    let whereClause = ''
    const queryParams = []

    if (paymentsDateFrom) {
      whereClause += ` WHERE ${paymentDateColumn} >= ?`
      queryParams.push(paymentsDateFrom)
    }

    if (paymentsDateTo) {
      if (whereClause) {
        whereClause += ` AND ${paymentDateColumn} <= ?`
      } else {
        whereClause += ` WHERE ${paymentDateColumn} <= ?`
      }
      queryParams.push(paymentsDateTo)
    }

    const query = sql
      .select([
        { col: Accounting.payments.selectOptionColumns.id, as: 'id' },

        { col: Master.vendors.selectOptionColumns.name, as: 'vendor' },

        {
          col: Accounting.payments.selectOptionColumns.document_reference,
          as: 'doc_ref',
        },

        {
          col: Accounting.payments.selectOptionColumns.mode_of_payment,
          as: 'mode_of_payment',
        },

        { col: Accounting.payments.selectOptionColumns.bank_name, as: 'bank_name' },

        {
          col: Accounting.payments.selectOptionColumns.check_number,
          as: 'check_number',
        },

        {
          col: Accounting.payments.selectOptionColumns.payment_date,
          as: 'payment_date',
        },

        { col: Accounting.payments.selectOptionColumns.state, as: 'state' },
      ])

      .from(Accounting.payments.tablename)

      .innerJoin(
        Master.vendors.tablename,
        Accounting.payments.selectOptionColumns.vendor_id,
        Master.vendors.selectOptionColumns.id,
      )

      .build()

    const queryWithWhere = query + whereClause
    if (shouldPaginate) {
      queryParams.push(limitNum)
      queryParams.push(offsetNum)
    }

    const paginatedQuery = shouldPaginate
      ? `${queryWithWhere} ORDER BY ${Accounting.payments.selectOptionColumns.id} DESC LIMIT ? OFFSET ?`
      : `${queryWithWhere} ORDER BY ${Accounting.payments.selectOptionColumns.id} DESC`

    let payments = await Query(paginatedQuery, queryParams, [
      Accounting.payments.prefix_,
      Master.vendors.prefix_,
    ])

    res.status(200).json({
      success: true,

      message: 'Payments retrieved successfully',

      data: payments,

      count: payments.length,

      offset: offsetNum,

      limit: limitNum,

      hasMore: shouldPaginate ? payments.length === limitNum : false,

      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error fetching payments:', error)

    return res.status(500).json({
      success: false,

      message: 'Server error while fetching payments',

      error:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Internal server error',
    })
  }
}

const getPurchasePayment = async (req, res, next) => {
  try {
    const query = sql
      .select([
        { col: Accounting.purchase.selectOptionColumns.id, as: 'id' },

        { col: Master.vendors.selectOptionColumns.name, as: 'vendor' },

        {
          col: Accounting.purchase.selectOptionColumns.document_reference,
          as: 'doc_ref',
        },

        { col: Accounting.purchase.selectOptionColumns.terms, as: 'terms' },

        { col: Accounting.purchase.selectOptionColumns.date_due, as: 'date_due' },

        {
          col: Accounting.purchase.selectOptionColumns.total_amount_due,
          as: 'amount_due',
        },

        { col: Accounting.purchase.selectOptionColumns.status, as: 'status' },
      ])

      .from(Accounting.purchase.tablename)

      .innerJoin(
        Master.vendors.tablename,
        Accounting.purchase.selectOptionColumns.vendor_id,
        Master.vendors.selectOptionColumns.id,
      )

      .where(Accounting.purchase.selectOptionColumns.state)

      .andWhereNotExists(
        `SELECT 1 FROM ${Accounting.payment_items.tablename} pi_pay ` +
          `INNER JOIN ${Accounting.purchase_items.tablename} pi_inv ON pi_inv.${Accounting.purchase_items.selectOptionColumns.id} = pi_pay.${Accounting.payment_items.selectOptionColumns.purchase_id} ` +
          `WHERE pi_inv.${Accounting.purchase_items.selectOptionColumns.purchase_id} = ${Accounting.purchase.selectOptionColumns.id}`,
      )

      .andWhereNot(Accounting.purchase.selectOptionColumns.status)

      .build()

    let purchases = await Query(
      query,
      ['APPROVED', 'PAID'],
      [Accounting.purchase.prefix_, Master.vendors.prefix_],
    )

    console.log('PURCHASES QUERY 1', query)

    console.log('PURCHASES QUERY 2', purchases)

    res.status(200).json({
      success: true,

      message: 'Purchases retrieved successfully',

      data: purchases,

      count: purchases.length,

      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error fetching purchases:', error)

    res.status(500).json({
      success: false,

      message: 'Failed to fetch purchases data',

      error: error.message,

      timestamp: new Date().toISOString(),
    })
  }
}

const getPurchaseItemsPayment = async (req, res, next) => {
  try {
    const { purchase_id } = req.query

    console.log('Purchase IDs received:', req.query)

    const purchaseIds = (
      Array.isArray(purchase_id) ? purchase_id : [purchase_id]
    ).filter((id) => id !== undefined && id !== null && id !== '')

    if (purchaseIds.length === 0) {
      return res.status(400).json({
        success: false,

        message: 'No purchase IDs provided',

        timestamp: new Date().toISOString(),
      })
    }

    const query = sql
      .select([
        { col: Accounting.purchase_items.selectOptionColumns.id, as: 'id' },

        {
          col: Accounting.purchase_items.selectOptionColumns.purchase_id,
          as: 'purchase_id',
        },

        {
          col: Accounting.purchase_items.selectOptionColumns.product_service,
          as: 'product_service',
        },

        {
          col: Master.products_service.selectOptionColumns.name,
          as: 'product_service_name',
        },

        {
          col: Accounting.purchase_items.selectOptionColumns.charts_of_accounts,
          as: 'charts_of_accounts',
        },

        { col: Master.charts_of_accounts.selectOptionColumns.name, as: 'coa_name' },

        {
          col: Accounting.purchase.selectOptionColumns.document_reference,
          as: 'document_reference',
        },

        {
          col: Accounting.purchase_items.selectOptionColumns.description,
          as: 'description',
        },

        {
          col: Accounting.purchase_items.selectOptionColumns.quantity,
          as: 'quantity',
        },

        {
          col: Accounting.purchase_items.selectOptionColumns.purchase_price,
          as: 'purchase_price',
        },

        {
          col: Accounting.purchase_items.selectOptionColumns.discount,
          as: 'discount',
        },

        {
          col: Accounting.purchase_items.selectOptionColumns.discount_type,
          as: 'discount_type',
        },

        { col: Master.vat.selectOptionColumns.rate, as: 'vat' },

        {
          col: Master.withholding_tax.selectOptionColumns.rate,
          as: 'witholding_tax',
        },

        {
          col: Accounting.purchase_items.selectOptionColumns.responsibility_center,
          as: 'responsibility_center',
        },
      ])

      .from(Accounting.purchase_items.tablename)

      .leftJoin(
        Master.vat.tablename,

        Accounting.purchase_items.selectOptionColumns.vat,

        Master.vat.selectOptionColumns.id,
      )

      .leftJoin(
        Master.withholding_tax.tablename,

        Accounting.purchase_items.selectOptionColumns.withholding_tax,

        Master.withholding_tax.selectOptionColumns.id,
      )

      .innerJoin(
        Accounting.purchase.tablename,

        Accounting.purchase_items.selectOptionColumns.purchase_id,

        Accounting.purchase.selectOptionColumns.id,
      )

      .leftJoin(
        Master.products_service.tablename,

        Accounting.purchase_items.selectOptionColumns.product_service,

        Master.products_service.selectOptionColumns.id,
      )

      .innerJoin(
        Master.charts_of_accounts.tablename,

        Accounting.purchase_items.selectOptionColumns.charts_of_accounts,

        Master.charts_of_accounts.selectOptionColumns.id,
      )

      .whereIn(
        Accounting.purchase_items.selectOptionColumns.purchase_id,

        purchaseIds,
      )

      .build()

    const purchaseItems = await Query(
      query,

      purchaseIds,

      [
        Accounting.purchase_items.prefix_,

        Accounting.purchase.prefix_,

        Master.products_service.prefix_,

        Master.charts_of_accounts.prefix_,
      ],
    )

    console.log('Purchase items fetched:', purchaseItems, 'rows')

    res.status(200).json({
      success: true,

      message: 'Purchase items retrieved successfully',

      data: purchaseItems,

      count: purchaseItems.length,

      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error fetching purchase items for payment:', error)

    res.status(500).json({
      success: false,

      message: 'Failed to fetch purchase items data',

      error: error.message,

      timestamp: new Date().toISOString(),
    })
  }
}

const getAllPayments = async (req, res, next) => {
  const { payment_id } = req.params

  const paymentId = Number(payment_id)

  console.log('Converted payment_id:', paymentId, 'type:', typeof paymentId)

  if (!payment_id || isNaN(paymentId)) {
    return res.status(400).json({
      success: false,

      message: 'Invalid payment ID provided',

      timestamp: new Date().toISOString(),
    })
  }

  try {
    const payment_query = sql
      .select([
        { col: Accounting.payments.selectOptionColumns.id, as: 'id' },

        { col: Master.vendors.selectOptionColumns.name, as: 'vendor' },

        {
          col: Accounting.payments.selectOptionColumns.document_reference,
          as: 'doc_ref',
        },

        {
          col: Accounting.payments.selectOptionColumns.mode_of_payment,
          as: 'mode_of_payment',
        },

        { col: Accounting.payments.selectOptionColumns.bank_name, as: 'bank_name' },

        {
          col: Accounting.payments.selectOptionColumns.check_number,
          as: 'check_number',
        },

        {
          col: Accounting.payments.selectOptionColumns.payment_date,
          as: 'payment_date',
        },

        { col: Accounting.payments.selectOptionColumns.remarks, as: 'remarks' },

        { col: Accounting.payments.selectOptionColumns.state, as: 'state' },

        {
          col: Master.vendors_information.selectOptionColumns.address,
          as: 'vendor_address',
        },

        {
          col: Master.vendors_information.selectOptionColumns.tin,
          as: 'vendor_tin',
        },
      ])

      .from(Accounting.payments.tablename)

      .innerJoin(
        Master.vendors.tablename,
        Accounting.payments.selectOptionColumns.vendor_id,
        Master.vendors.selectOptionColumns.id,
      )

      .leftJoin(
        Master.vendors_information.tablename,
        `${Master.vendors_information.tablename}.${Master.vendors_information.selectOptionColumns.vendor_id}`,
        `${Master.vendors.tablename}.${Master.vendors.selectOptionColumns.id}`,
      )

      .where(Accounting.payments.selectOptionColumns.id)

      .build()

    let payment = await Query(
      payment_query,
      [paymentId],
      [
        Accounting.payments.prefix_,
        Master.vendors.prefix_,
        Master.vendors_information.prefix_,
      ],
    )

    // Sanitize vendor info for PDF
    payment = (payment || []).map((r) => ({
      ...r,
      vendor_address: r.vendor_address || '',
      vendor_tin: r.vendor_tin || '',
    }))

    const payment_items_query = sql
      .select([
        { col: Accounting.payment_items.selectOptionColumns.id, as: 'id' },

        {
          col: Accounting.payment_items.selectOptionColumns.purchase_id,
          as: 'purchase_item_id',
        },

        {
          col: Accounting.purchase.selectOptionColumns.document_reference,
          as: 'invoice_ref',
        },

        {
          col: Master.products_service.selectOptionColumns.name,
          as: 'product_service_name',
        },

        {
          col: Accounting.purchase_items.selectOptionColumns.description,
          as: 'description',
        },

        {
          col: Accounting.purchase_items.selectOptionColumns.quantity,
          as: 'quantity',
        },

        {
          col: Accounting.purchase_items.selectOptionColumns.purchase_price,
          as: 'purchase_price',
        },

        {
          col: Accounting.purchase_items.selectOptionColumns.discount,
          as: 'discount',
        },

        {
          col: Accounting.purchase_items.selectOptionColumns.discount_type,
          as: 'discount_type',
        },

        { col: Master.vat.selectOptionColumns.rate, as: 'vat_rate' },

        { col: Accounting.payment_items.selectOptionColumns.amount, as: 'amount' },

        {
          col: Accounting.payment_items.selectOptionColumns.witholding_tax,
          as: 'witholding_tax',
        },

        {
          col: Master.withholding_tax.selectOptionColumns.rate,
          as: 'withholding_tax_rate',
        },

        {
          col: Accounting.purchase_items.selectOptionColumns.responsibility_center,
          as: 'responsibility_center',
        },
      ])

      .from(Accounting.payment_items.tablename)

      .innerJoin(
        Accounting.purchase_items.tablename,
        Accounting.purchase_items.selectOptionColumns.id,
        Accounting.payment_items.selectOptionColumns.purchase_id,
      )

      .innerJoin(
        Accounting.purchase.tablename,
        Accounting.purchase.selectOptionColumns.id,
        Accounting.purchase_items.selectOptionColumns.purchase_id,
      )

      .leftJoin(
        Master.vat.tablename,

        Accounting.purchase_items.selectOptionColumns.vat,

        Master.vat.selectOptionColumns.id,
      )

      .leftJoin(
        Master.withholding_tax.tablename,

        Accounting.purchase_items.selectOptionColumns.withholding_tax,

        Master.withholding_tax.selectOptionColumns.id,
      )

      .leftJoin(
        Master.products_service.tablename,
        Master.products_service.selectOptionColumns.id,
        Accounting.purchase_items.selectOptionColumns.product_service,
      )

      .where(Accounting.payment_items.selectOptionColumns.payment_id)

      .build()

    let payment_items = await Query(
      payment_items_query,
      [paymentId],
      [Accounting.payment_items.prefix_],
    )

    console.log('PAYMENT ITEMS QUERY', payment_items_query)

    const payment_journal_query = sql
      .select([
        { col: Accounting.journal_entries.selectOptionColumns.id, as: 'id' },

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

    let payment_journal = await Query(
      payment_journal_query,
      ['payments', paymentId],
      [Accounting.journal_entries.prefix_],
    )

    const payment_attachments_query = sql
      .select([
        { col: Accounting.payment_attachments.selectOptionColumns.id, as: 'id' },

        { col: Accounting.payment_attachments.selectOptionColumns.name, as: 'name' },

        { col: Accounting.payment_attachments.selectOptionColumns.file, as: 'file' },

        {
          col: Accounting.payment_attachments.selectOptionColumns.remarks,
          as: 'remarks',
        },

        {
          col: Accounting.payment_attachments.selectOptionColumns.uploaded_by,
          as: 'uploaded_by',
        },

        {
          col: Accounting.payment_attachments.selectOptionColumns.uploaded_date,
          as: 'uploaded_date',
        },
      ])

      .from(Accounting.payment_attachments.tablename)

      .where(Accounting.payment_attachments.selectOptionColumns.payment_id)

      .build()

    let payment_attachments = await Query(
      payment_attachments_query,
      [paymentId],
      [Accounting.payment_attachments.prefix_],
    )

    console.log(payment, payment_items, payment_journal, payment_attachments)

    res.status(200).json({
      success: true,

      message: 'Payment retrieved successfully',

      data: payment,

      items: payment_items,

      journal: payment_journal,

      attachments: payment_attachments,

      count: payment.length,

      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error fetching payment:', error)

    return res.status(500).json({
      success: false,

      message: 'Server error while fetching payment',

      error:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Internal server error',
    })
  }
}

const createPayment = async (req, res, next) => {
  try {
    const {
      vendor_id,

      document_reference,

      mode_of_payment,

      bank_name,

      check_number,

      payment_date,

      remarks,

      total_amount_due,

      created_by,

      payment_items,

      journal_entries,

      attachments,
    } = req.body

    console.log(req.body)

    if (!vendor_id || !mode_of_payment || !payment_date || !created_by) {
      return res.status(400).json({
        success: false,

        message:
          'Missing required fields: vendor_id, document_reference, mode_of_payment, payment_date, created_by',
      })
    }

    // Validate that vendor_id exists before creating payment

    const vendorQuery = sql
      .select([
        { col: Master.vendors.selectOptionColumns.id, as: 'id' },

        { col: Master.vendors.selectOptionColumns.name, as: 'name' },
      ])

      .from(Master.vendors.tablename)

      .where(Master.vendors.selectOptionColumns.id)

      .build()

    const [vendorResult] = await Query(
      vendorQuery,
      [vendor_id],
      [Master.vendors.prefix_],
    )

    console.log('Vendor validation result:', vendorResult)

    if (!vendorResult || vendorResult.length === 0) {
      return res.status(400).json({
        success: false,

        message: `Invalid vendor_id: ${vendor_id}. Vendor does not exist in database.`,
      })
    }

    if (
      (mode_of_payment === 'CHECK' || mode_of_payment === 'BANK_TRANSFER') &&
      !bank_name
    ) {
      return res.status(400).json({
        success: false,

        message: 'Bank name is required for CHECK and BANK_TRANSFER payments',
      })
    }

    if (mode_of_payment === 'CHECK' && !check_number) {
      return res.status(400).json({
        success: false,

        message: 'Check number is required for CHECK payments',
      })
    }

    let connection

    try {
      connection = await getTenantPool().getConnection()

      await connection.beginTransaction()

      const mainQuery = sql
        .insert(Accounting.payments.tablename, {
          columns: Accounting.payments.insertColumns,

          prefix: Accounting.payments.prefix,

          isTransaction: true,
        })
        .build()

      const mainValues = [
        parseInt(vendor_id) || null,

        document_reference || ' ',

        mode_of_payment || null,

        bank_name || null,

        check_number || null,

        payment_date || null,

        remarks || null,

        'PREPARED',

        new Date().toISOString().split('T')[0],

        created_by || null,

        null, // checked_by

        null, // approved_by
      ]

      const [mainResult] = await connection.execute(mainQuery, mainValues)

      const paymentId = mainResult.insertId

      if (payment_items && payment_items.length > 0) {
        for (const item of payment_items) {
          const itemQuery = sql
            .insert(Accounting.payment_items.tablename, {
              columns: Accounting.payment_items.insertColumns,

              prefix: Accounting.payment_items.prefix,

              isTransaction: true,
            })
            .build()

          const itemValues = [
            paymentId,

            item.purchase_id || null,

            item.amount || 0,

            item.witholding_tax || 0,
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
            'payments',

            paymentId,

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
            .insert(Accounting.payment_attachments.tablename, {
              columns: Accounting.payment_attachments.insertColumns,

              prefix: Accounting.payment_attachments.prefix,

              isTransaction: true,
            })
            .build()

          const attachmentValues = [
            paymentId,

            attachment.file || null,

            attachment.name || null,

            attachment.remarks || null,

            attachment.uploadedBy || null,

            attachment.uploaded_date || new Date().toISOString().split('T')[0],
          ]

          await connection.execute(attachmentQuery, attachmentValues)
        }
      }

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
          paymentId || null,

          'PAYMENT',

          req.context?.username || null,

          now.toISOString().split('T')[0],

          now.toTimeString().split(' ')[0],

          `CREATE: ID ${paymentId}`,
        ],
      })

      await Transaction(auditQueries)

      res.status(201).json({
        success: true,

        message: 'Payment created successfully',

        data: { id: paymentId },

        timestamp: new Date().toISOString(),
      })

      // Broadcast after response (non-blocking)
      setImmediate(async () => {
        try {
          const selectNewPaymentQuery = sql
            .select([
              { col: Accounting.payments.selectOptionColumns.id, as: 'id' },
              { col: Master.vendors.selectOptionColumns.name, as: 'vendor' },
              {
                col: Accounting.payments.selectOptionColumns.document_reference,
                as: 'doc_ref',
              },
              {
                col: Accounting.payments.selectOptionColumns.mode_of_payment,
                as: 'mode_of_payment',
              },
              {
                col: Accounting.payments.selectOptionColumns.bank_name,
                as: 'bank_name',
              },
              {
                col: Accounting.payments.selectOptionColumns.check_number,
                as: 'check_number',
              },
              {
                col: Accounting.payments.selectOptionColumns.payment_date,
                as: 'payment_date',
              },
              { col: Accounting.payments.selectOptionColumns.state, as: 'state' },
            ])
            .from(Accounting.payments.tablename)
            .innerJoin(
              Master.vendors.tablename,
              Accounting.payments.selectOptionColumns.vendor_id,
              Master.vendors.selectOptionColumns.id,
            )
            .where(Accounting.payments.selectOptionColumns.id)
            .build()

          const createdPaymentRows = await Query(
            selectNewPaymentQuery,
            [paymentId],
            [Accounting.payments.prefix_, Master.vendors.prefix_],
          )
          const createdPayment = Array.isArray(createdPaymentRows)
            ? createdPaymentRows[0]
            : createdPaymentRows

          if (createdPayment) {
            broadcastUpdates({ payment: createdPayment }, 'payment_created')
          }
        } catch (err) {
          console.error('Error broadcasting payment creation:', err)
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
    console.error('Error creating payment:', error)

    return res.status(500).json({
      success: false,

      message: 'Server error while creating payment',

      error:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Internal server error',
    })
  }
}

const updatePaymentState = async (req, res, next) => {
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
            .update(Accounting.payments.tablename)

            .set([
              Accounting.payments.selectOptionColumns.state,
              Accounting.payments.selectOptionColumns.checked_by,
            ])

            .where(Accounting.payments.selectOptionColumns.id)

            .build()

          updateValues = [nextState, req.context.username, id]
        } else if (currentState === 'CHECKED') {
          nextState = 'APPROVED'

          updateQuery = sql
            .update(Accounting.payments.tablename)

            .set([
              Accounting.payments.selectOptionColumns.state,
              Accounting.payments.selectOptionColumns.approved_by,
            ])

            .where(Accounting.payments.selectOptionColumns.id)

            .build()

          updateValues = [nextState, req.context.username, id]

          // Special logic for APPROVED state: update related purchase records to PAID

          const query = sql
            .select([
              {
                col: Accounting.payment_items.selectOptionColumns.purchase_id,
                as: 'purchase_id',
              },
            ])

            .from(Accounting.payment_items.tablename)

            .where(Accounting.payment_items.selectOptionColumns.payment_id)

            .build()

          let payment_items = await Query(
            query,
            [id],
            [Accounting.payment_items.prefix_],
          )

          console.log('payment_items', payment_items)

          const uniquePurchaseIds = [
            ...new Set(payment_items.map((item) => item.purchase_id)),
          ]

          console.log('uniquePurchaseIds', uniquePurchaseIds)

          for (const purchaseId of uniquePurchaseIds) {
            if (purchaseId) {
              const updatePurchaseQuery = sql
                .update(Accounting.purchase.tablename)

                .set([Accounting.purchase.selectOptionColumns.status])

                .where(Accounting.purchase.selectOptionColumns.id)

                .build()

              const updatePurchaseValues = ['PAID', purchaseId]

              await connection.execute(updatePurchaseQuery, updatePurchaseValues)

              console.log(`Updated purchase ID ${purchaseId} status to PAID`)
            }
          }

          return connection.execute(updateQuery, updateValues)
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
            u.id, // FIXED: replace null with payment ID

            'PAYMENT_STATE',

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

        message: `${results.length} payment(s) updated successfully`,

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
    console.error('Error updating payments:', error)

    return res.status(500).json({
      success: false,

      message: 'Server error while updating payments',

      error:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Internal server error',
    })
  }
}

const getPrintPayments = async (req, res, next) => {
  const { payment_id } = req.params

  const { copyType } = req.query

  const paymentIds = payment_id
    .split(',')
    .map((id) => id.trim())
    .filter((id) => id !== '')

  console.log('Converted payment_ids:', paymentIds, 'type:', typeof paymentIds)

  console.log('Copy type:', copyType)

  if (paymentIds.length === 0) {
    return res.status(400).json({
      success: false,

      message: 'Invalid payment IDs provided',

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

    const payments_query = sql
      .select([
        {
          col: `${Accounting.payments.tablename}.${Accounting.payments.selectOptionColumns.id}`,
          as: 'id',
        },

        {
          col: `${Accounting.payments.tablename}.${Accounting.payments.selectOptionColumns.vendor_id}`,
          as: 'vendor_id',
        },

        {
          col: `${Master.vendors.tablename}.${Master.vendors.selectOptionColumns.name}`,
          as: 'vendor',
        },

        {
          col: `${Accounting.payments.tablename}.${Accounting.payments.selectOptionColumns.document_reference}`,
          as: 'doc_ref',
        },

        {
          col: `${Accounting.payments.tablename}.${Accounting.payments.selectOptionColumns.mode_of_payment}`,
          as: 'mode_of_payment',
        },

        {
          col: `${Accounting.payments.tablename}.${Accounting.payments.selectOptionColumns.bank_name}`,
          as: 'bank_name',
        },

        {
          col: `${Accounting.payments.tablename}.${Accounting.payments.selectOptionColumns.check_number}`,
          as: 'check_number',
        },

        {
          col: `${Accounting.payments.tablename}.${Accounting.payments.selectOptionColumns.payment_date}`,
          as: 'payment_date',
        },

        {
          col: `${Accounting.payments.tablename}.${Accounting.payments.selectOptionColumns.remarks}`,
          as: 'remarks',
        },

        {
          col: `${Accounting.payments.tablename}.${Accounting.payments.selectOptionColumns.state}`,
          as: 'state',
        },

        {
          col: `${Accounting.payments.tablename}.${Accounting.payments.selectOptionColumns.created_by}`,
          as: 'created_by',
        },

        {
          col: `${Accounting.payments.tablename}.${Accounting.payments.selectOptionColumns.checked_by}`,
          as: 'checked_by',
        },

        {
          col: `${Accounting.payments.tablename}.${Accounting.payments.selectOptionColumns.approved_by}`,
          as: 'approved_by',
        },
      ])

      .from(Accounting.payments.tablename)

      .innerJoin(
        Master.vendors.tablename,
        `${Accounting.payments.tablename}.${Accounting.payments.selectOptionColumns.vendor_id}`,
        `${Master.vendors.tablename}.${Master.vendors.selectOptionColumns.id}`,
      )

      .whereIn(
        `${Accounting.payments.tablename}.${Accounting.payments.selectOptionColumns.id}`,
        paymentIds,
      )

      .build()

    let payments = await Query(
      payments_query,
      [...paymentIds],
      [Accounting.payments.prefix_, Master.vendors.prefix_],
    )

    // Fetch payment items

    const payment_items_query = sql
      .select([
        { col: Accounting.payment_items.selectOptionColumns.id, as: 'id' },

        {
          col: Accounting.payment_items.selectOptionColumns.payment_id,
          as: 'payment_id',
        },

        {
          col: Accounting.payment_items.selectOptionColumns.purchase_id,
          as: 'purchase_id',
        },

        {
          col: Accounting.purchase.selectOptionColumns.document_reference,
          as: 'invoice_ref',
        },

        {
          col: Master.products_service.selectOptionColumns.name,
          as: 'product_service_name',
        },

        {
          col: Accounting.purchase_items.selectOptionColumns.description,
          as: 'description',
        },

        {
          col: Accounting.purchase_items.selectOptionColumns.quantity,
          as: 'quantity',
        },

        {
          col: Accounting.purchase_items.selectOptionColumns.purchase_price,
          as: 'purchase_price',
        },

        {
          col: Accounting.purchase_items.selectOptionColumns.discount,
          as: 'discount',
        },

        {
          col: Accounting.purchase_items.selectOptionColumns.discount_type,
          as: 'discount_type',
        },

        { col: Master.vat.selectOptionColumns.rate, as: 'vat_rate' },

        { col: Accounting.payment_items.selectOptionColumns.amount, as: 'amount' },

        {
          col: Accounting.payment_items.selectOptionColumns.witholding_tax,
          as: 'witholding_tax',
        },

        {
          col: Master.withholding_tax.selectOptionColumns.rate,
          as: 'withholding_tax_rate',
        },

        {
          col: Accounting.purchase_items.selectOptionColumns.responsibility_center,
          as: 'responsibility_center',
        },
      ])

      .from(Accounting.payment_items.tablename)

      .innerJoin(
        Accounting.purchase_items.tablename,
        Accounting.purchase_items.selectOptionColumns.id,
        Accounting.payment_items.selectOptionColumns.purchase_id,
      )

      .innerJoin(
        Accounting.purchase.tablename,
        Accounting.purchase.selectOptionColumns.id,
        Accounting.purchase_items.selectOptionColumns.purchase_id,
      )

      .leftJoin(
        Master.vat.tablename,
        Accounting.purchase_items.selectOptionColumns.vat,
        Master.vat.selectOptionColumns.id,
      )

      .leftJoin(
        Master.withholding_tax.tablename,
        Accounting.purchase_items.selectOptionColumns.withholding_tax,
        Master.withholding_tax.selectOptionColumns.id,
      )

      .leftJoin(
        Master.products_service.tablename,
        Master.products_service.selectOptionColumns.id,
        Accounting.purchase_items.selectOptionColumns.product_service,
      )

      .whereIn(Accounting.payment_items.selectOptionColumns.payment_id, paymentIds)

      .build()

    let payment_items = await Query(
      payment_items_query,
      [...paymentIds],
      [Accounting.payment_items.prefix_],
    )

    // Fetch journal entries

    const payment_journal_query = sql
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

      .whereIn(Accounting.journal_entries.selectOptionColumns.db_id, paymentIds)

      .build()

    let payment_journal = await Query(
      payment_journal_query,
      ['payments', ...paymentIds],
      [Accounting.journal_entries.prefix_],
    )

    console.log('Raw journal data:', payment_journal)

    // Fetch attachments

    const payment_attachments_query = sql
      .select([
        { col: Accounting.payment_attachments.selectOptionColumns.id, as: 'id' },

        {
          col: Accounting.payment_attachments.selectOptionColumns.payment_id,
          as: 'payment_id',
        },

        { col: Accounting.payment_attachments.selectOptionColumns.file, as: 'file' },

        { col: Accounting.payment_attachments.selectOptionColumns.name, as: 'name' },

        {
          col: Accounting.payment_attachments.selectOptionColumns.remarks,
          as: 'remarks',
        },

        {
          col: Accounting.payment_attachments.selectOptionColumns.uploaded_by,
          as: 'uploaded_by',
        },

        {
          col: Accounting.payment_attachments.selectOptionColumns.uploaded_date,
          as: 'uploaded_date',
        },
      ])

      .from(Accounting.payment_attachments.tablename)

      .whereIn(
        Accounting.payment_attachments.selectOptionColumns.payment_id,
        paymentIds,
      )

      .build()

    let payment_attachments = await Query(
      payment_attachments_query,
      [...paymentIds],
      [Accounting.payment_attachments.prefix_],
    )

    // Fetch vendors_information for involved vendors
    const paymentVendorIds = Array.from(
      new Set(payments.map((p) => p.vendor_id).filter(Boolean)),
    )
    let vendorsInfoMap = {}
    if (paymentVendorIds.length > 0) {
      const placeholders = paymentVendorIds.map(() => '?').join(',')
      const vendors_info_query = `SELECT ${Master.vendors_information.selectOptionColumns.vendor_id} AS vendor_id, ${Master.vendors_information.selectOptionColumns.address} AS address, ${Master.vendors_information.selectOptionColumns.tin} AS tin FROM ${Master.vendors_information.tablename} WHERE ${Master.vendors_information.selectOptionColumns.vendor_id} IN (${placeholders})`
      let vendors_info_rows = await Query(
        vendors_info_query,
        [...paymentVendorIds],
        [Master.vendors_information.prefix_],
      )
      vendors_info_rows = vendors_info_rows || []
      vendorsInfoMap = vendors_info_rows.reduce((acc, row) => {
        acc[row.vendor_id] = { address: row.address || '', tin: row.tin || '' }
        return acc
      }, {})
    }

    // Group items, journal, and attachments by payment ID

    const groupedData = payments.map((payment) => {
      // merge vendor info
      const vi = vendorsInfoMap[payment.vendor_id]
      if (vi) {
        payment.vendor_address = vi.address || payment.vendor_address || ''
        payment.vendor_tin = vi.tin || payment.vendor_tin || ''
      } else {
        payment.vendor_address = payment.vendor_address || ''
        payment.vendor_tin = payment.vendor_tin || ''
      }
      const paymentItems = payment_items.filter(
        (item) => item.payment_id === payment.id,
      )

      const paymentJournal =
        copyType === 'customer'
          ? []
          : payment_journal.filter(
              (entry) => Number(entry.db_id) === Number(payment.id),
            )

      const mappedItems = paymentItems.map((item) => {
        const quantity = parseFloat(item.quantity || 1)

        const purchasePrice = parseFloat(item.purchase_price || 0)

        const discount = parseFloat(item.discount || 0)

        const vatRate = parseFloat(item.vat_rate || 0)

        const whtRate = parseFloat(item.withholding_tax_rate || 0)

        const amount = parseFloat(item.amount || 0)

        const totalPrice = purchasePrice * quantity

        const discountAmount = totalPrice * (discount / 100)

        const discountedPrice = totalPrice - discountAmount

        const vatAmount = discountedPrice * (vatRate / 100)

        const whtAmount = discountedPrice * (whtRate / 100)

        const amountDue = amount || discountedPrice + vatAmount - whtAmount

        return {
          id: item.id,

          product_name: item.product_service_name || '—',

          description: item.description || '—',

          unit: 'pcs',

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

      const mappedJournal = paymentJournal.map((entry) => {
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
        ...payment,

        items: mappedItems,

        journal: mappedJournal,

        attachments: payment_attachments.filter(
          (att) => att.payment_id === payment.id,
        ),

        company: company,
      }
    })

    console.log('Grouped payments data:', groupedData)

    res.status(200).json({
      success: true,

      message: 'Payments retrieved successfully',

      company: company,

      data: groupedData,

      count: groupedData.length,

      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error fetching payments:', error)

    return res.status(500).json({
      success: false,

      message: 'Server error while fetching payments',

      error:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Internal server error',
    })
  }
}

const updatePayment = async (req, res, next) => {
  const { payment_id } = req.params

  const paymentId = Number(payment_id)

  console.log('Updating payment_id:', paymentId, 'type:', typeof paymentId)

  try {
    const {
      vendor_id,

      document_reference,

      mode_of_payment,

      bank_name,

      check_number,

      payment_date,

      remarks,

      total_amount_due,

      updated_by,

      payment_items,

      journal_entries,

      attachments,
    } = req.body

    console.log('Update data:', req.body)

    // Convert vendor name to vendor ID if needed

    let actualVendorId = vendor_id

    if (vendor_id && isNaN(Number(vendor_id))) {
      // vendor_id is a name, need to find actual ID

      console.log('Looking up vendor by name:', vendor_id)

      const vendorQuery = sql
        .select([
          { col: Master.vendors.selectOptionColumns.id, as: 'id' },

          { col: Master.vendors.selectOptionColumns.name, as: 'name' },
        ])

        .from(Master.vendors.tablename)

        .where(Master.vendors.selectOptionColumns.name)

        .build()

      console.log('Vendor query SQL:', vendorQuery)

      const [vendorResult] = await Query(
        vendorQuery,
        [vendor_id],
        [Master.vendors.prefix_],
      )

      console.log('Vendor lookup result:', vendorResult)

      if (vendorResult && vendorResult.length > 0) {
        actualVendorId = vendorResult[0].id

        console.log('Converted vendor name to ID:', vendor_id, '→', actualVendorId)
      } else {
        // Vendor was found but result structure is different

        // Check if vendorResult itself contains vendor data

        if (vendorResult && vendorResult.id) {
          actualVendorId = vendorResult.id

          console.log(
            'Found vendor in result object:',
            vendor_id,
            '→',
            actualVendorId,
          )
        } else {
          return res.status(400).json({
            success: false,

            message: `Invalid vendor name provided: "${vendor_id}"`,
          })
        }
      }
    }

    if (
      !actualVendorId ||
      !document_reference ||
      !mode_of_payment ||
      !payment_date ||
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

      const currentPaymentQuery = sql
        .select([
          {
            col: Accounting.payments.selectOptionColumns.vendor_id,
            as: 'vendor_id',
          },

          {
            col: Accounting.payments.selectOptionColumns.document_reference,
            as: 'document_reference',
          },

          {
            col: Accounting.payments.selectOptionColumns.mode_of_payment,
            as: 'mode_of_payment',
          },

          {
            col: Accounting.payments.selectOptionColumns.bank_name,
            as: 'bank_name',
          },

          {
            col: Accounting.payments.selectOptionColumns.check_number,
            as: 'check_number',
          },

          {
            col: Accounting.payments.selectOptionColumns.payment_date,
            as: 'payment_date',
          },

          { col: Accounting.payments.selectOptionColumns.remarks, as: 'remarks' },

          { col: Accounting.payments.selectOptionColumns.state, as: 'state' },
        ])

        .from(Accounting.payments.tablename)

        .where(Accounting.payments.selectOptionColumns.id)

        .build()

      const [currentPaymentData] = await connection.execute(currentPaymentQuery, [
        paymentId,
      ])

      // Fetch current payment items BEFORE updates

      let currentItemsData = []

      if (payment_items && payment_items.length > 0) {
        const currentItemsQuery = sql
          .select([
            { col: Accounting.payment_items.selectOptionColumns.id, as: 'id' },

            {
              col: Accounting.payment_items.selectOptionColumns.purchase_id,
              as: 'purchase_id',
            },

            {
              col: Accounting.payment_items.selectOptionColumns.amount,
              as: 'amount',
            },

            {
              col: Accounting.payment_items.selectOptionColumns.witholding_tax,
              as: 'witholding_tax',
            },
          ])

          .from(Accounting.payment_items.tablename)

          .where(Accounting.payment_items.selectOptionColumns.payment_id)

          .build()

        currentItemsData = await connection.execute(currentItemsQuery, [paymentId])
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

        currentJournalData = await Query(
          currentJournalQuery,
          ['payments', paymentId],
          [Accounting.journal_entries.prefix_],
        )
      }

      // Fetch current attachments BEFORE updates

      let currentAttachmentsData = []

      const currentAttachmentsQuery = sql
        .select([
          { col: Accounting.payment_attachments.selectOptionColumns.id, as: 'id' },

          {
            col: Accounting.payment_attachments.selectOptionColumns.name,
            as: 'name',
          },

          {
            col: Accounting.payment_attachments.selectOptionColumns.remarks,
            as: 'remarks',
          },
        ])

        .from(Accounting.payment_attachments.tablename)

        .where(Accounting.payment_attachments.selectOptionColumns.payment_id)

        .build()

      currentAttachmentsData = await connection.execute(currentAttachmentsQuery, [
        paymentId,
      ])

      const updateMainQuery = sql
        .update(Accounting.payments.tablename)

        .set([
          Accounting.payments.selectOptionColumns.vendor_id,

          Accounting.payments.selectOptionColumns.document_reference,

          Accounting.payments.selectOptionColumns.mode_of_payment,

          Accounting.payments.selectOptionColumns.bank_name,

          Accounting.payments.selectOptionColumns.check_number,

          Accounting.payments.selectOptionColumns.payment_date,

          Accounting.payments.selectOptionColumns.remarks,
        ])

        .where(Accounting.payments.selectOptionColumns.id)

        .build()

      const updateMainValues = [
        actualVendorId || null,

        document_reference || null,

        mode_of_payment || null,

        bank_name || null,

        check_number || null,

        payment_date || null,

        remarks || null,

        paymentId,
      ]

      await connection.execute(updateMainQuery, updateMainValues)

      // Skip payment items updates during edit mode

      // Payment items should not be modifiable after payment is created

      console.log('Skipping payment items updates - not allowed in edit mode')

      console.log('DEBUG: Server received journal_entries:', journal_entries)
      console.log('DEBUG: Journal entries length:', journal_entries?.length || 0)

      if (journal_entries && journal_entries.length > 0) {
        const existingEntriesQuery = sql
          .select([Accounting.journal_entries.selectOptionColumns.id])

          .from(Accounting.journal_entries.tablename)

          .where(Accounting.journal_entries.selectOptionColumns.db_name)

          .andWhere(Accounting.journal_entries.selectOptionColumns.db_id)

          .build()

        const existingEntries = await Query(
          existingEntriesQuery,
          ['payments', paymentId],
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
              'payments',
              paymentId,
            ])
          }
        }

        // Update or insert entries

        for (const entry of journal_entries) {
          const type = entry.debit > 0 ? 'debit' : 'credit'

          const amount = entry.debit > 0 ? entry.debit : entry.credit

          if (entry.id) {
            // Update existing entry

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
            // Insert new entry

            const insertEntryQuery = sql
              .insert(Accounting.journal_entries.tablename, {
                columns: Accounting.journal_entries.insertColumns,

                prefix: Accounting.journal_entries.prefix,

                isTransaction: true,
              })
              .build()

            const insertEntryValues = [
              'payments',

              paymentId,

              entry.account_id || null,

              entry.responsibility_center || '',

              type,

              amount,

              new Date().toISOString().split('T')[0],
            ]

            await connection.execute(insertEntryQuery, insertEntryValues)
          }
        }
      } else {
        const deleteAllEntriesQuery = sql
          .delete()

          .from(Accounting.journal_entries.tablename)

          .where(Accounting.journal_entries.selectOptionColumns.db_name)

          .andWhere(Accounting.journal_entries.selectOptionColumns.db_id)

          .build()

        await connection.execute(deleteAllEntriesQuery, ['payments', paymentId])
      }

      if (attachments && attachments.length > 0) {
        const existingAttachmentsQuery = sql
          .select([Accounting.payment_attachments.selectOptionColumns.id])

          .from(Accounting.payment_attachments.tablename)

          .where(Accounting.payment_attachments.selectOptionColumns.payment_id)

          .build()

        const existingAttachments = await Query(
          existingAttachmentsQuery,
          [paymentId],
          [Accounting.payment_attachments.prefix_],
        )

        const existingAttachmentIds = existingAttachments.map(
          (attachment) => attachment.id,
        )

        // Filter out attachments with valid numeric IDs (existing attachments from database)

        // String IDs starting with 'new_' indicate client-side generated IDs for new attachments

        const existingAttachmentsInPayload = attachments.filter(
          (attachment) =>
            attachment.id &&
            typeof attachment.id === 'number' &&
            !isNaN(attachment.id),
        )

        const payloadAttachmentIds = existingAttachmentsInPayload.map(
          (attachment) => attachment.id,
        )

        const attachmentsToDelete = existingAttachmentIds.filter(
          (id) => !payloadAttachmentIds.includes(id),
        )

        // Delete removed attachments

        for (const attachmentId of attachmentsToDelete) {
          const deleteQuery = sql
            .delete(Accounting.payment_attachments.tablename)

            .where(Accounting.payment_attachments.selectOptionColumns.id)

            .build()

          await connection.execute(deleteQuery, [attachmentId])
        }

        // Update or insert attachments

        for (const attachment of attachments) {
          // Check if ID is a valid numeric ID (existing attachment from database)

          // String IDs starting with 'new_' indicate client-side generated IDs for new attachments

          const isExistingAttachment =
            attachment.id &&
            typeof attachment.id === 'number' &&
            !isNaN(attachment.id)

          if (isExistingAttachment) {
            // Update existing attachment - include file if provided

            const updateFields = [
              Accounting.payment_attachments.selectOptionColumns.name,

              Accounting.payment_attachments.selectOptionColumns.remarks,
            ]

            const updateValues = [
              attachment.name || null,

              attachment.remarks || null,
            ]

            // Only update file if a new file is provided

            if (
              attachment.file &&
              typeof attachment.file === 'string' &&
              attachment.file.startsWith('data:')
            ) {
              updateFields.push(
                Accounting.payment_attachments.selectOptionColumns.file,
              )

              updateValues.push(attachment.file)
            }

            const updateAttachmentQuery = sql
              .update(Accounting.payment_attachments.tablename)

              .set(updateFields)

              .where(Accounting.payment_attachments.selectOptionColumns.id)

              .build()

            updateValues.push(attachment.id)

            await connection.execute(updateAttachmentQuery, updateValues)
          } else {
            // Insert new attachment (string IDs or null/undefined IDs indicate new attachments)

            const insertAttachmentQuery = sql
              .insert(Accounting.payment_attachments.tablename, {
                columns: Accounting.payment_attachments.insertColumns,

                prefix: Accounting.payment_attachments.prefix,

                isTransaction: true,
              })
              .build()

            const insertAttachmentValues = [
              paymentId,

              attachment.file || null,

              attachment.name || null,

              attachment.remarks || null,

              attachment.uploadedBy || null,

              attachment.uploaded_date || new Date().toISOString().split('T')[0],
            ]

            await connection.execute(insertAttachmentQuery, insertAttachmentValues)
          }
        }
      }

      // Track changes for audit trail using data fetched earlier

      const auditChanges = []

      // Helper function to normalize values for comparison

      const normalizeValue = (val) =>
        val === null || val === undefined ? '' : String(val).trim()

      const normalizeNumber = (val) =>
        val === null || val === undefined ? 0 : parseFloat(val)

      console.log('DEBUG: Current payment data:', currentPaymentData)

      console.log('DEBUG: Request body data:', {
        vendor_id,
        document_reference,
        mode_of_payment,
        bank_name,
        check_number,
        payment_date,
        remarks,
      })

      console.log('DEBUG: Payment items data:', payment_items)

      console.log('DEBUG: Journal entries data:', journal_entries)

      console.log('DEBUG: Attachments data:', attachments)

      if (currentPaymentData.length > 0) {
        const current = currentPaymentData[0]

        if (current.vendor_id !== actualVendorId) {
          auditChanges.push(`Vendor ID: ${current.vendor_id} → ${actualVendorId}`)
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

        const currentModeOfPayment = normalizeValue(current.mode_of_payment)

        const newModeOfPayment = normalizeValue(mode_of_payment)

        console.log('DEBUG: Mode of payment comparison:', {
          current: currentModeOfPayment,
          new: newModeOfPayment,
          changed: currentModeOfPayment !== newModeOfPayment,
        })

        if (currentModeOfPayment !== newModeOfPayment) {
          auditChanges.push(
            `Mode of Payment: ${currentModeOfPayment || 'NULL'} → ${newModeOfPayment || 'NULL'}`,
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

        const currentPaymentDate = normalizeValue(current.payment_date)

        const newPaymentDate = normalizeValue(payment_date)

        if (currentPaymentDate !== newPaymentDate) {
          auditChanges.push(
            `Payment Date: ${currentPaymentDate || 'NULL'} → ${newPaymentDate || 'NULL'}`,
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
      }

      // Track payment items changes using data fetched earlier

      console.log('DEBUG: Current items data from DB:', currentItemsData)

      console.log('DEBUG: Payment items in request:', payment_items)

      // Only process payment items audit if there are actual changes to payment items

      // Skip if payment_items is empty, null, or contains only existing items with no changes

      const hasPaymentItemsChanges =
        payment_items &&
        payment_items.length > 0 &&
        payment_items.some(
          (item) =>
            !item.id || // New items (no ID)
            (item.amount !== undefined && item.amount !== null), // Existing items with amount changes
        )

      console.log('DEBUG: Has payment items changes:', hasPaymentItemsChanges)

      if (hasPaymentItemsChanges) {
        for (let i = 0; i < payment_items.length; i++) {
          const item = payment_items[i]

          console.log('DEBUG: Processing item:', item)

          let currentItem = null

          if (item.id) {
            // Find by ID if available

            currentItem = currentItemsData[0]?.find((i) => i.id === item.id)
          }

          console.log('DEBUG: Found current item:', currentItem)

          if (currentItem) {
            // This is an existing item being updated, not a new item

            // Only compare amount if it's provided in the request (not undefined/null)

            if (item.amount !== undefined && item.amount !== null) {
              const currentAmount = normalizeNumber(currentItem.amount)

              const newAmount = normalizeNumber(item.amount)

              console.log('DEBUG: Item amount comparison:', {
                itemId: currentItem.id,
                current: currentAmount,
                new: newAmount,
                changed: currentAmount !== newAmount,
              })

              if (currentAmount !== newAmount) {
                auditChanges.push(
                  `Payment Item ${currentItem.id} Amount: ${currentAmount} → ${newAmount}`,
                )
              }
            }
          } else {
            // Only track new items if they have a purchase_id AND don't have an ID

            // Items with IDs are existing items, not new ones

            // This should only trigger for truly new items, not updates

            if (item.purchase_id && !item.id) {
              auditChanges.push(
                `Payment Item: Purchase ID ${item.purchase_id} (NEW)`,
              )
            }
          }
        }
      }

      // Track journal entries changes using data fetched earlier

      console.log('DEBUG: Current journal data from DB:', currentJournalData)

      console.log('DEBUG: Journal entries in request:', journal_entries)

      // Only process journal entries audit if there are actual changes to journal entries

      // Skip if journal_entries is empty, null, or contains only existing entries with no changes

      const hasJournalChanges =
        journal_entries &&
        journal_entries.length > 0 &&
        journal_entries.some(
          (entry) =>
            !entry.id || // New entries (no ID)
            (entry.debit !== undefined && entry.debit !== null) || // Existing entries with debit changes
            (entry.credit !== undefined && entry.credit !== null) || // Existing entries with credit changes
            (entry.responsibility_center !== undefined &&
              entry.responsibility_center !== null &&
              entry.responsibility_center !== ''), // Existing entries with responsibility center changes
        )

      console.log('DEBUG: Has journal changes:', hasJournalChanges)

      if (hasJournalChanges) {
        for (let i = 0; i < journal_entries.length; i++) {
          const entry = journal_entries[i]

          console.log('DEBUG: Processing journal entry:', entry)

          const type = entry.debit > 0 ? 'debit' : 'credit'

          const amount = entry.debit > 0 ? entry.debit : entry.credit

          let currentEntry = null

          if (entry.id) {
            // Find by ID if available

            currentEntry = currentJournalData?.find((j) => j.id === entry.id)
          } else {
            // If no ID, try to match by account_id, type, and position

            currentEntry = currentJournalData?.find(
              (existingEntry, index) =>
                existingEntry.account_id === entry.account_id &&
                existingEntry.type.toLowerCase() === type &&
                index === i,
            )

            // If still not found, try to match by account_id and type only

            if (!currentEntry && entry.account_id) {
              currentEntry = currentJournalData?.find(
                (existingEntry) =>
                  existingEntry.account_id === entry.account_id &&
                  existingEntry.type.toLowerCase() === type,
              )
            }

            // If still not found, try to match by amount and type only

            if (!currentEntry) {
              currentEntry = currentJournalData?.find(
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
            // Only log as "NEW" if the entry truly doesn't exist in current data

            // This happens when entry.id is null/undefined or no matching entry was found

            if (!entry.id) {
              auditChanges.push(
                `Journal Entry: ${normalizeValue(entry.responsibility_center) || 'Unassigned'} (NEW)`,
              )
            }

            // If entry has an ID but wasn't found in current data, it might be a new entry

            // that was added during this update session, so don't log it as "NEW"

            // since the actual insertion will be handled by the main update logic
          }
        }
      }

      // Track attachment changes

      console.log('DEBUG: Current attachments data from DB:', currentAttachmentsData)

      console.log('DEBUG: Request attachments data:', attachments)

      // Get existing attachments for comparison

      const existingAttachmentsQuery = sql
        .select([Accounting.payment_attachments.selectOptionColumns.id])

        .from(Accounting.payment_attachments.tablename)

        .where(Accounting.payment_attachments.selectOptionColumns.payment_id)

        .build()

      const existingAttachments = await Query(
        existingAttachmentsQuery,
        [paymentId],
        [Accounting.payment_attachments.prefix_],
      )

      const existingAttachmentIds = existingAttachments.map(
        (attachment) => attachment.id,
      )

      console.log('DEBUG: Existing attachment IDs:', existingAttachmentIds)

      if (attachments && attachments.length > 0) {
        // Filter out attachments with valid numeric IDs (existing attachments from database)

        // String IDs starting with 'new_' indicate client-side generated IDs for new attachments

        const existingAttachmentsInPayload = attachments.filter(
          (attachment) =>
            attachment.id &&
            typeof attachment.id === 'number' &&
            !isNaN(attachment.id),
        )

        const payloadAttachmentIds = existingAttachmentsInPayload.map(
          (attachment) => attachment.id,
        )

        console.log(
          'DEBUG: Valid payload attachments:',
          existingAttachmentsInPayload,
        )

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

          // Check if ID is a valid numeric ID (existing attachment from database)

          // String IDs starting with 'new_' indicate client-side generated IDs for new attachments

          const isExistingAttachment =
            attachment.id &&
            typeof attachment.id === 'number' &&
            !isNaN(attachment.id)

          console.log('DEBUG: Is existing attachment:', isExistingAttachment)

          if (isExistingAttachment) {
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
                `Attachment: ${normalizeValue(attachment.name) || normalizeValue(attachment.fileName) || 'Unknown'} (NEW)`,
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
              `Attachment: ${normalizeValue(attachment.name) || normalizeValue(attachment.fileName) || 'Unknown'} (NEW)`,
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
              paymentId,

              'PAYMENT_UPDATE',

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

        message: 'Payment updated successfully',

        data: { id: paymentId },

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
    console.error('Error updating payment:', error)

    return res.status(500).json({
      success: false,

      message: 'Server error while updating payment',

      error:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Internal server error',
    })
  }
}

module.exports = {
  getPayments,

  getAllPayments,

  getPurchasePayment,

  getPurchaseItemsPayment,

  createPayment,

  updatePayment,

  updatePaymentState,

  getPrintPayments,
}
