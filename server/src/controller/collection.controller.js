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

const getCollections = async (req, res, next) => {
  try {
    const query = sql.select([
      { col: `${Accounting.collections.tablename}.c_id`, as: 'id' },
      { col: `${Master.customers.tablename}.c_name`, as: 'customer' },
      { col: `${Accounting.collections.tablename}.c_document_reference`, as: 'doc_ref' },
      { col: `${Accounting.collections.tablename}.c_mode_of_payment`, as: 'mode_of_payment' },
      { col: `${Accounting.collections.tablename}.c_bank_name`, as: 'bank_name' },
      { col: `${Accounting.collections.tablename}.c_check_number`, as: 'check_number' },
      { col: `${Accounting.collections.tablename}.c_collection_date`, as: 'collection_date' },
      { col: `${Accounting.collections.tablename}.c_status`, as: 'status' },
      { col: `${Accounting.collections.tablename}.c_state`, as: 'state' }
    ])
      .from(Accounting.collections.tablename)
      .innerJoin(Master.customers.tablename, `${Accounting.collections.tablename}.c_customer_id`, `${Master.customers.tablename}.c_id`)
      .build();
    let collections = await Query(query, [], [Accounting.collections.prefix_, Master.customers.prefix_]);

    res.status(200).json({
      success: true,
      message: 'Collections retrieved successfully',
      data: collections,
      count: collections.length,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error fetching collections:', error)
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching collections',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    })
  }
}

const getSalesCollection = async (req, res, next) => {
  try {
    const query = sql.select([
      { col: Accounting.sales.selectOptionColumns.id, as: 'id' },
      { col: Master.customers.selectOptionColumns.name, as: 'customer' },
      { col: Accounting.sales.selectOptionColumns.document_reference, as: 'doc_ref' },
      { col: Accounting.sales.selectOptionColumns.terms, as: 'terms' },
      { col: Accounting.sales.selectOptionColumns.date_due, as: 'date_due' },
      { col: Accounting.sales.selectOptionColumns.total_amount_due, as: 'amount_due' },
      { col: Accounting.sales.selectOptionColumns.status, as: 'status' },
    ])
      .from(Accounting.sales.tablename)
      .innerJoin(Master.customers.tablename, Accounting.sales.selectOptionColumns.customer_id, Master.customers.selectOptionColumns.id)
      .andWhereNot(Accounting.sales.selectOptionColumns.status)
      .andWhere(Accounting.sales.selectOptionColumns.state)
      .build();
    let sales = await Query(query, ['APPROVED', 'PAID'], [Accounting.sales.prefix_, Master.customers.prefix_]);
    console.log("SALES QUERY",sales);
    res.status(200).json({
      success: true,
      message: 'Sales retrieved successfully',
      data: sales,
      count: sales.length,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Error fetching sales:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch sales data',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

const getSalesItemsCollection = async (req, res, next) => {
  try {
    const { sales_id } = req.query;
    console.log('Sales IDs received:', req.query);

    const salesIds = (Array.isArray(sales_id) ? sales_id : [sales_id])
      .filter(id => id !== undefined && id !== null && id !== '');

    if (salesIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No sales IDs provided',
        timestamp: new Date().toISOString(),
      });
    }

    const query = sql.select([
      // Sales item identity
      { col: Accounting.sales_items.selectOptionColumns.id, as: 'id' },
      { col: Accounting.sales_items.selectOptionColumns.sales_id, as: 'sales_id' },

      // Product info (display only)
      { col: Accounting.sales_items.selectOptionColumns.product_service, as: 'product_service' },
      { col: Master.products_service.selectOptionColumns.name, as: 'product_service_name' },

      // COA / AR account
      { col: Accounting.sales_items.selectOptionColumns.charts_of_accounts, as: 'charts_of_accounts' },
      { col: Master.charts_of_accounts.selectOptionColumns.name, as: 'coa_name' },

      // Invoice reference (from parent sales header)
      { col: Accounting.sales.selectOptionColumns.document_reference, as: 'document_reference' },

      // Line item detail
      { col: Accounting.sales_items.selectOptionColumns.description, as: 'description' },
      { col: Accounting.sales_items.selectOptionColumns.unit, as: 'unit' },
      { col: Accounting.sales_items.selectOptionColumns.quantity, as: 'quantity' },
      { col: Accounting.sales_items.selectOptionColumns.purchase_price, as: 'purchase_price' },

      // Rate fields — all needed to compute ci_amount correctly
      { col: Accounting.sales_items.selectOptionColumns.discount, as: 'discount' },
      { col: Accounting.sales_items.selectOptionColumns.vat, as: 'vat' },           // ← CRITICAL: must be returned
      { col: Accounting.sales_items.selectOptionColumns.witholding_tax, as: 'witholding_tax' },

      { col: Accounting.sales_items.selectOptionColumns.responsibility_center, as: 'responsibility_center' },
    ])
      .from(Accounting.sales_items.tablename)
      .innerJoin(
        Accounting.sales.tablename,
        Accounting.sales_items.selectOptionColumns.sales_id,
        Accounting.sales.selectOptionColumns.id
      )
      .innerJoin(
        Master.products_service.tablename,
        Accounting.sales_items.selectOptionColumns.product_service,
        Master.products_service.selectOptionColumns.id
      )
      .innerJoin(
        Master.charts_of_accounts.tablename,
        Accounting.sales_items.selectOptionColumns.charts_of_accounts,
        Master.charts_of_accounts.selectOptionColumns.id
      )
      .whereIn(
        Accounting.sales_items.selectOptionColumns.sales_id,
        salesIds
      )
      .build();

    const salesItems = await Query(
      query,
      salesIds,
      [
        Accounting.sales_items.prefix_,
        Accounting.sales.prefix_,
        Master.products_service.prefix_,
        Master.charts_of_accounts.prefix_,
      ]
    );

    console.log('Sales items fetched:', salesItems, 'rows');

    res.status(200).json({
      success: true,
      message: 'Sales items retrieved successfully',
      data: salesItems,
      count: salesItems.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching sales items for collection:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch sales items data',
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
};

const getAllCollections = async (req, res, next) => {
  const { collection_id } = req.params;
  const collectionId = Number(collection_id);
  console.log('Converted collection_id:', collectionId, 'type:', typeof collectionId);
  
  if (!collection_id || isNaN(collectionId)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid collection ID provided',
      timestamp: new Date().toISOString(),
    });
  }
  
  try {
    const collection_query = sql.select([
      { col: `${Accounting.collections.tablename}.${Accounting.collections.selectOptionColumns.id}`, as: 'id' },
      { col: `${Master.customers.tablename}.${Master.customers.selectOptionColumns.name}`, as: 'customer' },
      { col: `${Accounting.collections.tablename}.${Accounting.collections.selectOptionColumns.document_reference}`, as: 'doc_ref' },
      { col: `${Accounting.collections.tablename}.${Accounting.collections.selectOptionColumns.mode_of_payment}`, as: 'mode_of_payment' },
      { col: `${Accounting.collections.tablename}.${Accounting.collections.selectOptionColumns.bank_name}`, as: 'bank_name' },
      { col: `${Accounting.collections.tablename}.${Accounting.collections.selectOptionColumns.check_number}`, as: 'check_number' },
      { col: `${Accounting.collections.tablename}.${Accounting.collections.selectOptionColumns.collection_date}`, as: 'collection_date' },
      { col: `${Accounting.collections.tablename}.${Accounting.collections.selectOptionColumns.remarks}`, as: 'remarks' },
      { col: `${Accounting.collections.tablename}.${Accounting.collections.selectOptionColumns.status}`, as: 'status' },
      { col: `${Accounting.collections.tablename}.${Accounting.collections.selectOptionColumns.state}`, as: 'state' }
    ])
      .from(Accounting.collections.tablename)
      .innerJoin(Master.customers.tablename, `${Accounting.collections.tablename}.${Accounting.collections.selectOptionColumns.customer_id}`, `${Master.customers.tablename}.${Master.customers.selectOptionColumns.id}`)
      .where(`${Accounting.collections.tablename}.${Accounting.collections.selectOptionColumns.id}`)
      .build();

    let collection = await Query(collection_query, [collectionId], [Accounting.collections.prefix_, Master.customers.prefix_]);

    const collection_items_query = sql.select([
      { col: Accounting.collection_items.selectOptionColumns.id, as: 'id' },
      { col: Accounting.sales.selectOptionColumns.document_reference, as: 'invoice_ref' },
      { col: Master.products_service.selectOptionColumns.name, as: 'product_service_name' },
      { col: Accounting.sales_items.selectOptionColumns.discount, as: 'discount' },
      { col: Accounting.sales_items.selectOptionColumns.vat, as: 'vat' },
      { col: Accounting.collection_items.selectOptionColumns.amount, as: 'amount' },
      { col: Accounting.collection_items.selectOptionColumns.witholding_tax, as: 'witholding_tax' },
      { col: Accounting.sales_items.selectOptionColumns.responsibility_center, as: 'responsibility_center' },
    ])
      .from(Accounting.collection_items.tablename)
      .innerJoin(Accounting.sales.tablename, Accounting.sales.selectOptionColumns.id, Accounting.collection_items.selectOptionColumns.sales_id)
      .innerJoin(Accounting.sales_items.tablename, Accounting.sales_items.selectOptionColumns.sales_id, Accounting.collection_items.selectOptionColumns.sales_id)
      .innerJoin(Master.products_service.tablename, Master.products_service.selectOptionColumns.id, Accounting.sales_items.selectOptionColumns.product_service)
      .where(Accounting.collection_items.selectOptionColumns.collection_id)
      .build();

    let collection_items = await Query(collection_items_query, [collectionId], [Accounting.collection_items.prefix_]);
    const collection_journal_query = sql.select([
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

    let collection_journal = await Query(collection_journal_query, ['collections', collectionId], [Accounting.journal_entries.prefix_]);

    const collection_attachments_query = sql.select([
      { col: Accounting.collection_attachments.selectOptionColumns.id, as: 'id' },
      { col: Accounting.collection_attachments.selectOptionColumns.file, as: 'name' },
      { col: Accounting.collection_attachments.selectOptionColumns.name, as: 'file' },
      { col: Accounting.collection_attachments.selectOptionColumns.remarks, as: 'remarks' },
      { col: Accounting.collection_attachments.selectOptionColumns.uploaded_by, as: 'uploaded_by' },
      { col: Accounting.collection_attachments.selectOptionColumns.uploaded_date, as: 'uploaded_date' }
    ])
      .from(Accounting.collection_attachments.tablename)
      .where(Accounting.collection_attachments.selectOptionColumns.collection_id)
      .build();

    let collection_attachments = await Query(collection_attachments_query, [collectionId], [Accounting.collection_attachments.prefix_]);

    console.log(collection, collection_items, collection_journal, collection_attachments)
    res.status(200).json({
      success: true,
      message: 'Collection retrieved successfully',
      data: collection,
      items: collection_items,
      journal: collection_journal,
      attachments: collection_attachments,
      count: collection.length,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error fetching collection:', error)
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching collection',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    })
  }
}

const createCollection = async (req, res, next) => {
  try {
    const {
      customer_id,
      document_reference,
      mode_of_payment,
      bank_name,
      check_number,
      collection_date,
      remarks,
      total_amount_due,
      created_by,
      collection_items,
      journal_entries,
      attachments
    } = req.body;
    console.log(req.body)
    if (!customer_id || !document_reference || !mode_of_payment || !collection_date || !created_by) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: customer_id, document_reference, mode_of_payment, collection_date, created_by'
      });
    }

    if ((mode_of_payment === 'CHECK' || mode_of_payment === 'BANK_TRANSFER') && !bank_name) {
      return res.status(400).json({
        success: false,
        message: 'Bank name is required for CHECK and BANK_TRANSFER payments'
      });
    }

    if (mode_of_payment === 'CHECK' && !check_number) {
      return res.status(400).json({
        success: false,
        message: 'Check number is required for CHECK payments'
      });
    }



    let connection;
    try {
      connection = await pool.getConnection();
      await connection.beginTransaction();

      const mainQuery = sql.insert(Accounting.collections.tablename, {
        columns: Accounting.collections.insertColumns,
        prefix: Accounting.collections.prefix,
        isTransaction: true
      }).build();

      const mainValues = [
        customer_id || null,
        document_reference || null,
        mode_of_payment || null,
        bank_name || null,
        check_number || null,
        collection_date || null,
        remarks || null,
        'NOT COLLECTED',
        'PREPARED',
        new Date().toISOString().split('T')[0],
        created_by || null
      ];

      const [mainResult] = await connection.execute(mainQuery, mainValues);
      const collectionId = mainResult.insertId;

      if (collection_items && collection_items.length > 0) {
        for (const item of collection_items) {
          const itemQuery = sql.insert(Accounting.collection_items.tablename, {
            columns: Accounting.collection_items.insertColumns,
            prefix: Accounting.collection_items.prefix,
            isTransaction: true
          }).build();

          const itemValues = [
            collectionId,
            item.sales_id || null,
            item.amount || 0,
            item.witholding_tax || 0
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
            "collections",
            collectionId,
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
          const attachmentQuery = sql.insert(Accounting.collection_attachments.tablename, {
            columns: Accounting.collection_attachments.insertColumns,
            prefix: Accounting.collection_attachments.prefix,
            isTransaction: true
          }).build();

          const attachmentValues = [
            collectionId,
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
        message: 'Collection created successfully',
        data: { id: collectionId },
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

const updateCollectionState = async (req, res, next) => {
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

        if (nextState === 'APPROVED') {
          const updateQuery = sql.update(Accounting.collections.tablename)
            .set([Accounting.collections.selectOptionColumns.state, Accounting.collections.selectOptionColumns.status])
            .where(Accounting.collections.selectOptionColumns.id)
            .build();
          const updateValues = [nextState, 'COLLECTED', id];

          const query = sql.select([
            { col: Accounting.collection_items.selectOptionColumns.sales_id, as: 'sales_id' },
          ])
            .from(Accounting.collection_items.tablename)
            .where(Accounting.collection_items.selectOptionColumns.collection_id)
            .build();
          let collection_items = await Query(query, [id], [Accounting.collection_items.prefix_]);
          console.log("collection_items", collection_items);

          const uniqueSalesIds = [...new Set(collection_items.map(item => item.sales_id))];
          console.log("uniqueSalesIds", uniqueSalesIds);

          for (const salesId of uniqueSalesIds) {
            if (salesId) {
              const updateSalesQuery = sql.update(Accounting.sales.tablename)
                .set([Accounting.sales.selectOptionColumns.status])
                .where(Accounting.sales.selectOptionColumns.id)
                .build();
              const updateSalesValues = ['PAID', salesId];
              await connection.execute(updateSalesQuery, updateSalesValues);
              console.log(`Updated sales ID ${salesId} status to PAID`);
            }
          }

          return connection.execute(updateQuery, updateValues);
        } else {
          const updateQuery = sql.update(Accounting.collections.tablename)
            .set([Accounting.collections.selectOptionColumns.state])
            .where(Accounting.collections.selectOptionColumns.id)
            .build();
          const updateValues = [nextState, id];
          return connection.execute(updateQuery, updateValues);
        }

      });

      const results = await Promise.all(updatePromises);

      await connection.commit();

      res.status(200).json({
        success: true,
        message: `${results.length} collection(s) updated successfully`,
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
    console.error('Error updating collections:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while updating collections',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
}

module.exports = {
  getCollections,
  getAllCollections,
  getSalesCollection,
  getSalesItemsCollection,
  createCollection,
  updateCollectionState
}
