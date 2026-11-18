const express = require('express')
const { getUsers, updateUser, updateUserSubscription } = require('../controller/users.controller')

const usersRouter = express.Router()

usersRouter.get('/', getUsers)
usersRouter.put('/:id', updateUser)
usersRouter.put('/:id/subscription', updateUserSubscription)

module.exports = {
  usersRouter,
}
