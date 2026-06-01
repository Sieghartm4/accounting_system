const express = require('express')
const { auth } = require('../middlewares/auth.middleware')
const {
  getUsers,
  createUser,
  updateUser,
} = require('../controller/users.controller')

const usersRouter = express.Router()

usersRouter.use(auth) // Apply auth middleware to all users routes
usersRouter.get('/', getUsers)
usersRouter.post('/', createUser)
usersRouter.put('/:id', updateUser)

module.exports = {
  usersRouter,
}
