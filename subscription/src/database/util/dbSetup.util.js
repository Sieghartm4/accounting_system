const mysql = require('mysql2/promise')
const { execSync } = require('child_process')
const { logger } = require('../../util/logger.util')
const CONFIG = require('../config/config')
require('dotenv').config()
;(async () => {
  const environment = process.env.NODE_ENV || 'development'
  const config = CONFIG[environment]
  if (!config) {
    throw new Error(
      `Unsupported NODE_ENV "${environment}". Expected development, test, or production.`,
    )
  }
  const dbName = config.database
  const dbUser = config.username
  const dbPass = config.password
  const dbHost = config.host
  console.log('🔍 DB Setup - Database Name:', dbName)
  try {
    const connection = await mysql.createConnection({
      host: dbHost,
      user: dbUser,
      password: dbPass,
    })

    const [rows] = await connection.query(`SHOW DATABASES LIKE ?`, [dbName])

    if (rows.length === 0) {
      await connection.query(`CREATE DATABASE \`${dbName}\`;`)
      logger.info(`✅ Database '${dbName}' created.`)
    } else {
      logger.info(`Database '${dbName}' already exists.`)
    }

    await connection.end()

    logger.info(`📦 Running migrations...`)
    execSync('npx sequelize-cli db:migrate', { stdio: 'inherit' })

    logger.info(`🌱 Running seeders...`)
    execSync('npx sequelize-cli db:seed:all', { stdio: 'inherit' })

    logger.info(`🔄 Generating models from migrations...`)
    // Execute the model generator script
    try {
      require('./generateModels.util')
      logger.info(`✅ Models generated successfully`)
    } catch (error) {
      logger.error(`❌ Error generating models:`, error)
      throw error
    }

    logger.info(`📋 Generating schemas from models...`)
    // Execute the schema generator script
    try {
      require('./generateSchema.util')
      logger.info(`✅ Schemas generated successfully`)
    } catch (error) {
      logger.error(`❌ Error generating schemas:`, error)
      throw error
    }

    logger.info(`✅ Database setup complete.`)
  } catch (error) {
    if (
      error.code === 'ER_DBACCESS_DENIED_ERROR' ||
      error.code === 'ER_TABLEACCESS_DENIED_ERROR'
    ) {
      console.error(
        `❌ MySQL user "${dbUser}" can connect but cannot create or access database "${dbName}". ` +
          'Use a database administrator account for setup, or grant this user the required privileges.',
      )
      console.error(
        `Required setup grant: GRANT ALL PRIVILEGES ON \`${dbName}\`.* TO '${dbUser}'@'localhost';`,
      )
    }
    console.error('❌ Error during DB setup:', error)
    process.exit(1)
  }
})()
