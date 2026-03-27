const os = require('os')
const { checkConnection, SelectAll, SelectWithCondition } = require('../database/util/queries.util')
const { formatMemoryUsage, formatTime, DataModeling } = require('../util/helper.util')
const { Master } = require('../database/model/Master')
const {CheckPassword, Encrypter} = require('../util/cryptography.util')
const jwt = require('jsonwebtoken')


require('dotenv').config()


const logout = (req, res, next) => {
  req.session.jwt = null
  res.status(200).json({
    success: true,
    message: 'Logout successful',
    timestamp: new Date().toISOString(),
  })
}

const login = async (req, res, next) => {
  const { username, password } = req.body
  try {
    const query = `SELECT * FROM ${Master.master_user.tablename} WHERE mu_username = ? AND mu_status = 'active'`
    const condition = [username]
    
    const users = await SelectWithCondition(query, condition)
    
    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid username or user not active'
      })
    }
    
    const user = users[0]
    
    CheckPassword(password, user.mu_password, (error, isPasswordValid) => {
      if (error) {
        console.error('Password check error:', error)
        return res.status(500).json({
          success: false,
          message: 'Server error during password verification'
        })
      }
      
      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          message: 'Invalid password'
        })
      }

      const { mu_password, ...userWithoutPassword } = user
      
      const token = jwt.sign(
        { userId: user.mu_id, username: user.mu_username },
        process.env._SECRET_KEY,
        { expiresIn: '24h' }
      )
      
      req.session.jwt = token
      
      res.status(200).json({
        success: true,
        message: 'Login successful',
        data: {
          ...userWithoutPassword,
          token
        },
        timestamp: new Date().toISOString()
      })
    })
    
  } catch (error) {
    console.error('Credentials login error:', error)
    return res.status(500).json({ 
      success: false,
      message: 'Server error during credentials login',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    })
  }
}

module.exports = {
  login,
  logout
}
