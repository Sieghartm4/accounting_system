const os = require('os')
const { checkConnection, SelectAll, Transaction, Query, Insert } = require('../database/util/queries.util')
const { formatMemoryUsage, formatTime, DataModeling } = require('../util/helper.util')
const { Master } = require('../database/model/Master')
const { Accounting } = require('../database/model/Accounting')
const { SQLQueryBuilder } = require('../util/helper.util')
const { getTenantPool } = require('../database/util/tenantConnection.util')
const sql = new SQLQueryBuilder()

require('dotenv').config()

const getAdjustments = async (req, res, next) => {
    try {
        const query = sql.select([
                    { col: Accounting.adjustments.selectOptionColumns.id, as: 'id' },
                    { col: Accounting.adjustments.selectOptionColumns.document_reference, as: 'document_reference' },
                    { col: Accounting.adjustments.selectOptionColumns.posting_date, as: 'posting_date' },
                    { col: Accounting.adjustments.selectOptionColumns.total_amount, as: 'total_amount' },
                    { col: Accounting.adjustments.selectOptionColumns.created_by, as: 'prepared_by' },
                    { col: Accounting.adjustments.selectOptionColumns.status, as: 'status' },
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
        console.log("adjustment_id", adjustment_id);
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

        // Journal entries query
        const journal_entries_query = sql.select([
            { col: Accounting.journal_entries.selectOptionColumns.id, as: 'id' },
            { col: Accounting.journal_entries.selectOptionColumns.coa_id, as: 'coa_id' },
            { col: Master.charts_of_accounts.selectOptionColumns.name, as: 'account_name' },
            { col: Accounting.journal_entries.selectOptionColumns.responsibility_center, as: 'responsibility_center' },
            { col: Accounting.journal_entries.selectOptionColumns.type, as: 'type' },
            { col: Accounting.journal_entries.selectOptionColumns.amount, as: 'amount' },
            { col: Accounting.journal_entries.selectOptionColumns.date, as: 'date' }
        ])
            .from(Accounting.journal_entries.tablename)
            .innerJoin(Master.charts_of_accounts.tablename, Accounting.journal_entries.selectOptionColumns.coa_id, Master.charts_of_accounts.selectOptionColumns.id)
            .where(Accounting.journal_entries.selectOptionColumns.db_name)
            .andWhere(Accounting.journal_entries.selectOptionColumns.db_id)
            .build();

        let journal_entries = await Query(journal_entries_query, ['adjustments', adjustmentId], [Accounting.journal_entries.prefix_]);

        console.log(adjustment, adjustment_attachments, journal_entries)
        res.status(200).json({
            success: true,
            message: 'Adjustment retrieved successfully',
            data: adjustment,
            attachments: adjustment_attachments,
            journal_entries: journal_entries,
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
            total_amount, 
            created_by, 
            adjustment_attachments,
            journal_entries 
        } = req.body;
        console.log(req.body)
        
        if (!document_reference || !posting_date || !total_amount || !created_by) {
            return res.status(400).json({
                success: false,
                message: 'All required fields must be provided'
            });
        }
        
        let connection;
        try {
            connection = await getTenantPool().getConnection();
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
                'PREPARED',
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
    const {
      updates
    } = req.body;
        
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
        const { id, currentState } = update;
        
        
        if (!id) {
          throw new Error('Each update requires id');
        }
        
        if (!currentState) {
          throw new Error(`Each update requires currentState. Received: ${JSON.stringify(update)}`);
        }

        let nextState;
        if (currentState === 'PREPARED') {
          nextState = 'CHECKED';
        } else if (currentState === 'CHECKED') {
          nextState = 'APPROVED';
        } else {
          throw new Error(`Invalid current state: ${currentState}. Only PREPARED and CHECKED can be updated.`);
        }

        const updateQuery = sql.update(Accounting.adjustments.tablename)
          .set([Accounting.adjustments.selectOptionColumns.status])
          .where(Accounting.adjustments.selectOptionColumns.id)
          .build();
        const updateValues = [nextState, id];

        return connection.execute(updateQuery, updateValues);
      });

      const results = await Promise.all(updatePromises);

      await connection.commit();

      res.status(200).json({
        success: true,
        message: `${results.length} adjustment(s) updated successfully`,
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
    console.error('Error updating adjustments:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while updating adjustments',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
}

const updateAdjustmentData = async (req, res, next) => {
  try {
    const { adjustment_id } = req.params;
    const {
      document_reference,
      posting_date,
      remarks,
      total_amount,
      adjustment_attachments,
      journal_entries
    } = req.body;
    
    console.log('Updating adjustment data:', req.body);
    
    const adjustmentId = Number(adjustment_id);
    if (!adjustment_id || isNaN(adjustmentId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid adjustment ID provided',
        timestamp: new Date().toISOString()
      });
    }

    if (!document_reference || !posting_date || !total_amount) {
      return res.status(400).json({
        success: false,
        message: 'Required fields must be provided'
      });
    }
    
    let connection;
    try {
      connection = await getTenantPool().getConnection();
      await connection.beginTransaction();
      
      // Update adjustment header
      const updateHeaderQuery = sql.update(Accounting.adjustments.tablename)
        .set([
          Accounting.adjustments.selectOptionColumns.document_reference,
          Accounting.adjustments.selectOptionColumns.posting_date,
          Accounting.adjustments.selectOptionColumns.remarks,
          Accounting.adjustments.selectOptionColumns.total_amount
        ])
        .where(Accounting.adjustments.selectOptionColumns.id)
        .build();
      
      const headerValues = [
        document_reference || null,
        posting_date || null,
        remarks || null,
        total_amount || null,
        adjustmentId
      ];
      
      await connection.execute(updateHeaderQuery, headerValues);
      
      // Delete existing journal entries for this adjustment
      const deleteJournalQuery = sql.delete(Accounting.journal_entries.tablename)
        .where(Accounting.journal_entries.selectOptionColumns.db_name)
        .andWhere(Accounting.journal_entries.selectOptionColumns.db_id)
        .build();
      
      await connection.execute(deleteJournalQuery, ['adjustments', adjustmentId]);
      
      // Insert new journal entries
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
      
      // Delete existing attachments for this adjustment
      const deleteAttachmentsQuery = sql.delete(Accounting.adjustment_attachments.tablename)
        .where(Accounting.adjustment_attachments.selectOptionColumns.adjustment_id)
        .build();
      
      await connection.execute(deleteAttachmentsQuery, [adjustmentId]);
      
      // Insert new attachments
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
      
      // Commit transaction
      await connection.commit();
      
      res.status(200).json({
        success: true,
        message: 'Adjustment updated successfully',
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
    console.error('Error updating adjustment data:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while updating adjustment data',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
}

module.exports = {
    getAdjustments,
    getAdjustmentById,
    createAdjustment,
    updateAdjustment,
    updateAdjustmentData,
}
