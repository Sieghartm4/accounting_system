const os = require('os')
const { checkConnection, SelectAll, Query, Transaction } = require('../database/util/queries.util')
const { formatMemoryUsage, formatTime, DataModeling } = require('../util/helper.util')
const { Master } = require('../database/model/Master')
const { SQLQueryBuilder } = require('../util/helper.util')
const sql = new SQLQueryBuilder()
const mysql = require('mysql2/promise')
const CONFIG = require('../database/config/config')

const pool = mysql.createPool({
  host: CONFIG[process.env.NODE_ENV].host,
  user: CONFIG[process.env.NODE_ENV].username,
  password: CONFIG[process.env.NODE_ENV].password,
  database: CONFIG[process.env.NODE_ENV].database,
  multipleStatements: CONFIG[process.env.NODE_ENV].dialectOptions.multipleStatements,
})

require('dotenv').config()

const getUsers = async (req, res, next) => {
  let connection
  try {
    connection = await pool.getConnection()

    const query = `
      SELECT 
        mu.mu_id as id,
        mu.mu_username as username,
        mu.db_name as db_name,
        mu.mu_email as email,
        mu.mu_status as status,
        mu.mu_role as role,
        mu.subscription_id as subscription_id,
        sp.sp_name as subscription_plan_name,
        sp.sp_status as subscription_plan_status
      FROM master_user mu
      LEFT JOIN subscription_plans sp ON mu.subscription_id = sp.sp_id
      ORDER BY mu.mu_id ASC
    `

    const [users] = await connection.execute(query)

    res.status(200).json({
      success: true,
      message: 'Users retrieved successfully',
      data: users,
      count: users.length,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error fetching users:', error)
    return res.status(500).json({ 
      success: false,
      message: 'Server error while fetching users',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    })
  } finally {
    if (connection) {
      connection.release()
    }
  }
}

const updateUserSubscription = async (req, res, next) => {
  let connection
  try {
    const { id } = req.params
    const { subscription_id } = req.body

    connection = await pool.getConnection()
    await connection.beginTransaction()

    try {
      // Get current user subscription
      const [currentUser] = await connection.execute(
        'SELECT subscription_id FROM master_user WHERE mu_id = ?',
        [id]
      )

      if (currentUser.length === 0) {
        await connection.rollback()
        return res.status(404).json({
          success: false,
          message: 'User not found'
        })
      }

      const currentSubscriptionId = currentUser[0].subscription_id

      // If changing subscription, expire the old one in subscription_history
      if (currentSubscriptionId && currentSubscriptionId !== subscription_id) {
        await connection.execute(
          `UPDATE subscription_history
           SET sh_end_date = NOW(), sh_status = 'expired'
           WHERE sh_mu_id = ? AND sh_subscription_id = ? AND sh_status = 'active'`,
          [id, currentSubscriptionId]
        )
      }

      // Update user's subscription_id
      await connection.execute(
        'UPDATE master_user SET subscription_id = ? WHERE mu_id = ?',
        [subscription_id, id]
      )

      // If new subscription is provided, add entry to subscription_history
      if (subscription_id) {
        // Get plan details and billing cycle from plan items
        const [plan] = await connection.execute(
          'SELECT sp_name FROM subscription_plans WHERE sp_id = ?',
          [subscription_id]
        )

        const [planItems] = await connection.execute(
          `SELECT spi_details FROM subscription_plan_items
           WHERE spi_subscription_plan_id = ? AND spi_type = 'BILLING_CYCLE'
           ORDER BY spi_display_order ASC LIMIT 1`,
          [subscription_id]
        )

        let billingCycle = '30 days'
        let billingDays = 30

        if (planItems.length > 0) {
          billingCycle = planItems[0].spi_details
          // Parse billing cycle to get days
          if (billingCycle.includes('365')) {
            billingDays = 365
            billingCycle = '1 year'
          } else if (billingCycle.includes('30')) {
            billingDays = 30
            billingCycle = '1 month'
          } else if (billingCycle.includes('7')) {
            billingDays = 7
            billingCycle = '1 week'
          } else if (billingCycle.includes('year')) {
            billingDays = 365
            billingCycle = '1 year'
          } else if (billingCycle.includes('month')) {
            billingDays = 30
            billingCycle = '1 month'
          } else if (billingCycle.includes('week')) {
            billingDays = 7
            billingCycle = '1 week'
          }
        }

        if (plan.length > 0) {
          // Calculate expiry date based on actual billing cycle
          const startDate = new Date()
          const endDate = new Date()
          endDate.setDate(endDate.getDate() + billingDays)

          await connection.execute(
            `INSERT INTO subscription_history
             (sh_mu_id, sh_subscription_id, sh_price, sh_billing_cycle, sh_payment_method, sh_start_date, sh_end_date, sh_status, sh_created_at, sh_updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'active', NOW(), NOW())`,
            [id, subscription_id, 0, billingCycle, 'ADMIN_CHANGE', startDate, endDate]
          )
        }
      }

      await connection.commit()

      res.status(200).json({
        success: true,
        message: 'User subscription updated successfully',
        timestamp: new Date().toISOString()
      })
    } catch (error) {
      await connection.rollback()
      throw error
    }
  } catch (error) {
    console.error('Error updating user subscription:', error)
    return res.status(500).json({ 
      success: false,
      message: 'Server error while updating user subscription',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    })
  } finally {
    if (connection) {
      connection.release()
    }
  }
}

module.exports = {
  getUsers,
  updateUserSubscription,
}
