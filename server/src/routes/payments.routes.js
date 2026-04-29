const express = require('express')
const { auth } = require('../middlewares/auth.middleware')
const { getPayments, getAllPayments, getPurchasePayment, getPurchaseItemsPayment, createPayment, updatePaymentState } = require('../controller/payments.controller')

const paymentRouter = express.Router()

paymentRouter.use(auth) // Apply auth middleware to all payment routes
paymentRouter.get('/', getPayments)
paymentRouter.get('/purchase-payment', getPurchasePayment)
paymentRouter.get('/purchase-items-payment', getPurchaseItemsPayment)
paymentRouter.get('/:payment_id', getAllPayments)
paymentRouter.post('/', createPayment)
paymentRouter.put('/payment-state', updatePaymentState)

module.exports = {
  paymentRouter,
}
