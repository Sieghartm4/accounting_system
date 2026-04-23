const express = require('express')
const { getVendors, createVendor, updateVendor } = require('../controller/vendor.controller')

const vendorRouter = express.Router()

vendorRouter.get('/', getVendors)
vendorRouter.post('/', createVendor)
vendorRouter.put('/:id', updateVendor)

module.exports = {
  vendorRouter,
}
