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

const getCompany = async (req, res, next) => {
    try {
        const statement = sql.selectAll(Master.master_company.tablename)
            .from(Master.master_company.tablename)
            .build() + ' LIMIT 1';
        const companies = await Query(statement, [], Master.master_company.prefix_)

        const company = companies.length > 0 ? companies[0] : null;
        console.log("company", company)
        res.status(200).json({
            success: true,
            message: 'Company retrieved successfully',
            data: company,
            timestamp: new Date().toISOString()
        })

    } catch (error) {
        console.error('Error fetching company:', error)
        return res.status(500).json({
            success: false,
            message: 'Server error while fetching company',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        })
    }
}

const createCompany = async (req, res, next) => {
    try {
        const { 
            company_name, 
            owner_name, 
            logo, 
            address, 
            tin, 
            website, 
            email, 
            phone, 
            status 
        } = req.body;

        if (!company_name) {
            return res.status(400).json({
                success: false,
                message: 'Company name is required'
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
                company_name,
                owner_name || null,
                logo || null,
                address || null,
                tin || null,
                website || null,
                email || null,
                phone || null,
                status || 'active'
            ]
        })

        let result = await Transaction(queries)

        res.status(201).json({
            success: true,
            message: 'Company created successfully',
            data: {
                id: result.insertId,
                mc_company_id: result.insertId,
                mc_company_name: company_name,
                mc_owner_name: owner_name,
                mc_logo: logo,
                mc_address: address,
                mc_tin: tin,
                mc_website: website,
                mc_email: email,
                mc_phone: phone,
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

const updateCompany = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { 
            company_name, 
            owner_name, 
            logo, 
            address, 
            tin, 
            website, 
            email, 
            phone, 
            status 
        } = req.body;

        if (!id) {
            return res.status(400).json({
                success: false,
                message: 'Company ID is required'
            });
        }

        if (!company_name) {
            return res.status(400).json({
                success: false,
                message: 'Company name is required'
            });
        }

        const updateColumns = [];
        const updateValues = [];

        if (company_name !== undefined) {
            updateColumns.push('company_name');
            updateValues.push(company_name);
        }
        if (owner_name !== undefined) {
            updateColumns.push('owner_name');
            updateValues.push(owner_name);
        }
        if (logo !== undefined) {
            updateColumns.push('logo');
            updateValues.push(logo);
        }
        if (address !== undefined) {
            updateColumns.push('address');
            updateValues.push(address);
        }
        if (tin !== undefined) {
            updateColumns.push('tin');
            updateValues.push(tin);
        }
        if (website !== undefined) {
            updateColumns.push('website');
            updateValues.push(website);
        }
        if (email !== undefined) {
            updateColumns.push('email');
            updateValues.push(email);
        }
        if (phone !== undefined) {
            updateColumns.push('phone');
            updateValues.push(phone);
        }
        if (status !== undefined) {
            updateColumns.push('status');
            updateValues.push(status);
        }

        if (updateColumns.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No fields to update'
            });
        }

        const updateStatement = sql.update(Master.master_company.tablename, {
            prefix: Master.master_company.prefix
        })
            .set(updateColumns)
            .where('mc_company_id', '=', id)
            .build();

        await Query(updateStatement, [...updateValues, id], Master.master_company.prefix_);

        res.status(200).json({
            success: true,
            message: 'Company updated successfully',
            data: {
                mc_company_id: parseInt(id),
                mc_company_name: company_name,
                mc_owner_name: owner_name,
                mc_logo: logo,
                mc_address: address,
                mc_tin: tin,
                mc_website: website,
                mc_email: email,
                mc_phone: phone,
                mc_status: status
            },
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Error updating company:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error while updating company',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
}
module.exports = {
    getAllCompanies,
    getCompany,
    createCompany,
    updateCompany
}
