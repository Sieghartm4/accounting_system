require('dotenv').config()
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
const { CopilotRuntime, OpenAIAdapter, AnthropicAdapter, copilotRuntimeNodeExpressEndpoint } = require('@copilotkit/runtime')
const OpenAI = require('openai')

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

    logger.info('Initializing CopilotKit runtime')
    const aiProvider = (process.env._AI_PROVIDER || 'ollama').toLowerCase()
    const aiBaseURL = process.env._AI_BASE_URL || ''
    const aiAPIKey = process.env._AI_API_KEY || ''
    const aiModel = process.env._AI_MODEL || 'accounting-guide'
    let serviceAdapter
    if (aiProvider === 'anthropic') {
      const Anthropic = require('@anthropic-ai/sdk').default
      const anthropic = new Anthropic({
        apiKey: aiAPIKey || process.env.ANTHROPIC_API_KEY,
        ...(aiBaseURL && { baseURL: aiBaseURL })
      })
      serviceAdapter = new AnthropicAdapter({ anthropic, model: aiModel })
      logger.info(`CopilotKit AI provider: anthropic, model: ${aiModel}`)
    } else {
      const openai = new OpenAI({
        baseURL: aiBaseURL || 'http://localhost:11434/v1',
        apiKey: aiAPIKey || 'ollama'
      })
      serviceAdapter = new OpenAIAdapter({ openai, model: aiModel })
      logger.info(`CopilotKit AI provider: ${aiProvider || 'ollama'}, model: ${aiModel}`)
    }
    const runtime = new CopilotRuntime()
    const copilotEndpoint = copilotRuntimeNodeExpressEndpoint({
      endpoint: '/api/copilotkit',
      runtime,
      serviceAdapter,
    })

    // Mount CopilotKit before the global auth middleware registered by
    // initRoutes so the assistant endpoints stay reachable, and restore the
    // full URL because the runtime resolves its base path from req.url.
    app.use('/api/copilotkit', (req, res) => {
      req.url = req.originalUrl
      return copilotEndpoint(req, res)
    })

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

    const server = app.listen(process.env._SERVER_PORT, () => {
      logger.info(
        `Server listening on port http://${process.env._SERVER_URL}:${process.env._SERVER_PORT}`,
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
