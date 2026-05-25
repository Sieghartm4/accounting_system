'use strict'

const jwt = require('jsonwebtoken')
const { SQLQueryBuilder } = require('../util/helper.util')
const { logger } = require('../util/logger.util')
const CONFIG = require('../database/config/config')
require('dotenv').config()

const SQL = new SQLQueryBuilder()

const auth = async (req, res, next) => {
  try {
    let token = req.session.jwt

    // console.log(req.headers)
    if (!token && req.headers['authorization']) {
      token = req.headers['authorization'].split(' ')[1]
    }

    if (!token) {
      return res.status(401).json({ message: 'Unauthorized: Please login.' })
    }

    // Allow a dev/admin default token (set in environment) to bypass JWT verification.
    // WARNING: This should NOT be enabled in production. Control with _ALLOW_DEFAULT_TOKEN
    const defaultToken = process.env._DEFAULT_API_TOKEN
    const allowDefault =
      (process.env._ALLOW_DEFAULT_TOKEN &&
        process.env._ALLOW_DEFAULT_TOKEN === 'true') ||
      process.env.NODE_ENV !== 'production'

    if (defaultToken && token === defaultToken && allowDefault) {
      const defaultUser = {
        username: process.env._DEFAULT_API_USER || 'default',
        roles: ['default'],
        dbName: process.env._DEFAULT_TENANT_DB || null,
      }

      // Allow per-request override via header when using default token (dev-only)
      const headerTenant = req.headers['x-tenant-db'] || req.headers['x-tenant']
      if (headerTenant) {
        console.log(
          '🔐 Auth - default token: overriding tenant DB from header:',
          headerTenant,
        )
        defaultUser.dbName = headerTenant
      }

      console.log('🔐 Auth - default API token used, setting default user context')

      req.context = {
        ...defaultUser,
      }

      if (defaultUser.dbName) {
        CONFIG.setTenantDb(defaultUser.dbName)
      }

      return next()
    }

    const decodedUser = jwt.verify(token, process.env._SECRET_KEY)

    console.log('🔍 Auth - JWT decoded user:', decodedUser)

    req.context = {
      ...decodedUser,
    }

    // ✅ Set tenant database from JWT for this request
    if (decodedUser.dbName) {
      console.log('🔍 Auth - Setting tenant DB from JWT:', decodedUser.dbName)
      CONFIG.setTenantDb(decodedUser.dbName)
    } else if (decodedUser.tenantDb) {
      console.log(
        '🔍 Auth - Setting tenant DB from JWT (legacy field):',
        decodedUser.tenantDb,
      )
      CONFIG.setTenantDb(decodedUser.tenantDb)
    } else {
      console.log('🔍 Auth - No tenant database found in JWT token')
    }

    return next()
  } catch (err) {
    logger.error('Auth Middleware Error', err)

    // Check for JWT expiration specifically
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        code: 'TOKEN_EXPIRED',
        message: 'Token expired',
      })
    }

    return res.status(401).json({ message: 'Authentication failed.' })
  }
}

module.exports = { auth }
