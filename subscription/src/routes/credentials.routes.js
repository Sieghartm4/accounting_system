const express = require('express')
const {
  login,
  logout,
  register,
  registerWithProgress,
  updateSubscription,
  checkFreeTrialUsage,
  saveSubscriptionHistory,
  getUserUsedFreeTrials,
  expireSubscriptions,
} = require('../controller/credentials.controller')
const { loginRateLimiter } = require('../middlewares/security.middleware')

const credentialsRouter = express.Router()

credentialsRouter.post('/login', loginRateLimiter, login)
credentialsRouter.post('/logout', logout)
credentialsRouter.post('/register', register)
credentialsRouter.post('/register-progress', registerWithProgress)
credentialsRouter.put('/subscription', updateSubscription)
credentialsRouter.get('/check-free-trial', checkFreeTrialUsage)
credentialsRouter.post('/subscription-history', saveSubscriptionHistory)
credentialsRouter.get('/used-free-trials', getUserUsedFreeTrials)
credentialsRouter.post('/expire-subscriptions', expireSubscriptions)

module.exports = {
  credentialsRouter,
}
