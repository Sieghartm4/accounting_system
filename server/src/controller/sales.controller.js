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

const getAllSales = async (req, res, next) => {
  const { id } = req.params;
  const salesId = Number(id);
  console.log('Converted sales_id:', salesId, 'type:', typeof salesId);
  try {
    const sales_query = sql.select([
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
      .where(Accounting.sales.selectOptionColumns.id)
      .build();

    let sales = await Query(sales_query, [salesId], [Accounting.sales.prefix_, Master.customers.prefix_]);

    const sales_items_query = sql.select([
      { col: Accounting.sales_items.selectOptionColumns.id, as: 'id' },
      { col: Master.products_service.selectOptionColumns.name, as: 'product_service_name' },
      { col: Master.charts_of_accounts.selectOptionColumns.name, as: 'charts_of_accounts_name' },
      { col: Accounting.sales_items.selectOptionColumns.description, as: 'description' },
      { col: Accounting.sales_items.selectOptionColumns.quantity, as: 'quantity' },
      { col: Accounting.sales_items.selectOptionColumns.sales_price, as: 'sales_price' },
      { col: Accounting.sales_items.selectOptionColumns.discount, as: 'discount' },
      { col: Accounting.sales_items.selectOptionColumns.discount_type, as: 'discount_type' },
      { col: Accounting.sales_items.selectOptionColumns.vat, as: 'vat' },
      { col: Accounting.sales_items.selectOptionColumns.witholding_tax, as: 'witholding_tax' },
      { col: Accounting.sales_items.selectOptionColumns.responsibility_center, as: 'responsibility_center' }
    ])
      .from(Accounting.sales_items.tablename)
      .leftJoin(Master.products_service.tablename, Accounting.sales_items.selectOptionColumns.product_service, Master.products_service.selectOptionColumns.id)
      .innerJoin(Master.charts_of_accounts.tablename, Accounting.sales_items.selectOptionColumns.charts_of_accounts, Master.charts_of_accounts.selectOptionColumns.id)
      .where(Accounting.sales_items.selectOptionColumns.sales_id)
      .build();

    let sales_items = await Query(sales_items_query, [salesId], [Accounting.sales_items.prefix_]);
    const sales_journal_query = sql.select([
      { col: Accounting.journal_entries.selectOptionColumns.id, as: 'id' },
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

    let sales_journal = await Query(sales_journal_query, ['sales', salesId], [Accounting.journal_entries.prefix_]);

    const sales_attachments_query = sql.select([
      { col: Accounting.sales_attachments.selectOptionColumns.id, as: 'id' },
      { col: Accounting.sales_attachments.selectOptionColumns.file, as: 'file' },
      { col: Accounting.sales_attachments.selectOptionColumns.name, as: 'name' },
      { col: Accounting.sales_attachments.selectOptionColumns.remarks, as: 'remarks' },
      { col: Accounting.sales_attachments.selectOptionColumns.uploaded_by, as: 'uploaded_by' },
      { col: Accounting.sales_attachments.selectOptionColumns.uploaded_date, as: 'uploaded_date' }
    ])
      .from(Accounting.sales_attachments.tablename)
      .where(Accounting.sales_attachments.selectOptionColumns.sales_id)
      .build();

    let sales_attachments = await Query(sales_attachments_query, [salesId], [Accounting.sales_attachments.prefix_]);

    console.log(sales, sales_items, sales_journal, sales_attachments)
    res.status(200).json({
      success: true,
      message: 'Sales retrieved successfully',
      data: sales,
      items: sales_items,
      journal: sales_journal,
      attachments: sales_attachments,
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
    if (!customer_id || !document_reference || !terms || !date_delivered || !date_due || !total_amount_due || !created_by) {
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
            attachment.file || null,
            attachment.fileName || null,
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

const updateSalesState = async (req, res, next) => {
  try {
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

          const updateQuery = sql.update(Accounting.sales.tablename)
          .set([Accounting.sales.selectOptionColumns.state])
          .where(Accounting.sales.selectOptionColumns.id)
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
    console.error('Error updating sales:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while updating sales',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
}
module.exports = {
  getSales,
  getAllSales,
  createSales,
  updateSalesState
}
