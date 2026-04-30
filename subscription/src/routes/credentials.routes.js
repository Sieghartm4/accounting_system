const express = require('express')
const { login, logout, register } = require('../controller/credentials.controller')

const credentialsRouter = express.Router()

credentialsRouter.post('/login', login)
credentialsRouter.post('/logout', logout)
credentialsRouter.post('/register', register)


module.exports = {
  credentialsRouter,
}
