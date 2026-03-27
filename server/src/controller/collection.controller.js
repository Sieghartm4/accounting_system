const os = require('os')
const { checkConnection, SelectAll } = require('../database/util/queries.util')
const { formatMemoryUsage, formatTime, DataModeling } = require('../util/helper.util')
const { Accounting } = require('../database/model/Accounting')

require('dotenv').config()

const getCollections = async (req, res, next) => {
  try {
    const collections = await SelectAll(Accounting.collections.tablename, Accounting.collections.prefix_)
    
    res.status(200).json({
      success: true,
      message: 'Collections retrieved successfully',
      data: collections,
      count: collections.length,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error fetching collections:', error)
    return res.status(500).json({ 
      success: false,
      message: 'Server error while fetching collections',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    })
  }
}

module.exports = {
  getCollections,
}
