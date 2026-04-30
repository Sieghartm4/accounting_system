const mysql = require('mysql2/promise')
const { execSync } = require('child_process')
const { logger } = require('../../util/logger.util')
const CONFIG = require('../config/config')
require('dotenv').config({ path: '../.env' })

const createTenantDatabase = async (dbName, userData = null, companyName = null) => {
  try {
    const dbUser = CONFIG[process.env.NODE_ENV].username
    const dbPass = CONFIG[process.env.NODE_ENV].password
    const dbHost = CONFIG[process.env.NODE_ENV].host

    // Create connection without specifying database
    const connection = await mysql.createConnection({
      host: dbHost,
      user: dbUser,
      password: dbPass,
    })

    logger.info(`Creating database: ${dbName}`)

    // Check if database exists
    const [rows] = await connection.query(`SHOW DATABASES LIKE ?`, [dbName])

    if (rows.length === 0) {
      // Create the database
      await connection.query(`CREATE DATABASE \`${dbName}\`;`)
      logger.info(`✅ Database '${dbName}' created.`)
    } else {
      logger.info(`Database '${dbName}' already exists.`)
    }

    await connection.end()

    // Set environment variable for the new database
    const originalDb = process.env._DATABASE_ADMIN
    process.env._DATABASE_ADMIN = dbName

    logger.info(`📦 Running migrations for ${dbName}...`)
    try {
      execSync('npx sequelize-cli db:migrate --migrations-path ./src/database/migrations/subscription', { 
        stdio: 'inherit',
        cwd: process.cwd()
      })
      logger.info(`✅ Migrations completed for ${dbName}`)
    } catch (migrationError) {
      logger.error(`❌ Migration error for ${dbName}:`, migrationError)
      throw migrationError
    }

    logger.info(`🌱 Running seeders for ${dbName}...`)
    try {
      execSync('npx sequelize-cli db:seed:all --seeders-path ./src/database/seeders/subscription', { 
        stdio: 'inherit',
        cwd: process.cwd()
      })
      logger.info(`✅ Seeders completed for ${dbName}`)
    } catch (seederError) {
      logger.error(`❌ Seeder error for ${dbName}:`, seederError)
      throw seederError
    }

    // Insert user data into tenant master_user table if userData is provided
    if (userData) {
      try {
        const tenantConnection = await mysql.createConnection({
          host: dbHost,
          user: dbUser,
          password: dbPass,
          database: dbName
        })

        logger.info(`👤 Inserting user data into ${dbName} master_user table...`)
        
        const insertUserQuery = `
          INSERT INTO master_user (mu_fullname, mu_username, mu_password, mu_access_id, mu_status) 
          VALUES (?, ?, ?, ?, ?)
        `
        
        await tenantConnection.query(insertUserQuery, [
          userData.username,  // fullname = username
          userData.username,  // username
          userData.password,  // password (already hashed)
          1,                 // access_id = 1
          'active'           // status = active
        ])

        await tenantConnection.end()
        logger.info(`✅ User data inserted into ${dbName} master_user table`)
      } catch (userInsertError) {
        logger.error(`❌ Error inserting user data into ${dbName}:`, userInsertError)
      }
    }

    // Insert company data into tenant master_company table if companyName is provided
    if (companyName) {
      try {
        const companyConnection = await mysql.createConnection({
          host: dbHost,
          user: dbUser,
          password: dbPass,
          database: dbName
        })

        logger.info(`🏢 Inserting company data into ${dbName} master_company table...`)
        
        const insertCompanyQuery = `
          INSERT INTO master_company (mc_company_name, mc_status) 
          VALUES (?, ?)
        `
        
        await companyConnection.query(insertCompanyQuery, [
          companyName,
          'active'
        ])

        await companyConnection.end()
        logger.info(`✅ Company data inserted into ${dbName} master_company table`)
      } catch (companyInsertError) {
        logger.error(`❌ Error inserting company data into ${dbName}:`, companyInsertError)
      }
    }

    // Restore original database environment variable
    process.env._DATABASE_ADMIN = originalDb

    logger.info(`✅ Tenant database setup complete for ${dbName}`)
    return true

  } catch (error) {
    logger.error(`❌ Error creating tenant database ${dbName}:`, error)
    throw error
  }
}

module.exports = { createTenantDatabase }
