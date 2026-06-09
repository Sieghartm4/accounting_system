const os = require('os')
const {
  checkConnection,
  SelectAll,
  Transaction,
  Query,
  Insert,
  SelectWithCondition,
} = require('../database/util/queries.util')
const {
  formatMemoryUsage,
  formatTime,
  DataModeling,
} = require('../util/helper.util')
const { Master } = require('../database/model/Master')
const { SQLQueryBuilder } = require('../util/helper.util')
const sql = new SQLQueryBuilder()

require('dotenv').config()

const getCustomers = async (req, res, next) => {
  try {
    const customers = await SelectAll(
      Master.customers.tablename,
      Master.customers.prefix_,
    )

    res.status(200).json({
      success: true,
      message: 'Customers retrieved successfully',
      data: customers,
      count: customers.length,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error fetching customers:', error)
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching customers',
      error:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Internal server error',
    })
  }
}

const getCustomerTransactions = async (req, res, next) => {
  try {
    const query = `
      SELECT
        c.c_id AS id,
        c.c_code AS code,
        c.c_name AS name,
        c.c_status AS status,
        COALESCE(r.receipt_count, 0) AS receipts,
        COALESCE(s.sales_count, 0) AS sales,
        COALESCE(r.receipt_amount_due, 0) + COALESCE(s.sales_amount_due, 0) AS total_amount_due
      FROM customers c
      LEFT JOIN (
        SELECT
          r_customer_id AS customer_id,
          COUNT(*) AS receipt_count,
          SUM(CAST(r_total_amount_due AS DECIMAL(20, 2))) AS receipt_amount_due
        FROM receipts
        WHERE LOWER(r_state) = 'approved'
        GROUP BY r_customer_id
      ) r ON r.customer_id = c.c_id
      LEFT JOIN (
        SELECT
          s_customer_id AS customer_id,
          COUNT(*) AS sales_count,
          SUM(CAST(s_total_amount_due AS DECIMAL(20, 2))) AS sales_amount_due
        FROM sales
        WHERE LOWER(s_state) = 'approved'
        GROUP BY s_customer_id
      ) s ON s.customer_id = c.c_id
      ORDER BY c.c_name ASC
    `

    const rows = await Query(query, [])

    const summary = {
      customers: rows.length,
      totalAmountDue: rows.reduce(
        (sum, row) => sum + Number(row.total_amount_due || 0),
        0,
      ),
      approvedReceipts: rows.reduce(
        (sum, row) => sum + Number(row.receipts || 0),
        0,
      ),
      approvedSales: rows.reduce((sum, row) => sum + Number(row.sales || 0), 0),
    }

    res.status(200).json({
      success: true,
      message: 'Customer transactions retrieved successfully',
      data: rows,
      summary,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error fetching customer transactions:', error)
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching customer transactions',
      error:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Internal server error',
    })
  }
}

const createCustomer = async (req, res, next) => {
  try {
    const { code, name, category, type, status } = req.body

    if (!code || !name || !status) {
      return res.status(400).json({
        success: false,
        message: 'Customer code, name, and status are required',
      })
    }

    let queries = []

    queries.push({
      sql: sql
        .insert(Master.customers.tablename, {
          columns: Master.customers.insertColumns,
          prefix: Master.customers.prefix,
          isTransaction: true,
        })
        .build(),
      values: [
        code || null,
        name || null,
        category || null,
        type || null,
        status || null,
      ],
    })

    let result = await Transaction(queries)

    const getIdQuery = `SELECT LAST_INSERT_ID() as insertId`
    const idResult = await Query(getIdQuery)
    const newCustomerId = idResult[0]?.insertId

    if (!newCustomerId) {
      throw new Error('Failed to get customer ID from insertion')
    }

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
        newCustomerId || null,
        'CUSTOMER',
        req.context?.username || null,
        now.toISOString().split('T')[0],
        now.toTimeString().split(' ')[0],
        `CREATE: ID ${newCustomerId}`,
      ],
    })
    await Transaction(auditQueries)

    res.status(201).json({
      success: true,
      message: 'Customer created successfully',
      data: {
        id: newCustomerId,
        code: code,
        name: name,
        category: category,
        type: type,
        status: status,
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error creating customer:', error)
    return res.status(500).json({
      success: false,
      message: 'Server error while creating customer',
      error:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Internal server error',
    })
  }
}

const updateCustomer = async (req, res, next) => {
  try {
    const { id: idFromBody, code, name, category, type, status } = req.body
    const { id: idFromParams } = req.params
    const id = Number(idFromParams || idFromBody)

    if (!id || !code || !name || !status) {
      return res.status(400).json({
        success: false,
        message: 'ID, customer code, name, and status are required',
      })
    }

    // Fetch existing customer to compare changes
    const existingQuery = sql
      .select([
        Master.customers.selectOptionColumns.code,
        Master.customers.selectOptionColumns.name,
        Master.customers.selectOptionColumns.category,
        Master.customers.selectOptionColumns.type,
        Master.customers.selectOptionColumns.status,
      ])
      .from(Master.customers.tablename)
      .where(Master.customers.selectOptionColumns.id)
      .build()
    const existingCustomers = await Query(
      existingQuery,
      [id],
      Master.customers.prefix_,
    )
    const old = existingCustomers[0] || {}

    const updateQuery = sql
      .update(Master.customers.tablename)
      .set([
        Master.customers.selectOptionColumns.code,
        Master.customers.selectOptionColumns.name,
        Master.customers.selectOptionColumns.category,
        Master.customers.selectOptionColumns.type,
        Master.customers.selectOptionColumns.status,
      ])
      .where(Master.customers.selectOptionColumns.id)
      .build()

    const queries = [
      {
        sql: updateQuery,
        values: [code, name, category, type, status, id],
      },
    ]

    await Transaction(queries)

    // Build change description - only include changed columns with new values
    const changes = []
    if (old.code !== code) changes.push(`code='${code}'`)
    if (old.name !== name) changes.push(`name='${name}'`)
    if (old.category !== category) changes.push(`category='${category}'`)
    if (old.type !== type) changes.push(`type='${type}'`)
    if (old.status !== status) changes.push(`status='${status}'`)
    const changeDesc = changes.length > 0 ? changes.join(', ') : 'no changes'

    // Audit trail for update
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
        id || null,
        'CUSTOMER',
        req.context?.username || null,
        now.toISOString().split('T')[0],
        now.toTimeString().split(' ')[0],
        `UPDATE ID ${id}: ${changeDesc}`,
      ],
    })
    await Transaction(auditQueries)

    res.status(200).json({
      success: true,
      message: 'Customer updated successfully',
      data: { id, code, name, category, type, status },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error updating customer:', error)
    return res.status(500).json({
      success: false,
      message: 'Server error while updating customer',
      error:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Internal server error',
    })
  }
}

module.exports = {
  getCustomers,
  getCustomerTransactions,
  createCustomer,
  updateCustomer,
}
