const mysql = require('mysql2/promise')
const readline = require('readline')
const { execSync } = require('child_process')
const { logger } = require('../../util/logger.util')
const { DecryptString } = require('../../util/cryptography.util')
require('dotenv').config()

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
})

// When stdin closes (piped input, Ctrl+Z / Ctrl+C) a pending rl.question is
// never answered and rl.question on a closed interface throws
// ERR_USE_AFTER_CLOSE. Resolve the pending ask with null so every caller can
// treat it as "cancelled" instead of crashing or hanging.
let rlClosed = false
let pendingResolve = null
rl.on('close', () => {
  rlClosed = true
  if (pendingResolve) {
    const resolve = pendingResolve
    pendingResolve = null
    resolve(null)
  }
})

const ask = (question) =>
  new Promise((resolve) => {
    if (rlClosed) {
      resolve(null)
      return
    }
    pendingResolve = resolve
    rl.question(question, (answer) => {
      pendingResolve = null
      resolve(answer ? answer.trim() : '')
    })
  })

const getTenantDbFromArgs = () => {
  const raw = process.argv.slice(2)
  if (raw.length === 0) return null

  const dbEq = raw.find((a) => a.startsWith('--db='))
  if (dbEq) return dbEq.split('=').slice(1).join('=').trim() || null

  const dbIndex = raw.findIndex((a) => a === '--db')
  if (dbIndex >= 0) return raw[dbIndex + 1]?.trim() || null

  return raw[0]?.trim() || null
}

const getConnectionOptions = () => {
  const host = process.env._HOST_ADMIN
  const user = process.env._USER_ADMIN
  let password
  try {
    password = DecryptString(process.env._PASSWORD_ADMIN)
  } catch (err) {
    password = process.env._PASSWORD_ADMIN
  }

  if (!host || !user) {
    return null
  }

  const options = {
    host,
    user,
    password,
  }

  if (process.env._DATABASE_ADMIN) {
    options.database = process.env._DATABASE_ADMIN
  }

  return options
}

const getAdminConnection = async () => {
  const options = getConnectionOptions()
  if (!options) {
    logger.warn('Admin database connection variables are missing.')
    return null
  }

  try {
    return await mysql.createConnection(options)
  } catch (error) {
    logger.warn(
      'Unable to connect to admin database for tenant discovery.',
      error.message,
    )
    return null
  }
}

const getTenantDatabases = async (connection) => {
  if (!connection) return []

  try {
    const [rows] = await connection.query(
      `SELECT DISTINCT db_name FROM master_user WHERE db_name IS NOT NULL AND db_name <> ''`,
    )
    return rows.map((row) => row.db_name).filter(Boolean)
  } catch (error) {
    logger.warn(
      'Unable to fetch tenant list from master_user, falling back to SHOW DATABASES.',
      error.message,
    )
    try {
      const [databases] = await connection.query('SHOW DATABASES')
      return databases
        .map((row) => Object.values(row)[0])
        .filter((db) => typeof db === 'string' && db.length > 0)
    } catch (fallbackError) {
      logger.warn(
        'Unable to list databases via SHOW DATABASES.',
        fallbackError.message,
      )
      return []
    }
  }
}

const hasDuplicate = (list, value) => list.some((item) => item === value)

const formatDatabaseList = (databases, currentDb) => {
  const unique = []
  if (currentDb && !hasDuplicate(unique, currentDb)) {
    unique.push(currentDb)
  }

  for (const db of databases) {
    if (db && !hasDuplicate(unique, db)) {
      unique.push(db)
    }
  }

  return unique
}

// A fresh tenant database only gets the seeded default user. Everyone who
// actually belongs to this company lives in the subscription database's
// master_user (matched by db_name), so recreate those rows here — copying the
// stored password as-is so existing credentials keep working.
const syncUsersFromSubscription = async (databaseName) => {
  if (isMasterDb(databaseName)) return true

  const options = getConnectionOptions()
  if (!options) {
    logger.warn('Admin database connection variables are missing. Skipping user sync.')
    return true
  }

  let admin
  let tenant
  try {
    admin = await mysql.createConnection(options)
    tenant = await mysql.createConnection({ ...options, database: databaseName })

    const [subscriptionUsers] = await admin.query(
      'SELECT mu_username, mu_password, mu_email, mu_status, mu_role FROM master_user WHERE db_name = ?',
      [databaseName],
    )

    if (subscriptionUsers.length === 0) {
      logger.info(`No subscription users found for '${databaseName}'. Skipping user sync.`)
      return true
    }

    const [tenantAccessRows] = await tenant.query(
      'SELECT ma_access_id, ma_access_name FROM master_access',
    )
    const adminAccessId =
      tenantAccessRows.find((row) => /admin/i.test(row.ma_access_name))?.ma_access_id ||
      tenantAccessRows[0]?.ma_access_id ||
      1
    const userAccessId =
      tenantAccessRows.find((row) => !/admin/i.test(row.ma_access_name))?.ma_access_id ||
      adminAccessId

    const [existingUsernames] = await tenant.query('SELECT mu_username FROM master_user')
    const existing = new Set(existingUsernames.map((row) => row.mu_username.toLowerCase()))

    let inserted = 0
    for (const user of subscriptionUsers) {
      const username = (user.mu_username || '').trim()
      const password = user.mu_password
      if (!username || !password) continue
      if (existing.has(username.toLowerCase())) continue

      // The subscription table allows mixed case ('ACTIVE'); the tenant enum is
      // lowercase. Anything unrecognized falls back to 'active'.
      const status = String(user.mu_status || '').toLowerCase() === 'inactive' ? 'inactive' : 'active'
      const accessId =
        String(user.mu_role || '').toUpperCase() === 'ADMIN' ? adminAccessId : userAccessId

      await tenant.query(
        'INSERT INTO master_user (mu_fullname, mu_username, mu_password, mu_access_id, mu_email, mu_status) VALUES (?, ?, ?, ?, ?, ?)',
        [username, username, password, accessId, user.mu_email || null, status],
      )
      inserted += 1
    }

    logger.info(
      `👤 Recreated ${inserted} user(s) from the subscription database in '${databaseName}'.`,
    )
    return true
  } catch (error) {
    logger.error(
      `❌ Failed to recreate subscription users in '${databaseName}':`,
      error.message,
    )
    return false
  } finally {
    if (admin) await admin.end().catch(() => {})
    if (tenant) await tenant.end().catch(() => {})
  }
}

const runCommand = (command, env) => {
  logger.info(`📌 ${command}`)
  execSync(command, {
    stdio: 'inherit',
    cwd: process.cwd(),
    env,
  })
}

const resetDatabase = async (databaseName) => {
  const env = {
    ...process.env,
    _DATABASE_ADMIN: databaseName,
    NODE_ENV: process.env.NODE_ENV || 'development',
  }

  try {
    logger.info(`🧹 Resetting database: ${databaseName}`)
    try {
      runCommand('npx sequelize-cli db:drop', env)
    } catch (dropError) {
      const message = dropError.message || ''
      if (/Unknown database|doesn't exist|cannot drop database/i.test(message)) {
        logger.warn(
          `Database '${databaseName}' does not exist or could not be dropped. Continuing with create.`,
        )
      } else {
        throw dropError
      }
    }

    runCommand('npx sequelize-cli db:create', env)
    runCommand('npm run db:migrate', env)
    runCommand('npm run db:seed', env)

    const usersSynced = await syncUsersFromSubscription(databaseName)
    if (!usersSynced) {
      logger.warn(
        `⚠️  Database '${databaseName}' was reset, but subscription users could not be recreated.`,
      )
    }

    logger.info(`✅ Database reset complete for: ${databaseName}`)
    return true
  } catch (error) {
    logger.error(`❌ Database reset failed for ${databaseName}:`, error)
    return false
  }
}

// Databases that must never be wiped by this tool: the master/subscription
// database holds master_user, master_access, and every tenant's entitlements.
const MASTER_DB_NAMES = ['subscription', 'mysql', 'information_schema', 'performance_schema', 'sys']
const isMasterDb = (name) =>
  MASTER_DB_NAMES.some((m) => String(name).toLowerCase().includes(m))

const confirmOrCancel = async (prompt) => {
  const answer = await ask(prompt)
  rl.close()
  if (answer === null) {
    logger.info('Input closed. Cancelled database reset.')
    return false
  }
  if (answer.toLowerCase() !== 'yes') {
    logger.info('Cancelled database reset.')
    return false
  }
  return true
}

const main = async () => {
  const requestedDb = getTenantDbFromArgs()
  const currentDb = process.env._DATABASE_ADMIN

  let databases = []
  const connection = await getAdminConnection()

  if (connection) {
    databases = await getTenantDatabases(connection)
    await connection.end()
  }

  const choices = formatDatabaseList(databases, currentDb)

  if (requestedDb) {
    if (!choices.includes(requestedDb)) {
      choices.push(requestedDb)
    }
    const confirmed = await confirmOrCancel(
      `⚠️  Reset database '${requestedDb}'? Type 'yes' to continue: `,
    )
    if (!confirmed) {
      process.exit(0)
    }
    const ok = await resetDatabase(requestedDb)
    process.exit(ok ? 0 : 1)
    return
  }

  if (choices.length === 0) {
    rl.close()
    logger.error(
      'No databases available to reset. Please set _DATABASE_ADMIN or configure tenant discovery.',
    )
    process.exit(1)
  }

  const companyDatabases = choices.filter((db) => !isMasterDb(db) && db !== currentDb)

  console.log('\nAvailable databases:')
  choices.forEach((db, index) => {
    const marker = db === currentDb ? ' (configured)' : ''
    console.log(`  [${index + 1}] ${db}${marker}`)
  })
  if (companyDatabases.length > 0) {
    console.log(`  [a] ALL ${companyDatabases.length} company database(s)`)
  }
  console.log('  [q] Cancel')

  let selection
  let resetAll = false
  while (selection === undefined && !resetAll) {
    const answer = await ask('\nEnter the number of the database to reset: ')

    if (answer === null) {
      rl.close()
      logger.info('Input closed. Cancelled database reset.')
      process.exit(0)
    }

    if (!answer) {
      console.log('Please enter a number, a for all, or q to cancel.')
      continue
    }

    if (answer.toLowerCase() === 'q' || answer.toLowerCase() === 'c') {
      rl.close()
      logger.info('Cancelled database reset.')
      process.exit(0)
    }

    if (answer.toLowerCase() === 'a') {
      if (companyDatabases.length === 0) {
        console.log('No company databases available to reset.')
        continue
      }
      resetAll = true
      break
    }

    const index = Number(answer) - 1
    if (!Number.isInteger(index) || index < 0 || index >= choices.length) {
      console.log('Invalid selection. Choose a valid number from the list.')
      continue
    }

    selection = choices[index]
  }

  if (resetAll) {
    const list = companyDatabases.join(', ')
    const confirmed = await confirmOrCancel(
      `⚠️  This will DROP, CREATE, MIGRATE, and SEED ${companyDatabases.length} database(s): ${list}. Type 'yes' to continue: `,
    )
    if (!confirmed) {
      process.exit(0)
    }

    let failed = []
    for (const db of companyDatabases) {
      const ok = await resetDatabase(db)
      if (!ok) {
        failed.push(db)
      }
    }

    if (failed.length > 0) {
      logger.error(`❌ Reset failed for: ${failed.join(', ')}`)
      process.exit(1)
    }
    process.exit(0)
    return
  }

  const confirmed = await confirmOrCancel(
    `⚠️  This will DROP, CREATE, MIGRATE, and SEED '${selection}'. Type 'yes' to continue: `,
  )
  if (!confirmed) {
    process.exit(0)
  }

  const ok = await resetDatabase(selection)
  process.exit(ok ? 0 : 1)
}

main()
