const os = require('os')
const {
  checkConnection,
  SelectAll,
  SelectWithCondition,
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
const { CheckPassword, Encrypter, Decrypter } = require('../util/cryptography.util')
const jwt = require('jsonwebtoken')
const { SQLQueryBuilder } = require('../util/helper.util')
const sql = new SQLQueryBuilder()
const mysql = require('mysql2/promise')
const CONFIG = require('../database/config/config')
const {
  createTenantDatabase,
} = require('../database/util/createTenantDatabase.util')
const { MongoClient } = require('mongodb')
const axios = require('axios')

const pool = mysql.createPool({
  host: CONFIG[process.env.NODE_ENV].host,
  user: CONFIG[process.env.NODE_ENV].username,
  password: CONFIG[process.env.NODE_ENV].password,
  database: CONFIG[process.env.NODE_ENV].database,
  multipleStatements: CONFIG[process.env.NODE_ENV].dialectOptions.multipleStatements,
})

require('dotenv').config()

const logout = (req, res, next) => {
  req.session.jwt = null
  res.status(200).json({
    success: true,
    message: 'Logout successful',
    timestamp: new Date().toISOString(),
  })
}

const register = async (req, res, next) => {
  const { username, password, db_name } = req.body
  try {
    const checkQuery = sql
      .select([{ col: Master.master_user.selectOptionColumns.id, as: 'id' }])
      .from(Master.master_user.tablename)
      .where(Master.master_user.selectOptionColumns.username)
      .build()

    const existingUsers = await Query(
      checkQuery,
      [username],
      [Master.master_user.prefix_],
    )

    if (existingUsers.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Username already exists',
      })
    }

    const hashedPassword = await new Promise((resolve, reject) => {
      Encrypter(password, (error, hashed) => {
        if (error) {
          reject(error)
        } else {
          resolve(hashed)
        }
      })
    })

    const sanitizedDbName = db_name.trim().replace(/\s+/g, '_').toLowerCase()

    const dbNameWithPrefix = `${sanitizedDbName}_accounting`

    const insertQuery = sql
      .insert(Master.master_user.tablename, {
        columns: Master.master_user.insertColumns,
        isTransaction: true,
      })
      .values([username, hashedPassword, dbNameWithPrefix, 'active'])
      .build()

    const checkDbQuery = sql
      .select([
        { col: Master.master_user.selectOptionColumns.db_name, as: 'db_name' },
      ])
      .from(Master.master_user.tablename)
      .where(Master.master_user.selectOptionColumns.db_name)
      .build()

    const existingDbs = await Query(
      checkDbQuery,
      [dbNameWithPrefix],
      [Master.master_user.prefix_],
    )

    await Query(insertQuery, [username, hashedPassword, dbNameWithPrefix, 'active'])

    if (existingDbs.length === 0) {
      try {
        const userData = {
          username: username,
          password: hashedPassword,
        }
        await createTenantDatabase(dbNameWithPrefix, userData, db_name)
      } catch (dbError) {
        console.error('Tenant database creation failed:', dbError)
      }
    } else {
      console.log(
        `Database ${dbNameWithPrefix} already exists, skipping database creation`,
      )
    }

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Register error:', error)
    return res.status(500).json({
      success: false,
      message: 'Server error during registration',
      error:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Internal server error',
    })
  }
}

const login = async (req, res, next) => {
  const { username, password } = req.body
  console.log('Login request:', req.body)
  try {
    const query = sql
      .select([
        { col: Master.master_user.selectOptionColumns.id, as: 'id' },
        { col: Master.master_user.selectOptionColumns.username, as: 'username' },
        { col: Master.master_user.selectOptionColumns.password, as: 'password' },
        { col: Master.master_user.selectOptionColumns.db_name, as: 'db_name' },
        { col: Master.master_user.selectOptionColumns.status, as: 'status' },
      ])
      .from(Master.master_user.tablename)
      .where(
        `${Master.master_user.selectOptionColumns.username} = ? AND ${Master.master_user.selectOptionColumns.status} = ?`,
      )
      .build()

    console.log('Generated SQL:', query)
    console.log('Query params:', [username, 'active'])

    const users = await Query(
      query,
      [username, 'active'],
      [Master.master_user.prefix_],
    )

    if (users.length === 0) {
      console.log('User not found or not active')
      return res.status(401).json({
        success: false,
        message: 'Invalid username or user not active',
      })
    }

    const user = users[0]

    Decrypter(user.password, async (error, decryptedPassword) => {
      if (error) {
        console.error('Password decryption error:', error)
        return res.status(500).json({
          success: false,
          message: 'Server error during password verification',
        })
      }

      if (password !== decryptedPassword) {
        console.log('Invalid password')
        return res.status(401).json({
          success: false,
          message: 'Invalid password',
        })
      }

      const { password: userPassword, ...userWithoutPassword } = user

      try {
        const mongoClient = new MongoClient(process.env._SUBSCRIPTION_MONGODB_URL)
        await mongoClient.connect()
        const db = mongoClient.db()
        const sessionCollection = db.collection(
          process.env._SUBSCRIPTION_SESSION_COLLECTION,
        )

        await sessionCollection.updateOne(
          { userId: user.id },
          {
            $set: {
              userId: user.id,
              username: user.username,
              password: userPassword,
              db_name: user.db_name,
              updatedAt: new Date(),
            },
          },
          { upsert: true },
        )

        await mongoClient.close()
        console.log('Session data saved to MongoDB')
      } catch (mongoError) {
        console.error('MongoDB session save error:', mongoError)
      }

      try {
        const mainServerUrl = process.env._MAIN_SERVER_URL || 'localhost'
        const mainServerPort = process.env._MAIN_SERVER_PORT || '5050'

        const mainServerResponse = await axios.post(
          `http://${mainServerUrl}:${mainServerPort}/credentials/login`,
          {
            username: username,
            password: userPassword,
          },
        )

        console.log('Main server response:', mainServerResponse.data)

        if (mainServerResponse.data) {
          try {
            const mongoClient = new MongoClient(
              process.env._SUBSCRIPTION_MONGODB_URL,
            )
            await mongoClient.connect()
            const db = mongoClient.db()
            const sessionCollection = db.collection(
              process.env._SUBSCRIPTION_SESSION_COLLECTION,
            )

            const routeAccessData =
              mainServerResponse.data.data &&
              mainServerResponse.data.data.route_access
                ? mainServerResponse.data.data.route_access
                : mainServerResponse.data.routeAccess ||
                  mainServerResponse.data.access ||
                  null

            await sessionCollection.updateOne(
              { userId: user.id },
              {
                $set: {
                  route_access: routeAccessData,
                  mainServerResponse: {
                    success: mainServerResponse.data.success,
                    message: mainServerResponse.data.message,
                    timestamp: new Date(),
                  },
                  updatedAt: new Date(),
                },
              },
            )

            await mongoClient.close()
            console.log('Route access saved to MongoDB:', routeAccessData)
          } catch (routeSaveError) {
            console.error('Error saving route access:', routeSaveError)
          }
        }

        console.log('Credentials sent to main server successfully')
      } catch (mainServerError) {
        console.error('Main server authentication error:', mainServerError)
        if (mainServerError.response) {
          console.log('Main server error response:', mainServerError.response.data)
        }
      }

      const token = jwt.sign(
        {
          userId: user.id,
          username: user.username,
          dbName: user.db_name,
        },
        process.env._SECRET_KEY,
        { expiresIn: '24h' },
      )

      req.session.jwt = token

      let routeAccess = null
      try {
        const mongoClient = new MongoClient(process.env._SUBSCRIPTION_MONGODB_URL)
        await mongoClient.connect()
        const db = mongoClient.db()
        const sessionCollection = db.collection(
          process.env._SUBSCRIPTION_SESSION_COLLECTION,
        )

        const sessionData = await sessionCollection.findOne({ userId: user.id })
        routeAccess = sessionData ? sessionData.route_access : null

        await mongoClient.close()
      } catch (sessionError) {
        console.error('Error fetching route access for response:', sessionError)
      }

      res.status(200).json({
        success: true,
        message: 'Login successful',
        data: {
          ...userWithoutPassword,
          route_access: routeAccess,
          mongodb_url: process.env._MONGODB_URL,
          token,
        },
        timestamp: new Date().toISOString(),
      })
    })
  } catch (error) {
    console.error('Credentials login error:', error)
    return res.status(500).json({
      success: false,
      message: 'Server error during credentials login',
      error:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Internal server error',
    })
  }
}

module.exports = {
  login,
  logout,
  register,
}
