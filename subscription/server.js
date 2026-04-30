require('dotenv').config()
const cors = require('cors')
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

const app = express()

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

    const server = app.listen(process.env._SUBSCRIPTION_SERVER_PORT, () => {
      logger.info(
        `Server listening on port http://${process.env._SERVER_URL}:${process.env._SUBSCRIPTION_SERVER_PORT}`,
      )
    })

    logger.info('Initializing WebSockets')
    initWebSocket(server)

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
