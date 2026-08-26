const mysql = require('mysql2/promise')
const { execSync } = require('child_process')
const { logger } = require('../../util/logger.util')
const CONFIG = require('../config/config')
require('dotenv').config({ path: '../.env' })

const createTenantDatabase = async (dbName, userData = null, companyName = null, progressCallback = null) => {
  const emitProgress = (step, message, progress) => {
    if (progressCallback) {
      progressCallback({ step, message, progress })
    }
  }

  try {
    const dbUser = CONFIG[process.env.NODE_ENV].username
    const dbPass = CONFIG[process.env.NODE_ENV].password
    const dbHost = CONFIG[process.env.NODE_ENV].host

    emitProgress('creating_database', 'Creating your database...', 10)

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
      emitProgress('creating_database', 'Database created successfully!', 20)
    } else {
      logger.info(`Database '${dbName}' already exists.`)
      emitProgress('creating_database', 'Database already exists, skipping...', 20)
    }

    await connection.end()

    // Set environment variable for the new database
    const originalDb = process.env._DATABASE_ADMIN
    process.env._DATABASE_ADMIN = dbName

    // Emit progress before blocking operations
    emitProgress('running_migrations', 'Running database migrations (this may take a while)...', 30)
    
    // Force a small delay to ensure the progress event is sent before blocking
    await new Promise(resolve => setTimeout(resolve, 100))
    
    logger.info(`📦 Running migrations for ${dbName}...`)
    try {
      execSync(
        'npx sequelize-cli db:migrate --migrations-path ./src/database/migrations/subscription',
        {
          stdio: 'inherit',
          cwd: process.cwd(),
        },
      )
      logger.info(`✅ Migrations completed for ${dbName}`)
      emitProgress('running_migrations', 'Migrations completed!', 60)
    } catch (migrationError) {
      logger.error(`❌ Migration error for ${dbName}:`, migrationError)
      emitProgress('error', 'Migration failed. Please try again.', 0)
      throw migrationError
    }

    // Emit progress before seeders
    emitProgress('running_seeders', 'Running database seeders (this may take a while)...', 70)
    
    // Force a small delay to ensure the progress event is sent before blocking
    await new Promise(resolve => setTimeout(resolve, 100))
    
    logger.info(`🌱 Running seeders for ${dbName}...`)
    try {
      execSync(
        'npx sequelize-cli db:seed:all --seeders-path ./src/database/seeders/subscription',
        {
          stdio: 'inherit',
          cwd: process.cwd(),
        },
      )
      logger.info(`✅ Seeders completed for ${dbName}`)
      emitProgress('running_seeders', 'Seeders completed!', 85)
    } catch (seederError) {
      logger.error(`❌ Seeder error for ${dbName}:`, seederError)
      emitProgress('error', 'Seeders failed. Please try again.', 0)
      throw seederError
    }

    // Insert user data into tenant master_user table if userData is provided
    if (userData) {
      emitProgress('creating_user', 'Setting up your user account...', 90)
      try {
        const tenantConnection = await mysql.createConnection({
          host: dbHost,
          user: dbUser,
          password: dbPass,
          database: dbName,
        })

        logger.info(`👤 Inserting user data into ${dbName} master_user table...`)

        // Check if mu_role column exists, add if not
        try {
          const [columns] = await tenantConnection.query(`
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'master_user' AND COLUMN_NAME = 'mu_role'
          `, [dbName])
          
          if (columns.length === 0) {
            logger.info(`Adding mu_role column to ${dbName}.master_user...`)
            await tenantConnection.query(`
              ALTER TABLE master_user 
              ADD COLUMN mu_role ENUM('ADMIN', 'USER') NOT NULL DEFAULT 'USER'
            `)
          }
        } catch (roleCheckError) {
          logger.error(`Error checking/adding mu_role column:`, roleCheckError)
        }

        // Check if subscription_id column exists, add if not
        try {
          const [columns] = await tenantConnection.query(`
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'master_user' AND COLUMN_NAME = 'subscription_id'
          `, [dbName])
          
          if (columns.length === 0) {
            logger.info(`Adding subscription_id column to ${dbName}.master_user...`)
            await tenantConnection.query(`
              ALTER TABLE master_user 
              ADD COLUMN subscription_id INTEGER NULL
            `)
          }
        } catch (subCheckError) {
          logger.error(`Error checking/adding subscription_id column:`, subCheckError)
        }

        const insertUserQuery = `
          INSERT INTO master_user (mu_fullname, mu_username, mu_password, mu_access_id, mu_email, mu_status, mu_role, subscription_id) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `

        await tenantConnection.query(insertUserQuery, [
          userData.username, // fullname = username
          userData.username, // username
          userData.password, // password (already hashed)
          1, // access_id = 1
          userData.email || null, // email
          'active', // status = active
          'USER', // role = USER
          userData.subscription_id || null, // subscription_id
        ])

        await tenantConnection.end()
        logger.info(`✅ User data inserted into ${dbName} master_user table`)
      } catch (userInsertError) {
        logger.error(`❌ Error inserting user data into ${dbName}:`, userInsertError)
        emitProgress('error', 'Failed to create user account. Please try again.', 0)
        throw userInsertError
      }
    }

    // Insert company data into tenant master_company table if companyName is provided
    if (companyName) {
      try {
        const companyConnection = await mysql.createConnection({
          host: dbHost,
          user: dbUser,
          password: dbPass,
          database: dbName,
        })

        logger.info(
          `🏢 Inserting company data into ${dbName} master_company table...`,
        )

        const insertCompanyQuery = `
          INSERT INTO master_company (mc_company_name, mc_status) 
          VALUES (?, ?)
        `

        await companyConnection.query(insertCompanyQuery, [companyName, 'active'])

        await companyConnection.end()
        logger.info(`✅ Company data inserted into ${dbName} master_company table`)
      } catch (companyInsertError) {
        logger.error(
          `❌ Error inserting company data into ${dbName}:`,
          companyInsertError,
        )
      }
    }

    // Restore original database environment variable
    process.env._DATABASE_ADMIN = originalDb

    logger.info(`✅ Tenant database setup complete for ${dbName}`)
    emitProgress('complete', 'Setup complete!', 100)
    return true
  } catch (error) {
    logger.error(`❌ Error creating tenant database ${dbName}:`, error)
    emitProgress('error', 'Setup failed. Please try again.', 0)
    throw error
  }
}

module.exports = { createTenantDatabase }
