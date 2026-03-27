const os = require('os')
const { checkConnection, SelectAll } = require('../database/util/queries.util')
const { formatMemoryUsage, formatTime, DataModeling } = require('../util/helper.util')
const { Accounting } = require('../database/model/Accounting')

require('dotenv').config()

const getCashDisbursements = async (req, res, next) => {
  try {
    const cashDisbursements = await SelectAll(Accounting.cash_disbursements.tablename, Accounting.cash_disbursements.prefix_)
    
    res.status(200).json({
      success: true,
      message: 'Cash disbursements retrieved successfully',
      data: cashDisbursements,
      count: cashDisbursements.length,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error fetching cash disbursements:', error)
    return res.status(500).json({ 
      success: false,
      message: 'Server error while fetching cash disbursements',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    })
  }
}

module.exports = {
  getCashDisbursements,
}
