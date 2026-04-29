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

        if (!company_name || !owner_name || !address || !status) {
            return res.status(400).json({
                success: false,
                message: 'Company name, owner name, address and status are required'
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

        if (!company_name || !owner_name || !address || !status) {
            return res.status(400).json({
                success: false,
                message: 'Company name, owner name, address and status are required'
            });
        }

        // Build update query dynamically based on provided fields
        const updateFields = {};
        if (company_name !== undefined) updateFields.mc_company_name = company_name;
        if (owner_name !== undefined) updateFields.mc_owner_name = owner_name;
        if (logo !== undefined) updateFields.mc_logo = logo;
        if (address !== undefined) updateFields.mc_address = address;
        if (tin !== undefined) updateFields.mc_tin = tin;
        if (website !== undefined) updateFields.mc_website = website;
        if (email !== undefined) updateFields.mc_email = email;
        if (phone !== undefined) updateFields.mc_phone = phone;
        if (status !== undefined) updateFields.mc_status = status;

        if (Object.keys(updateFields).length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No fields to update'
            });
        }

        const updateStatement = sql.update(Master.master_company.tablename)
            .set(updateFields)
            .where('mc_company_id', '=', id)
            .build();

        await Query(updateStatement, [], Master.master_company.prefix_);

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
    createCompany,
    updateCompany
}
