const os = require('os')

const { checkConnection, SelectAll, Query, Transaction } = require('../database/util/queries.util')

const { formatMemoryUsage, formatTime, DataModeling } = require('../util/helper.util')

const { Master } = require('../database/model/Master')

const { Accounting } = require('../database/model/Accounting')

const { SQLQueryBuilder } = require('../util/helper.util')

const { getTenantPool } = require('../database/util/tenantConnection.util')

const sql = new SQLQueryBuilder()



require('dotenv').config()



const resolvePaymentAccountId = async (connection, modeOfPayment, bankName) => {

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



const resolveAccountsPayableId = async (connection) => {

  const coaQuery = sql.select([

    { col: Master.charts_of_accounts.selectOptionColumns.id, as: 'id' },

    { col: Master.charts_of_accounts.selectOptionColumns.name, as: 'name' }

  ])

    .from(Master.charts_of_accounts.tablename)

    .build();



  const [coaRows] = await connection.execute(coaQuery, []);

  const ap = coaRows.find(a => (a.name || '').toLowerCase().includes('accounts payable'));

  return ap?.id || null;

};



const regeneratePaymentsJournalEntries = async (connection, paymentIds = []) => {

  if (!paymentIds.length) return;



  const apId = await resolveAccountsPayableId(connection);



  for (const paymentId of paymentIds) {

    const paymentHeaderQuery = sql.select([

      { col: Accounting.payments.selectOptionColumns.id, as: 'id' },

      { col: Accounting.payments.selectOptionColumns.mode_of_payment, as: 'mode_of_payment' },

      { col: Accounting.payments.selectOptionColumns.bank_name, as: 'bank_name' }

    ])

      .from(Accounting.payments.tablename)

      .where(Accounting.payments.selectOptionColumns.id)

      .build();



    const [headerRows] = await connection.execute(paymentHeaderQuery, [paymentId]);

    const header = headerRows[0];

    if (!header) continue;



    const paymentAccountId = await resolvePaymentAccountId(connection, header.mode_of_payment, header.bank_name);



    // Pull remaining payment items with responsibility center (from purchase_items)

    const itemsQuery = sql.select([

      { col: Accounting.payment_items.selectOptionColumns.amount, as: 'amount' },

      { col: Accounting.purchase_items.selectOptionColumns.responsibility_center, as: 'responsibility_center' }

    ])

      .from(Accounting.payment_items.tablename)

      .innerJoin(

        Accounting.purchase_items.tablename,

        Accounting.purchase_items.selectOptionColumns.id,

        Accounting.payment_items.selectOptionColumns.purchase_id

      )

      .where(Accounting.payment_items.selectOptionColumns.payment_id)

      .build();



    const [itemRows] = await connection.execute(itemsQuery, [paymentId]);

    const totalCash = itemRows.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);



    // Delete existing persisted payment journal entries

    const deleteJournalQuery = sql.delete()

      .from(Accounting.journal_entries.tablename)

      .where(Accounting.journal_entries.selectOptionColumns.db_name)

      .andWhere(Accounting.journal_entries.selectOptionColumns.db_id)

      .build();



    await connection.execute(deleteJournalQuery, ['payments', paymentId]);



    if (!apId || !paymentAccountId || totalCash <= 0) {

      continue;

    }



    // Insert new payment journal entries

    const insertJournalQuery = sql.insert(Accounting.journal_entries.tablename, {

      columns: Accounting.journal_entries.insertColumns,

      prefix: Accounting.journal_entries.prefix,

      isTransaction: true

    }).build();



    // Debit: Accounts Payable (reducing liability)

    await connection.execute(insertJournalQuery, [

      'payments',

      paymentId,

      apId,

      itemRows[0]?.responsibility_center || '',

      'debit',

      totalCash,

      new Date().toISOString().split('T')[0]

    ]);



    // Credit: Cash/Bank (reducing asset)

    await connection.execute(insertJournalQuery, [

      'payments',

      paymentId,

      paymentAccountId,

      itemRows[0]?.responsibility_center || '',

      'credit',

      totalCash,

      new Date().toISOString().split('T')[0]

    ]);

  }

};



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

      { col: Accounting.purchase.selectOptionColumns.vendor_id, as: 'vendor_id' },

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

      { col: Accounting.purchase_items.selectOptionColumns.product_service, as: 'product_service_id' },

      { col: Master.products_service.selectOptionColumns.name, as: 'product_service_name' },

      { col: Accounting.purchase_items.selectOptionColumns.charts_of_accounts, as: 'charts_of_accounts_id' },

      { col: Master.charts_of_accounts.selectOptionColumns.name, as: 'charts_of_accounts_name' },

      { col: Accounting.purchase_items.selectOptionColumns.description, as: 'description' },

      { col: Accounting.purchase_items.selectOptionColumns.quantity, as: 'quantity' },

      { col: Accounting.purchase_items.selectOptionColumns.purchase_price, as: 'purchase_price' },

      { col: Accounting.purchase_items.selectOptionColumns.discount, as: 'discount' },

      { col: Accounting.purchase_items.selectOptionColumns.discount_type, as: 'discount_type' },

      { col: Accounting.purchase_items.selectOptionColumns.vat, as: 'vat_id' },

      { col: Master.vat.selectOptionColumns.code, as: 'vat_code' },

      { col: Master.vat.selectOptionColumns.name, as: 'vat_name' },

      { col: Master.vat.selectOptionColumns.rate, as: 'vat_rate' },

      { col: Accounting.purchase_items.selectOptionColumns.withholding_tax, as: 'witholding_tax_id' },

      { col: Master.withholding_tax.selectOptionColumns.code, as: 'withholding_tax_code' },

      { col: Master.withholding_tax.selectOptionColumns.rate, as: 'withholding_tax_rate' },

      { col: Accounting.purchase_items.selectOptionColumns.responsibility_center, as: 'responsibility_center' }

    ])

      .from(Accounting.purchase_items.tablename)

      .leftJoin(Master.withholding_tax.tablename, Accounting.purchase_items.selectOptionColumns.withholding_tax, Master.withholding_tax.selectOptionColumns.id)

      .leftJoin(Master.vat.tablename, Accounting.purchase_items.selectOptionColumns.vat, Master.vat.selectOptionColumns.id)

      .leftJoin(Master.products_service.tablename, Accounting.purchase_items.selectOptionColumns.product_service, Master.products_service.selectOptionColumns.id)

      .innerJoin(Master.charts_of_accounts.tablename, Accounting.purchase_items.selectOptionColumns.charts_of_accounts, Master.charts_of_accounts.selectOptionColumns.id)

      .where(Accounting.purchase_items.selectOptionColumns.purchase_id)

      .build();



    let purchase_items = await Query(purchase_items_query, [purchaseId], [Accounting.purchase_items.prefix_]);

    

    // Convert decimal VAT/WHT IDs to integers for frontend compatibility

    purchase_items = purchase_items.map(item => ({

      ...item,

      vat_id: parseInt(item.vat_id) || 0,

      witholding_tax_id: parseInt(item.witholding_tax_id) || 0

    }));

    const purchase_journal_query = sql.select([

      { col: Accounting.journal_entries.selectOptionColumns.id, as: 'id' },

      { col: Accounting.journal_entries.selectOptionColumns.coa_id, as: 'charts_of_accounts_id' },

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

      checked_by,

      approved_by,

      purchase_items,

      journal_entries,

      attachments

    } = req.body;

    console.log(req.body)

    if (!vendor_id || !terms || !date_delivered || !date_due || !total_amount_due || !created_by) {

      return res.status(400).json({

        success: false,

        message: 'All fields are required'

      });

    }







    let connection;

    try {

      connection = await getTenantPool().getConnection();

      await connection.beginTransaction();



      const mainQuery = sql.insert(Accounting.purchase.tablename, {

        columns: Accounting.purchase.insertColumns,

        prefix: Accounting.purchase.prefix,

        isTransaction: true

      }).build();



      const mainValues = [

        vendor_id || null,

        document_reference || " ",

        terms || null,

        date_delivered || null,

        date_due || null,

        remarks || null,

        total_amount_due || null,

        'UNPAID',

        'PREPARED',

        new Date().toISOString().split('T')[0],

        created_by || null,

        checked_by || null,

        approved_by || null

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
          // Skip attachments with no file data (empty rows)
          if (!attachment.file && !attachment.name) {
            console.log('Skipping empty attachment row in create');
            continue;
          }

          console.log('Inserting attachment:', attachment.name);

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



      // Audit trail for create

      const now = new Date();

      const auditQueries = [];

      auditQueries.push({

        sql: sql.insert(Master.audit_trail.tablename, {

          columns: Master.audit_trail.insertColumns,

          prefix: Master.audit_trail.prefix,

          isTransaction: true

        }).build(),

        values: [

          purchaseId || null,

          'PURCHASE',

          req.context?.username || null,

          now.toISOString().split('T')[0],

          now.toTimeString().split(' ')[0],

          `CREATE: ID ${purchaseId}`

        ]

      });

      await Transaction(auditQueries);



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



        // Convert id to number if it's a string

        const purchaseId = typeof id === 'string' ? parseInt(id, 10) : id;



        if (!purchaseId || !currentState) {

          throw new Error('Each update requires valid id and currentState');

        }



        if (isNaN(purchaseId)) {

          throw new Error(`Invalid purchase ID: ${id} (converted to ${purchaseId})`);

        }



        let nextState;

        let updateQuery;

        let updateValues;



        if (currentState === 'PREPARED') {

          nextState = 'CHECKED';

          updateQuery = sql.update(Accounting.purchase.tablename)

            .set([Accounting.purchase.selectOptionColumns.state, Accounting.purchase.selectOptionColumns.checked_by])

            .where(Accounting.purchase.selectOptionColumns.id)

            .build();

          updateValues = [nextState, req.context.username, purchaseId];

        } else if (currentState === 'CHECKED') {

          nextState = 'APPROVED';

          updateQuery = sql.update(Accounting.purchase.tablename)

            .set([Accounting.purchase.selectOptionColumns.state, Accounting.purchase.selectOptionColumns.approved_by])

            .where(Accounting.purchase.selectOptionColumns.id)

            .build();

          updateValues = [nextState, req.context.username, purchaseId];

        } else {

          throw new Error(`Invalid current state: ${currentState}. Only PREPARED and CHECKED can be updated.`);

        }



        return connection.execute(updateQuery, updateValues);



      });



      const results = await Promise.all(updatePromises);



      await connection.commit();



      // Audit trail for state update

const now = new Date();

const auditQueries = [];

updates.forEach((u) => {

  const nextState =
    u.currentState === 'PREPARED'
      ? 'CHECKED'
      : 'APPROVED';

  auditQueries.push({

    sql: sql.insert(Master.audit_trail.tablename, {

      columns: Master.audit_trail.insertColumns,

      prefix: Master.audit_trail.prefix,

      isTransaction: true

    }).build(),

    values: [

      u.id, // FIXED: replace null with purchase ID

      'PURCHASE_STATE',

      req.context?.username || null,

      now.toISOString().split('T')[0],

      now.toTimeString().split(' ')[0],

      `STATE UPDATE: ${u.currentState} → ${nextState}`

    ]

  });

});

await Transaction(auditQueries);



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



const updatePurchase = async (req, res, next) => {

  const { purchase_id } = req.params;

  const purchaseId = Number(purchase_id);

  console.log('Updating purchase_id:', purchaseId, 'type:', typeof purchaseId);

  

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

    

    console.log('Update data:', req.body);



    if (!vendor_id || !document_reference || !terms || !date_delivered || !date_due || !total_amount_due) {

      return res.status(400).json({

        success: false,

        message: 'All required fields must be provided'

      });

    }



    let connection;

    try {

      connection = await getTenantPool().getConnection();

      await connection.beginTransaction();

      // Fetch current data for audit trail BEFORE making any updates
      const currentPurchaseQuery = sql.select([
        { col: Accounting.purchase.selectOptionColumns.vendor_id, as: 'vendor_id' },
        { col: Accounting.purchase.selectOptionColumns.document_reference, as: 'document_reference' },
        { col: Accounting.purchase.selectOptionColumns.terms, as: 'terms' },
        { col: Accounting.purchase.selectOptionColumns.date_delivered, as: 'date_delivered' },
        { col: Accounting.purchase.selectOptionColumns.date_due, as: 'date_due' },
        { col: Accounting.purchase.selectOptionColumns.remarks, as: 'remarks' },
        { col: Accounting.purchase.selectOptionColumns.total_amount_due, as: 'total_amount_due' }
      ])
        .from(Accounting.purchase.tablename)
        .where(Accounting.purchase.selectOptionColumns.id)
        .build();

      const [currentPurchaseData] = await connection.execute(currentPurchaseQuery, [purchaseId]);

      // Fetch current purchase items BEFORE updates
      let currentItemsData = [];
      if (purchase_items && purchase_items.length > 0) {
        const currentItemsQuery = sql.select([
          { col: Accounting.purchase_items.selectOptionColumns.id, as: 'id' },
          { col: Accounting.purchase_items.selectOptionColumns.charts_of_accounts, as: 'account_id' },
          { col: Accounting.purchase_items.selectOptionColumns.quantity, as: 'quantity' },
          { col: Accounting.purchase_items.selectOptionColumns.purchase_price, as: 'purchase_price' },
          { col: Accounting.purchase_items.selectOptionColumns.description, as: 'description' },
          { col: Accounting.purchase_items.selectOptionColumns.responsibility_center, as: 'responsibility_center' }
        ])
          .from(Accounting.purchase_items.tablename)
          .where(Accounting.purchase_items.selectOptionColumns.purchase_id)
          .build();

        currentItemsData = await connection.execute(currentItemsQuery, [purchaseId]);
      }

      // Fetch current journal entries BEFORE updates
      let currentJournalData = [];
      if (journal_entries && journal_entries.length > 0) {
        const currentJournalQuery = sql.select([
          { col: Accounting.journal_entries.selectOptionColumns.id, as: 'id' },
          { col: Accounting.journal_entries.selectOptionColumns.coa_id, as: 'account_id' },
          { col: Accounting.journal_entries.selectOptionColumns.responsibility_center, as: 'responsibility_center' },
          { col: Accounting.journal_entries.selectOptionColumns.amount, as: 'amount' },
          { col: Accounting.journal_entries.selectOptionColumns.type, as: 'type' }
        ])
          .from(Accounting.journal_entries.tablename)
          .where(Accounting.journal_entries.selectOptionColumns.db_name)
          .andWhere(Accounting.journal_entries.selectOptionColumns.db_id)
          .build();

        currentJournalData = await connection.execute(currentJournalQuery, ['purchase', purchaseId]);
      }

      // Fetch current attachments BEFORE updates
      let currentAttachmentsData = [];
      const currentAttachmentsQuery = sql.select([
        { col: Accounting.purchase_attachments.selectOptionColumns.id, as: 'id' },
        { col: Accounting.purchase_attachments.selectOptionColumns.name, as: 'name' },
        { col: Accounting.purchase_attachments.selectOptionColumns.remarks, as: 'remarks' }
      ])
        .from(Accounting.purchase_attachments.tablename)
        .where(Accounting.purchase_attachments.selectOptionColumns.purchase_id)
        .build();

      currentAttachmentsData = await connection.execute(currentAttachmentsQuery, [purchaseId]);

      const updateMainQuery = sql.update(Accounting.purchase.tablename)

        .set([

          Accounting.purchase.selectOptionColumns.vendor_id,

          Accounting.purchase.selectOptionColumns.document_reference,

          Accounting.purchase.selectOptionColumns.terms,

          Accounting.purchase.selectOptionColumns.date_delivered,

          Accounting.purchase.selectOptionColumns.date_due,

          Accounting.purchase.selectOptionColumns.remarks,

          Accounting.purchase.selectOptionColumns.total_amount_due

        ])

        .where(Accounting.purchase.selectOptionColumns.id)

        .build();



      const updateMainValues = [

        vendor_id || null,

        document_reference || null,

        terms || null,

        date_delivered || null,

        date_due || null,

        remarks || null,

        total_amount_due || null,

        purchaseId

      ];



      await connection.execute(updateMainQuery, updateMainValues);



      if (purchase_items && purchase_items.length > 0) {

        const existingItemsQuery = sql.select([

          Accounting.purchase_items.selectOptionColumns.id

        ])

          .from(Accounting.purchase_items.tablename)

          .where(Accounting.purchase_items.selectOptionColumns.purchase_id)

          .build();

        

        const existingItems = await Query(existingItemsQuery, [purchaseId], [Accounting.purchase_items.prefix_]);

        const existingItemIds = existingItems.map(item => item.id);

        

        // Only process item deletions if purchase_items array exists and has items with IDs

        let itemsToDelete = [];

        if (purchase_items && purchase_items.length > 0) {

          const payloadItemIds = purchase_items.filter(item => item.id).map(item => item.id);

          itemsToDelete = existingItemIds.filter(id => !payloadItemIds.includes(id));

        }

        if (itemsToDelete.length > 0) {

          // Delete payment references first (cascade) so purchase items can be removed

          const affectedPaymentsQuery = sql.select([

            { col: Accounting.payment_items.selectOptionColumns.payment_id, as: 'payment_id' }

          ])

            .from(Accounting.payment_items.tablename)

            .whereIn(Accounting.payment_items.selectOptionColumns.purchase_id, itemsToDelete)

            .build();



          const affectedPayments = await Query(

            affectedPaymentsQuery,

            itemsToDelete,

            [Accounting.payment_items.prefix_]

          );



          const affectedPaymentIds = [...new Set(affectedPayments.map(r => r.payment_id))];

          if (affectedPaymentIds.length > 0) {

            const placeholders = affectedPaymentIds.map(() => '?').join(',');

            const deletePaymentJournalSql = `DELETE FROM ${Accounting.journal_entries.tablename} WHERE ${Accounting.journal_entries.selectOptionColumns.db_name} = ? AND ${Accounting.journal_entries.selectOptionColumns.db_id} IN (${placeholders})`;

            await connection.execute(deletePaymentJournalSql, ['payments', ...affectedPaymentIds]);

          }



          const deletePaymentItemsQuery = sql.delete()

            .from(Accounting.payment_items.tablename)

            .whereIn(Accounting.payment_items.selectOptionColumns.purchase_id, itemsToDelete)

            .build();



          await connection.execute(deletePaymentItemsQuery, itemsToDelete);



          // Recreate persisted payment journal entries for affected payments after payment items change

          await regeneratePaymentsJournalEntries(connection, affectedPaymentIds);

          

          const deleteItemsQuery = sql.delete()

            .from(Accounting.purchase_items.tablename)

            .where(Accounting.purchase_items.selectOptionColumns.id)

            .andWhere(Accounting.purchase_items.selectOptionColumns.purchase_id)

            .build();

          

          for (const itemId of itemsToDelete) {

            await connection.execute(deleteItemsQuery, [itemId, purchaseId]);

          }

        }



        for (const item of purchase_items) {

          if (item.id) {

            const updateItemQuery = sql.update(Accounting.purchase_items.tablename)

              .set([

                Accounting.purchase_items.selectOptionColumns.product_service,

                Accounting.purchase_items.selectOptionColumns.charts_of_accounts,

                Accounting.purchase_items.selectOptionColumns.description,

                Accounting.purchase_items.selectOptionColumns.quantity,

                Accounting.purchase_items.selectOptionColumns.purchase_price,

                Accounting.purchase_items.selectOptionColumns.discount,

                Accounting.purchase_items.selectOptionColumns.discount_type,

                Accounting.purchase_items.selectOptionColumns.vat,

                Accounting.purchase_items.selectOptionColumns.withholding_tax,

                Accounting.purchase_items.selectOptionColumns.responsibility_center

              ])

              .where(Accounting.purchase_items.selectOptionColumns.id)

              .build();



            const updateItemValues = [

              item.product_service || null,

              item.charts_of_accounts,

              item.description,

              item.quantity || null,

              item.purchase_price || 0,

              item.discount || 0,

              item.discount_type || null,

              item.vat !== undefined ? item.vat : null,

              item.witholding_tax !== undefined ? item.witholding_tax : null,

              item.responsibility_center || '',

              item.id

            ];



            await connection.execute(updateItemQuery, updateItemValues);

          } else {

            const itemQuery = sql.insert(Accounting.purchase_items.tablename, {

              columns: Accounting.purchase_items.insertColumns,

              prefix: Accounting.purchase_items.prefix,

              isTransaction: true

            }).build();



            const itemValues = [

              purchaseId,

              item.product_service || null,

              item.charts_of_accounts,

              item.description,

              item.quantity || null,

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

      } else if (req.body.hasOwnProperty('purchase_items') && purchase_items.length === 0) {

        // Delete payment references first (cascade) so purchase items can be removed

        const purchaseItemIdsQuery = sql.select([

          Accounting.purchase_items.selectOptionColumns.id

        ])

          .from(Accounting.purchase_items.tablename)

          .where(Accounting.purchase_items.selectOptionColumns.purchase_id)

          .build();



        const purchaseItemIds = await Query(purchaseItemIdsQuery, [purchaseId], [Accounting.purchase_items.prefix_]);

        const idsToDelete = purchaseItemIds.map(r => r.id);



        if (idsToDelete.length > 0) {

          // Delete any stored payment journal entries that were based on those payment items.

          const affectedPaymentsQuery = sql.select([

            { col: Accounting.payment_items.selectOptionColumns.payment_id, as: 'payment_id' }

          ])

            .from(Accounting.payment_items.tablename)

            .whereIn(Accounting.payment_items.selectOptionColumns.purchase_id, idsToDelete)

            .build();



          const affectedPayments = await Query(

            affectedPaymentsQuery,

            idsToDelete,

            [Accounting.payment_items.prefix_]

          );



          const affectedPaymentIds = [...new Set(affectedPayments.map(r => r.payment_id))];

          if (affectedPaymentIds.length > 0) {

            const placeholders = affectedPaymentIds.map(() => '?').join(',');

            const deletePaymentJournalSql = `DELETE FROM ${Accounting.journal_entries.tablename} WHERE ${Accounting.journal_entries.selectOptionColumns.db_name} = ? AND ${Accounting.journal_entries.selectOptionColumns.db_id} IN (${placeholders})`;

            await connection.execute(deletePaymentJournalSql, ['payments', ...affectedPaymentIds]);

          }



          const deletePaymentItemsQuery = sql.delete()

            .from(Accounting.payment_items.tablename)

            .whereIn(Accounting.payment_items.selectOptionColumns.purchase_id, idsToDelete)

            .build();



          await connection.execute(deletePaymentItemsQuery, idsToDelete);

        }

        

        // Only delete all items if explicitly provided as empty array and no references exist

        const deleteAllItemsQuery = sql.delete()

          .from(Accounting.purchase_items.tablename)

          .where(Accounting.purchase_items.selectOptionColumns.purchase_id)

          .build();

        

        await connection.execute(deleteAllItemsQuery, [purchaseId]);

      }



      if (journal_entries && journal_entries.length > 0) {

        const existingEntriesQuery = sql.select([

          Accounting.journal_entries.selectOptionColumns.id

        ])

          .from(Accounting.journal_entries.tablename)

          .where(Accounting.journal_entries.selectOptionColumns.db_name)

          .andWhere(Accounting.journal_entries.selectOptionColumns.db_id)

          .build();

        

        const existingEntries = await Query(existingEntriesQuery, ['purchase', purchaseId], [Accounting.journal_entries.prefix_]);

        const existingEntryIds = existingEntries.map(entry => entry.id);

        

        // Only process entry deletions if journal_entries array exists and has entries with IDs

        let entriesToDelete = [];

        if (journal_entries && journal_entries.length > 0) {

          const payloadEntryIds = journal_entries.filter(entry => entry.id).map(entry => entry.id);

          entriesToDelete = existingEntryIds.filter(id => !payloadEntryIds.includes(id));

        }

        if (entriesToDelete.length > 0) {

          const deleteEntriesQuery = sql.delete()

            .from(Accounting.journal_entries.tablename)

            .where(Accounting.journal_entries.selectOptionColumns.id)

            .andWhere(Accounting.journal_entries.selectOptionColumns.db_name)

            .andWhere(Accounting.journal_entries.selectOptionColumns.db_id)

            .build();

          

          for (const entryId of entriesToDelete) {

            await connection.execute(deleteEntriesQuery, [entryId, 'purchase', purchaseId]);

          }

        }



        if (journal_entries && journal_entries.length > 0) {

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

              entry.charts_of_accounts || null,

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

        }

      } else if (req.body.hasOwnProperty('journal_entries') && journal_entries.length === 0) {

        // Delete all journal entries for this purchase if explicitly provided as empty array

        const deleteAllEntriesQuery = sql.delete()

          .from(Accounting.journal_entries.tablename)

          .where(Accounting.journal_entries.selectOptionColumns.db_name)

          .andWhere(Accounting.journal_entries.selectOptionColumns.db_id)

          .build();

        

        await connection.execute(deleteAllEntriesQuery, ['purchase', purchaseId]);

      }



      if (attachments && attachments.length > 0) {

        const existingAttachmentsQuery = sql.select([

          Accounting.purchase_attachments.selectOptionColumns.id

        ])

          .from(Accounting.purchase_attachments.tablename)

          .where(Accounting.purchase_attachments.selectOptionColumns.purchase_id)

          .build();

        

        const existingAttachments = await Query(existingAttachmentsQuery, [purchaseId], [Accounting.purchase_attachments.prefix_]);

        const existingAttachmentIds = existingAttachments.map(att => att.id);

        const payloadAttachmentIds = attachments.filter(att => att.id).map(att => att.id);

        

        const attachmentsToDelete = existingAttachmentIds.filter(id => !payloadAttachmentIds.includes(id));

        if (attachmentsToDelete.length > 0) {

          const deleteAttachmentsQuery = sql.delete()

            .from(Accounting.purchase_attachments.tablename)

            .where(Accounting.purchase_attachments.selectOptionColumns.id)

            .andWhere(Accounting.purchase_attachments.selectOptionColumns.purchase_id)

            .build();

          

          for (const attachmentId of attachmentsToDelete) {

            await connection.execute(deleteAttachmentsQuery, [attachmentId, purchaseId]);

          }

        }



        for (const attachment of attachments) {
          // Skip attachments with no file data (empty rows)
          if (!attachment.file && !attachment.name) {
            console.log('Skipping empty attachment row');
            continue;
          }

          // Check if ID is a valid database ID (positive integer, likely small)
          // Client-side temp IDs are typically timestamps (very large numbers)
          const isValidDbId = attachment.id &&
                             Number.isInteger(Number(attachment.id)) &&
                             Number(attachment.id) > 0 &&
                             Number(attachment.id) < 1000000000000; // Less than 1 trillion (timestamps are larger)

          if (isValidDbId) {
            console.log('Updating existing attachment ID:', attachment.id);

            const updateAttachmentQuery = sql.update(Accounting.purchase_attachments.tablename)

              .set([

                Accounting.purchase_attachments.selectOptionColumns.name,

                Accounting.purchase_attachments.selectOptionColumns.file,

                Accounting.purchase_attachments.selectOptionColumns.remarks,

                Accounting.purchase_attachments.selectOptionColumns.uploaded_by,

                Accounting.purchase_attachments.selectOptionColumns.uploaded_date

              ])

              .where(Accounting.purchase_attachments.selectOptionColumns.id)

              .build();



            const updateAttachmentValues = [

              attachment.name || null,

              attachment.file || null,

              attachment.remarks || null,

              attachment.uploaded_by || null,

              attachment.uploaded_date || new Date().toISOString().split('T')[0],

              attachment.id

            ];



            await connection.execute(updateAttachmentQuery, updateAttachmentValues);

          } else {
            console.log('Inserting new attachment (invalid or no ID provided)');

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

      } else if (req.body.hasOwnProperty('attachments') && attachments.length === 0) {

        // Delete all attachments for this purchase if explicitly provided as empty array

        const deleteAllAttachmentsQuery = sql.delete()

          .from(Accounting.purchase_attachments.tablename)

          .where(Accounting.purchase_attachments.selectOptionColumns.purchase_id)

          .build();

        

        await connection.execute(deleteAllAttachmentsQuery, [purchaseId]);

      }

      // Track changes for audit trail using data fetched earlier
      const auditChanges = [];

      // Helper function to normalize values for comparison
      const normalizeValue = (val) => val === null || val === undefined ? '' : String(val).trim();
      const normalizeNumber = (val) => val === null || val === undefined ? 0 : parseFloat(val);

      console.log('DEBUG: Current purchase data:', currentPurchaseData);
      console.log('DEBUG: Request body data:', { vendor_id, document_reference, terms, date_delivered, date_due, remarks, total_amount_due });
      console.log('DEBUG: Purchase items data:', purchase_items);
      console.log('DEBUG: Journal entries data:', journal_entries);
      console.log('DEBUG: Attachments data:', attachments);

      if (currentPurchaseData.length > 0) {
        const current = currentPurchaseData[0];

        if (current.vendor_id !== vendor_id) {
          auditChanges.push(`Vendor ID: ${current.vendor_id} → ${vendor_id}`);
        }

        const currentDocRef = normalizeValue(current.document_reference);
        const newDocRef = normalizeValue(document_reference);
        console.log('DEBUG: Doc Ref comparison:', { current: currentDocRef, new: newDocRef, changed: currentDocRef !== newDocRef });
        if (currentDocRef !== newDocRef) {
          auditChanges.push(`Doc Ref: ${currentDocRef || 'NULL'} → ${newDocRef || 'NULL'}`);
        }

        const currentTerms = normalizeValue(current.terms);
        const newTerms = normalizeValue(terms);
        console.log('DEBUG: Terms comparison:', { current: currentTerms, new: newTerms, changed: currentTerms !== newTerms });
        if (currentTerms !== newTerms) {
          auditChanges.push(`Terms: ${currentTerms || 'NULL'} → ${newTerms || 'NULL'}`);
        }

        const currentDateDelivered = normalizeValue(current.date_delivered);
        const newDateDelivered = normalizeValue(date_delivered);
        if (currentDateDelivered !== newDateDelivered) {
          auditChanges.push(`Date Delivered: ${currentDateDelivered || 'NULL'} → ${newDateDelivered || 'NULL'}`);
        }

        const currentDateDue = normalizeValue(current.date_due);
        const newDateDue = normalizeValue(date_due);
        if (currentDateDue !== newDateDue) {
          auditChanges.push(`Date Due: ${currentDateDue || 'NULL'} → ${newDateDue || 'NULL'}`);
        }

        const currentRemarks = normalizeValue(current.remarks);
        const newRemarks = normalizeValue(remarks);
        console.log('DEBUG: Remarks comparison:', { current: currentRemarks, new: newRemarks, changed: currentRemarks !== newRemarks });
        if (currentRemarks !== newRemarks) {
          auditChanges.push(`Remarks: ${currentRemarks || 'NULL'} → ${newRemarks || 'NULL'}`);
        }

        if (normalizeNumber(current.total_amount_due) !== normalizeNumber(total_amount_due)) {
          auditChanges.push(`Total Amount: ${current.total_amount_due} → ${total_amount_due}`);
        }
      }

      // Track purchase items changes using data fetched earlier
      console.log('DEBUG: Current items data from DB:', currentItemsData);
      if (purchase_items && purchase_items.length > 0) {
        for (let i = 0; i < purchase_items.length; i++) {
          const item = purchase_items[i];
          console.log('DEBUG: Processing item:', item);
          let currentItem = null;

          if (item.id) {
            // Find by ID if available
            currentItem = currentItemsData[0]?.find(i => i.id === item.id);
          } else {
            // If no ID, try to match by account_id and position
            currentItem = currentItemsData[0]?.find((existingItem, index) =>
              existingItem.account_id === item.account_id && index === i
            );

            // If still not found, try to match by account_id only
            if (!currentItem && item.account_id) {
              currentItem = currentItemsData[0]?.find(existingItem =>
                existingItem.account_id === item.account_id
              );
            }
          }

          console.log('DEBUG: Found current item:', currentItem);
          if (currentItem) {
            // Only compare qty if it's provided in the request (not undefined/null)
            if (item.qty !== undefined && item.qty !== null) {
              const currentQty = normalizeNumber(currentItem.quantity);
              const newQty = normalizeNumber(item.qty);
              console.log('DEBUG: Item qty comparison:', { itemId: currentItem.id, current: currentQty, new: newQty, changed: currentQty !== newQty });
              if (currentQty !== newQty) {
                auditChanges.push(`Item ${currentItem.id} Qty: ${currentQty} → ${newQty}`);
              }
            }

            // Only compare price if it's provided in the request (not undefined/null)
            if (item.price !== undefined && item.price !== null) {
              const currentPrice = normalizeNumber(currentItem.purchase_price);
              const newPrice = normalizeNumber(item.price);
              console.log('DEBUG: Item price comparison:', { itemId: currentItem.id, current: currentPrice, new: newPrice, changed: currentPrice !== newPrice });
              if (currentPrice !== newPrice) {
                auditChanges.push(`Item ${currentItem.id} Price: ${currentPrice} → ${newPrice}`);
              }
            }

            // Only compare description if it's provided in the request (not undefined)
            if (item.description !== undefined) {
              const currentDesc = normalizeValue(currentItem.description);
              const newDesc = normalizeValue(item.description);
              console.log('DEBUG: Item desc comparison:', { itemId: currentItem.id, current: currentDesc, new: newDesc, changed: currentDesc !== newDesc });
              if (currentDesc !== newDesc) {
                auditChanges.push(`Item ${currentItem.id} Desc: ${currentDesc || 'NULL'} → ${newDesc || 'NULL'}`);
              }
            }

            // Only compare responsibility_center if it's provided in the request (not undefined)
            if (item.responsibility_center !== undefined) {
              const currentRespCenter = normalizeValue(currentItem.responsibility_center);
              const newRespCenter = normalizeValue(item.responsibility_center);
              console.log('DEBUG: Item resp center comparison:', { itemId: currentItem.id, current: currentRespCenter, new: newRespCenter, changed: currentRespCenter !== newRespCenter });
              if (currentRespCenter !== newRespCenter) {
                auditChanges.push(`Item ${currentItem.id} Resp Center: ${currentRespCenter || 'NULL'} → ${newRespCenter || 'NULL'}`);
              }
            }
          } else {
            auditChanges.push(`Added new item: ${normalizeValue(item.description) || 'Unknown'}`);
          }
        }
      }

      // Track journal entries changes using data fetched earlier
      console.log('DEBUG: Current journal data from DB:', currentJournalData);
      if (journal_entries && journal_entries.length > 0) {
        for (let i = 0; i < journal_entries.length; i++) {
          const entry = journal_entries[i];
          console.log('DEBUG: Processing journal entry:', entry);
          const type = entry.debit > 0 ? 'debit' : 'credit';
          const amount = entry.debit > 0 ? entry.debit : entry.credit;
          let currentEntry = null;

          if (entry.id) {
            // Find by ID if available
            currentEntry = currentJournalData[0]?.find(j => j.id === entry.id);
          } else {
            // If no ID, try to match by account_id, type, and position
            currentEntry = currentJournalData[0]?.find((existingEntry, index) =>
              existingEntry.account_id === entry.account_id &&
              existingEntry.type.toLowerCase() === type &&
              index === i
            );

            // If still not found, try to match by account_id and type only
            if (!currentEntry && entry.account_id) {
              currentEntry = currentJournalData[0]?.find(existingEntry =>
                existingEntry.account_id === entry.account_id &&
                existingEntry.type.toLowerCase() === type
              );
            }

            // If still not found, try to match by amount and type only
            if (!currentEntry) {
              currentEntry = currentJournalData[0]?.find(existingEntry =>
                normalizeNumber(existingEntry.amount) === normalizeNumber(amount) &&
                existingEntry.type.toLowerCase() === type
              );
            }
          }

          console.log('DEBUG: Found current journal entry:', currentEntry);
          if (currentEntry) {
            const currentRespCenter = normalizeValue(currentEntry.responsibility_center);
            const newRespCenter = normalizeValue(entry.responsibility_center);
            console.log('DEBUG: Journal resp center comparison:', { entryId: currentEntry.id, current: currentRespCenter, new: newRespCenter, changed: currentRespCenter !== newRespCenter });
            if (currentRespCenter !== newRespCenter) {
              auditChanges.push(`Journal ${currentEntry.id} Resp Center: ${currentRespCenter || 'NULL'} → ${newRespCenter || 'NULL'}`);
            }

            const currentAmount = normalizeNumber(currentEntry.amount);
            const newAmount = normalizeNumber(amount);
            if (currentAmount !== newAmount) {
              auditChanges.push(`Journal ${currentEntry.id} Amount: ${currentAmount} → ${newAmount}`);
            }

            const currentType = normalizeValue(currentEntry.type);
            if (currentType.toLowerCase() !== type.toLowerCase()) {
              auditChanges.push(`Journal ${currentEntry.id} Type: ${currentType} → ${type}`);
            }
          } else {
            auditChanges.push(`Added new journal entry: ${normalizeValue(entry.responsibility_center) || 'Unassigned'}`);
          }
        }
      }

      // Track attachment changes
      console.log('DEBUG: Current attachments data from DB:', currentAttachmentsData);
      console.log('DEBUG: Request attachments data:', attachments);

      // Get existing attachments for comparison
      const existingAttachmentsQuery = sql.select([
        Accounting.purchase_attachments.selectOptionColumns.id
      ])
        .from(Accounting.purchase_attachments.tablename)
        .where(Accounting.purchase_attachments.selectOptionColumns.purchase_id)
        .build();

      const existingAttachments = await Query(existingAttachmentsQuery, [purchaseId], [Accounting.purchase_attachments.prefix_]);
      const existingAttachmentIds = existingAttachments.map(attachment => attachment.id);

      console.log('DEBUG: Existing attachment IDs:', existingAttachmentIds);

      if (attachments && attachments.length > 0) {
        // Filter out attachments with invalid IDs (null, undefined, 'null', 'undefined', empty string)
        const validAttachments = attachments.filter(attachment =>
          attachment.id &&
          attachment.id !== null &&
          attachment.id !== undefined &&
          attachment.id !== '' &&
          attachment.id !== 'null' &&
          attachment.id !== 'undefined'
        );
        const payloadAttachmentIds = validAttachments.map(attachment => attachment.id);
        console.log('DEBUG: Valid payload attachments:', validAttachments);
        console.log('DEBUG: Payload attachment IDs:', payloadAttachmentIds);

        // Find deleted attachments - IDs in DB but not in valid payload
        const deletedAttachmentIds = existingAttachmentIds.filter(id => !payloadAttachmentIds.includes(id));
        console.log('DEBUG: Deleted attachment IDs:', deletedAttachmentIds);
        if (deletedAttachmentIds.length > 0) {
          for (const deletedId of deletedAttachmentIds) {
            const deletedAttachment = currentAttachmentsData[0]?.find(a => a.id === deletedId);
            console.log('DEBUG: Found deleted attachment:', deletedAttachment);
            if (deletedAttachment) {
              auditChanges.push(`Deleted attachment: ${normalizeValue(deletedAttachment.name) || 'Unknown'} (ID: ${deletedId})`);
            }
          }
        }

        for (const attachment of attachments) {
          console.log('DEBUG: Processing attachment:', attachment);
          console.log('DEBUG: Attachment ID:', attachment.id, 'Type:', typeof attachment.id);

          // Check if ID is valid (not null, undefined, empty string, or string 'null')
          const hasValidId = attachment.id &&
                            attachment.id !== null &&
                            attachment.id !== undefined &&
                            attachment.id !== '' &&
                            attachment.id !== 'null' &&
                            attachment.id !== 'undefined';

          console.log('DEBUG: Has valid ID:', hasValidId);

          if (hasValidId) {
            console.log('DEBUG: Attachment has valid ID, checking for updates...');
            const currentAttachment = currentAttachmentsData[0]?.find(a => a.id === attachment.id);
            console.log('DEBUG: Found current attachment:', currentAttachment);
            if (currentAttachment) {
              // Only compare remarks if it's provided in the request (not undefined)
              if (attachment.remarks !== undefined) {
                const currentRemarks = normalizeValue(currentAttachment.remarks);
                const newRemarks = normalizeValue(attachment.remarks);
                console.log('DEBUG: Attachment remarks comparison:', { attachmentId: attachment.id, current: currentRemarks, new: newRemarks, changed: currentRemarks !== newRemarks });
                if (currentRemarks !== newRemarks) {
                  auditChanges.push(`Attachment ${attachment.id} Remarks: ${currentRemarks || 'NULL'} → ${newRemarks || 'NULL'}`);
                }
              }
            } else {
              console.log('DEBUG: Attachment ID not found in current data, treating as new');
              auditChanges.push(`Added new attachment: ${normalizeValue(attachment.name) || normalizeValue(attachment.fileName) || 'Unknown'}`);
            }
          } else {
            console.log('DEBUG: No valid attachment ID, treating as new attachment');
            console.log('DEBUG: Attachment name:', attachment.name, 'fileName:', attachment.fileName);
            auditChanges.push(`Added new attachment: ${normalizeValue(attachment.name) || normalizeValue(attachment.fileName) || 'Unknown'}`);
          }
        }
      } else {
        console.log('DEBUG: No attachments in payload, checking for deletions');
        // All attachments were deleted
        if (existingAttachmentIds.length > 0) {
          for (const existingId of existingAttachmentIds) {
            const deletedAttachment = currentAttachmentsData[0]?.find(a => a.id === existingId);
            console.log('DEBUG: Found deleted attachment (all):', deletedAttachment);
            if (deletedAttachment) {
              auditChanges.push(`Deleted attachment: ${normalizeValue(deletedAttachment.name) || 'Unknown'} (ID: ${existingId})`);
            }
          }
        }
      }

      await connection.commit();

      // Create audit trail entry
      if (auditChanges.length > 0) {
        const now = new Date();
        const auditQueries = [{
          sql: sql.insert(Master.audit_trail.tablename, {
            columns: Master.audit_trail.insertColumns,
            prefix: Master.audit_trail.prefix,
            isTransaction: true
          }).build(),
          values: [
            purchaseId,
            'PURCHASE_UPDATE',
            req.context?.username || null,
            now.toISOString().split('T')[0],
            now.toTimeString().split(' ')[0],
            `UPDATE: ${auditChanges.join(', ')}`
          ]
        }];

        await Transaction(auditQueries);
      }

      res.status(200).json({
        success: true,

        message: 'Purchase updated successfully',

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

    console.error('Error updating purchase:', error);

    return res.status(500).json({

      success: false,

      message: 'Server error while updating purchase',

      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'

    });

  }

}



const getPrintPurchases = async (req, res, next) => {

  const { purchase_id } = req.params;

  const { copyType } = req.query;



  const purchaseIds = purchase_id.split(',').map(id => Number(id.trim())).filter(id => !isNaN(id));

  console.log('Converted purchase_ids:', purchaseIds, 'type:', typeof purchaseIds);

  console.log('Copy type:', copyType);



  if (purchaseIds.length === 0) {

    return res.status(400).json({

      success: false,

      message: 'Invalid purchase IDs provided',

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



    // Fetch purchases with vendor info

    const purchases_query = sql.select([

      { col: `${Accounting.purchase.tablename}.${Accounting.purchase.selectOptionColumns.id}`, as: 'id' },

      { col: `${Accounting.purchase.tablename}.${Accounting.purchase.selectOptionColumns.vendor_id}`, as: 'vendor_id' },

      { col: `${Master.vendors.tablename}.${Master.vendors.selectOptionColumns.name}`, as: 'vendor' },

      { col: `${Accounting.purchase.tablename}.${Accounting.purchase.selectOptionColumns.document_reference}`, as: 'doc_ref' },

      { col: `${Accounting.purchase.tablename}.${Accounting.purchase.selectOptionColumns.terms}`, as: 'terms' },

      { col: `${Accounting.purchase.tablename}.${Accounting.purchase.selectOptionColumns.date_delivered}`, as: 'date_delivered' },

      { col: `${Accounting.purchase.tablename}.${Accounting.purchase.selectOptionColumns.date_due}`, as: 'date_due' },

      { col: `${Accounting.purchase.tablename}.${Accounting.purchase.selectOptionColumns.remarks}`, as: 'remarks' },

      { col: `${Accounting.purchase.tablename}.${Accounting.purchase.selectOptionColumns.total_amount_due}`, as: 'amount_due' },

      { col: `${Accounting.purchase.tablename}.${Accounting.purchase.selectOptionColumns.status}`, as: 'status' },

      { col: `${Accounting.purchase.tablename}.${Accounting.purchase.selectOptionColumns.state}`, as: 'state' },

      { col: `${Accounting.purchase.tablename}.${Accounting.purchase.selectOptionColumns.created_by}`, as: 'created_by' },

      { col: `${Accounting.purchase.tablename}.${Accounting.purchase.selectOptionColumns.checked_by}`, as: 'checked_by' },

      { col: `${Accounting.purchase.tablename}.${Accounting.purchase.selectOptionColumns.approved_by}`, as: 'approved_by' }

    ])

      .from(Accounting.purchase.tablename)

      .innerJoin(Master.vendors.tablename, `${Accounting.purchase.tablename}.${Accounting.purchase.selectOptionColumns.vendor_id}`, `${Master.vendors.tablename}.${Master.vendors.selectOptionColumns.id}`)

      .whereIn(`${Accounting.purchase.tablename}.${Accounting.purchase.selectOptionColumns.id}`, purchaseIds)

      .build();



    let purchases = await Query(purchases_query, [...purchaseIds], [Accounting.purchase.prefix_, Master.vendors.prefix_]);



    // Fetch purchase items

    const purchase_items_query = sql.select([

      { col: Accounting.purchase_items.selectOptionColumns.id, as: 'id' },

      { col: Accounting.purchase_items.selectOptionColumns.purchase_id, as: 'purchase_id' },

      { col: Accounting.purchase_items.selectOptionColumns.product_service, as: 'product_service_id' },

      { col: Master.products_service.selectOptionColumns.name, as: 'product_service_name' },

      { col: Accounting.purchase_items.selectOptionColumns.charts_of_accounts, as: 'charts_of_accounts_id' },

      { col: Master.charts_of_accounts.selectOptionColumns.name, as: 'charts_of_accounts_name' },

      { col: Accounting.purchase_items.selectOptionColumns.description, as: 'description' },

      { col: Accounting.purchase_items.selectOptionColumns.quantity, as: 'quantity' },

      { col: Accounting.purchase_items.selectOptionColumns.purchase_price, as: 'purchase_price' },

      { col: Accounting.purchase_items.selectOptionColumns.discount, as: 'discount' },

      { col: Accounting.purchase_items.selectOptionColumns.discount_type, as: 'discount_type' },

      { col: Master.vat.selectOptionColumns.rate, as: 'vat_rate' },

      { col: Master.withholding_tax.selectOptionColumns.rate, as: 'withholding_tax_rate' },

      { col: Accounting.purchase_items.selectOptionColumns.responsibility_center, as: 'responsibility_center' }

    ])

      .from(Accounting.purchase_items.tablename)

      .leftJoin(Master.vat.tablename, Accounting.purchase_items.selectOptionColumns.vat, Master.vat.selectOptionColumns.id)

      .leftJoin(Master.withholding_tax.tablename, Accounting.purchase_items.selectOptionColumns.withholding_tax, Master.withholding_tax.selectOptionColumns.id)

      .leftJoin(Master.products_service.tablename, Accounting.purchase_items.selectOptionColumns.product_service, Master.products_service.selectOptionColumns.id)

      .innerJoin(Master.charts_of_accounts.tablename, Accounting.purchase_items.selectOptionColumns.charts_of_accounts, Master.charts_of_accounts.selectOptionColumns.id)

      .whereIn(Accounting.purchase_items.selectOptionColumns.purchase_id, purchaseIds)

      .build();



    let purchase_items = await Query(purchase_items_query, [...purchaseIds], [Accounting.purchase_items.prefix_]);



    // Fetch journal entries

    const purchase_journal_query = sql.select([

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

      .whereIn(Accounting.journal_entries.selectOptionColumns.db_id, purchaseIds)

      .build();



    let purchase_journal = await Query(purchase_journal_query, ['purchase', ...purchaseIds], [Accounting.journal_entries.prefix_]);

    console.log('Raw journal data:', purchase_journal);



    // Fetch attachments

    const purchase_attachments_query = sql.select([

      { col: Accounting.purchase_attachments.selectOptionColumns.id, as: 'id' },

      { col: Accounting.purchase_attachments.selectOptionColumns.purchase_id, as: 'purchase_id' },

      { col: Accounting.purchase_attachments.selectOptionColumns.file, as: 'file' },

      { col: Accounting.purchase_attachments.selectOptionColumns.name, as: 'name' },

      { col: Accounting.purchase_attachments.selectOptionColumns.remarks, as: 'remarks' },

      { col: Accounting.purchase_attachments.selectOptionColumns.uploaded_by, as: 'uploaded_by' },

      { col: Accounting.purchase_attachments.selectOptionColumns.uploaded_date, as: 'uploaded_date' }

    ])

      .from(Accounting.purchase_attachments.tablename)

      .whereIn(Accounting.purchase_attachments.selectOptionColumns.purchase_id, purchaseIds)

      .build();



    let purchase_attachments = await Query(purchase_attachments_query, [...purchaseIds], [Accounting.purchase_attachments.prefix_]);



    // Group items, journal, and attachments by purchase ID

    const groupedData = purchases.map(purchase => {

      const purchaseItems = purchase_items.filter(item => item.purchase_id === purchase.id);



      const purchaseJournal = copyType === 'customer'

        ? []

        : purchase_journal.filter(entry => entry.db_id === purchase.id);



      const mappedItems = purchaseItems.map(item => {

        const quantity = parseFloat(item.quantity || 1);

        const purchasePrice = parseFloat(item.purchase_price || 0);

        const discount = parseFloat(item.discount || 0);

        const vatRate = parseFloat(item.vat_rate || 0);

        const whtRate = parseFloat(item.withholding_tax_rate || 0);



        const totalPrice = purchasePrice * quantity;

        const discountAmount = totalPrice * (discount / 100);

        const discountedPrice = totalPrice - discountAmount;

        const vatAmount = discountedPrice * (vatRate / 100);

        const whtAmount = discountedPrice * (whtRate / 100);

        const amountDue = discountedPrice + vatAmount - whtAmount;



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



      const mappedJournal = purchaseJournal.map(entry => {

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

        ...purchase,

        items: mappedItems,

        journal: mappedJournal,

        attachments: purchase_attachments.filter(att => att.purchase_id === purchase.id),

        company: company

      };

    });



    console.log('Grouped purchases data:', groupedData);

    res.status(200).json({

      success: true,

      message: 'Purchases retrieved successfully',

      company: company,

      data: groupedData,

      count: groupedData.length,

      timestamp: new Date().toISOString()

    });



  } catch (error) {

    console.error('Error fetching purchases:', error);

    return res.status(500).json({

      success: false,

      message: 'Server error while fetching purchases',

      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'

    });

  }

};



module.exports = {

  getPurchase,

  getAllPurchase,

  createPurchase,

  updatePurchase,

  updatePurchaseState,

  getPrintPurchases

}

