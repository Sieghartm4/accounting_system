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

const resolveCollectionPaymentAccountId = async (connection, modeOfPayment, bankName) => {
  const coaQuery = sql.select([
    { col: Master.charts_of_accounts.selectOptionColumns.id, as: 'id' },
    { col: Master.charts_of_accounts.selectOptionColumns.name, as: 'name' }
  ])
    .from(Master.charts_of_accounts.tablename)
    .build();

  const [coaRows] = await connection.execute(coaQuery, []);

  const norm = (s) => (s || '').toLowerCase();
  let paymentAccount = null;

  if (modeOfPayment === 'CASH') {
    paymentAccount =
      coaRows.find(a => norm(a.name).includes('cash on hand')) ??
      coaRows.find(a => norm(a.name).includes('petty cash'));
  } else if (modeOfPayment === 'CHECK' || modeOfPayment === 'BANK_TRANSFER') {
    if (bankName) {
      paymentAccount = coaRows.find(a => norm(a.name).includes(norm(bankName)));
    }
    paymentAccount ??= coaRows.find(a => norm(a.name).includes('cash in bank'));
  }

  return paymentAccount?.id || null;
};

const resolveAccountsReceivableId = async (connection) => {
  const coaQuery = sql.select([
    { col: Master.charts_of_accounts.selectOptionColumns.id, as: 'id' },
    { col: Master.charts_of_accounts.selectOptionColumns.name, as: 'name' }
  ])
    .from(Master.charts_of_accounts.tablename)
    .build();

  const [coaRows] = await connection.execute(coaQuery, []);
  const ar = coaRows.find(a => (a.name || '').toLowerCase().includes('accounts receivable'));
  return ar?.id || null;
};

const regenerateCollectionsJournalEntries = async (connection, collectionIds = []) => {
  if (!collectionIds.length) return;

  const arId = await resolveAccountsReceivableId(connection);

  for (const collectionId of collectionIds) {
    const collectionHeaderQuery = sql.select([
      { col: Accounting.collections.selectOptionColumns.id, as: 'id' },
      { col: Accounting.collections.selectOptionColumns.mode_of_payment, as: 'mode_of_payment' },
      { col: Accounting.collections.selectOptionColumns.bank_name, as: 'bank_name' }
    ])
      .from(Accounting.collections.tablename)
      .where(Accounting.collections.selectOptionColumns.id)
      .build();

    const [headerRows] = await connection.execute(collectionHeaderQuery, [collectionId]);
    const header = headerRows[0];
    if (!header) continue;

    const paymentAccountId = await resolveCollectionPaymentAccountId(connection, header.mode_of_payment, header.bank_name);

    // Pull remaining collection items with responsibility center (from sales_items)
    const itemsQuery = sql.select([
      { col: Accounting.collection_items.selectOptionColumns.amount, as: 'amount' },
      { col: Accounting.sales_items.selectOptionColumns.responsibility_center, as: 'responsibility_center' }
    ])
      .from(Accounting.collection_items.tablename)
      .innerJoin(
        Accounting.sales_items.tablename,
        Accounting.sales_items.selectOptionColumns.id,
        Accounting.collection_items.selectOptionColumns.sales_id
      )
      .where(Accounting.collection_items.selectOptionColumns.collection_id)
      .build();

    const [itemRows] = await connection.execute(itemsQuery, [collectionId]);
    const totalCash = itemRows.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);

    // Delete existing persisted collection journal entries
    const deleteJournalQuery = sql.delete()
      .from(Accounting.journal_entries.tablename)
      .where(Accounting.journal_entries.selectOptionColumns.db_name)
      .andWhere(Accounting.journal_entries.selectOptionColumns.db_id)
      .build();

    await connection.execute(deleteJournalQuery, ['collections', collectionId]);

    if (!arId || !paymentAccountId || totalCash <= 0) {
      continue;
    }

    // Insert new persisted journal entries (same structure as collection form auto-JE)
    const insertEntryQuery = sql.insert(Accounting.journal_entries.tablename, {
      columns: Accounting.journal_entries.insertColumns,
      prefix: Accounting.journal_entries.prefix,
      isTransaction: true
    }).build();

    // CR Accounts Receivable per item
    for (const r of itemRows) {
      const amount = parseFloat(r.amount) || 0;
      if (amount <= 0) continue;

      const entryValues = [
        'collections',
        collectionId,
        arId,
        r.responsibility_center || '',
        'credit',
        amount,
        new Date().toISOString().split('T')[0]
      ];
      await connection.execute(insertEntryQuery, entryValues);
    }

    // DR Cash/Bank one combined
    const debitValues = [
      'collections',
      collectionId,
      paymentAccountId,
      '',
      'debit',
      parseFloat(totalCash.toFixed(2)),
      new Date().toISOString().split('T')[0]
    ];
    await connection.execute(insertEntryQuery, debitValues);
  }
};

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
      { col: Accounting.sales.selectOptionColumns.customer_id, as: 'customer_id' },
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
      { col: Accounting.sales_items.selectOptionColumns.product_service, as: 'product_service_id' },
      { col: Master.products_service.selectOptionColumns.name, as: 'product_service_name' },
      { col: Accounting.sales_items.selectOptionColumns.charts_of_accounts, as: 'charts_of_accounts_id' },
      { col: Master.charts_of_accounts.selectOptionColumns.name, as: 'charts_of_accounts_name' },
      { col: Accounting.sales_items.selectOptionColumns.description, as: 'description' },
      { col: Accounting.sales_items.selectOptionColumns.quantity, as: 'quantity' },
      { col: Accounting.sales_items.selectOptionColumns.sales_price, as: 'sales_price' },
      { col: Accounting.sales_items.selectOptionColumns.discount, as: 'discount' },
      { col: Accounting.sales_items.selectOptionColumns.discount_type, as: 'discount_type' },
      { col: Accounting.sales_items.selectOptionColumns.vat, as: 'vat_id' },
      { col: Master.vat.selectOptionColumns.code, as: 'vat_code' },
      { col: Master.vat.selectOptionColumns.name, as: 'vat_name' },
      { col: Master.vat.selectOptionColumns.rate, as: 'vat_rate' },
      { col: Accounting.sales_items.selectOptionColumns.witholding_tax, as: 'witholding_tax_id' },
      { col: Master.withholding_tax.selectOptionColumns.code, as: 'withholding_tax_code' },
      { col: Master.withholding_tax.selectOptionColumns.rate, as: 'withholding_tax_rate' },
      { col: Accounting.sales_items.selectOptionColumns.responsibility_center, as: 'responsibility_center' }
    ])
      .from(Accounting.sales_items.tablename)
      .leftJoin(Master.withholding_tax.tablename, Accounting.sales_items.selectOptionColumns.witholding_tax, Master.withholding_tax.selectOptionColumns.id)
      .leftJoin(Master.vat.tablename, Accounting.sales_items.selectOptionColumns.vat, Master.vat.selectOptionColumns.id)
      .leftJoin(Master.products_service.tablename, Accounting.sales_items.selectOptionColumns.product_service, Master.products_service.selectOptionColumns.id)
      .innerJoin(Master.charts_of_accounts.tablename, Accounting.sales_items.selectOptionColumns.charts_of_accounts, Master.charts_of_accounts.selectOptionColumns.id)
      .where(Accounting.sales_items.selectOptionColumns.sales_id)
      .build();

    let sales_items = await Query(sales_items_query, [salesId], [Accounting.sales_items.prefix_]);
    const sales_journal_query = sql.select([
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
    if (!customer_id || !terms || !date_delivered || !date_due || !total_amount_due || !created_by) {
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
        document_reference || " ",
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

const updateSale = async (req, res, next) => {
  const { sales_id } = req.params;
  const salesId = Number(sales_id);
  console.log('Updating sales_id:', salesId, 'type:', typeof salesId);
  
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
    
    console.log('Update data:', req.body);

    if (!customer_id || !document_reference || !terms || !date_delivered || !date_due || !total_amount_due) {
      return res.status(400).json({
        success: false,
        message: 'All required fields must be provided'
      });
    }

    let connection;
    try {
      connection = await pool.getConnection();
      await connection.beginTransaction();

      const updateMainQuery = sql.update(Accounting.sales.tablename)
        .set([
          Accounting.sales.selectOptionColumns.customer_id,
          Accounting.sales.selectOptionColumns.document_reference,
          Accounting.sales.selectOptionColumns.terms,
          Accounting.sales.selectOptionColumns.date_delivered,
          Accounting.sales.selectOptionColumns.date_due,
          Accounting.sales.selectOptionColumns.remarks,
          Accounting.sales.selectOptionColumns.total_amount_due
        ])
        .where(Accounting.sales.selectOptionColumns.id)
        .build();

      const updateMainValues = [
        customer_id || null,
        document_reference || null,
        terms || null,
        date_delivered || null,
        date_due || null,
        remarks || null,
        total_amount_due || null,
        salesId
      ];

      await connection.execute(updateMainQuery, updateMainValues);

      if (sales_items && sales_items.length > 0) {
        const existingItemsQuery = sql.select([
          Accounting.sales_items.selectOptionColumns.id
        ])
          .from(Accounting.sales_items.tablename)
          .where(Accounting.sales_items.selectOptionColumns.sales_id)
          .build();
        
        const existingItems = await Query(existingItemsQuery, [salesId], [Accounting.sales_items.prefix_]);
        const existingItemIds = existingItems.map(item => item.id);
        const payloadItemIds = sales_items.filter(item => item.id).map(item => item.id);
        
        const itemsToDelete = existingItemIds.filter(id => !payloadItemIds.includes(id));
        if (itemsToDelete.length > 0) {
          // Delete collection references first (cascade) so sales items can be removed
          // Also delete any stored collection journal entries that were based on those collection items
          // then regenerate persisted collection journal entries based on remaining collection items.
          const affectedCollectionsQuery = sql.select([
            { col: Accounting.collection_items.selectOptionColumns.collection_id, as: 'collection_id' }
          ])
            .from(Accounting.collection_items.tablename)
            .whereIn(Accounting.collection_items.selectOptionColumns.sales_id, itemsToDelete)
            .build();

          const affectedCollections = await Query(
            affectedCollectionsQuery,
            itemsToDelete,
            [Accounting.collection_items.prefix_]
          );

          const affectedCollectionIds = [...new Set(affectedCollections.map(r => r.collection_id))];
          if (affectedCollectionIds.length > 0) {
            const placeholders = affectedCollectionIds.map(() => '?').join(',');
            const deleteCollectionJournalSql = `DELETE FROM ${Accounting.journal_entries.tablename} WHERE ${Accounting.journal_entries.selectOptionColumns.db_name} = ? AND ${Accounting.journal_entries.selectOptionColumns.db_id} IN (${placeholders})`;
            await connection.execute(deleteCollectionJournalSql, ['collections', ...affectedCollectionIds]);
          }

          const deleteCollectionItemsQuery = sql.delete()
            .from(Accounting.collection_items.tablename)
            .whereIn(Accounting.collection_items.selectOptionColumns.sales_id, itemsToDelete)
            .build();

          await connection.execute(deleteCollectionItemsQuery, itemsToDelete);

          // Recreate persisted collection journal entries for affected collections after collection items change
          await regenerateCollectionsJournalEntries(connection, affectedCollectionIds);
          
          const deleteItemsQuery = sql.delete()
            .from(Accounting.sales_items.tablename)
            .where(Accounting.sales_items.selectOptionColumns.id)
            .andWhere(Accounting.sales_items.selectOptionColumns.sales_id)
            .build();
          
          for (const itemId of itemsToDelete) {
            await connection.execute(deleteItemsQuery, [itemId, salesId]);
          }
        }

        for (const item of sales_items) {
          if (item.id) {
            const updateItemQuery = sql.update(Accounting.sales_items.tablename)
              .set([
                Accounting.sales_items.selectOptionColumns.product_service,
                Accounting.sales_items.selectOptionColumns.charts_of_accounts,
                Accounting.sales_items.selectOptionColumns.description,
                Accounting.sales_items.selectOptionColumns.quantity,
                Accounting.sales_items.selectOptionColumns.sales_price,
                Accounting.sales_items.selectOptionColumns.discount,
                Accounting.sales_items.selectOptionColumns.discount_type,
                Accounting.sales_items.selectOptionColumns.vat,
                Accounting.sales_items.selectOptionColumns.witholding_tax,
                Accounting.sales_items.selectOptionColumns.responsibility_center
              ])
              .where(Accounting.sales_items.selectOptionColumns.id)
              .build();

            const updateItemValues = [
              item.product_id || null,
              item.account_id,
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
            const itemQuery = sql.insert(Accounting.sales_items.tablename, {
              columns: Accounting.sales_items.insertColumns,
              prefix: Accounting.sales_items.prefix,
              isTransaction: true
            }).build();

            const itemValues = [
              salesId,
              item.product_id || null,
              item.account_id,
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
      } else if (req.body.hasOwnProperty('sales_items') && sales_items.length === 0) {
        // Delete collection references first (cascade) so sales items can be removed
        const salesItemIdsQuery = sql.select([
          Accounting.sales_items.selectOptionColumns.id
        ])
          .from(Accounting.sales_items.tablename)
          .where(Accounting.sales_items.selectOptionColumns.sales_id)
          .build();

        const salesItemIds = await Query(salesItemIdsQuery, [salesId], [Accounting.sales_items.prefix_]);
        const idsToDelete = salesItemIds.map(r => r.id);

        if (idsToDelete.length > 0) {
          // Delete any stored collection journal entries that were based on those collection items.
          const affectedCollectionsQuery = sql.select([
            { col: Accounting.collection_items.selectOptionColumns.collection_id, as: 'collection_id' }
          ])
            .from(Accounting.collection_items.tablename)
            .whereIn(Accounting.collection_items.selectOptionColumns.sales_id, idsToDelete)
            .build();

          const affectedCollections = await Query(
            affectedCollectionsQuery,
            idsToDelete,
            [Accounting.collection_items.prefix_]
          );

          const affectedCollectionIds = [...new Set(affectedCollections.map(r => r.collection_id))];
          if (affectedCollectionIds.length > 0) {
            const placeholders = affectedCollectionIds.map(() => '?').join(',');
            const deleteCollectionJournalSql = `DELETE FROM ${Accounting.journal_entries.tablename} WHERE ${Accounting.journal_entries.selectOptionColumns.db_name} = ? AND ${Accounting.journal_entries.selectOptionColumns.db_id} IN (${placeholders})`;
            await connection.execute(deleteCollectionJournalSql, ['collections', ...affectedCollectionIds]);
          }

          const deleteCollectionItemsQuery = sql.delete()
            .from(Accounting.collection_items.tablename)
            .whereIn(Accounting.collection_items.selectOptionColumns.sales_id, idsToDelete)
            .build();

          await connection.execute(deleteCollectionItemsQuery, idsToDelete);

          // Recreate persisted collection journal entries for affected collections after collection items change
          await regenerateCollectionsJournalEntries(connection, affectedCollectionIds);
        }
        
        // Only delete all items if explicitly provided as empty array and no references exist
        const deleteAllItemsQuery = sql.delete()
          .from(Accounting.sales_items.tablename)
          .where(Accounting.sales_items.selectOptionColumns.sales_id)
          .build();
        
        await connection.execute(deleteAllItemsQuery, [salesId]);
      }

      if (journal_entries && journal_entries.length > 0) {
        const existingEntriesQuery = sql.select([
          Accounting.journal_entries.selectOptionColumns.id
        ])
          .from(Accounting.journal_entries.tablename)
          .where(Accounting.journal_entries.selectOptionColumns.db_name)
          .andWhere(Accounting.journal_entries.selectOptionColumns.db_id)
          .build();
        
        const existingEntries = await Query(existingEntriesQuery, ['sales', salesId], [Accounting.journal_entries.prefix_]);
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
            await connection.execute(deleteEntriesQuery, [entryId, 'sales', salesId]);
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
      } else {
        const deleteAllEntriesQuery = sql.delete()
          .from(Accounting.journal_entries.tablename)
          .where(Accounting.journal_entries.selectOptionColumns.db_name)
          .andWhere(Accounting.journal_entries.selectOptionColumns.db_id)
          .build();
        
        await connection.execute(deleteAllEntriesQuery, ['sales', salesId]);
      }

      if (attachments && attachments.length > 0) {
        const existingAttachmentsQuery = sql.select([
          Accounting.sales_attachments.selectOptionColumns.id
        ])
          .from(Accounting.sales_attachments.tablename)
          .where(Accounting.sales_attachments.selectOptionColumns.sales_id)
          .build();
        
        const existingAttachments = await Query(existingAttachmentsQuery, [salesId], [Accounting.sales_attachments.prefix_]);
        const existingAttachmentIds = existingAttachments.map(att => att.id);
        const payloadAttachmentIds = attachments.filter(att => att.id).map(att => att.id);
        
        const attachmentsToDelete = existingAttachmentIds.filter(id => !payloadAttachmentIds.includes(id));
        if (attachmentsToDelete.length > 0) {
          const deleteAttachmentsQuery = sql.delete()
            .from(Accounting.sales_attachments.tablename)
            .where(Accounting.sales_attachments.selectOptionColumns.id)
            .andWhere(Accounting.sales_attachments.selectOptionColumns.sales_id)
            .build();
          
          for (const attachmentId of attachmentsToDelete) {
            await connection.execute(deleteAttachmentsQuery, [attachmentId, salesId]);
          }
        }

        for (const attachment of attachments) {
          // Check if this attachment ID exists in the database
          const isExistingAttachment = existingAttachmentIds.includes(attachment.id);
          
          if (attachment.id && isExistingAttachment) {
            const updateAttachmentQuery = sql.update(Accounting.sales_attachments.tablename)
              .set([
                Accounting.sales_attachments.selectOptionColumns.file,
                Accounting.sales_attachments.selectOptionColumns.name,
                Accounting.sales_attachments.selectOptionColumns.remarks,
                Accounting.sales_attachments.selectOptionColumns.uploaded_by,
                Accounting.sales_attachments.selectOptionColumns.uploaded_date
              ])
              .where(Accounting.sales_attachments.selectOptionColumns.id)
              .build();

            const updateAttachmentValues = [
              attachment.file || null,
              attachment.fileName || null,
              attachment.remarks || null,
              attachment.uploadedBy || null,
              attachment.date || new Date().toLocaleDateString(),
              attachment.id
            ];

            await connection.execute(updateAttachmentQuery, updateAttachmentValues);
          } else {
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
      } else {
        // Delete all attachments if none are provided
        const deleteAllAttachmentsQuery = sql.delete()
          .from(Accounting.sales_attachments.tablename)
          .where(Accounting.sales_attachments.selectOptionColumns.sales_id)
          .build();
        
        await connection.execute(deleteAllAttachmentsQuery, [salesId]);
      }

      await connection.commit();

      res.status(200).json({
        success: true,
        message: 'Sale updated successfully',
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
    console.error('Error updating sale:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while updating sale',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
}

module.exports = {
  getSales,
  getAllSales,
  createSales,
  updateSale,
  updateSalesState
}
