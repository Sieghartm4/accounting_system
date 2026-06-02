const os = require('os')
const jwt = require('jsonwebtoken')
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

const getMyProfile = async (req, res, next) => {
  try {
    const userId = req.context?.userId
    const username = req.context?.username

    if (!userId && !username) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: User not authenticated',
        timestamp: new Date().toISOString(),
      })
    }

    const profileQuery = sql
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
      .where(Master.master_user.selectOptionColumns.id)
      .build()

    let users = []

    if (userId) {
      users = await Query(
        profileQuery,
        [userId],
        [Master.master_user.prefix_, Master.master_access.prefix_],
      )
    }

    if ((!Array.isArray(users) || users.length === 0) && username) {
      const usernameQuery = sql
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
        .where(Master.master_user.selectOptionColumns.username)
        .build()

      users = await Query(
        usernameQuery,
        [username],
        [Master.master_user.prefix_, Master.master_access.prefix_],
      )
    }

    if (!Array.isArray(users) || users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User profile not found',
        timestamp: new Date().toISOString(),
      })
    }

    const routeAccessQuery = sql
      .select([
        { col: Master.master_route_access.selectOptionColumns.name, as: 'name' },
        { col: Master.master_route_access.selectOptionColumns.status, as: 'status' },
      ])
      .from(Master.master_route_access.tablename)
      .where(Master.master_route_access.selectOptionColumns.access_id)
      .build()

    const route_access = await Query(
      routeAccessQuery,
      [users[0].access_id],
      [Master.master_route_access.prefix_],
    )

    const db_name = req.context?.dbName || req.context?.tenantDb || null
    const mongodb_url =
      process.env._SUBSCRIPTION_MONGODB_URL || process.env._MONGODB_URL || null

    res.status(200).json({
      success: true,
      message: 'Profile retrieved successfully',
      data: {
        ...users[0],
        db_name,
        mongodb_url,
        route_access,
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error retrieving profile:', error)
    return res.status(500).json({
      success: false,
      message: 'Server error while retrieving profile',
      error:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Internal server error',
    })
  }
}

const updateMyProfile = async (req, res, next) => {
  try {
    const contextUserId = req.context?.userId
    const contextUsername = req.context?.username
    const {
      fullname,
      username: newUsername,
      current_password,
      new_password,
    } = req.body

    if (!contextUserId && !contextUsername) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: User not authenticated',
        timestamp: new Date().toISOString(),
      })
    }

    if (!fullname?.trim() && !new_password && !newUsername?.trim()) {
      return res.status(400).json({
        success: false,
        message: 'fullname, username, or new password is required to update profile',
        timestamp: new Date().toISOString(),
      })
    }

    const updateColumns = []
    const updateValues = []
    let identifierColumn = Master.master_user.selectOptionColumns.id
    let identifierValue = contextUserId

    const resolveUserIdentifier = async () => {
      if (contextUserId) {
        const idQuery = sql
          .select([{ col: Master.master_user.selectOptionColumns.id, as: 'id' }])
          .from(Master.master_user.tablename)
          .where(Master.master_user.selectOptionColumns.id)
          .build()

        const result = await Query(
          idQuery,
          [contextUserId],
          [Master.master_user.prefix_],
        )

        if (Array.isArray(result) && result.length > 0) {
          return {
            column: Master.master_user.selectOptionColumns.id,
            value: contextUserId,
          }
        }
      }

      if (contextUsername) {
        const usernameQuery = sql
          .select([{ col: Master.master_user.selectOptionColumns.id, as: 'id' }])
          .from(Master.master_user.tablename)
          .where(Master.master_user.selectOptionColumns.username)
          .build()

        const result = await Query(
          usernameQuery,
          [contextUsername],
          [Master.master_user.prefix_],
        )

        if (Array.isArray(result) && result.length > 0) {
          return {
            column: Master.master_user.selectOptionColumns.username,
            value: contextUsername,
          }
        }
      }

      return null
    }

    const resolvedIdentifier = await resolveUserIdentifier()
    if (!resolvedIdentifier) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
        timestamp: new Date().toISOString(),
      })
    }

    identifierColumn = resolvedIdentifier.column
    identifierValue = resolvedIdentifier.value

    const currentUserQuery = sql
      .select([
        { col: Master.master_user.selectOptionColumns.username, as: 'username' },
      ])
      .from(Master.master_user.tablename)
      .where(identifierColumn)
      .build()

    const currentUsers = await Query(
      currentUserQuery,
      [identifierValue],
      [Master.master_user.prefix_],
    )

    const oldUsername =
      Array.isArray(currentUsers) && currentUsers.length > 0
        ? currentUsers[0].username
        : null

    if (fullname?.trim()) {
      updateColumns.push(Master.master_user.updateOptionColumns.fullname)
      updateValues.push(fullname.trim())
    }

    if (newUsername?.trim()) {
      updateColumns.push(Master.master_user.updateOptionColumns.username)
      updateValues.push(newUsername.trim())
    }

    if (new_password) {
      if (!current_password) {
        return res.status(400).json({
          success: false,
          message: 'Current password is required to change your password',
          timestamp: new Date().toISOString(),
        })
      }

      const passwordQuery = sql
        .select([
          { col: Master.master_user.selectOptionColumns.password, as: 'password' },
        ])
        .from(Master.master_user.tablename)
        .where(identifierColumn)
        .build()

      const existingUsers = await Query(
        passwordQuery,
        [identifierValue],
        [Master.master_user.prefix_],
      )

      if (!Array.isArray(existingUsers) || existingUsers.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
          timestamp: new Date().toISOString(),
        })
      }

      const storedPassword = existingUsers[0].password
      const decryptedStoredPassword = DecryptString(storedPassword)

      if (decryptedStoredPassword !== current_password) {
        return res.status(401).json({
          success: false,
          message: 'Current password is incorrect',
          timestamp: new Date().toISOString(),
        })
      }

      const encryptedPassword = EncryptString(new_password)
      if (!encryptedPassword) {
        throw new Error('Failed to encrypt password')
      }
      updateColumns.push(Master.master_user.updateOptionColumns.password)
      updateValues.push(encryptedPassword)
    }

    const updateQuery = sql
      .update(Master.master_user.tablename, {
        prefix: Master.master_user.prefix,
      })
      .set(updateColumns)
      .where(identifierColumn)
      .build()

    await Query(updateQuery, [...updateValues, identifierValue])

    const currentTenantDb = req.context?.dbName || req.context?.tenantDb || null
    if (oldUsername && currentTenantDb && (newUsername?.trim() || new_password)) {
      try {
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
          const adminUpdateFields = []
          const adminUpdateValues = []

          if (newUsername?.trim()) {
            adminUpdateFields.push(
              `${SubscriptionMaster.master_user.selectOptionColumns.username} = ?`,
            )
            adminUpdateValues.push(newUsername.trim())
          }

          if (new_password) {
            adminUpdateFields.push(
              `${SubscriptionMaster.master_user.selectOptionColumns.password} = ?`,
            )
            adminUpdateValues.push(EncryptString(new_password))
          }

          if (adminUpdateFields.length > 0) {
            const adminUpdateSql = `UPDATE ${SubscriptionMaster.master_user.tablename} SET ${adminUpdateFields.join(
              ', ',
            )} WHERE ${SubscriptionMaster.master_user.selectOptionColumns.username} = ? AND ${SubscriptionMaster.master_user.selectOptionColumns.db_name} = ?`
            await adminPool.execute(adminUpdateSql, [
              ...adminUpdateValues,
              oldUsername,
              currentTenantDb,
            ])
          }
        } finally {
          await adminPool.end()
        }
      } catch (adminSyncError) {
        console.warn(
          'Failed to sync profile update to admin DB:',
          adminSyncError.message,
        )
      }
    }

    const selectStatement = sql
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
      .where(
        contextUserId
          ? Master.master_user.selectOptionColumns.id
          : Master.master_user.selectOptionColumns.username,
      )
      .build()

    const updatedUsers = await Query(
      selectStatement,
      [contextUserId || newUsername?.trim() || contextUsername],
      [Master.master_user.prefix_, Master.master_access.prefix_],
    )

    const updatedUser =
      Array.isArray(updatedUsers) && updatedUsers.length > 0 ? updatedUsers[0] : null

    const responseUser = {
      ...updatedUser,
      username: newUsername?.trim() || updatedUser?.username,
      fullname: fullname?.trim() || updatedUser?.fullname,
    }

    const routeAccessQuery = sql
      .select([
        { col: Master.master_route_access.selectOptionColumns.name, as: 'name' },
        { col: Master.master_route_access.selectOptionColumns.status, as: 'status' },
      ])
      .from(Master.master_route_access.tablename)
      .where(Master.master_route_access.selectOptionColumns.access_id)
      .build()

    const route_access = updatedUser
      ? await Query(
          routeAccessQuery,
          [updatedUser.access_id],
          [Master.master_route_access.prefix_],
        )
      : []

    const db_name = req.context?.dbName || req.context?.tenantDb || null
    const mongodb_url =
      process.env._SUBSCRIPTION_MONGODB_URL || process.env._MONGODB_URL || null

    let updatedToken = null
    try {
      const tokenPayload = {
        ...(contextUserId ? { userId: contextUserId } : {}),
        username:
          updatedUser?.username ||
          newUsername?.trim() ||
          oldUsername ||
          contextUsername,
      }
      const tokenDbName =
        req.context?.dbName || req.context?.tenantDb || updatedUser?.db_name || null
      if (tokenDbName) {
        tokenPayload.dbName = tokenDbName
      }

      updatedToken = jwt.sign(tokenPayload, process.env._SECRET_KEY, {
        expiresIn: '24h',
      })
    } catch (tokenError) {
      console.warn('Failed to issue updated profile token:', tokenError.message)
    }

    if (updatedToken && req.session) {
      req.session.jwt = updatedToken
      req.session.save((err) => {
        if (err) {
          console.warn('Failed to save updated session token:', err.message)
        }
      })
    }

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        ...responseUser,
        db_name,
        mongodb_url,
        route_access,
        ...(updatedToken ? { token: updatedToken } : {}),
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error updating profile:', error)
    return res.status(500).json({
      success: false,
      message: 'Server error while updating profile',
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
  getMyProfile,
  updateMyProfile,
}
