require('dotenv').config()

const getOrigins = () => {
  const envOrigins = String(process.env._CORS_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)

  const defaultOrigins = [
    `http://${process.env._CLIENT_URL}:${process.env._CLIENT_PORT}`,
    `http://${process.env._SERVER_URL}:${process.env._SUBSCRIPTION_SERVER_PORT}`,
    `http://localhost:${process.env._SUBSCRIPTION_SERVER_PORT}`,
  ].filter(Boolean)

  if (envOrigins.includes('*')) {
    return true
  }

  return Array.from(new Set([...defaultOrigins, ...envOrigins]))
}

const corsOptions = {
  origin: getOrigins(),
  credentials: true,
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'x-api-key',
    'x-requested-with',
    'x-tenant-db',
    'x-tenant',
  ],
}

module.exports = {
  corsOptions,
}
