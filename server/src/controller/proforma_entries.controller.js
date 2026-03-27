const os = require('os')
const { checkConnection, SelectAll } = require('../database/util/queries.util')
const { formatMemoryUsage, formatTime, DataModeling } = require('../util/helper.util')
const { Master } = require('../database/model/Master')

require('dotenv').config()

const getProformaEntries = async (req, res, next) => {
  try {
    const proformaEntries = await SelectAll(Master.proforma_entries.tablename, Master.proforma_entries.prefix_)
    
    res.status(200).json({
      success: true,
      message: 'Proforma entries retrieved successfully',
      data: proformaEntries,
      count: proformaEntries.length,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error fetching proforma entries:', error)
    return res.status(500).json({ 
      success: false,
      message: 'Server error while fetching proforma entries',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    })
  }
}

module.exports = {
  getProformaEntries,
}
