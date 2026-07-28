const os = require('os')
const { checkConnection, SelectAll, Transaction, Query, Insert } = require('../database/util/queries.util')
const { formatMemoryUsage, formatTime, DataModeling } = require('../util/helper.util')
const { Master } = require('../database/model/Master')
const { SQLQueryBuilder } = require('../util/helper.util')
const { getTenantPool } = require('../database/util/tenantConnection.util')
const sql = new SQLQueryBuilder()

require('dotenv').config()

const getProformaEntries = async (req, res, next) => {
  try {
    const query = sql.select([
      { col: Master.proforma_entries.selectOptionColumns.id, as: 'id' },
      { col: Master.proforma_entries.selectOptionColumns.module, as: 'module' },
      { col: Master.proforma_entries.selectOptionColumns.name, as: 'name' },
      { col: Master.charts_of_accounts.selectOptionColumns.name, as: 'charts_of_accounts' },
      { col: Master.proforma_entries.selectOptionColumns.t_account, as: 't_account' },
    ])
      .from(Master.proforma_entries.tablename)
      .innerJoin(Master.charts_of_accounts.tablename, Master.proforma_entries.selectOptionColumns.coa_id, Master.charts_of_accounts.selectOptionColumns.id)
      .build();

    let proforma_entries = await Query(query, [], [Master.proforma_entries.prefix_, Master.charts_of_accounts.prefix_]);
    res.status(200).json({
      success: true,
      message: 'Proforma entries retrieved successfully',
      data: proforma_entries,
      count: proforma_entries.length,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error fetching proforma entries:', error)
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching proforma entries',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    })
  }
}

const createProformaEntries = async (req, res, next) => {
    try {
        const { module, name, coa_id, t_account } = req.body;

        if (!module || !name || !coa_id || !t_account) {
            return res.status(400).json({
                success: false,
                message: 'Module, name, COA ID and T-account are required'
            });
        }
        
        let queries = []
        
        queries.push({
            sql: sql.insert(Master.proforma_entries.tablename, {
                columns: Master.proforma_entries.insertColumns,
                prefix: Master.proforma_entries.prefix,
                isTransaction: true
            })
                .build(),
            values: [
                module || null,
                name || null,
                coa_id || null,
                t_account || null
            ]
        });

        let result = await Transaction(queries);

        const getIdQuery = `SELECT LAST_INSERT_ID() as insertId`;
        const idResult = await Query(getIdQuery);
        const newProductId = idResult[0]?.insertId;

        if (!newProductId) {
            throw new Error('Failed to get proforma entry ID from insertion');
        }

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
                newProductId || null,
                'PROFORMA_ENTRIES',
                req.context?.username || null,
                now.toISOString().split('T')[0],
                now.toTimeString().split(' ')[0],
                `CREATE: ID ${newProductId}`
            ]
        });
        await Transaction(auditQueries);

        res.status(201).json({
            success: true,
            message: 'Proforma entry created successfully',
            data: {
                id: newProductId,
                module: module,
                name: name,
                coa_id: coa_id,
                t_account: t_account
            },
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Error creating proforma entry:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error while creating proforma entry',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
}

const updateProformaEntries = async (req, res, next) => {
  try {
    const { id: idFromBody, module, name, coa_id, t_account } = req.body;
    const { id: idFromParams } = req.params;
    const id = Number(idFromParams || idFromBody);

    if (!id || !module || !name || !coa_id || !t_account) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }

    // Fetch existing proforma entry to compare changes
    const existingQuery = sql.select([Master.proforma_entries.selectOptionColumns.module, Master.proforma_entries.selectOptionColumns.name, Master.proforma_entries.selectOptionColumns.coa_id, Master.proforma_entries.selectOptionColumns.t_account])
      .from(Master.proforma_entries.tablename)
      .where(Master.proforma_entries.selectOptionColumns.id)
      .build();
    const existingEntries = await Query(existingQuery, [id], Master.proforma_entries.prefix_);
    const old = existingEntries[0] || {};

    const updateQuery = sql.update(Master.proforma_entries.tablename)
      .set([
        Master.proforma_entries.selectOptionColumns.module,
        Master.proforma_entries.selectOptionColumns.name,
        Master.proforma_entries.selectOptionColumns.coa_id,
        Master.proforma_entries.selectOptionColumns.t_account,
      ])
      .where(Master.proforma_entries.selectOptionColumns.id)
      .build();

    const queries = [
      {
        sql: updateQuery,
        values: [module, name, coa_id, t_account, id]
      }
    ];

    await Transaction(queries);

    // Build change description - only include changed columns with new values
    const changes = [];
    if (old.module !== module) changes.push(`module='${module}'`);
    if (old.name !== name) changes.push(`name='${name}'`);
    if (old.coa_id !== coa_id) changes.push(`coa_id='${coa_id}'`);
    if (old.t_account !== t_account) changes.push(`t_account='${t_account}'`);
    const changeDesc = changes.length > 0 ? changes.join(', ') : 'no changes';

    // Audit trail for update
    const now = new Date();
    const auditQueries = [];
    auditQueries.push({
        sql: sql.insert(Master.audit_trail.tablename, {
            columns: Master.audit_trail.insertColumns,
            prefix: Master.audit_trail.prefix,
            isTransaction: true
        }).build(),
        values: [
            id || null,
            'PROFORMA_ENTRIES',
            req.context?.username || null,
            now.toISOString().split('T')[0],
            now.toTimeString().split(' ')[0],
            `UPDATE ID ${id}: ${changeDesc}`
        ]
    });
    await Transaction(auditQueries);

    res.status(200).json({
      success: true,
      message: 'Proforma entry updated successfully',
      data: { id, module, name, coa_id, t_account },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error updating proforma entry:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while updating proforma entry',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
}

const importProformaEntries = async (req, res, next) => {
  try {
    const { entries } = req.body

    if (!Array.isArray(entries) || entries.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Entries array is required',
      })
    }

    const results = {
      created: [],
      updated: [],
      errors: [],
    }

    const now = new Date()
    const auditQueries = []

    for (const entry of entries) {
      try {
        const { id, module, name, coa_id, t_account } = entry

        // Validate required fields
        if (!module || !name || !coa_id || !t_account) {
          results.errors.push({
            entry,
            message: 'Missing required fields (module, name, coa_id, t_account)',
          })
          continue
        }

        // Check if entry exists by ID
        let existingEntry = null
        if (id) {
          const existingQuery = sql
            .select([
              Master.proforma_entries.selectOptionColumns.id,
              Master.proforma_entries.selectOptionColumns.module,
              Master.proforma_entries.selectOptionColumns.name,
              Master.proforma_entries.selectOptionColumns.coa_id,
              Master.proforma_entries.selectOptionColumns.t_account,
            ])
            .from(Master.proforma_entries.tablename)
            .where(Master.proforma_entries.selectOptionColumns.id)
            .build()
          const existingEntries = await Query(
            existingQuery,
            [id],
            Master.proforma_entries.prefix_,
          )
          existingEntry = existingEntries[0] || null
        }

        if (existingEntry) {
          // Update existing entry
          const updateQuery = sql
            .update(Master.proforma_entries.tablename)
            .set([
              Master.proforma_entries.selectOptionColumns.module,
              Master.proforma_entries.selectOptionColumns.name,
              Master.proforma_entries.selectOptionColumns.coa_id,
              Master.proforma_entries.selectOptionColumns.t_account,
            ])
            .where(Master.proforma_entries.selectOptionColumns.id)
            .build()

          const queries = [
            {
              sql: updateQuery,
              values: [module, name, coa_id, t_account, existingEntry.id],
            },
          ]

          await Transaction(queries)

          // Build change description
          const changes = []
          if (existingEntry.module !== module) changes.push(`module='${module}'`)
          if (existingEntry.name !== name) changes.push(`name='${name}'`)
          if (existingEntry.coa_id !== coa_id) changes.push(`coa_id='${coa_id}'`)
          if (existingEntry.t_account !== t_account) changes.push(`t_account='${t_account}'`)
          const changeDesc = changes.length > 0 ? changes.join(', ') : 'no changes'

          // Audit trail for update
          auditQueries.push({
            sql: sql
              .insert(Master.audit_trail.tablename, {
                columns: Master.audit_trail.insertColumns,
                prefix: Master.audit_trail.prefix,
                isTransaction: true,
              })
              .build(),
            values: [
              existingEntry.id || null,
              'PROFORMA_ENTRIES',
              req.context?.username || null,
              now.toISOString().split('T')[0],
              now.toTimeString().split(' ')[0],
              `IMPORT UPDATE ID ${existingEntry.id}: ${changeDesc}`,
            ],
          })

          results.updated.push({
            id: existingEntry.id,
            module,
            name,
          })
        } else {
          // Create new entry
          const insertQuery = sql
            .insert(Master.proforma_entries.tablename, {
              columns: Master.proforma_entries.insertColumns,
              prefix: Master.proforma_entries.prefix,
              isTransaction: true,
            })
            .build()

          const queries = [
            {
              sql: insertQuery,
              values: [module, name, coa_id, t_account],
            },
          ]

          await Transaction(queries)

          const getIdQuery = `SELECT LAST_INSERT_ID() as insertId`
          const idResult = await Query(getIdQuery)
          const newEntryId = idResult[0]?.insertId

          if (!newEntryId) {
            throw new Error('Failed to get proforma entry ID from insertion')
          }

          // Audit trail for create
          auditQueries.push({
            sql: sql
              .insert(Master.audit_trail.tablename, {
                columns: Master.audit_trail.insertColumns,
                prefix: Master.audit_trail.prefix,
                isTransaction: true,
              })
              .build(),
            values: [
              newEntryId || null,
              'PROFORMA_ENTRIES',
              req.context?.username || null,
              now.toISOString().split('T')[0],
              now.toTimeString().split(' ')[0],
              `IMPORT CREATE: ID ${newEntryId}`,
            ],
          })

          results.created.push({
            id: newEntryId,
            module,
            name,
          })
        }
      } catch (error) {
        console.error('Error processing entry:', entry, error)
        results.errors.push({
          entry,
          message: error.message || 'Failed to process entry',
        })
      }
    }

    // Execute all audit trail queries in a single transaction
    if (auditQueries.length > 0) {
      await Transaction(auditQueries)
    }

    res.status(200).json({
      success: true,
      message: `Import completed: ${results.created.length} created, ${results.updated.length} updated, ${results.errors.length} errors`,
      data: results,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error importing proforma entries:', error)
    return res.status(500).json({
      success: false,
      message: 'Server error while importing proforma entries',
      error:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Internal server error',
    })
  }
}

module.exports = {
  getProformaEntries,
  createProformaEntries,
  updateProformaEntries,
  importProformaEntries,
}
