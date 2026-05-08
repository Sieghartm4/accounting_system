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

        const newCompanyId = result.insertId;

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
                newCompanyId || null,
                'COMPANY',
                req.context?.username || null,
                now.toISOString().split('T')[0],
                now.toTimeString().split(' ')[0],
                `CREATE: ID ${newCompanyId}`
            ]
        });
        await Transaction(auditQueries);

        res.status(201).json({
            success: true,
            message: 'Company created successfully',
            data: {
                id: newCompanyId,
                mc_company_id: newCompanyId,
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

        // Fetch existing company to compare changes
        const existingQuery = sql.select([Master.master_company.selectOptionColumns.company_name, Master.master_company.selectOptionColumns.owner_name, Master.master_company.selectOptionColumns.address, Master.master_company.selectOptionColumns.tin, Master.master_company.selectOptionColumns.website, Master.master_company.selectOptionColumns.email, Master.master_company.selectOptionColumns.phone, Master.master_company.selectOptionColumns.status])
          .from(Master.master_company.tablename)
          .where(Master.master_company.selectOptionColumns.company_id)
          .build();
        const existingCompanies = await Query(existingQuery, [id], Master.master_company.prefix_);
        const old = existingCompanies[0] || {};

        const updateColumns = [];
        const updateValues = [];
        const changes = [];

        if (company_name !== undefined && old.company_name !== company_name) {
            updateColumns.push('company_name');
            updateValues.push(company_name);
            changes.push(`name='${company_name}'`);
        }
        if (owner_name !== undefined && old.owner_name !== owner_name) {
            updateColumns.push('owner_name');
            updateValues.push(owner_name);
            changes.push(`owner='${owner_name}'`);
        }
        if (logo !== undefined) {
            updateColumns.push('logo');
            updateValues.push(logo);
            changes.push(`logo=updated`);
        }
        if (address !== undefined && old.address !== address) {
            updateColumns.push('address');
            updateValues.push(address);
            changes.push(`address='${address}'`);
        }
        if (tin !== undefined && old.tin !== tin) {
            updateColumns.push('tin');
            updateValues.push(tin);
            changes.push(`tin='${tin}'`);
        }
        if (website !== undefined && old.website !== website) {
            updateColumns.push('website');
            updateValues.push(website);
            changes.push(`website='${website}'`);
        }
        if (email !== undefined && old.email !== email) {
            updateColumns.push('email');
            updateValues.push(email);
            changes.push(`email='${email}'`);
        }
        if (phone !== undefined && old.phone !== phone) {
            updateColumns.push('phone');
            updateValues.push(phone);
            changes.push(`phone='${phone}'`);
        }
        if (status !== undefined && old.status !== status) {
            updateColumns.push('status');
            updateValues.push(status);
            changes.push(`status='${status}'`);
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

        // Audit trail for update
        const now = new Date();
        const auditQueries = [];
        auditQueries.push({
            sql: sql.insert(Master.audit_trail.tablename, {
                columns: Master.audit_trail.insertColumns,
                prefix: Master.audit_trail.prefix,
                isTransaction: true
            }).build(),
            values: [
                id || null,
                'COMPANY',
                req.context?.username || null,
                now.toISOString().split('T')[0],
                now.toTimeString().split(' ')[0],
                `UPDATE ID ${id}: ${changes.join(', ')}`
            ]
        });
        await Transaction(auditQueries);

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
