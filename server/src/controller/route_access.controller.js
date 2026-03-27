const os = require('os')
const { checkConnection, SelectAll, SelectWithCondition } = require('../database/util/queries.util')
const { formatMemoryUsage, formatTime, DataModeling } = require('../util/helper.util')
const { Master } = require('../database/model/Master')

require('dotenv').config()

const getRouteAccessById = async (req, res, next) => {
    const { access_id } = req.body
  try {
    const query = `SELECT ${Master.master_route_access.selectOptionColumns.name} as name, ${Master.master_route_access.selectOptionColumns.status} as status FROM ${Master.master_route_access.tablename} WHERE ${Master.master_route_access.selectOptionColumns.access_id} = ?`
    const condition = [access_id]
    
    const access = await SelectWithCondition(query, condition)
    
    res.status(200).json({
      success: true,
      message: 'Route Access retrieved successfully',
      data: access,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error fetching route access:', error)
    return res.status(500).json({ 
      success: false,
      message: 'Server error while fetching route access',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    })
  }
}

module.exports = {
  getRouteAccessById,
}
