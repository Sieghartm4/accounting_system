const os = require('os')
const {
  checkConnection,
  SelectAll,
  SelectWithCondition,
  Insert,
  Transaction,
  Query,
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

const getAuditTrail = async (req, res, next) => {
  try {
    const { module, performed_by, limit = 100, offset = 0 } = req.query

    let query = sql
      .select([
        { col: Master.audit_trail.selectOptionColumns.id, as: 'id' },
        {
          col: Master.audit_trail.selectOptionColumns.transaction_id,
          as: 'transaction_id',
        },
        { col: Master.audit_trail.selectOptionColumns.module, as: 'module' },
        {
          col: Master.audit_trail.selectOptionColumns.performed_by,
          as: 'performed_by',
        },
        {
          col: Master.audit_trail.selectOptionColumns.created_date,
          as: 'created_date',
        },
        {
          col: Master.audit_trail.selectOptionColumns.created_time,
          as: 'created_time',
        },
        { col: Master.audit_trail.selectOptionColumns.action, as: 'action' },
      ])
      .from(Master.audit_trail.tablename)

    // Build WHERE conditions if filters are provided
    let conditions = []
    let params = []

    if (module) {
      conditions.push(`${Master.audit_trail.selectOptionColumns.module} = ?`)
      params.push(module)
    }

    if (performed_by) {
      conditions.push(`${Master.audit_trail.selectOptionColumns.performed_by} = ?`)
      params.push(performed_by)
    }

    if (conditions.length > 0) {
      query = query.where(conditions.join(' AND '))
    }

    // Build query and append ORDER BY, LIMIT and OFFSET manually
    let finalQuery = query.build()
    finalQuery += ` ORDER BY ${Master.audit_trail.selectOptionColumns.id} DESC LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}`

    const auditTrails = await Query(finalQuery, params, [Master.audit_trail.prefix_])

    res.status(200).json({
      success: true,
      message: 'Audit trails retrieved successfully',
      data: auditTrails,
      count: auditTrails.length,
      limit: parseInt(limit),
      offset: parseInt(offset),
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error fetching audit trails:', error)
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching audit trails',
      error:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Internal server error',
    })
  }
}

const createAuditTrail = async (req, res, next) => {
  try {
    const {
      transaction_id,
      module,
      performed_by,
      created_date,
      created_time,
      action,
    } = req.body

    if (!module || !action) {
      return res.status(400).json({
        success: false,
        message: 'Module and action are required',
      })
    }

    // Use current date/time if not provided
    const now = new Date()
    const dateStr = created_date || now.toISOString().split('T')[0]
    const timeStr = created_time || now.toTimeString().split(' ')[0]
    const userStr = performed_by || req.context?.username || 'SYSTEM'
    const txnId = transaction_id || `TXN_${Date.now()}`

    let queries = []

    queries.push({
      sql: sql
        .insert(Master.audit_trail.tablename, {
          columns: Master.audit_trail.insertColumns,
          prefix: Master.audit_trail.prefix,
          isTransaction: true,
        })
        .build(),
      values: [txnId, module, userStr, dateStr, timeStr, action],
    })

    let result = await Transaction(queries)

    const getIdQuery = `SELECT LAST_INSERT_ID() as insertId`
    const idResult = await Query(getIdQuery)
    const newAuditTrailId = idResult[0]?.insertId

    res.status(201).json({
      success: true,
      message: 'Audit trail created successfully',
      data: {
        id: newAuditTrailId,
        transaction_id: txnId,
        module: module,
        performed_by: userStr,
        created_date: dateStr,
        created_time: timeStr,
        action: action,
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error creating audit trail:', error)
    return res.status(500).json({
      success: false,
      message: 'Server error while creating audit trail',
      error:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Internal server error',
    })
  }
}

const getAuditTrailById = async (req, res, next) => {
  try {
    const { id } = req.params

    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Audit trail ID is required',
      })
    }

    const query = sql
      .select([
        { col: Master.audit_trail.selectOptionColumns.id, as: 'id' },
        {
          col: Master.audit_trail.selectOptionColumns.transaction_id,
          as: 'transaction_id',
        },
        { col: Master.audit_trail.selectOptionColumns.module, as: 'module' },
        {
          col: Master.audit_trail.selectOptionColumns.performed_by,
          as: 'performed_by',
        },
        {
          col: Master.audit_trail.selectOptionColumns.created_date,
          as: 'created_date',
        },
        {
          col: Master.audit_trail.selectOptionColumns.created_time,
          as: 'created_time',
        },
        { col: Master.audit_trail.selectOptionColumns.action, as: 'action' },
      ])
      .from(Master.audit_trail.tablename)
      .where(`${Master.audit_trail.selectOptionColumns.id} = ?`)
      .build()

    const auditTrail = await Query(query, [id], [Master.audit_trail.prefix_])

    if (!auditTrail || auditTrail.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Audit trail not found',
      })
    }

    res.status(200).json({
      success: true,
      message: 'Audit trail retrieved successfully',
      data: auditTrail[0],
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error fetching audit trail by ID:', error)
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching audit trail',
      error:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Internal server error',
    })
  }
}

module.exports = {
  getAuditTrail,
  createAuditTrail,
  getAuditTrailById,
}
