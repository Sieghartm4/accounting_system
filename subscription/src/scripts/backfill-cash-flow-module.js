require('dotenv').config()
/**
 * One-time backfill: grants the cash_flow_statement module to every existing
 * subscription plan.
 *
 * cash_flow_statement was moved into DEFAULT_ON_MODULES (included in the
 * default template, admin may deselect). Admins only rewrite a plan's modules
 * when they re-save it in the subscription editor, so existing plans would
 * otherwise never receive the module. This script inserts the plan_modules row
 * for every plan where it is missing - the same write the editor performs.
 *
 * Run: node subscriptions-backfill-cash-flow.js (from the server root, or
 * anywhere - paths resolve relative to the subscription service).
 */
const mysql = require('mysql2/promise')
const CONFIG = require('../database/config/config')

const env = process.env.NODE_ENV || 'development'
const pool = mysql.createPool({
  host: CONFIG[env].host,
  user: CONFIG[env].username,
  password: CONFIG[env].password,
  database: CONFIG[env].database,
})

const MODULE = 'cash_flow_statement'

const run = async () => {
  const [plans] = await pool.query('SELECT sp_id, sp_name FROM subscription_plans')
  if (!plans.length) {
    console.log('No subscription plans found - nothing to backfill.')
    return
  }

  let inserted = 0
  for (const plan of plans) {
    const [exists] = await pool.query(
      `SELECT pm_id FROM plan_modules
        WHERE pm_plan_id = ? AND pm_module = ?
        LIMIT 1`,
      [plan.sp_id, MODULE],
    )
    if (exists.length) {
      console.log(`  = plan ${plan.sp_id} (${plan.sp_name}): already granted`)
      continue
    }
    await pool.query(
      'INSERT INTO plan_modules (pm_plan_id, pm_module) VALUES (?, ?)',
      [plan.sp_id, MODULE],
    )
    inserted++
    console.log(`  + plan ${plan.sp_id} (${plan.sp_name}): granted`)
  }
  console.log(`Backfill complete. ${inserted} plan(s) updated out of ${plans.length}.`)
  return inserted
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Backfill failed:', err.message)
    process.exit(1)
  })
