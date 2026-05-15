const os = require('os')
const { checkConnection, SelectAll, SelectWithCondition, Insert, Transaction, Query } = require('../database/util/queries.util')
const { formatMemoryUsage, formatTime, DataModeling } = require('../util/helper.util')
const { Master } = require('../database/model/Master')
const { SQLQueryBuilder } = require('../util/helper.util')
const sql = new SQLQueryBuilder()
require('dotenv').config()

const getAccess = async (req, res, next) => {
  try {

        const query = `SELECT ${Master.master_access.selectOptionColumns.access_id} as access_id, ${Master.master_access.selectOptionColumns.access_name} as name, ${Master.master_access.selectOptionColumns.status} as status FROM ${Master.master_access.tablename}`
        
        const accesses = await SelectWithCondition(query)
        
    res.status(200).json({
      success: true,
      message: 'Accesses retrieved successfully',
      data: accesses,
      count: accesses.length,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error fetching accesses:', error)
    return res.status(500).json({ 
      success: false,
      message: 'Server error while fetching accesses',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    })
  }
}

const createAccess = async (req, res, next) => {
    try {
        const { access_name, status } = req.body;

        if (!access_name || !status) {
            return res.status(400).json({
                success: false,
                message: 'Access name and status are required'
            });
        }

        let queries = []
        
        queries.push({
            sql: sql.insert(Master.master_access.tablename, {
                columns: Master.master_access.insertColumns,
                prefix: Master.master_access.prefix,
                isTransaction: true
            })
                .build(),
            values: [
                access_name || null,
                status || null
            ]
        });

        let result = await Transaction(queries);

        const getIdQuery = `SELECT LAST_INSERT_ID() as insertId`;
        const idResult = await Query(getIdQuery);
        const newAccessId = idResult[0]?.insertId;


        if (!newAccessId) {
            throw new Error('Failed to get access ID from insertion');
        }

        const routes = [
            'dashboard',
            'access', 
            'users',
            'customers',
            'vendors',
            'charts',
            'proforma_entries',
            'product_service',
            'company',
            'receipts',
            'disbursement',
            'sales',
            'collections',
            'purchase',
            'payments',
            'adjustments',
            'vat',
            'witholding_tax',
            'trial_balance',
            'income_statement', 
            'general_ledger', 
            'balance_sheet',
            'journal_entries',
            'statement_of_comprehensive_income',
            'bank_reconciliation'
        ];

        let routeQueries = [];
        routes.forEach(route => {
            routeQueries.push({
                sql: sql.insert(Master.master_route_access.tablename, {
                    columns: Master.master_route_access.insertColumns,
                    prefix: Master.master_route_access.prefix,
                    isTransaction: true
                })
                    .build(),
                values: [
                    newAccessId,
                    route,
                    'Full Access'
                ]
            });
        });

        await Transaction(routeQueries);

        // Audit trail for create
        const now = new Date();
        const auditQueries = [];
        auditQueries.push({
            sql: sql.insert(Master.audit_trail.tablename, {
                columns: Master.audit_trail.insertColumns,
                prefix: Master.audit_trail.prefix,
                isTransaction: true
            }).build(),
            values: [
                newAccessId || null,
                'ACCESS',
                req.context?.username || null,
                now.toISOString().split('T')[0],
                now.toTimeString().split(' ')[0],
                `CREATE: ID ${newAccessId}`
            ]
        });
        await Transaction(auditQueries);

        res.status(201).json({
            success: true,
            message: 'Access created successfully with all routes',
            data: {
                id: newAccessId,
                ma_access_name: access_name,
                ma_status: status,
                routes_created: routes.length
            },
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Error creating access:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error while creating access',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
}

module.exports = {
  getAccess,
  createAccess
}
