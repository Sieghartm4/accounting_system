const { checkConnection, SelectAll, Transaction, Query, Insert } = require('../database/util/queries.util')
const { formatMemoryUsage, formatTime, DataModeling } = require('../util/helper.util')
const { Master } = require('../database/model/Master')
const { SQLQueryBuilder } = require('../util/helper.util')
const sql = new SQLQueryBuilder()
const mysql = require('mysql2/promise')
const CONFIG = require('../database/config/config')

const pool = mysql.createPool({
  host: CONFIG[process.env.NODE_ENV].host,
  user: CONFIG[process.env.NODE_ENV].username,
  password: CONFIG[process.env.NODE_ENV].password,
  database: CONFIG[process.env.NODE_ENV].database,
  multipleStatements: CONFIG[process.env.NODE_ENV].dialectOptions.multipleStatements,
})
require('dotenv').config()

const getVat = async (req, res, next) => {
  try {
    const query = sql.select([
      { col: Master.vat.selectOptionColumns.id, as: 'id' },
      { col: Master.vat.selectOptionColumns.code, as: 'code' },
      { col: Master.vat.selectOptionColumns.name, as: 'name' },
      { col: Master.vat.selectOptionColumns.rate, as: 'rate' },
      { col: Master.vat.selectOptionColumns.type, as: 'type' },
      { col: Master.vat.selectOptionColumns.sub_type, as: 'sub_type' },
      { col: Master.vat.selectOptionColumns.description, as: 'description' },
      { col: Master.vat.selectOptionColumns.status, as: 'status' },
    ])
      .from(Master.vat.tablename)
      .orderByDesc(Master.vat.selectOptionColumns.id)
      .build();

    let vat = await Query(query, [], [Master.vat.prefix_]);
    console.log(vat);
    res.status(200).json({
      success: true,
      message: 'VAT entries retrieved successfully',
      data: vat,
      count: vat.length,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error fetching VAT entries:', error)
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching VAT entries',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    })
  }
}

const createVat = async (req, res, next) => {
  try {
    const { code, name, rate, type, sub_type, description, status } = req.body;

    if (!code || !name || rate === undefined || !type || !sub_type || !description || !status) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: code, name, rate, type, sub_type, description, status'
      });
    }

    let queries = [];

    queries.push({
      sql: sql.insert(Master.vat.tablename, {
        columns: Master.vat.insertColumns,
        prefix: Master.vat.prefix,
        isTransaction: true
      })
        .build(),
      values: [
        code   || null,
        name   || null,
        rate   || null,
        type   || null,
        sub_type    || null,
        description || null,
        status || null
      ]
    });

    let result = await Transaction(queries);

    const getIdQuery = `SELECT LAST_INSERT_ID() as insertId`;
    const idResult = await Query(getIdQuery);
    const newVatId = idResult[0]?.insertId;

    if (!newVatId) {
      throw new Error('Failed to get VAT ID from insertion');
    }

    res.status(201).json({
      success: true,
      message: 'VAT entry created successfully',
      data: {
        id: newVatId,
        code,
        name,
        rate,
        type,
        sub_type,
        description,
        status
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error creating VAT entry:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while creating VAT entry',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};


const updateVat = async (req, res, next) => {
  try {
    const { id, code, name, rate, type, sub_type, description, status } = req.body;
    console.log("body", req.body);

    if (!id || !code || !name || rate === undefined || !type || !sub_type || !description || !status) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }

    let connection;
    try {
      connection = await pool.getConnection();
      await connection.beginTransaction();

      const updateQuery = sql.update(Master.vat.tablename)
        .set([
          Master.vat.selectOptionColumns.code,
          Master.vat.selectOptionColumns.name,
          Master.vat.selectOptionColumns.rate,
          Master.vat.selectOptionColumns.type,
          Master.vat.selectOptionColumns.sub_type,
          Master.vat.selectOptionColumns.description,
          Master.vat.selectOptionColumns.status
        ])
        .where(Master.vat.selectOptionColumns.id)
        .build();

      const updateValues = [code, name, rate, type, sub_type, description, status, id];

      const result = await connection.execute(updateQuery, updateValues);

      await connection.commit();

      res.status(200).json({
        success: true,
        message: 'VAT entry updated successfully',
        data: {
          id,
          code,
          name,
          rate,
          type,
          sub_type,
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
    console.error('Error updating VAT entry:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while updating VAT entry',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};


module.exports = {
  getVat,
  createVat,
  updateVat,
}
