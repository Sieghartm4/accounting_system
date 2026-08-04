const mysql = require('mysql2/promise')
const CONFIG = require('../config/config')
const { DecryptString } = require('../../util/cryptography.util')

// Cache pools per tenant to avoid recreating them constantly
const tenantPools = new Map()

/**
 * Get a MySQL pool for the current tenant with optional user context
 * This respects the tenant context set by the auth middleware
 */
const getTenantPool = (tenantDb = null, userId = null) => {
  let db
  
  // If tenantDb is explicitly provided, use it (request-specific)
  if (tenantDb) {
    db = tenantDb
    console.log('🔍 Tenant Pool - Using provided tenantDb:', db)
  } else {
    // Fall back to global config (legacy behavior)
    db = CONFIG.getTenantDbOverride ? CONFIG.getTenantDbOverride() : null
    if (!db) {
      console.log('🔍 Tenant Pool - No tenant DB set, using default database')
      db = CONFIG[process.env.NODE_ENV].database
    }
  }
  
  // Create cache key that includes userId to isolate users in same tenant
  const cacheKey = userId ? `${db}:${userId}` : db
  
  // Check if we already have a pool for this tenant/user combination
  if (tenantPools.has(cacheKey)) {
    console.log('🔍 Tenant Pool - Reusing existing pool for:', cacheKey)
    return tenantPools.get(cacheKey)
  }
  
  console.log('🔍 Tenant Pool - Creating new pool for:', cacheKey)
  
  const pool = createPoolForDb(db)
  tenantPools.set(cacheKey, pool)
  
  return pool
}

/**
 * Create a pool for a specific database
 */
const createPoolForDb = (database) => {
  return mysql.createPool({
    host: process.env._HOST_ADMIN,
    user: process.env._USER_ADMIN,
    password: DecryptString(process.env._PASSWORD_ADMIN),
    database: database,
    multipleStatements: true,
  })
}

/**
 * Execute a query with tenant-aware connection
 * This ensures the query runs against the correct tenant database
 */
const executeQuery = async (query, params = []) => {
  const pool = getTenantPool()
  try {
    const [results] = await pool.execute(query, params)
    return results
  } catch (error) {
    console.error('🔍 Tenant Query Error:', error)
    throw error
  }
}

/**
 * Close all tenant pools (useful for graceful shutdown)
 */
const closeAllPools = async () => {
  console.log('🔍 Tenant Pool - Closing all pools...')
  const closePromises = []
  
  for (const [tenantDb, pool] of tenantPools) {
    console.log('🔍 Tenant Pool - Closing pool for database:', tenantDb)
    closePromises.push(pool.end())
  }
  
  await Promise.all(closePromises)
  tenantPools.clear()
  console.log('🔍 Tenant Pool - All pools closed')
}

module.exports = {
  getTenantPool,
  executeQuery,
  closeAllPools
}
