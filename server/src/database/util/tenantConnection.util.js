const mysql = require('mysql2/promise')
const CONFIG = require('../config/config')

// Cache pools per tenant to avoid recreating them constantly
const tenantPools = new Map()

/**
 * Get a MySQL pool for the current tenant
 * This respects the tenant context set by the auth middleware
 */
const getTenantPool = () => {
  let tenantDb = CONFIG.getTenantDbOverride ? CONFIG.getTenantDbOverride() : null
  
  if (!tenantDb) {
    console.log('🔍 Tenant Pool - No tenant DB set, using default database')
    tenantDb = CONFIG[process.env.NODE_ENV].database
  }
  
  // Check if we already have a pool for this tenant
  if (tenantPools.has(tenantDb)) {
    console.log('🔍 Tenant Pool - Reusing existing pool for database:', tenantDb)
    return tenantPools.get(tenantDb)
  }
  
  console.log('🔍 Tenant Pool - Creating new pool for database:', tenantDb)
  
  // Create a new pool for this tenant
  const pool = mysql.createPool({
    host: CONFIG[process.env.NODE_ENV].host,
    user: CONFIG[process.env.NODE_ENV].username,
    password: CONFIG[process.env.NODE_ENV].password,
    database: tenantDb,
    multipleStatements: CONFIG[process.env.NODE_ENV].dialectOptions.multipleStatements,
  })
  
  // Cache the pool
  tenantPools.set(tenantDb, pool)
  
  return pool
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
