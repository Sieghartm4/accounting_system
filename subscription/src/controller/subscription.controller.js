const { checkConnection, SelectAll, Query, Transaction } = require('../database/util/queries.util')
const { SQLQueryBuilder } = require('../util/helper.util')
const mysql = require('mysql2/promise')
const CONFIG = require('../database/config/config')
const sql = new SQLQueryBuilder()

const pool = mysql.createPool({
  host: CONFIG[process.env.NODE_ENV].host,
  user: CONFIG[process.env.NODE_ENV].username,
  password: CONFIG[process.env.NODE_ENV].password,
  database: CONFIG[process.env.NODE_ENV].database,
  multipleStatements: CONFIG[process.env.NODE_ENV].dialectOptions.multipleStatements,
})

// Admin pool for fetching subscription plans from admin database
const adminPool = mysql.createPool({
  host: CONFIG[process.env.NODE_ENV].host,
  user: CONFIG[process.env.NODE_ENV].username,
  password: CONFIG[process.env.NODE_ENV].password,
  database: CONFIG[process.env.NODE_ENV].database,
  multipleStatements: true,
})

const Subscription = {
  subscription_plans: {
    tablename: 'subscription_plans',
    prefix: 'sp',
    prefix_: 'sp_',
    insertColumns: [
      'sp_code',
      'sp_name',
      'sp_description',
      'sp_status',
    ],
    selectColumns: [
      'sp_id',
      'sp_code',
      'sp_name',
      'sp_description',
      'sp_status',
    ],
    selectOptionColumns: {
      id: 'sp_id',
      code: 'sp_code',
      name: 'sp_name',
      description: 'sp_description',
      status: 'sp_status',
    },
  },
  subscription_plan_items: {
    tablename: 'subscription_plan_items',
    prefix: 'spi',
    prefix_: 'spi_',
    insertColumns: [
      'spi_subscription_plan_id',
      'spi_type',
      'spi_details',
      'spi_display_order',
    ],
    selectColumns: [
      'spi_id',
      'spi_subscription_plan_id',
      'spi_type',
      'spi_details',
      'spi_display_order',
    ],
    selectOptionColumns: {
      id: 'spi_id',
      subscription_plan_id: 'spi_subscription_plan_id',
      type: 'spi_type',
      details: 'spi_details',
      display_order: 'spi_display_order',
    },
  },
}

const getSubscriptionPlans = async (req, res, next) => {
  try {
    const query = sql
      .select(Subscription.subscription_plans.selectColumns)
      .from(Subscription.subscription_plans.tablename)
      .build()

    const plans = await Query(query, [])

    res.status(200).json({
      success: true,
      message: 'Subscription plans retrieved successfully',
      data: plans,
      count: plans.length,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error fetching subscription plans:', error)
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching subscription plans',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    })
  }
}

// Public endpoint to fetch subscription plans from admin database
const getPublicSubscriptionPlans = async (req, res, next) => {
  let connection
  try {
    console.log('getPublicSubscriptionPlans called')
    console.log('DB config:', {
      host: CONFIG[process.env.NODE_ENV].host,
      user: CONFIG[process.env.NODE_ENV].username,
      database: CONFIG[process.env.NODE_ENV].database,
    })

    connection = await adminPool.getConnection()
    console.log('Connected to database')

    const query = `
      SELECT sp_id, sp_code, sp_name, sp_description, sp_status
      FROM subscription_plans
      WHERE sp_status = 'PUBLIC'
      ORDER BY sp_id ASC
    `

    const [plans] = await connection.execute(query)
    console.log('Fetched plans:', plans.length)
    
    // Fetch subscription plan items for each plan
    const plansWithItems = await Promise.all(
      plans.map(async (plan) => {
        const itemsQuery = `
          SELECT spi_id, spi_subscription_plan_id, spi_type, spi_details, spi_display_order
          FROM subscription_plan_items
          WHERE spi_subscription_plan_id = ?
          ORDER BY spi_display_order ASC
        `
        const [items] = await connection.execute(itemsQuery, [plan.sp_id])
        console.log(`Plan ${plan.sp_id} items:`, items)
        
        // Calculate price from PRICE type items
        const priceItem = items.find(item => item.spi_type === 'PRICE')
        const price = priceItem ? parseFloat(priceItem.spi_details) : 0
        console.log(`Plan ${plan.sp_id} price:`, price)
        
        return {
          ...plan,
          sp_price: price,
          items: items
        }
      })
    )
    
    // Sort by price
    plansWithItems.sort((a, b) => a.sp_price - b.sp_price)
    
    connection.release()
    
    res.status(200).json({
      success: true,
      message: 'Subscription plans retrieved successfully',
      data: plansWithItems,
      count: plansWithItems.length,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error fetching public subscription plans:', error)
    if (connection) connection.release()
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching subscription plans',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    })
  }
}

const getSubscriptionPlanById = async (req, res, next) => {
  try {
    const { id } = req.params

    const planQuery = sql
      .select(Subscription.subscription_plans.selectColumns)
      .from(Subscription.subscription_plans.tablename)
      .where(Subscription.subscription_plans.selectOptionColumns.id)
      .build()

    const plans = await Query(planQuery, [id])

    if (plans.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Subscription plan not found',
      })
    }

    const itemsQuery = sql
      .select(Subscription.subscription_plan_items.selectColumns)
      .from(Subscription.subscription_plan_items.tablename)
      .where(Subscription.subscription_plan_items.selectOptionColumns.subscription_plan_id)
      .orderBy(Subscription.subscription_plan_items.selectOptionColumns.display_order, 'ASC')
      .build()

    const items = await Query(itemsQuery, [id])
    
    // Calculate price from PRICE type items
    const priceItem = items.find(item => item.spi_type === 'PRICE')
    const price = priceItem ? parseFloat(priceItem.spi_details) : 0

    res.status(200).json({
      success: true,
      message: 'Subscription plan retrieved successfully',
      data: {
        ...plans[0],
        sp_price: price,
        items,
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error fetching subscription plan:', error)
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching subscription plan',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    })
  }
}

const createSubscriptionPlan = async (req, res, next) => {
  let connection
  try {
    console.log('Received request body:', req.body)
    const { sp_code, sp_name, sp_description, sp_is_active, sp_status, items } = req.body

    if (sp_code === undefined || sp_code === null || sp_code === '' ||
        sp_name === undefined || sp_name === null || sp_name === '') {
      console.log('Validation failed - missing fields:', { sp_code, sp_name })
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: sp_code, sp_name',
      })
    }

    connection = await pool.getConnection()

    // Start transaction
    await connection.beginTransaction()

    try {
      // Insert subscription plan using raw SQL
      const planQuery = `
        INSERT INTO subscription_plans (sp_code, sp_name, sp_description, sp_status)
        VALUES (?, ?, ?, ?)
      `

      const planValues = [
        sp_code,
        sp_name,
        sp_description || null,
        sp_status || 'PUBLIC',
      ]

      const [planResult] = await connection.execute(planQuery, planValues)
      const planId = planResult.insertId

      // Insert plan items if provided
      if (items && items.length > 0) {
        for (const item of items) {
          const itemQuery = `
            INSERT INTO subscription_plan_items (spi_subscription_plan_id, spi_type, spi_details, spi_display_order)
            VALUES (?, ?, ?, ?)
          `

          const itemValues = [
            planId,
            item.spi_type,
            item.spi_details,
            item.spi_display_order || 0,
          ]

          await connection.execute(itemQuery, itemValues)
        }
      }

      await connection.commit()

      res.status(201).json({
        success: true,
        message: 'Subscription plan created successfully',
        data: { id: planId },
        timestamp: new Date().toISOString(),
      })
    } catch (error) {
      await connection.rollback()
      throw error
    } finally {
      if (connection) {
        connection.release()
      }
    }
  } catch (error) {
    console.error('Error creating subscription plan:', error)
    return res.status(500).json({
      success: false,
      message: 'Server error while creating subscription plan',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    })
  }
}

const updateSubscriptionPlan = async (req, res, next) => {
  let connection
  try {
    const { id } = req.params
    const { sp_code, sp_name, sp_description, sp_is_active, sp_status, items } = req.body

    connection = await pool.getConnection()

    // Start transaction
    await connection.beginTransaction()

    try {
      // Update subscription plan using raw SQL
      const updateQuery = `
        UPDATE subscription_plans
        SET sp_code = ?, sp_name = ?, sp_description = ?, sp_status = ?
        WHERE sp_id = ?
      `

      const updateValues = [
        sp_code,
        sp_name,
        sp_description || null,
        sp_status || 'PUBLIC',
        id,
      ]

      await connection.execute(updateQuery, updateValues)

      // Delete existing items
      const deleteItemsQuery = `DELETE FROM subscription_plan_items WHERE spi_subscription_plan_id = ?`
      await connection.execute(deleteItemsQuery, [id])

      // Insert new items if provided
      if (items && items.length > 0) {
        for (const item of items) {
          const itemQuery = `
            INSERT INTO subscription_plan_items (spi_subscription_plan_id, spi_type, spi_details, spi_display_order)
            VALUES (?, ?, ?, ?)
          `

          const itemValues = [
            id,
            item.spi_type,
            item.spi_details,
            item.spi_display_order || 0,
          ]

          await connection.execute(itemQuery, itemValues)
        }
      }

      await connection.commit()

      res.status(200).json({
        success: true,
        message: 'Subscription plan updated successfully',
        timestamp: new Date().toISOString(),
      })
    } catch (error) {
      await connection.rollback()
      throw error
    } finally {
      if (connection) {
        connection.release()
      }
    }
  } catch (error) {
    console.error('Error updating subscription plan:', error)
    return res.status(500).json({
      success: false,
      message: 'Server error while updating subscription plan',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    })
  }
}

const deleteSubscriptionPlan = async (req, res, next) => {
  let connection
  try {
    const { id } = req.params

    connection = await pool.getConnection()

    // Start transaction
    await connection.beginTransaction()

    try {
      // Delete plan items first (foreign key will handle this with CASCADE, but explicit is safer)
      const deleteItemsQuery = `DELETE FROM subscription_plan_items WHERE spi_subscription_plan_id = ?`
      await connection.execute(deleteItemsQuery, [id])

      // Delete subscription plan
      const deletePlanQuery = `DELETE FROM subscription_plans WHERE sp_id = ?`
      await connection.execute(deletePlanQuery, [id])

      await connection.commit()

      res.status(200).json({
        success: true,
        message: 'Subscription plan deleted successfully',
        timestamp: new Date().toISOString(),
      })
    } catch (error) {
      await connection.rollback()
      throw error
    } finally {
      if (connection) {
        connection.release()
      }
    }
  } catch (error) {
    console.error('Error deleting subscription plan:', error)
    return res.status(500).json({
      success: false,
      message: 'Server error while deleting subscription plan',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    })
  }
}

module.exports = {
  getSubscriptionPlans,
  getPublicSubscriptionPlans,
  getSubscriptionPlanById,
  createSubscriptionPlan,
  updateSubscriptionPlan,
  deleteSubscriptionPlan,
}
