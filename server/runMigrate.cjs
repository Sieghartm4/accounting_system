'use strict'
// Thin wrapper: runs the sequelize-cli main module in-process so that root .env
// vars (injected via node --env-file) survive into config.js / cryptography.
// Usage: node --env-file="D:\5L_SYSTEMS\accounting_system\.env" runMigrate.cjs migrate|migrate:status
const { spawnSync } = require('child_process')
const path = require('path')

const args = process.argv.slice(2)
const cliMain = require.resolve('sequelize-cli/lib/sequelize')

const res = spawnSync(process.execPath, [cliMain, ...args], {
  stdio: 'inherit',
  cwd: process.cwd(),
  env: process.env,
  shell: false,
})
process.exit(res.status === null ? 1 : res.status)
