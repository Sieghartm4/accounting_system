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

const normalizeCodeValue = (value) =>
  String(value || '')
    .trim()
    .toUpperCase()

const findChartCodeDuplicate = async (code, excludeId = null) => {
  const normalizedCode = normalizeCodeValue(code)
  if (!normalizedCode) return false

  const query = excludeId
    ? `SELECT ${Master.charts_of_accounts.selectOptionColumns.id} FROM ${Master.charts_of_accounts.tablename} WHERE UPPER(${Master.charts_of_accounts.selectOptionColumns.code}) = ? AND ${Master.charts_of_accounts.selectOptionColumns.id} <> ? LIMIT 1`
    : `SELECT ${Master.charts_of_accounts.selectOptionColumns.id} FROM ${Master.charts_of_accounts.tablename} WHERE UPPER(${Master.charts_of_accounts.selectOptionColumns.code}) = ? LIMIT 1`

  const rows = await Query(
    query,
    excludeId ? [normalizedCode, excludeId] : [normalizedCode],
    Master.charts_of_accounts.prefix_,
  )

  return Array.isArray(rows) && rows.length > 0
}

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
    const normalizedCode = String(code || '').trim()

    if (!normalizedCode || !name || !type || !description) {
      return res.status(400).json({
        success: false,
        message: 'Charts of account code, name, type, and description are required',
      })
    }

    const isDuplicateCode = await findChartCodeDuplicate(normalizedCode)
    if (isDuplicateCode) {
      return res.status(409).json({
        success: false,
        message:
          'A chart of account code already exists. Please use a different code.',
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
        normalizedCode || null,
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
        code: normalizedCode,
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
    const normalizedCode = String(code || '').trim()

    if (!id || !normalizedCode || !name || !type || !description || !status) {
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

    const isDuplicateCode = await findChartCodeDuplicate(normalizedCode, id)
    if (isDuplicateCode) {
      return res.status(409).json({
        success: false,
        message:
          'A chart of account code already exists. Please use a different code.',
      })
    }

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
        values: [normalizedCode, name, type, description, status, id],
      },
    ]

    await Transaction(queries)

    // Build change description - only include changed columns with new values
    const changes = []
    if (old.code !== normalizedCode) changes.push(`code='${normalizedCode}'`)
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
      data: { id, code: normalizedCode, name, type, description, status },
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

const importChartsOfAccounts = async (req, res, next) => {
  try {
    const { accounts } = req.body

    if (!Array.isArray(accounts) || accounts.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Accounts array is required',
      })
    }

    const results = {
      created: [],
      updated: [],
      errors: [],
    }

    const now = new Date()
    const auditQueries = []

    for (const account of accounts) {
      try {
        const { id, code, name, type, description, status = 'active' } = account
        const normalizedCode = String(code || '').trim()

        // Validate required fields
        if (!normalizedCode || !name || !type || !description) {
          results.errors.push({
            account,
            message: 'Missing required fields (code, name, type, description)',
          })
          continue
        }

        // Check if account exists by ID or code
        let existingAccount = null
        if (id) {
          const existingQuery = sql
            .select([
              Master.charts_of_accounts.selectOptionColumns.id,
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
          existingAccount = existingAccounts[0] || null
        }

        // If not found by ID, check by code
        if (!existingAccount) {
          const codeQuery = `SELECT ${Master.charts_of_accounts.selectOptionColumns.id}, ${Master.charts_of_accounts.selectOptionColumns.code}, ${Master.charts_of_accounts.selectOptionColumns.name}, ${Master.charts_of_accounts.selectOptionColumns.type}, ${Master.charts_of_accounts.selectOptionColumns.description}, ${Master.charts_of_accounts.selectOptionColumns.status} FROM ${Master.charts_of_accounts.tablename} WHERE UPPER(${Master.charts_of_accounts.selectOptionColumns.code}) = ? LIMIT 1`
          const codeResults = await Query(
            codeQuery,
            [normalizedCode.toUpperCase()],
            Master.charts_of_accounts.prefix_,
          )
          existingAccount = codeResults[0] || null
        }

        if (existingAccount) {
          // Update existing account
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
              values: [normalizedCode, name, type, description, status, existingAccount.id],
            },
          ]

          await Transaction(queries)

          // Build change description
          const changes = []
          if (existingAccount.code !== normalizedCode) changes.push(`code='${normalizedCode}'`)
          if (existingAccount.name !== name) changes.push(`name='${name}'`)
          if (existingAccount.type !== type) changes.push(`type='${type}'`)
          if (existingAccount.description !== description) changes.push(`description='${description}'`)
          if (existingAccount.status !== status) changes.push(`status='${status}'`)
          const changeDesc = changes.length > 0 ? changes.join(', ') : 'no changes'

          // Audit trail for update
          auditQueries.push({
            sql: sql
              .insert(Master.audit_trail.tablename, {
                columns: Master.audit_trail.insertColumns,
                prefix: Master.audit_trail.prefix,
                isTransaction: true,
              })
              .build(),
            values: [
              existingAccount.id || null,
              'CHARTS_OF_ACCOUNTS',
              req.context?.username || null,
              now.toISOString().split('T')[0],
              now.toTimeString().split(' ')[0],
              `IMPORT UPDATE ID ${existingAccount.id}: ${changeDesc}`,
            ],
          })

          results.updated.push({
            id: existingAccount.id,
            code: normalizedCode,
            name,
          })
        } else {
          // Create new account
          const isDuplicateCode = await findChartCodeDuplicate(normalizedCode)
          if (isDuplicateCode) {
            results.errors.push({
              account,
              message: 'Account code already exists',
            })
            continue
          }

          const insertQuery = sql
            .insert(Master.charts_of_accounts.tablename, {
              columns: Master.charts_of_accounts.insertColumns,
              prefix: Master.charts_of_accounts.prefix,
              isTransaction: true,
            })
            .build()

          const queries = [
            {
              sql: insertQuery,
              values: [normalizedCode, name, type, description, status],
            },
          ]

          await Transaction(queries)

          const getIdQuery = `SELECT LAST_INSERT_ID() as insertId`
          const idResult = await Query(getIdQuery)
          const newAccountId = idResult[0]?.insertId

          if (!newAccountId) {
            throw new Error('Failed to get charts of account ID from insertion')
          }

          // Audit trail for create
          auditQueries.push({
            sql: sql
              .insert(Master.audit_trail.tablename, {
                columns: Master.audit_trail.insertColumns,
                prefix: Master.audit_trail.prefix,
                isTransaction: true,
              })
              .build(),
            values: [
              newAccountId || null,
              'CHARTS_OF_ACCOUNTS',
              req.context?.username || null,
              now.toISOString().split('T')[0],
              now.toTimeString().split(' ')[0],
              `IMPORT CREATE: ID ${newAccountId}`,
            ],
          })

          results.created.push({
            id: newAccountId,
            code: normalizedCode,
            name,
          })
        }
      } catch (error) {
        console.error('Error processing account:', account, error)
        results.errors.push({
          account,
          message: error.message || 'Failed to process account',
        })
      }
    }

    // Execute all audit trail queries in a single transaction
    if (auditQueries.length > 0) {
      await Transaction(auditQueries)
    }

    res.status(200).json({
      success: true,
      message: `Import completed: ${results.created.length} created, ${results.updated.length} updated, ${results.errors.length} errors`,
      data: results,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error importing charts of accounts:', error)
    return res.status(500).json({
      success: false,
      message: 'Server error while importing charts of accounts',
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
  importChartsOfAccounts,
}
