const os = require('os')
const { checkConnection, SelectAll, Transaction, Query, SelectWithCondition } = require('../database/util/queries.util')
const { formatMemoryUsage, formatTime, DataModeling } = require('../util/helper.util')
const { Master } = require('../database/model/Master')
const { SQLQueryBuilder } = require('../util/helper.util')
const sql = new SQLQueryBuilder()
require('dotenv').config()

const getChartsOfAccounts = async (req, res, next) => {
  try {
    const chartsOfAccounts = await SelectAll(Master.charts_of_accounts.tablename, Master.charts_of_accounts.prefix_)
    console.log(chartsOfAccounts)
    res.status(200).json({
      success: true,
      message: 'Charts of accounts retrieved successfully',
      data: chartsOfAccounts,
      count: chartsOfAccounts.length,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error fetching charts of accounts:', error)
    return res.status(500).json({ 
      success: false,
      message: 'Server error while fetching charts of accounts',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    })
  }
}

const createChartsOfAccount = async (req, res, next) => {
    try {
        const { code, name, type, description, status } = req.body;

        if (!code || !name || !type || !description || !status) {
            return res.status(400).json({
                success: false,
                message: 'Charts of account code, name, type, description and status are required'
            });
        }
        
        let queries = []
        
        queries.push({
            sql: sql.insert(Master.charts_of_accounts.tablename, {
                columns: Master.charts_of_accounts.insertColumns,
                prefix: Master.charts_of_accounts.prefix,
                isTransaction: true
            })
                .build(),
            values: [
                code || null,
                name || null,
                type || null,
                description || null,
                status || null
            ]
        });

        let result = await Transaction(queries);

        const getIdQuery = `SELECT LAST_INSERT_ID() as insertId`;
        const idResult = await Query(getIdQuery);
        const newChartsOfAccountId = idResult[0]?.insertId;

        if (!newChartsOfAccountId) {
            throw new Error('Failed to get charts of account ID from insertion');
        }

        res.status(201).json({
            success: true,
            message: 'Charts of account created successfully',
            data: {
                id: newChartsOfAccountId,
                code: code,
                name: name,
                type: type,
                description: description,
                status: status
            },
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Error creating charts of account:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error while creating charts of account',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
}

module.exports = {
  getChartsOfAccounts,
  createChartsOfAccount,
}
