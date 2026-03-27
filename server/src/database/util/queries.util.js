require('dotenv').config()
const mysql = require('mysql2/promise')
const { logger } = require('../../util/logger.util')
const { DataModeling } = require('../../util/helper.util')
const CONFIG = require('../config/config')

const pool = mysql.createPool({
  host: CONFIG[process.env.NODE_ENV].host,
  user: CONFIG[process.env.NODE_ENV].username,
  password: CONFIG[process.env.NODE_ENV].password,
  database: CONFIG[process.env.NODE_ENV].database,
  multipleStatements: CONFIG[process.env.NODE_ENV].dialectOptions.multipleStatements,
})

/**
 * @name checkConnection
 * @description Pings the database using a connection from the pool to verify connectivity.
 */
exports.checkConnection = async () => {
  let conn
  const startTime = process.hrtime()

  try {
    conn = await pool.getConnection()
    await conn.ping()

    const [seconds, nanoseconds] = process.hrtime(startTime)
    const latencyMs = seconds * 1000 + nanoseconds / 1000000

    // logger.info('MySQL database connection established successfully!')

    return {
      status: 'Ok',
      latency: Math.round(latencyMs),
      details: 'Connection and ping successful',
    }
  } catch (err) {
    logger.error('Error connection to MySQL database: ', err.message)

    return {
      status: 'Error',
      latency: null,
      details: err.message || 'Unknown database connection error',
    }
  } finally {
    if (conn) {
      conn.release()
    }
  }
}

//@ Specific Select ALL no params
exports.SelectAll = async (tableName, prefix) => {
  try {
    const [result] = await pool.query(`SELECT * FROM ${tableName}`)
    if (prefix) {
      const data = DataModeling(result, prefix)
      return data
    }
    return result
  } catch (error) {
    logger.error(error)
    console.error('Error executing query:', error)

    throw error
  }
}

//@ can be used for universal query SELECT, INSERT, UPDATE, DELETE
exports.Query = async (sql, params = [], prefixes) => {
  try {
    const [result] = await pool.query(sql, params)
    if (sql.trim().toUpperCase().startsWith('INSERT')) {
      return { ...result, insertId: result.insertId }
    }
    if (prefixes && sql.trim().toUpperCase().startsWith('SELECT')) {
      const data = DataModeling(result, prefixes)
      return data
    }
    return result
  } catch (error) {
    logger.error(error)
    console.error('Error executing query:', error)
    throw error
  }
}

//@use for Transac and Commit
exports.Transaction = async (queries) => {
  let connection
  try {
    connection = await pool.getConnection()
    await connection.beginTransaction()

    for (const query of queries) {
      await connection.execute(query.sql, query.values)
    }

    await connection.commit()
    return true
  } catch (error) {
    logger.error('Transaction failed:', error)
    console.log(error)
    if (connection) {
      try {
        await connection.rollback()
      } catch (rollbackError) {
        logger.error('Rollback failed after transaction error:', rollbackError)
      }
    }
    throw error
  } finally {
    if (connection) {
      connection.release()
    }
  }
}

exports.Insert = async (query, data) => {
  try {
    const [result] = await pool.query(query, data)

    return {
      rows: result.affectedRows,
      id: result.insertId,
    }
  } catch (err) {
    throw err
  }
}

exports.Update = async (query, data) => {
  try {
    const [result] = await pool.query(query, data)
    return result.affectedRows
  } catch (err) {
    throw err
  }
}

exports.Delete = async (query, data) => {
  try {
    const [result] = await pool.query(query, data)
    return result.affectedRows
  } catch (err) {
    throw err
  }
}

exports.SelectWithCondition = async (query, condition, prefix) => {
  try {
    const [result] = await pool.query(query, condition)
    if (prefix) {
      const data = DataModeling(result, prefix)
      return data
    }
    return result
  } catch (err) {
    throw err
  }
}
