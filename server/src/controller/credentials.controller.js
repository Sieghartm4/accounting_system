const os = require('os')

const { checkConnection, SelectAll, SelectWithCondition, Transaction, Query, Insert } = require('../database/util/queries.util')

const { formatMemoryUsage, formatTime, DataModeling } = require('../util/helper.util')

const { Master } = require('../database/model/Master')

const {CheckPassword, Encrypter} = require('../util/cryptography.util')

const jwt = require('jsonwebtoken')

const { SQLQueryBuilder } = require('../util/helper.util')

const sql = new SQLQueryBuilder()

const CONFIG = require('../database/config/config')

const { MongoClient } = require('mongodb')

require('dotenv').config()


const logout = async (req, res, next) => {
  try {
    // Get user info from JWT before destroying session
    let userId = null
    let username = null
    if (req.session.jwt) {
      try {
        const decoded = jwt.verify(req.session.jwt, process.env._SECRET_KEY)
        userId = decoded.userId
        username = decoded.username
      } catch (e) {
        // Token expired or invalid, continue with logout
      }
    }

    // Destroy the server session
    req.session.jwt = null

    // Reset the global tenant DB override
    CONFIG.setTenantDb(null)

    // Delete the MongoDB session record
    if (userId || username) {
      try {
        const mongoUrl = process.env._SUBSCRIPTION_MONGODB_URL || process.env._MONGODB_URL
        const collectionName = process.env._SUBSCRIPTION_SESSION_COLLECTION || 'ACCOUNTINGSubscription'
        
        const client = new MongoClient(mongoUrl)
        await client.connect()
        const db = client.db()
        const collection = db.collection(collectionName)
        
        // Delete by userId or username
        if (userId) {
          await collection.deleteOne({ userId: userId })
        }
        if (username) {
          await collection.deleteOne({ username: username })
        }
        
        await client.close()
        console.log('🔍 Logout - MongoDB session deleted for user:', username || userId)
      } catch (mongoError) {
        console.error('🔍 Logout - MongoDB session delete error:', mongoError)
        // Continue with logout even if MongoDB delete fails
      }
    }

    // Destroy the express session
    req.session.destroy((err) => {
      if (err) {
        console.error('🔍 Logout - Session destroy error:', err)
      }
    })

    res.status(200).json({
      success: true,
      message: 'Logout successful',
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Logout error:', error)
    res.status(500).json({
      success: false,
      message: 'Error during logout',
    })
  }
}


const login = async (req, res, next) => {

  const { username, password } = req.body

  console.log('🔍 Login Controller - :', req.body)

  try {

    console.log('🔍 Login Controller - Starting authentication process...')

    

    // Step 1: Get tenant pool from config (MongoDB lookup + pool creation)

    const { pool: tenantPool, tenantDb } = await CONFIG.getTenantPool(username)

    

    console.log('🔍 Tenant database from MongoDB:', tenantDb)

    

    // Step 2: Query user from tenant database (manual query to fix WHERE clause issue)

    const query = `SELECT mu_id AS id, mu_username AS username, mu_password AS password, mu_fullname AS fullname, mu_access_id AS access_id, ma_access_name AS access 

                   FROM master_user 

                   INNER JOIN master_access ON mu_access_id = ma_access_id 

                   WHERE mu_username = ? AND mu_status = ?`;

    

    console.log('🔍 SQL Query:', query)

    console.log('🔍 Query params:', [username, 'active'])

    

    const users = await Query(query, [username, 'active'], [Master.master_user.prefix_, Master.master_access.prefix_], tenantPool)

    console.log('🔍 Users found in tenant database:', users)

    

    // Let's also check all users in the database to see their status

    const allUsersQuery = `SELECT mu_id, mu_username, mu_status, mu_fullname FROM master_user WHERE mu_username = ?`

    const allUsers = await Query(allUsersQuery, [username], [], tenantPool)

    console.log('🔍 All users with username:', allUsers)

    const route_access_query = sql.select([

      { col: Master.master_route_access.selectOptionColumns.name, as: 'name' },

      { col: Master.master_route_access.selectOptionColumns.status, as: 'status' },

    ])

      .from(Master.master_route_access.tablename)

      .where(Master.master_route_access.selectOptionColumns.access_id)

      .build();

    

    const route_access = await Query(route_access_query, [users[0].access_id], [Master.master_route_access.prefix_], tenantPool)

    

    // Close the tenant pool

    await tenantPool.end();

    

    if (users.length === 0) {

      return res.status(401).json({

        success: false,

        message: 'Invalid username or user not active'

      })

    }

    

    const user = users[0]

    

    console.log('🔍 User found:', user.username)

    console.log('🔍 Input password:', password)

    console.log('🔍 Stored password hash:', user.password)

    

    // Check if input is already an MD5 hash (32-character hex string) or plain text

    const crypto = require('crypto')

    const isAlreadyHashed = /^[a-f0-9]{32}$/i.test(password)

    console.log('🔍 Input password is already MD5 hash:', isAlreadyHashed)

    

    let isPasswordValid

    if (isAlreadyHashed) {

      // Compare directly if already hashed

      isPasswordValid = password === user.password

      console.log('🔍 Direct hash comparison:', isPasswordValid)

    } else {

      // Hash and compare if plain text

      const manualHash = crypto.createHash('md5').update(password).digest('hex')

      isPasswordValid = manualHash === user.password

      console.log('🔍 Manual MD5 hash of input password:', manualHash)

      console.log('🔍 Stored password hash:', user.password)

      console.log('🔍 Hashes match:', isPasswordValid)

    }

    

    // Use the result directly

    if (isPasswordValid) {

      console.log('🔍 Password validation successful')

      

      const { password, ...userWithoutPassword } = user

      

      // Create JWT with tenant database information

      const token = jwt.sign(

        { 

          userId: user.id, 

          username: user.username, 

          dbName: tenantDb

        },

        process.env._SECRET_KEY,

        { expiresIn: '24h' }

      )

      

      console.log('🔍 Login Controller - Storing JWT in session...');

      console.log('🔍 Session before storing JWT:', req.session);

      

      req.session.jwt = token

      req.session.tenantDb = tenantDb

      

      console.log('🔍 JWT token created:', token);

      console.log('🔍 Session after storing JWT:', req.session);

      

      // Explicitly save the session

      req.session.save((err) => {

        if (err) {

          console.error('🔍 Session save error:', err);

        } else {

          console.log('✅ Session saved successfully');

        }

      });

      

      res.status(200).json({

        success: true,

        message: 'Login successful',

        data: {

          ...userWithoutPassword,

          route_access,

          token,

          tenantDb: tenantDb

        },

        timestamp: new Date().toISOString()

      })

    } else {

      console.log('🔍 Password validation failed')

      return res.status(401).json({

        success: false,

        message: 'Invalid password'

      })

    }

    

  } catch (error) {

    console.error('Credentials login error:', error)

    return res.status(500).json({ 

      success: false,

      message: 'Server error during credentials login',

      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'

    })

  }

}



module.exports = {

  login,

  logout

}

