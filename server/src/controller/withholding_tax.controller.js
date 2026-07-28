const {
  checkConnection,
  SelectAll,
  Transaction,
  Query,
  Insert,
} = require('../database/util/queries.util')
const {
  formatMemoryUsage,
  formatTime,
  DataModeling,
} = require('../util/helper.util')
const { Master } = require('../database/model/Master')
const { SQLQueryBuilder } = require('../util/helper.util')
const { getTenantPool } = require('../database/util/tenantConnection.util')
const sql = new SQLQueryBuilder()

require('dotenv').config()

const normalizeCodeValue = (value) =>
  String(value || '')
    .trim()
    .toUpperCase()

const findWithholdingTaxCodeDuplicate = async (code, excludeId = null) => {
  const normalizedCode = normalizeCodeValue(code)
  if (!normalizedCode) return false

  const query = excludeId
    ? `SELECT ${Master.withholding_tax.selectOptionColumns.id} FROM ${Master.withholding_tax.tablename} WHERE UPPER(${Master.withholding_tax.selectOptionColumns.code}) = ? AND ${Master.withholding_tax.selectOptionColumns.id} <> ? LIMIT 1`
    : `SELECT ${Master.withholding_tax.selectOptionColumns.id} FROM ${Master.withholding_tax.tablename} WHERE UPPER(${Master.withholding_tax.selectOptionColumns.code}) = ? LIMIT 1`

  const rows = await Query(
    query,
    excludeId ? [normalizedCode, excludeId] : [normalizedCode],
    Master.withholding_tax.prefix_,
  )

  return Array.isArray(rows) && rows.length > 0
}

const getWithholdingTax = async (req, res, next) => {
  try {
    const query = sql
      .select([
        { col: Master.withholding_tax.selectOptionColumns.id, as: 'id' },
        { col: Master.withholding_tax.selectOptionColumns.code, as: 'code' },
        { col: Master.withholding_tax.selectOptionColumns.name, as: 'name' },
        { col: Master.withholding_tax.selectOptionColumns.rate, as: 'rate' },
        {
          col: Master.withholding_tax.selectOptionColumns.tax_account,
          as: 'tax_account',
        },
        {
          col: Master.withholding_tax.selectOptionColumns.description,
          as: 'description',
        },
        { col: Master.withholding_tax.selectOptionColumns.status, as: 'status' },
      ])
      .from(Master.withholding_tax.tablename)
      .orderBy(Master.withholding_tax.selectOptionColumns.id)
      .build()

    let withholdingTax = await Query(query, [], [Master.withholding_tax.prefix_])
    console.log(withholdingTax)
    res.status(200).json({
      success: true,
      message: 'Withholding Tax entries retrieved successfully',
      data: withholdingTax,
      count: withholdingTax.length,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error fetching Withholding Tax entries:', error)
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching Withholding Tax entries',
      error:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Internal server error',
    })
  }
}

const createWithholdingTax = async (req, res, next) => {
  try {
    const { code, name, rate, tax_account, description, status } = req.body
    const normalizedCode = String(code || '').trim()

    if (!normalizedCode || !name || rate === undefined || !tax_account || !status) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: code, name, rate, tax_account, status',
      })
    }

    const isDuplicateCode = await findWithholdingTaxCodeDuplicate(normalizedCode)
    if (isDuplicateCode) {
      return res.status(409).json({
        success: false,
        message:
          'A withholding tax code already exists. Please use a different code.',
      })
    }

    let queries = []

    queries.push({
      sql: sql
        .insert(Master.withholding_tax.tablename, {
          columns: Master.withholding_tax.insertColumns,
          prefix: Master.withholding_tax.prefix,
          isTransaction: true,
        })
        .build(),
      values: [
        normalizedCode || null,
        name || null,
        rate || null,
        tax_account || null,
        description || null,
        status || null,
      ],
    })

    let result = await Transaction(queries)

    const getIdQuery = `SELECT LAST_INSERT_ID() as insertId`
    const idResult = await Query(getIdQuery)
    const newWithholdingTaxId = idResult[0]?.insertId

    if (!newWithholdingTaxId) {
      throw new Error('Failed to get Withholding Tax ID from insertion')
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
        newWithholdingTaxId || null,
        'WITHHOLDING_TAX',
        req.context?.username || null,
        now.toISOString().split('T')[0],
        now.toTimeString().split(' ')[0],
        `CREATE: ID ${newWithholdingTaxId}`,
      ],
    })
    await Transaction(auditQueries)

    res.status(201).json({
      success: true,
      message: 'Withholding Tax entry created successfully',
      data: {
        id: newWithholdingTaxId,
        code,
        name,
        rate,
        tax_account,
        description,
        status,
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error creating Withholding Tax entry:', error)
    return res.status(500).json({
      success: false,
      message: 'Server error while creating Withholding Tax entry',
      error:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Internal server error',
    })
  }
}

const updateWithholdingTax = async (req, res, next) => {
  try {
    const { id, code, name, rate, tax_account, description, status } = req.body
    const normalizedCode = String(code || '').trim()
    console.log('body', req.body)

    if (
      !id ||
      !normalizedCode ||
      !name ||
      rate === undefined ||
      !tax_account ||
      !status
    ) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required',
      })
    }

    // Fetch existing withholding tax to compare changes
    const existingQuery = sql
      .select([
        Master.withholding_tax.selectOptionColumns.code,
        Master.withholding_tax.selectOptionColumns.name,
        Master.withholding_tax.selectOptionColumns.rate,
        Master.withholding_tax.selectOptionColumns.tax_account,
        Master.withholding_tax.selectOptionColumns.description,
        Master.withholding_tax.selectOptionColumns.status,
      ])
      .from(Master.withholding_tax.tablename)
      .where(Master.withholding_tax.selectOptionColumns.id)
      .build()
    const existingTaxes = await Query(
      existingQuery,
      [id],
      Master.withholding_tax.prefix_,
    )
    const old = existingTaxes[0] || {}

    const isDuplicateCode = await findWithholdingTaxCodeDuplicate(normalizedCode, id)
    if (isDuplicateCode) {
      return res.status(409).json({
        success: false,
        message:
          'A withholding tax code already exists. Please use a different code.',
      })
    }

    let connection
    try {
      connection = await getTenantPool().getConnection()
      await connection.beginTransaction()

      const updateQuery = sql
        .update(Master.withholding_tax.tablename)
        .set([
          Master.withholding_tax.selectOptionColumns.code,
          Master.withholding_tax.selectOptionColumns.name,
          Master.withholding_tax.selectOptionColumns.rate,
          Master.withholding_tax.selectOptionColumns.tax_account,
          Master.withholding_tax.selectOptionColumns.description,
          Master.withholding_tax.selectOptionColumns.status,
        ])
        .where(Master.withholding_tax.selectOptionColumns.id)
        .build()

      const updateValues = [
        normalizedCode,
        name,
        rate,
        tax_account,
        description,
        status,
        id,
      ]

      const result = await connection.execute(updateQuery, updateValues)

      await connection.commit()

      // Build change description - only include changed columns with new values
      const changes = []
      if (old.code !== normalizedCode) changes.push(`code='${normalizedCode}'`)
      if (old.name !== name) changes.push(`name='${name}'`)
      if (old.rate != rate) changes.push(`rate='${rate}'`)
      if (old.tax_account !== tax_account)
        changes.push(`tax_account='${tax_account}'`)
      if (old.description !== description)
        changes.push(`description='${description}'`)
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
          'WITHHOLDING_TAX',
          req.context?.username || null,
          now.toISOString().split('T')[0],
          now.toTimeString().split(' ')[0],
          `UPDATE ID ${id}: ${changeDesc}`,
        ],
      })
      await Transaction(auditQueries)

      res.status(200).json({
        success: true,
        message: 'Withholding Tax entry updated successfully',
        data: {
          id,
          normalizedCode,
          name,
          rate,
          tax_account,
          description,
          status,
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
    console.error('Error updating Withholding Tax entry:', error)
    return res.status(500).json({
      success: false,
      message: 'Server error while updating Withholding Tax entry',
      error:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Internal server error',
    })
  }
}

const importWithholdingTax = async (req, res, next) => {
  try {
    const { taxes } = req.body

    if (!Array.isArray(taxes) || taxes.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Taxes array is required',
      })
    }

    const results = {
      created: [],
      updated: [],
      errors: [],
    }

    const now = new Date()
    const auditQueries = []

    for (const tax of taxes) {
      try {
        const { id, code, name, rate, tax_account, description, status } = tax
        const normalizedCode = String(code || '').trim()

        // Validate required fields
        if (!normalizedCode || !name || rate === undefined || !tax_account || !status) {
          results.errors.push({
            tax,
            message: 'Missing required fields (code, name, rate, tax_account, status)',
          })
          continue
        }

        // Check if tax exists by ID or code
        let existingTax = null
        if (id) {
          const existingQuery = sql
            .select([
              Master.withholding_tax.selectOptionColumns.id,
              Master.withholding_tax.selectOptionColumns.code,
              Master.withholding_tax.selectOptionColumns.name,
              Master.withholding_tax.selectOptionColumns.rate,
              Master.withholding_tax.selectOptionColumns.tax_account,
              Master.withholding_tax.selectOptionColumns.description,
              Master.withholding_tax.selectOptionColumns.status,
            ])
            .from(Master.withholding_tax.tablename)
            .where(Master.withholding_tax.selectOptionColumns.id)
            .build()
          const existingTaxes = await Query(
            existingQuery,
            [id],
            Master.withholding_tax.prefix_,
          )
          existingTax = existingTaxes[0] || null
        }

        // If not found by ID, check by code
        if (!existingTax) {
          const codeQuery = `SELECT ${Master.withholding_tax.selectOptionColumns.id}, ${Master.withholding_tax.selectOptionColumns.code}, ${Master.withholding_tax.selectOptionColumns.name}, ${Master.withholding_tax.selectOptionColumns.rate}, ${Master.withholding_tax.selectOptionColumns.tax_account}, ${Master.withholding_tax.selectOptionColumns.description}, ${Master.withholding_tax.selectOptionColumns.status} FROM ${Master.withholding_tax.tablename} WHERE UPPER(${Master.withholding_tax.selectOptionColumns.code}) = ? LIMIT 1`
          const codeResults = await Query(
            codeQuery,
            [normalizedCode.toUpperCase()],
            Master.withholding_tax.prefix_,
          )
          existingTax = codeResults[0] || null
        }

        if (existingTax) {
          // Update existing tax
          const updateQuery = sql
            .update(Master.withholding_tax.tablename)
            .set([
              Master.withholding_tax.selectOptionColumns.code,
              Master.withholding_tax.selectOptionColumns.name,
              Master.withholding_tax.selectOptionColumns.rate,
              Master.withholding_tax.selectOptionColumns.tax_account,
              Master.withholding_tax.selectOptionColumns.description,
              Master.withholding_tax.selectOptionColumns.status,
            ])
            .where(Master.withholding_tax.selectOptionColumns.id)
            .build()

          const queries = [
            {
              sql: updateQuery,
              values: [normalizedCode, name, rate, tax_account, description, status, existingTax.id],
            },
          ]

          await Transaction(queries)

          // Build change description
          const changes = []
          if (existingTax.code !== normalizedCode) changes.push(`code='${normalizedCode}'`)
          if (existingTax.name !== name) changes.push(`name='${name}'`)
          if (existingTax.rate != rate) changes.push(`rate='${rate}'`)
          if (existingTax.tax_account !== tax_account) changes.push(`tax_account='${tax_account}'`)
          if (existingTax.description !== description) changes.push(`description='${description}'`)
          if (existingTax.status !== status) changes.push(`status='${status}'`)
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
              existingTax.id || null,
              'WITHHOLDING_TAX',
              req.context?.username || null,
              now.toISOString().split('T')[0],
              now.toTimeString().split(' ')[0],
              `IMPORT UPDATE ID ${existingTax.id}: ${changeDesc}`,
            ],
          })

          results.updated.push({
            id: existingTax.id,
            code: normalizedCode,
            name,
          })
        } else {
          // Create new tax
          const isDuplicateCode = await findWithholdingTaxCodeDuplicate(normalizedCode)
          if (isDuplicateCode) {
            results.errors.push({
              tax,
              message: 'Withholding tax code already exists',
            })
            continue
          }

          const insertQuery = sql
            .insert(Master.withholding_tax.tablename, {
              columns: Master.withholding_tax.insertColumns,
              prefix: Master.withholding_tax.prefix,
              isTransaction: true,
            })
            .build()

          const queries = [
            {
              sql: insertQuery,
              values: [normalizedCode, name, rate, tax_account, description, status],
            },
          ]

          await Transaction(queries)

          const getIdQuery = `SELECT LAST_INSERT_ID() as insertId`
          const idResult = await Query(getIdQuery)
          const newTaxId = idResult[0]?.insertId

          if (!newTaxId) {
            throw new Error('Failed to get Withholding Tax ID from insertion')
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
              newTaxId || null,
              'WITHHOLDING_TAX',
              req.context?.username || null,
              now.toISOString().split('T')[0],
              now.toTimeString().split(' ')[0],
              `IMPORT CREATE: ID ${newTaxId}`,
            ],
          })

          results.created.push({
            id: newTaxId,
            code: normalizedCode,
            name,
          })
        }
      } catch (error) {
        console.error('Error processing tax:', tax, error)
        results.errors.push({
          tax,
          message: error.message || 'Failed to process tax',
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
    console.error('Error importing withholding tax:', error)
    return res.status(500).json({
      success: false,
      message: 'Server error while importing withholding tax',
      error:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Internal server error',
    })
  }
}

module.exports = {
  getWithholdingTax,
  createWithholdingTax,
  updateWithholdingTax,
  importWithholdingTax,
}
