const express = require('express')
const { getVendors, createVendor } = require('../controller/vendor.controller')

const vendorRouter = express.Router()

vendorRouter.get('/', getVendors)
vendorRouter.post('/', createVendor)

module.exports = {
  vendorRouter,
}
