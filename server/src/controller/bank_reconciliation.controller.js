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

const { getTenantPool } = require('../database/util/tenantConnection.util')

const sql = new SQLQueryBuilder()

require('dotenv').config()

const getBankReconciliations = async (req, res, next) => {
  try {
    const query = sql
      .select([
        { col: Accounting.bank_reconciliation.selectOptionColumns.id, as: 'id' },
        {
          col: Accounting.bank_reconciliation.selectOptionColumns.bank_account,
          as: 'bank_account',
        },
        {
          col: Accounting.bank_reconciliation.selectOptionColumns.coa_id,
          as: 'charts_of_accounts_id',
        },
        {
          col: Master.charts_of_accounts.selectOptionColumns.name,
          as: 'account_name',
        },
        {
          col: Accounting.bank_reconciliation.selectOptionColumns.running_balance,
          as: 'running_balance',
        },
      ])
      .from(Accounting.bank_reconciliation.tablename)
      .innerJoin(
        Master.charts_of_accounts.tablename,
        Accounting.bank_reconciliation.selectOptionColumns.coa_id,
        Master.charts_of_accounts.selectOptionColumns.id,
      )
      .build()

    let reconciliations = await Query(
      query,
      [],
      [Accounting.bank_reconciliation.prefix_, Master.charts_of_accounts.prefix_],
    )

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
    const reconciliationQuery = `
      SELECT
        br_id AS id,
        br_bank_account AS bank_account,
        br_coa_id AS coa_id,
        br_running_balance AS running_balance
      FROM ${Accounting.bank_reconciliation.tablename}
      WHERE br_id = ?
    `

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
      const accountQuery = `
        SELECT coa_code AS code, coa_name AS name
        FROM ${Master.charts_of_accounts.tablename}
        WHERE ${Master.charts_of_accounts.selectOptionColumns.id} = ?
      `
      const accountRows = await Query(accountQuery, [reconciliation.coa_id])
      if (accountRows && accountRows.length > 0) {
        accountCode = accountRows[0].code
        accountName = accountRows[0].name
      }
    }

    const itemWhere = ['bri_br_id = ?']
    const itemValues = [reconciliationId]

    if (start_date) {
      itemWhere.push('bri_date >= ?')
      itemValues.push(start_date)
    }

    if (end_date) {
      itemWhere.push('bri_date <= ?')
      itemValues.push(end_date)
    }

    const itemsQuery = `
      SELECT
        bri_id AS id,
        bri_br_id AS br_id,
        bri_date AS date,
        bri_description AS description,
        bri_reference_number AS reference_number,
        bri_details AS details,
        bri_debit AS debit,
        bri_credit AS credit,
        bri_balance AS balance,
        bri_created_by AS created_by
      FROM ${Accounting.bank_reconciliation_items.tablename}
      WHERE ${itemWhere.join(' AND ')}
      ORDER BY bri_date ASC, bri_id ASC
    `

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

    let connection

    try {
      connection = await getTenantPool().getConnection()
      await connection.beginTransaction()

      const mainQuery = sql
        .insert(Accounting.bank_reconciliation.tablename, {
          columns: Accounting.bank_reconciliation.insertColumns,
          prefix: Accounting.bank_reconciliation.prefix,
          isTransaction: true,
        })
        .build()

      const mainValues = [bank_account || null, coa_id || null, 0.0]

      const [mainResult] = await connection.execute(mainQuery, mainValues)
      const reconciliationId = mainResult.insertId

      await connection.commit()

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
      if (connection) {
        try {
          await connection.rollback()
        } catch (rollbackError) {
          console.error('Rollback error:', rollbackError)
        }
      }
      throw error
    } finally {
      if (connection) {
        connection.release()
      }
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

    let connection

    try {
      connection = await getTenantPool().getConnection()
      await connection.beginTransaction()

      const now = new Date().toISOString()
      const insertQuery = `INSERT INTO ${Accounting.bank_reconciliation_items.tablename} (bri_br_id, bri_date, bri_description, bri_reference_number, bri_details, bri_debit, bri_credit, bri_balance, bri_created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`

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

      let itemResult
      try {
        ;[itemResult] = await connection.execute(insertQuery, itemValues)
      } catch (insertError) {
        if (
          insertError.code === 'ER_NO_DEFAULT_FOR_FIELD' &&
          insertError.sqlMessage.includes('bri_id')
        ) {
          const [[{ nextId }]] = await connection.execute(
            `SELECT COALESCE(MAX(bri_id), 0) + 1 AS nextId FROM ${Accounting.bank_reconciliation_items.tablename}`,
          )
          const fallbackInsertQuery = `INSERT INTO ${Accounting.bank_reconciliation_items.tablename} (bri_id, bri_br_id, bri_date, bri_description, bri_reference_number, bri_details, bri_debit, bri_credit, bri_balance, bri_created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          const fallbackValues = [nextId, ...itemValues]
          const [fallbackResult] = await connection.execute(
            fallbackInsertQuery,
            fallbackValues,
          )
          itemResult = fallbackResult
        } else {
          throw insertError
        }
      }
      const itemId = itemResult.insertId

      await connection.commit()

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
      if (connection) {
        try {
          await connection.rollback()
        } catch (rollbackError) {
          console.error('Rollback error:', rollbackError)
        }
      }
      throw error
    } finally {
      if (connection) {
        connection.release()
      }
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

    let connection

    try {
      connection = await getTenantPool().getConnection()
      await connection.beginTransaction()

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

      updateValues.push(id)

      const updateQuery = `UPDATE ${Accounting.bank_reconciliation_items.tablename} SET ${updateColumns.map((col) => `${col} = ?`).join(', ')} WHERE bri_id = ?`

      const [result] = await connection.execute(updateQuery, updateValues)

      if (result.affectedRows === 0) {
        await connection.rollback()
        return res.status(404).json({
          success: false,
          message: 'Bank reconciliation item not found',
        })
      }

      await connection.commit()

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
      if (connection) {
        try {
          await connection.rollback()
        } catch (rollbackError) {
          console.error('Rollback error:', rollbackError)
        }
      }
      throw error
    } finally {
      if (connection) {
        connection.release()
      }
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

const deleteBankReconciliationItem = async (req, res, next) => {
  try {
    const { id } = req.params

    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Item ID is required',
      })
    }

    let connection

    try {
      connection = await getTenantPool().getConnection()
      await connection.beginTransaction()

      const deleteQuery = `DELETE FROM ${Accounting.bank_reconciliation_items.tablename} WHERE bri_id = ?`
      const [result] = await connection.execute(deleteQuery, [id])

      if (result.affectedRows === 0) {
        await connection.rollback()
        return res.status(404).json({
          success: false,
          message: 'Bank reconciliation item not found',
        })
      }

      await connection.commit()

      res.status(200).json({
        success: true,
        message: 'Bank reconciliation item deleted successfully',
        timestamp: new Date().toISOString(),
      })
    } catch (error) {
      if (connection) {
        try {
          await connection.rollback()
        } catch (rollbackError) {
          console.error('Rollback error:', rollbackError)
        }
      }
      throw error
    } finally {
      if (connection) {
        connection.release()
      }
    }
  } catch (error) {
    console.error('Error deleting bank reconciliation item:', error)
    return res.status(500).json({
      success: false,
      message: 'Server error while deleting bank reconciliation item',
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

    let connection

    try {
      connection = await getTenantPool().getConnection()
      await connection.beginTransaction()

      const updateQuery = `UPDATE ${Accounting.bank_reconciliation.tablename} SET br_running_balance = ? WHERE br_id = ?`
      const [result] = await connection.execute(updateQuery, [running_balance, id])

      if (result.affectedRows === 0) {
        await connection.rollback()
        return res.status(404).json({
          success: false,
          message: 'Bank reconciliation not found',
        })
      }

      await connection.commit()

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
      if (connection) {
        try {
          await connection.rollback()
        } catch (rollbackError) {
          console.error('Rollback error:', rollbackError)
        }
      }
      throw error
    } finally {
      if (connection) {
        connection.release()
      }
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
  deleteBankReconciliationItem,
  updateBankReconciliationBalance,
}
