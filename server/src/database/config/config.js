require('dotenv').config()
const { DecryptString } = require('../../util/cryptography.util')
const { MongoClient } = require('mongodb')
const mysql = require('mysql2/promise')
const jwt = require('jsonwebtoken')

let _currentTenantDb = null

const setTenantDb = (db) => { 
  console.log('🔍 Config - Setting tenant DB to:', db)
  _currentTenantDb = db 
}
const getTenantDbOverride = () => {
  console.log('🔍 Config - Getting tenant DB override:', _currentTenantDb)
  return _currentTenantDb
}

const getTenantDatabase = async (username) => {
  try {
    console.log('🔍 MongoDB lookup for username:', username)
    const mongoUrl = process.env._SUBSCRIPTION_MONGODB_URL || process.env._MONGODB_URL
    const collectionName = process.env._SUBSCRIPTION_SESSION_COLLECTION || 'ACCOUNTINGSubscription'
    
    console.log('🔍 MongoDB URL:', mongoUrl)
    console.log('🔍 MongoDB Collection:', collectionName)
    
    const client = new MongoClient(mongoUrl)
    await client.connect()
    const db = client.db()
    const collection = db.collection(collectionName)
    
    const userRecord = await collection.findOne({ username: username })
    console.log('🔍 MongoDB user record found:', userRecord)
    
    await client.close()
    
    if (userRecord && userRecord.db_name) {
      console.log('🔍 MongoDB db_name found:', userRecord.db_name)
      return userRecord.db_name
    }
    
    console.log('🔍 MongoDB: No db_name found, using fallback database:', process.env._DATABASE_ADMIN)
    return process.env._DATABASE_ADMIN
  } catch (error) {
    console.error('Error getting tenant database from MongoDB:', error)
    console.log('🔍 MongoDB: Error occurred, using fallback database:', process.env._DATABASE_ADMIN)
    return process.env._DATABASE_ADMIN
  }
}

const getTenantPool = async (username) => {
  const tenantDb = await getTenantDatabase(username)
  
  console.log('🔍 Creating tenant pool for database:', tenantDb)
  
  const pool = mysql.createPool({
    host: process.env._HOST_ADMIN,
    user: process.env._USER_ADMIN,
    password: DecryptString(process.env._PASSWORD_ADMIN),
    database: tenantDb,
    multipleStatements: true,
  })
  
  return { pool, tenantDb }
}

const getDatabaseConfig = async (username) => {
  const tenantDb = await getTenantDatabase(username)
  
  return {
    username: process.env._USER_ADMIN,
    password: DecryptString(process.env._PASSWORD_ADMIN),
    database: tenantDb,
    host: process.env._HOST_ADMIN,
    dialect: 'mysql',
    dialectOptions: { multipleStatements: true },
  }
}

const baseConfig = {
  username: process.env._USER_ADMIN,
  password: DecryptString(process.env._PASSWORD_ADMIN),
  database: process.env._DATABASE_ADMIN,
  host: process.env._HOST_ADMIN,
  mongoUrl: process.env._MONGODB_URL,
  sessionCookieName: process.env._SESSION_COLLECTION,
  sessionSecret: process.env._SESSION_SECRET,
  dialect: 'mysql',
  dialectOptions: { multipleStatements: true },
}

const tenantAwareConfig = new Proxy(baseConfig, {
  get(target, prop) {
    if (prop === 'database') {
      const tenantDb = getTenantDbOverride() || target.database
      console.log('🔍 Config Proxy - Database property accessed, returning:', tenantDb)
      return tenantDb
    }
    return target[prop]
  }
})

module.exports = {
  development: tenantAwareConfig,
  test: tenantAwareConfig,
  production: tenantAwareConfig,
  setTenantDb,
  getTenantDatabase,
  getDatabaseConfig,
  getTenantPool,
}
