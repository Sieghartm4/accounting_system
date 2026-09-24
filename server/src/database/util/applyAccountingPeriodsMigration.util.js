'use strict'
// Applies the accounting_periods migration via the APP's own runtime stack
// (root .env + app config decrypt + tenant pools) instead of the sequelize CLI,
// which cannot decrypt env when spawned from the server dir.
// Usage: node applyAccountingPeriodsMigration.util.js [--reset]
const path = require('path')
const rootDotEnv = path.resolve('..', '..', '.env')
require('dotenv').config({ path: rootDotEnv })

const { sql } = require('./helper.util')
const AccountingModel = require('../database/model/Accounting')
const { getDatabaseConfig } = require('../database/config/config')
const mysql = require('mysql2/promise')

const migration = require('../database/migrations/create/20260922090001-create-accounting_periods')

const reset = process.argv.includes('--reset')

const makeSequelizeShim = () => {
  const tables = []
  const queryInterface = {
    createTable: async (name, attrs, opts) => {
      tables.push({ name, attrs })
      console.log(`✓ createTable ${name} (attrs: ${Object.keys(attrs).length})`)
    },
    addIndex: async () => console.log('✓ addIndex'),
    removeIndex: async () => console.log('✓ removeIndex'),
    dropTable: async (name) => {
      console.log(`✓ dropTable ${name}`)
      tables.splice(tables.indexOf(tables.find((t) => t.name === name)), 1)
    },
    sequelize: {
      query: async () => console.log('✓ arbitrary SQL (trigger) executed'),
    },
  }
  return { queryInterface, tables }
}

const run = async () => {
  const cfg = getDatabaseConfig()
  const connection = await mysql.createConnection({
    host: cfg.host,
    user: cfg.username,
    password: cfg.password,
    database: cfg.database,
    multipleStatements: true,
  })
  try {
    console.log('Connected to base database:', cfg.database)
    const { queryInterface } = makeSequelizeShim()
    if (reset) {
      await migration.down(queryInterface, {})
      console.log('⬇ Down migration applied (trigger dropped, tables dropped)')
    } else {
      await migration.up(queryInterface, {})
      console.log('⬆ Up migration applied')
    }
  } finally {
    await connection.end()
  }
}

run().catch((e) => {
  console.error('Migration runner error:', e)
  process.exit(1)
})
