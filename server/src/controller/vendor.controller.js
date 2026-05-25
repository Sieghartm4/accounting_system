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

const getVendors = async (req, res, next) => {
  try {
    const vendors = await SelectAll(Master.vendors.tablename, Master.vendors.prefix_)

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
    const { code, name, category, type, status } = req.body

    if (!code || !name || !category || !type || !status) {
      return res.status(400).json({
        success: false,
        message: 'Vendor code, name, category, type and status are required',
      })
    }

    let queries = []

    queries.push({
      sql: sql
        .insert(Master.vendors.tablename, {
          columns: Master.vendors.insertColumns,
          prefix: Master.vendors.prefix,
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
    const newVendorId = idResult[0]?.insertId

    if (!newVendorId) {
      throw new Error('Failed to get vendor ID from insertion')
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
    const { id: idFromBody, code, name, category, type, status } = req.body
    const { id: idFromParams } = req.params
    const id = Number(idFromParams || idFromBody)

    if (!id || !code || !name || !category || !type || !status) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required',
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
      data: { id, code, name, category, type, status },
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
