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

const getPurchase = async (req, res, next) => {
  try {
    const query = sql.select([
      { col: Accounting.purchase.selectOptionColumns.id, as: 'id' },
      { col: Master.vendors.selectOptionColumns.name, as: 'vendor' },
      { col: Accounting.purchase.selectOptionColumns.document_reference, as: 'doc_ref' },
      { col: Accounting.purchase.selectOptionColumns.terms, as: 'terms' },
      { col: Accounting.purchase.selectOptionColumns.date_delivered, as: 'date_delivered' },
      { col: Accounting.purchase.selectOptionColumns.date_due, as: 'date_due' },
      { col: Accounting.purchase.selectOptionColumns.remarks, as: 'remarks' },
      { col: Accounting.purchase.selectOptionColumns.total_amount_due, as: 'amount_due' },
      { col: Accounting.purchase.selectOptionColumns.status, as: 'status' },
      { col: Accounting.purchase.selectOptionColumns.state, as: 'state' }
    ])
      .from(Accounting.purchase.tablename)
      .innerJoin(Master.vendors.tablename, Accounting.purchase.selectOptionColumns.vendor_id, Master.vendors.selectOptionColumns.id)
      .build();

    let purchases = await Query(query, [], [Accounting.purchase.prefix_, Master.vendors.prefix_]);
    res.status(200).json({
      success: true,
      message: 'Purchases retrieved successfully',
      data: purchases,
      count: purchases.length,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error fetching purchases:', error)
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching purchases',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    })
  }
}

const getAllPurchase = async (req, res, next) => {
  const { id } = req.params;
  const purchaseId = Number(id);
  console.log('Converted purchase_id:', purchaseId, 'type:', typeof purchaseId);
  try {
    const purchase_query = sql.select([
      { col: Accounting.purchase.selectOptionColumns.id, as: 'id' },
      { col: Master.vendors.selectOptionColumns.name, as: 'vendor' },
      { col: Accounting.purchase.selectOptionColumns.document_reference, as: 'doc_ref' },
      { col: Accounting.purchase.selectOptionColumns.terms, as: 'terms' },
      { col: Accounting.purchase.selectOptionColumns.date_delivered, as: 'date_delivered' },
      { col: Accounting.purchase.selectOptionColumns.date_due, as: 'date_due' },
      { col: Accounting.purchase.selectOptionColumns.remarks, as: 'remarks' },
      { col: Accounting.purchase.selectOptionColumns.total_amount_due, as: 'amount_due' },
      { col: Accounting.purchase.selectOptionColumns.status, as: 'status' },
      { col: Accounting.purchase.selectOptionColumns.state, as: 'state' }
    ])
      .from(Accounting.purchase.tablename)
      .innerJoin(Master.vendors.tablename, Accounting.purchase.selectOptionColumns.vendor_id, Master.vendors.selectOptionColumns.id)
      .where(Accounting.purchase.selectOptionColumns.id)
      .build();

    let purchases = await Query(purchase_query, [purchaseId], [Accounting.purchase.prefix_, Master.vendors.prefix_]);

    const purchase_items_query = sql.select([
      { col: Accounting.purchase_items.selectOptionColumns.id, as: 'id' },
      { col: Master.products_service.selectOptionColumns.name, as: 'product_service_name' },
      { col: Master.charts_of_accounts.selectOptionColumns.name, as: 'charts_of_accounts_name' },
      { col: Accounting.purchase_items.selectOptionColumns.description, as: 'description' },
      { col: Accounting.purchase_items.selectOptionColumns.quantity, as: 'quantity' },
      { col: Accounting.purchase_items.selectOptionColumns.purchase_price, as: 'purchase_price' },
      { col: Accounting.purchase_items.selectOptionColumns.discount, as: 'discount' },
      { col: Accounting.purchase_items.selectOptionColumns.discount_type, as: 'discount_type' },
      { col: Master.vat.selectOptionColumns.code, as: 'vat_code' },
      { col: Master.vat.selectOptionColumns.name, as: 'vat_name' },
      { col: Master.vat.selectOptionColumns.rate, as: 'vat_rate' },
      { col: Master.withholding_tax.selectOptionColumns.code, as: 'withholding_tax_code' },
      { col: Master.withholding_tax.selectOptionColumns.rate, as: 'withholding_tax_rate' },
      { col: Accounting.purchase_items.selectOptionColumns.responsibility_center, as: 'responsibility_center' }
    ])
      .from(Accounting.purchase_items.tablename)
      .innerJoin(Master.withholding_tax.tablename, Accounting.purchase_items.selectOptionColumns.witholding_tax, Master.withholding_tax.selectOptionColumns.id)
      .innerJoin(Master.vat.tablename, Accounting.purchase_items.selectOptionColumns.vat, Master.vat.selectOptionColumns.id)
      .leftJoin(Master.products_service.tablename, Accounting.purchase_items.selectOptionColumns.product_service, Master.products_service.selectOptionColumns.id)
      .innerJoin(Master.charts_of_accounts.tablename, Accounting.purchase_items.selectOptionColumns.charts_of_accounts, Master.charts_of_accounts.selectOptionColumns.id)
      .where(Accounting.purchase_items.selectOptionColumns.purchase_id)
      .build();

    let purchase_items = await Query(purchase_items_query, [purchaseId], [Accounting.purchase_items.prefix_]);
    const purchase_journal_query = sql.select([
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

    let purchase_journal = await Query(purchase_journal_query, ['purchase', purchaseId], [Accounting.journal_entries.prefix_]);

    const purchase_attachments_query = sql.select([
      { col: Accounting.purchase_attachments.selectOptionColumns.id, as: 'id' },
      { col: Accounting.purchase_attachments.selectOptionColumns.file, as: 'file' },
      { col: Accounting.purchase_attachments.selectOptionColumns.name, as: 'name' },
      { col: Accounting.purchase_attachments.selectOptionColumns.remarks, as: 'remarks' },
      { col: Accounting.purchase_attachments.selectOptionColumns.uploaded_by, as: 'uploaded_by' },
      { col: Accounting.purchase_attachments.selectOptionColumns.uploaded_date, as: 'uploaded_date' }
    ])
      .from(Accounting.purchase_attachments.tablename)
      .where(Accounting.purchase_attachments.selectOptionColumns.purchase_id)
      .build();

    let purchase_attachments = await Query(purchase_attachments_query, [purchaseId], [Accounting.purchase_attachments.prefix_]);

    console.log(purchases, purchase_items, purchase_journal, purchase_attachments)
    res.status(200).json({
      success: true,
      message: 'Purchase retrieved successfully',
      data: purchases,
      items: purchase_items,
      journal: purchase_journal,
      attachments: purchase_attachments,
      count: purchases.length,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error fetching purchase:', error)
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching purchase',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    })
  }
}

const createPurchase = async (req, res, next) => {
  try {
    const {
      vendor_id,
      document_reference,
      terms,
      date_delivered,
      date_due,
      remarks,
      total_amount_due,
      created_by,
      purchase_items,
      journal_entries,
      attachments
    } = req.body;
    console.log(req.body)
    if (!vendor_id || !document_reference || !terms || !date_delivered || !date_due || !total_amount_due || !created_by) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }



    let connection;
    try {
      connection = await pool.getConnection();
      await connection.beginTransaction();

      const mainQuery = sql.insert(Accounting.purchase.tablename, {
        columns: Accounting.purchase.insertColumns,
        prefix: Accounting.purchase.prefix,
        isTransaction: true
      }).build();

      const mainValues = [
        vendor_id || null,
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
      const purchaseId = mainResult.insertId;

      if (purchase_items && purchase_items.length > 0) {
        for (const item of purchase_items) {
          const itemQuery = sql.insert(Accounting.purchase_items.tablename, {
            columns: Accounting.purchase_items.insertColumns,
            prefix: Accounting.purchase_items.prefix,
            isTransaction: true
          }).build();

          const itemValues = [
            purchaseId,
            item.product_service || null,
            item.charts_of_accounts || null,
            item.description || null,
            item.quantity || 0,
            item.purchase_price || 0,
            item.discount || 0,
            item.discount_type || null,
            item.vat || 0,
            item.witholding_tax || 0,
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
            "purchase",
            purchaseId,
            entry.charts_of_accounts || null,
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
          const attachmentQuery = sql.insert(Accounting.purchase_attachments.tablename, {
            columns: Accounting.purchase_attachments.insertColumns,
            prefix: Accounting.purchase_attachments.prefix,
            isTransaction: true
          }).build();

          const attachmentValues = [
            purchaseId,
            attachment.file || null,
            attachment.name || null,
            attachment.remarks || null,
            attachment.uploaded_by || null,
            attachment.uploaded_date || new Date().toISOString().split('T')[0]
          ];

          await connection.execute(attachmentQuery, attachmentValues);
        }
      }

      await connection.commit();

      res.status(201).json({
        success: true,
        message: 'Purchase created successfully',
        data: { id: purchaseId },
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
    console.error('Error creating purchase:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while creating purchase',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
}

const updatePurchaseState = async (req, res, next) => {
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

        const updateQuery = sql.update(Accounting.purchase.tablename)
          .set([Accounting.purchase.selectOptionColumns.state])
          .where(Accounting.purchase.selectOptionColumns.id)
          .build();
        const updateValues = [nextState, id];
        return connection.execute(updateQuery, updateValues);

      });

      const results = await Promise.all(updatePromises);

      await connection.commit();

      res.status(200).json({
        success: true,
        message: `${results.length} purchase(s) updated successfully`,
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
    console.error('Error updating purchase:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while updating purchase',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
}
module.exports = {
  getPurchase,
  getAllPurchase,
  createPurchase,
  updatePurchaseState
}
