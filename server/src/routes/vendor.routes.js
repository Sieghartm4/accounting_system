const express = require('express')
const { auth } = require('../middlewares/auth.middleware')
const {
  getVendors,
  getVendorTransactions,
  createVendor,
  updateVendor,
} = require('../controller/vendor.controller')

const vendorRouter = express.Router()

vendorRouter.use(auth) // Apply auth middleware to all vendor routes
vendorRouter.get('/transactions', getVendorTransactions)
vendorRouter.get('/', getVendors)
vendorRouter.post('/', createVendor)
vendorRouter.put('/:id', updateVendor)

module.exports = {
  vendorRouter,
}
