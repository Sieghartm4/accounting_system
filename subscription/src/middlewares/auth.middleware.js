'use strict'

const jwt = require('jsonwebtoken')
const { SQLQueryBuilder } = require('../util/helper.util')
const { logger } = require('../util/logger.util')
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

    req.context = {
      ...decodedUser,
    }

    return next()
  } catch (err) {
    logger.error('Auth Middleware Error', err)
    
    // Check for JWT expiration specifically
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        code: 'TOKEN_EXPIRED',
        message: 'Token expired' 
      })
    }
    
    return res.status(401).json({ message: 'Authentication failed.' })
  }
}

module.exports = { auth }
