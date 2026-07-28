const { Transaction, SelectAll, Query } = require('../database/util/queries.util')
const { formatTime, DataModeling } = require('../util/helper.util')
const { Master } = require('../database/model/Master')
const { Accounting } = require('../database/model/Accounting')
const { SQLQueryBuilder } = require('../util/helper.util')
const sql = new SQLQueryBuilder()
require('dotenv').config()

const normalizeCodeValue = (value) =>
  String(value || '')
    .trim()
    .toUpperCase()

const getResponsibilityCenterPrefix = (name) => {
  const words = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .filter(Boolean)

  return words.length > 0 ? words.join('') : 'RC'
}

const generateResponsibilityCenterCode = async (name, excludeId = null) => {
  const prefix = getResponsibilityCenterPrefix(name)
  const makeCode = () =>
    `${prefix}-${String(Math.floor(Math.random() * 9000) + 1000)}`

  let generatedCode = makeCode()
  let attempts = 0
  while (
    attempts < 20 &&
    (await findResponsibilityCenterCodeDuplicate(generatedCode, excludeId))
  ) {
    generatedCode = makeCode()
    attempts += 1
  }

  return generatedCode
}

const findResponsibilityCenterCodeDuplicate = async (code, excludeId = null) => {
  const normalizedCode = normalizeCodeValue(code)
  if (!normalizedCode) return false

  const query = excludeId
    ? `SELECT ${Accounting.responsibility_center.selectOptionColumns.id} FROM ${Accounting.responsibility_center.tablename} WHERE UPPER(${Accounting.responsibility_center.selectOptionColumns.code}) = ? AND ${Accounting.responsibility_center.selectOptionColumns.id} <> ? LIMIT 1`
    : `SELECT ${Accounting.responsibility_center.selectOptionColumns.id} FROM ${Accounting.responsibility_center.tablename} WHERE UPPER(${Accounting.responsibility_center.selectOptionColumns.code}) = ? LIMIT 1`

  const rows = await Query(
    query,
    excludeId ? [normalizedCode, excludeId] : [normalizedCode],
    Accounting.responsibility_center.prefix_,
  )

  return Array.isArray(rows) && rows.length > 0
}

const getResponsibilityCenters = async (req, res, next) => {
  try {
    const responsibilityCenters = await SelectAll(
      Accounting.responsibility_center.tablename,
      Accounting.responsibility_center.prefix_,
    )

    res.status(200).json({
      success: true,
      message: 'Responsibility centers retrieved successfully',
      data: responsibilityCenters,
      count: responsibilityCenters.length,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error fetching responsibility centers:', error)
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching responsibility centers',
      error:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Internal server error',
    })
  }
}

const createResponsibilityCenter = async (req, res, next) => {
  try {
    const { code, name, department, status } = req.body
    const normalizedName = String(name || '').trim()
    const normalizedStatus = String(status || 'ACTIVE').trim() || 'ACTIVE'
    let normalizedCode = String(code || '').trim()

    if (!normalizedName) {
      return res.status(400).json({
        success: false,
        message: 'Responsibility center name is required',
      })
    }

    if (!normalizedCode) {
      normalizedCode = await generateResponsibilityCenterCode(normalizedName)
    }

    const isDuplicateCode =
      await findResponsibilityCenterCodeDuplicate(normalizedCode)
    if (isDuplicateCode) {
      return res.status(409).json({
        success: false,
        message:
          'A responsibility center code already exists. Please use a different code.',
      })
    }

    const queries = []
    queries.push({
      sql: sql
        .insert(Accounting.responsibility_center.tablename, {
          columns: Accounting.responsibility_center.insertColumns,
          prefix: Accounting.responsibility_center.prefix,
          isTransaction: true,
        })
        .build(),
      values: [
        normalizedCode || null,
        normalizedName || null,
        department || null,
        normalizedStatus || null,
      ],
    })

    await Transaction(queries)

    const getIdQuery = `SELECT LAST_INSERT_ID() as insertId`
    const idResult = await Query(getIdQuery)
    const newId = idResult[0]?.insertId

    if (!newId) {
      throw new Error('Failed to get responsibility center ID from insertion')
    }

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
        newId || null,
        'RESPONSIBILITY_CENTER',
        req.context?.username || null,
        now.toISOString().split('T')[0],
        now.toTimeString().split(' ')[0],
        `CREATE: ID ${newId}`,
      ],
    })
    await Transaction(auditQueries)

    res.status(201).json({
      success: true,
      message: 'Responsibility center created successfully',
      data: {
        id: newId,
        code: normalizedCode,
        name,
        department,
        status,
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error creating responsibility center:', error)
    return res.status(500).json({
      success: false,
      message: 'Server error while creating responsibility center',
      error:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Internal server error',
    })
  }
}

const updateResponsibilityCenter = async (req, res, next) => {
  try {
    const { id: idFromBody, code, name, department, status } = req.body
    const { id: idFromParams } = req.params
    const id = Number(idFromParams || idFromBody)
    const normalizedName = String(name || '').trim()
    const normalizedStatus = String(status || '').trim()
    let normalizedCode = String(code || '').trim()

    if (!id || !normalizedName || !normalizedStatus) {
      return res.status(400).json({
        success: false,
        message: 'ID, name, and status are required',
      })
    }

    const existingQuery = sql
      .select([
        Accounting.responsibility_center.selectOptionColumns.code,
        Accounting.responsibility_center.selectOptionColumns.name,
        Accounting.responsibility_center.selectOptionColumns.department,
        Accounting.responsibility_center.selectOptionColumns.status,
      ])
      .from(Accounting.responsibility_center.tablename)
      .where(Accounting.responsibility_center.selectOptionColumns.id)
      .build()

    const existingRows = await Query(
      existingQuery,
      [id],
      Accounting.responsibility_center.prefix_,
    )
    const old = existingRows[0] || {}

    if (!normalizedCode) {
      normalizedCode =
        old.code || (await generateResponsibilityCenterCode(normalizedName, id))
    }

    if (!normalizedCode) {
      return res.status(400).json({
        success: false,
        message: 'Responsibility center code could not be determined',
      })
    }

    const isDuplicateCode = await findResponsibilityCenterCodeDuplicate(
      normalizedCode,
      id,
    )
    if (isDuplicateCode) {
      return res.status(409).json({
        success: false,
        message:
          'A responsibility center code already exists. Please use a different code.',
      })
    }

    const updateQuery = sql
      .update(Accounting.responsibility_center.tablename)
      .set([
        Accounting.responsibility_center.selectOptionColumns.code,
        Accounting.responsibility_center.selectOptionColumns.name,
        Accounting.responsibility_center.selectOptionColumns.department,
        Accounting.responsibility_center.selectOptionColumns.status,
      ])
      .where(Accounting.responsibility_center.selectOptionColumns.id)
      .build()

    await Transaction([
      {
        sql: updateQuery,
        values: [normalizedCode, name, department || null, status, id],
      },
    ])

    const changes = []
    if (old.code !== normalizedCode) changes.push(`code='${normalizedCode}'`)
    if (old.name !== name) changes.push(`name='${name}'`)
    if (old.department !== department) changes.push(`department='${department}'`)
    if (old.status !== status) changes.push(`status='${status}'`)
    const changeDesc = changes.length > 0 ? changes.join(', ') : 'no changes'

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
        'RESPONSIBILITY_CENTER',
        req.context?.username || null,
        now.toISOString().split('T')[0],
        now.toTimeString().split(' ')[0],
        `UPDATE ID ${id}: ${changeDesc}`,
      ],
    })
    await Transaction(auditQueries)

    res.status(200).json({
      success: true,
      message: 'Responsibility center updated successfully',
      data: {
        id,
        code: normalizedCode,
        name,
        department,
        status,
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error updating responsibility center:', error)
    return res.status(500).json({
      success: false,
      message: 'Server error while updating responsibility center',
      error:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Internal server error',
    })
  }
}

const importResponsibilityCenters = async (req, res, next) => {
  try {
    const { centers } = req.body

    if (!Array.isArray(centers) || centers.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Centers array is required',
      })
    }

    const results = {
      created: [],
      updated: [],
      errors: [],
    }

    const now = new Date()
    const auditQueries = []

    for (const center of centers) {
      try {
        const { id, code, name, department, status } = center
        const normalizedName = String(name || '').trim()
        const normalizedStatus = String(status || 'ACTIVE').trim() || 'ACTIVE'
        let normalizedCode = String(code || '').trim()

        // Validate required fields
        if (!normalizedName) {
          results.errors.push({
            center,
            message: 'Missing required field (name)',
          })
          continue
        }

        if (!normalizedCode) {
          normalizedCode = await generateResponsibilityCenterCode(normalizedName)
        }

        // Check if center exists by ID or code
        let existingCenter = null
        if (id) {
          const existingQuery = sql
            .select([
              Accounting.responsibility_center.selectOptionColumns.id,
              Accounting.responsibility_center.selectOptionColumns.code,
              Accounting.responsibility_center.selectOptionColumns.name,
              Accounting.responsibility_center.selectOptionColumns.department,
              Accounting.responsibility_center.selectOptionColumns.status,
            ])
            .from(Accounting.responsibility_center.tablename)
            .where(Accounting.responsibility_center.selectOptionColumns.id)
            .build()
          const existingCenters = await Query(
            existingQuery,
            [id],
            Accounting.responsibility_center.prefix_,
          )
          existingCenter = existingCenters[0] || null
        }

        // If not found by ID, check by code
        if (!existingCenter) {
          const codeQuery = `SELECT ${Accounting.responsibility_center.selectOptionColumns.id}, ${Accounting.responsibility_center.selectOptionColumns.code}, ${Accounting.responsibility_center.selectOptionColumns.name}, ${Accounting.responsibility_center.selectOptionColumns.department}, ${Accounting.responsibility_center.selectOptionColumns.status} FROM ${Accounting.responsibility_center.tablename} WHERE UPPER(${Accounting.responsibility_center.selectOptionColumns.code}) = ? LIMIT 1`
          const codeResults = await Query(
            codeQuery,
            [normalizedCode.toUpperCase()],
            Accounting.responsibility_center.prefix_,
          )
          existingCenter = codeResults[0] || null
        }

        if (existingCenter) {
          // Update existing center
          const isDuplicateCode = await findResponsibilityCenterCodeDuplicate(
            normalizedCode,
            existingCenter.id,
          )
          if (isDuplicateCode) {
            results.errors.push({
              center,
              message: 'Responsibility center code already exists',
            })
            continue
          }

          const updateQuery = sql
            .update(Accounting.responsibility_center.tablename)
            .set([
              Accounting.responsibility_center.selectOptionColumns.code,
              Accounting.responsibility_center.selectOptionColumns.name,
              Accounting.responsibility_center.selectOptionColumns.department,
              Accounting.responsibility_center.selectOptionColumns.status,
            ])
            .where(Accounting.responsibility_center.selectOptionColumns.id)
            .build()

          await Transaction([
            {
              sql: updateQuery,
              values: [normalizedCode, name, department || null, status, existingCenter.id],
            },
          ])

          const changes = []
          if (existingCenter.code !== normalizedCode) changes.push(`code='${normalizedCode}'`)
          if (existingCenter.name !== name) changes.push(`name='${name}'`)
          if (existingCenter.department !== department) changes.push(`department='${department}'`)
          if (existingCenter.status !== status) changes.push(`status='${status}'`)
          const changeDesc = changes.length > 0 ? changes.join(', ') : 'no changes'

          auditQueries.push({
            sql: sql
              .insert(Master.audit_trail.tablename, {
                columns: Master.audit_trail.insertColumns,
                prefix: Master.audit_trail.prefix,
                isTransaction: true,
              })
              .build(),
            values: [
              existingCenter.id || null,
              'RESPONSIBILITY_CENTER',
              req.context?.username || null,
              now.toISOString().split('T')[0],
              now.toTimeString().split(' ')[0],
              `IMPORT UPDATE ID ${existingCenter.id}: ${changeDesc}`,
            ],
          })

          results.updated.push({
            id: existingCenter.id,
            code: normalizedCode,
            name,
          })
        } else {
          // Create new center
          const isDuplicateCode = await findResponsibilityCenterCodeDuplicate(normalizedCode)
          if (isDuplicateCode) {
            results.errors.push({
              center,
              message: 'Responsibility center code already exists',
            })
            continue
          }

          const queries = []
          queries.push({
            sql: sql
              .insert(Accounting.responsibility_center.tablename, {
                columns: Accounting.responsibility_center.insertColumns,
                prefix: Accounting.responsibility_center.prefix,
                isTransaction: true,
              })
              .build(),
            values: [
              normalizedCode || null,
              normalizedName || null,
              department || null,
              normalizedStatus || null,
            ],
          })

          await Transaction(queries)

          const getIdQuery = `SELECT LAST_INSERT_ID() as insertId`
          const idResult = await Query(getIdQuery)
          const newId = idResult[0]?.insertId

          if (!newId) {
            throw new Error('Failed to get responsibility center ID from insertion')
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
              newId || null,
              'RESPONSIBILITY_CENTER',
              req.context?.username || null,
              now.toISOString().split('T')[0],
              now.toTimeString().split(' ')[0],
              `IMPORT CREATE: ID ${newId}`,
            ],
          })

          results.created.push({
            id: newId,
            code: normalizedCode,
            name,
          })
        }
      } catch (error) {
        console.error('Error processing center:', center, error)
        results.errors.push({
          center,
          message: error.message || 'Failed to process center',
        })
      }
    }

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
    console.error('Error importing responsibility centers:', error)
    return res.status(500).json({
      success: false,
      message: 'Server error while importing responsibility centers',
      error:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Internal server error',
    })
  }
}

module.exports = {
  getResponsibilityCenters,
  createResponsibilityCenter,
  updateResponsibilityCenter,
  importResponsibilityCenters,
}
