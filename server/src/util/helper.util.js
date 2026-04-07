const os = require('os') // <--- Required to get network interfaces

const DataModeling = (data, prefixes) => {
  const prefixArray = Array.isArray(prefixes) ? prefixes : [prefixes]

  return data.map((item) => {
    const newObject = {}

    for (const key in item) {
      if (Object.prototype.hasOwnProperty.call(item, key)) {
        let newKey = key
        let prefixFound = false

        // Try each prefix until we find a match
        for (const prefix of prefixArray) {
          if (key.startsWith(prefix)) {
            newKey = key.replace(prefix, '')
            prefixFound = true
            break
          }
        }

        // If no prefix matched, keep original key
        if (!prefixFound) {
          newKey = key
        }

        newObject[newKey] = item[key]
      }
    }
    return newObject
  })
}

// Enhanced Query function
exports.Query = async (sql, params = [], prefixes) => {
  try {
    const [result] = await pool.query(sql, params)

    if (sql.trim().toUpperCase().startsWith('INSERT')) {
      return { ...result, insertId: result.insertId }
    }

    if (prefixes && sql.trim().toUpperCase().startsWith('SELECT')) {
      const data = DataModeling(result, prefixes)
      return data
    }

    return result
  } catch (error) {
    logger.error(error)
    console.error('Error executing query:', error)
    throw error
  }
}

/**
 * Helper function to convert bytes to a human-readable format (MB, GB).
 * @param {number} bytes - The number of bytes to convert.
 * @returns {string} - Formatted string (e.g., "72.8 MB").
 */
const formatBytes = (bytes) => {
  // Defined as a local function 'const'
  if (bytes === 0) {
    return '0 Bytes'
  }
  const k = 1024
  const dm = 1 // Decimal places
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
}

/**
 * Helper function to format all memory usage metrics from bytes to MB/GB.
 * @param {object} memoryUsage - The object returned by process.memoryUsage().
 * @returns {object} - An object with memory metrics formatted as strings.
 */
const formatMemoryUsage = (memoryUsage) => {
  return {
    rss: formatBytes(memoryUsage.rss),
    heapTotal: formatBytes(memoryUsage.heapTotal),
    heapUsed: formatBytes(memoryUsage.heapUsed),
    external: formatBytes(memoryUsage.external),
    arrayBuffers: formatBytes(memoryUsage.arrayBuffers),
  }
}

/**
 * Transforms the nested Master object into a flat, query-friendly schema.
 * * @param {object} masterConfig - The complete Master model definition.
 * @returns {object} A simplified object for query construction (e.g., M.master_user.usercode).
 */
const createQuerySchema = (masterConfig) => {
  const schema = {}

  for (const modelName in masterConfig) {
    const model = masterConfig[modelName]

    // Create a new object for the model (e.g., schema.master_user)
    schema[modelName] = {
      // 1. Spread all columns from selectOptionColumns for direct access
      ...model.selectOptionColumns,

      // 2. Keep the table name for .from() and .innerJoin() calls
      _table: model.tablename,

      // 3. Keep the column prefix for potential aliasing (optional)
      _prefix: model.prefix,
    }
  }
  return schema
}

/**
 * Helper function to convert seconds to HH:MM:SS format.
 * @param {number} seconds - The number of seconds (e.g., from process.uptime()).
 * @returns {string} - Formatted string (e.g., "00:14:55").
 */
const formatTime = (seconds) => {
  const totalSeconds = Math.floor(seconds)

  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const secs = totalSeconds % 60

  const pad = (num) => num.toString().padStart(2, '0')

  return `${pad(hours)}:${pad(minutes)}:${pad(secs)}`
}

class SQLQueryBuilder {
  constructor() {
    this.reset()
  }

  reset() {
    this.query = {
      type: null,
      columns: [],
      table: '',
      values: [],
      joins: [],
      where: [],
      whereNot: [],
      set: [],
      orderBy: [],
      prefix: null,
      isTransaction: false,
    }
    return this
  }

  // --- SELECT OPERATIONS ---
  select(columns) {
    this.query.type = 'SELECT'

    const cols = Array.isArray(columns) ? columns : [columns]

    this.query.columns = cols.map((col) => {
      if (typeof col === 'object' && col !== null && col.col && col.as) {
        return `${col.col} AS ${col.as}`
      }
      return col
    })

    return this
  }

  selectAll() {
    this.query.type = 'SELECT'
    this.query.columns = ['*']
    return this
  }

  // --- ORDER BY OPERATIONS (NEW) ---

  orderBy(column, direction = 'ASC') {
    this.query.orderBy.push(`${column} ${direction.toUpperCase()}`)
    return this
  }

  orderByDesc(column) {
    return this.orderBy(column, 'DESC')
  }

  // INSERT operations
  insert(table, options = {}) {
    this.query.type = 'INSERT'
    this.query.table = table
    this.query.prefix = options.prefix || null
    this.query.isTransaction = options.isTransaction || false
    this.query.columns = options.columns || []
    return this
  }

  values(values) {
    this.query.values = values
    return this
  }

  // UPDATE operations
  update(table, options = {}) {
    this.query.type = 'UPDATE'
    this.query.table = table
    this.query.prefix = options.prefix || null
    this.query.columns = options.columns || []
    return this
  }

  set(columns) {
    this.query.set = Array.isArray(columns) ? columns : [columns]
    return this
  }

  // DELETE operation
  delete(table) {
    this.query.type = 'DELETE'
    this.query.table = table
    return this
  }

  // FROM clause
  from(table) {
    this.query.table = table
    return this
  }

  // JOIN clauses
  innerJoin(table, primary, secondary, condition = '=') {
    this.query.joins.push({ type: 'INNER', table, primary, secondary, condition })
    return this
  }

  leftJoin(table, primary, secondary, condition = '=') {
    this.query.joins.push({ type: 'LEFT', table, primary, secondary, condition })
    return this
  }

  rightJoin(table, primary, secondary, condition = '=') {
    this.query.joins.push({ type: 'RIGHT', table, primary, secondary, condition })
    return this
  }

  // WHERE clauses
  where(conditions) {
    this.query.where = Array.isArray(conditions) ? conditions : [conditions]
    return this
  }

  whereNot(conditions) {
    this.query.whereNot = Array.isArray(conditions) ? conditions : [conditions]
    return this
  }

  whereIn(column, values) {
    this.query.where.push({ column, values, operator: 'IN' })
    return this
  }

  andWhere(condition) {
    this.query.where.push(condition)
    return this
  }

  andWhereNot(condition) {
    this.query.whereNot.push(condition)
    return this
  }

  // --- BUILDER LOGIC ---

  build() {
    try {
      switch (this.query.type) {
        case 'SELECT':
          return this.buildSelect()
        case 'INSERT':
          return this.buildInsert()
        case 'UPDATE':
          return this.buildUpdate()
        case 'DELETE':
          return this.buildDelete()
        default:
          throw new Error('Query type not specified')
      }
    } finally {
      this.reset()
    }
  }

  buildSelect() {
    if (!this.query.table) throw new Error('FROM table is required for SELECT')

    const columns = this.query.columns.join(', ')
    let query = `SELECT ${columns} FROM ${this.query.table}`

    // Add JOINs
    this.query.joins.forEach(({ type, table, primary, secondary, condition }) => {
      query += ` ${type} JOIN ${table} ON ${primary} ${condition} ${secondary}`
    })

    // Build WHERE conditions
    const whereConditions = []

    if (this.query.where.length > 0) {
      const whereClause = this.query.where
        .map((cond) => this._formatCondition(cond))
        .join(' AND ')
      whereConditions.push(whereClause)
    }

    if (this.query.whereNot.length > 0) {
      const whereNotClause = this.query.whereNot
        .map((cond) => this._formatCondition(cond, true))
        .join(' AND ')
      whereConditions.push(whereNotClause)
    }

    if (whereConditions.length > 0) {
      query += ` WHERE ${whereConditions.join(' AND ')}`
    }

    // NEW: Add ORDER BY
    if (this.query.orderBy.length > 0) {
      query += ` ORDER BY ${this.query.orderBy.join(', ')}`
    }

    return query
  }

  // Helper to DRY up condition formatting
  _formatCondition(cond, isNot = false) {
    // Handle object conditions (from whereIn, whereNot, etc.)
    if (typeof cond === 'object' && cond !== null) {
      const { column, values, operator } = cond;
      
      if (operator === 'IN') {
        const placeholders = values.map(() => '?').join(', ');
        return `${column} IN (${placeholders})`;
      }
      
      // Handle other operators for objects
      const operators = ['=', '!=', '<>', '<', '>', ' LIKE ', ' IS '];
      const op = operator || (isNot ? '!=' : '=');
      return `${column} ${op} ?`;
    }
    
    // Handle string conditions (legacy)
    const operators = ['=', '!=', '<>', '<', '>', ' LIKE ', ' IN ', ' IS ']
    const hasOperator = operators.some((op) => cond.includes(op))

    if (hasOperator) return cond

    // Default behavior for strings
    return isNot ? `${cond} != ?` : `${cond} = ?`
  }

  // ... [buildInsert, buildUpdate, buildDelete from your original code] ...
  buildInsert() {
    if (!this.query.table) throw new Error('Table name is required for INSERT')
    if (this.query.columns.length === 0)
      throw new Error('Columns are required for INSERT')

    const prefix = this.query.prefix ? `${this.query.prefix}_` : ''
    const columns = this.query.columns.map((col) => `${prefix}${col}`).join(', ')

    if (this.query.isTransaction) {
      const placeholders = this.query.columns.map(() => '?').join(', ')
      return `INSERT INTO ${this.query.table}(${columns}) VALUES (${placeholders})`
    } else {
      return `INSERT INTO ${this.query.table}(${columns}) VALUES ?`
    }
  }

  buildUpdate() {
    if (!this.query.table) throw new Error('Table name is required for UPDATE')
    if (this.query.set.length === 0)
      throw new Error('SET columns are required for UPDATE')
    if (this.query.where.length === 0 && this.query.whereNot.length === 0) {
      throw new Error('WHERE conditions are required for UPDATE')
    }

    const prefix = this.query.prefix ? `${this.query.prefix}_` : ''
    const setClause = this.query.set.map((col) => `${prefix}${col} = ?`).join(', ')

    // Build WHERE conditions for UPDATE
    const whereConditions = []

    if (this.query.where.length > 0) {
      const whereClause = this.query.where
        .map((cond) => this._formatCondition(cond))
        .join(' AND ')
      whereConditions.push(whereClause)
    }

    if (this.query.whereNot.length > 0) {
      const whereNotClause = this.query.whereNot
        .map((cond) => this._formatCondition(cond, true))
        .join(' AND ')
      whereConditions.push(whereNotClause)
    }

    const whereClause = whereConditions.join(' AND ')

    return `UPDATE ${this.query.table} SET ${setClause} WHERE ${whereClause}`
  }

  buildDelete() {
    if (!this.query.table) throw new Error('Table name is required for DELETE')
    if (this.query.where.length === 0 && this.query.whereNot.length === 0) {
      throw new Error('WHERE conditions are required for DELETE')
    }

    const whereConditions = []

    if (this.query.where.length > 0) {
      const whereClause = this.query.where
        .map((cond) => this._formatCondition(cond))
        .join(' AND ')
      whereConditions.push(whereClause)
    }

    if (this.query.whereNot.length > 0) {
      const whereNotClause = this.query.whereNot
        .map((cond) => this._formatCondition(cond, true))
        .join(' AND ')
      whereConditions.push(whereNotClause)
    }

    const whereClause = whereConditions.join(' AND ')

    return `DELETE FROM ${this.query.table} WHERE ${whereClause}`
  }
}

module.exports = {
  DataModeling,
  formatBytes,
  formatMemoryUsage,
  formatTime,
  createQuerySchema,
  SQLQueryBuilder,
}
