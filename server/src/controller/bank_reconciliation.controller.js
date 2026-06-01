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

const hasBankStatementBalanceColumn = async () => {
  const rows = await Query(
    `SHOW COLUMNS FROM ${Accounting.bank_reconciliation.tablename} LIKE 'br_bank_statement_balance'`,
  )

  return Array.isArray(rows) && rows.length > 0
}

const getBankReconciliations = async (req, res, next) => {
  try {
    const itemSummary = `(
      SELECT
        bri_br_id,
        COUNT(*) AS item_count
        ,
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

    const hasBankStatementBalance = await hasBankStatementBalanceColumn()

    const bankStatementBalanceSelect = hasBankStatementBalance
      ? 'COALESCE(br.br_bank_statement_balance, item_summary.bank_statement_balance, 0)'
      : 'COALESCE(item_summary.bank_statement_balance, 0)'

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
          col: bankStatementBalanceSelect,

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
    const hasBankStatementBalance = await hasBankStatementBalanceColumn()

    const reconciliationSelect = [
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
    ]

    if (hasBankStatementBalance) {
      reconciliationSelect.splice(3, 0, {
        col: Accounting.bank_reconciliation.selectOptionColumns
          .bank_statement_balance,

        as: 'bank_statement_balance',
      })
    }

    const reconciliationQuery = sql

      .select(reconciliationSelect)

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

    let computedBankStatementBalance = 0

    if (!hasBankStatementBalance) {
      const statementBalanceQuery = `
        SELECT
          COALESCE(
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
            ),
            0
          ) AS bank_statement_balance
        FROM ${Accounting.bank_reconciliation_items.tablename}
        WHERE ${Accounting.bank_reconciliation_items.selectOptionColumns.br_id} = ?
          ${start_date ? `AND ${Accounting.bank_reconciliation_items.selectOptionColumns.date} >= ?` : ''}
          ${end_date ? `AND ${Accounting.bank_reconciliation_items.selectOptionColumns.date} <= ?` : ''}
      `

      const statementBalanceValues = [
        reconciliationId,

        ...(start_date ? [start_date] : []),

        ...(end_date ? [end_date] : []),
      ]

      const balanceRows = await Query(statementBalanceQuery, statementBalanceValues)

      computedBankStatementBalance = parseFloat(
        balanceRows?.[0]?.bank_statement_balance || 0,
      )
    }

    res.status(200).json({
      success: true,

      message: 'Bank reconciliation detail retrieved successfully',

      data: {
        ...reconciliation,

        bank_statement_balance: hasBankStatementBalance
          ? parseFloat(reconciliation.bank_statement_balance || 0)
          : computedBankStatementBalance,

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
    const { bank_account, coa_id, bank_statement_balance } = req.body

    if (!bank_account || !coa_id) {
      return res.status(400).json({
        success: false,

        message: 'Bank account and COA ID are required',
      })
    }

    try {
      const hasBankStatementBalance = await hasBankStatementBalanceColumn()

      const queries = [
        {
          sql: sql

            .insert(Accounting.bank_reconciliation.tablename, {
              columns: hasBankStatementBalance
                ? Accounting.bank_reconciliation.insertColumns
                : ['bank_account', 'coa_id', 'running_balance'],

              prefix: Accounting.bank_reconciliation.prefix,

              isTransaction: true,
            })

            .build(),

          values: hasBankStatementBalance
            ? [
                bank_account || null,
                coa_id || null,
                parseFloat(bank_statement_balance) || 0.0,
                0.0,
              ]
            : [bank_account || null, coa_id || null, 0.0],
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

          bank_statement_balance: parseFloat(bank_statement_balance) || 0.0,

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

const updateBankReconciliationBankStatementBalance = async (req, res, next) => {
  try {
    const { id } = req.params

    const { bank_statement_balance } = req.body

    if (!id || bank_statement_balance === undefined) {
      return res.status(400).json({
        success: false,

        message: 'BR ID and bank statement balance are required',
      })
    }

    const hasBankStatementBalance = await hasBankStatementBalanceColumn()

    if (!hasBankStatementBalance) {
      return res.status(400).json({
        success: false,

        message:
          'Bank statement balance column is not available. Please run database migrations for this tenant database.',
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

        .set([
          Accounting.bank_reconciliation.selectOptionColumns.bank_statement_balance,
        ])

        .where(Accounting.bank_reconciliation.selectOptionColumns.id, '=', '?')

        .build()

      const queries = [
        {
          sql: updateQuery,

          values: [bank_statement_balance, id],
        },
      ]

      await Transaction(queries)

      res.status(200).json({
        success: true,

        message: 'Bank statement balance updated successfully',

        data: {
          id,

          bank_statement_balance,
        },

        timestamp: new Date().toISOString(),
      })
    } catch (error) {
      throw error
    }
  } catch (error) {
    console.error('Error updating bank statement balance:', error)

    return res.status(500).json({
      success: false,

      message: 'Server error while updating bank statement balance',

      error:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Internal server error',
    })
  }
}

const addAdjustmentBalance = async (req, res, next) => {
  try {
    const {
      br_id,

      date,

      type,

      description,

      amount,

      side,
    } = req.body

    // Get current user from request (set by auth middleware)

    const created_by = req.user?.name || req.user?.username || 'system'

    if (!br_id || !date || !type || !amount || !side) {
      return res.status(400).json({
        success: false,

        message: 'BR ID, date, type, amount, and side are required',
      })
    }

    try {
      const adjustmentValues = [
        br_id || null,

        date || null,

        type || null,

        description || null,

        parseFloat(amount) || 0,

        side || null,

        created_by,
      ]

      const queries = [
        {
          sql: sql

            .insert(Accounting.adjustment_balance.tablename, {
              columns: Accounting.adjustment_balance.insertColumns,

              prefix: Accounting.adjustment_balance.prefix,

              isTransaction: true,
            })

            .build(),

          values: adjustmentValues,
        },
      ]

      await Transaction(queries)

      const idQuery = sql

        .select([{ col: 'MAX(ab_id)', as: 'id' }])

        .from(Accounting.adjustment_balance.tablename)

        .build()

      const idResult = await Query(idQuery)

      const adjustmentId = idResult[0]?.id

      res.status(201).json({
        success: true,

        message: 'Adjustment balance added successfully',

        data: {
          id: adjustmentId,

          br_id,

          date,

          type,

          description,

          amount: parseFloat(amount) || 0,

          side,

          created_by,
        },

        timestamp: new Date().toISOString(),
      })
    } catch (error) {
      throw error
    }
  } catch (error) {
    console.error('Error adding adjustment balance:', error)

    return res.status(500).json({
      success: false,

      message: 'Server error while adding adjustment balance',

      error:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Internal server error',
    })
  }
}

const createBankReconciliationSummary = async (req, res, next) => {
  try {
    const {
      br_id,
      start_date,
      end_date,
      adjusted_bank_balance,
      adjusted_book_balance,
      final_output,
    } = req.body

    const created_by = req.user?.name || req.user?.username || 'system'
    const created_date = new Date()

    if (
      !br_id ||
      !start_date ||
      !end_date ||
      adjusted_bank_balance === undefined ||
      adjusted_book_balance === undefined
    ) {
      return res.status(400).json({
        success: false,
        message:
          'BR ID, start date, end date, adjusted bank balance, and adjusted book balance are required',
      })
    }

    const summaryValues = [
      br_id || null,
      start_date || null,
      end_date || null,
      parseFloat(adjusted_bank_balance) || 0,
      parseFloat(adjusted_book_balance) || 0,
      final_output || null,
      created_by,
      created_date,
    ]

    const queries = [
      {
        sql: sql
          .insert(Accounting.bank_reconciliation_summary.tablename, {
            columns: Accounting.bank_reconciliation_summary.insertColumns,
            prefix: Accounting.bank_reconciliation_summary.prefix,
            isTransaction: true,
          })
          .build(),
        values: summaryValues,
      },
    ]

    await Transaction(queries)

    const idQuery = sql
      .select([{ col: 'MAX(brs_id)', as: 'id' }])
      .from(Accounting.bank_reconciliation_summary.tablename)
      .build()
    const idResult = await Query(idQuery)
    const summaryId = idResult[0]?.id

    return res.status(201).json({
      success: true,
      message: 'Bank reconciliation summary saved successfully',
      data: {
        id: summaryId,
        br_id,
        start_date,
        end_date,
        adjusted_bank_balance,
        adjusted_book_balance,
        final_output,
        prepared_by: created_by,
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error creating bank reconciliation summary:', error)
    return res.status(500).json({
      success: false,
      message: 'Server error while saving bank reconciliation summary',
      error:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Internal server error',
    })
  }
}

const getAdjustmentBalances = async (req, res, next) => {
  const { id } = req.params

  const { start_date, end_date } = req.query

  const reconciliationId = Number(id)

  console.log(
    `Fetching adjustment balances for reconciliation id=${reconciliationId}`,
  )

  if (!Number.isInteger(reconciliationId) || reconciliationId <= 0) {
    return res.status(400).json({
      success: false,

      message: 'Invalid bank reconciliation id',
    })
  }

  try {
    const where = [
      {
        column: Accounting.adjustment_balance.selectOptionColumns.br_id,

        operator: '=',

        value: '?',
      },
    ]

    const values = [reconciliationId]

    if (start_date) {
      where.push({
        column: Accounting.adjustment_balance.selectOptionColumns.date,

        operator: '>=',

        value: '?',
      })

      values.push(start_date)
    }

    if (end_date) {
      where.push({
        column: Accounting.adjustment_balance.selectOptionColumns.date,

        operator: '<=',

        value: '?',
      })

      values.push(end_date)
    }

    const adjustmentsQuery = sql

      .select([
        {
          col: Accounting.adjustment_balance.selectOptionColumns.id,

          as: 'id',
        },

        {
          col: Accounting.adjustment_balance.selectOptionColumns.br_id,

          as: 'br_id',
        },

        {
          col: Accounting.adjustment_balance.selectOptionColumns.date,

          as: 'date',
        },

        {
          col: Accounting.adjustment_balance.selectOptionColumns.type,

          as: 'type',
        },

        {
          col: Accounting.adjustment_balance.selectOptionColumns.description,

          as: 'description',
        },

        {
          col: Accounting.adjustment_balance.selectOptionColumns.amount,

          as: 'amount',
        },

        {
          col: Accounting.adjustment_balance.selectOptionColumns.side,

          as: 'side',
        },

        {
          col: Accounting.adjustment_balance.selectOptionColumns.created_by,

          as: 'created_by',
        },
      ])

      .from(Accounting.adjustment_balance.tablename)

      .where(where)

      .orderBy(Accounting.adjustment_balance.selectOptionColumns.date, 'ASC')

      .orderBy(Accounting.adjustment_balance.selectOptionColumns.id, 'ASC')

      .build()

    const adjustments = await Query(adjustmentsQuery, values)

    console.log(`Fetched ${adjustments.length} adjustment balances`)

    res.status(200).json({
      success: true,

      message: 'Adjustment balances retrieved successfully',

      data: adjustments || [],

      startDate: start_date || null,

      endDate: end_date || null,

      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error fetching adjustment balances:', error)

    return res.status(500).json({
      success: false,

      message: 'Server error while fetching adjustment balances',

      error:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Internal server error',
    })
  }
}

const deleteAdjustmentBalance = async (req, res, next) => {
  try {
    const { id } = req.params

    const adjustmentId = Number(id)

    if (!Number.isInteger(adjustmentId) || adjustmentId <= 0) {
      return res.status(400).json({
        success: false,

        message: 'Invalid adjustment balance id',
      })
    }

    try {
      const existingQuery = sql

        .select([
          {
            col: Accounting.adjustment_balance.selectOptionColumns.id,

            as: 'id',
          },
        ])

        .from(Accounting.adjustment_balance.tablename)

        .where(Accounting.adjustment_balance.selectOptionColumns.id, '=', '?')

        .build()

      const existingAdjustments = await Query(existingQuery, [adjustmentId])

      if (!existingAdjustments || existingAdjustments.length === 0) {
        return res.status(404).json({
          success: false,

          message: 'Adjustment balance not found',
        })
      }

      const deleteQuery = sql

        .delete(Accounting.adjustment_balance.tablename)

        .where(Accounting.adjustment_balance.selectOptionColumns.id, '=', '?')

        .build()

      const queries = [
        {
          sql: deleteQuery,

          values: [adjustmentId],
        },
      ]

      await Transaction(queries)

      res.status(200).json({
        success: true,

        message: 'Adjustment balance deleted successfully',

        data: {
          id: adjustmentId,
        },

        timestamp: new Date().toISOString(),
      })
    } catch (error) {
      throw error
    }
  } catch (error) {
    console.error('Error deleting adjustment balance:', error)

    return res.status(500).json({
      success: false,

      message: 'Server error while deleting adjustment balance',

      error:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Internal server error',
    })
  }
}

const getAvailableSummaryMonths = async (req, res, next) => {
  try {
    const { id } = req.params
    const reconciliationId = Number(id)

    if (!Number.isInteger(reconciliationId) || reconciliationId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid bank reconciliation id',
      })
    }

    const query = sql
      .select([
        {
          col: Accounting.bank_reconciliation_summary.selectOptionColumns.start_date,
          as: 'start_date',
        },
        {
          col: Accounting.bank_reconciliation_summary.selectOptionColumns.end_date,
          as: 'end_date',
        },
      ])
      .from(Accounting.bank_reconciliation_summary.tablename)
      .where(
        Accounting.bank_reconciliation_summary.selectOptionColumns.br_id,
        '=',
        '?',
      )
      .orderBy(
        Accounting.bank_reconciliation_summary.selectOptionColumns.start_date,
        'DESC',
      )
      .build()

    const months = await Query(query, [reconciliationId])

    const monthsFormatted = months.map((m) => ({
      start_date: m.start_date,
      end_date: m.end_date,
      label: new Date(m.start_date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
      }),
    }))

    return res.status(200).json({
      success: true,
      data: monthsFormatted,
    })
  } catch (error) {
    console.error('Error fetching available summary months:', error)
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching available summary months',
      error:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Internal server error',
    })
  }
}

const getBankReconciliationSummary = async (req, res, next) => {
  try {
    const { id } = req.params
    const { start_date, end_date } = req.query
    const reconciliationId = Number(id)

    if (!Number.isInteger(reconciliationId) || reconciliationId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid bank reconciliation id',
      })
    }

    if (!start_date || !end_date) {
      return res.status(400).json({
        success: false,
        message: 'Summary start date and end date are required',
      })
    }

    const query = `
      SELECT
        brs_id AS id,
        brs_br_id AS br_id,
        brs_start_date AS start_date,
        brs_end_date AS end_date,
        brs_adjusted_bank_balance AS adjusted_bank_balance,
        brs_adjusted_book_balance AS adjusted_book_balance,
        brs_final_output AS final_output,
        brs_prepared_by AS prepared_by,
        brs_created_date AS created_date
      FROM ${Accounting.bank_reconciliation_summary.tablename}
      WHERE brs_br_id = ?
        AND brs_start_date = ?
        AND brs_end_date = ?
      LIMIT 1
    `

    const summaries = await Query(query, [reconciliationId, start_date, end_date])
    const summary = summaries?.[0]

    if (!summary) {
      return res.status(404).json({
        success: false,
        message: 'No summary found for selected period',
      })
    }

    return res.status(200).json({
      success: true,
      data: summary,
    })
  } catch (error) {
    console.error('Error fetching bank reconciliation summary:', error)
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching bank reconciliation summary',
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

  updateBankReconciliationBankStatementBalance,

  addAdjustmentBalance,

  createBankReconciliationSummary,

  getBankReconciliationSummary,

  getAdjustmentBalances,

  deleteAdjustmentBalance,

  getAvailableSummaryMonths,
}
