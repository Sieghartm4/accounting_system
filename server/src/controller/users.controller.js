const os = require('os')
const { checkConnection, SelectAll } = require('../database/util/queries.util')
const { formatMemoryUsage, formatTime, DataModeling } = require('../util/helper.util')
const { Master } = require('../database/model/Master')

require('dotenv').config()

const getUsers = async (req, res, next) => {
  try {

    const users = await SelectAll(Master.master_user.tablename, Master.master_user.prefix_)
    
    const sanitizedUsers = users.map(user => {
      const { password, ...userWithoutPassword } = user
      return userWithoutPassword
    })

    res.status(200).json({
      success: true,
      message: 'Users retrieved successfully',
      data: sanitizedUsers,
      count: sanitizedUsers.length,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error fetching users:', error)
    return res.status(500).json({ 
      success: false,
      message: 'Server error while fetching users',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    })
  }
}

module.exports = {
  getUsers,
}
