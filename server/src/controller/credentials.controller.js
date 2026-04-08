const os = require('os')
const { checkConnection, SelectAll, SelectWithCondition, Transaction, Query, Insert } = require('../database/util/queries.util')
const { formatMemoryUsage, formatTime, DataModeling } = require('../util/helper.util')
const { Master } = require('../database/model/Master')
const {CheckPassword, Encrypter} = require('../util/cryptography.util')
const jwt = require('jsonwebtoken')
const { SQLQueryBuilder } = require('../util/helper.util')
const sql = new SQLQueryBuilder()
const mysql = require('mysql2/promise')
const CONFIG = require('../database/config/config')

const pool = mysql.createPool({
  host: CONFIG[process.env.NODE_ENV].host,
  user: CONFIG[process.env.NODE_ENV].username,
  password: CONFIG[process.env.NODE_ENV].password,
  database: CONFIG[process.env.NODE_ENV].database,
  multipleStatements: CONFIG[process.env.NODE_ENV].dialectOptions.multipleStatements,
})


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
    const query = sql.select([
      { col: Master.master_user.selectOptionColumns.id, as: 'id' },
      { col: Master.master_user.selectOptionColumns.username, as: 'username' },
      { col: Master.master_user.selectOptionColumns.password, as: 'password' },
      { col: Master.master_user.selectOptionColumns.fullname, as: 'fullname' },
      { col: Master.master_user.selectOptionColumns.access_id, as: 'access_id' },
      { col: Master.master_access.selectOptionColumns.access_name, as: 'access' }
    ])
      .innerJoin(Master.master_access.tablename, Master.master_user.selectOptionColumns.id, Master.master_access.selectOptionColumns.access_id)
      .from(Master.master_user.tablename)
      .where(Master.master_user.selectOptionColumns.username)
      .where(Master.master_user.selectOptionColumns.status)
      .build();
    
    const users = await Query(query, ['active', username], [Master.master_user.prefix_, Master.master_access.prefix_])
    console.log(users)
    const route_access_query = sql.select([
      { col: Master.master_route_access.selectOptionColumns.name, as: 'name' },
      { col: Master.master_route_access.selectOptionColumns.status, as: 'status' },
    ])
      .from(Master.master_route_access.tablename)
      .where(Master.master_route_access.selectOptionColumns.access_id)
      .build();
    
    const route_access = await Query(route_access_query, [users[0].access_id], [Master.master_route_access.prefix_])
    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid username or user not active'
      })
    }
    
    const user = users[0]
    
    CheckPassword(password, user.password, (error, isPasswordValid) => {
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

      const { password, ...userWithoutPassword } = user
      
      const token = jwt.sign(
        { userId: user.id, username: user.username },
        process.env._SECRET_KEY,
        { expiresIn: '24h' }
      )
      
      req.session.jwt = token
      
      res.status(200).json({
        success: true,
        message: 'Login successful',
        data: {
          ...userWithoutPassword,
          route_access,
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
