const express = require('express')
const { getAllCompanies, getCompany, createCompany, updateCompany } = require('../controller/company.controller')

const companyRouter = express.Router()

companyRouter.get('/', getAllCompanies)
companyRouter.get('/single', getCompany)
companyRouter.post('/', createCompany)
companyRouter.put('/:id', updateCompany)

module.exports = {
  companyRouter,
}
