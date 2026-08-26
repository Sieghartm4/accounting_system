const express = require('express')
const {
  getSubscriptionPlans,
  getPublicSubscriptionPlans,
  getSubscriptionPlanById,
  createSubscriptionPlan,
  updateSubscriptionPlan,
  deleteSubscriptionPlan,
} = require('../controller/subscription.controller')
const {
  createCheckoutSession,
  getPaymentDetails,
  verifyPayment,
} = require('../controller/payment.controller')

const subscriptionRouter = express.Router()

subscriptionRouter.get('/public', getPublicSubscriptionPlans)
subscriptionRouter.get('/', getSubscriptionPlans)
subscriptionRouter.get('/:id', getSubscriptionPlanById)
subscriptionRouter.post('/', createSubscriptionPlan)
subscriptionRouter.put('/:id', updateSubscriptionPlan)
subscriptionRouter.delete('/:id', deleteSubscriptionPlan)
subscriptionRouter.post('/checkout', createCheckoutSession)
subscriptionRouter.get('/payment-details/:session_id', getPaymentDetails)
subscriptionRouter.post('/verify-payment', verifyPayment)

module.exports = {
  subscriptionRouter,
}
