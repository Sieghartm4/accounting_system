const os = require('os')
const {
  checkConnection,
  SelectAll,
  Transaction,
  Query,
  Insert,
  SelectWithCondition,
} = require('../database/util/queries.util')
const { getTenantPool } = require('../database/util/tenantConnection.util')
const {
  formatMemoryUsage,
  formatTime,
  DataModeling,
} = require('../util/helper.util')
const { Master } = require('../database/model/Master')
const { SQLQueryBuilder } = require('../util/helper.util')
const sql = new SQLQueryBuilder()

require('dotenv').config()

const getInfoTableColumns = async (tableName) => {
  const query = `
    SELECT COLUMN_NAME
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = ?
  `
  const rows = await Query(query, [tableName])
  return rows.map((row) => row.COLUMN_NAME)
}

const buildCustomerInfoInsertQuery = (
  columns,
  code,
  name,
  address,
  tin,
  details,
  contact,
  id,
) => {
  if (!columns || columns.length === 0) return null

  const cols = []
  const placeholders = []
  const values = []

  if (columns.includes('ci_customer_id')) {
    cols.push('ci_customer_id')
    if (typeof id !== 'undefined' && id !== null) {
      placeholders.push('?')
      values.push(id)
    } else {
      placeholders.push('LAST_INSERT_ID()')
    }
  }
  if (columns.includes('ci_customer_code')) {
    cols.push('ci_customer_code')
    placeholders.push('?')
    values.push(code || null)
  }
  if (columns.includes('ci_customer_name')) {
    cols.push('ci_customer_name')
    placeholders.push('?')
    values.push(name || null)
  }
  if (columns.includes('ci_address')) {
    cols.push('ci_address')
    placeholders.push('?')
    values.push(address || null)
  }
  if (columns.includes('ci_tin')) {
    cols.push('ci_tin')
    placeholders.push('?')
    values.push(tin || null)
  }
  if (columns.includes('ci_details')) {
    cols.push('ci_details')
    placeholders.push('?')
    values.push(details || null)
  }
  if (columns.includes('ci_contact')) {
    cols.push('ci_contact')
    placeholders.push('?')
    values.push(contact || null)
  }

  if (cols.length === 0) return null

  return {
    sql: `INSERT INTO customers_information (${cols.join(', ')}) VALUES (${placeholders.join(', ')})`,
    values,
  }
}

const buildCustomerInfoUpdateQuery = (
  columns,
  keyColumn,
  keyValue,
  oldCode,
  oldName,
  code,
  name,
  address,
  tin,
  details,
  contact,
) => {
  if (!keyColumn) return null

  const sets = []
  const values = []

  if (columns.includes('ci_customer_code')) {
    sets.push('ci_customer_code = ?')
    values.push(code || null)
  }
  if (columns.includes('ci_customer_name')) {
    sets.push('ci_customer_name = ?')
    values.push(name || null)
  }
  if (columns.includes('ci_address')) {
    sets.push('ci_address = ?')
    values.push(address || null)
  }
  if (columns.includes('ci_tin')) {
    sets.push('ci_tin = ?')
    values.push(tin || null)
  }
  if (columns.includes('ci_details')) {
    sets.push('ci_details = ?')
    values.push(details || null)
  }
  if (columns.includes('ci_contact')) {
    sets.push('ci_contact = ?')
    values.push(contact || null)
  }

  if (sets.length === 0) return null

  const lookupValue =
    keyColumn === 'ci_customer_code'
      ? oldCode || code
      : keyColumn === 'ci_customer_name'
        ? oldName || name
        : keyValue

  return {
    sql: `UPDATE customers_information SET ${sets.join(', ')} WHERE ${keyColumn} = ?`,
    values: [...values, lookupValue],
  }
}

const getCustomers = async (req, res, next) => {
  try {
    const customerInfoColumns = await getInfoTableColumns('customers_information')
    const joinKey = customerInfoColumns.includes('ci_customer_id')
      ? { info: 'ci_customer_id', main: 'c_id' }
      : customerInfoColumns.includes('ci_customer_code')
        ? { info: 'ci_customer_code', main: 'c_code' }
        : customerInfoColumns.includes('ci_customer_name')
          ? { info: 'ci_customer_name', main: 'c_name' }
          : null

    const selectFields = [
      'c.c_id AS id',
      'c.c_code AS code',
      'c.c_name AS name',
      'c.c_category AS category',
      'c.c_type AS type',
      'UPPER(c.c_status) AS status',
    ]

    if (customerInfoColumns.includes('ci_address')) {
      selectFields.push('ci.ci_address AS address')
    }
    if (customerInfoColumns.includes('ci_tin')) {
      selectFields.push('ci.ci_tin AS tin')
    }
    if (customerInfoColumns.includes('ci_details')) {
      selectFields.push('ci.ci_details AS details')
    }
    if (customerInfoColumns.includes('ci_contact')) {
      selectFields.push('ci.ci_contact AS contact')
    }

    let query = `SELECT ${selectFields.join(', ')} FROM customers c`
    if (joinKey) {
      query += ` LEFT JOIN customers_information ci ON ci.${joinKey.info} = c.${joinKey.main}`
    }
    query += ' ORDER BY c.c_name ASC'

    const customers = await Query(query, [])

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
    const { code, name, category, type, address, tin, details, contact } = req.body
    const status = 'ACTIVE'

    // Require only essential fields; details and contact may be blank/null
    if (!code || !name || !address || !tin) {
      return res.status(400).json({
        success: false,
        message: 'Customer code, name, address, and TIN are required',
      })
    }

    const customerInfoColumns = await getInfoTableColumns('customers_information')
    const pool = getTenantPool()
    const connection = await pool.getConnection()

    let newCustomerId = null
    try {
      await connection.beginTransaction()

      const insertCustomerQuery = sql
        .insert(Master.customers.tablename, {
          columns: Master.customers.insertColumns,
          prefix: Master.customers.prefix,
          isTransaction: true,
        })
        .build()

      const [customerResult] = await connection.execute(insertCustomerQuery, [
        code || null,
        name || null,
        category || null,
        type || null,
        status,
      ])

      newCustomerId = customerResult.insertId
      if (!newCustomerId) {
        throw new Error('Failed to get customer ID from insertion')
      }

      const customerInfoInsert = buildCustomerInfoInsertQuery(
        customerInfoColumns,
        code,
        name,
        address,
        tin,
        details,
        contact,
        newCustomerId,
      )

      if (customerInfoInsert) {
        await connection.execute(customerInfoInsert.sql, customerInfoInsert.values)
      }

      await connection.commit()
    } catch (error) {
      if (connection) {
        try {
          await connection.rollback()
        } catch (rollbackError) {
          console.error(
            'Error rolling back customer creation transaction:',
            rollbackError,
          )
        }
      }
      throw error
    } finally {
      if (connection) {
        connection.release()
      }
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
        address: address,
        tin: tin,
        details: details,
        contact: contact,
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
    const {
      id: idFromBody,
      code,
      name,
      category,
      type,
      address,
      tin,
      details,
      contact,
      status: statusFromBody,
    } = req.body
    const { id: idFromParams } = req.params
    const id = Number(idFromParams || idFromBody)

    if (!id || !code || !name) {
      return res.status(400).json({
        success: false,
        message: 'ID, customer code, and name are required',
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
    const status =
      typeof statusFromBody !== 'undefined'
        ? String(statusFromBody).toUpperCase()
        : old.status

    const customerInfoColumns = await getInfoTableColumns('customers_information')
    const keyColumn = customerInfoColumns.includes('ci_customer_id')
      ? 'ci_customer_id'
      : customerInfoColumns.includes('ci_customer_code')
        ? 'ci_customer_code'
        : customerInfoColumns.includes('ci_customer_name')
          ? 'ci_customer_name'
          : null

    let hasInfoRecord = false
    let infoLookupValue = null

    if (keyColumn) {
      infoLookupValue =
        keyColumn === 'ci_customer_id'
          ? id
          : keyColumn === 'ci_customer_code'
            ? old.code
            : old.name

      const existingInfoQuery = `SELECT ${keyColumn} FROM customers_information WHERE ${keyColumn} = ?`
      const existingInfoRows = await Query(existingInfoQuery, [infoLookupValue])
      hasInfoRecord = existingInfoRows.length > 0
    }

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

    if (keyColumn && hasInfoRecord) {
      const updateInfo = buildCustomerInfoUpdateQuery(
        customerInfoColumns,
        keyColumn,
        infoLookupValue,
        old.code,
        old.name,
        code,
        name,
        address,
        tin,
        details,
        contact,
      )
      if (updateInfo) {
        queries.push(updateInfo)
      }
    } else {
      const customerInfoInsert = buildCustomerInfoInsertQuery(
        customerInfoColumns,
        code,
        name,
        address,
        tin,
        details,
        contact,
        keyColumn === 'ci_customer_id' ? id : undefined,
      )
      if (customerInfoInsert) {
        queries.push(customerInfoInsert)
      }
    }

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
      data: {
        id,
        code,
        name,
        category,
        type,
        address,
        tin,
        details,
        contact,
        status,
      },
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
