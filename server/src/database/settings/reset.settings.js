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

const ask = (question) =>
  new Promise((resolve) => {
    rl.question(question, (answer) => resolve(answer ? answer.trim() : ''))
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

    logger.info(`✅ Database reset complete for: ${databaseName}`)
  } catch (error) {
    logger.error(`❌ Database reset failed for ${databaseName}:`, error)
    process.exit(1)
  }
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
    const confirmValue = await ask(
      `⚠️  Reset database '${requestedDb}'? Type 'yes' to continue: `,
    )
    rl.close()
    if (confirmValue.toLowerCase() !== 'yes') {
      logger.info('Cancelled database reset.')
      process.exit(0)
    }
    await resetDatabase(requestedDb)
    return
  }

  if (choices.length === 0) {
    rl.close()
    logger.error(
      'No databases available to reset. Please set _DATABASE_ADMIN or configure tenant discovery.',
    )
    process.exit(1)
  }

  console.log('\nAvailable databases:')
  choices.forEach((db, index) => {
    const marker = db === currentDb ? ' (configured)' : ''
    console.log(`  [${index + 1}] ${db}${marker}`)
  })
  console.log('  [q] Cancel')

  let selection
  while (selection === undefined) {
    const answer = await ask('\nEnter the number of the database to reset: ')
    if (!answer) {
      console.log('Please enter a number or q to cancel.')
      continue
    }

    if (answer.toLowerCase() === 'q' || answer.toLowerCase() === 'c') {
      rl.close()
      logger.info('Cancelled database reset.')
      process.exit(0)
    }

    const index = Number(answer) - 1
    if (!Number.isInteger(index) || index < 0 || index >= choices.length) {
      console.log('Invalid selection. Choose a valid number from the list.')
      continue
    }

    selection = choices[index]
  }

  const confirmAnswer = await ask(
    `⚠️  This will DROP, CREATE, MIGRATE, and SEED '${selection}'. Type 'yes' to continue: `,
  )
  rl.close()

  if (confirmAnswer.toLowerCase() !== 'yes') {
    logger.info('Cancelled database reset.')
    process.exit(0)
  }

  await resetDatabase(selection)
}

main()
