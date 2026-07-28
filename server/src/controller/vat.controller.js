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

const findVatCodeDuplicate = async (code, excludeId = null) => {
  const normalizedCode = normalizeCodeValue(code)
  if (!normalizedCode) return false

  const query = excludeId
    ? `SELECT ${Master.vat.selectOptionColumns.id} FROM ${Master.vat.tablename} WHERE UPPER(${Master.vat.selectOptionColumns.code}) = ? AND ${Master.vat.selectOptionColumns.id} <> ? LIMIT 1`
    : `SELECT ${Master.vat.selectOptionColumns.id} FROM ${Master.vat.tablename} WHERE UPPER(${Master.vat.selectOptionColumns.code}) = ? LIMIT 1`

  const rows = await Query(
    query,
    excludeId ? [normalizedCode, excludeId] : [normalizedCode],
    Master.vat.prefix_,
  )

  return Array.isArray(rows) && rows.length > 0
}

const getVat = async (req, res, next) => {
  try {
    const query = sql
      .select([
        { col: Master.vat.selectOptionColumns.id, as: 'id' },
        { col: Master.vat.selectOptionColumns.code, as: 'code' },
        { col: Master.vat.selectOptionColumns.name, as: 'name' },
        { col: Master.vat.selectOptionColumns.rate, as: 'rate' },
        { col: Master.vat.selectOptionColumns.type, as: 'type' },
        { col: Master.vat.selectOptionColumns.sub_type, as: 'sub_type' },
        { col: Master.vat.selectOptionColumns.description, as: 'description' },
        { col: Master.vat.selectOptionColumns.status, as: 'status' },
      ])
      .from(Master.vat.tablename)
      .orderByDesc(Master.vat.selectOptionColumns.id)
      .build()

    let vat = await Query(query, [], [Master.vat.prefix_])
    console.log(vat)
    res.status(200).json({
      success: true,
      message: 'VAT entries retrieved successfully',
      data: vat,
      count: vat.length,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error fetching VAT entries:', error)
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching VAT entries',
      error:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Internal server error',
    })
  }
}

const createVat = async (req, res, next) => {
  try {
    const { code, name, rate, type, sub_type, description, status } = req.body
    const normalizedCode = String(code || '').trim()
    const normalizedSubType =
      sub_type === '' || sub_type === null || sub_type === undefined
        ? null
        : sub_type

    if (
      !normalizedCode ||
      !name ||
      rate === undefined ||
      !type ||
      !description ||
      !status
    ) {
      return res.status(400).json({
        success: false,
        message:
          'Missing required fields: code, name, rate, type, description, status',
      })
    }

    const isDuplicateCode = await findVatCodeDuplicate(normalizedCode)
    if (isDuplicateCode) {
      return res.status(409).json({
        success: false,
        message: 'A VAT code already exists. Please use a different code.',
      })
    }

    let queries = []

    queries.push({
      sql: sql
        .insert(Master.vat.tablename, {
          columns: Master.vat.insertColumns,
          prefix: Master.vat.prefix,
          isTransaction: true,
        })
        .build(),
      values: [
        normalizedCode || null,
        name || null,
        rate || null,
        type || null,
        normalizedSubType,
        description || null,
        status || null,
      ],
    })

    let result = await Transaction(queries)

    const getIdQuery = `SELECT LAST_INSERT_ID() as insertId`
    const idResult = await Query(getIdQuery)
    const newVatId = idResult[0]?.insertId

    if (!newVatId) {
      throw new Error('Failed to get VAT ID from insertion')
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
        newVatId || null,
        'VAT',
        req.context?.username || null,
        now.toISOString().split('T')[0],
        now.toTimeString().split(' ')[0],
        `CREATE: ID ${newVatId}`,
      ],
    })
    await Transaction(auditQueries)

    res.status(201).json({
      success: true,
      message: 'VAT entry created successfully',
      data: {
        id: newVatId,
        code,
        name,
        rate,
        type,
        normalizedSubType,
        description,
        status,
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error creating VAT entry:', error)
    return res.status(500).json({
      success: false,
      message: 'Server error while creating VAT entry',
      error:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Internal server error',
    })
  }
}

const updateVat = async (req, res, next) => {
  try {
    const { id, code, name, rate, type, sub_type, description, status } = req.body
    const normalizedCode = String(code || '').trim()
    const normalizedSubType =
      sub_type === '' || sub_type === null || sub_type === undefined
        ? null
        : sub_type
    console.log('body', req.body)

    if (
      !id ||
      !normalizedCode ||
      !name ||
      rate === undefined ||
      !type ||
      !description ||
      !status
    ) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required',
      })
    }

    // Fetch existing VAT to compare changes
    const existingQuery = sql
      .select([
        Master.vat.selectOptionColumns.code,
        Master.vat.selectOptionColumns.name,
        Master.vat.selectOptionColumns.rate,
        Master.vat.selectOptionColumns.type,
        Master.vat.selectOptionColumns.sub_type,
        Master.vat.selectOptionColumns.description,
        Master.vat.selectOptionColumns.status,
      ])
      .from(Master.vat.tablename)
      .where(Master.vat.selectOptionColumns.id)
      .build()
    const existingVats = await Query(existingQuery, [id], Master.vat.prefix_)
    const old = existingVats[0] || {}

    const isDuplicateCode = await findVatCodeDuplicate(normalizedCode, id)
    if (isDuplicateCode) {
      return res.status(409).json({
        success: false,
        message: 'A VAT code already exists. Please use a different code.',
      })
    }

    let connection
    try {
      connection = await getTenantPool().getConnection()
      await connection.beginTransaction()

      const updateQuery = sql
        .update(Master.vat.tablename)
        .set([
          Master.vat.selectOptionColumns.code,
          Master.vat.selectOptionColumns.name,
          Master.vat.selectOptionColumns.rate,
          Master.vat.selectOptionColumns.type,
          Master.vat.selectOptionColumns.sub_type,
          Master.vat.selectOptionColumns.description,
          Master.vat.selectOptionColumns.status,
        ])
        .where(Master.vat.selectOptionColumns.id)
        .build()

      const updateValues = [
        code,
        name,
        rate,
        type,
        normalizedSubType,
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
      if (old.type !== type) changes.push(`type='${type}'`)
      if (old.sub_type !== normalizedSubType)
        changes.push(`sub_type='${normalizedSubType}'`)
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
          'VAT',
          req.context?.username || null,
          now.toISOString().split('T')[0],
          now.toTimeString().split(' ')[0],
          `UPDATE ID ${id}: ${changeDesc}`,
        ],
      })
      await Transaction(auditQueries)

      res.status(200).json({
        success: true,
        message: 'VAT entry updated successfully',
        data: {
          id,
          normalizedCode,
          name,
          rate,
          type,
          normalizedSubType,
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
    console.error('Error updating VAT entry:', error)
    return res.status(500).json({
      success: false,
      message: 'Server error while updating VAT entry',
      error:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Internal server error',
    })
  }
}

const importVat = async (req, res, next) => {
  try {
    const { vats } = req.body

    if (!Array.isArray(vats) || vats.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'VAT array is required',
      })
    }

    const results = {
      created: [],
      updated: [],
      errors: [],
    }

    const now = new Date()
    const auditQueries = []

    for (const vat of vats) {
      try {
        const { id, code, name, rate, type, sub_type, description, status } = vat
        const normalizedCode = String(code || '').trim()
        const normalizedSubType =
          sub_type === '' || sub_type === null || sub_type === undefined
            ? null
            : sub_type

        // Validate required fields
        if (
          !normalizedCode ||
          !name ||
          rate === undefined ||
          !type ||
          !description ||
          !status
        ) {
          results.errors.push({
            vat,
            message: 'Missing required fields (code, name, rate, type, description, status)',
          })
          continue
        }

        // Check if VAT exists by ID or code
        let existingVat = null
        if (id) {
          const existingQuery = sql
            .select([
              Master.vat.selectOptionColumns.id,
              Master.vat.selectOptionColumns.code,
              Master.vat.selectOptionColumns.name,
              Master.vat.selectOptionColumns.rate,
              Master.vat.selectOptionColumns.type,
              Master.vat.selectOptionColumns.sub_type,
              Master.vat.selectOptionColumns.description,
              Master.vat.selectOptionColumns.status,
            ])
            .from(Master.vat.tablename)
            .where(Master.vat.selectOptionColumns.id)
            .build()
          const existingVats = await Query(
            existingQuery,
            [id],
            Master.vat.prefix_,
          )
          existingVat = existingVats[0] || null
        }

        // If not found by ID, check by code
        if (!existingVat) {
          const codeQuery = `SELECT ${Master.vat.selectOptionColumns.id}, ${Master.vat.selectOptionColumns.code}, ${Master.vat.selectOptionColumns.name}, ${Master.vat.selectOptionColumns.rate}, ${Master.vat.selectOptionColumns.type}, ${Master.vat.selectOptionColumns.sub_type}, ${Master.vat.selectOptionColumns.description}, ${Master.vat.selectOptionColumns.status} FROM ${Master.vat.tablename} WHERE UPPER(${Master.vat.selectOptionColumns.code}) = ? LIMIT 1`
          const codeResults = await Query(
            codeQuery,
            [normalizedCode.toUpperCase()],
            Master.vat.prefix_,
          )
          existingVat = codeResults[0] || null
        }

        if (existingVat) {
          // Update existing VAT
          const updateQuery = sql
            .update(Master.vat.tablename)
            .set([
              Master.vat.selectOptionColumns.code,
              Master.vat.selectOptionColumns.name,
              Master.vat.selectOptionColumns.rate,
              Master.vat.selectOptionColumns.type,
              Master.vat.selectOptionColumns.sub_type,
              Master.vat.selectOptionColumns.description,
              Master.vat.selectOptionColumns.status,
            ])
            .where(Master.vat.selectOptionColumns.id)
            .build()

          const queries = [
            {
              sql: updateQuery,
              values: [normalizedCode, name, rate, type, normalizedSubType, description, status, existingVat.id],
            },
          ]

          await Transaction(queries)

          // Build change description
          const changes = []
          if (existingVat.code !== normalizedCode) changes.push(`code='${normalizedCode}'`)
          if (existingVat.name !== name) changes.push(`name='${name}'`)
          if (existingVat.rate != rate) changes.push(`rate='${rate}'`)
          if (existingVat.type !== type) changes.push(`type='${type}'`)
          if (existingVat.sub_type !== normalizedSubType) changes.push(`sub_type='${normalizedSubType}'`)
          if (existingVat.description !== description) changes.push(`description='${description}'`)
          if (existingVat.status !== status) changes.push(`status='${status}'`)
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
              existingVat.id || null,
              'VAT',
              req.context?.username || null,
              now.toISOString().split('T')[0],
              now.toTimeString().split(' ')[0],
              `IMPORT UPDATE ID ${existingVat.id}: ${changeDesc}`,
            ],
          })

          results.updated.push({
            id: existingVat.id,
            code: normalizedCode,
            name,
          })
        } else {
          // Create new VAT
          const isDuplicateCode = await findVatCodeDuplicate(normalizedCode)
          if (isDuplicateCode) {
            results.errors.push({
              vat,
              message: 'VAT code already exists',
            })
            continue
          }

          const insertQuery = sql
            .insert(Master.vat.tablename, {
              columns: Master.vat.insertColumns,
              prefix: Master.vat.prefix,
              isTransaction: true,
            })
            .build()

          const queries = [
            {
              sql: insertQuery,
              values: [normalizedCode, name, rate, type, normalizedSubType, description, status],
            },
          ]

          await Transaction(queries)

          const getIdQuery = `SELECT LAST_INSERT_ID() as insertId`
          const idResult = await Query(getIdQuery)
          const newVatId = idResult[0]?.insertId

          if (!newVatId) {
            throw new Error('Failed to get VAT ID from insertion')
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
              newVatId || null,
              'VAT',
              req.context?.username || null,
              now.toISOString().split('T')[0],
              now.toTimeString().split(' ')[0],
              `IMPORT CREATE: ID ${newVatId}`,
            ],
          })

          results.created.push({
            id: newVatId,
            code: normalizedCode,
            name,
          })
        }
      } catch (error) {
        console.error('Error processing VAT:', vat, error)
        results.errors.push({
          vat,
          message: error.message || 'Failed to process VAT',
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
    console.error('Error importing VAT:', error)
    return res.status(500).json({
      success: false,
      message: 'Server error while importing VAT',
      error:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Internal server error',
    })
  }
}

module.exports = {
  getVat,
  createVat,
  updateVat,
  importVat,
}
