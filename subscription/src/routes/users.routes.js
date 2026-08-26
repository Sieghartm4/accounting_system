const express = require('express')
const { getUsers, updateUserSubscription } = require('../controller/users.controller')

const usersRouter = express.Router()

usersRouter.get('/', getUsers)
usersRouter.put('/:id/subscription', updateUserSubscription)

module.exports = {
  usersRouter,
}
