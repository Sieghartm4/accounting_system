const express = require('express')
const router = express.Router()
const { getMigrations } = require('../controller/developer.controller')

/**
 * Platform diagnostics.
 *
 * GET /migrations reports the migration history of every database on the
 * server - every tenant's schema state, not the caller's own company.
 *
 * It is mounted below `auth`, so it at least requires a signed-in session, but
 * that was the only control: any tenant user could read every other company's
 * schema. A module gate cannot help here because this is not a module feature,
 * so the check is by role instead.
 *
 * ADMIN means a platform administrator, who has no tenant database of their own
 * (db_name is empty). A tenant administrator has a real company behind it and is
 * not entitled to another company's schema, so this is keyed on the same
 * condition the entitlement middleware uses to exempt platform admins.
 */
const requirePlatformAdmin = (req, res, next) => {
  const tenantDb =
    req?.session?.tenantDb || req?.context?.dbName || req?.session?.user?.dbName || null

  if (tenantDb) {
    return res.status(403).json({
      success: false,
      message:
        'Migration history is a platform-level diagnostic and is not available to tenant accounts.',
    })
  }

  return next()
}

router.get('/migrations', requirePlatformAdmin, getMigrations)

module.exports = { developerRouter: router }