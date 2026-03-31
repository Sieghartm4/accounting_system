const os = require('os')
const { checkConnection, SelectAll, Transaction, Query, Insert } = require('../database/util/queries.util')
const { formatMemoryUsage, formatTime, DataModeling } = require('../util/helper.util')
const { Accounting } = require('../database/model/Accounting')
const { SQLQueryBuilder } = require('../util/helper.util')
const sql = new SQLQueryBuilder()
const mysql = require('mysql2/promise')
const CONFIG = require('../database/config/config')
const { Master } = require('../database/model/Master')

const pool = mysql.createPool({
  host: CONFIG[process.env.NODE_ENV].host,
  user: CONFIG[process.env.NODE_ENV].username,
  password: CONFIG[process.env.NODE_ENV].password,
  database: CONFIG[process.env.NODE_ENV].database,
  multipleStatements: CONFIG[process.env.NODE_ENV].dialectOptions.multipleStatements,
})

require('dotenv').config()

const getReceipts = async (req, res, next) => {
  try {
    const query = sql.select([
      { col: Accounting.receipts.selectOptionColumns.id, as: 'id' },
      { col: Master.customers.selectOptionColumns.name, as: 'customer' },
      { col: Accounting.receipts.selectOptionColumns.document_reference, as: 'doc_ref' },
      { col: Accounting.receipts.selectOptionColumns.collection_date, as: 'collection_date' },
      { col: Accounting.receipts.selectOptionColumns.mode_of_payment, as: 'mode' },
      { col: Accounting.receipts.selectOptionColumns.bank_name, as: 'bank_name' },
      { col: Accounting.receipts.selectOptionColumns.check_number, as: 'check_number' },
      { col: Accounting.receipts.selectOptionColumns.remarks, as: 'remarks' },
      { col: Accounting.receipts.selectOptionColumns.total_amount_due, as: 'amount_due' },
      { col: Accounting.receipts.selectOptionColumns.status, as: 'status' },
      { col: Accounting.receipts.selectOptionColumns.state, as: 'state' }
    ])
      .from(Accounting.receipts.tablename)
      .innerJoin(Master.customers.tablename, Accounting.receipts.selectOptionColumns.customer_id, Master.customers.selectOptionColumns.id)
      .build();

    let receipts = await Query(query, [], [Accounting.receipts.prefix_, Master.customers.prefix_]);
    res.status(200).json({
      success: true,
      message: 'Receipts retrieved successfully',
      data: receipts,
      count: receipts.length,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error fetching receipts:', error)
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching receipts',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    })
  }
}

const createReceipts = async (req, res, next) => {
  try {
    const {
      customer_id,
      document_reference,
      payment_date,
      mode_of_payment,
      bank_name,
      check_number,
      remarks,
      total_amount_due,
      created_by,
      receipt_items,
      journal_entries,
      attachments
    } = req.body;
    console.log(req.body)
    if (!customer_id || !document_reference || !payment_date || !mode_of_payment || !remarks || !total_amount_due || !created_by) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }

    if ((mode_of_payment === 'CHECK' || mode_of_payment === 'BANK_TRANSFER') && (!bank_name || !check_number)) {
      return res.status(400).json({
        success: false,
        message: 'Bank name and check number are required for CHECK or BANK_TRANSFER payments'
      });
    }

    let connection;
    try {
      connection = await pool.getConnection();
      await connection.beginTransaction();

      const mainQuery = sql.insert(Accounting.receipts.tablename, {
        columns: Accounting.receipts.insertColumns,
        prefix: Accounting.receipts.prefix,
        isTransaction: true
      }).build();

      const mainValues = [
        customer_id || null,
        document_reference || null,
        payment_date || null,
        mode_of_payment || null,
        bank_name || null,
        check_number || null,
        remarks || null,
        total_amount_due || null,
        'COLLECTED',
        'PREPARED',
        new Date().toISOString().split('T')[0],
        created_by || null
      ];

      const [mainResult] = await connection.execute(mainQuery, mainValues);
      const receiptId = mainResult.insertId;

      if (receipt_items && receipt_items.length > 0) {
        for (const item of receipt_items) {
          const itemQuery = sql.insert(Accounting.receipt_items.tablename, {
            columns: Accounting.receipt_items.insertColumns,
            prefix: Accounting.receipt_items.prefix,
            isTransaction: true
          }).build();

          const itemValues = [
            receiptId,
            item.product_id || null,
            item.account_id || null,
            item.description || null,
            item.unit || '',
            item.qty || 0,
            item.price || 0,
            item.discount || 0,
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
            "receipts",
            receiptId,
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
          const attachmentQuery = sql.insert(Accounting.receipt_attachments.tablename, {
            columns: Accounting.receipt_attachments.insertColumns,
            prefix: Accounting.receipt_attachments.prefix,
            isTransaction: true
          }).build();

          const attachmentValues = [
            receiptId,
            attachment.fileName || null,
            attachment.file || null,
            attachment.remarks || null,
            attachment.uploadedBy || null,
            attachment.date || new Date().toLocaleDateString()
          ];

          await connection.execute(attachmentQuery, attachmentValues);
        }
      }

      await connection.commit();

      res.status(201).json({
        success: true,
        message: 'Receipt created successfully',
        data: { id: receiptId },
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
    console.error('Error creating receipt:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while creating receipt',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
}
module.exports = {
  getReceipts,
  createReceipts
}
