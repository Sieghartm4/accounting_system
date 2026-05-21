const os = require('os')

const {
  checkConnection,
  SelectAll,
  Query,
  Transaction,
} = require('../database/util/queries.util')

const {
  formatMemoryUsage,
  formatTime,
  DataModeling,
} = require('../util/helper.util')

const { Master } = require('../database/model/Master')

const { Accounting } = require('../database/model/Accounting')

const { SQLQueryBuilder } = require('../util/helper.util')

const sql = new SQLQueryBuilder()

require('dotenv').config()

const getBankReconciliations = async (req, res, next) => {
  try {
    const itemSummary = `(
      SELECT
        bri_br_id,
        COUNT(*) AS item_count,
        SUM(
          CASE
            WHEN bri_details IN ('deposits_in_transit', 'interest_income', 'credit_memo')
              THEN GREATEST(ABS(COALESCE(bri_debit, 0)), ABS(COALESCE(bri_credit, 0)))
            WHEN bri_details IN ('outstanding_checks', 'bank_charges', 'nsf_checks', 'debit_memo')
              THEN -GREATEST(ABS(COALESCE(bri_debit, 0)), ABS(COALESCE(bri_credit, 0)))
            WHEN bri_details IN ('error_bank', 'error_book')
              THEN COALESCE(bri_credit, 0) - COALESCE(bri_debit, 0)
            ELSE GREATEST(ABS(COALESCE(bri_debit, 0)), ABS(COALESCE(bri_credit, 0)))
          END
        ) AS bank_statement_balance
      FROM ${Accounting.bank_reconciliation_items.tablename}
      GROUP BY bri_br_id
    ) item_summary`
    const journalSummary = `(
      SELECT
        je_coa_id,
        SUM(
          CASE
            WHEN LOWER(je_type) = 'debit' THEN COALESCE(je_amount, 0)
            WHEN LOWER(je_type) = 'credit' THEN -COALESCE(je_amount, 0)
            ELSE 0
          END
        ) AS book_balance
      FROM ${Accounting.journal_entries.tablename}
      GROUP BY je_coa_id
    ) je_summary`

    const query = sql
      .select([
        { col: 'br.br_id', as: 'id' },
        { col: 'br.br_bank_account', as: 'bank_account' },
        { col: 'br.br_coa_id', as: 'charts_of_accounts_id' },
        { col: 'br.br_coa_id', as: 'coa_id' },
        { col: 'coa.coa_name', as: 'account_name' },
        {
          col: 'COALESCE(je_summary.book_balance, br.br_running_balance, 0)',
          as: 'running_balance',
        },
        {
          col: 'COALESCE(je_summary.book_balance, br.br_running_balance, 0)',
          as: 'book_balance',
        },
        {
          col: 'COALESCE(item_summary.bank_statement_balance, 0)',
          as: 'bank_statement_balance',
        },
        { col: 'COALESCE(item_summary.item_count, 0)', as: 'item_count' },
      ])
      .from(`${Accounting.bank_reconciliation.tablename} br`)
      .innerJoin(
        `${Master.charts_of_accounts.tablename} coa`,
        'br.br_coa_id',
        'coa.coa_id',
      )
      .leftJoin(itemSummary, 'item_summary.bri_br_id', 'br.br_id')
      .leftJoin(journalSummary, 'je_summary.je_coa_id', 'br.br_coa_id')
      .orderBy('br.br_id', 'DESC')
      .build()

    let reconciliations = await Query(query)

    console.log(`Fetched ${JSON.stringify(reconciliations)} bank reconciliations`)

    res.status(200).json({
      success: true,
      message: 'Bank reconciliations retrieved successfully',
      data: reconciliations,
      count: reconciliations.length,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error fetching bank reconciliations:', error)
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching bank reconciliations',
      error:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Internal server error',
    })
  }
}

const getBankReconciliationDetail = async (req, res, next) => {
  const { id } = req.params
  const { start_date, end_date } = req.query
  const reconciliationId = Number(id)
  console.log(`Fetching bank reconciliation detail for id=${reconciliationId}`)

  if (!Number.isInteger(reconciliationId) || reconciliationId <= 0) {
    return res.status(400).json({
      success: false,
      message: 'Invalid bank reconciliation id',
    })
  }

  try {
    const reconciliationQuery = sql
      .select([
        { col: Accounting.bank_reconciliation.selectOptionColumns.id, as: 'id' },
        {
          col: Accounting.bank_reconciliation.selectOptionColumns.bank_account,
          as: 'bank_account',
        },
        {
          col: Accounting.bank_reconciliation.selectOptionColumns.coa_id,
          as: 'coa_id',
        },
        {
          col: Accounting.bank_reconciliation.selectOptionColumns.running_balance,
          as: 'running_balance',
        },
      ])
      .from(Accounting.bank_reconciliation.tablename)
      .where(Accounting.bank_reconciliation.selectOptionColumns.id, '=', '?')
      .build()

    const reconciliationRows = await Query(reconciliationQuery, [reconciliationId])

    if (!reconciliationRows || reconciliationRows.length === 0) {
      console.error(`Bank reconciliation not found for id=${reconciliationId}`)
      return res.status(404).json({
        success: false,
        message: 'Bank reconciliation not found',
      })
    }

    const reconciliation = reconciliationRows[0]

    let accountName = null
    let accountCode = null

    if (reconciliation.coa_id) {
      const accountQuery = sql
        .select([
          { col: Master.charts_of_accounts.selectOptionColumns.code, as: 'code' },
          { col: Master.charts_of_accounts.selectOptionColumns.name, as: 'name' },
        ])
        .from(Master.charts_of_accounts.tablename)
        .where(Master.charts_of_accounts.selectOptionColumns.id, '=', '?')
        .build()
      const accountRows = await Query(accountQuery, [reconciliation.coa_id])
      if (accountRows && accountRows.length > 0) {
        accountCode = accountRows[0].code
        accountName = accountRows[0].name
      }
    }

    const itemWhere = [
      {
        column: Accounting.bank_reconciliation_items.selectOptionColumns.br_id,
        operator: '=',
        value: '?',
      },
    ]
    const itemValues = [reconciliationId]

    if (start_date) {
      itemWhere.push({
        column: Accounting.bank_reconciliation_items.selectOptionColumns.date,
        operator: '>=',
        value: '?',
      })
      itemValues.push(start_date)
    }

    if (end_date) {
      itemWhere.push({
        column: Accounting.bank_reconciliation_items.selectOptionColumns.date,
        operator: '<=',
        value: '?',
      })
      itemValues.push(end_date)
    }

    const itemsQuery = sql
      .select([
        {
          col: Accounting.bank_reconciliation_items.selectOptionColumns.id,
          as: 'id',
        },
        {
          col: Accounting.bank_reconciliation_items.selectOptionColumns.br_id,
          as: 'br_id',
        },
        {
          col: Accounting.bank_reconciliation_items.selectOptionColumns.date,
          as: 'date',
        },
        {
          col: Accounting.bank_reconciliation_items.selectOptionColumns.description,
          as: 'description',
        },
        {
          col: Accounting.bank_reconciliation_items.selectOptionColumns
            .reference_number,
          as: 'reference_number',
        },
        {
          col: Accounting.bank_reconciliation_items.selectOptionColumns.details,
          as: 'details',
        },
        {
          col: Accounting.bank_reconciliation_items.selectOptionColumns.debit,
          as: 'debit',
        },
        {
          col: Accounting.bank_reconciliation_items.selectOptionColumns.credit,
          as: 'credit',
        },
        {
          col: Accounting.bank_reconciliation_items.selectOptionColumns.balance,
          as: 'balance',
        },
        {
          col: Accounting.bank_reconciliation_items.selectOptionColumns.created_by,
          as: 'created_by',
        },
      ])
      .from(Accounting.bank_reconciliation_items.tablename)
      .where(itemWhere)
      .orderBy(Accounting.bank_reconciliation_items.selectOptionColumns.date, 'ASC')
      .orderBy(Accounting.bank_reconciliation_items.selectOptionColumns.id, 'ASC')
      .build()

    const items = await Query(itemsQuery, itemValues)

    console.log(`Fetched ${items.length} bank reconciliation items`)
    res.status(200).json({
      success: true,
      message: 'Bank reconciliation detail retrieved successfully',
      data: {
        ...reconciliation,
        account_name: accountName,
        account_code: accountCode,
        items: items || [],
      },
      startDate: start_date || null,
      endDate: end_date || null,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error fetching bank reconciliation detail:', error)
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching bank reconciliation detail',
      error:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Internal server error',
    })
  }
}

const createBankReconciliation = async (req, res, next) => {
  try {
    const { bank_account, coa_id } = req.body

    if (!bank_account || !coa_id) {
      return res.status(400).json({
        success: false,
        message: 'Bank account and COA ID are required',
      })
    }

    try {
      const queries = [
        {
          sql: sql
            .insert(Accounting.bank_reconciliation.tablename, {
              columns: Accounting.bank_reconciliation.insertColumns,
              prefix: Accounting.bank_reconciliation.prefix,
              isTransaction: true,
            })
            .build(),
          values: [bank_account || null, coa_id || null, 0.0],
        },
      ]

      await Transaction(queries)

      const idQuery = sql
        .select([{ col: 'MAX(br_id)', as: 'id' }])
        .from(Accounting.bank_reconciliation.tablename)
        .build()
      const idResult = await Query(idQuery)
      const reconciliationId = idResult[0]?.id

      res.status(201).json({
        success: true,
        message: 'Bank reconciliation created successfully',
        data: {
          id: reconciliationId,
          bank_account,
          coa_id,
          running_balance: 0.0,
        },
        timestamp: new Date().toISOString(),
      })
    } catch (error) {
      throw error
    }
  } catch (error) {
    console.error('Error creating bank reconciliation:', error)
    return res.status(500).json({
      success: false,
      message: 'Server error while creating bank reconciliation',
      error:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Internal server error',
    })
  }
}

const addBankReconciliationItem = async (req, res, next) => {
  try {
    const {
      br_id,
      date,
      description,
      reference_number,
      details,
      debit,
      credit,
      balance,
    } = req.body

    // Get current user from request (set by auth middleware)
    const created_by = req.user?.name || req.user?.username || 'system'

    if (!br_id || !date) {
      return res.status(400).json({
        success: false,
        message: 'BR ID and date are required',
      })
    }

    try {
      const itemValues = [
        br_id || null,
        date || null,
        description || null,
        reference_number || null,
        typeof details !== 'undefined' ? details : null,
        parseFloat(debit) || 0,
        parseFloat(credit) || 0,
        parseFloat(balance) || 0,
        created_by,
      ]

      const queries = [
        {
          sql: sql
            .insert(Accounting.bank_reconciliation_items.tablename, {
              columns: Accounting.bank_reconciliation_items.insertColumns,
              prefix: Accounting.bank_reconciliation_items.prefix,
              isTransaction: true,
            })
            .build(),
          values: itemValues,
        },
      ]

      await Transaction(queries)

      const idQuery = sql
        .select([{ col: 'MAX(bri_id)', as: 'id' }])
        .from(Accounting.bank_reconciliation_items.tablename)
        .build()
      const idResult = await Query(idQuery)
      const itemId = idResult[0]?.id

      res.status(201).json({
        success: true,
        message: 'Bank reconciliation item added successfully',
        data: {
          id: itemId,
          br_id,
          date,
          description,
          reference_number,
          details: typeof details !== 'undefined' ? details : null,
          debit: parseFloat(debit) || 0,
          credit: parseFloat(credit) || 0,
          balance: parseFloat(balance) || 0,
          created_by,
        },
        timestamp: new Date().toISOString(),
      })
    } catch (error) {
      throw error
    }
  } catch (error) {
    console.error('Error adding bank reconciliation item:', error)
    return res.status(500).json({
      success: false,
      message: 'Server error while adding bank reconciliation item',
      error:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Internal server error',
    })
  }
}

const updateBankReconciliationItem = async (req, res, next) => {
  try {
    const { id } = req.params
    const { date, description, reference_number, details, debit, credit, balance } =
      req.body

    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Item ID is required',
      })
    }

    try {
      // Build update query dynamically based on new schema
      const updateColumns = []
      const updateValues = []

      if (date !== undefined) {
        updateColumns.push('bri_date')
        updateValues.push(date)
      }
      if (description !== undefined) {
        updateColumns.push('bri_description')
        updateValues.push(description)
      }
      if (reference_number !== undefined) {
        updateColumns.push('bri_reference_number')
        updateValues.push(reference_number)
      }
      if (details !== undefined) {
        updateColumns.push('bri_details')
        updateValues.push(details)
      }
      if (debit !== undefined) {
        updateColumns.push('bri_debit')
        updateValues.push(parseFloat(debit) || 0)
      }
      if (credit !== undefined) {
        updateColumns.push('bri_credit')
        updateValues.push(parseFloat(credit) || 0)
      }
      if (balance !== undefined) {
        updateColumns.push('bri_balance')
        updateValues.push(parseFloat(balance) || 0)
      }

      if (updateColumns.length === 0) {
        return res
          .status(400)
          .json({ success: false, message: 'No fields to update' })
      }

      const existingQuery = sql
        .select([
          {
            col: Accounting.bank_reconciliation_items.selectOptionColumns.id,
            as: 'id',
          },
        ])
        .from(Accounting.bank_reconciliation_items.tablename)
        .where(Accounting.bank_reconciliation_items.selectOptionColumns.id, '=', '?')
        .build()
      const existingItems = await Query(existingQuery, [id])

      if (!existingItems || existingItems.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Bank reconciliation item not found',
        })
      }

      updateValues.push(id)

      const updateQuery = sql
        .update(Accounting.bank_reconciliation_items.tablename)
        .set(updateColumns)
        .where(Accounting.bank_reconciliation_items.selectOptionColumns.id, '=', '?')
        .build()

      const queries = [
        {
          sql: updateQuery,
          values: updateValues,
        },
      ]

      await Transaction(queries)

      res.status(200).json({
        success: true,
        message: 'Bank reconciliation item updated successfully',
        data: {
          id,
          date,
          description,
          reference_number,
          details,
          debit: debit !== undefined ? parseFloat(debit) : undefined,
          credit: credit !== undefined ? parseFloat(credit) : undefined,
          balance: balance !== undefined ? parseFloat(balance) : undefined,
        },
        timestamp: new Date().toISOString(),
      })
    } catch (error) {
      throw error
    }
  } catch (error) {
    console.error('Error updating bank reconciliation item:', error)
    return res.status(500).json({
      success: false,
      message: 'Server error while updating bank reconciliation item',
      error:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Internal server error',
    })
  }
}

const updateBankReconciliationBalance = async (req, res, next) => {
  try {
    const { id } = req.params
    const { running_balance } = req.body

    if (!id || running_balance === undefined) {
      return res.status(400).json({
        success: false,
        message: 'BR ID and running balance are required',
      })
    }

    try {
      const existingQuery = sql
        .select([
          { col: Accounting.bank_reconciliation.selectOptionColumns.id, as: 'id' },
        ])
        .from(Accounting.bank_reconciliation.tablename)
        .where(Accounting.bank_reconciliation.selectOptionColumns.id, '=', '?')
        .build()
      const existingReconciliations = await Query(existingQuery, [id])

      if (!existingReconciliations || existingReconciliations.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Bank reconciliation not found',
        })
      }

      const updateQuery = sql
        .update(Accounting.bank_reconciliation.tablename)
        .set([Accounting.bank_reconciliation.selectOptionColumns.running_balance])
        .where(Accounting.bank_reconciliation.selectOptionColumns.id, '=', '?')
        .build()

      const queries = [
        {
          sql: updateQuery,
          values: [running_balance, id],
        },
      ]

      await Transaction(queries)

      res.status(200).json({
        success: true,
        message: 'Bank reconciliation balance updated successfully',
        data: {
          id,
          running_balance,
        },
        timestamp: new Date().toISOString(),
      })
    } catch (error) {
      throw error
    }
  } catch (error) {
    console.error('Error updating bank reconciliation balance:', error)
    return res.status(500).json({
      success: false,
      message: 'Server error while updating bank reconciliation balance',
      error:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Internal server error',
    })
  }
}

module.exports = {
  getBankReconciliations,
  getBankReconciliationDetail,
  createBankReconciliation,
  addBankReconciliationItem,
  updateBankReconciliationItem,
  updateBankReconciliationBalance,
}
