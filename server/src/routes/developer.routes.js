const express = require('express')
const router = express.Router()
const { getMigrations } = require('../controller/developer.controller')

router.get('/migrations', getMigrations)

module.exports = { developerRouter: router }
