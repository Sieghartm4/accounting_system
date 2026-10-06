const express = require('express')
const {
  getSubscriptionPlans,
  getPublicSubscriptionPlans,
  getSubscriptionPlanById,
  createSubscriptionPlan,
  updateSubscriptionPlan,
  deleteSubscriptionPlan,
  getModuleCatalog,
} = require('../controller/subscription.controller')
const {
  createCheckoutSession,
  getPaymentDetails,
  verifyPayment,
} = require('../controller/payment.controller')

const subscriptionRouter = express.Router()

subscriptionRouter.get('/public', getPublicSubscriptionPlans)
// Declared before '/:id' so the literal path is not swallowed by the id
// parameter, which would otherwise return a plan lookup failure for
// /subscription/module-catalog.
subscriptionRouter.get('/module-catalog', getModuleCatalog)
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
