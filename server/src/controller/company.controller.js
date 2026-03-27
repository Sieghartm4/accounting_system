const os = require('os')
const { checkConnection, SelectAll, Insert, Transaction, Query } = require('../database/util/queries.util')
const { formatMemoryUsage, formatTime, DataModeling } = require('../util/helper.util')
const { Master } = require('../database/model/Master')
const { SQLQueryBuilder } = require('../util/helper.util')
const sql = new SQLQueryBuilder()

require('dotenv').config()

const getAllCompanies = async (req, res, next) => {
    try {

        const statement = sql.selectAll(Master.master_company.tablename)
            .from(Master.master_company.tablename)
            .build();
        const companies = await Query(statement, [], Master.master_company.prefix_)

        res.status(200).json({
            success: true,
            message: 'Companies retrieved successfully',
            data: companies,
            count: companies.length,
            timestamp: new Date().toISOString()
        })

    } catch (error) {
        console.error('Error fetching companies:', error)
        return res.status(500).json({
            success: false,
            message: 'Server error while fetching companies',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        })
    }
}

const createCompany = async (req, res, next) => {
    try {
        const { name, owner_name, logo, address, status } = req.body;

        if (!name || !owner_name || !logo || !address || !status) {
            return res.status(400).json({
                success: false,
                message: 'Company name, owner name, logo, address and status are required'
            });
        }
        let queries = []
        queries.push({
            sql: sql.insert(Master.master_company.tablename, {
                columns: Master.master_company.insertColumns,
                prefix: Master.master_company.prefix,
                isTransaction: true
            })
                .build(),
            values: [
                name,
                owner_name || null,
                logo || null,
                address || null,
                status || 'active'
            ]
        })

        let result = await Transaction(queries)

        res.status(201).json({
            success: true,
            message: 'Company created successfully',
            data: {
                id: result.insertId,
                mc_company_name: name,
                mc_owner_name: owner_name,
                mc_logo: logo,
                mc_address: address,
                mc_status: status
            },
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Error creating company:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error while creating company',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
}
module.exports = {
    getAllCompanies,
    createCompany
}
