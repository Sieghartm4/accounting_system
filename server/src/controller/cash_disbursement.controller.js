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

const getCashDisbursements = async (req, res, next) => {
  try {
    const query = sql.select([
      { col: Accounting.cash_disbursements.selectOptionColumns.id, as: 'id' },
      { col: Master.vendors.selectOptionColumns.name, as: 'vendor' },
      { col: Accounting.cash_disbursements.selectOptionColumns.document_reference, as: 'doc_ref' },
      { col: Accounting.cash_disbursements.selectOptionColumns.payment_date, as: 'payment_date' },
      { col: Accounting.cash_disbursements.selectOptionColumns.mode_of_payment, as: 'mode' },
      { col: Accounting.cash_disbursements.selectOptionColumns.bank_name, as: 'bank_name' },
      { col: Accounting.cash_disbursements.selectOptionColumns.check_number, as: 'check_number' },
      { col: Accounting.cash_disbursements.selectOptionColumns.remarks, as: 'remarks' },
      { col: Accounting.cash_disbursements.selectOptionColumns.total_amount_due, as: 'amount_due' },
      { col: Accounting.cash_disbursements.selectOptionColumns.state, as: 'state' }
    ])
      .from(Accounting.cash_disbursements.tablename)
      .innerJoin(Master.vendors.tablename, Accounting.cash_disbursements.selectOptionColumns.vendor_id, Master.vendors.selectOptionColumns.id)
      .build();

    let result = await Query(query, [Accounting.cash_disbursements.prefix_, Master.vendors.prefix_]);
    res.status(200).json({
      success: true,
      message: 'Cash disbursements retrieved successfully',
      data: result,
      count: result.length,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error fetching cash disbursements:', error)
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching cash disbursements',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    })
  }
}

const getAllCashDisbursements = async (req, res, next) => {
  const { cash_disbursement_id } = req.params;
  const cashDisbursementId = Number(cash_disbursement_id);
  console.log('Converted cash_disbursement_id:', cashDisbursementId, 'type:', typeof cashDisbursementId);
  try {
    const cash_disbursements_query = sql.select([
      { col: Accounting.cash_disbursements.selectOptionColumns.id, as: 'id' },
      { col: Accounting.cash_disbursements.selectOptionColumns.vendor_id, as: 'vendor_id' },
      { col: Master.vendors.selectOptionColumns.name, as: 'vendor' },
      { col: Accounting.cash_disbursements.selectOptionColumns.document_reference, as: 'doc_ref' },
      { col: Accounting.cash_disbursements.selectOptionColumns.payment_date, as: 'payment_date' },
      { col: Accounting.cash_disbursements.selectOptionColumns.mode_of_payment, as: 'mode' },
      { col: Accounting.cash_disbursements.selectOptionColumns.bank_name, as: 'bank_name' },
      { col: Accounting.cash_disbursements.selectOptionColumns.check_number, as: 'check_number' },
      { col: Accounting.cash_disbursements.selectOptionColumns.remarks, as: 'remarks' },
      { col: Accounting.cash_disbursements.selectOptionColumns.total_amount_due, as: 'amount_due' },
      { col: Accounting.cash_disbursements.selectOptionColumns.state, as: 'state' }
    ])
      .from(Accounting.cash_disbursements.tablename)
      .innerJoin(Master.vendors.tablename, Accounting.cash_disbursements.selectOptionColumns.vendor_id, Master.vendors.selectOptionColumns.id)
      .where(Accounting.cash_disbursements.selectOptionColumns.id)
      .build();

    let cash_disbursement = await Query(cash_disbursements_query, [cashDisbursementId], [Accounting.cash_disbursements.prefix_, Master.vendors.prefix_]);

    const cash_disbursement_items_query = sql.select([
      { col: Accounting.cash_disbursement_items.selectOptionColumns.id, as: 'id' },
      { col: Accounting.cash_disbursement_items.selectOptionColumns.product_service, as: 'product_service_id' },
      { col: Master.products_service.selectOptionColumns.name, as: 'product_service_name' },
      { col: Accounting.cash_disbursement_items.selectOptionColumns.charts_of_accounts, as: 'charts_of_accounts_id' },
      { col: Master.charts_of_accounts.selectOptionColumns.name, as: 'charts_of_accounts_name' },
      { col: Accounting.cash_disbursement_items.selectOptionColumns.description, as: 'description' },
      { col: Accounting.cash_disbursement_items.selectOptionColumns.quantity, as: 'quantity' },
      { col: Accounting.cash_disbursement_items.selectOptionColumns.purchase_price, as: 'purchase_price' },
      { col: Accounting.cash_disbursement_items.selectOptionColumns.discount, as: 'discount' },
      { col: Accounting.cash_disbursement_items.selectOptionColumns.discount_type, as: 'discount_type' },
      { col: Master.vat.selectOptionColumns.id, as: 'vat_id' },
      { col: Master.vat.selectOptionColumns.code, as: 'vat_code' },
      { col: Master.vat.selectOptionColumns.name, as: 'vat_name' },
      { col: Master.vat.selectOptionColumns.rate, as: 'vat_rate' },
      { col: Master.withholding_tax.selectOptionColumns.id, as: 'withholding_tax_id' },
      { col: Master.withholding_tax.selectOptionColumns.code, as: 'withholding_tax_code' },
      { col: Master.withholding_tax.selectOptionColumns.rate, as: 'withholding_tax_rate' },
      { col: Accounting.cash_disbursement_items.selectOptionColumns.responsibility_center, as: 'responsibility_center' }
    ])
      .from(Accounting.cash_disbursement_items.tablename)
      .innerJoin(Master.withholding_tax.tablename, Accounting.cash_disbursement_items.selectOptionColumns.witholding_tax, Master.withholding_tax.selectOptionColumns.id)
      .innerJoin(Master.vat.tablename, Accounting.cash_disbursement_items.selectOptionColumns.vat, Master.vat.selectOptionColumns.id)
      .leftJoin(Master.products_service.tablename, Accounting.cash_disbursement_items.selectOptionColumns.product_service, Master.products_service.selectOptionColumns.id)
      .innerJoin(Master.charts_of_accounts.tablename, Accounting.cash_disbursement_items.selectOptionColumns.charts_of_accounts, Master.charts_of_accounts.selectOptionColumns.id)
      .where(Accounting.cash_disbursement_items.selectOptionColumns.cash_disbursement_id)
      .build();

    let cash_disbursement_items = await Query(cash_disbursement_items_query, [cashDisbursementId], [Accounting.cash_disbursement_items.prefix_]);
    const cash_disbursement_journal_query = sql.select([
      { col: Accounting.journal_entries.selectOptionColumns.id, as: 'id' },
      { col: Accounting.journal_entries.selectOptionColumns.coa_id, as: 'coa_id' },
      { col: Master.charts_of_accounts.selectOptionColumns.name, as: 'charts_of_accounts_name' },
      { col: Accounting.journal_entries.selectOptionColumns.type, as: 'type' },
      { col: Accounting.journal_entries.selectOptionColumns.amount, as: 'amount' },
      { col: Accounting.journal_entries.selectOptionColumns.responsibility_center, as: 'responsibility_center' }
    ])
      .from(Accounting.journal_entries.tablename)
      .innerJoin(Master.charts_of_accounts.tablename, Accounting.journal_entries.selectOptionColumns.coa_id, Master.charts_of_accounts.selectOptionColumns.id)
      .where(Accounting.journal_entries.selectOptionColumns.db_name)
      .andWhere(Accounting.journal_entries.selectOptionColumns.db_id)
      .build();

    let cash_disbursement_journal = await Query(cash_disbursement_journal_query, ['cash_disbursements', cashDisbursementId], [Accounting.journal_entries.prefix_]);

    const cash_disbursement_attachments_query = sql.select([
      { col: Accounting.cash_disbursement_attachments.selectOptionColumns.id, as: 'id' },
      { col: Accounting.cash_disbursement_attachments.selectOptionColumns.file, as: 'file' },
      { col: Accounting.cash_disbursement_attachments.selectOptionColumns.name, as: 'name' },
      { col: Accounting.cash_disbursement_attachments.selectOptionColumns.remarks, as: 'remarks' },
      { col: Accounting.cash_disbursement_attachments.selectOptionColumns.uploaded_by, as: 'uploaded_by' },
      { col: Accounting.cash_disbursement_attachments.selectOptionColumns.uploaded_date, as: 'uploaded_date' }
    ])
      .from(Accounting.cash_disbursement_attachments.tablename)
      .where(Accounting.cash_disbursement_attachments.selectOptionColumns.cash_disburssement_id)
      .build();

    let cash_disbursement_attachments = await Query(cash_disbursement_attachments_query, [cashDisbursementId], [Accounting.cash_disbursement_attachments.prefix_]);

    console.log(cash_disbursement, cash_disbursement_items, cash_disbursement_journal, cash_disbursement_attachments)
    res.status(200).json({
      success: true,
      message: 'Cash disbursements retrieved successfully',
      data: cash_disbursement,
      items: cash_disbursement_items,
      journal: cash_disbursement_journal,
      attachments: cash_disbursement_attachments,
      count: cash_disbursement.length,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error fetching cash disbursements:', error)
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching receipts',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    })
  }
}

const createCashDisbursement = async (req, res, next) => {
  try {
    const {
      vendor_id,
      document_reference,
      payment_date,
      mode_of_payment,
      bank_name,
      check_number,
      remarks,
      total_amount_due,
      created_by,
      disbursement_items,
      journal_entries,
      attachments
    } = req.body;
    console.log(req.body)

    if (!vendor_id || !payment_date || !mode_of_payment || !total_amount_due || !created_by) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }

    let connection;
    try {
      connection = await pool.getConnection();
      await connection.beginTransaction();

      const mainQuery = sql.insert(Accounting.cash_disbursements.tablename, {
        columns: Accounting.cash_disbursements.insertColumns,
        prefix: Accounting.cash_disbursements.prefix,
        isTransaction: true
      }).build();

      const mainValues = [
        vendor_id || null,
        document_reference || "0",
        payment_date || null,
        mode_of_payment || null,
        bank_name || null,
        check_number || null,
        remarks || null,
        total_amount_due || null,
        'PREPARED',
        new Date().toISOString().split('T')[0],
        created_by || null
      ];

      const [mainResult] = await connection.execute(mainQuery, mainValues);
      const cashDisbursementId = mainResult.insertId;

      if (disbursement_items && disbursement_items.length > 0) {
        for (const item of disbursement_items) {
          const itemQuery = sql.insert(Accounting.cash_disbursement_items.tablename, {
            columns: Accounting.cash_disbursement_items.insertColumns,
            prefix: Accounting.cash_disbursement_items.prefix,
            isTransaction: true
          }).build();

          const itemValues = [
            cashDisbursementId,
            item.product_id || null,
            item.account_id || null,
            item.description || null,
            item.qty || 0,
            item.price || 0,
            item.discount || 0,
            item.discount_type || null,
            item.vat || 0,
            item.wtax || 0,
            item.responsibility_center || ''
          ];

          await connection.execute(itemQuery, itemValues);
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
            "cash_disbursements",
            cashDisbursementId,
            entry.account_id || null,
            entry.responsibility_center || '',
            type,
            amount,
            new Date().toISOString().split('T')[0]
          ];

          await connection.execute(entryQuery, entryValues);
        }
      }

      if (attachments && attachments.length > 0) {
        for (const attachment of attachments) {
          const attachmentQuery = sql.insert(Accounting.cash_disbursement_attachments.tablename, {
            columns: Accounting.cash_disbursement_attachments.insertColumns,
            prefix: Accounting.cash_disbursement_attachments.prefix,
            isTransaction: true
          }).build();

          const attachmentValues = [
            cashDisbursementId,
            attachment.file || null,
            attachment.fileName || null,
            attachment.remarks || null,
            attachment.uploadedBy || null,
            attachment.date || new Date().toLocaleDateString()
          ];

          await connection.execute(attachmentQuery, attachmentValues);
        }
      }

      // Commit transaction
      await connection.commit();

      res.status(201).json({
        success: true,
        message: 'Cash disbursement created successfully',
        data: { id: cashDisbursementId },
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
    console.error('Error creating cash disbursement:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while creating cash disbursement',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
}

const updateCashDisbursement = async (req, res, next) => {
  const { cash_disbursement_id } = req.params;
  const disbursementId = Number(cash_disbursement_id);
  console.log('Updating cash_disbursement_id:', disbursementId, 'type:', typeof disbursementId);
  
  try {
    const {
      vendor_id,
      document_reference,
      payment_date,
      mode_of_payment,
      bank_name,
      check_number,
      remarks,
      total_amount_due,
      created_by,
      disbursement_items,
      journal_entries,
      attachments
    } = req.body;
    
    console.log('Update data:', req.body);

    if (!vendor_id || !document_reference || !payment_date || !mode_of_payment || !total_amount_due) {
      return res.status(400).json({
        success: false,
        message: 'All required fields must be provided'
      });
    }

    let connection;
    try {
      connection = await pool.getConnection();
      await connection.beginTransaction();

      const updateMainQuery = sql.update(Accounting.cash_disbursements.tablename)
        .set([
          Accounting.cash_disbursements.selectOptionColumns.vendor_id,
          Accounting.cash_disbursements.selectOptionColumns.document_reference,
          Accounting.cash_disbursements.selectOptionColumns.payment_date,
          Accounting.cash_disbursements.selectOptionColumns.mode_of_payment,
          Accounting.cash_disbursements.selectOptionColumns.bank_name,
          Accounting.cash_disbursements.selectOptionColumns.check_number,
          Accounting.cash_disbursements.selectOptionColumns.remarks,
          Accounting.cash_disbursements.selectOptionColumns.total_amount_due
        ])
        .where(Accounting.cash_disbursements.selectOptionColumns.id)
        .build();

      const updateMainValues = [
        vendor_id || null,
        document_reference || null,
        payment_date || null,
        mode_of_payment || null,
        bank_name || null,
        check_number || null,
        remarks || null,
        total_amount_due || null,
        disbursementId
      ];

      await connection.execute(updateMainQuery, updateMainValues);

      if (disbursement_items && disbursement_items.length > 0) {
        const existingItemsQuery = sql.select([
          Accounting.cash_disbursement_items.selectOptionColumns.id
        ])
          .from(Accounting.cash_disbursement_items.tablename)
          .where(Accounting.cash_disbursement_items.selectOptionColumns.cash_disbursement_id)
          .build();
        
        const existingItems = await Query(existingItemsQuery, [disbursementId], [Accounting.cash_disbursement_items.prefix_]);
        const existingItemIds = existingItems.map(item => item.id);
        const payloadItemIds = disbursement_items.filter(item => item.id).map(item => item.id);
        
        const itemsToDelete = existingItemIds.filter(id => !payloadItemIds.includes(id));
        if (itemsToDelete.length > 0) {
          const deleteItemsQuery = sql.delete()
            .from(Accounting.cash_disbursement_items.tablename)
            .where(Accounting.cash_disbursement_items.selectOptionColumns.id)
            .andWhere(Accounting.cash_disbursement_items.selectOptionColumns.cash_disbursement_id)
            .build();
          
          for (const itemId of itemsToDelete) {
            await connection.execute(deleteItemsQuery, [itemId, disbursementId]);
          }
        }

        for (const item of disbursement_items) {
          if (item.id) {
            const updateItemQuery = sql.update(Accounting.cash_disbursement_items.tablename)
              .set([
                Accounting.cash_disbursement_items.selectOptionColumns.product_service,
                Accounting.cash_disbursement_items.selectOptionColumns.charts_of_accounts,
                Accounting.cash_disbursement_items.selectOptionColumns.description,
                Accounting.cash_disbursement_items.selectOptionColumns.quantity,
                Accounting.cash_disbursement_items.selectOptionColumns.purchase_price,
                Accounting.cash_disbursement_items.selectOptionColumns.discount,
                Accounting.cash_disbursement_items.selectOptionColumns.discount_type,
                Accounting.cash_disbursement_items.selectOptionColumns.vat,
                Accounting.cash_disbursement_items.selectOptionColumns.withholding_tax,
                Accounting.cash_disbursement_items.selectOptionColumns.responsibility_center
              ])
              .where(Accounting.cash_disbursement_items.selectOptionColumns.id)
              .build();

            const updateItemValues = [
              item.product_id || null,
              item.account_id || null,
              item.description,
              item.qty || null,
              item.price || 0,
              item.discount || 0,
              item.discount_type || null,
              item.vat || 0,
              item.wtax || 0,
              item.responsibility_center || '',
              item.id
            ];

            await connection.execute(updateItemQuery, updateItemValues);
          } else {
            const itemQuery = sql.insert(Accounting.cash_disbursement_items.tablename, {
              columns: Accounting.cash_disbursement_items.insertColumns,
              prefix: Accounting.cash_disbursement_items.prefix,
              isTransaction: true
            }).build();

            const itemValues = [
              disbursementId,
              item.product_id || null,
              item.account_id || null,
              item.description,
              item.qty || null,
              item.price || 0,
              item.discount || 0,
              item.discount_type || null,
              item.vat || 0,
              item.wtax || 0,
              item.responsibility_center || ''
            ];

            await connection.execute(itemQuery, itemValues);
          }
        }
      } else {
        const deleteAllItemsQuery = sql.delete()
          .from(Accounting.cash_disbursement_items.tablename)
          .where(Accounting.cash_disbursement_items.selectOptionColumns.cash_disbursement_id)
          .build();
        
        await connection.execute(deleteAllItemsQuery, [disbursementId]);
      }

      if (journal_entries && journal_entries.length > 0) {
        const existingEntriesQuery = sql.select([
          Accounting.journal_entries.selectOptionColumns.id
        ])
          .from(Accounting.journal_entries.tablename)
          .where(Accounting.journal_entries.selectOptionColumns.db_name)
          .andWhere(Accounting.journal_entries.selectOptionColumns.db_id)
          .build();
        
        const existingEntries = await Query(existingEntriesQuery, ['cash_disbursements', disbursementId], [Accounting.journal_entries.prefix_]);
        const existingEntryIds = existingEntries.map(entry => entry.id);
        const payloadEntryIds = journal_entries.filter(entry => entry.id).map(entry => entry.id);
        
        const entriesToDelete = existingEntryIds.filter(id => !payloadEntryIds.includes(id));
        if (entriesToDelete.length > 0) {
          const deleteEntriesQuery = sql.delete()
            .from(Accounting.journal_entries.tablename)
            .where(Accounting.journal_entries.selectOptionColumns.id)
            .andWhere(Accounting.journal_entries.selectOptionColumns.db_name)
            .andWhere(Accounting.journal_entries.selectOptionColumns.db_id)
            .build();
          
          for (const entryId of entriesToDelete) {
            await connection.execute(deleteEntriesQuery, [entryId, 'cash_disbursements', disbursementId]);
          }
        }

        for (const entry of journal_entries) {
          const type = entry.debit > 0 ? 'debit' : 'credit';
          const amount = entry.debit > 0 ? entry.debit : entry.credit;

          if (entry.id) {
            const updateEntryQuery = sql.update(Accounting.journal_entries.tablename)
              .set([
                Accounting.journal_entries.selectOptionColumns.coa_id,
                Accounting.journal_entries.selectOptionColumns.responsibility_center,
                Accounting.journal_entries.selectOptionColumns.type,
                Accounting.journal_entries.selectOptionColumns.amount
              ])
              .where(Accounting.journal_entries.selectOptionColumns.id)
              .build();

            const updateEntryValues = [
              entry.account_id || null,
              entry.responsibility_center || '',
              type,
              amount,
              entry.id
            ];

            await connection.execute(updateEntryQuery, updateEntryValues);
          } else {
            const entryQuery = sql.insert(Accounting.journal_entries.tablename, {
              columns: Accounting.journal_entries.insertColumns,
              prefix: Accounting.journal_entries.prefix,
              isTransaction: true
            }).build();

            const entryValues = [
              "cash_disbursements",
              disbursementId,
              entry.account_id || null,
              entry.responsibility_center || '',
              type,
              amount,
              new Date().toISOString().split('T')[0]
            ];

            await connection.execute(entryQuery, entryValues);
          }
        }
      } else {
        const deleteAllEntriesQuery = sql.delete()
          .from(Accounting.journal_entries.tablename)
          .where(Accounting.journal_entries.selectOptionColumns.db_name)
          .andWhere(Accounting.journal_entries.selectOptionColumns.db_id)
          .build();
        
        await connection.execute(deleteAllEntriesQuery, ['cash_disbursements', disbursementId]);
      }

      if (attachments && attachments.length > 0) {
        const existingAttachmentsQuery = sql.select([
          Accounting.cash_disbursement_attachments.selectOptionColumns.id
        ])
          .from(Accounting.cash_disbursement_attachments.tablename)
          .where(Accounting.cash_disbursement_attachments.selectOptionColumns.cash_disburssement_id)
          .build();
        
        const existingAttachments = await Query(existingAttachmentsQuery, [disbursementId], [Accounting.cash_disbursement_attachments.prefix_]);
        const existingAttachmentIds = existingAttachments.map(att => att.id);
        const payloadAttachmentIds = attachments.filter(att => att.id).map(att => att.id);
        
        const attachmentsToDelete = existingAttachmentIds.filter(id => !payloadAttachmentIds.includes(id));
        if (attachmentsToDelete.length > 0) {
          const deleteAttachmentsQuery = sql.delete()
            .from(Accounting.cash_disbursement_attachments.tablename)
            .where(Accounting.cash_disbursement_attachments.selectOptionColumns.id)
            .andWhere(Accounting.cash_disbursement_attachments.selectOptionColumns.cash_disbursement_id)
            .build();
          
          for (const attachmentId of attachmentsToDelete) {
            await connection.execute(deleteAttachmentsQuery, [attachmentId, disbursementId]);
          }
        }

        for (const attachment of attachments) {
          const isExistingAttachment = existingAttachmentIds.includes(attachment.id);
          
          if (attachment.id && isExistingAttachment) {
            const updateAttachmentQuery = sql.update(Accounting.cash_disbursement_attachments.tablename)
              .set([
                Accounting.cash_disbursement_attachments.selectOptionColumns.file,
                Accounting.cash_disbursement_attachments.selectOptionColumns.name,
                Accounting.cash_disbursement_attachments.selectOptionColumns.remarks,
                Accounting.cash_disbursement_attachments.selectOptionColumns.uploaded_by,
                Accounting.cash_disbursement_attachments.selectOptionColumns.uploaded_date
              ])
              .where(Accounting.cash_disbursement_attachments.selectOptionColumns.id)
              .build();

            const updateAttachmentValues = [
              attachment.file || null,
              attachment.fileName || null,
              attachment.remarks || "",
              attachment.uploadedBy || null,
              attachment.date || new Date().toLocaleDateString(),
              attachment.id
            ];

            await connection.execute(updateAttachmentQuery, updateAttachmentValues);
          } else {
            const attachmentQuery = sql.insert(Accounting.cash_disbursement_attachments.tablename, {
              columns: Accounting.cash_disbursement_attachments.insertColumns,
              prefix: Accounting.cash_disbursement_attachments.prefix,
              isTransaction: true
            }).build();

            const attachmentValues = [
              disbursementId,
              attachment.file || null,
              attachment.fileName || null,
              attachment.remarks || "",
              attachment.uploadedBy || null,
              attachment.date || new Date().toLocaleDateString()
            ];

            await connection.execute(attachmentQuery, attachmentValues);
          }
        }
      } else {
        // Delete all attachments if none are provided
        const deleteAllAttachmentsQuery = sql.delete()
          .from(Accounting.cash_disbursement_attachments.tablename)
          .where(Accounting.cash_disbursement_attachments.selectOptionColumns.cash_disburssement_id)
          .build();
        
        await connection.execute(deleteAllAttachmentsQuery, [disbursementId]);
      }

      await connection.commit();

      res.status(200).json({
        success: true,
        message: 'Cash disbursement updated successfully',
        data: { id: disbursementId },
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
    console.error('Error updating cash disbursement:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while updating cash disbursement',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
}

const updateDisbursementState = async (req, res, next) => {
  try {
    console.log("updateDisbursementState called");
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
      connection = await pool.getConnection();
      await connection.beginTransaction();

      const updatePromises = updates.map(async (update) => {
        const { id, currentState } = update;

        if (!id || !currentState) {
          throw new Error('Each update requires id and currentState');
        }

        let nextState;
        if (currentState === 'PREPARED') {
          nextState = 'CHECKED';
        } else if (currentState === 'CHECKED') {
          nextState = 'APPROVED';
        } else {
          throw new Error(`Invalid current state: ${currentState}. Only PREPARED and CHECKED can be updated.`);
        }


        const updateQuery = sql.update(Accounting.cash_disbursements.tablename)
          .set([Accounting.cash_disbursements.selectOptionColumns.state])
          .where(Accounting.cash_disbursements.selectOptionColumns.id)
          .build();
        const updateValues = [nextState, id];
        return connection.execute(updateQuery, updateValues);
      });

      const results = await Promise.all(updatePromises);

      await connection.commit();

      res.status(200).json({
        success: true,
        message: `${results.length} receipt(s) updated successfully`,
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
    console.error('Error updating receipts:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while updating receipts',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
}
module.exports = {
  getCashDisbursements,
  getAllCashDisbursements,
  createCashDisbursement,
  updateCashDisbursement,
  updateDisbursementState
}
