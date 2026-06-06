const os = require('os')
const {
  checkConnection,
  SelectAll,
  Transaction,
  Query,
  Insert,
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

const findProductByNameOrCode = async (connection, productValue) => {
  const lookupValue = String(productValue).trim()

  // Allow an existing numeric product ID to pass through.
  if (/^\d+$/.test(lookupValue)) {
    const [productById] = await connection.execute(
      `SELECT ps_id as id, ps_code as code, ps_name as name FROM ${Master.products_service.tablename} WHERE ps_id = ? LIMIT 1`,
      [Number(lookupValue)],
    )

    if (Array.isArray(productById) && productById.length > 0) {
      return productById[0]
    }
  }

  const productQuery = `
    SELECT ps_id as id, ps_code as code, ps_name as name
    FROM ${Master.products_service.tablename}
    WHERE LOWER(ps_name) = LOWER(?) OR LOWER(ps_code) = LOWER(?)
    LIMIT 1
  `

  const [productResults] = await connection.execute(productQuery, [
    lookupValue,
    lookupValue,
  ])
  return Array.isArray(productResults) && productResults.length > 0
    ? productResults[0]
    : null
}

const getPurchaseOrders = async (req, res, next) => {
  try {
    const query = sql
      .select([
        { col: Accounting.purchase_order.selectOptionColumns.id, as: 'id' },
        {
          col: Accounting.purchase_order.selectOptionColumns.product,
          as: 'product',
        },
        {
          col: `${Master.products_service.tablename}.${Master.products_service.selectOptionColumns.name}`,
          as: 'product_name',
        },
        {
          col: Accounting.purchase_order.selectOptionColumns.quantity,
          as: 'quantity',
        },
        { col: Accounting.purchase_order.selectOptionColumns.price, as: 'price' },
        {
          col: Accounting.purchase_order.selectOptionColumns.responsibility_center,
          as: 'responsibility_center',
        },
        { col: Accounting.purchase_order.selectOptionColumns.status, as: 'status' },
      ])
      .from(Accounting.purchase_order.tablename)
      .leftJoin(
        Master.products_service.tablename,
        `${Accounting.purchase_order.tablename}.${Accounting.purchase_order.selectOptionColumns.product}`,
        `${Master.products_service.tablename}.${Master.products_service.selectOptionColumns.id}`,
      )
      .orderByDesc(Accounting.purchase_order.selectOptionColumns.id)
      .build()

    let purchaseOrders = await Query(query, [], [Accounting.purchase_order.prefix_])
    res.status(200).json({
      success: true,
      message: 'Purchase orders retrieved successfully',
      data: purchaseOrders,
      count: purchaseOrders.length,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error fetching purchase orders:', error)
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching purchase orders',
      error:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Internal server error',
    })
  }
}

const getPurchaseOrderById = async (req, res, next) => {
  try {
    const { po_id } = req.params
    const purchaseOrderId = Number(po_id)

    if (!po_id || isNaN(purchaseOrderId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid PO ID provided',
        timestamp: new Date().toISOString(),
      })
    }

    const query = sql
      .select([
        { col: Accounting.purchase_order.selectOptionColumns.id, as: 'id' },
        {
          col: Accounting.purchase_order.selectOptionColumns.product,
          as: 'product',
        },
        {
          col: `${Master.products_service.tablename}.${Master.products_service.selectOptionColumns.name}`,
          as: 'product_name',
        },
        {
          col: Accounting.purchase_order.selectOptionColumns.quantity,
          as: 'quantity',
        },
        { col: Accounting.purchase_order.selectOptionColumns.price, as: 'price' },
        {
          col: Accounting.purchase_order.selectOptionColumns.responsibility_center,
          as: 'responsibility_center',
        },
        { col: Accounting.purchase_order.selectOptionColumns.status, as: 'status' },
      ])
      .from(Accounting.purchase_order.tablename)
      .leftJoin(
        Master.products_service.tablename,
        `${Accounting.purchase_order.tablename}.${Accounting.purchase_order.selectOptionColumns.product}`,
        `${Master.products_service.tablename}.${Master.products_service.selectOptionColumns.id}`,
      )
      .where(Accounting.purchase_order.selectOptionColumns.id)
      .build()

    let purchaseOrder = await Query(
      query,
      [purchaseOrderId],
      [Accounting.purchase_order.prefix_],
    )

    if (!purchaseOrder || purchaseOrder.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Purchase order not found',
        timestamp: new Date().toISOString(),
      })
    }

    res.status(200).json({
      success: true,
      message: 'Purchase order retrieved successfully',
      data: purchaseOrder[0],
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error fetching purchase order:', error)
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching purchase order',
      error:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Internal server error',
    })
  }
}

const createPurchaseOrder = async (req, res, next) => {
  try {
    const purchaseOrdersPayload = Array.isArray(req.body) ? req.body : [req.body]

    if (!purchaseOrdersPayload.length) {
      return res.status(400).json({
        success: false,
        message: 'Missing purchase order payload',
      })
    }

    const validatedPurchaseOrders = []
    let connection

    try {
      connection = await getTenantPool().getConnection()
      await connection.beginTransaction()

      // Validate and resolve products
      for (const [index, item] of purchaseOrdersPayload.entries()) {
        const { product, quantity, price, responsibility_center, status } = item
        const parsedQuantity = Number(quantity)
        const parsedPrice = Number(price)

        if (!product || quantity === undefined || price === undefined) {
          return res.status(400).json({
            success: false,
            message: `Missing required fields on row ${index + 1}: product (name or code), quantity, price`,
          })
        }

        if (Number.isNaN(parsedQuantity) || Number.isNaN(parsedPrice)) {
          return res.status(400).json({
            success: false,
            message: `Invalid quantity or price on row ${index + 1}`,
          })
        }

        const foundProduct = await findProductByNameOrCode(connection, product)

        if (!foundProduct) {
          await connection.rollback()
          return res.status(404).json({
            success: false,
            message: `Product with name or code "${product}" not found on row ${index + 1}`,
          })
        }

        validatedPurchaseOrders.push({
          productId: foundProduct.id,
          productCode: foundProduct.code,
          productName: foundProduct.name,
          quantity: parsedQuantity,
          price: parsedPrice,
          responsibility_center: responsibility_center || null,
          status: status || 'PENDING',
        })
      }

      const createdOrders = []
      const auditQueries = []
      const now = new Date()

      const mainQuery = sql
        .insert(Accounting.purchase_order.tablename, {
          columns: Accounting.purchase_order.insertColumns,
          prefix: Accounting.purchase_order.prefix,
          isTransaction: true,
        })
        .build()

      for (const purchaseOrder of validatedPurchaseOrders) {
        const mainValues = [
          purchaseOrder.productId,
          purchaseOrder.quantity,
          purchaseOrder.price,
          purchaseOrder.responsibility_center,
          purchaseOrder.status,
        ]

        const [mainResult] = await connection.execute(mainQuery, mainValues)
        const purchaseOrderId = mainResult.insertId

        createdOrders.push({
          id: purchaseOrderId,
          product_id: purchaseOrder.productId,
          product_code: purchaseOrder.productCode,
          product_name: purchaseOrder.productName,
          quantity: purchaseOrder.quantity,
          price: purchaseOrder.price,
          responsibility_center: purchaseOrder.responsibility_center,
          status: purchaseOrder.status,
        })

        auditQueries.push({
          sql: sql
            .insert(Master.audit_trail.tablename, {
              columns: Master.audit_trail.insertColumns,
              prefix: Master.audit_trail.prefix,
              isTransaction: true,
            })
            .build(),
          values: [
            purchaseOrderId || null,
            'PURCHASE_ORDER',
            req.context?.username || null,
            now.toISOString().split('T')[0],
            now.toTimeString().split(' ')[0],
            `CREATE: ID ${purchaseOrderId} - Product ID ${purchaseOrder.productId}`,
          ],
        })
      }

      for (const auditQuery of auditQueries) {
        await connection.execute(auditQuery.sql, auditQuery.values)
      }

      await connection.commit()

      res.status(201).json({
        success: true,
        message: 'Purchase order(s) created successfully',
        data: createdOrders,
        count: createdOrders.length,
        timestamp: new Date().toISOString(),
      })
    } catch (error) {
      if (connection) {
        await connection.rollback()
      }
      throw error
    } finally {
      if (connection) {
        connection.release()
      }
    }
  } catch (error) {
    console.error('Error creating purchase order:', error)
    return res.status(500).json({
      success: false,
      message: 'Server error while creating purchase order',
      error:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Internal server error',
    })
  }
}

const updatePurchaseOrder = async (req, res, next) => {
  try {
    const { po_id } = req.params
    const { product, quantity, price, responsibility_center, status } = req.body

    const purchaseOrderId = Number(po_id)
    if (!po_id || isNaN(purchaseOrderId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid PO ID provided',
        timestamp: new Date().toISOString(),
      })
    }

    if (!product || quantity === undefined || price === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: product (name or code), quantity, price',
      })
    }

    let connection
    try {
      connection = await getTenantPool().getConnection()
      await connection.beginTransaction()

      // Fetch current data before update
      const currentQuery = sql
        .select([
          {
            col: Accounting.purchase_order.selectOptionColumns.product,
            as: 'product',
          },
          {
            col: Accounting.purchase_order.selectOptionColumns.quantity,
            as: 'quantity',
          },
          { col: Accounting.purchase_order.selectOptionColumns.price, as: 'price' },
          {
            col: Accounting.purchase_order.selectOptionColumns.responsibility_center,
            as: 'responsibility_center',
          },
          {
            col: Accounting.purchase_order.selectOptionColumns.status,
            as: 'status',
          },
        ])
        .from(Accounting.purchase_order.tablename)
        .where(Accounting.purchase_order.selectOptionColumns.id)
        .build()

      const [currentData] = await connection.execute(currentQuery, [purchaseOrderId])

      if (!currentData || currentData.length === 0) {
        await connection.rollback()
        return res.status(404).json({
          success: false,
          message: 'Purchase order not found',
          timestamp: new Date().toISOString(),
        })
      }

      const foundProduct = await findProductByNameOrCode(connection, product)

      if (!foundProduct) {
        await connection.rollback()
        return res.status(404).json({
          success: false,
          message: `Product with name or code "${product}" not found`,
        })
      }

      const updateQuery = sql
        .update(Accounting.purchase_order.tablename)
        .set([
          Accounting.purchase_order.selectOptionColumns.product,
          Accounting.purchase_order.selectOptionColumns.quantity,
          Accounting.purchase_order.selectOptionColumns.price,
          Accounting.purchase_order.selectOptionColumns.responsibility_center,
          Accounting.purchase_order.selectOptionColumns.status,
        ])
        .where(Accounting.purchase_order.selectOptionColumns.id)
        .build()

      const updateValues = [
        foundProduct.id,
        quantity,
        price,
        responsibility_center,
        status || 'PENDING',
        purchaseOrderId,
      ]

      await connection.execute(updateQuery, updateValues)

      await connection.commit()

      // Audit trail for update
      const now = new Date()
      const auditQueries = []
      auditQueries.push({
        sql: sql
          .insert(Master.audit_trail.tablename, {
            columns: Master.audit_trail.insertColumns,
            prefix: Master.audit_trail.prefix,
            isTransaction: true,
          })
          .build(),
        values: [
          purchaseOrderId || null,
          'PURCHASE_ORDER',
          req.context?.username || null,
          now.toISOString().split('T')[0],
          now.toTimeString().split(' ')[0],
          `UPDATE: ID ${purchaseOrderId} - Product ID ${foundProduct.id}`,
        ],
      })
      await Transaction(auditQueries)

      res.status(200).json({
        success: true,
        message: 'Purchase order updated successfully',
        data: {
          id: purchaseOrderId,
          product_id: foundProduct.id,
          product_code: foundProduct.code,
          product_name: foundProduct.name,
          quantity,
          price,
          responsibility_center,
          status: status || 'PENDING',
        },
        timestamp: new Date().toISOString(),
      })
    } catch (error) {
      if (connection) {
        await connection.rollback()
      }
      throw error
    } finally {
      if (connection) {
        connection.release()
      }
    }
  } catch (error) {
    console.error('Error updating purchase order:', error)
    return res.status(500).json({
      success: false,
      message: 'Server error while updating purchase order',
      error:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Internal server error',
    })
  }
}

module.exports = {
  getPurchaseOrders,
  getPurchaseOrderById,
  createPurchaseOrder,
  updatePurchaseOrder,
}
