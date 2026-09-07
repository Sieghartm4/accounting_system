'use strict'

const { rateLimit, ipKeyGenerator } = require('express-rate-limit')

const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: (req) =>
    `${ipKeyGenerator(req.ip)}:${String(req.body?.username || '').toLowerCase()}`,
  handler: (_req, res) => {
    res.status(429).json({
      success: false,
      message: 'Too many login attempts. Please try again later.',
      code: 'LOGIN_RATE_LIMITED',
    })
  },
})

module.exports = { loginRateLimiter }
