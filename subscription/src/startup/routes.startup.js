const { auth } = require('../middlewares/auth.middleware')
// const { healthRouter } = require('../routes/health.routes')
const { usersRouter } = require('../routes/users.routes')
const { credentialsRouter } = require('../routes/credentials.routes')


const initRoutes = (app) => {
  app.use('/credentials', credentialsRouter)
  // app.use('/health', healthRouter)
  // app.use(auth)
  app.use('/users', usersRouter)

}

module.exports = { initRoutes }
