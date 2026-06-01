const os = require('os')
const {
  checkConnection,
  SelectAll,
  Query,
  Transaction,
} = require('../database/util/queries.util')
const {
  formatMemoryUsage,
  formatTime,
  DataModeling,
} = require('../util/helper.util')
const { Master } = require('../database/model/Master')
const { Master: SubscriptionMaster } = require('../database/model/Subscription')
const CONFIG = require('../database/config/config')
const { SQLQueryBuilder } = require('../util/helper.util')
const { EncryptString, DecryptString } = require('../util/cryptography.util')
const mysql = require('mysql2/promise')
const sql = new SQLQueryBuilder()

require('dotenv').config()

const getUsers = async (req, res, next) => {
  try {
    const query = sql
      .select([
        { col: Master.master_user.selectOptionColumns.id, as: 'id' },
        { col: Master.master_user.selectOptionColumns.fullname, as: 'fullname' },
        { col: Master.master_user.selectOptionColumns.username, as: 'username' },
        { col: Master.master_user.selectOptionColumns.access_id, as: 'access_id' },
        {
          col: Master.master_access.selectOptionColumns.access_name,
          as: 'access_name',
        },
        { col: Master.master_user.selectOptionColumns.status, as: 'status' },
      ])
      .innerJoin(
        Master.master_access.tablename,
        Master.master_user.selectOptionColumns.access_id,
        Master.master_access.selectOptionColumns.access_id,
      )
      .from(Master.master_user.tablename)
      .build()

    let users = await Query(
      query,
      [],
      [Master.master_user.prefix_, Master.master_access.prefix_],
    )

    res.status(200).json({
      success: true,
      message: 'Users retrieved successfully',
      data: users,
      count: users.length,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error fetching users:', error)
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching users',
      error:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Internal server error',
    })
  }
}

const createUser = async (req, res, next) => {
  try {
    const { fullname, username, password, access_id } = req.body

    if (!fullname || !username || !password || !access_id) {
      return res.status(400).json({
        success: false,
        message: 'fullname, username, password, and access_id are required',
        timestamp: new Date().toISOString(),
      })
    }

    const normalizedUsername = username.trim()

    const existingUserQuery = `SELECT ${Master.master_user.selectOptionColumns.id} FROM ${Master.master_user.tablename} WHERE ${Master.master_user.selectOptionColumns.username} = ?`
    const existingUsers = await Query(existingUserQuery, [normalizedUsername])

    if (existingUsers.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Username already exists',
        timestamp: new Date().toISOString(),
      })
    }

    const encryptedPassword = EncryptString(password)
    if (!encryptedPassword) {
      throw new Error('Failed to encrypt password')
    }

    const queries = []
    queries.push({
      sql: sql
        .insert(Master.master_user.tablename, {
          columns: Master.master_user.insertColumns,
          prefix: Master.master_user.prefix,
          isTransaction: true,
        })
        .build(),
      values: [
        fullname || null,
        normalizedUsername || null,
        encryptedPassword || null,
        access_id || null,
      ],
    })

    await Transaction(queries)

    const currentTenantDb =
      (CONFIG.getTenantDbOverride && CONFIG.getTenantDbOverride()) ||
      CONFIG[process.env.NODE_ENV].database

    const adminDbName = process.env._DATABASE_ADMIN
    const adminPassword = DecryptString(process.env._PASSWORD_ADMIN)
    const adminPool = mysql.createPool({
      host: process.env._HOST_ADMIN,
      user: process.env._USER_ADMIN,
      password: adminPassword,
      database: adminDbName,
      multipleStatements: true,
    })

    try {
      const adminInsertSql = `INSERT INTO ${SubscriptionMaster.master_user.tablename} (${SubscriptionMaster.master_user.insertColumns.join(', ')}) VALUES (?, ?, ?, ?)`
      const adminValues = [
        normalizedUsername || null,
        encryptedPassword || null,
        currentTenantDb || null,
        'ACTIVE',
      ]

      await adminPool.execute(adminInsertSql, adminValues)
    } finally {
      await adminPool.end()
    }

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: {
        fullname: fullname.trim(),
        username: normalizedUsername,
        access_id,
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error creating user:', error)
    return res.status(500).json({
      success: false,
      message: 'Server error while creating user',
      error:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Internal server error',
    })
  }
}

const updateUser = async (req, res, next) => {
  try {
    const userId = req.params.id
    const { access_id, status } = req.body

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User id is required',
        timestamp: new Date().toISOString(),
      })
    }

    if (!access_id || !status) {
      return res.status(400).json({
        success: false,
        message: 'access_id and status are required',
        timestamp: new Date().toISOString(),
      })
    }

    const updateQuery = sql
      .update(Master.master_user.tablename, {
        prefix: Master.master_user.prefix,
      })
      .set([
        Master.master_user.updateOptionColumns.access_id,
        Master.master_user.updateOptionColumns.status,
      ])
      .where(Master.master_user.selectOptionColumns.id)
      .build()

    await Query(updateQuery, [access_id, status, userId])

    // Keep subscription admin status in sync, if possible.
    try {
      let username = req.body.username
      if (!username) {
        const usernameQuery = `SELECT ${Master.master_user.selectOptionColumns.username} as username FROM ${Master.master_user.tablename} WHERE ${Master.master_user.selectOptionColumns.id} = ?`
        const selectedUser = await Query(usernameQuery, [userId])
        username =
          Array.isArray(selectedUser) && selectedUser.length > 0
            ? selectedUser[0].username
            : null
      }

      if (username) {
        const currentTenantDb =
          (CONFIG.getTenantDbOverride && CONFIG.getTenantDbOverride()) ||
          CONFIG[process.env.NODE_ENV].database

        const adminDbName = process.env._DATABASE_ADMIN
        const adminPassword = DecryptString(process.env._PASSWORD_ADMIN)
        const adminPool = mysql.createPool({
          host: process.env._HOST_ADMIN,
          user: process.env._USER_ADMIN,
          password: adminPassword,
          database: adminDbName,
          multipleStatements: true,
        })

        const adminUpdateSql = `UPDATE ${SubscriptionMaster.master_user.tablename} SET ${SubscriptionMaster.master_user.selectOptionColumns.status} = ? WHERE ${SubscriptionMaster.master_user.selectOptionColumns.username} = ? AND db_name = ?`
        await adminPool.execute(adminUpdateSql, [status, username, currentTenantDb])
        await adminPool.end()
      }
    } catch (adminSyncError) {
      console.warn('Failed to sync admin user status:', adminSyncError.message)
    }

    return res.status(200).json({
      success: true,
      message: 'User updated successfully',
      data: { id: userId, access_id, status },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error updating user:', error)
    return res.status(500).json({
      success: false,
      message: 'Server error while updating user',
      error:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Internal server error',
    })
  }
}

module.exports = {
  getUsers,
  createUser,
  updateUser,
}
