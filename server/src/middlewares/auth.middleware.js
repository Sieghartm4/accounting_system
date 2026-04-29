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
      console.log('🔍 Auth - Setting tenant DB from JWT (legacy field):', decodedUser.tenantDb)
      CONFIG.setTenantDb(decodedUser.tenantDb)
    } else {
      console.log('🔍 Auth - No tenant database found in JWT token')
    }

    return next()
  } catch (err) {
    logger.error('Auth Middleware Error', err)
    return res.status(401).json({ message: 'Authentication failed.' })
  }
}

module.exports = { auth }
