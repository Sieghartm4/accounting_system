const os = require('os')
const { checkConnection, SelectAll, Transaction, Query, Insert } = require('../database/util/queries.util')
const { formatMemoryUsage, formatTime, DataModeling } = require('../util/helper.util')
const { Accounting } = require('../database/model/Accounting')
const { Master } = require('../database/model/Master')
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

const getAdjustments = async (req, res, next) => {
    try {
        const query = sql.select([
                    { col: Accounting.adjustments.selectOptionColumns.id, as: 'id' },
                    { col: Accounting.adjustments.selectOptionColumns.document_reference, as: 'document_reference' },
                    { col: Accounting.adjustments.selectOptionColumns.posting_date, as: 'posting_date' },
                    { col: Accounting.adjustments.selectOptionColumns.remarks, as: 'remarks' },
                    { col: Accounting.adjustments.selectOptionColumns.status, as: 'status' },
                    { col: Accounting.adjustments.selectOptionColumns.total_amount, as: 'total_amount' },
                    { col: Accounting.adjustments.selectOptionColumns.created_date, as: 'created_date' },
                    { col: Accounting.adjustments.selectOptionColumns.created_by, as: 'created_by' }
                ])
                .from(Accounting.adjustments.tablename)
                .build();

        let result = await Query(query, [], [Accounting.adjustments.prefix_]);
        res.status(200).json({
            success: true,
            message: 'Adjustments retrieved successfully',
            data: result,
            count: result.length,
            timestamp: new Date().toISOString()
        })

    } catch (error) {
        console.error('Error fetching adjustments:', error)
        return res.status(500).json({
            success: false,
            message: 'Server error while fetching adjustments',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        })
    }
}

const getAdjustmentById = async (req, res, next) => {
    try {
        const { adjustment_id } = req.params;
        const adjustmentId = Number(adjustment_id);
        if (!adjustment_id || isNaN(adjustmentId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid adjustment ID provided',
                timestamp: new Date().toISOString()
            });
        }

        // Main adjustment query
        const adjustment_query = sql.select([
            { col: Accounting.adjustments.selectOptionColumns.id, as: 'id' },
            { col: Accounting.adjustments.selectOptionColumns.document_reference, as: 'document_reference' },
            { col: Accounting.adjustments.selectOptionColumns.posting_date, as: 'posting_date' },
            { col: Accounting.adjustments.selectOptionColumns.remarks, as: 'remarks' },
            { col: Accounting.adjustments.selectOptionColumns.status, as: 'status' },
            { col: Accounting.adjustments.selectOptionColumns.total_amount, as: 'total_amount' },
            { col: Accounting.adjustments.selectOptionColumns.created_date, as: 'created_date' },
            { col: Accounting.adjustments.selectOptionColumns.created_by, as: 'created_by' }
        ])
            .from(Accounting.adjustments.tablename)
            .where(Accounting.adjustments.selectOptionColumns.id)
            .build();

        let adjustment = await Query(adjustment_query, [adjustmentId], [Accounting.adjustments.prefix_]);

        // Attachments query
        const adjustment_attachments_query = sql.select([
            { col: Accounting.adjustment_attachments.selectOptionColumns.id, as: 'id' },
            { col: Accounting.adjustment_attachments.selectOptionColumns.name, as: 'name' },
            { col: Accounting.adjustment_attachments.selectOptionColumns.file, as: 'file' },
            { col: Accounting.adjustment_attachments.selectOptionColumns.remarks, as: 'remarks' },
            { col: Accounting.adjustment_attachments.selectOptionColumns.uploaded_by, as: 'uploaded_by' },
            { col: Accounting.adjustment_attachments.selectOptionColumns.uploaded_date, as: 'uploaded_date' }
        ])
            .from(Accounting.adjustment_attachments.tablename)
            .where(Accounting.adjustment_attachments.selectOptionColumns.adjustment_id)
            .build();

        let adjustment_attachments = await Query(adjustment_attachments_query, [adjustmentId], [Accounting.adjustment_attachments.prefix_]);

        console.log(adjustment, adjustment_attachments)
        res.status(200).json({
            success: true,
            message: 'Adjustment retrieved successfully',
            data: adjustment,
            attachments: adjustment_attachments,
            timestamp: new Date().toISOString()
        })

    } catch (error) {
        console.error('Error fetching adjustment:', error)
        return res.status(500).json({
            success: false,
            message: 'Server error while fetching adjustment',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        })
    }
}

const createAdjustment = async (req, res, next) => {
    try {
        const { 
            document_reference, 
            posting_date, 
            remarks, 
            status, 
            total_amount, 
            created_by, 
            adjustment_attachments,
            journal_entries 
        } = req.body;
        console.log(req.body)
        
        if (!document_reference || !posting_date || !remarks || !total_amount || !created_by) {
            return res.status(400).json({
                success: false,
                message: 'All required fields must be provided'
            });
        }
        
        let connection;
        try {
            connection = await pool.getConnection();
            await connection.beginTransaction();
            
            const mainQuery = sql.insert(Accounting.adjustments.tablename, {
                columns: Accounting.adjustments.insertColumns,
                prefix: Accounting.adjustments.prefix,
                isTransaction: true
            }).build();
            
            const mainValues = [
                document_reference || null,
                posting_date || null,
                remarks || null,
                status || 'PREPARED BY',
                total_amount || null,
                new Date().toISOString().split('T')[0],
                created_by || null
            ];
            
            const [mainResult] = await connection.execute(mainQuery, mainValues);
            const adjustmentId = mainResult.insertId;
            
            if (adjustment_attachments && adjustment_attachments.length > 0) {
                for (const attachment of adjustment_attachments) {
                    const attachmentQuery = sql.insert(Accounting.adjustment_attachments.tablename, {
                        columns: Accounting.adjustment_attachments.insertColumns,
                        prefix: Accounting.adjustment_attachments.prefix,
                        isTransaction: true
                    }).build();
                    
                    const attachmentValues = [
                        adjustmentId,
                        attachment.file || null,
                        attachment.name || null,
                        attachment.remarks || null,
                        attachment.uploaded_by || null,
                        attachment.uploaded_date || new Date().toLocaleDateString()
                    ];
                    
                    await connection.execute(attachmentQuery, attachmentValues);
                }
            }

            if (journal_entries && journal_entries.length > 0) {
                for (const entry of journal_entries) {
                    const entryQuery = sql.insert(Accounting.journal_entries.tablename, {
                        columns: Accounting.journal_entries.insertColumns,
                        prefix: Accounting.journal_entries.prefix,
                        isTransaction: true
                    }).build();
                    
                    const type = entry.debit > 0 ? 'debit' : 'credit';
                    const amount = entry.debit > 0 ? entry.debit : entry.credit;
                    
                    const entryValues = [
                        "adjustments",
                        adjustmentId,
                        entry.account_id || null,
                        entry.responsibility_center || '',
                        type,
                        amount,
                        new Date().toISOString().split('T')[0]
                    ];
                    
                    await connection.execute(entryQuery, entryValues);
                }
            }
            
            // Commit transaction
            await connection.commit();
            
            res.status(201).json({
                success: true,
                message: 'Adjustment created successfully',
                data: { id: adjustmentId },
                timestamp: new Date().toISOString()
            });
            
        } catch (error) {
            // Rollback transaction if error occurs
            if (connection) {
                await connection.rollback();
            }
            throw error;
        } finally {
            // Release connection
            if (connection) {
                connection.release();
            }
        }

    } catch (error) {
        console.error('Error creating adjustment:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error while creating adjustment',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
}

const updateAdjustment = async (req, res, next) => {
    try {
        const { adjustment_id } = req.params;
        const { 
            document_reference, 
            posting_date, 
            remarks, 
            status, 
            total_amount
        } = req.body;
        
        if (!adjustment_id || isNaN(adjustment_id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid adjustment ID provided'
            });
        }
        
        if (!document_reference || !posting_date || !remarks || !total_amount) {
            return res.status(400).json({
                success: false,
                message: 'All required fields must be provided'
            });
        }
        
        const updateQuery = sql.update(Accounting.adjustments.tablename)
            .set({
                document_reference: document_reference || null,
                posting_date: posting_date || null,
                remarks: remarks || null,
                status: status || null,
                total_amount: total_amount || null
            })
            .where(Accounting.adjustments.selectOptionColumns.id)
            .build();
            
        const updateValues = [
            document_reference || null,
            posting_date || null,
            remarks || null,
            status || null,
            total_amount || null,
            Number(adjustment_id)
        ];
        
        let result = await Query(updateQuery, updateValues, [Accounting.adjustments.prefix_]);
        
        res.status(200).json({
            success: true,
            message: 'Adjustment updated successfully',
            data: result,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Error updating adjustment:', error)
        return res.status(500).json({
            success: false,
            message: 'Server error while updating adjustment',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
}

const deleteAdjustment = async (req, res, next) => {
    try {
        const { adjustment_id } = req.params;
        const adjustmentId = Number(adjustment_id);
        
        if (!adjustment_id || isNaN(adjustmentId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid adjustment ID provided'
            });
        }
        
        const deleteQuery = sql.delete(Accounting.adjustments.tablename)
            .where(Accounting.adjustments.selectOptionColumns.id)
            .build();
            
        let result = await Query(deleteQuery, [adjustmentId], [Accounting.adjustments.prefix_]);
        
        res.status(200).json({
            success: true,
            message: 'Adjustment deleted successfully',
            data: result,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Error deleting adjustment:', error)
        return res.status(500).json({
            success: false,
            message: 'Server error while deleting adjustment',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
}

module.exports = {
    getAdjustments,
    getAdjustmentById,
    createAdjustment,
    updateAdjustment,
    deleteAdjustment
}
