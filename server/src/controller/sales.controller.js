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

const getSales = async (req, res, next) => {
  try {
    const query = sql.select([
      { col: Accounting.sales.selectOptionColumns.id, as: 'id' },
      { col: Master.customers.selectOptionColumns.name, as: 'customer' },
      { col: Accounting.sales.selectOptionColumns.document_reference, as: 'doc_ref' },
      { col: Accounting.sales.selectOptionColumns.terms, as: 'terms' },
      { col: Accounting.sales.selectOptionColumns.date_delivered, as: 'date_delivered' },
      { col: Accounting.sales.selectOptionColumns.date_due, as: 'date_due' },
      { col: Accounting.sales.selectOptionColumns.remarks, as: 'remarks' },
      { col: Accounting.sales.selectOptionColumns.total_amount_due, as: 'amount_due' },
      { col: Accounting.sales.selectOptionColumns.status, as: 'status' },
      { col: Accounting.sales.selectOptionColumns.state, as: 'state' }
    ])
      .from(Accounting.sales.tablename)
      .innerJoin(Master.customers.tablename, Accounting.sales.selectOptionColumns.customer_id, Master.customers.selectOptionColumns.id)
      .build();

    let sales = await Query(query, [], [Accounting.sales.prefix_, Master.customers.prefix_]);
    res.status(200).json({
      success: true,
      message: 'Sales retrieved successfully',
      data: sales,
      count: sales.length,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error fetching sales:', error)
    return res.status(500).json({ 
      success: false,
      message: 'Server error while fetching sales',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    })
  }
}

const createSales = async (req, res, next) => {
  try {
    const {
      customer_id,
      document_reference,
      terms,
      date_delivered,
      date_due,
      remarks,
      total_amount_due,
      created_by,
      sales_items,
      journal_entries,
      attachments
    } = req.body;
    console.log(req.body)
    if (!customer_id || !document_reference || !terms || !date_delivered || !date_due || !remarks || !total_amount_due || !created_by) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }



    let connection;
    try {
      connection = await pool.getConnection();
      await connection.beginTransaction();

      const mainQuery = sql.insert(Accounting.sales.tablename, {
        columns: Accounting.sales.insertColumns,
        prefix: Accounting.sales.prefix,
        isTransaction: true
      }).build();

      const mainValues = [
        customer_id || null,
        document_reference || null,
        terms || null,
        date_delivered || null,
        date_due || null,
        'SALES',
        remarks || null,
        total_amount_due || null,
        'UNPAID',
        'PREPARED',
        new Date().toISOString().split('T')[0],
        created_by || null
      ];

      const [mainResult] = await connection.execute(mainQuery, mainValues);
      const salesId = mainResult.insertId;

      if (sales_items && sales_items.length > 0) {
        for (const item of sales_items) {
          const itemQuery = sql.insert(Accounting.sales_items.tablename, {
            columns: Accounting.sales_items.insertColumns,
            prefix: Accounting.sales_items.prefix,
            isTransaction: true
          }).build();

          const itemValues = [
            salesId,
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
            "sales",
            salesId,
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
          const attachmentQuery = sql.insert(Accounting.sales_attachments.tablename, {
            columns: Accounting.sales_attachments.insertColumns,
            prefix: Accounting.sales_attachments.prefix,
            isTransaction: true
          }).build();

          const attachmentValues = [
            salesId,
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
        message: 'Sales created successfully',
        data: { id: salesId },
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
    console.error('Error creating sales:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while creating sales',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
}
module.exports = {
  getSales,
  createSales,
}
