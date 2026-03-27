const os = require('os')
const { checkConnection, SelectAll, Transaction, Query, Insert, SelectWithCondition } = require('../database/util/queries.util')
const { formatMemoryUsage, formatTime, DataModeling } = require('../util/helper.util')
const { Master } = require('../database/model/Master')
const { SQLQueryBuilder } = require('../util/helper.util')
const sql = new SQLQueryBuilder()
require('dotenv').config()

const getVendors = async (req, res, next) => {
  try {
    const vendors = await SelectAll(Master.vendors.tablename, Master.vendors.prefix_)
    
    res.status(200).json({
      success: true,
      message: 'Vendors retrieved successfully',
      data: vendors,
      count: vendors.length,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error fetching vendors:', error)
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching vendors',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    })
  }
}

const createVendor = async (req, res, next) => {
    try {
        const { code, name, category, type, status } = req.body;

        if (!code || !name || !category || !type || !status) {
            return res.status(400).json({
                success: false,
                message: 'Vendor code, name, category, type and status are required'
            });
        }
        
        let queries = []
        
        queries.push({
            sql: sql.insert(Master.vendors.tablename, {
                columns: Master.vendors.insertColumns,
                prefix: Master.vendors.prefix,
                isTransaction: true
            })
                .build(),
            values: [
                code || null,
                name || null,
                category || null,
                type || null,
                status || null
            ]
        });

        let result = await Transaction(queries);

        const getIdQuery = `SELECT LAST_INSERT_ID() as insertId`;
        const idResult = await Query(getIdQuery);
        const newVendorId = idResult[0]?.insertId;

        if (!newVendorId) {
            throw new Error('Failed to get vendor ID from insertion');
        }

        res.status(201).json({
            success: true,
            message: 'Vendor created successfully',
            data: {
                id: newVendorId,
                code: code,
                name: name,
                category: category,
                type: type,
                status: status
            },
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Error creating vendor:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error while creating vendor',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
}
module.exports = {
  getVendors,
  createVendor
}
