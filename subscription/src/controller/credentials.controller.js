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

const logout = async (req, res, next) => {
  try {
    // Clear JWT from session
    req.session.jwt = null

    // Clear session data from MongoDB
    const userId = req.user?.userId || req.body?.userId
    if (userId) {
      try {
        const mongoClient = new MongoClient(process.env._SUBSCRIPTION_MONGODB_URL)
        await mongoClient.connect()
        const db = mongoClient.db()
        const sessionCollection = db.collection(
          process.env._SUBSCRIPTION_SESSION_COLLECTION,
        )

        await sessionCollection.deleteOne({ userId: userId })
        await mongoClient.close()
        console.log('Session data cleared from MongoDB for user:', userId)
      } catch (mongoError) {
        console.error('MongoDB session clear error:', mongoError)
      }
    }

    res.status(200).json({
      success: true,
      message: 'Logout successful',
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Logout error:', error)
    res.status(500).json({
      success: false,
      message: 'Logout failed',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    })
  }
}

const register = async (req, res, next) => {
  const { username, password, db_name, email, subscription_id } = req.body
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
      .values([username, hashedPassword, dbNameWithPrefix, email || null, 'active', 'USER', subscription_id || null])
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

    await Query(insertQuery, [username, hashedPassword, dbNameWithPrefix, email || null, 'active', 'USER', subscription_id || null])

    if (existingDbs.length === 0) {
      try {
        const userData = {
          username: username,
          password: hashedPassword,
          email: email || null,
          subscription_id: subscription_id || null,
        }
        await createTenantDatabase(dbNameWithPrefix, userData, db_name)
      } catch (dbError) {
        console.error('Tenant database creation failed:', dbError)
        return res.status(500).json({
          success: false,
          message: 'Failed to create tenant database',
        })
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

const registerWithProgress = async (req, res) => {
  const { username, password, db_name, email, subscription_id, subscription_price, subscription_billing_cycle } = req.body

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('Access-Control-Allow-Origin', '*')

  const sendProgress = (data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`)
    // Flush the response to ensure data is sent immediately
    if (typeof res.flush === 'function') {
      res.flush()
    }
  }

  try {
    sendProgress({ step: 'validating', message: 'Validating your information...', progress: 5 })

    const checkQuery = sql
      .select([
        { col: Master.master_user.selectOptionColumns.username, as: 'username' },
      ])
      .from(Master.master_user.tablename)
      .where(Master.master_user.selectOptionColumns.username)
      .build()

    const existingUsers = await Query(
      checkQuery,
      [username],
      [Master.master_user.prefix_],
    )

    if (existingUsers.length > 0) {
      sendProgress({ step: 'error', message: 'Username already exists', progress: 0 })
      res.end()
      return
    }

    sendProgress({ step: 'hashing', message: 'Securing your password...', progress: 10 })

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

    sendProgress({ step: 'creating_user', message: 'Creating your account...', progress: 15 })

    const insertQuery = sql
      .insert(Master.master_user.tablename, {
        columns: Master.master_user.insertColumns,
        isTransaction: true,
      })
      .values([username, hashedPassword, dbNameWithPrefix, email || null, 'active', 'USER', subscription_id || null])
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

    await Query(insertQuery, [username, hashedPassword, dbNameWithPrefix, email || null, 'active', 'USER', subscription_id || null])

    if (existingDbs.length === 0) {
      try {
        const userData = {
          username: username,
          password: hashedPassword,
          email: email || null,
          subscription_id: subscription_id || null,
        }
        
        // Send progress before starting long-running operations
        sendProgress({ step: 'starting_db_setup', message: 'Starting database setup...', progress: 20 })
        
        await createTenantDatabase(dbNameWithPrefix, userData, db_name, sendProgress)
      } catch (dbError) {
        console.error('Tenant database creation failed:', dbError)
        sendProgress({ step: 'error', message: 'Failed to create tenant database', progress: 0 })
        res.end()
        return
      }
    } else {
      console.log(
        `Database ${dbNameWithPrefix} already exists, skipping database creation`,
      )
      sendProgress({ step: 'database_exists', message: 'Database already exists, skipping...', progress: 95 })
    }

    sendProgress({ step: 'complete', message: 'Registration successful!', progress: 100, success: true })
    res.end()
  } catch (error) {
    console.error('Register error:', error)
    sendProgress({ step: 'error', message: 'Registration failed. Please try again.', progress: 0 })
    res.end()
  }
}

const updateSubscription = async (req, res, next) => {
  const { username, subscription_id, subscription_price, subscription_billing_cycle, payment_reference, payment_method } = req.body
  console.log('Received subscription update request:', { username, subscription_id, subscription_price, subscription_billing_cycle, payment_reference, payment_method })
  try {
    const updateQuery = `UPDATE ${Master.master_user.tablename} SET subscription_id = ? WHERE mu_username = ?`

    await Query(updateQuery, [subscription_id, username], [Master.master_user.prefix_])

    // Save subscription history after updating subscription
    try {
      console.log('Attempting to save subscription history for username:', username)
      
      // Get user ID from username
      const userQuery = sql
        .select([Master.master_user.selectOptionColumns.id])
        .from(Master.master_user.tablename)
        .where(Master.master_user.selectOptionColumns.username)
        .build()

      console.log('User query:', userQuery)
      
      const users = await Query(
        userQuery,
        [username],
        [Master.master_user.prefix_],
      )

      console.log('User query result:', users)

      if (users.length > 0) {
        const userId = users[0].id
        console.log('User ID found:', userId)
        
        // Check if subscription history already exists for this user and subscription
        const checkHistoryQuery = sql
          .select(['sh_id'])
          .from(Master.subscription_history.tablename)
          .where('sh_mu_id')
          .build()

        const existingHistory = await Query(
          checkHistoryQuery,
          [userId],
          [Master.subscription_history.prefix_],
        )

        // Filter by subscription_id and status in the result
        const filteredHistory = existingHistory.filter(
          h => h.sh_subscription_id === subscription_id && h.sh_status === 'active'
        )

        console.log('Existing subscription history:', filteredHistory)

        // Only save if no active history exists for this subscription
        if (filteredHistory.length === 0) {
          // Convert billing cycle to human-readable format
          const convertBillingCycle = (cycle) => {
            if (!cycle) return null;
            const days = parseInt(cycle);
            if (isNaN(days)) return cycle; // Already in human-readable format
            if (days === 7) return 'week';
            if (days === 30 || days === 31) return 'month';
            if (days === 60 || days === 61) return '2 months';
            if (days === 90 || days === 91) return '3 months';
            if (days === 180 || days === 182) return '6 months';
            if (days === 365 || days === 366) return 'year';
            return `${days} days`;
          };

          const formattedBillingCycle = convertBillingCycle(subscription_billing_cycle);
          console.log('Original billing cycle:', subscription_billing_cycle);
          console.log('Formatted billing cycle:', formattedBillingCycle);

          // Calculate end date based on billing cycle
          let endDate = null
          if (subscription_billing_cycle) {
            const startDate = new Date()
            const cycleDays = parseInt(subscription_billing_cycle)
            if (!isNaN(cycleDays)) {
              endDate = new Date(startDate)
              endDate.setDate(endDate.getDate() + cycleDays)
            }
          }

          // Insert subscription history
          const historyInsertQuery = sql
            .insert(Master.subscription_history.tablename, {
              columns: Master.subscription_history.insertColumns,
              isTransaction: true,
            })
            .values([
              userId,
              subscription_id,
              subscription_price || 0,
              formattedBillingCycle || null,
              new Date(),
              endDate,
              'active',
              payment_method || (subscription_price === 0 || subscription_price === '0' ? 'free_trial' : 'paymongo'),
              payment_reference || null,
              new Date(),
              new Date()
            ])
            .build()

          console.log('History insert query:', historyInsertQuery)

          await Query(
            historyInsertQuery,
            [
              userId,
              subscription_id,
              subscription_price || 0,
              formattedBillingCycle || null,
              new Date(),
              endDate,
              'active',
              payment_method || (subscription_price === 0 || subscription_price === '0' ? 'free_trial' : 'paymongo'),
              payment_reference || null,
              new Date(),
              new Date()
            ],
            [Master.subscription_history.prefix_],
          )

          console.log('Subscription history saved after update for user:', username)
        } else {
          console.log('Subscription history already exists for this user and subscription, skipping')
        }
      } else {
        console.log('User not found for username:', username)
      }
    } catch (historyError) {
      console.error('Error saving subscription history after update:', historyError)
      // Don't fail the subscription update if history saving fails
    }

    res.status(200).json({
      success: true,
      message: 'Subscription updated successfully',
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Update subscription error:', error)
    return res.status(500).json({
      success: false,
      message: 'Server error during subscription update',
      error:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Internal server error',
    })
  }
}

const getUserUsedFreeTrials = async (req, res, next) => {
  const { username } = req.query
  try {
    console.log('Fetching used free trials for username:', username)
    
    // Get user ID from username
    const userQuery = sql
      .select([Master.master_user.selectOptionColumns.id])
      .from(Master.master_user.tablename)
      .where(Master.master_user.selectOptionColumns.username)
      .build()

    const users = await Query(
      userQuery,
      [username],
      [Master.master_user.prefix_],
    )

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      })
    }

    const userId = users[0].id
    console.log('User ID found:', userId)

    // Get subscription history for this user with free trial (price = 0)
    const historyQuery = sql
      .select(['sh_subscription_id', 'sh_price'])
      .from(Master.subscription_history.tablename)
      .where('sh_mu_id')
      .build()

    const history = await Query(
      historyQuery,
      [userId],
      [Master.subscription_history.prefix_],
    )

    console.log('User subscription history:', history)

    // Filter for free trials (price = 0 or '0')
    // Handle both prefixed and non-prefixed column names
    const freeTrialSubscriptions = history
      .filter(h => {
        const price = h.sh_price !== undefined ? h.sh_price : h.price;
        return price === 0 || price === '0' || price === '0.00';
      })
      .map(h => h.sh_subscription_id !== undefined ? h.sh_subscription_id : h.subscription_id)

    console.log('Free trial subscription IDs:', freeTrialSubscriptions)

    res.status(200).json({
      success: true,
      data: freeTrialSubscriptions,
      count: freeTrialSubscriptions.length,
    })
  } catch (error) {
    console.error('Get user used free trials error:', error)
    return res.status(500).json({
      success: false,
      message: 'Server error fetching free trial history',
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
        { col: Master.master_user.selectOptionColumns.role, as: 'role' },
        { col: Master.master_user.selectOptionColumns.subscription_id, as: 'subscription_id' },
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

      // Check if user has a subscription (only for USER role, ADMIN can login without subscription)
      if (user.role !== 'ADMIN' && (!user.subscription_id || user.subscription_id === null)) {
        console.log('User does not have a subscription')
        return res.status(403).json({
          success: false,
          message: 'You do not have an active subscription. Please complete your registration by selecting a subscription plan.',
          requiresSubscription: true,
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

      let tenantUserId = user.id // Default to subscription user ID
      let tenantUserData = null // Store tenant user data from main server
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

        if (mainServerResponse.data && mainServerResponse.data.data) {
          // Use tenant database user data from main server response
          tenantUserId = mainServerResponse.data.data.id || user.id
          tenantUserData = mainServerResponse.data.data // Store full tenant user data

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
                  tenantUserId: tenantUserId, // Store tenant user ID in MongoDB
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
          userId: tenantUserId, // Use tenant database user ID
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

      // Return tenant database user data if available, otherwise fall back to subscription data
      const responseData = tenantUserData ? {
        ...tenantUserData,
        db_name: user.db_name, // Ensure db_name is from subscription
        role: user.role, // Include role from subscription database
        mongodb_url: process.env._MONGODB_URL,
        token,
      } : {
        ...userWithoutPassword,
        route_access: routeAccess,
        mongodb_url: process.env._MONGODB_URL,
        token,
      }

      res.status(200).json({
        success: true,
        message: 'Login successful',
        data: responseData,
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

const checkFreeTrialUsage = async (req, res) => {
  try {
    const { username } = req.query

    if (!username) {
      return res.status(400).json({
        success: false,
        message: 'Username is required',
      })
    }

    // Get user ID from username
    const userQuery = sql
      .select([Master.master_user.selectOptionColumns.id])
      .from(Master.master_user.tablename)
      .where(Master.master_user.selectOptionColumns.username)
      .build()

    const users = await Query(
      userQuery,
      [username],
      [Master.master_user.prefix_],
    )

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      })
    }

    const userId = users[0].mu_id

    // Check if user has any free trial subscription history (price = 0)
    const historyQuery = sql
      .select([
        { col: Master.subscription_history.selectOptionColumns.id, as: 'id' },
        { col: Master.subscription_history.selectOptionColumns.price, as: 'price' },
        { col: Master.subscription_history.selectOptionColumns.status, as: 'status' },
      ])
      .from(Master.subscription_history.tablename)
      .where(Master.subscription_history.selectOptionColumns.mu_id)
      .build()

    const history = await Query(
      historyQuery,
      [userId],
      [Master.subscription_history.prefix_],
    )

    // Check if any subscription has price = 0 (free trial)
    const hasUsedFreeTrial = history.some(
      (record) => parseFloat(record.sh_price) === 0
    )

    return res.status(200).json({
      success: true,
      hasUsedFreeTrial,
      history: history,
    })
  } catch (error) {
    console.error('Check free trial usage error:', error)
    return res.status(500).json({
      success: false,
      message: 'Server error checking free trial usage',
      error:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Internal server error',
    })
  }
}

const saveSubscriptionHistory = async (req, res) => {
  try {
    const { username, subscription_id, price, billing_cycle, payment_method, payment_reference } = req.body

    console.log('saveSubscriptionHistory called with:', { username, subscription_id, price, billing_cycle, payment_method, payment_reference })

    if (!username || !subscription_id) {
      console.log('Missing required fields:', { username, subscription_id })
      return res.status(400).json({
        success: false,
        message: 'Username and subscription_id are required',
      })
    }

    // Get user ID from username
    const userQuery = sql
      .select([Master.master_user.selectOptionColumns.id])
      .from(Master.master_user.tablename)
      .where(Master.master_user.selectOptionColumns.username)
      .build()

    const users = await Query(
      userQuery,
      [username],
      [Master.master_user.prefix_],
    )

    console.log('User query result:', users)

    if (users.length === 0) {
      console.log('User not found for username:', username)
      return res.status(404).json({
        success: false,
        message: 'User not found',
      })
    }

    const userId = users[0].mu_id
    console.log('User ID:', userId)

    // Calculate end date based on billing cycle
    let endDate = null
    if (billing_cycle) {
      const startDate = new Date()
      const cycleDays = parseInt(billing_cycle)
      if (!isNaN(cycleDays)) {
        endDate = new Date(startDate)
        endDate.setDate(endDate.getDate() + cycleDays)
      }
    }
    console.log('End date:', endDate)

    // Insert subscription history
    const insertQuery = sql
      .insert(Master.subscription_history.tablename, {
        columns: Master.subscription_history.insertColumns,
        isTransaction: true,
      })
      .values([
        userId,
        subscription_id,
        price || 0,
        billing_cycle || null,
        new Date(),
        endDate,
        'active',
        payment_method || null,
        payment_reference || null
      ])
      .build()

    console.log('Insert query:', insertQuery)

    await Query(
      insertQuery,
      [
        userId,
        subscription_id,
        price || 0,
        billing_cycle || null,
        new Date(),
        endDate,
        'active',
        payment_method || null,
        payment_reference || null
      ],
      [Master.subscription_history.prefix_],
    )

    console.log('Subscription history saved successfully')
    return res.status(200).json({
      success: true,
      message: 'Subscription history saved successfully',
    })
  } catch (error) {
    console.error('Save subscription history error:', error)
    return res.status(500).json({
      success: false,
      message: 'Server error saving subscription history',
      error:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Internal server error',
    })
  }
}

const expireSubscriptions = async (req, res, next) => {
  try {
    console.log('[Subscription Expiry] Manual trigger - Running subscription expiry check...');
    await Query('CALL expire_subscriptions()');
    console.log('[Subscription Expiry] Manual trigger - Subscription expiry check completed successfully');
    res.json({ success: true, message: 'Subscription expiry check completed' });
  } catch (error) {
    console.error('[Subscription Expiry] Manual trigger - Error:', error);
    next(error);
  }
}

module.exports = {
  login,
  logout,
  register,
  registerWithProgress,
  updateSubscription,
  checkFreeTrialUsage,
  saveSubscriptionHistory,
  getUserUsedFreeTrials,
  expireSubscriptions,
}
