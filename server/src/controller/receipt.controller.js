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

const getReceipts = async (req, res, next) => {
  try {
    const { offset, limit, dateFrom, dateTo } = req.query
    const shouldPaginate = offset !== undefined && limit !== undefined
    const offsetNum = shouldPaginate ? Math.max(0, parseInt(offset, 10) || 0) : 0
    const limitNum = shouldPaginate
      ? Math.max(1, Math.min(100, parseInt(limit, 10) || 10))
      : null

    let baseQuery = sql
      .select([
        { col: Accounting.receipts.selectOptionColumns.id, as: 'id' },

        { col: Master.customers.selectOptionColumns.name, as: 'customer' },

        {
          col: Accounting.receipts.selectOptionColumns.document_reference,
          as: 'doc_ref',
        },

        {
          col: Accounting.receipts.selectOptionColumns.collection_date,
          as: 'collection_date',
        },

        { col: Accounting.receipts.selectOptionColumns.mode_of_payment, as: 'mode' },

        { col: Accounting.receipts.selectOptionColumns.bank_name, as: 'bank_name' },

        {
          col: Accounting.receipts.selectOptionColumns.check_number,
          as: 'check_number',
        },

        { col: Accounting.receipts.selectOptionColumns.remarks, as: 'remarks' },

        {
          col: Accounting.receipts.selectOptionColumns.total_amount_due,
          as: 'amount_due',
        },

        { col: Accounting.receipts.selectOptionColumns.state, as: 'state' },
      ])

      .from(Accounting.receipts.tablename)

      .innerJoin(
        Master.customers.tablename,
        Accounting.receipts.selectOptionColumns.customer_id,
        Master.customers.selectOptionColumns.id,
      )

      .build()

    // Build WHERE clause for date filters
    let whereClause = ''
    const dateParams = []

    if (dateFrom) {
      whereClause += ` WHERE ${Accounting.receipts.selectOptionColumns.collection_date} >= ?`
      dateParams.push(dateFrom)
    }

    if (dateTo) {
      if (whereClause) {
        whereClause += ` AND ${Accounting.receipts.selectOptionColumns.collection_date} <= ?`
      } else {
        whereClause += ` WHERE ${Accounting.receipts.selectOptionColumns.collection_date} <= ?`
      }
      dateParams.push(dateTo)
    }

    const queryWithWhere = baseQuery + whereClause

    // Build pagination params
    const queryParams = [...dateParams]
    if (shouldPaginate) {
      queryParams.push(limitNum)
      queryParams.push(offsetNum)
    }

    const paginatedQuery = shouldPaginate
      ? `${queryWithWhere} ORDER BY ${Accounting.receipts.selectOptionColumns.id} DESC LIMIT ? OFFSET ?`
      : `${queryWithWhere} ORDER BY ${Accounting.receipts.selectOptionColumns.id} DESC`

    let receipts = await Query(paginatedQuery, queryParams, [
      Accounting.receipts.prefix_,
      Master.customers.prefix_,
    ])

    res.status(200).json({
      success: true,

      message: 'Receipts retrieved successfully',

      data: receipts,

      count: receipts.length,

      offset: offsetNum,

      limit: limitNum,

      hasMore: shouldPaginate ? receipts.length === limitNum : false,

      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error fetching receipts:', error)

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

const getAllReceipts = async (req, res, next) => {
  const { receipt_id } = req.params

  const receiptId = receipt_id

  console.log('Converted receipt_id:', receiptId, 'type:', typeof receiptId)

  try {
    const receipts_query = sql
      .select([
        { col: Accounting.receipts.selectOptionColumns.id, as: 'id' },

        {
          col: Accounting.receipts.selectOptionColumns.customer_id,
          as: 'customer_id',
        },

        { col: Master.customers.selectOptionColumns.name, as: 'customer' },

        {
          col: Master.customers_information.selectOptionColumns.address,
          as: 'customer_address',
        },

        {
          col: Master.customers_information.selectOptionColumns.tin,
          as: 'customer_tin',
        },

        {
          col: Accounting.receipts.selectOptionColumns.document_reference,
          as: 'doc_ref',
        },

        {
          col: Accounting.receipts.selectOptionColumns.collection_date,
          as: 'collection_date',
        },

        { col: Accounting.receipts.selectOptionColumns.mode_of_payment, as: 'mode' },

        { col: Accounting.receipts.selectOptionColumns.bank_name, as: 'bank_name' },

        {
          col: Accounting.receipts.selectOptionColumns.check_number,
          as: 'check_number',
        },

        { col: Accounting.receipts.selectOptionColumns.remarks, as: 'remarks' },

        {
          col: Accounting.receipts.selectOptionColumns.total_amount_due,
          as: 'amount_due',
        },

        { col: Accounting.receipts.selectOptionColumns.state, as: 'state' },
      ])

      .from(Accounting.receipts.tablename)

      .innerJoin(
        Master.customers.tablename,
        Accounting.receipts.selectOptionColumns.customer_id,
        Master.customers.selectOptionColumns.id,
      )

      .leftJoin(
        Master.customers_information.tablename,
        `${Master.customers_information.tablename}.${Master.customers_information.selectOptionColumns.customer_id}`,
        `${Master.customers.tablename}.${Master.customers.selectOptionColumns.id}`,
      )

      .where(Accounting.receipts.selectOptionColumns.id)

      .build()

    let receipts = await Query(
      receipts_query,
      [receiptId],
      [
        Accounting.receipts.prefix_,
        Master.customers.prefix_,
        Master.customers_information.prefix_,
      ],
    )
    // Ensure customer address/tin are non-null strings for PDFs
    receipts = (receipts || []).map((r) => ({
      ...r,
      customer_address: r.customer_address || '',
      customer_tin: r.customer_tin || '',
    }))

    const receipts_items_query = sql
      .select([
        { col: Accounting.receipt_items.selectOptionColumns.id, as: 'id' },

        {
          col: Accounting.receipt_items.selectOptionColumns.product_service,
          as: 'product_service_id',
        },

        {
          col: Master.products_service.selectOptionColumns.name,
          as: 'product_service_name',
        },

        {
          col: Accounting.receipt_items.selectOptionColumns.charts_of_accounts,
          as: 'charts_of_accounts_id',
        },

        {
          col: Master.charts_of_accounts.selectOptionColumns.name,
          as: 'charts_of_accounts_name',
        },

        {
          col: Accounting.receipt_items.selectOptionColumns.description,
          as: 'description',
        },

        {
          col: Accounting.receipt_items.selectOptionColumns.quantity,
          as: 'quantity',
        },

        {
          col: Accounting.receipt_items.selectOptionColumns.sales_price,
          as: 'sales_price',
        },

        {
          col: Accounting.receipt_items.selectOptionColumns.discount,
          as: 'discount',
        },

        {
          col: Accounting.receipt_items.selectOptionColumns.discount_type,
          as: 'discount_type',
        },

        { col: Accounting.receipt_items.selectOptionColumns.vat, as: 'vat_id' },

        { col: Master.vat.selectOptionColumns.code, as: 'vat_code' },

        { col: Master.vat.selectOptionColumns.name, as: 'vat_name' },

        { col: Master.vat.selectOptionColumns.rate, as: 'vat_rate' },

        {
          col: Accounting.receipt_items.selectOptionColumns.withholding_tax,
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
          col: Accounting.receipt_items.selectOptionColumns.responsibility_center,
          as: 'responsibility_center',
        },
      ])

      .from(Accounting.receipt_items.tablename)

      .innerJoin(
        Master.vat.tablename,
        Accounting.receipt_items.selectOptionColumns.vat,
        Master.vat.selectOptionColumns.id,
      )

      .innerJoin(
        Master.withholding_tax.tablename,
        Accounting.receipt_items.selectOptionColumns.withholding_tax,
        Master.withholding_tax.selectOptionColumns.id,
      )

      .leftJoin(
        Master.products_service.tablename,
        Accounting.receipt_items.selectOptionColumns.product_service,
        Master.products_service.selectOptionColumns.id,
      )

      .innerJoin(
        Master.charts_of_accounts.tablename,
        Accounting.receipt_items.selectOptionColumns.charts_of_accounts,
        Master.charts_of_accounts.selectOptionColumns.id,
      )

      .where(Accounting.receipt_items.selectOptionColumns.receipts_id)

      .build()

    let receipts_items = await Query(
      receipts_items_query,
      [receiptId],
      [Accounting.receipt_items.prefix_],
    )

    const receipts_journal_query = sql
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

    let receipts_journal = await Query(
      receipts_journal_query,
      ['receipts', receiptId],
      [Accounting.journal_entries.prefix_],
    )

    const receipts_attachments_query = sql
      .select([
        { col: Accounting.receipt_attachments.selectOptionColumns.id, as: 'id' },

        { col: Accounting.receipt_attachments.selectOptionColumns.file, as: 'file' },

        { col: Accounting.receipt_attachments.selectOptionColumns.name, as: 'name' },

        {
          col: Accounting.receipt_attachments.selectOptionColumns.remarks,
          as: 'remarks',
        },

        {
          col: Accounting.receipt_attachments.selectOptionColumns.uploaded_by,
          as: 'uploaded_by',
        },

        {
          col: Accounting.receipt_attachments.selectOptionColumns.uploaded_date,
          as: 'uploaded_date',
        },
      ])

      .from(Accounting.receipt_attachments.tablename)

      .where(Accounting.receipt_attachments.selectOptionColumns.receipt_id)

      .build()

    let receipts_attachments = await Query(
      receipts_attachments_query,
      [receiptId],
      [Accounting.receipt_attachments.prefix_],
    )

    console.log(receipts, receipts_items, receipts_journal, receipts_attachments)

    res.status(200).json({
      success: true,

      message: 'Receipts retrieved successfully',

      data: receipts,

      items: receipts_items,

      journal: receipts_journal,

      attachments: receipts_attachments,

      count: receipts.length,

      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error fetching receipts:', error)

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

const getPrintReceipts = async (req, res, next) => {
  const { receipt_id } = req.params

  const { copyType } = req.query

  const receiptIds = receipt_id
    .split(',')
    .map((id) => id.trim())
    .filter((id) => id !== '')

  console.log('Converted receipt_ids:', receiptIds, 'type:', typeof receiptIds)

  console.log('Copy type:', copyType)

  if (receiptIds.length === 0) {
    return res.status(400).json({
      success: false,

      message: 'Invalid receipt IDs provided',

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

    const receipts_query = sql
      .select([
        { col: Accounting.receipts.selectOptionColumns.id, as: 'id' },

        {
          col: Accounting.receipts.selectOptionColumns.customer_id,
          as: 'customer_id',
        },

        { col: Master.customers.selectOptionColumns.name, as: 'customer' },

        {
          col: Accounting.receipts.selectOptionColumns.document_reference,
          as: 'doc_ref',
        },

        {
          col: Accounting.receipts.selectOptionColumns.collection_date,
          as: 'collection_date',
        },

        { col: Accounting.receipts.selectOptionColumns.mode_of_payment, as: 'mode' },

        { col: Accounting.receipts.selectOptionColumns.bank_name, as: 'bank_name' },

        {
          col: Accounting.receipts.selectOptionColumns.check_number,
          as: 'check_number',
        },

        { col: Accounting.receipts.selectOptionColumns.remarks, as: 'remarks' },

        {
          col: Accounting.receipts.selectOptionColumns.total_amount_due,
          as: 'amount_due',
        },

        { col: Accounting.receipts.selectOptionColumns.state, as: 'state' },

        {
          col: Accounting.receipts.selectOptionColumns.created_by,
          as: 'created_by',
        },

        {
          col: Accounting.receipts.selectOptionColumns.checked_by,
          as: 'checked_by',
        },

        {
          col: Accounting.receipts.selectOptionColumns.approved_by,
          as: 'approved_by',
        },
      ])

      .from(Accounting.receipts.tablename)

      .innerJoin(
        Master.customers.tablename,
        Accounting.receipts.selectOptionColumns.customer_id,
        Master.customers.selectOptionColumns.id,
      )

      .leftJoin(
        Master.customers_information.tablename,
        `${Master.customers_information.tablename}.${Master.customers_information.selectOptionColumns.customer_id}`,
        `${Master.customers.tablename}.${Master.customers.selectOptionColumns.id}`,
      )

      .whereIn(Accounting.receipts.selectOptionColumns.id, receiptIds)

      .build()

    let receipts = await Query(
      receipts_query,
      [...receiptIds],
      [
        Accounting.receipts.prefix_,
        Master.customers.prefix_,
        Master.customers_information.prefix_,
      ],
    )

    const receipts_items_query = sql
      .select([
        { col: Accounting.receipt_items.selectOptionColumns.id, as: 'id' },

        {
          col: Accounting.receipt_items.selectOptionColumns.receipts_id,
          as: 'receipts_id',
        },

        {
          col: Accounting.receipt_items.selectOptionColumns.product_service,
          as: 'product_service_id',
        },

        {
          col: Master.products_service.selectOptionColumns.name,
          as: 'product_service_name',
        },

        {
          col: Accounting.receipt_items.selectOptionColumns.charts_of_accounts,
          as: 'charts_of_accounts_id',
        },

        {
          col: Master.charts_of_accounts.selectOptionColumns.name,
          as: 'charts_of_accounts_name',
        },

        {
          col: Accounting.receipt_items.selectOptionColumns.description,
          as: 'description',
        },

        {
          col: Accounting.receipt_items.selectOptionColumns.quantity,
          as: 'quantity',
        },

        {
          col: Accounting.receipt_items.selectOptionColumns.sales_price,
          as: 'sales_price',
        },

        {
          col: Accounting.receipt_items.selectOptionColumns.discount,
          as: 'discount',
        },

        {
          col: Accounting.receipt_items.selectOptionColumns.discount_type,
          as: 'discount_type',
        },

        { col: Master.vat.selectOptionColumns.rate, as: 'vat_rate' },

        {
          col: Master.withholding_tax.selectOptionColumns.rate,
          as: 'withholding_tax_rate',
        },

        {
          col: Accounting.receipt_items.selectOptionColumns.responsibility_center,
          as: 'responsibility_center',
        },
      ])

      .from(Accounting.receipt_items.tablename)

      .innerJoin(
        Master.vat.tablename,
        Accounting.receipt_items.selectOptionColumns.vat,
        Master.vat.selectOptionColumns.id,
      )

      .innerJoin(
        Master.withholding_tax.tablename,
        Accounting.receipt_items.selectOptionColumns.withholding_tax,
        Master.withholding_tax.selectOptionColumns.id,
      )

      .leftJoin(
        Master.products_service.tablename,
        Accounting.receipt_items.selectOptionColumns.product_service,
        Master.products_service.selectOptionColumns.id,
      )

      .innerJoin(
        Master.charts_of_accounts.tablename,
        Accounting.receipt_items.selectOptionColumns.charts_of_accounts,
        Master.charts_of_accounts.selectOptionColumns.id,
      )

      .whereIn(Accounting.receipt_items.selectOptionColumns.receipts_id, receiptIds)

      .build()

    let receipts_items = await Query(
      receipts_items_query,
      [...receiptIds],
      [Accounting.receipt_items.prefix_],
    )

    const receipts_journal_query = sql
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

      .whereIn(Accounting.journal_entries.selectOptionColumns.db_id, receiptIds)

      .build()

    let receipts_journal = await Query(
      receipts_journal_query,
      ['receipts', ...receiptIds],
      [Accounting.journal_entries.prefix_],
    )

    console.log('Raw journal data:', receipts_journal)

    const receipts_attachments_query = sql
      .select([
        { col: Accounting.receipt_attachments.selectOptionColumns.id, as: 'id' },

        {
          col: Accounting.receipt_attachments.selectOptionColumns.receipt_id,
          as: 'receipt_id',
        },

        { col: Accounting.receipt_attachments.selectOptionColumns.file, as: 'file' },

        { col: Accounting.receipt_attachments.selectOptionColumns.name, as: 'name' },

        {
          col: Accounting.receipt_attachments.selectOptionColumns.remarks,
          as: 'remarks',
        },

        {
          col: Accounting.receipt_attachments.selectOptionColumns.uploaded_by,
          as: 'uploaded_by',
        },

        {
          col: Accounting.receipt_attachments.selectOptionColumns.uploaded_date,
          as: 'uploaded_date',
        },
      ])

      .from(Accounting.receipt_attachments.tablename)

      .whereIn(
        Accounting.receipt_attachments.selectOptionColumns.receipt_id,
        receiptIds,
      )

      .build()

    let receipts_attachments = await Query(
      receipts_attachments_query,
      [...receiptIds],
      [Accounting.receipt_attachments.prefix_],
    )

    // Fetch customers_information for all involved customers and build a map
    const customerIds = Array.from(
      new Set(receipts.map((r) => r.customer_id).filter(Boolean)),
    )
    let customersInfoMap = {}
    if (customerIds.length > 0) {
      const placeholders = customerIds.map(() => '?').join(',')
      const customers_info_query = `SELECT ${Master.customers_information.selectOptionColumns.customer_id} AS customer_id, ${Master.customers_information.selectOptionColumns.address} AS address, ${Master.customers_information.selectOptionColumns.tin} AS tin FROM ${Master.customers_information.tablename} WHERE ${Master.customers_information.selectOptionColumns.customer_id} IN (${placeholders})`

      let customers_info_rows = await Query(
        customers_info_query,
        [...customerIds],
        [Master.customers_information.prefix_],
      )

      customers_info_rows = customers_info_rows || []

      customersInfoMap = customers_info_rows.reduce((acc, row) => {
        acc[row.customer_id] = { address: row.address || '', tin: row.tin || '' }
        return acc
      }, {})
    }
    // Group items, journal, and attachments by receipt ID

    const groupedData = receipts.map((receipt) => {
      // merge customer info from customers_information map if present
      const ci = customersInfoMap[receipt.customer_id]
      if (ci) {
        receipt.customer_address = ci.address || receipt.customer_address || ''
        receipt.customer_tin = ci.tin || receipt.customer_tin || ''
      } else {
        receipt.customer_address = receipt.customer_address || ''
        receipt.customer_tin = receipt.customer_tin || ''
      }
      const receiptItems = receipts_items.filter(
        (item) => item.receipts_id === receipt.id,
      )

      // Filter journal entries: exclude for customer copies, include for internal copies

      const receiptJournal =
        copyType === 'customer'
          ? [] // No journal entries for customer copies
          : receipts_journal.filter((entry) => entry.db_id === receipt.id)

      // Map items to PDF expected format

      const mappedItems = receiptItems.map((item) => {
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

          unit: 'pcs', // Default unit since not in DB

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

      // Map journal to PDF expected format

      const mappedJournal = receiptJournal.map((entry) => {
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
        ...receipt,

        items: mappedItems,

        journal: mappedJournal,

        attachments: receipts_attachments.filter(
          (att) => att.receipt_id === receipt.id,
        ),

        company: company,
      }
    })

    console.log('Grouped receipts data:', groupedData)

    res.status(200).json({
      success: true,

      message: 'Receipts retrieved successfully',

      company: company,

      data: groupedData,

      count: groupedData.length,

      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error fetching receipts:', error)

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

const createReceipts = async (req, res, next) => {
  try {
    const {
      customer_id,

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

      receipt_items,

      journal_entries,

      attachments,
    } = req.body

    console.log('BODY', req.body)

    if (
      !customer_id ||
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

      // generate receipt id in format CR-MMDDYY-0001 (sequence per day)
      const nowForId = new Date()
      const mm = String(nowForId.getMonth() + 1).padStart(2, '0')
      const dd = String(nowForId.getDate()).padStart(2, '0')
      const yy = String(nowForId.getFullYear()).slice(-2)
      const datePart = `${mm}${dd}${yy}`
      const idPrefix = `CR-${datePart}-`

      const [existing] = await connection.execute(
        `SELECT r_id FROM receipts WHERE r_id LIKE ? ORDER BY r_id DESC LIMIT 1`,
        [`${idPrefix}%`],
      )

      let seq = 1
      if (existing && existing.length > 0) {
        const lastId = existing[0].r_id
        const parts = lastId.split('-')
        const lastSeq = parseInt(parts[parts.length - 1], 10) || 0
        seq = lastSeq + 1
      }

      const seqStr = String(seq).padStart(4, '0')
      const newReceiptId = `${idPrefix}${seqStr}`

      const mainQuery = sql
        .insert(Accounting.receipts.tablename, {
          columns: Accounting.receipts.insertColumns,

          prefix: Accounting.receipts.prefix,

          isTransaction: true,
        })
        .build()

      const mainValues = [
        newReceiptId,
        customer_id || null,

        document_reference || null,

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

      const receiptId = newReceiptId

      if (receipt_items && receipt_items.length > 0) {
        for (const item of receipt_items) {
          const itemQuery = sql
            .insert(Accounting.receipt_items.tablename, {
              columns: Accounting.receipt_items.insertColumns,

              prefix: Accounting.receipt_items.prefix,

              isTransaction: true,
            })
            .build()

          const itemValues = [
            receiptId,

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
            'receipts',

            receiptId,

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
            .insert(Accounting.receipt_attachments.tablename, {
              columns: Accounting.receipt_attachments.insertColumns,

              prefix: Accounting.receipt_attachments.prefix,

              isTransaction: true,
            })
            .build()

          const attachmentValues = [
            receiptId,

            attachment.file || null,

            attachment.fileName || null,

            attachment.remarks || null,

            attachment.uploadedBy || null,

            attachment.date || new Date().toLocaleDateString(),
          ]

          await connection.execute(attachmentQuery, attachmentValues)
        }
      }

      // Allow submission without attachments - attachments are optional

      await connection.commit()

      const selectNewReceiptQuery = sql
        .select([
          { col: Accounting.receipts.selectOptionColumns.id, as: 'id' },
          {
            col: Accounting.receipts.selectOptionColumns.customer_id,
            as: 'customer_id',
          },
          { col: Master.customers.selectOptionColumns.name, as: 'customer' },
          {
            col: Accounting.receipts.selectOptionColumns.document_reference,
            as: 'doc_ref',
          },
          {
            col: Accounting.receipts.selectOptionColumns.collection_date,
            as: 'collection_date',
          },
          {
            col: Accounting.receipts.selectOptionColumns.mode_of_payment,
            as: 'mode',
          },
          {
            col: Accounting.receipts.selectOptionColumns.bank_name,
            as: 'bank_name',
          },
          {
            col: Accounting.receipts.selectOptionColumns.check_number,
            as: 'check_number',
          },
          { col: Accounting.receipts.selectOptionColumns.remarks, as: 'remarks' },
          {
            col: Accounting.receipts.selectOptionColumns.total_amount_due,
            as: 'amount_due',
          },
          { col: Accounting.receipts.selectOptionColumns.state, as: 'state' },
        ])
        .from(Accounting.receipts.tablename)
        .innerJoin(
          Master.customers.tablename,
          Accounting.receipts.selectOptionColumns.customer_id,
          Master.customers.selectOptionColumns.id,
        )
        .where(Accounting.receipts.selectOptionColumns.id)
        .build()

      const createdReceiptRows = await Query(
        selectNewReceiptQuery,
        [receiptId],
        [Accounting.receipts.prefix_, Master.customers.prefix_],
      )
      const createdReceipt = Array.isArray(createdReceiptRows)
        ? createdReceiptRows[0]
        : createdReceiptRows

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
          receiptId || null,

          'RECEIPT',

          req.context?.username || null,

          now.toISOString().split('T')[0],

          now.toTimeString().split(' ')[0],

          `CREATE: ID ${receiptId}`,
        ],
      })

      await Transaction(auditQueries)

      res.status(201).json({
        success: true,

        message: 'Receipt created successfully',

        data: { id: receiptId },

        timestamp: new Date().toISOString(),
      })

      // Broadcast after response (non-blocking)
      setImmediate(() => {
        try {
          if (createdReceipt) {
            broadcastUpdates({ receipt: createdReceipt }, 'receipt_created')
          }
        } catch (err) {
          console.error('Error broadcasting receipt creation:', err)
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
    console.error('Error creating receipt:', error)

    return res.status(500).json({
      success: false,

      message: 'Server error while creating receipt',

      error:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Internal server error',
    })
  }
}

const updateReceipt = async (req, res, next) => {
  const { receipt_id } = req.params

  const receiptId = receipt_id

  console.log('Updating receipt_id:', receiptId, 'type:', typeof receiptId)

  try {
    const {
      customer_id,

      document_reference,

      payment_date,

      mode_of_payment,

      bank_name,

      check_number,

      remarks,

      total_amount_due,

      created_by,

      receipt_items,

      journal_entries,

      attachments,
    } = req.body

    console.log('Update data:', req.body)

    if (
      !customer_id ||
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

      const currentReceiptQuery = sql
        .select([
          {
            col: Accounting.receipts.selectOptionColumns.document_reference,
            as: 'doc_ref',
          },

          { col: Accounting.receipts.selectOptionColumns.remarks, as: 'remarks' },

          {
            col: Accounting.receipts.selectOptionColumns.customer_id,
            as: 'customer_id',
          },

          {
            col: Accounting.receipts.selectOptionColumns.collection_date,
            as: 'collection_date',
          },

          {
            col: Accounting.receipts.selectOptionColumns.mode_of_payment,
            as: 'mode_of_payment',
          },

          {
            col: Accounting.receipts.selectOptionColumns.bank_name,
            as: 'bank_name',
          },

          {
            col: Accounting.receipts.selectOptionColumns.check_number,
            as: 'check_number',
          },

          {
            col: Accounting.receipts.selectOptionColumns.total_amount_due,
            as: 'total_amount_due',
          },
        ])

        .from(Accounting.receipts.tablename)

        .where(Accounting.receipts.selectOptionColumns.id)

        .build()

      const [currentReceiptData] = await connection.execute(currentReceiptQuery, [
        receiptId,
      ])

      // Fetch current receipt items BEFORE updates

      let currentItemsData = []

      if (receipt_items && receipt_items.length > 0) {
        const currentItemsQuery = sql
          .select([
            { col: Accounting.receipt_items.selectOptionColumns.id, as: 'id' },

            {
              col: Accounting.receipt_items.selectOptionColumns.quantity,
              as: 'quantity',
            },

            {
              col: Accounting.receipt_items.selectOptionColumns.sales_price,
              as: 'sales_price',
            },

            {
              col: Accounting.receipt_items.selectOptionColumns.description,
              as: 'description',
            },

            {
              col: Accounting.receipt_items.selectOptionColumns
                .responsibility_center,
              as: 'responsibility_center',
            },
          ])

          .from(Accounting.receipt_items.tablename)

          .where(Accounting.receipt_items.selectOptionColumns.receipts_id)

          .build()

        currentItemsData = await connection.execute(currentItemsQuery, [receiptId])
      }

      // Fetch current journal entries BEFORE updates

      let currentJournalData = []

      if (journal_entries && journal_entries.length > 0) {
        const currentJournalQuery = sql
          .select([
            { col: Accounting.journal_entries.selectOptionColumns.id, as: 'id' },

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
          'receipts',
          receiptId,
        ])
      }

      const updateMainQuery = sql
        .update(Accounting.receipts.tablename)

        .set([
          Accounting.receipts.selectOptionColumns.customer_id,

          Accounting.receipts.selectOptionColumns.document_reference,

          Accounting.receipts.selectOptionColumns.collection_date,

          Accounting.receipts.selectOptionColumns.mode_of_payment,

          Accounting.receipts.selectOptionColumns.bank_name,

          Accounting.receipts.selectOptionColumns.check_number,

          Accounting.receipts.selectOptionColumns.remarks,

          Accounting.receipts.selectOptionColumns.total_amount_due,
        ])

        .where(Accounting.receipts.selectOptionColumns.id)

        .build()

      const updateMainValues = [
        customer_id || null,

        document_reference || null,

        payment_date || null,

        mode_of_payment || null,

        bank_name || null,

        check_number || null,

        remarks || null,

        total_amount_due || null,

        receiptId,
      ]

      await connection.execute(updateMainQuery, updateMainValues)

      if (receipt_items && receipt_items.length > 0) {
        const existingItemsQuery = sql
          .select([Accounting.receipt_items.selectOptionColumns.id])

          .from(Accounting.receipt_items.tablename)

          .where(Accounting.receipt_items.selectOptionColumns.receipts_id)

          .build()

        const existingItems = await Query(
          existingItemsQuery,
          [receiptId],
          [Accounting.receipt_items.prefix_],
        )

        const existingItemIds = existingItems.map((item) => item.id)

        const payloadItemIds = receipt_items
          .filter((item) => item.id)
          .map((item) => item.id)

        const itemsToDelete = existingItemIds.filter(
          (id) => !payloadItemIds.includes(id),
        )

        if (itemsToDelete.length > 0) {
          const deleteItemsQuery = sql
            .delete()

            .from(Accounting.receipt_items.tablename)

            .where(Accounting.receipt_items.selectOptionColumns.id)

            .andWhere(Accounting.receipt_items.selectOptionColumns.receipts_id)

            .build()

          for (const itemId of itemsToDelete) {
            await connection.execute(deleteItemsQuery, [itemId, receiptId])
          }
        }

        for (const item of receipt_items) {
          if (item.id) {
            const updateItemQuery = sql
              .update(Accounting.receipt_items.tablename)

              .set([
                Accounting.receipt_items.selectOptionColumns.product_service,

                Accounting.receipt_items.selectOptionColumns.charts_of_accounts,

                Accounting.receipt_items.selectOptionColumns.description,

                Accounting.receipt_items.selectOptionColumns.quantity,

                Accounting.receipt_items.selectOptionColumns.sales_price,

                Accounting.receipt_items.selectOptionColumns.discount,

                Accounting.receipt_items.selectOptionColumns.discount_type,

                Accounting.receipt_items.selectOptionColumns.vat,

                Accounting.receipt_items.selectOptionColumns.withholding_tax,

                Accounting.receipt_items.selectOptionColumns.responsibility_center,
              ])

              .where(Accounting.receipt_items.selectOptionColumns.id)

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
              .insert(Accounting.receipt_items.tablename, {
                columns: Accounting.receipt_items.insertColumns,

                prefix: Accounting.receipt_items.prefix,

                isTransaction: true,
              })
              .build()

            const itemValues = [
              receiptId,

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
      } else {
        const deleteAllItemsQuery = sql
          .delete()

          .from(Accounting.receipt_items.tablename)

          .where(Accounting.receipt_items.selectOptionColumns.receipts_id)

          .build()

        await connection.execute(deleteAllItemsQuery, [receiptId])
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
          ['receipts', receiptId],
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
              'receipts',
              receiptId,
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
              'receipts',

              receiptId,

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

        await connection.execute(deleteAllEntriesQuery, ['receipts', receiptId])
      }

      if (attachments && attachments.length > 0) {
        for (const attachment of attachments) {
          if (attachment.id) {
            const updateAttachmentQuery = sql
              .update(Accounting.receipt_attachments.tablename)

              .set([
                Accounting.receipt_attachments.selectOptionColumns.file,

                Accounting.receipt_attachments.selectOptionColumns.name,

                Accounting.receipt_attachments.selectOptionColumns.remarks,

                Accounting.receipt_attachments.selectOptionColumns.uploaded_by,

                Accounting.receipt_attachments.selectOptionColumns.uploaded_date,
              ])

              .where(Accounting.receipt_attachments.selectOptionColumns.id)

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
              .insert(Accounting.receipt_attachments.tablename, {
                columns: Accounting.receipt_attachments.insertColumns,

                prefix: Accounting.receipt_attachments.prefix,

                isTransaction: true,
              })
              .build()

            const attachmentValues = [
              receiptId,

              attachment.file || null,

              attachment.fileName || null,

              attachment.remarks || null,

              attachment.uploadedBy || null,

              attachment.date || new Date().toLocaleDateString(),
            ]

            await connection.execute(attachmentQuery, attachmentValues)
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

      console.log('DEBUG: Current receipt data:', currentReceiptData)
      console.log('DEBUG: Request body data:', {
        document_reference,
        remarks,
        customer_id,
        payment_date,
        mode_of_payment,
        bank_name,
        check_number,
        total_amount_due,
      })
      console.log('DEBUG: Receipt items data:', receipt_items)
      console.log('DEBUG: Journal entries data:', journal_entries)
      console.log('DEBUG: Attachments data:', attachments)

      if (currentReceiptData.length > 0) {
        const current = currentReceiptData[0]

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

        if (current.customer_id !== customer_id) {
          auditChanges.push(`Customer ID: ${current.customer_id} → ${customer_id}`)
        }

        const currentCollectionDate = normalizeValue(current.collection_date)
        const newCollectionDate = normalizeValue(payment_date)
        if (currentCollectionDate !== newCollectionDate) {
          auditChanges.push(
            `Collection Date: ${currentCollectionDate || 'NULL'} → ${newCollectionDate || 'NULL'}`,
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

      // Track receipt items changes using data fetched earlier
      console.log('DEBUG: Current items data from DB:', currentItemsData)
      if (receipt_items && receipt_items.length > 0) {
        for (const item of receipt_items) {
          console.log('DEBUG: Processing item:', item)
          if (item.id) {
            const currentItem = currentItemsData[0]?.find((i) => i.id === item.id)
            console.log('DEBUG: Found current item:', currentItem)
            if (currentItem) {
              const currentQty = normalizeNumber(currentItem.quantity)
              const newQty = normalizeNumber(item.qty)
              console.log('DEBUG: Item qty comparison:', {
                itemId: item.id,
                current: currentQty,
                new: newQty,
                changed: currentQty !== newQty,
              })
              if (currentQty !== newQty) {
                auditChanges.push(`Item ${item.id} Qty: ${currentQty} → ${newQty}`)
              }

              const currentPrice = normalizeNumber(currentItem.sales_price)
              const newPrice = normalizeNumber(item.price)
              console.log('DEBUG: Item price comparison:', {
                itemId: item.id,
                current: currentPrice,
                new: newPrice,
                changed: currentPrice !== newPrice,
              })
              if (currentPrice !== newPrice) {
                auditChanges.push(
                  `Item ${item.id} Price: ${currentPrice} → ${newPrice}`,
                )
              }

              const currentDesc = normalizeValue(currentItem.description)
              const newDesc = normalizeValue(item.description)
              console.log('DEBUG: Item desc comparison:', {
                itemId: item.id,
                current: currentDesc,
                new: newDesc,
                changed: currentDesc !== newDesc,
              })
              if (currentDesc !== newDesc) {
                auditChanges.push(
                  `Item ${item.id} Desc: ${currentDesc || 'NULL'} → ${newDesc || 'NULL'}`,
                )
              }

              const currentRespCenter = normalizeValue(
                currentItem.responsibility_center,
              )
              const newRespCenter = normalizeValue(item.responsibility_center)
              console.log('DEBUG: Item resp center comparison:', {
                itemId: item.id,
                current: currentRespCenter,
                new: newRespCenter,
                changed: currentRespCenter !== newRespCenter,
              })
              if (currentRespCenter !== newRespCenter) {
                auditChanges.push(
                  `Item ${item.id} Resp Center: ${currentRespCenter || 'NULL'} → ${newRespCenter || 'NULL'}`,
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
        for (const entry of journal_entries) {
          console.log('DEBUG: Processing journal entry:', entry)
          if (entry.id) {
            const currentEntry = currentJournalData[0]?.find(
              (j) => j.id === entry.id,
            )
            console.log('DEBUG: Found current journal entry:', currentEntry)
            if (currentEntry) {
              const type = entry.debit > 0 ? 'debit' : 'credit'
              const amount = entry.debit > 0 ? entry.debit : entry.credit

              const currentRespCenter = normalizeValue(
                currentEntry.responsibility_center,
              )
              const newRespCenter = normalizeValue(entry.responsibility_center)
              console.log('DEBUG: Journal resp center comparison:', {
                entryId: entry.id,
                current: currentRespCenter,
                new: newRespCenter,
                changed: currentRespCenter !== newRespCenter,
              })
              if (currentRespCenter !== newRespCenter) {
                auditChanges.push(
                  `Journal ${entry.id} Resp Center: ${currentRespCenter || 'NULL'} → ${newRespCenter || 'NULL'}`,
                )
              }

              const currentAmount = normalizeNumber(currentEntry.amount)
              const newAmount = normalizeNumber(amount)
              if (currentAmount !== newAmount) {
                auditChanges.push(
                  `Journal ${entry.id} Amount: ${currentAmount} → ${newAmount}`,
                )
              }

              const currentType = normalizeValue(currentEntry.type)
              if (currentType.toLowerCase() !== type.toLowerCase()) {
                auditChanges.push(
                  `Journal ${entry.id} Type: ${currentType} → ${type}`,
                )
              }
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
        .select([Accounting.receipt_attachments.selectOptionColumns.id])
        .from(Accounting.receipt_attachments.tablename)
        .where(Accounting.receipt_attachments.selectOptionColumns.receipt_id)
        .build()

      const existingAttachments = await Query(
        existingAttachmentsQuery,
        [receiptId],
        [Accounting.receipt_attachments.prefix_],
      )
      const existingAttachmentIds = existingAttachments.map(
        (attachment) => attachment.id,
      )

      // Fetch current attachments for comparison
      const currentAttachmentsQuery = sql
        .select([
          { col: Accounting.receipt_attachments.selectOptionColumns.id, as: 'id' },
          {
            col: Accounting.receipt_attachments.selectOptionColumns.name,
            as: 'name',
          },
          {
            col: Accounting.receipt_attachments.selectOptionColumns.remarks,
            as: 'remarks',
          },
        ])
        .from(Accounting.receipt_attachments.tablename)
        .where(Accounting.receipt_attachments.selectOptionColumns.receipt_id)
        .build()

      const currentAttachmentsData = await connection.execute(
        currentAttachmentsQuery,
        [receiptId],
      )

      if (attachments && attachments.length > 0) {
        const payloadAttachmentIds = attachments
          .filter((attachment) => attachment.id)
          .map((attachment) => attachment.id)

        // Find deleted attachments
        const deletedAttachmentIds = existingAttachmentIds.filter(
          (id) => !payloadAttachmentIds.includes(id),
        )
        if (deletedAttachmentIds.length > 0) {
          for (const deletedId of deletedAttachmentIds) {
            const deletedAttachment = currentAttachmentsData[0]?.find(
              (a) => a.id === deletedId,
            )
            if (deletedAttachment) {
              auditChanges.push(
                `Deleted attachment: ${normalizeValue(deletedAttachment.name) || 'Unknown'} (ID: ${deletedId})`,
              )
            }
          }
        }

        for (const attachment of attachments) {
          if (attachment.id) {
            const currentAttachment = currentAttachmentsData[0]?.find(
              (a) => a.id === attachment.id,
            )
            if (currentAttachment) {
              const currentRemarks = normalizeValue(currentAttachment.remarks)
              const newRemarks = normalizeValue(attachment.remarks)
              if (currentRemarks !== newRemarks) {
                auditChanges.push(
                  `Attachment ${attachment.id} Remarks: ${currentRemarks || 'NULL'} → ${newRemarks || 'NULL'}`,
                )
              }
            }
          } else {
            auditChanges.push(
              `Added new attachment: ${normalizeValue(attachment.fileName) || 'Unknown'}`,
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
              receiptId,
              'RECEIPT_UPDATE',
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

        message: 'Receipt updated successfully',

        data: { id: receiptId },

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
    console.error('Error updating receipt:', error)

    return res.status(500).json({
      success: false,

      message: 'Server error while updating receipt',

      error:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Internal server error',
    })
  }
}

const updateReceiptState = async (req, res, next) => {
  try {
    console.log('updateReceiptState called')

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
        const { id, currentState, changes } = update

        if (!id || !currentState) {
          throw new Error('Each update requires id and currentState')
        }

        let nextState
        let updateQuery
        let updateValues
        let auditChanges = []

        if (currentState === 'PREPARED') {
          nextState = 'CHECKED'

          updateQuery = sql
            .update(Accounting.receipts.tablename)
            .set([
              Accounting.receipts.selectOptionColumns.state,
              Accounting.receipts.selectOptionColumns.checked_by,
            ])
            .where(Accounting.receipts.selectOptionColumns.id)
            .build()

          updateValues = [nextState, req.context.username, id]
        } else if (currentState === 'CHECKED') {
          nextState = 'APPROVED'

          updateQuery = sql
            .update(Accounting.receipts.tablename)
            .set([
              Accounting.receipts.selectOptionColumns.state,
              Accounting.receipts.selectOptionColumns.approved_by,
            ])
            .where(Accounting.receipts.selectOptionColumns.id)
            .build()

          updateValues = [nextState, req.context.username, id]
        } else {
          throw new Error(
            `Invalid current state: ${currentState}. Only PREPARED and CHECKED can be updated.`,
          )
        }

        // Fetch current receipt data for audit trail
        const currentDataQuery = sql
          .select([
            {
              col: Accounting.receipts.selectOptionColumns.document_reference,
              as: 'doc_ref',
            },
            { col: Accounting.receipts.selectOptionColumns.remarks, as: 'remarks' },
          ])
          .from(Accounting.receipts.tablename)
          .where(Accounting.receipts.selectOptionColumns.id)
          .build()

        const [currentData] = await connection.execute(currentDataQuery, [id])

        // Fetch current receipt items
        const currentItemsQuery = sql
          .select([
            { col: Accounting.receipt_items.selectOptionColumns.id, as: 'id' },
            {
              col: Accounting.receipt_items.selectOptionColumns.quantity,
              as: 'quantity',
            },
            {
              col: Accounting.receipt_items.selectOptionColumns.sales_price,
              as: 'sales_price',
            },
          ])
          .from(Accounting.receipt_items.tablename)
          .where(Accounting.receipt_items.selectOptionColumns.receipts_id)
          .build()

        const currentItems = await connection.execute(currentItemsQuery, [id])

        // Fetch current journal entries
        const currentJournalQuery = sql
          .select([
            { col: Accounting.journal_entries.selectOptionColumns.id, as: 'id' },
            {
              col: Accounting.journal_entries.selectOptionColumns
                .responsibility_center,
              as: 'responsibility_center',
            },
          ])
          .from(Accounting.journal_entries.tablename)
          .where(Accounting.journal_entries.selectOptionColumns.db_name)
          .andWhere(Accounting.journal_entries.selectOptionColumns.db_id)
          .build()

        const currentJournal = await connection.execute(currentJournalQuery, [
          'receipts',
          id,
        ])

        // Apply additional data changes if provided
        if (changes) {
          // Helper function to normalize values for comparison
          const normalizeValue = (val) =>
            val === null || val === undefined ? '' : String(val).trim()
          const normalizeNumber = (val) =>
            val === null || val === undefined ? 0 : parseFloat(val)

          if (changes.document_reference && currentData.length > 0) {
            const currentDocRef = normalizeValue(currentData[0].doc_ref)
            const newDocRef = normalizeValue(changes.document_reference)
            if (currentDocRef !== newDocRef) {
              auditChanges.push(
                `Doc Ref: ${currentDocRef || 'NULL'} → ${newDocRef || 'NULL'}`,
              )

              const docRefUpdateQuery = sql
                .update(Accounting.receipts.tablename)
                .set([Accounting.receipts.selectOptionColumns.document_reference])
                .where(Accounting.receipts.selectOptionColumns.id)
                .build()

              await connection.execute(docRefUpdateQuery, [
                changes.document_reference,
                id,
              ])
            }
          }

          if (changes.remarks && currentData.length > 0) {
            const currentRemarks = normalizeValue(currentData[0].remarks)
            const newRemarks = normalizeValue(changes.remarks)
            if (currentRemarks !== newRemarks) {
              auditChanges.push(
                `Remarks: ${currentRemarks || 'NULL'} → ${newRemarks || 'NULL'}`,
              )

              const remarksUpdateQuery = sql
                .update(Accounting.receipts.tablename)
                .set([Accounting.receipts.selectOptionColumns.remarks])
                .where(Accounting.receipts.selectOptionColumns.id)
                .build()

              await connection.execute(remarksUpdateQuery, [changes.remarks, id])
            }
          }

          // Track receipt items changes
          if (changes.receipt_items) {
            for (const item of changes.receipt_items) {
              if (item.id) {
                const currentItem = currentItems.find((i) => i.id === item.id)
                if (currentItem) {
                  const currentQty = normalizeNumber(currentItem.quantity)
                  const newQty = normalizeNumber(item.quantity)
                  if (currentQty !== newQty) {
                    auditChanges.push(
                      `Item ${item.id} Qty: ${currentQty} → ${newQty}`,
                    )
                  }

                  const currentPrice = normalizeNumber(currentItem.sales_price)
                  const newPrice = normalizeNumber(item.price)
                  if (currentPrice !== newPrice) {
                    auditChanges.push(
                      `Item ${item.id} Price: ${currentPrice} → ${newPrice}`,
                    )
                  }

                  const currentDesc = normalizeValue(currentItem.description)
                  const newDesc = normalizeValue(item.description)
                  if (currentDesc !== newDesc) {
                    auditChanges.push(
                      `Item ${item.id} Desc: ${currentDesc || 'NULL'} → ${newDesc || 'NULL'}`,
                    )
                  }
                }
              }
            }
          }

          // Track journal entries changes
          if (changes.journal_entries) {
            for (const entry of changes.journal_entries) {
              if (entry.id) {
                const currentEntry = currentJournal.find((j) => j.id === entry.id)
                if (currentEntry) {
                  const currentRespCenter = normalizeValue(
                    currentEntry.responsibility_center,
                  )
                  const newRespCenter = normalizeValue(entry.responsibility_center)
                  if (currentRespCenter !== newRespCenter) {
                    auditChanges.push(
                      `Journal ${entry.id} Resp Center: ${currentRespCenter || 'NULL'} → ${newRespCenter || 'NULL'}`,
                    )
                  }
                }
              }
            }
          }
        }

        await connection.execute(updateQuery, updateValues)

        return {
          id,
          nextState,
          auditChanges: auditChanges.length > 0 ? auditChanges : null,
        }
      })

      const results = await Promise.all(updatePromises)

      await connection.commit()

      // Audit trail for state update and data changes
      const now = new Date()
      const auditQueries = []

      for (const result of results) {
        let auditMessage = `STATE UPDATE: ${updates.find((u) => u.id === result.id).currentState} → ${result.nextState}`

        if (result.auditChanges) {
          auditMessage += ` | Changes: ${result.auditChanges.join(', ')}`
        }

        auditQueries.push({
          sql: sql
            .insert(Master.audit_trail.tablename, {
              columns: Master.audit_trail.insertColumns,
              prefix: Master.audit_trail.prefix,
              isTransaction: true,
            })
            .build(),
          values: [
            result.id,
            'RECEIPT_UPDATE',
            req.context?.username || null,
            now.toISOString().split('T')[0],
            now.toTimeString().split(' ')[0],
            auditMessage,
          ],
        })
      }

      if (auditQueries.length > 0) {
        await Transaction(auditQueries)
      }

      res.status(200).json({
        success: true,
        message: `${results.length} receipt(s) updated successfully`,
        data: {
          updatedCount: results.length,
          updates: results.map((result) => ({
            id: result.id,
            nextState: result.nextState,
          })),
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

module.exports = {
  getReceipts,

  getAllReceipts,

  getPrintReceipts,

  createReceipts,

  updateReceipt,

  updateReceiptState,
}
