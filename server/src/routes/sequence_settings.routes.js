const express = require('express')

const {
  getSequenceSettings,
  createSequenceSetting,
  updateSequenceSetting,
} = require('../controller/sequence_settings.controller')

const router = express.Router()

router.get('/', getSequenceSettings)
router.post('/', createSequenceSetting)
router.put('/:id', updateSequenceSetting)

module.exports = { sequenceSettingsRouter: router }
