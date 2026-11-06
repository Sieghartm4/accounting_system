/**
 * Shared document-number generator.
 *
 * Every transaction module used to inline the same block: build
 * `PREFIX-MMDDYY-`, SELECT the newest id starting with that prefix, parse the
 * trailing digits, +1. The prefix/date-format/padding are now editable per
 * company through the Masters sequence settings (table `sequence_settings`),
 * so all seven generators funnel through here instead.
 *
 * Defaults reproduce the legacy output exactly (`CR-MMDDYY-0004` style), and
 * if the settings table is not migrated yet on a tenant the lookup falls
 * back to those defaults rather than failing the create.
 */
const MODULE_CONFIG = {
  receipts: { tablename: 'receipts', idColumn: 'r_id', fallbackPrefix: 'CR' },
  disbursements: { tablename: 'cash_disbursements', idColumn: 'cd_id', fallbackPrefix: 'CD' },
  sales: { tablename: 'sales', idColumn: 's_id', fallbackPrefix: 'SO' },
  collections: { tablename: 'collections', idColumn: 'c_id', fallbackPrefix: 'CL' },
  purchase: { tablename: 'purchase', idColumn: 'p_id', fallbackPrefix: 'PO' },
  payments: { tablename: 'payments', idColumn: 'c_id', fallbackPrefix: 'PM' },
  adjustments: { tablename: 'adjustments', idColumn: 'a_id', fallbackPrefix: 'JV' },
}

const DATE_FORMATS = ['MMDDYY', 'YYMMDD', 'YYYYMMDD']

const buildDatePart = (format, now) => {
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  const yy = String(now.getFullYear()).slice(-2)
  const yyyy = String(now.getFullYear())

  switch (format) {
    case 'MMDDYY':
      return `${mm}${dd}${yy}`
    case 'YYMMDD':
      return `${yy}${mm}${dd}`
    case 'YYYYMMDD':
      return `${yyyy}${mm}${dd}`
    default:
      // '' = no date group: the running number is continuous
      return null
  }
}

const getSequenceSettings = async (connection, module) => {
  const fallback = {
    prefix: MODULE_CONFIG[module].fallbackPrefix,
    date_format: 'MMDDYY',
    padding: 4,
    next_sequence: 1,
  }

  try {
    const [rows] = await connection.execute(
      `SELECT ss_prefix, ss_date_format, ss_padding, ss_next_sequence
       FROM sequence_settings WHERE ss_module = ? LIMIT 1`,
      [module],
    )
    if (!rows || rows.length === 0) return fallback

    const row = rows[0]
    return {
      prefix: row.ss_prefix || fallback.prefix,
      date_format: DATE_FORMATS.includes(row.ss_date_format) ? row.ss_date_format : '',
      padding: Math.min(Math.max(parseInt(row.ss_padding, 10) || 4, 1), 8),
      next_sequence: Math.max(parseInt(row.ss_next_sequence, 10) || 1, 1),
    }
  } catch (error) {
    // Settings table not provisioned yet on this tenant - behave like legacy.
    if (error && error.code !== 'ER_NO_SUCH_TABLE') {
      console.error(`sequence settings lookup failed for ${module}:`, error.message)
    }
    return fallback
  }
}

/**
 * Generates the next document id for a module, e.g. `CR-110326-0004`.
 *
 * @param {object} connection mysql2 tenant connection/pool already running the caller's transaction
 * @param {keyof typeof MODULE_CONFIG} module
 * @param {Date} [now]
 * @returns {Promise<string>}
 */
const generateDocumentId = async (connection, module, now = new Date()) => {
  const config = MODULE_CONFIG[module]
  if (!config) throw new Error(`Unknown sequence module: ${module}`)

  const settings = await getSequenceSettings(connection, module)

  const datePart = buildDatePart(settings.date_format, now)
  // A literal `_`/`%` in a prefix would broaden the LIKE match; escape them.
  const likePrefix = `${settings.prefix}-${datePart ? datePart : ''}-`
    .replace(/[_%]/g, (char) => `\\${char}`)

  const [existing] = await connection.execute(
    `SELECT ${config.idColumn} FROM ${config.tablename}
     WHERE ${config.idColumn} LIKE ? ORDER BY ${config.idColumn} DESC LIMIT 1`,
    [`${likePrefix}%`],
  )

  let seq = settings.next_sequence
  const lastId = existing?.[0]?.[config.idColumn]
  if (lastId) {
    const lastSeq = parseInt(String(lastId).split('-').pop(), 10)
    if (!Number.isNaN(lastSeq)) seq = lastSeq + 1
  }

  return `${settings.prefix}-${datePart ? `${datePart}-` : ''}${String(seq).padStart(
    settings.padding,
    '0',
  )}`
}

module.exports = { MODULE_CONFIG, generateDocumentId }
