const os = require('os')
const { checkConnection, SelectAll, Query, Transaction } = require('../database/util/queries.util')
const { formatMemoryUsage, formatTime, DataModeling } = require('../util/helper.util')
const { Master } = require('../database/model/Master')
const { Accounting } = require('../database/model/Accounting')
const { SQLQueryBuilder } = require('../util/helper.util')
const { getTenantPool } = require('../database/util/tenantConnection.util')
const sql = new SQLQueryBuilder()

require('dotenv').config()

const getPayments = async (req, res, next) => {
  try {
    const query = sql.select([
      { col: Accounting.payments.selectOptionColumns.id, as: 'id' },
      { col: Master.vendors.selectOptionColumns.name, as: 'vendor' },
      { col: Accounting.payments.selectOptionColumns.document_reference, as: 'doc_ref' },
      { col: Accounting.payments.selectOptionColumns.mode_of_payment, as: 'mode_of_payment' },
      { col: Accounting.payments.selectOptionColumns.bank_name, as: 'bank_name' },
      { col: Accounting.payments.selectOptionColumns.check_number, as: 'check_number' },
      { col: Accounting.payments.selectOptionColumns.payment_date, as: 'payment_date' },
      { col: Accounting.payments.selectOptionColumns.state, as: 'state' }
    ])
      .from(Accounting.payments.tablename)
      .innerJoin(Master.vendors.tablename, Accounting.payments.selectOptionColumns.vendor_id, Master.vendors.selectOptionColumns.id)
      .build();
    let payments = await Query(query, [], [Accounting.payments.prefix_, Master.vendors.prefix_]);

    res.status(200).json({
      success: true,
      message: 'Payments retrieved successfully',
      data: payments,
      count: payments.length,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error fetching payments:', error)
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching payments',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    })
  }
}

const getPurchasePayment = async (req, res, next) => {
  try {

    const query = sql.select([
      { col: Accounting.purchase.selectOptionColumns.id, as: 'id' },
      { col: Master.vendors.selectOptionColumns.name, as: 'vendor' },
      { col: Accounting.purchase.selectOptionColumns.document_reference, as: 'doc_ref' },
      { col: Accounting.purchase.selectOptionColumns.terms, as: 'terms' },
      { col: Accounting.purchase.selectOptionColumns.date_due, as: 'date_due' },
      { col: Accounting.purchase.selectOptionColumns.total_amount_due, as: 'amount_due' },
      { col: Accounting.purchase.selectOptionColumns.status, as: 'status' },
    ])
      .from(Accounting.purchase.tablename)
      .innerJoin(Master.vendors.tablename, Accounting.purchase.selectOptionColumns.vendor_id, Master.vendors.selectOptionColumns.id)
      .where(Accounting.purchase.selectOptionColumns.state)
      .andWhereNotExists(
        `SELECT 1 FROM ${Accounting.payment_items.tablename} pi_pay ` +
        `INNER JOIN ${Accounting.purchase_items.tablename} pi_inv ON pi_inv.${Accounting.purchase_items.selectOptionColumns.id} = pi_pay.${Accounting.payment_items.selectOptionColumns.purchase_id} ` +
        `WHERE pi_inv.${Accounting.purchase_items.selectOptionColumns.purchase_id} = ${Accounting.purchase.selectOptionColumns.id}`
      )
      .andWhereNot(Accounting.purchase.selectOptionColumns.status)
      .build();
    let purchases = await Query(query, ['APPROVED', 'PAID'], [Accounting.purchase.prefix_, Master.vendors.prefix_]);
    console.log("PURCHASES QUERY 1", query);
    console.log("PURCHASES QUERY 2", purchases);

    res.status(200).json({
      success: true,
      message: 'Purchases retrieved successfully',
      data: purchases,
      count: purchases.length,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Error fetching purchases:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch purchases data',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

const getPurchaseItemsPayment = async (req, res, next) => {
  try {
    const { purchase_id } = req.query;
    console.log('Purchase IDs received:', req.query);

    const purchaseIds = (Array.isArray(purchase_id) ? purchase_id : [purchase_id])
      .filter(id => id !== undefined && id !== null && id !== '');

    if (purchaseIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No purchase IDs provided',
        timestamp: new Date().toISOString(),
      });
    }

    const query = sql.select([
      { col: Accounting.purchase_items.selectOptionColumns.id, as: 'id' },
      { col: Accounting.purchase_items.selectOptionColumns.purchase_id, as: 'purchase_id' },

      { col: Accounting.purchase_items.selectOptionColumns.product_service, as: 'product_service' },
      { col: Master.products_service.selectOptionColumns.name, as: 'product_service_name' },

      { col: Accounting.purchase_items.selectOptionColumns.charts_of_accounts, as: 'charts_of_accounts' },
      { col: Master.charts_of_accounts.selectOptionColumns.name, as: 'coa_name' },

      { col: Accounting.purchase.selectOptionColumns.document_reference, as: 'document_reference' },

      { col: Accounting.purchase_items.selectOptionColumns.description, as: 'description' },
      { col: Accounting.purchase_items.selectOptionColumns.quantity, as: 'quantity' },
      { col: Accounting.purchase_items.selectOptionColumns.purchase_price, as: 'purchase_price' },

      { col: Accounting.purchase_items.selectOptionColumns.discount, as: 'discount' },
      { col: Accounting.purchase_items.selectOptionColumns.discount_type, as: 'discount_type' },
      { col: Master.vat.selectOptionColumns.rate, as: 'vat' },
      { col: Master.withholding_tax.selectOptionColumns.rate, as: 'witholding_tax' },

      { col: Accounting.purchase_items.selectOptionColumns.responsibility_center, as: 'responsibility_center' },
    ])
      .from(Accounting.purchase_items.tablename)
      .leftJoin(
        Master.vat.tablename,
        Accounting.purchase_items.selectOptionColumns.vat,
        Master.vat.selectOptionColumns.id
      )
      .leftJoin(
        Master.withholding_tax.tablename,
        Accounting.purchase_items.selectOptionColumns.withholding_tax,
        Master.withholding_tax.selectOptionColumns.id
      )
      .innerJoin(
        Accounting.purchase.tablename,
        Accounting.purchase_items.selectOptionColumns.purchase_id,
        Accounting.purchase.selectOptionColumns.id
      )
      .leftJoin(
        Master.products_service.tablename,
        Accounting.purchase_items.selectOptionColumns.product_service,
        Master.products_service.selectOptionColumns.id
      )
      .innerJoin(
        Master.charts_of_accounts.tablename,
        Accounting.purchase_items.selectOptionColumns.charts_of_accounts,
        Master.charts_of_accounts.selectOptionColumns.id
      )
      .whereIn(
        Accounting.purchase_items.selectOptionColumns.purchase_id,
        purchaseIds
      )
      .build();

    const purchaseItems = await Query(
      query,
      purchaseIds,
      [
        Accounting.purchase_items.prefix_,
        Accounting.purchase.prefix_,
        Master.products_service.prefix_,
        Master.charts_of_accounts.prefix_,
      ]
    );

    console.log('Purchase items fetched:', purchaseItems, 'rows');

    res.status(200).json({
      success: true,
      message: 'Purchase items retrieved successfully',
      data: purchaseItems,
      count: purchaseItems.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching purchase items for payment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch purchase items data',
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
};

const getAllPayments = async (req, res, next) => {
  const { payment_id } = req.params;
  const paymentId = Number(payment_id);
  console.log('Converted payment_id:', paymentId, 'type:', typeof paymentId);

  if (!payment_id || isNaN(paymentId)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid payment ID provided',
      timestamp: new Date().toISOString(),
    });
  }

  try {
    const payment_query = sql.select([
      { col: Accounting.payments.selectOptionColumns.id, as: 'id' },
      { col: Master.vendors.selectOptionColumns.name, as: 'vendor' },
      { col: Accounting.payments.selectOptionColumns.document_reference, as: 'doc_ref' },
      { col: Accounting.payments.selectOptionColumns.mode_of_payment, as: 'mode_of_payment' },
      { col: Accounting.payments.selectOptionColumns.bank_name, as: 'bank_name' },
      { col: Accounting.payments.selectOptionColumns.check_number, as: 'check_number' },
      { col: Accounting.payments.selectOptionColumns.payment_date, as: 'payment_date' },
      { col: Accounting.payments.selectOptionColumns.remarks, as: 'remarks' },
      { col: Accounting.payments.selectOptionColumns.state, as: 'state' }
    ])
      .from(Accounting.payments.tablename)
      .innerJoin(Master.vendors.tablename, Accounting.payments.selectOptionColumns.vendor_id, Master.vendors.selectOptionColumns.id)
      .where(Accounting.payments.selectOptionColumns.id)
      .build();

    let payment = await Query(payment_query, [paymentId], [Accounting.payments.prefix_, Master.vendors.prefix_]);

    const payment_items_query = sql.select([
      { col: Accounting.payment_items.selectOptionColumns.id, as: 'id' },
      { col: Accounting.payment_items.selectOptionColumns.purchase_id, as: 'purchase_item_id' },
      { col: Accounting.purchase.selectOptionColumns.document_reference, as: 'invoice_ref' },
      { col: Master.products_service.selectOptionColumns.name, as: 'product_service_name' },
      { col: Accounting.purchase_items.selectOptionColumns.description, as: 'description' },
      { col: Accounting.purchase_items.selectOptionColumns.quantity, as: 'quantity' },
      { col: Accounting.purchase_items.selectOptionColumns.purchase_price, as: 'purchase_price' },
      { col: Accounting.purchase_items.selectOptionColumns.discount, as: 'discount' },
      { col: Accounting.purchase_items.selectOptionColumns.discount_type, as: 'discount_type' },
      { col: Master.vat.selectOptionColumns.rate, as: 'vat_rate' },
      { col: Accounting.payment_items.selectOptionColumns.amount, as: 'amount' },
      { col: Accounting.payment_items.selectOptionColumns.witholding_tax, as: 'witholding_tax' },
      { col: Master.withholding_tax.selectOptionColumns.rate, as: 'withholding_tax_rate' },
      { col: Accounting.purchase_items.selectOptionColumns.responsibility_center, as: 'responsibility_center' },
    ])
      .from(Accounting.payment_items.tablename)
      .innerJoin(Accounting.purchase_items.tablename, Accounting.purchase_items.selectOptionColumns.id, Accounting.payment_items.selectOptionColumns.purchase_id)
      .innerJoin(Accounting.purchase.tablename, Accounting.purchase.selectOptionColumns.id, Accounting.purchase_items.selectOptionColumns.purchase_id)
      .leftJoin(
        Master.vat.tablename,
        Accounting.purchase_items.selectOptionColumns.vat,
        Master.vat.selectOptionColumns.id
      )
      .leftJoin(
        Master.withholding_tax.tablename,
        Accounting.purchase_items.selectOptionColumns.withholding_tax,
        Master.withholding_tax.selectOptionColumns.id
      )
      .leftJoin(Master.products_service.tablename, Master.products_service.selectOptionColumns.id, Accounting.purchase_items.selectOptionColumns.product_service)
      .where(Accounting.payment_items.selectOptionColumns.payment_id)
      .build();

    let payment_items = await Query(payment_items_query, [paymentId], [Accounting.payment_items.prefix_]);
    console.log("PAYMENT ITEMS QUERY",payment_items_query)
    const payment_journal_query = sql.select([
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

    let payment_journal = await Query(payment_journal_query, ['payments', paymentId], [Accounting.journal_entries.prefix_]);

    const payment_attachments_query = sql.select([
      { col: Accounting.payment_attachments.selectOptionColumns.id, as: 'id' },
      { col: Accounting.payment_attachments.selectOptionColumns.name, as: 'name' },
      { col: Accounting.payment_attachments.selectOptionColumns.file, as: 'file' },
      { col: Accounting.payment_attachments.selectOptionColumns.remarks, as: 'remarks' },
      { col: Accounting.payment_attachments.selectOptionColumns.uploaded_by, as: 'uploaded_by' },
      { col: Accounting.payment_attachments.selectOptionColumns.uploaded_date, as: 'uploaded_date' }
    ])
      .from(Accounting.payment_attachments.tablename)
      .where(Accounting.payment_attachments.selectOptionColumns.payment_id)
      .build();

    let payment_attachments = await Query(payment_attachments_query, [paymentId], [Accounting.payment_attachments.prefix_]);

    console.log(payment, payment_items, payment_journal, payment_attachments)
    res.status(200).json({
      success: true,
      message: 'Payment retrieved successfully',
      data: payment,
      items: payment_items,
      journal: payment_journal,
      attachments: payment_attachments,
      count: payment.length,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error fetching payment:', error)
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching payment',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    })
  }
}

const createPayment = async (req, res, next) => {
  try {
    const {
      vendor_id,
      document_reference,
      mode_of_payment,
      bank_name,
      check_number,
      payment_date,
      remarks,
      total_amount_due,
      created_by,
      payment_items,
      journal_entries,
      attachments
    } = req.body;
    console.log(req.body)
    if (!vendor_id || !mode_of_payment || !payment_date || !created_by) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: vendor_id, document_reference, mode_of_payment, payment_date, created_by'
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
      connection = await getTenantPool().getConnection();
      await connection.beginTransaction();

      const mainQuery = sql.insert(Accounting.payments.tablename, {
        columns: Accounting.payments.insertColumns,
        prefix: Accounting.payments.prefix,
        isTransaction: true
      }).build();

      const mainValues = [
        vendor_id || null,
        document_reference || " ",
        mode_of_payment || null,
        bank_name || null,
        check_number || null,
        payment_date || null,
        remarks || null,
        'PREPARED',
        new Date().toISOString().split('T')[0],
        created_by || null
      ];

      const [mainResult] = await connection.execute(mainQuery, mainValues);
      const paymentId = mainResult.insertId;

      if (payment_items && payment_items.length > 0) {
        for (const item of payment_items) {
          const itemQuery = sql.insert(Accounting.payment_items.tablename, {
            columns: Accounting.payment_items.insertColumns,
            prefix: Accounting.payment_items.prefix,
            isTransaction: true
          }).build();

          const itemValues = [
            paymentId,
            item.purchase_id || null,
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
            "payments",
            paymentId,
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
          const attachmentQuery = sql.insert(Accounting.payment_attachments.tablename, {
            columns: Accounting.payment_attachments.insertColumns,
            prefix: Accounting.payment_attachments.prefix,
            isTransaction: true
          }).build();

          const attachmentValues = [
            paymentId,
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
        message: 'Payment created successfully',
        data: { id: paymentId },
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
    console.error('Error creating payment:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while creating payment',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
}

const updatePaymentState = async (req, res, next) => {
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
      connection = await getTenantPool().getConnection();
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
          const updateQuery = sql.update(Accounting.payments.tablename)
            .set([Accounting.payments.selectOptionColumns.state])
            .where(Accounting.payments.selectOptionColumns.id)
            .build();
          const updateValues = [nextState, id];

          const query = sql.select([
            { col: Accounting.payment_items.selectOptionColumns.purchase_id, as: 'purchase_id' },
          ])
            .from(Accounting.payment_items.tablename)
            .where(Accounting.payment_items.selectOptionColumns.payment_id)
            .build();
          let payment_items = await Query(query, [id], [Accounting.payment_items.prefix_]);
          console.log("payment_items", payment_items);

          const uniquePurchaseIds = [...new Set(payment_items.map(item => item.purchase_id))];
          console.log("uniquePurchaseIds", uniquePurchaseIds);

          for (const purchaseId of uniquePurchaseIds) {
            if (purchaseId) {
              const updatePurchaseQuery = sql.update(Accounting.purchase.tablename)
                .set([Accounting.purchase.selectOptionColumns.status])
                .where(Accounting.purchase.selectOptionColumns.id)
                .build();
              const updatePurchaseValues = ['PAID', purchaseId];
              await connection.execute(updatePurchaseQuery, updatePurchaseValues);
              console.log(`Updated purchase ID ${purchaseId} status to PAID`);
            }
          }

          return connection.execute(updateQuery, updateValues);
        } else {
          const updateQuery = sql.update(Accounting.payments.tablename)
            .set([Accounting.payments.selectOptionColumns.state])
            .where(Accounting.payments.selectOptionColumns.id)
            .build();
          const updateValues = [nextState, id];
          return connection.execute(updateQuery, updateValues);
        }

      });

      const results = await Promise.all(updatePromises);

      await connection.commit();

      res.status(200).json({
        success: true,
        message: `${results.length} payment(s) updated successfully`,
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
    console.error('Error updating payments:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while updating payments',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
}

const getPrintPayments = async (req, res, next) => {
  const { payment_id } = req.params;
  const { copyType } = req.query;

  const paymentIds = payment_id.split(',').map(id => Number(id.trim())).filter(id => !isNaN(id));
  console.log('Converted payment_ids:', paymentIds, 'type:', typeof paymentIds);
  console.log('Copy type:', copyType);

  if (paymentIds.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Invalid payment IDs provided',
      timestamp: new Date().toISOString()
    });
  }

  try {
    // Fetch company data once
    const company_query = sql.select([
      { col: Master.master_company.selectOptionColumns.company_id, as: 'id' },
      { col: Master.master_company.selectOptionColumns.company_name, as: 'company_name' },
      { col: Master.master_company.selectOptionColumns.logo, as: 'logo' },
      { col: Master.master_company.selectOptionColumns.address, as: 'address' },
      { col: Master.master_company.selectOptionColumns.tin, as: 'tin' },
      { col: Master.master_company.selectOptionColumns.website, as: 'website' },
      { col: Master.master_company.selectOptionColumns.email, as: 'email' },
      { col: Master.master_company.selectOptionColumns.phone, as: 'phone' },
      { col: Master.master_company.selectOptionColumns.status, as: 'status' }
    ])
      .from(Master.master_company.tablename)
      .build() + ' LIMIT 1';

    let company = await Query(company_query, [], [Master.master_company.prefix_]);
    company = company && company.length > 0 ? company[0] : null;

    // Fetch payments with vendor info
    const payments_query = sql.select([
      { col: `${Accounting.payments.tablename}.${Accounting.payments.selectOptionColumns.id}`, as: 'id' },
      { col: `${Accounting.payments.tablename}.${Accounting.payments.selectOptionColumns.vendor_id}`, as: 'vendor_id' },
      { col: `${Master.vendors.tablename}.${Master.vendors.selectOptionColumns.name}`, as: 'vendor' },
      { col: `${Accounting.payments.tablename}.${Accounting.payments.selectOptionColumns.document_reference}`, as: 'doc_ref' },
      { col: `${Accounting.payments.tablename}.${Accounting.payments.selectOptionColumns.mode_of_payment}`, as: 'mode_of_payment' },
      { col: `${Accounting.payments.tablename}.${Accounting.payments.selectOptionColumns.bank_name}`, as: 'bank_name' },
      { col: `${Accounting.payments.tablename}.${Accounting.payments.selectOptionColumns.check_number}`, as: 'check_number' },
      { col: `${Accounting.payments.tablename}.${Accounting.payments.selectOptionColumns.payment_date}`, as: 'payment_date' },
      { col: `${Accounting.payments.tablename}.${Accounting.payments.selectOptionColumns.remarks}`, as: 'remarks' },
      { col: `${Accounting.payments.tablename}.${Accounting.payments.selectOptionColumns.state}`, as: 'state' }
    ])
      .from(Accounting.payments.tablename)
      .innerJoin(Master.vendors.tablename, `${Accounting.payments.tablename}.${Accounting.payments.selectOptionColumns.vendor_id}`, `${Master.vendors.tablename}.${Master.vendors.selectOptionColumns.id}`)
      .whereIn(`${Accounting.payments.tablename}.${Accounting.payments.selectOptionColumns.id}`, paymentIds)
      .build();

    let payments = await Query(payments_query, [...paymentIds], [Accounting.payments.prefix_, Master.vendors.prefix_]);

    // Fetch payment items
    const payment_items_query = sql.select([
      { col: Accounting.payment_items.selectOptionColumns.id, as: 'id' },
      { col: Accounting.payment_items.selectOptionColumns.payment_id, as: 'payment_id' },
      { col: Accounting.payment_items.selectOptionColumns.purchase_id, as: 'purchase_id' },
      { col: Accounting.purchase.selectOptionColumns.document_reference, as: 'invoice_ref' },
      { col: Master.products_service.selectOptionColumns.name, as: 'product_service_name' },
      { col: Accounting.purchase_items.selectOptionColumns.description, as: 'description' },
      { col: Accounting.purchase_items.selectOptionColumns.quantity, as: 'quantity' },
      { col: Accounting.purchase_items.selectOptionColumns.purchase_price, as: 'purchase_price' },
      { col: Accounting.purchase_items.selectOptionColumns.discount, as: 'discount' },
      { col: Accounting.purchase_items.selectOptionColumns.discount_type, as: 'discount_type' },
      { col: Master.vat.selectOptionColumns.rate, as: 'vat_rate' },
      { col: Accounting.payment_items.selectOptionColumns.amount, as: 'amount' },
      { col: Accounting.payment_items.selectOptionColumns.witholding_tax, as: 'witholding_tax' },
      { col: Master.withholding_tax.selectOptionColumns.rate, as: 'withholding_tax_rate' },
      { col: Accounting.purchase_items.selectOptionColumns.responsibility_center, as: 'responsibility_center' }
    ])
      .from(Accounting.payment_items.tablename)
      .innerJoin(Accounting.purchase_items.tablename, Accounting.purchase_items.selectOptionColumns.id, Accounting.payment_items.selectOptionColumns.purchase_id)
      .innerJoin(Accounting.purchase.tablename, Accounting.purchase.selectOptionColumns.id, Accounting.purchase_items.selectOptionColumns.purchase_id)
      .leftJoin(Master.vat.tablename, Accounting.purchase_items.selectOptionColumns.vat, Master.vat.selectOptionColumns.id)
      .leftJoin(Master.withholding_tax.tablename, Accounting.purchase_items.selectOptionColumns.withholding_tax, Master.withholding_tax.selectOptionColumns.id)
      .leftJoin(Master.products_service.tablename, Master.products_service.selectOptionColumns.id, Accounting.purchase_items.selectOptionColumns.product_service)
      .whereIn(Accounting.payment_items.selectOptionColumns.payment_id, paymentIds)
      .build();

    let payment_items = await Query(payment_items_query, [...paymentIds], [Accounting.payment_items.prefix_]);

    // Fetch journal entries
    const payment_journal_query = sql.select([
      { col: Accounting.journal_entries.selectOptionColumns.id, as: 'id' },
      { col: Accounting.journal_entries.selectOptionColumns.db_id, as: 'db_id' },
      { col: Accounting.journal_entries.selectOptionColumns.coa_id, as: 'coa_id' },
      { col: Master.charts_of_accounts.selectOptionColumns.name, as: 'charts_of_accounts_name' },
      { col: Accounting.journal_entries.selectOptionColumns.type, as: 'type' },
      { col: Accounting.journal_entries.selectOptionColumns.amount, as: 'amount' },
      { col: Accounting.journal_entries.selectOptionColumns.responsibility_center, as: 'responsibility_center' }
    ])
      .from(Accounting.journal_entries.tablename)
      .innerJoin(Master.charts_of_accounts.tablename, Accounting.journal_entries.selectOptionColumns.coa_id, Master.charts_of_accounts.selectOptionColumns.id)
      .where(Accounting.journal_entries.selectOptionColumns.db_name)
      .whereIn(Accounting.journal_entries.selectOptionColumns.db_id, paymentIds)
      .build();

    let payment_journal = await Query(payment_journal_query, ['payments', ...paymentIds], [Accounting.journal_entries.prefix_]);
    console.log('Raw journal data:', payment_journal);

    // Fetch attachments
    const payment_attachments_query = sql.select([
      { col: Accounting.payment_attachments.selectOptionColumns.id, as: 'id' },
      { col: Accounting.payment_attachments.selectOptionColumns.payment_id, as: 'payment_id' },
      { col: Accounting.payment_attachments.selectOptionColumns.file, as: 'file' },
      { col: Accounting.payment_attachments.selectOptionColumns.name, as: 'name' },
      { col: Accounting.payment_attachments.selectOptionColumns.remarks, as: 'remarks' },
      { col: Accounting.payment_attachments.selectOptionColumns.uploaded_by, as: 'uploaded_by' },
      { col: Accounting.payment_attachments.selectOptionColumns.uploaded_date, as: 'uploaded_date' }
    ])
      .from(Accounting.payment_attachments.tablename)
      .whereIn(Accounting.payment_attachments.selectOptionColumns.payment_id, paymentIds)
      .build();

    let payment_attachments = await Query(payment_attachments_query, [...paymentIds], [Accounting.payment_attachments.prefix_]);

    // Group items, journal, and attachments by payment ID
    const groupedData = payments.map(payment => {
      const paymentItems = payment_items.filter(item => item.payment_id === payment.id);

      const paymentJournal = copyType === 'customer'
        ? []
        : payment_journal.filter(entry => entry.db_id === payment.id);

      const mappedItems = paymentItems.map(item => {
        const quantity = parseFloat(item.quantity || 1);
        const purchasePrice = parseFloat(item.purchase_price || 0);
        const discount = parseFloat(item.discount || 0);
        const vatRate = parseFloat(item.vat_rate || 0);
        const whtRate = parseFloat(item.withholding_tax_rate || 0);
        const amount = parseFloat(item.amount || 0);

        const totalPrice = purchasePrice * quantity;
        const discountAmount = totalPrice * (discount / 100);
        const discountedPrice = totalPrice - discountAmount;
        const vatAmount = discountedPrice * (vatRate / 100);
        const whtAmount = discountedPrice * (whtRate / 100);
        const amountDue = amount || (discountedPrice + vatAmount - whtAmount);

        return {
          id: item.id,
          product_name: item.product_service_name || '—',
          description: item.description || '—',
          unit: 'pcs',
          quantity: quantity,
          purchase_price: purchasePrice,
          total_price: totalPrice,
          discount_amount: discountAmount,
          vat_percentage: vatRate,
          vat_amount: vatAmount,
          wht_percentage: whtRate,
          wht_amount: whtAmount,
          amount_due: amountDue,
          vatable_sales: vatRate > 0 ? discountedPrice : 0,
          vat_exempt_sales: vatRate === 0 ? discountedPrice : 0,
          zero_rated_sales: 0
        };
      });

      const mappedJournal = paymentJournal.map(entry => {
        const isDebit = entry.type === 'DEBIT';
        console.log('Processing journal entry:', { type: entry.type, amount: entry.amount, isDebit });
        const mapped = {
          id: entry.id,
          account_name: entry.charts_of_accounts_name || '—',
          responsibility_center: entry.responsibility_center || 'Unassigned',
          debit: isDebit ? parseFloat(entry.amount || 0) : 0,
          credit: !isDebit ? parseFloat(entry.amount || 0) : 0
        };
        console.log('Mapped journal entry:', mapped);
        return mapped;
      });

      return {
        ...payment,
        items: mappedItems,
        journal: mappedJournal,
        attachments: payment_attachments.filter(att => att.payment_id === payment.id),
        company: company
      };
    });

    console.log('Grouped payments data:', groupedData);
    res.status(200).json({
      success: true,
      message: 'Payments retrieved successfully',
      company: company,
      data: groupedData,
      count: groupedData.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error fetching payments:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching payments',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

module.exports = {
  getPayments,
  getAllPayments,
  getPurchasePayment,
  getPurchaseItemsPayment,
  createPayment,
  updatePaymentState,
  getPrintPayments
}
