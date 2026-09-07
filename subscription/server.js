require('dotenv').config({ path: '../.env' })
const cors = require('cors')
const helmet = require('helmet')
const express = require('express')
const { initStaticFiles } = require('./src/startup/staticFiles.startup')
const { initSession } = require('./src/startup/session.startup')
const { initDocs } = require('./src/startup/docs.startup')
const { initRoutes } = require('./src/startup/routes.startup')
const { initWebSocket } = require('./src/startup/socket.startup')
const { httpLogger } = require('./src/middlewares/logger.middleware')
const { checkConnection } = require('./src/database/util/queries.util')
const { corsOptions } = require('./src/middlewares/corsOptions.middleware')
const { logger } = require('./src/util/logger.util')
const { scheduleSubscriptionExpiry } = require('./src/util/subscriptionExpiry.util')

const app = express()
// Allows secure: 'auto' to detect HTTPS when TLS is terminated by a proxy.
app.set('trust proxy', 1)

const serverStart = async () => {
  try {
    logger.info('--------------------Server Starting--------------------')
    logger.info(`Server running on ${process.env.NODE_ENV.toUpperCase()} mode`)

    logger.info('Adding req body json parser')
    app.use(express.json({ limit: '50mb' }))
    app.use(express.urlencoded({ limit: '50mb', extended: true }))

    logger.info('Adding logger middleware')
    app.use(httpLogger)

    logger.info('Adding cors middleware')
    app.use(cors(corsOptions))
    app.use(helmet())

    logger.info('Stablishing database connection.....')
    const connection = await checkConnection()
    logger.info(`Status: ${connection.status}, Latency: ${connection.latency} ms`)

    logger.info('Initializing session')
    initSession(app)

    logger.info('Initializing docs')
    await initDocs(app)

    logger.info('Initializing routes')
    initRoutes(app)

    logger.info('Serving static files')
    initStaticFiles(app)

    app.use((error, req, res, next) => {
      logger.error(`Unhandled request error: ${error.message}`)
      if (res.headersSent) return next(error)
      res.status(error.status || 500).json({
        success: false,
        message: 'Internal server error',
      })
    })

    const server = app.listen(process.env._SUBSCRIPTION_SERVER_PORT, () => {
      logger.info(
        `Server listening on port http://${process.env._SERVER_URL}:${process.env._SUBSCRIPTION_SERVER_PORT}`,
      )
    })

    logger.info('Initializing WebSockets')
    initWebSocket(server)

    logger.info('Scheduling subscription expiry check')
    scheduleSubscriptionExpiry()

    process.on('SIGINT', () => {
      logger.info('SIGINT signal received, Closing the application')
      server.close()
      logger.info('--------------------Server Closed----------------------')
      process.exit(0)
    })
  } catch (err) {
    console.log('FATAL: Failed to start server due to database error.', err)
    process.exit(1)
  }
}

serverStart()
