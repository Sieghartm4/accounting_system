const os = require('os')
const { checkConnection, SelectAll, Query, Transaction } = require('../database/util/queries.util')
const { formatMemoryUsage, formatTime, DataModeling } = require('../util/helper.util')
const { Master } = require('../database/model/Master')
const { SQLQueryBuilder } = require('../util/helper.util')
const sql = new SQLQueryBuilder()
const mysql = require('mysql2/promise')
const CONFIG = require('../database/config/config')
const { Encrypter } = require('../util/cryptography.util')

const pool = mysql.createPool({
  host: CONFIG[process.env.NODE_ENV].host,
  user: CONFIG[process.env.NODE_ENV].username,
  password: CONFIG[process.env.NODE_ENV].password,
  database: CONFIG[process.env.NODE_ENV].database,
  multipleStatements: CONFIG[process.env.NODE_ENV].dialectOptions.multipleStatements,
})

require('dotenv').config()

const fetchTenantFullnames = async (dbName, usernames) => {
  const fullnames = new Map()
  if (!dbName || !/^[A-Za-z0-9_]+$/.test(dbName) || usernames.length === 0) {
    return fullnames
  }

  const cfg = CONFIG[process.env.NODE_ENV]
  let connection
  try {
    connection = await mysql.createConnection({
      host: cfg.host,
      user: cfg.username,
      password: cfg.password,
      database: dbName,
      multipleStatements: false,
    })

    const placeholders = usernames.map(() => '?').join(',')
    const [rows] = await connection.execute(
      `SELECT mu_username, mu_fullname FROM master_user WHERE mu_username IN (${placeholders})`,
      usernames,
    )

    for (const row of rows) {
      fullnames.set(String(row.mu_username || '').toLowerCase(), row.mu_fullname || '')
    }
  } catch (error) {
    console.error(`Error fetching full names from ${dbName}:`, error.message)
  } finally {
    if (connection) await connection.end()
  }
  return fullnames
}

const getTenantConnection = async (dbName) => {
  if (!dbName || !/^[A-Za-z0-9_]+$/.test(dbName)) return null
  const cfg = CONFIG[process.env.NODE_ENV]
  return mysql.createConnection({
    host: cfg.host,
    user: cfg.username,
    password: cfg.password,
    database: dbName,
    multipleStatements: false,
  })
}

const hasColumn = async (connection, schema, table, column) => {
  const [rows] = await connection.execute(
    `SELECT COUNT(*) AS column_exists
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [schema, table, column],
  )
  return Number(rows[0].column_exists) > 0
}

const encryptPassword = (password) =>
  new Promise((resolve, reject) => {
    Encrypter(password, (error, encrypted) => {
      if (error) reject(error)
      else resolve(encrypted)
    })
  })

const getUsers = async (req, res, next) => {
  let connection
  try {
    connection = await pool.getConnection()

    // The effective plan is the COMPANY's, not the per-user pointer.
    //
    // `master_user.subscription_id` is the legacy column and is not what
    // authorisation reads: the accounting server resolves modules from
    // master_company_subscription, keyed by db_name. Showing the legacy value
    // here could display a plan the company is not actually on - or "No
    // Subscription" for a company whose modules are fully enabled.
    //
    // The legacy value is still returned, under its own key, so the admin can
    // see when the two disagree instead of one silently overwriting the other.
    const query = `
      SELECT
        mu.mu_id as id,
        mu.mu_username as username,
        mu.db_name as db_name,
        mu.mu_email as email,
        mu.mu_status as status,
        mu.mu_role as role,
        mu.subscription_id as legacy_subscription_id,
        mcs.mcs_plan_id as plan_id,
        sp.sp_name as subscription_plan_name,
        sp.sp_code as subscription_plan_code,
        sp.sp_status as subscription_plan_status,
        mcs.mcs_status as company_subscription_status,
        mcs.mcs_max_users as max_users
      FROM master_user mu
      LEFT JOIN master_company_subscription mcs ON mcs.mcs_db_name = mu.db_name
      LEFT JOIN subscription_plans sp ON sp.sp_id = mcs.mcs_plan_id
      ORDER BY mu.mu_id ASC
    `

    const [users] = await connection.execute(query)

    // Full names live in each tenant's own master_user table, not in the
    // subscription database. Resolve them per db_name so the admin sees the
    // real name instead of just the username.
    const usersByDb = new Map()
    for (const user of users) {
      if (!user.db_name || !user.username) continue
      if (!usersByDb.has(user.db_name)) usersByDb.set(user.db_name, [])
      usersByDb.get(user.db_name).push(user.username)
    }

    const fullnames = new Map()
    for (const [dbName, usernames] of usersByDb) {
      const dbFullnames = await fetchTenantFullnames(dbName, [...new Set(usernames)])
      for (const [username, fullname] of dbFullnames) {
        fullnames.set(`${dbName}:${username}`, fullname)
      }
    }

    // Modules per distinct plan, in one query, so the admin can see what each
    // company actually has rather than inferring it from the plan name.
    const planIds = [...new Set(users.map((u) => u.plan_id).filter((id) => id !== null && id !== undefined))]
    const modulesByPlan = new Map()
    if (planIds.length) {
      const placeholders = planIds.map(() => '?').join(',')
      const [moduleRows] = await connection.execute(
        `SELECT pm_plan_id, pm_module FROM plan_modules
          WHERE pm_plan_id IN (${placeholders}) ORDER BY pm_module`,
        planIds,
      )
      for (const row of moduleRows) {
        if (!modulesByPlan.has(row.pm_plan_id)) modulesByPlan.set(row.pm_plan_id, [])
        modulesByPlan.get(row.pm_plan_id).push(row.pm_module)
      }
    }

    const withModules = users.map((u) => ({
      ...u,
      fullname:
        fullnames.get(`${u.db_name}:${String(u.username || '').toLowerCase()}`) || '',
      // Kept for the existing UI which reads subscription_id.
      subscription_id: u.plan_id ?? null,
      modules: u.plan_id ? modulesByPlan.get(u.plan_id) || [] : [],
    }))

    res.status(200).json({
      success: true,
      message: 'Users retrieved successfully',
      data: withModules,
      count: withModules.length,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error fetching users:', error)
    return res.status(500).json({ 
      success: false,
      message: 'Server error while fetching users',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    })
  } finally {
    if (connection) {
      connection.release()
    }
  }
}

const updateUser = async (req, res, next) => {
  const { id } = req.params
  const { username, fullname, email, role, password, status } = req.body

  let subscriptionConnection
  let tenantConnection
  let subscriptionTransaction = false
  let tenantTransaction = false
  let tenantCommitted = false
  let previousTenant = null
  let tenantDbName = null
  let tenantHasRole = false

  const rollbackBoth = async () => {
    if (tenantTransaction) {
      await tenantConnection.rollback()
      tenantTransaction = false
    }
    if (subscriptionTransaction) {
      await subscriptionConnection.rollback()
      subscriptionTransaction = false
    }
  }

  try {
    if (!/^\d+$/.test(String(id))) {
      return res.status(400).json({ success: false, message: 'Invalid user id' })
    }

    const nextUsername = String(username || '').trim()
    const nextFullname = String(fullname || '').trim() || nextUsername
    const nextEmail = String(email || '').trim() || null
    const nextRole = String(role || '').toUpperCase()
    const nextStatus = String(status || '').toLowerCase()
    const nextPassword = password ? await encryptPassword(String(password)) : null

    if (!nextUsername) {
      return res.status(400).json({
        success: false,
        message: 'Username is required',
      })
    }
    if (!['ADMIN', 'USER'].includes(nextRole)) {
      return res.status(400).json({ success: false, message: 'Invalid role' })
    }
    if (!['active', 'inactive'].includes(nextStatus)) {
      return res.status(400).json({ success: false, message: 'Invalid status' })
    }

    subscriptionConnection = await pool.getConnection()
    await subscriptionConnection.beginTransaction()
    subscriptionTransaction = true

    const [currentUsers] = await subscriptionConnection.execute(
      `SELECT mu_id, mu_username, mu_email, mu_role, mu_status, mu_password, db_name
       FROM master_user WHERE mu_id = ? FOR UPDATE`,
      [id],
    )

    if (currentUsers.length === 0) {
      await rollbackBoth()
      return res.status(404).json({ success: false, message: 'User not found' })
    }

    const currentUser = currentUsers[0]

    const [subscriptionDuplicates] = await subscriptionConnection.execute(
      'SELECT mu_id FROM master_user WHERE mu_username = ? AND mu_id <> ?',
      [nextUsername, id],
    )

    if (subscriptionDuplicates.length > 0) {
      await rollbackBoth()
      return res.status(409).json({ success: false, message: 'Username already exists' })
    }

    tenantDbName = currentUser.db_name
    tenantConnection = await getTenantConnection(tenantDbName)

    if (tenantConnection) {
      tenantHasRole = await hasColumn(
        tenantConnection,
        tenantDbName,
        'master_user',
        'mu_role',
      )
      await tenantConnection.beginTransaction()
      tenantTransaction = true

      const [tenantUsers] = await tenantConnection.execute(
        'SELECT * FROM master_user WHERE mu_username = ? LIMIT 2',
        [currentUser.mu_username],
      )

      if (tenantUsers.length === 0) {
        await rollbackBoth()
        return res.status(404).json({
          success: false,
          message: `User not found in company database ${tenantDbName}`,
        })
      }
      if (tenantUsers.length > 1) {
        await rollbackBoth()
        return res.status(409).json({
          success: false,
          message: `Multiple matching users found in company database ${tenantDbName}`,
        })
      }

      previousTenant = tenantUsers[0]
      const tenantId = previousTenant.mu_id

      const [tenantDuplicates] = await tenantConnection.execute(
        'SELECT mu_id FROM master_user WHERE mu_username = ? AND mu_id <> ?',
        [nextUsername, tenantId],
      )

      if (tenantDuplicates.length > 0) {
        await rollbackBoth()
        return res.status(409).json({ success: false, message: 'Username already exists in company database' })
      }

      const tenantSets = [
        'mu_username = ?',
        'mu_fullname = ?',
        'mu_email = ?',
        'mu_status = ?',
      ]
      const tenantValues = [
        nextUsername,
        nextFullname,
        nextEmail,
        nextStatus,
      ]

      if (nextPassword) {
        tenantSets.push('mu_password = ?')
        tenantValues.push(nextPassword)
      }
      if (tenantHasRole) {
        tenantSets.push('mu_role = ?')
        tenantValues.push(nextRole)
      }
      tenantValues.push(tenantId)

      await tenantConnection.execute(
        `UPDATE master_user SET ${tenantSets.join(', ')} WHERE mu_id = ?`,
        tenantValues,
      )
    }

    const subscriptionSets = [
      'mu_username = ?',
      'mu_email = ?',
      'mu_status = ?',
      'mu_role = ?',
    ]
    const subscriptionValues = [
      nextUsername,
      nextEmail,
      nextStatus,
      nextRole,
    ]

    if (nextPassword) {
      subscriptionSets.push('mu_password = ?')
      subscriptionValues.push(nextPassword)
    }
    subscriptionValues.push(id)

    await subscriptionConnection.execute(
      `UPDATE master_user SET ${subscriptionSets.join(', ')} WHERE mu_id = ?`,
      subscriptionValues,
    )

    if (tenantTransaction) {
      await tenantConnection.commit()
      tenantTransaction = false
      tenantCommitted = true
    }

    try {
      await subscriptionConnection.commit()
      subscriptionTransaction = false
    } catch (commitError) {
      if (tenantCommitted && previousTenant && tenantDbName) {
        try {
          const restoreConnection = await getTenantConnection(tenantDbName)
          if (restoreConnection) {
            await restoreConnection.beginTransaction()
            const restoreSets = [
              'mu_username = ?',
              'mu_fullname = ?',
              'mu_email = ?',
              'mu_status = ?',
              'mu_password = ?',
            ]
            const restoreValues = [
              previousTenant.mu_username,
              previousTenant.mu_fullname,
              previousTenant.mu_email,
              previousTenant.mu_status,
              previousTenant.mu_password,
            ]
            if (tenantHasRole) {
              restoreSets.push('mu_role = ?')
              restoreValues.push(previousTenant.mu_role)
            }
            restoreValues.push(previousTenant.mu_id)
            await restoreConnection.execute(
              `UPDATE master_user SET ${restoreSets.join(', ')} WHERE mu_id = ?`,
              restoreValues,
            )
            await restoreConnection.commit()
            await restoreConnection.end()
          }
        } catch (restoreError) {
          console.error('Failed to roll back tenant user update:', restoreError)
        }
      }
      throw commitError
    }

    res.status(200).json({
      success: true,
      message: 'User updated successfully',
      data: {
        id: Number(id),
        username: nextUsername,
        fullname: tenantCommitted ? nextFullname : '',
        email: nextEmail,
        role: nextRole,
        status: nextStatus,
        company_database_updated: tenantCommitted,
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    try {
      await rollbackBoth()
    } catch (rollbackError) {
      console.error('Failed to roll back user update:', rollbackError)
    }
    console.error('Error updating user:', error)
    return res.status(500).json({
      success: false,
      message: 'Server error while updating user',
      error:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Internal server error',
    })
  } finally {
    if (tenantConnection) await tenantConnection.end()
    if (subscriptionConnection) subscriptionConnection.release()
  }
}

const updateUserSubscription = async (req, res, next) => {
  let connection
  try {
    const { id } = req.params
    const { subscription_id } = req.body

    connection = await pool.getConnection()
    await connection.beginTransaction()

    try {
      // Get current user subscription
      const [currentUser] = await connection.execute(
        'SELECT subscription_id FROM master_user WHERE mu_id = ?',
        [id]
      )

      if (currentUser.length === 0) {
        await connection.rollback()
        return res.status(404).json({
          success: false,
          message: 'User not found'
        })
      }

      const currentSubscriptionId = currentUser[0].subscription_id

      // If changing subscription, expire the old one in subscription_history
      if (currentSubscriptionId && currentSubscriptionId !== subscription_id) {
        await connection.execute(
          `UPDATE subscription_history
           SET sh_end_date = NOW(), sh_status = 'expired'
           WHERE sh_mu_id = ? AND sh_subscription_id = ? AND sh_status = 'active'`,
          [id, currentSubscriptionId]
        )
      }

      // Update user's subscription_id
      await connection.execute(
        'UPDATE master_user SET subscription_id = ? WHERE mu_id = ?',
        [subscription_id, id]
      )

      // If new subscription is provided, add entry to subscription_history
      if (subscription_id) {
        // Get plan details and billing cycle from plan items
        const [plan] = await connection.execute(
          'SELECT sp_name FROM subscription_plans WHERE sp_id = ?',
          [subscription_id]
        )

        const [planItems] = await connection.execute(
          `SELECT spi_details FROM subscription_plan_items
           WHERE spi_subscription_plan_id = ? AND spi_type = 'BILLING_CYCLE'
           ORDER BY spi_display_order ASC LIMIT 1`,
          [subscription_id]
        )

        let billingCycle = '30 days'
        let billingDays = 30

        if (planItems.length > 0) {
          billingCycle = planItems[0].spi_details
          // Parse billing cycle to get days
          if (billingCycle.includes('365')) {
            billingDays = 365
            billingCycle = '1 year'
          } else if (billingCycle.includes('30')) {
            billingDays = 30
            billingCycle = '1 month'
          } else if (billingCycle.includes('7')) {
            billingDays = 7
            billingCycle = '1 week'
          } else if (billingCycle.includes('year')) {
            billingDays = 365
            billingCycle = '1 year'
          } else if (billingCycle.includes('month')) {
            billingDays = 30
            billingCycle = '1 month'
          } else if (billingCycle.includes('week')) {
            billingDays = 7
            billingCycle = '1 week'
          }
        }

        if (plan.length > 0) {
          // Calculate expiry date based on actual billing cycle
          const startDate = new Date()
          const endDate = new Date()
          endDate.setDate(endDate.getDate() + billingDays)

          await connection.execute(
            `INSERT INTO subscription_history
             (sh_mu_id, sh_subscription_id, sh_price, sh_billing_cycle, sh_payment_method, sh_start_date, sh_end_date, sh_status, sh_created_at, sh_updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'active', NOW(), NOW())`,
            [id, subscription_id, 0, billingCycle, 'ADMIN_CHANGE', startDate, endDate]
          )
        }
      }

      await connection.commit()

      res.status(200).json({
        success: true,
        message: 'User subscription updated successfully',
        timestamp: new Date().toISOString()
      })
    } catch (error) {
      await connection.rollback()
      throw error
    }
  } catch (error) {
    console.error('Error updating user subscription:', error)
    return res.status(500).json({ 
      success: false,
      message: 'Server error while updating user subscription',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    })
  } finally {
    if (connection) {
      connection.release()
    }
  }
}

module.exports = {
  getUsers,
  updateUser,
  updateUserSubscription,
}
