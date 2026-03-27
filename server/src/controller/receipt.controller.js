const os = require('os')
const { checkConnection, SelectAll } = require('../database/util/queries.util')
const { formatMemoryUsage, formatTime, DataModeling } = require('../util/helper.util')
const { Accounting } = require('../database/model/Accounting')

require('dotenv').config()

const getReceipts = async (req, res, next) => {
  try {
    const receipts = await SelectAll(Accounting.receipts.tablename, Accounting.receipts.prefix_)
    
    res.status(200).json({
      success: true,
      message: 'Receipts retrieved successfully',
      data: receipts,
      count: receipts.length,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error fetching receipts:', error)
    return res.status(500).json({ 
      success: false,
      message: 'Server error while fetching receipts',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    })
  }
}

module.exports = {
  getReceipts,
}
