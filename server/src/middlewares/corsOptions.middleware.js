require('dotenv').config()

const getOrigins = () => {
  const rawEnvOrigins = String(process.env._CORS_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)

  const toOrigin = (value, port) => {
    if (!value) return null
    const rawValue = String(value).trim().replace(/\/$/, '')
    const hasProtocol = /^[a-z][a-z\d+.-]*:\/\//i.test(rawValue)
    const urlValue = hasProtocol ? rawValue : `http://${rawValue}`

    try {
      const url = new URL(urlValue)
      if (!hasProtocol && !url.port && port) url.port = String(port)
      return url.origin
    } catch {
      return null
    }
  }

  const envOrigins = rawEnvOrigins.map((origin) => toOrigin(origin)).filter(Boolean)

  const defaultOrigins = [
    toOrigin(process.env._CLIENT_URL, process.env._CLIENT_PORT),
    toOrigin(process.env._SERVER_URL, process.env._SERVER_PORT),
    toOrigin(process.env.VITE_SERVER_LINK),
    toOrigin(process.env.VITE_SUBSCRIPTION_LINK),
    toOrigin(process.env._INVENTORY_PRODUCT_URL),
    toOrigin(process.env.VITE_OCR_API),
    toOrigin('localhost', process.env._SERVER_PORT),
  ].filter(Boolean)

  if (rawEnvOrigins.includes('*')) {
    return true
  }

  return Array.from(new Set([...defaultOrigins, ...envOrigins]))
}

const corsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = getOrigins()

    // If wildcard was configured, convert to specific origins for credentials mode
    if (allowedOrigins === true) {
      // Don't use wildcard with credentials - use specific origins instead
      const defaultOrigins = [
        `http://192.168.40.43:${process.env._CLIENT_PORT || 3000}`,
        `http://192.168.40.43:${process.env._SERVER_PORT || 3001}`,
        `http://192.168.40.43:${process.env._SUBSCRIPTION_SERVER_PORT || 3012}`,
        `http://localhost:${process.env._CLIENT_PORT || 3000}`,
        `http://localhost:${process.env._SERVER_PORT || 3001}`,
        `http://localhost:${process.env._SUBSCRIPTION_SERVER_PORT || 3012}`,
        'http://127.0.0.1:3000',
        'http://127.0.0.1:3001',
        'http://127.0.0.1:3012',
      ]

      if (!origin || defaultOrigins.includes(origin)) {
        callback(null, true)
      } else {
        callback(null, false)
      }
    } else if (Array.isArray(allowedOrigins)) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true)
      } else {
        callback(null, false)
      }
    } else {
      callback(null, true)
    }
  },
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
