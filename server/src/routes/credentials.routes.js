const express = require('express')
const { login, logout } = require('../controller/credentials.controller')

const credentialsRouter = express.Router()

credentialsRouter.post('/login', login)
credentialsRouter.post('/logout', logout)

module.exports = {
  credentialsRouter,
}
