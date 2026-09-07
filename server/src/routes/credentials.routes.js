const express = require('express')
const { login, logout } = require('../controller/credentials.controller')
const { loginRateLimiter } = require('../middlewares/security.middleware')

const credentialsRouter = express.Router()

credentialsRouter.post('/login', loginRateLimiter, login)
credentialsRouter.post('/logout', logout)

module.exports = {
  credentialsRouter,
}
