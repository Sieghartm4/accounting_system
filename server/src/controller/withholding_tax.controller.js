const { checkConnection, SelectAll, Transaction, Query, Insert } = require('../database/util/queries.util')
const { formatMemoryUsage, formatTime, DataModeling } = require('../util/helper.util')
const { Master } = require('../database/model/Master')
const { SQLQueryBuilder } = require('../util/helper.util')
const { getTenantPool } = require('../database/util/tenantConnection.util')
const sql = new SQLQueryBuilder()

require('dotenv').config()

const getWithholdingTax = async (req, res, next) => {
  try {
    const query = sql.select([
      { col: Master.withholding_tax.selectOptionColumns.id, as: 'id' },
      { col: Master.withholding_tax.selectOptionColumns.code, as: 'code' },
      { col: Master.withholding_tax.selectOptionColumns.name, as: 'name' },
      { col: Master.withholding_tax.selectOptionColumns.rate, as: 'rate' },
      { col: Master.withholding_tax.selectOptionColumns.tax_account, as: 'tax_account' },
      { col: Master.withholding_tax.selectOptionColumns.description, as: 'description' },
      { col: Master.withholding_tax.selectOptionColumns.status, as: 'status' },
    ])
      .from(Master.withholding_tax.tablename)
      .orderBy(Master.withholding_tax.selectOptionColumns.id)
      .build();

    let withholdingTax = await Query(query, [], [Master.withholding_tax.prefix_]);
    console.log(withholdingTax);
    res.status(200).json({
      success: true,
      message: 'Withholding Tax entries retrieved successfully',
      data: withholdingTax,
      count: withholdingTax.length,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error fetching Withholding Tax entries:', error)
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching Withholding Tax entries',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    })
  }
}

const createWithholdingTax = async (req, res, next) => {
  try {
    const { code, name, rate, tax_account, description, status } = req.body;

    if (!code || !name || rate === undefined || !tax_account || !status) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: code, name, rate, tax_account, status'
      });
    }

    let queries = [];

    queries.push({
      sql: sql.insert(Master.withholding_tax.tablename, {
        columns: Master.withholding_tax.insertColumns,
        prefix: Master.withholding_tax.prefix,
        isTransaction: true
      })
        .build(),
      values: [
        code   || null,
        name   || null,
        rate   || null,
        tax_account   || null,
        description || null,
        status || null
      ]
    });

    let result = await Transaction(queries);

    const getIdQuery = `SELECT LAST_INSERT_ID() as insertId`;
    const idResult = await Query(getIdQuery);
    const newWithholdingTaxId = idResult[0]?.insertId;

    if (!newWithholdingTaxId) {
      throw new Error('Failed to get Withholding Tax ID from insertion');
    }

    res.status(201).json({
      success: true,
      message: 'Withholding Tax entry created successfully',
      data: {
        id: newWithholdingTaxId,
        code,
        name,
        rate,
        tax_account,
        description,
        status
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error creating Withholding Tax entry:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while creating Withholding Tax entry',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};


const updateWithholdingTax = async (req, res, next) => {
  try {
    const { id, code, name, rate, tax_account, description, status } = req.body;
    console.log("body", req.body);

    if (!id || !code || !name || rate === undefined || !tax_account || !status) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }

    let connection;
    try {
      connection = await getTenantPool().getConnection();
      await connection.beginTransaction();

      const updateQuery = sql.update(Master.withholding_tax.tablename)
        .set([
          Master.withholding_tax.selectOptionColumns.code,
          Master.withholding_tax.selectOptionColumns.name,
          Master.withholding_tax.selectOptionColumns.rate,
          Master.withholding_tax.selectOptionColumns.tax_account,
          Master.withholding_tax.selectOptionColumns.description,
          Master.withholding_tax.selectOptionColumns.status
        ])
        .where(Master.withholding_tax.selectOptionColumns.id)
        .build();

      const updateValues = [code, name, rate, tax_account, description, status, id];

      const result = await connection.execute(updateQuery, updateValues);

      await connection.commit();

      res.status(200).json({
        success: true,
        message: 'Withholding Tax entry updated successfully',
        data: {
          id,
          code,
          name,
          rate,
          tax_account,
          description,
          status
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
    console.error('Error updating Withholding Tax entry:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while updating Withholding Tax entry',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};


module.exports = {
  getWithholdingTax,
  createWithholdingTax,
  updateWithholdingTax,
}
