const express = require('express')
const { getAllCompanies, createCompany } = require('../controller/company.controller')

const companyRouter = express.Router()

companyRouter.get('/', getAllCompanies)
companyRouter.post('/', createCompany)

module.exports = {
  companyRouter,
}
