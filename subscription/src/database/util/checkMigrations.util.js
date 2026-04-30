const mysql = require('mysql2/promise')
const { Sequelize } = require('sequelize')
const { Umzug, SequelizeStorage } = require('umzug')
const { logger } = require('../../util/logger.util')
const CONFIG = require('../../database/config/config')
require('dotenv').config()

const checkMigrations = async (label, migrationPath) => {
  const dbName = CONFIG[process.env.NODE_ENV].database
  const dbUser = CONFIG[process.env.NODE_ENV].username
  const dbPass = CONFIG[process.env.NODE_ENV].password
  const dbHost = CONFIG[process.env.NODE_ENV].host

  const sequelize = new Sequelize(dbName, dbUser, dbPass, {
    host: dbHost,
    dialect: 'mysql',
    logging: false,
  })

  const migrator = new Umzug({
    migrations: { glob: migrationPath },
    context: sequelize.getQueryInterface(),
    storage: new SequelizeStorage({ sequelize }),
    logger: undefined,
  })

  const executedMigrations = await migrator.executed()
  const pendingMigrations = await migrator.pending()

  const allMigrations = [
    ...executedMigrations.map((migration) => ({
      Name: migration.name,
      Status: '✅ up',
    })),
    ...pendingMigrations.map((migration) => ({
      Name: migration.name,
      Status: '⏳ down',
    })),
  ]

  console.log(`\n📂 Migration Status: ${label}`)
  console.table(allMigrations)
  await sequelize.close()
}

;(async () => {
  try {
    const dbName = CONFIG[process.env.NODE_ENV].database
    const dbUser = CONFIG[process.env.NODE_ENV].username
    const dbPass = CONFIG[process.env.NODE_ENV].password
    const dbHost = CONFIG[process.env.NODE_ENV].host

    const connection = await mysql.createConnection({
      host: dbHost,
      user: dbUser,
      password: dbPass,
    })

    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\`;`)
    console.log(`✅ Database '${dbName}' created.`)

    await connection.end()

    // 🔍 Check dev and prod migration folders
    await checkMigrations(
      'Development (migrations)',
      'src/database/migrations/create/*.js',
    )
    await checkMigrations(
      'Production (migrations_prod)',
      'src/database/migrations/alter/*.js',
    )
  } catch (error) {
    logger.error('❌ Error fetching migration status:', error)
  }
})()
