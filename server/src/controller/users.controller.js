const os = require('os')
const { checkConnection, SelectAll, Query, Transaction } = require('../database/util/queries.util')
const { formatMemoryUsage, formatTime, DataModeling } = require('../util/helper.util')
const { Master } = require('../database/model/Master')
const { SQLQueryBuilder } = require('../util/helper.util')
const { getTenantPool } = require('../database/util/tenantConnection.util')
const sql = new SQLQueryBuilder()

require('dotenv').config()

const getUsers = async (req, res, next) => {
  try {

    const query = sql.select([
      { col: Master.master_user.selectOptionColumns.id, as: 'id' },
      { col: Master.master_user.selectOptionColumns.fullname, as: 'fullname' },
      { col: Master.master_user.selectOptionColumns.username, as: 'username' },
      { col: Master.master_access.selectOptionColumns.access_name, as: 'access_name' },
      { col: Master.master_user.selectOptionColumns.status, as: 'status' }
    ])
      .innerJoin(Master.master_access.tablename, Master.master_user.selectOptionColumns.access_id, Master.master_access.selectOptionColumns.access_id)
      .from(Master.master_user.tablename)
      .build();

    let users = await Query(query, [], [Master.master_user.prefix_, Master.master_access.prefix_]);

    res.status(200).json({
      success: true,
      message: 'Users retrieved successfully',
      data: users,
      count: users.length,
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
