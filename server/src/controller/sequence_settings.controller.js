const { Query } = require('../database/util/queries.util')
const { SQLQueryBuilder } = require('../util/helper.util')
const { Master } = require('../database/model/Master')
const { MODULE_CONFIG } = require('../util/sequence.util')

const sql = new SQLQueryBuilder()

const ALLOWED_ENTRY_MODULES = Object.keys(MODULE_CONFIG)
const ALLOWED_DATE_FORMATS = ['MMDDYY', 'YYMMDD', 'YYYYMMDD', '']

const sanitizePayload = (body) => {
  const module = String(body.module || '').trim()
  const prefix = String(body.prefix || '').trim().toUpperCase()
  const date_format = String(body.date_format || '').trim()
  let padding = parseInt(body.padding, 10)
  let next_sequence = parseInt(body.next_sequence, 10)

  if (!module || !ALLOWED_ENTRY_MODULES.includes(module)) {
    return { error: `Module must be one of: ${ALLOWED_ENTRY_MODULES.join(', ')}` }
  }
  if (!/^[A-Za-z0-9]{1,6}$/.test(prefix)) {
    return { error: 'Prefix must be 1-6 letters/numbers (no dashes)' }
  }
  if (!ALLOWED_DATE_FORMATS.includes(date_format)) {
    return { error: 'Date format must be empty, MMDDYY, YYMMDD, or YYYYMMDD' }
  }
  if (!Number.isInteger(padding) || padding < 1 || padding > 8) {
    return { error: 'Padding must be a whole number between 1 and 8' }
  }
  if (!Number.isInteger(next_sequence) || next_sequence < 1) {
    next_sequence = 1
  }

  return { value: { module, prefix, date_format, padding, next_sequence } }
}

const getSequenceSettings = async (req, res, next) => {
  try {
    const rows = await Query(
      `SELECT ${Master.sequence_settings.selectColumns.join(', ')}
       FROM ${Master.sequence_settings.tablename}
       ORDER BY ${Master.sequence_settings.prefix_}id`,
      [],
      [Master.sequence_settings.prefix_],
    )

    res.status(200).json({
      success: true,
      data: rows,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error fetching sequence settings:', error)
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching sequence settings',
      error:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Internal server error',
    })
  }
}

const createSequenceSetting = async (req, res, next) => {
  try {
    const { error, value } = sanitizePayload(req.body)
    if (error) {
      return res.status(400).json({ success: false, message: error })
    }

    const [existing] = await Query(
      `SELECT ${Master.sequence_settings.selectOptionColumns.id}
       FROM ${Master.sequence_settings.tablename}
       WHERE ${Master.sequence_settings.selectOptionColumns.module} = ? LIMIT 1`,
      [value.module],
    )

    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'A sequence already exists for this module',
      })
    }

    await Query(
      sql
        .insert(Master.sequence_settings.tablename, {
          columns: Master.sequence_settings.insertColumns,
          prefix: Master.sequence_settings.prefix,
        })
        .build(),
      [
        value.module,
        value.prefix,
        value.date_format,
        value.padding,
        value.next_sequence,
      ],
    )

    const [created] = await Query(
      `SELECT ${Master.sequence_settings.selectColumns.join(', ')}
       FROM ${Master.sequence_settings.tablename}
       WHERE ${Master.sequence_settings.selectOptionColumns.module} = ? LIMIT 1`,
      [value.module],
      [Master.sequence_settings.prefix_],
    )

    res.status(201).json({
      success: true,
      message: 'Sequence created successfully',
      data: created,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error creating sequence setting:', error)
    return res.status(500).json({
      success: false,
      message: 'Server error while creating sequence setting',
      error:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Internal server error',
    })
  }
}

const updateSequenceSetting = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10)
    if (!Number.isInteger(id)) {
      return res.status(400).json({ success: false, message: 'Invalid sequence id' })
    }

    const { error, value } = sanitizePayload({ ...req.body, module: req.body.module })
    if (error) {
      return res.status(400).json({ success: false, message: error })
    }

    const [existing] = await Query(
      `SELECT ${Master.sequence_settings.selectOptionColumns.id}
       FROM ${Master.sequence_settings.tablename}
       WHERE ${Master.sequence_settings.selectOptionColumns.id} = ? LIMIT 1`,
      [id],
    )

    if (!existing) {
      return res.status(404).json({ success: false, message: 'Sequence not found' })
    }

    // Module stays fixed on update: sequence rows are per-module identity,
    // editing is about the id format, not which document it belongs to.
    await Query(
      `UPDATE ${Master.sequence_settings.tablename}
       SET ${Master.sequence_settings.selectOptionColumns.prefix} = ?,
           ${Master.sequence_settings.selectOptionColumns.date_format} = ?,
           ${Master.sequence_settings.selectOptionColumns.padding} = ?,
           ${Master.sequence_settings.selectOptionColumns.next_sequence} = ?
       WHERE ${Master.sequence_settings.selectOptionColumns.id} = ?`,
      [value.prefix, value.date_format, value.padding, value.next_sequence, id],
    )

    const [updated] = await Query(
      `SELECT ${Master.sequence_settings.selectColumns.join(', ')}
       FROM ${Master.sequence_settings.tablename}
       WHERE ${Master.sequence_settings.selectOptionColumns.id} = ? LIMIT 1`,
      [id],
      [Master.sequence_settings.prefix_],
    )

    res.status(200).json({
      success: true,
      message: 'Sequence updated successfully',
      data: updated,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error updating sequence setting:', error)
    return res.status(500).json({
      success: false,
      message: 'Server error while updating sequence setting',
      error:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Internal server error',
    })
  }
}

module.exports = {
  getSequenceSettings,
  createSequenceSetting,
  updateSequenceSetting,
}
