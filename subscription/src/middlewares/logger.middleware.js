const morgan = require('morgan')
const { morganStream } = require('../util/logger.util')

/**
 * Custom Token: 'route'
 * This solves your original question! It allows Morgan to access the matched
 * route pattern (e.g., "/users/:id") instead of just the URL ("/users/123").
 */
morgan.token('route', (req) => {
  return req.route ? req.route.path : null // Returns null if 404
})

/**
 * Custom JSON Format
 * Standard logs must be JSON so they can be queried (e.g., "Find all 500 errors").
 */
const jsonFormat = (tokens, req, res) => {
  return JSON.stringify({
    method: tokens.method(req, res),
    ip: tokens['remote-addr'](req, res),
    url: tokens.url(req, res),
    route: tokens.route(req),
    status: Number.parseFloat(tokens.status(req, res)),
    content_length: tokens.res(req, res, 'content-length'),
    response_time: Number.parseFloat(tokens['response-time'](req, res)),
    referrer: tokens.referrer(req, res),
    user_agent: tokens['user-agent'](req, res),
  })
}

const format = process.env.NODE_ENV === 'production' ? jsonFormat : 'dev'

/**
 * @name httpLogger
 * @description Configures Morgan middleware with environment-aware formatting
 */
const httpLogger = morgan(format, {
  stream: morganStream,
  skip: (req, res) => {
    if (req.method === 'OPTIONS') return true
    if (req.url === '/health' || req.url === '/status' || req.url === '/ping')
      return true
    if (req.url === '/favicon.ico') return true
    if (req.url.match(/\.(js|css|png|jpg|jpeg|svg|ico|woff|woff2)$/)) return true

    return false
  },
})

module.exports = {
  httpLogger,
}
