const { checkConnection, SelectAll, Query, Transaction } = require('../database/util/queries.util')
const { SQLQueryBuilder } = require('../util/helper.util')
const mysql = require('mysql2/promise')
const CONFIG = require('../database/config/config')
const catalog = require('../constants/moduleCatalog')
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

/* --------------------------------------------------------------------------
 * Plan builder
 *
 * Plans are named and configured by an administrator: arbitrary name, arbitrary
 * seat count, arbitrary trial length, and any combination of modules the
 * catalog allows. There are no hardcoded tiers.
 *
 * What used to be storable per plan is now split by shape:
 *
 *   scalar  -> subscription_plans columns (sp_max_users, sp_trial_days,
 *             sp_billing_days, sp_price_minor, sp_is_trial)
 *   set     -> plan_modules, one row per module
 *
 * Before this, days and seat counts were free text in
 * subscription_plan_items.spi_details behind an ENUM key, which cannot be
 * compared in a constraint or used in a COUNT without parsing a string, and
 * modules were the single prose row 'All Modules included', which nothing could
 * verify.
 *
 * subscription_plan_items is retained for display copy (FEATURES) and for the
 * legacy values the pricing UI still reads, but it is no longer the source of
 * truth for limits or modules.
 * ----------------------------------------------------------------------- */

/**
 * Normalise and validate the limits portion of a create/update payload.
 *
 * `isCreate` decides how a missing value is treated. On create a seat cap is
 * mandatory, so an absent one is an error. On update every limit is optional and
 * an absent value falls back to the stored column - handled by the caller's
 * `keep()` - so an edit form that sends only a description does not fail
 * validation, and cannot reset the cap to the column default.
 */
const readLimits = (body, { isCreate = false } = {}) => {
  const toInt = (value, fallback) => {
    if (value === undefined || value === null || value === '') return fallback
    const n = Number(value)
    return Number.isFinite(n) ? Math.trunc(n) : NaN
  }

  const maxUsers = toInt(body.sp_max_users, undefined)
  const trialDays = toInt(body.sp_trial_days, null)
  const billingDays = toInt(body.sp_billing_days, 30)
  const priceMinor = body.sp_price_minor !== undefined
    ? toInt(body.sp_price_minor, 0)
    : Number.isFinite(Number(body.sp_price)) && body.sp_price !== undefined
      ? Math.round(Number(body.sp_price) * 100)
      : 0

  const errors = []
  if (isCreate && (maxUsers === undefined || Number.isNaN(maxUsers))) {
    errors.push('sp_max_users is required and must be at least 1.')
  }
  if (maxUsers !== undefined && !Number.isNaN(maxUsers) && maxUsers < 1) {
    errors.push('sp_max_users must be at least 1.')
  }
  if (trialDays !== null && (Number.isNaN(trialDays) || trialDays < 0)) {
    errors.push('sp_trial_days must be a non-negative number of days, or empty for no trial.')
  }
  if (Number.isNaN(billingDays) || billingDays < 1) {
    errors.push('sp_billing_days must be at least 1.')
  }
  if (Number.isNaN(priceMinor) || priceMinor < 0) {
    errors.push('The price must be zero or more.')
  }

  return {
    errors,
    values: {
      sp_max_users: maxUsers,
      sp_trial_days: trialDays,
      sp_billing_days: billingDays,
      sp_price_minor: priceMinor,
      sp_is_trial: trialDays !== null && trialDays > 0 ? 1 : 0,
    },
  }
}

/**
 * Insert or replace a plan's module grants.
 *
 * Required modules are re-granted on every write even if the submitted list
 * omits them, so a malformed admin request cannot produce a plan that locks a
 * paying tenant out of its own dashboard.
 */
const writePlanModules = async (connection, planId, modules) => {
  await connection.execute('DELETE FROM plan_modules WHERE pm_plan_id = ?', [planId])
  const unique = [...new Set(modules)]
  for (const code of unique) {
    await connection.execute(
      'INSERT INTO plan_modules (pm_plan_id, pm_module) VALUES (?, ?)',
      [planId, code],
    )
  }
  return unique.length
}

/**
 * Mirror the plan's limits onto every company currently on it.
 *
 * mcs_max_users is a snapshot so the seat check is one indexed read and a plan
 * edit does not change a company's allowance mid-cycle. Changing the plan is
 * exactly the moment an operator expects the new allowance to apply, so the
 * snapshot is re-synced here. The stored end dates are deliberately left alone:
 * they are what decides whether a company has already been billed for a period.
 */
const syncSnapshotsForPlan = async (connection, planId) => {
  const [result] = await connection.execute(
    `UPDATE master_company_subscription mcs
       JOIN subscription_plans sp ON sp.sp_id = mcs.mcs_plan_id
        SET mcs.mcs_max_users = sp.sp_max_users
      WHERE mcs.mcs_plan_id = ?`,
    [planId],
  )
  return result ? result.affectedRows || 0 : 0
}

const createSubscriptionPlan = async (req, res, next) => {
  let connection
  try {
    const {
      sp_code,
      sp_name,
      sp_description,
      sp_status,
      sp_max_users,
      sp_trial_days,
      sp_billing_days,
      sp_price,
      sp_price_minor,
      modules,
      items,
    } = req.body

    if (!sp_code || !String(sp_code).trim() || !sp_name || !String(sp_name).trim()) {
      return res.status(400).json({
        success: false,
        message: 'A plan needs a code and a name.',
      })
    }

    const limits = readLimits(req.body, { isCreate: true })
    if (limits.errors.length > 0) {
      return res.status(400).json({ success: false, errors: limits.errors })
    }

    // A plan may not be empty, and required modules cannot be dropped. Validated
    // before the transaction opens so a bad request writes nothing.
    const submitted = Array.isArray(modules) && modules.length > 0
      ? modules
      : catalog.defaultModuleTemplate()
    const moduleCheck = catalog.validateModules(submitted)
    if (!moduleCheck.valid) {
      return res.status(400).json({
        success: false,
        code: 'INVALID_MODULES',
        errors: moduleCheck.errors,
      })
    }

    connection = await pool.getConnection()
    await connection.beginTransaction()

    try {
      const [codeRows] = await connection.execute(
        'SELECT sp_id FROM subscription_plans WHERE sp_code = ?',
        [String(sp_code).trim()],
      )
      if (codeRows.length > 0) {
        await connection.rollback()
        return res.status(409).json({
          success: false,
          message: `A plan with the code "${sp_code}" already exists.`,
        })
      }

      const [planResult] = await connection.execute(
        `INSERT INTO subscription_plans
           (sp_code, sp_name, sp_description, sp_status,
            sp_max_users, sp_trial_days, sp_billing_days, sp_price_minor, sp_is_trial)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          String(sp_code).trim(),
          String(sp_name).trim(),
          sp_description || null,
          sp_status || 'PUBLIC',
          limits.values.sp_max_users,
          limits.values.sp_trial_days,
          limits.values.sp_billing_days,
          limits.values.sp_price_minor,
          limits.values.sp_is_trial,
        ],
      )
      const planId = planResult.insertId

      const granted = await writePlanModules(connection, planId, moduleCheck.modules)

      // Display copy only. Kept because the pricing UI still reads it.
      if (Array.isArray(items) && items.length > 0) {
        for (const [index, item] of items.entries()) {
          if (!item || !item.spi_type) continue
          await connection.execute(
            `INSERT INTO subscription_plan_items
               (spi_subscription_plan_id, spi_type, spi_details, spi_display_order)
             VALUES (?, ?, ?, ?)`,
            [planId, item.spi_type, String(item.spi_details ?? ''), item.spi_display_order ?? index + 1],
          )
        }
      }

      await connection.commit()

      res.status(201).json({
        success: true,
        message: `Plan "${sp_name}" created with ${limits.values.sp_max_users} account(s) and ${granted} module(s).`,
        data: {
          id: planId,
          code: String(sp_code).trim(),
          name: String(sp_name).trim(),
          ...limits.values,
          modules: moduleCheck.modules,
        },
        timestamp: new Date().toISOString(),
      })
    } catch (error) {
      await connection.rollback()
      throw error
    } finally {
      if (connection) connection.release()
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
    const {
      sp_code,
      sp_name,
      sp_description,
      sp_status,
      modules,
      items,
    } = req.body

    const limits = readLimits(req.body, { isCreate: false })
    if (limits.errors.length > 0) {
      return res.status(400).json({ success: false, errors: limits.errors })
    }

    connection = await pool.getConnection()
    await connection.beginTransaction()

    try {
      // Every column that can appear in the UPDATE has to be read here, because
      // the partial-update path below falls back to the stored value for
      // anything the form did not send. Selecting only the identity columns made
      // every absent limit come back undefined, which mysql2 then refused with
      // "Bind parameters must not contain undefined".
      const [existing] = await connection.execute(
        `SELECT sp_id, sp_code, sp_name, sp_description, sp_status,
                sp_max_users, sp_trial_days, sp_billing_days, sp_price_minor, sp_is_trial
           FROM subscription_plans WHERE sp_id = ?`,
        [id],
      )
      if (existing.length === 0) {
        await connection.rollback()
        return res.status(404).json({ success: false, message: 'Plan not found.' })
      }
      const current = existing[0]

      // Preserve stored values for any limit the form did not send, so a partial
      // update cannot silently reset a plan's seat cap to the column default.
      // A limit the form did send is coerced to null rather than left undefined,
      // because mysql2 treats undefined as a binding error while null is a
      // legitimate "no trial".
      const keep = (incoming, column) => {
        if (req.body[column] !== undefined || req.body[column.replace(/_minor$/, '')] !== undefined) {
          return incoming === undefined || incoming === null ? null : incoming
        }
        return current[column] === undefined ? null : current[column]
      }

      await connection.execute(
        `UPDATE subscription_plans
            SET sp_code = ?, sp_name = ?, sp_description = ?, sp_status = ?,
                sp_max_users = ?, sp_trial_days = ?, sp_billing_days = ?,
                sp_price_minor = ?, sp_is_trial = ?
          WHERE sp_id = ?`,
        [
          sp_code !== undefined ? String(sp_code).trim() : current.sp_code,
          sp_name !== undefined ? String(sp_name).trim() : current.sp_name,
          sp_description !== undefined ? sp_description : current.sp_description,
          sp_status || current.sp_status || 'PUBLIC',
          keep(limits.values.sp_max_users, 'sp_max_users'),
          keep(limits.values.sp_trial_days, 'sp_trial_days'),
          keep(limits.values.sp_billing_days, 'sp_billing_days'),
          keep(limits.values.sp_price_minor, 'sp_price_minor'),
          limits.values.sp_is_trial,
          id,
        ],
      )

      let granted = null
      if (Array.isArray(modules)) {
        const moduleCheck = catalog.validateModules(modules)
        if (!moduleCheck.valid) {
          await connection.rollback()
          return res.status(400).json({
            success: false,
            code: 'INVALID_MODULES',
            errors: moduleCheck.errors,
          })
        }
        granted = await writePlanModules(connection, id, moduleCheck.modules)
      }

      const resynced = await syncSnapshotsForPlan(connection, id)

      if (Array.isArray(items)) {
        await connection.execute(
          'DELETE FROM subscription_plan_items WHERE spi_subscription_plan_id = ?',
          [id],
        )
        for (const [index, item] of items.entries()) {
          if (!item || !item.spi_type) continue
          await connection.execute(
            `INSERT INTO subscription_plan_items
               (spi_subscription_plan_id, spi_type, spi_details, spi_display_order)
             VALUES (?, ?, ?, ?)`,
            [id, item.spi_type, String(item.spi_details ?? ''), item.spi_display_order ?? index + 1],
          )
        }
      }

      await connection.commit()

      res.status(200).json({
        success: true,
        message: resynced
          ? `Plan updated. ${resynced} compan${resynced === 1 ? 'y' : 'ies'} on this plan had their seat allowance refreshed.`
          : 'Plan updated successfully',
        data: {
          id: Number(id),
          ...limits.values,
          modules: granted === null ? undefined : granted,
          companiesResynced: resynced,
        },
        timestamp: new Date().toISOString(),
      })
    } catch (error) {
      await connection.rollback()
      throw error
    } finally {
      if (connection) connection.release()
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
    await connection.beginTransaction()

    try {
      // A company still on this plan must not be left pointing at nothing, so
      // the plan is retired rather than deleted while it is in use. The FK is
      // ON DELETE RESTRICT for exactly this reason.
      const [inUse] = await connection.execute(
        'SELECT COUNT(*) AS n FROM master_company_subscription WHERE mcs_plan_id = ?',
        [id],
      )
      if (Number(inUse[0].n) > 0) {
        await connection.rollback()
        return res.status(409).json({
          success: false,
          code: 'PLAN_IN_USE',
          message: `${inUse[0].n} compan${inUse[0].n === '1' ? 'y is' : 'ies are'} still on this plan. Move them to another plan, or set the plan to PRIVATE so it is no longer offered.`,
          companiesOnPlan: Number(inUse[0].n),
        })
      }

      await connection.execute(
        'DELETE FROM subscription_plan_items WHERE spi_subscription_plan_id = ?',
        [id],
      )
      // plan_modules has ON DELETE CASCADE.
      await connection.execute('DELETE FROM subscription_plans WHERE sp_id = ?', [id])

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
      if (connection) connection.release()
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

/**
 * The catalog the plan form renders from.
 *
 * Returned by the server so the admin UI cannot drift from the validation the
 * API applies: the required set it shows as locked is the same set the server
 * refuses to let anyone remove.
 */
const getModuleCatalog = async (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      required: catalog.REQUIRED_MODULES,
      defaultOn: catalog.DEFAULT_ON_MODULES,
      defaultOff: catalog.DEFAULT_OFF_MODULES,
      unsold: catalog.UNSOLD_MODULES,
      all: catalog.ALL_MODULES,
      defaultTemplate: catalog.defaultModuleTemplate(),
    },
    timestamp: new Date().toISOString(),
  })
}

/** A plan with its limits and modules, for the edit form. */
const getSubscriptionPlanById = async (req, res, next) => {
  try {
    const { id } = req.params

    const [plans] = await pool.execute(
      `SELECT sp_id, sp_code, sp_name, sp_description, sp_status,
              sp_max_users, sp_trial_days, sp_billing_days, sp_price_minor, sp_is_trial
         FROM subscription_plans WHERE sp_id = ?`,
      [id],
    )
    if (plans.length === 0) {
      return res.status(404).json({ success: false, message: 'Plan not found' })
    }

    const [modules] = await pool.execute(
      'SELECT pm_module FROM plan_modules WHERE pm_plan_id = ? ORDER BY pm_module',
      [id],
    )
    const [items] = await pool.execute(
      `SELECT spi_id, spi_type, spi_details, spi_display_order
         FROM subscription_plan_items WHERE spi_subscription_plan_id = ?
        ORDER BY spi_display_order ASC`,
      [id],
    )

    res.status(200).json({
      success: true,
      data: {
        ...plans[0],
        sp_price: Number(plans[0].sp_price_minor || 0) / 100,
        modules: modules.map((m) => catalog.canonicalModule(m.pm_module)).filter(Boolean),
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
module.exports = {
  getSubscriptionPlans,
  getPublicSubscriptionPlans,
  getSubscriptionPlanById,
  createSubscriptionPlan,
  updateSubscriptionPlan,
  deleteSubscriptionPlan,
  getModuleCatalog,
}
