const session = require('express-session')
const MongoStore = require('connect-mongo')
const path = require('path')
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') })

if (!process.env._MONGODB_URL) {
  throw new Error('MONGODB_URL environment variable is not set')
}
if (!process.env._SESSION_SECRET) {
  throw new Error('SESSION_SECRET environment variable is not set')
}

const getCookieDomain = () => {
  if (process.env._COOKIE_DOMAIN) return process.env._COOKIE_DOMAIN

  const configuredHost = String(
    process.env._CLIENT_URL || process.env._SERVER_URL || '',
  )
    .replace(/^[a-z]+:\/\//i, '')
    .split('/')[0]
    .split(':')[0]
    .trim()

  const labels = configuredHost.split('.').filter(Boolean)
  const isIpv4 = /^(\d{1,3}\.){3}\d{1,3}$/.test(configuredHost)
  const isIpv6 = configuredHost.includes(':')

  if (!configuredHost || configuredHost === 'localhost' || isIpv4 || isIpv6) {
    return undefined
  }

  return labels.length >= 3 ? `.${labels.slice(1).join('.')}` : undefined
}

const cookieDomain = getCookieDomain()

const options = {
  store: MongoStore.create({
    mongoUrl: process.env._SESSION_MONGODB_URL || process.env._MONGODB_URL,
    collectionName: process.env._SESSION_COLLECTION || 'sessions',
  }),
  // Both accounting servers must use the same cookie name to share the session.
  name: process.env._SESSION_COOKIE_NAME || 'accounting.sid',
  secret: process.env._SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    // Express detects whether the current request is HTTP or HTTPS.
    secure: 'auto',
    path: '/',
    ...(cookieDomain ? { domain: cookieDomain } : {}),
  },
}

const initSession = (app) => {
  app.use(session(options))
}

module.exports = {
  initSession,
}
