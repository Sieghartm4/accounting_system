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
  try {
    const query = `
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
    `
    const rows = await Query(query, [tableName])
    return rows.map((row) => row.COLUMN_NAME)
  } catch (error) {
    return []
  }
}

const buildVendorInfoInsertQuery = (
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

  if (columns.includes('vi_vendor_id')) {
    cols.push('vi_vendor_id')
    if (typeof id !== 'undefined' && id !== null) {
      placeholders.push('?')
      values.push(id)
    } else {
      placeholders.push('LAST_INSERT_ID()')
    }
  }
  if (columns.includes('vi_vendor_code')) {
    cols.push('vi_vendor_code')
    placeholders.push('?')
    values.push(code || null)
  }
  if (columns.includes('vi_vendor_name')) {
    cols.push('vi_vendor_name')
    placeholders.push('?')
    values.push(name || null)
  }
  if (columns.includes('vi_address')) {
    cols.push('vi_address')
    placeholders.push('?')
    values.push(address || null)
  }
  if (columns.includes('vi_tin')) {
    cols.push('vi_tin')
    placeholders.push('?')
    values.push(tin || null)
  }
  if (columns.includes('vi_details')) {
    cols.push('vi_details')
    placeholders.push('?')
    values.push(details || null)
  }
  if (columns.includes('vi_contact')) {
    cols.push('vi_contact')
    placeholders.push('?')
    values.push(contact || null)
  }

  if (cols.length === 0) return null

  return {
    sql: `INSERT INTO vendors_information (${cols.join(', ')}) VALUES (${placeholders.join(', ')})`,
    values,
  }
}

const buildVendorInfoUpdateQuery = (
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

  if (columns.includes('vi_vendor_code')) {
    sets.push('vi_vendor_code = ?')
    values.push(code || null)
  }
  if (columns.includes('vi_vendor_name')) {
    sets.push('vi_vendor_name = ?')
    values.push(name || null)
  }
  if (columns.includes('vi_address')) {
    sets.push('vi_address = ?')
    values.push(address || null)
  }
  if (columns.includes('vi_tin')) {
    sets.push('vi_tin = ?')
    values.push(tin || null)
  }
  if (columns.includes('vi_details')) {
    sets.push('vi_details = ?')
    values.push(details || null)
  }
  if (columns.includes('vi_contact')) {
    sets.push('vi_contact = ?')
    values.push(contact || null)
  }

  if (sets.length === 0) return null

  const lookupValue =
    keyColumn === 'vi_vendor_code'
      ? oldCode || code
      : keyColumn === 'vi_vendor_name'
        ? oldName || name
        : keyValue

  return {
    sql: `UPDATE vendors_information SET ${sets.join(', ')} WHERE ${keyColumn} = ?`,
    values: [...values, lookupValue],
  }
}

const getVendors = async (req, res, next) => {
  try {
    const vendorInfoColumns = await getInfoTableColumns('vendors_information')
    const joinKey = vendorInfoColumns.includes('vi_vendor_id')
      ? { info: 'vi_vendor_id', main: 'v_id' }
      : vendorInfoColumns.includes('vi_vendor_code')
        ? { info: 'vi_vendor_code', main: 'v_code' }
        : vendorInfoColumns.includes('vi_vendor_name')
          ? { info: 'vi_vendor_name', main: 'v_name' }
          : null

    const selectFields = [
      'v.v_id AS id',
      'v.v_code AS code',
      'v.v_name AS name',
      'v.v_category AS category',
      'v.v_type AS type',
      'UPPER(v.v_status) AS status',
    ]

    if (vendorInfoColumns.includes('vi_address')) {
      selectFields.push('vi.vi_address AS address')
    }
    if (vendorInfoColumns.includes('vi_tin')) {
      selectFields.push('vi.vi_tin AS tin')
    }
    if (vendorInfoColumns.includes('vi_details')) {
      selectFields.push('vi.vi_details AS details')
    }
    if (vendorInfoColumns.includes('vi_contact')) {
      selectFields.push('vi.vi_contact AS contact')
    }

    let query = `SELECT ${selectFields.join(', ')} FROM vendors v`
    if (joinKey) {
      query += ` LEFT JOIN vendors_information vi ON vi.${joinKey.info} = v.${joinKey.main}`
    }
    query += ' ORDER BY v.v_name ASC'

    const vendors = await Query(query, [])

    res.status(200).json({
      success: true,
      message: 'Vendors retrieved successfully',
      data: vendors,
      count: vendors.length,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error fetching vendors:', error)
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching vendors',
      error:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Internal server error',
    })
  }
}

const getVendorTransactions = async (req, res, next) => {
  try {
    const query = `
      SELECT
        v.v_id AS id,
        v.v_code AS code,
        v.v_name AS name,
        v.v_status AS status,
        COALESCE(cd.disbursements_count, 0) AS disbursements,
        COALESCE(p.purchase_count, 0) AS purchases,
        COALESCE(cd.disbursement_amount_due, 0) + COALESCE(p.purchase_amount_due, 0) AS total_amount_due
      FROM vendors v
      LEFT JOIN (
        SELECT
          cd_vendor_id AS vendor_id,
          COUNT(*) AS disbursements_count,
          SUM(CAST(cd_total_amount_due AS DECIMAL(20, 2))) AS disbursement_amount_due
        FROM cash_disbursements
        WHERE LOWER(cd_state) = 'approved'
        GROUP BY cd_vendor_id
      ) cd ON cd.vendor_id = v.v_id
      LEFT JOIN (
        SELECT
          p_vendor_id AS vendor_id,
          COUNT(*) AS purchase_count,
          SUM(CAST(p_total_amount_due AS DECIMAL(20, 2))) AS purchase_amount_due
        FROM purchase
        WHERE LOWER(p_state) = 'approved'
        GROUP BY p_vendor_id
      ) p ON p.vendor_id = v.v_id
      ORDER BY v.v_name ASC
    `

    const rows = await Query(query, [])

    const summary = {
      vendors: rows.length,
      totalAmountDue: rows.reduce(
        (sum, row) => sum + Number(row.total_amount_due || 0),
        0,
      ),
      approvedDisbursements: rows.reduce(
        (sum, row) => sum + Number(row.disbursements || 0),
        0,
      ),
      approvedPurchases: rows.reduce(
        (sum, row) => sum + Number(row.purchases || 0),
        0,
      ),
    }

    res.status(200).json({
      success: true,
      message: 'Vendor transactions retrieved successfully',
      data: rows,
      summary,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error fetching vendor transactions:', error)
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching vendor transactions',
      error:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Internal server error',
    })
  }
}

const createVendor = async (req, res, next) => {
  try {
    const { code, name, category, type, address, tin, details, contact } = req.body
    const status = 'ACTIVE'

    // Require only essential fields; details and contact may be blank/null
    if (!code || !name || !address || !tin) {
      return res.status(400).json({
        success: false,
        message: 'Vendor code, name, address, and TIN are required',
      })
    }

    const vendorInfoColumns = await getInfoTableColumns('vendors_information')
    const pool = getTenantPool()
    const connection = await pool.getConnection()

    let newVendorId = null
    try {
      await connection.beginTransaction()

      const insertVendorQuery = sql
        .insert(Master.vendors.tablename, {
          columns: Master.vendors.insertColumns,
          prefix: Master.vendors.prefix,
          isTransaction: true,
        })
        .build()

      const [vendorResult] = await connection.execute(insertVendorQuery, [
        code || null,
        name || null,
        category || null,
        type || null,
        status,
      ])

      newVendorId = vendorResult.insertId
      if (!newVendorId) {
        throw new Error('Failed to get vendor ID from insertion')
      }

      const vendorInfoInsert = buildVendorInfoInsertQuery(
        vendorInfoColumns,
        code,
        name,
        address,
        tin,
        details,
        contact,
        newVendorId,
      )

      if (vendorInfoInsert) {
        await connection.execute(vendorInfoInsert.sql, vendorInfoInsert.values)
      }

      await connection.commit()
    } catch (error) {
      if (connection) {
        try {
          await connection.rollback()
        } catch (rollbackError) {
          console.error(
            'Error rolling back vendor creation transaction:',
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
        newVendorId || null,
        'VENDOR',
        req.context?.username || null,
        now.toISOString().split('T')[0],
        now.toTimeString().split(' ')[0],
        `CREATE: ID ${newVendorId}`,
      ],
    })
    await Transaction(auditQueries)

    res.status(201).json({
      success: true,
      message: 'Vendor created successfully',
      data: {
        id: newVendorId,
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
    console.error('Error creating vendor:', error)
    return res.status(500).json({
      success: false,
      message: 'Server error while creating vendor',
      error:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Internal server error',
    })
  }
}

const updateVendor = async (req, res, next) => {
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
        message: 'ID, vendor code, and name are required',
      })
    }

    // Fetch existing vendor to compare changes
    const existingQuery = sql
      .select([
        Master.vendors.selectOptionColumns.code,
        Master.vendors.selectOptionColumns.name,
        Master.vendors.selectOptionColumns.category,
        Master.vendors.selectOptionColumns.type,
        Master.vendors.selectOptionColumns.status,
      ])
      .from(Master.vendors.tablename)
      .where(Master.vendors.selectOptionColumns.id)
      .build()
    const existingVendors = await Query(existingQuery, [id], Master.vendors.prefix_)
    const old = existingVendors[0] || {}
    const status =
      typeof statusFromBody !== 'undefined'
        ? String(statusFromBody).toUpperCase()
        : old.status

    const vendorInfoColumns = await getInfoTableColumns('vendors_information')
    const keyColumn = vendorInfoColumns.includes('vi_vendor_id')
      ? 'vi_vendor_id'
      : vendorInfoColumns.includes('vi_vendor_code')
        ? 'vi_vendor_code'
        : vendorInfoColumns.includes('vi_vendor_name')
          ? 'vi_vendor_name'
          : null

    let hasInfoRecord = false
    let infoLookupValue = null

    if (keyColumn) {
      infoLookupValue =
        keyColumn === 'vi_vendor_id'
          ? id
          : keyColumn === 'vi_vendor_code'
            ? old.code
            : old.name

      const existingInfoQuery = `SELECT ${keyColumn} FROM vendors_information WHERE ${keyColumn} = ?`
      const existingInfoRows = await Query(existingInfoQuery, [infoLookupValue])
      hasInfoRecord = existingInfoRows.length > 0
    }

    const updateQuery = sql
      .update(Master.vendors.tablename)
      .set([
        Master.vendors.selectOptionColumns.code,
        Master.vendors.selectOptionColumns.name,
        Master.vendors.selectOptionColumns.category,
        Master.vendors.selectOptionColumns.type,
        Master.vendors.selectOptionColumns.status,
      ])
      .where(Master.vendors.selectOptionColumns.id)
      .build()

    const queries = [
      {
        sql: updateQuery,
        values: [code, name, category, type, status, id],
      },
    ]

    if (keyColumn && hasInfoRecord) {
      const updateInfo = buildVendorInfoUpdateQuery(
        vendorInfoColumns,
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
      const vendorInfoInsert = buildVendorInfoInsertQuery(
        vendorInfoColumns,
        code,
        name,
        address,
        tin,
        details,
        contact,
        keyColumn === 'vi_vendor_id' ? id : undefined,
      )
      if (vendorInfoInsert) {
        queries.push(vendorInfoInsert)
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
        'VENDOR',
        req.context?.username || null,
        now.toISOString().split('T')[0],
        now.toTimeString().split(' ')[0],
        `UPDATE ID ${id}: ${changeDesc}`,
      ],
    })
    await Transaction(auditQueries)

    res.status(200).json({
      success: true,
      message: 'Vendor updated successfully',
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
    console.error('Error updating vendor:', error)
    return res.status(500).json({
      success: false,
      message: 'Server error while updating vendor',
      error:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Internal server error',
    })
  }
}
module.exports = {
  getVendors,
  getVendorTransactions,
  createVendor,
  updateVendor,
}
