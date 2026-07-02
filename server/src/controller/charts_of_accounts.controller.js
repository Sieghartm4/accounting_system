const os = require('os')
const {
  checkConnection,
  SelectAll,
  Transaction,
  Query,
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

const getChartsOfAccounts = async (req, res, next) => {
  try {
    const chartsOfAccounts = await SelectAll(
      Master.charts_of_accounts.tablename,
      Master.charts_of_accounts.prefix_,
    )

    res.status(200).json({
      success: true,
      message: 'Charts of accounts retrieved successfully',
      data: chartsOfAccounts,
      count: chartsOfAccounts.length,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error fetching charts of accounts:', error)
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching charts of accounts',
      error:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Internal server error',
    })
  }
}

const createChartsOfAccount = async (req, res, next) => {
  try {
    const { code, name, type, description, status = 'active' } = req.body

    if (!code || !name || !type || !description) {
      return res.status(400).json({
        success: false,
        message: 'Charts of account code, name, type, and description are required',
      })
    }

    let queries = []

    queries.push({
      sql: sql
        .insert(Master.charts_of_accounts.tablename, {
          columns: Master.charts_of_accounts.insertColumns,
          prefix: Master.charts_of_accounts.prefix,
          isTransaction: true,
        })
        .build(),
      values: [
        code || null,
        name || null,
        type || null,
        description || null,
        status,
      ],
    })

    let result = await Transaction(queries)

    const getIdQuery = `SELECT LAST_INSERT_ID() as insertId`
    const idResult = await Query(getIdQuery)
    const newChartsOfAccountId = idResult[0]?.insertId

    if (!newChartsOfAccountId) {
      throw new Error('Failed to get charts of account ID from insertion')
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
        newChartsOfAccountId || null,
        'CHARTS_OF_ACCOUNTS',
        req.context?.username || null,
        now.toISOString().split('T')[0],
        now.toTimeString().split(' ')[0],
        `CREATE: ID ${newChartsOfAccountId}`,
      ],
    })
    await Transaction(auditQueries)

    res.status(201).json({
      success: true,
      message: 'Charts of account created successfully',
      data: {
        id: newChartsOfAccountId,
        code: code,
        name: name,
        type: type,
        description: description,
        status: status,
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error creating charts of account:', error)
    return res.status(500).json({
      success: false,
      message: 'Server error while creating charts of account',
      error:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Internal server error',
    })
  }
}

const updateChartsOfAccount = async (req, res, next) => {
  try {
    const { id: idFromBody, code, name, type, description, status } = req.body
    const { id: idFromParams } = req.params
    const id = Number(idFromParams || idFromBody)

    if (!id || !code || !name || !type || !description || !status) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required',
      })
    }

    // Fetch existing charts of account to compare changes
    const existingQuery = sql
      .select([
        Master.charts_of_accounts.selectOptionColumns.code,
        Master.charts_of_accounts.selectOptionColumns.name,
        Master.charts_of_accounts.selectOptionColumns.type,
        Master.charts_of_accounts.selectOptionColumns.description,
        Master.charts_of_accounts.selectOptionColumns.status,
      ])
      .from(Master.charts_of_accounts.tablename)
      .where(Master.charts_of_accounts.selectOptionColumns.id)
      .build()
    const existingAccounts = await Query(
      existingQuery,
      [id],
      Master.charts_of_accounts.prefix_,
    )
    const old = existingAccounts[0] || {}

    const updateQuery = sql
      .update(Master.charts_of_accounts.tablename)
      .set([
        Master.charts_of_accounts.selectOptionColumns.code,
        Master.charts_of_accounts.selectOptionColumns.name,
        Master.charts_of_accounts.selectOptionColumns.type,
        Master.charts_of_accounts.selectOptionColumns.description,
        Master.charts_of_accounts.selectOptionColumns.status,
      ])
      .where(Master.charts_of_accounts.selectOptionColumns.id)
      .build()

    const queries = [
      {
        sql: updateQuery,
        values: [code, name, type, description, status, id],
      },
    ]

    await Transaction(queries)

    // Build change description - only include changed columns with new values
    const changes = []
    if (old.code !== code) changes.push(`code='${code}'`)
    if (old.name !== name) changes.push(`name='${name}'`)
    if (old.type !== type) changes.push(`type='${type}'`)
    if (old.description !== description) changes.push(`description='${description}'`)
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
        'CHARTS_OF_ACCOUNTS',
        req.context?.username || null,
        now.toISOString().split('T')[0],
        now.toTimeString().split(' ')[0],
        `UPDATE ID ${id}: ${changeDesc}`,
      ],
    })
    await Transaction(auditQueries)

    res.status(200).json({
      success: true,
      message: 'Charts of account updated successfully',
      data: { id, code, name, type, description, status },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error updating charts of account:', error)
    return res.status(500).json({
      success: false,
      message: 'Server error while updating charts of account',
      error:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Internal server error',
    })
  }
}

module.exports = {
  getChartsOfAccounts,
  createChartsOfAccount,
  updateChartsOfAccount,
}
