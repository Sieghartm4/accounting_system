const os = require('os')
const { checkConnection, SelectAll, SelectWithCondition, Transaction, Query, Insert } = require('../database/util/queries.util')
const { formatMemoryUsage, formatTime, DataModeling } = require('../util/helper.util')
const { Master } = require('../database/model/Master')
const { SQLQueryBuilder } = require('../util/helper.util')
const { getTenantPool } = require('../database/util/tenantConnection.util')
const sql = new SQLQueryBuilder()

require('dotenv').config()
require('dotenv').config()

const getRouteAccessById = async (req, res, next) => {
    const { access_id } = req.body
  try {
    const query = `SELECT ${Master.master_route_access.selectOptionColumns.id} as id, ${Master.master_route_access.selectOptionColumns.name} as name, ${Master.master_route_access.selectOptionColumns.status} as status FROM ${Master.master_route_access.tablename} WHERE ${Master.master_route_access.selectOptionColumns.access_id} = ?`
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

const updateRouteAccess = async (req, res, next) => {
  try {
    const {
      updates
    } = req.body;
    console.log("body", req.body);
    
    if (!updates || !Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Updates array is required'
      });
    }

    let connection;
    try {
      connection = await getTenantPool().getConnection();
      await connection.beginTransaction();

      const updatePromises = updates.map(async (update) => {
        const { id, access_id, status } = update;
        
        if (!id || !access_id || !status) {
          throw new Error('Each update requires id, access_id, and status');
        }

        const updateQuery = sql.update(Master.master_route_access.tablename)
        .set([Master.master_route_access.selectOptionColumns.status])
        .where(Master.master_route_access.selectOptionColumns.id)
        .build();
        const updateValues = [status, id];
        return connection.execute(updateQuery, updateValues);
      });

      const results = await Promise.all(updatePromises);
      
      await connection.commit();

      res.status(200).json({
        success: true,
        message: `${results.length} route access records updated successfully`,
        data: {
          updatedCount: results.length,
          updates: results.map(result => ({ id: result.insertId }))
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      if (connection) {
        await connection.rollback();
      }
      throw error;
    } finally {
      if (connection) {
        connection.release();
      }
    }

  } catch (error) {
    console.error('Error updating route access:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while updating route access',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
}

module.exports = {
  getRouteAccessById,
  updateRouteAccess
}
