const mysql = require('mysql2/promise')
const { DecryptString } = require('../../util/cryptography.util')

/**
 * A pool for the admin database, which is where subscription state lives.
 *
 * The rest of the accounting server talks to a tenant database, chosen per
 * request through getTenantPool(). Subscription data is the exception: it is
 * held once in the admin database and deliberately not copied into tenants,
 * because MySQL cannot express a foreign key across databases and because a plan
 * change would otherwise have to be fanned out to every tenant.
 *
 * A single pool is created lazily and reused. It is not tenant-scoped and holds
 * no per-request state, so unlike the config-level tenant override it is safe to
 * share across concurrent requests.
 *
 * Declared explicitly rather than left to the driver default: without a
 * charset, mysql2 sends string parameters in a way MySQL reads as
 * `CHARACTER SET 'binary'`, and a JSON column then refuses the assignment with
 * "Cannot create a JSON value from a string with CHARACTER SET 'binary'".
 */
let adminPool = null

const getAdminPool = () => {
  if (adminPool) return adminPool
  adminPool = mysql.createPool({
    host: process.env._HOST_ADMIN,
    user: process.env._USER_ADMIN,
    password: DecryptString(process.env._PASSWORD_ADMIN),
    database: process.env._DATABASE_ADMIN,
    multipleStatements: true,
    charset: 'utf8mb4',
    decimalNumbers: false,
    supportBigNumbers: true,
    bigNumberStrings: true,
  })
  return adminPool
}

/** Run a query against the admin database. Returns the raw result set. */
const adminQuery = async (sql, params = []) => {
  const pool = getAdminPool()
  const [rows] = await pool.query(sql, params)
  return rows
}

/** Run a write against the admin database. Returns { insertId, affectedRows }. */
const adminExecute = async (sql, params = []) => {
  const pool = getAdminPool()
  const [result] = await pool.execute(sql, params)
  return result
}

/** Close the pool. Used by shutdown paths and tests. */
const closeAdminPool = async () => {
  if (!adminPool) return
  await adminPool.end()
  adminPool = null
}

module.exports = {
  getAdminPool,
  adminQuery,
  adminExecute,
  closeAdminPool,
}