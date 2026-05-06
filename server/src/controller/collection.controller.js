const os = require('os')

const { checkConnection, SelectAll, Query, Transaction } = require('../database/util/queries.util')

const { formatMemoryUsage, formatTime, DataModeling } = require('../util/helper.util')

const { Master } = require('../database/model/Master')

const { Accounting } = require('../database/model/Accounting')

const { SQLQueryBuilder } = require('../util/helper.util')

const { getTenantPool } = require('../database/util/tenantConnection.util')

const sql = new SQLQueryBuilder()



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

      .andWhereNotExists(`SELECT 1 FROM ${Accounting.collection_items.tablename} WHERE ${Accounting.collection_items.selectOptionColumns.sales_id} = ${Accounting.sales.selectOptionColumns.id}`)

      .build();

    let sales = await Query(query, ['APPROVED', 'PAID'], [Accounting.sales.prefix_, Master.customers.prefix_]);

    console.log("SALES QUERY", sales);

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

      { col: Accounting.sales_items.selectOptionColumns.id, as: 'id' },

      { col: Accounting.sales_items.selectOptionColumns.sales_id, as: 'sales_id' },



      { col: Accounting.sales_items.selectOptionColumns.product_service, as: 'product_service' },

      { col: Master.products_service.selectOptionColumns.name, as: 'product_service_name' },



      { col: Accounting.sales_items.selectOptionColumns.charts_of_accounts, as: 'charts_of_accounts' },

      { col: Master.charts_of_accounts.selectOptionColumns.name, as: 'coa_name' },



      { col: Accounting.sales.selectOptionColumns.document_reference, as: 'document_reference' },



      { col: Accounting.sales_items.selectOptionColumns.description, as: 'description' },

      { col: Accounting.sales_items.selectOptionColumns.quantity, as: 'quantity' },

      { col: Accounting.sales_items.selectOptionColumns.sales_price, as: 'sales_price' },



      { col: Accounting.sales_items.selectOptionColumns.discount, as: 'discount' },

      { col: Accounting.sales_items.selectOptionColumns.discount_type, as: 'discount_type' },

      { col: Master.vat.selectOptionColumns.rate, as: 'vat' },

      { col: Master.withholding_tax.selectOptionColumns.rate, as: 'witholding_tax' },



      { col: Accounting.sales_items.selectOptionColumns.responsibility_center, as: 'responsibility_center' },

    ])

      .from(Accounting.sales_items.tablename)

      .leftJoin(

        Master.vat.tablename,

        Accounting.sales_items.selectOptionColumns.vat,

        Master.vat.selectOptionColumns.id

      )

      .leftJoin(

        Master.withholding_tax.tablename,

        Accounting.sales_items.selectOptionColumns.witholding_tax,

        Master.withholding_tax.selectOptionColumns.id

      )

      .innerJoin(

        Accounting.sales.tablename,

        Accounting.sales_items.selectOptionColumns.sales_id,

        Accounting.sales.selectOptionColumns.id

      )

      .leftJoin(

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

      { col: Accounting.sales_items.selectOptionColumns.discount_type, as: 'discount_type' },

      { col: Master.vat.selectOptionColumns.rate, as: 'vat' },

      { col: Accounting.collection_items.selectOptionColumns.amount, as: 'amount' },

      { col: Master.withholding_tax.selectOptionColumns.rate, as: 'witholding_tax' },

      { col: Accounting.sales_items.selectOptionColumns.responsibility_center, as: 'responsibility_center' },

    ])

      .from(Accounting.collection_items.tablename)

      .innerJoin(Accounting.sales_items.tablename, Accounting.sales_items.selectOptionColumns.id, Accounting.collection_items.selectOptionColumns.sales_id)

      .innerJoin(Accounting.sales.tablename, Accounting.sales.selectOptionColumns.id, Accounting.sales_items.selectOptionColumns.sales_id)

      .leftJoin(

        Master.vat.tablename,

        Accounting.sales_items.selectOptionColumns.vat,

        Master.vat.selectOptionColumns.id

      )

      .leftJoin(

        Master.withholding_tax.tablename,

        Accounting.sales_items.selectOptionColumns.witholding_tax,

        Master.withholding_tax.selectOptionColumns.id

      )

      .leftJoin(Master.products_service.tablename, Master.products_service.selectOptionColumns.id, Accounting.sales_items.selectOptionColumns.product_service)

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

    if (!customer_id || !mode_of_payment || !collection_date || !created_by) {

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

      connection = await getTenantPool().getConnection();

      await connection.beginTransaction();



      const mainQuery = sql.insert(Accounting.collections.tablename, {

        columns: Accounting.collections.insertColumns,

        prefix: Accounting.collections.prefix,

        isTransaction: true

      }).build();



      const mainValues = [

        customer_id || null,

        document_reference || " ",

        mode_of_payment || null,

        bank_name || null,

        check_number || null,

        collection_date || null,

        remarks || null,

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

          collectionId || null,

          'COLLECTION',

          req.context?.username || null,

          now.toISOString().split('T')[0],

          now.toTimeString().split(' ')[0],

          `CREATE: ID ${collectionId}`

        ]

      });

      await Transaction(auditQueries);



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

      connection = await getTenantPool().getConnection();

      await connection.beginTransaction();



      const updatePromises = updates.map(async (update) => {

        const { id, currentState } = update;



        if (!id || !currentState) {

          throw new Error('Each update requires id and currentState');

        }



        let nextState;

        let updateQuery;

        let updateValues;



        if (currentState === 'PREPARED') {

          nextState = 'CHECKED';

          updateQuery = sql.update(Accounting.collections.tablename)

            .set([Accounting.collections.selectOptionColumns.state, Accounting.collections.selectOptionColumns.checked_by])

            .where(Accounting.collections.selectOptionColumns.id)

            .build();

          updateValues = [nextState, req.context.username, id];

        } else if (currentState === 'CHECKED') {

          nextState = 'APPROVED';

          updateQuery = sql.update(Accounting.collections.tablename)

            .set([Accounting.collections.selectOptionColumns.state, Accounting.collections.selectOptionColumns.approved_by])

            .where(Accounting.collections.selectOptionColumns.id)

            .build();

          updateValues = [nextState, req.context.username, id];



          // Special logic for APPROVED state: update related sales records to PAID

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

          throw new Error(`Invalid current state: ${currentState}. Only PREPARED and CHECKED can be updated.`);

        }



        return connection.execute(updateQuery, updateValues);



      });



      const results = await Promise.all(updatePromises);



      await connection.commit();



      // Audit trail for state update

      const now = new Date();

      const stateTransitions = updates.map(u => `ID ${u.id}: ${u.currentState} → ${u.currentState === 'PREPARED' ? 'CHECKED' : 'APPROVED'}`).join(', ');

      const auditQueries = [];

      auditQueries.push({

        sql: sql.insert(Master.audit_trail.tablename, {

          columns: Master.audit_trail.insertColumns,

          prefix: Master.audit_trail.prefix,

          isTransaction: true

        }).build(),

        values: [

          null,

          'COLLECTION_STATE',

          req.context?.username || null,

          now.toISOString().split('T')[0],

          now.toTimeString().split(' ')[0],

          `STATE UPDATE: ${results.length} record(s) - ${stateTransitions}`

        ]

      });

      await Transaction(auditQueries);



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



const getPrintCollections = async (req, res, next) => {

  const { collection_id } = req.params;

  const { copyType } = req.query;



  const collectionIds = collection_id.split(',').map(id => Number(id.trim())).filter(id => !isNaN(id));

  console.log('Converted collection_ids:', collectionIds, 'type:', typeof collectionIds);

  console.log('Copy type:', copyType);



  if (collectionIds.length === 0) {

    return res.status(400).json({

      success: false,

      message: 'Invalid collection IDs provided',

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



    // Fetch collections with customer info

    const collections_query = sql.select([

      { col: `${Accounting.collections.tablename}.${Accounting.collections.selectOptionColumns.id}`, as: 'id' },

      { col: `${Accounting.collections.tablename}.${Accounting.collections.selectOptionColumns.customer_id}`, as: 'customer_id' },

      { col: `${Master.customers.tablename}.${Master.customers.selectOptionColumns.name}`, as: 'customer' },

      { col: `${Accounting.collections.tablename}.${Accounting.collections.selectOptionColumns.document_reference}`, as: 'doc_ref' },

      { col: `${Accounting.collections.tablename}.${Accounting.collections.selectOptionColumns.collection_date}`, as: 'collection_date' },

      { col: `${Accounting.collections.tablename}.${Accounting.collections.selectOptionColumns.mode_of_payment}`, as: 'mode' },

      { col: `${Accounting.collections.tablename}.${Accounting.collections.selectOptionColumns.bank_name}`, as: 'bank_name' },

      { col: `${Accounting.collections.tablename}.${Accounting.collections.selectOptionColumns.check_number}`, as: 'check_number' },

      { col: `${Accounting.collections.tablename}.${Accounting.collections.selectOptionColumns.remarks}`, as: 'remarks' },

      { col: `${Accounting.collections.tablename}.${Accounting.collections.selectOptionColumns.state}`, as: 'state' },

      { col: `${Accounting.collections.tablename}.${Accounting.collections.selectOptionColumns.created_by}`, as: 'created_by' },

      { col: `${Accounting.collections.tablename}.${Accounting.collections.selectOptionColumns.checked_by}`, as: 'checked_by' },

      { col: `${Accounting.collections.tablename}.${Accounting.collections.selectOptionColumns.approved_by}`, as: 'approved_by' }

    ])

      .from(Accounting.collections.tablename)

      .innerJoin(Master.customers.tablename, `${Accounting.collections.tablename}.${Accounting.collections.selectOptionColumns.customer_id}`, `${Master.customers.tablename}.${Master.customers.selectOptionColumns.id}`)

      .whereIn(`${Accounting.collections.tablename}.${Accounting.collections.selectOptionColumns.id}`, collectionIds)

      .build();



    let collections = await Query(collections_query, [...collectionIds], [Accounting.collections.prefix_, Master.customers.prefix_]);



    // Fetch collection items with sales info

    const collection_items_query = sql.select([

      { col: Accounting.collection_items.selectOptionColumns.id, as: 'id' },

      { col: Accounting.collection_items.selectOptionColumns.collection_id, as: 'collection_id' },

      { col: Accounting.collection_items.selectOptionColumns.sales_id, as: 'sales_id' },

      { col: Accounting.sales.selectOptionColumns.document_reference, as: 'invoice_ref' },

      { col: Accounting.sales.selectOptionColumns.total_amount_due, as: 'invoice_amount' },

      { col: Master.products_service.selectOptionColumns.name, as: 'product_service_name' },

      { col: Accounting.sales_items.selectOptionColumns.description, as: 'description' },

      { col: Accounting.sales_items.selectOptionColumns.quantity, as: 'quantity' },

      { col: Accounting.sales_items.selectOptionColumns.sales_price, as: 'sales_price' },

      { col: Accounting.sales_items.selectOptionColumns.discount, as: 'discount' },

      { col: Accounting.sales_items.selectOptionColumns.discount_type, as: 'discount_type' },

      { col: Master.vat.selectOptionColumns.rate, as: 'vat_rate' },

      { col: Master.withholding_tax.selectOptionColumns.rate, as: 'withholding_tax_rate' },

      { col: Accounting.collection_items.selectOptionColumns.amount, as: 'amount' },

      { col: Accounting.sales_items.selectOptionColumns.responsibility_center, as: 'responsibility_center' }

    ])

      .from(Accounting.collection_items.tablename)

      .innerJoin(Accounting.sales_items.tablename, Accounting.sales_items.selectOptionColumns.id, Accounting.collection_items.selectOptionColumns.sales_id)

      .innerJoin(Accounting.sales.tablename, Accounting.sales.selectOptionColumns.id, Accounting.sales_items.selectOptionColumns.sales_id)

      .leftJoin(Master.vat.tablename, Accounting.sales_items.selectOptionColumns.vat, Master.vat.selectOptionColumns.id)

      .leftJoin(Master.withholding_tax.tablename, Accounting.sales_items.selectOptionColumns.witholding_tax, Master.withholding_tax.selectOptionColumns.id)

      .leftJoin(Master.products_service.tablename, Accounting.sales_items.selectOptionColumns.product_service, Master.products_service.selectOptionColumns.id)

      .whereIn(Accounting.collection_items.selectOptionColumns.collection_id, collectionIds)

      .build();



    let collection_items = await Query(collection_items_query, [...collectionIds], [Accounting.collection_items.prefix_, Accounting.sales.prefix_, Master.products_service.prefix_]);



    // Fetch journal entries

    const collection_journal_query = sql.select([

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

      .whereIn(Accounting.journal_entries.selectOptionColumns.db_id, collectionIds)

      .build();



    let collection_journal = await Query(collection_journal_query, ['collections', ...collectionIds], [Accounting.journal_entries.prefix_]);

    console.log('Raw journal data:', collection_journal);



    // Fetch attachments

    const collection_attachments_query = sql.select([

      { col: Accounting.collection_attachments.selectOptionColumns.id, as: 'id' },

      { col: Accounting.collection_attachments.selectOptionColumns.collection_id, as: 'collection_id' },

      { col: Accounting.collection_attachments.selectOptionColumns.file, as: 'file' },

      { col: Accounting.collection_attachments.selectOptionColumns.name, as: 'name' },

      { col: Accounting.collection_attachments.selectOptionColumns.remarks, as: 'remarks' },

      { col: Accounting.collection_attachments.selectOptionColumns.uploaded_by, as: 'uploaded_by' },

      { col: Accounting.collection_attachments.selectOptionColumns.uploaded_date, as: 'uploaded_date' }

    ])

      .from(Accounting.collection_attachments.tablename)

      .whereIn(Accounting.collection_attachments.selectOptionColumns.collection_id, collectionIds)

      .build();



    let collection_attachments = await Query(collection_attachments_query, [...collectionIds], [Accounting.collection_attachments.prefix_]);



    // Group items, journal, and attachments by collection ID

    const groupedData = collections.map(collection => {

      const items = collection_items.filter(item => item.collection_id === collection.id);



      const collectionJournal = copyType === 'customer'

        ? []

        : collection_journal.filter(entry => entry.db_id === collection.id);



      const mappedItems = items.map(item => {

        const quantity = parseFloat(item.quantity || 1);

        const salesPrice = parseFloat(item.sales_price || 0);

        const discount = parseFloat(item.discount || 0);

        const vatRate = parseFloat(item.vat_rate || 0);

        const whtRate = parseFloat(item.withholding_tax_rate || 0);



        const totalPrice = salesPrice * quantity;

        const discountAmount = totalPrice * (discount / 100);

        const discountedPrice = totalPrice - discountAmount;

        const vatAmount = discountedPrice * (vatRate / 100);

        const whtAmount = discountedPrice * (whtRate / 100);

        const amountDue = discountedPrice + vatAmount - whtAmount;



        return {

          id: item.id,

          sales_id: item.sales_id,

          invoice_ref: item.invoice_ref || '—',

          product_name: item.product_service_name || '—',

          description: item.description || '—',

          unit: 'pcs',

          quantity: quantity,

          purchase_price: salesPrice,

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



      const mappedJournal = collectionJournal.map(entry => {

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

        ...collection,

        items: mappedItems,

        journal: mappedJournal,

        attachments: collection_attachments.filter(att => att.collection_id === collection.id),

        company: company

      };

    });



    console.log('Grouped collections data:', groupedData);

    res.status(200).json({

      success: true,

      message: 'Collections retrieved successfully',

      company: company,

      data: groupedData,

      count: groupedData.length,

      timestamp: new Date().toISOString()

    });



  } catch (error) {

    console.error('Error fetching collections:', error);

    return res.status(500).json({

      success: false,

      message: 'Server error while fetching collections',

      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'

    });

  }

};



module.exports = {

  getCollections,

  getAllCollections,

  getSalesCollection,

  getSalesItemsCollection,

  createCollection,

  updateCollectionState,

  getPrintCollections

}

