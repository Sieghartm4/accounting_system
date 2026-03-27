const os = require('os')
const { checkConnection, SelectAll } = require('../database/util/queries.util')
const { formatMemoryUsage, formatTime, DataModeling } = require('../util/helper.util')
const { Accounting } = require('../database/model/Accounting')

require('dotenv').config()

const getSales = async (req, res, next) => {
  try {
    const sales = await SelectAll(Accounting.sales.tablename, Accounting.sales.prefix_)
    
    res.status(200).json({
      success: true,
      message: 'Sales retrieved successfully',
      data: sales,
      count: sales.length,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error fetching sales:', error)
    return res.status(500).json({ 
      success: false,
      message: 'Server error while fetching sales',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    })
  }
}

module.exports = {
  getSales,
}
