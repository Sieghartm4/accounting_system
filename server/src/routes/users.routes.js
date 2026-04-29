const express = require('express')
const { auth } = require('../middlewares/auth.middleware')
const { getUsers } = require('../controller/users.controller')

const usersRouter = express.Router()

usersRouter.use(auth) // Apply auth middleware to all users routes
usersRouter.get('/', getUsers)

module.exports = {
  usersRouter,
}
