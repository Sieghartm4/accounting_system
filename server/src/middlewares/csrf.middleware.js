/**
 * CSRF Protection Middleware
 * Generates and validates CSRF tokens for form submissions and API calls
 * Protects against Cross-Site Request Forgery attacks
 */

const crypto = require('crypto')

/**
 * Generate CSRF token and store in session
 * Call this early in middleware stack before route handlers
 */
const generateCsrfToken = (req, res, next) => {
  if (!req.session) {
    console.warn(
      '⚠️  CSRF Middleware: Session not available, skipping CSRF token generation',
    )
    return next()
  }

  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString('hex')
    console.log('✅ CSRF Token generated for session')
  }

  // Make token available in response for client
  res.locals.csrfToken = req.session.csrfToken

  // Set header so frontend can read it
  res.setHeader('X-CSRF-Token', req.session.csrfToken)

  next()
}

/**
 * Validate CSRF token for state-changing requests (POST, PUT, DELETE, PATCH)
 * Safe methods (GET, HEAD, OPTIONS) are not checked
 */
const validateCsrfToken = (req, res, next) => {
  // Skip CSRF validation for safe HTTP methods
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next()
  }

  // Skip CSRF validation for health checks and auth endpoints
  if (req.path === '/health' || req.path?.includes('/credentials/login')) {
    return next()
  }

  if (!req.session) {
    console.warn('⚠️  CSRF Middleware: Session not available for validation')
    return res.status(403).json({ success: false, message: 'Session required' })
  }

  const tokenFromHeader = req.headers['x-csrf-token']
  const tokenFromBody = req.body?.csrfToken
  const tokenFromSession = req.session?.csrfToken

  // Token must match the one in session
  const tokenIsValid =
    tokenFromSession &&
    (tokenFromHeader === tokenFromSession || tokenFromBody === tokenFromSession)

  if (!tokenIsValid) {
    console.warn('❌ CSRF validation failed:', {
      method: req.method,
      path: req.path,
      headerToken: tokenFromHeader ? 'present' : 'missing',
      bodyToken: tokenFromBody ? 'present' : 'missing',
      sessionToken: tokenFromSession ? 'present' : 'missing',
    })
    return res
      .status(403)
      .json({
        success: false,
        message: 'CSRF validation failed',
        code: 'CSRF_INVALID',
      })
  }

  next()
}

module.exports = { generateCsrfToken, validateCsrfToken }
