const os = require('os')
const http = require('http')
const https = require('https')
const {
  checkConnection,
  SelectAll,
  Transaction,
  Query,
  SelectWithCondition,
} = require('../database/util/queries.util')
const {
  formatMemoryUsage,
  formatTime,
  DataModeling,
} = require('../util/helper.util')
const { Master } = require('../database/model/Master')
const { SQLQueryBuilder } = require('../util/helper.util')
const sql = new SQLQueryBuilder()

require('dotenv').config()

const getProductsService = async (req, res, next) => {
  try {
    const productsService = await SelectAll(
      Master.products_service.tablename,
      Master.products_service.prefix_,
    )

    res.status(200).json({
      success: true,
      message: 'Products/Service retrieved successfully',
      data: productsService,
      count: productsService.length,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error fetching products/service:', error)
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching products/service',
      error:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Internal server error',
    })
  }
}

const fetchJsonFromUrl = (url, headers = {}) => {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url)
    const client = parsedUrl.protocol === 'https:' ? https : http
    const options = {
      method: 'GET',
      headers,
    }

    const request = client.request(parsedUrl, options, (response) => {
      let body = ''
      response.on('data', (chunk) => {
        body += chunk
      })
      response.on('end', () => {
        if (response.statusCode < 200 || response.statusCode >= 300) {
          return reject(
            new Error(
              `Inventory API request failed with status ${response.statusCode}: ${body}`,
            ),
          )
        }
        try {
          resolve(JSON.parse(body))
        } catch (parseError) {
          reject(
            new Error(
              `Failed to parse inventory API response: ${parseError.message}`,
            ),
          )
        }
      })
    })

    request.on('error', reject)
    request.end()
  })
}

const syncProductService = async (req, res, next) => {
  try {
    const inventoryApiKey = process.env._INVENTORY_API_KEY
    if (!inventoryApiKey) {
      return res.status(500).json({
        success: false,
        message: 'Inventory API key is not configured',
      })
    }

    const inventoryUrl =
      process.env._INVENTORY_PRODUCT_URL ||
      'http://172.16.3.18:3010/accounting/company'
    const companies = await fetchJsonFromUrl(inventoryUrl, {
      accept: 'application/json',
      'x-api-key': inventoryApiKey,
    })

    if (!Array.isArray(companies)) {
      throw new Error('Inventory company API returned an unexpected response format')
    }

    const syncQueries = []
    const baseOrigin = new URL(inventoryUrl).origin
    let inventoriesProcessed = 0

    for (const company of companies) {
      const companyId = company.id || company.companyId || company.code
      if (!companyId) continue

      // fetch inventories for this company
      let inventories = []
      try {
        const invUrl = `${baseOrigin}/accounting/inventories/${companyId}`
        const invRes = await fetchJsonFromUrl(invUrl, {
          accept: 'application/json',
          'x-api-key': inventoryApiKey,
        })
        if (Array.isArray(invRes)) inventories = invRes
      } catch (err) {
        // continue with next company on error
        console.error(
          `Failed to fetch inventories for company ${companyId}:`,
          err.message,
        )
        continue
      }

      for (const item of inventories) {
        const externalId = item.inventoryId || item.id || item.code
        const externalName = item.inventoryName || item.name || item.description

        if (!externalId || !externalName) continue

        inventoriesProcessed++

        const existing = await Query(
          `SELECT ps_id FROM ${Master.products_service.tablename} WHERE ps_code = ? LIMIT 1`,
          [externalId],
        )

        if (existing && existing.length > 0) {
          syncQueries.push({
            sql: `UPDATE ${Master.products_service.tablename} SET ps_name = ?, ps_type = 'PRODUCT', ps_category = ?, ps_sales_price = 0, ps_purchase_price = 0, ps_unit = ? WHERE ps_id = ?`,
            values: [
              externalName,
              item.category || 'INVENTORY',
              item.unit || 'pcs',
              existing[0].ps_id,
            ],
          })
        } else {
          syncQueries.push({
            sql: `INSERT INTO ${Master.products_service.tablename} (ps_code, ps_name, ps_type, ps_category, ps_sales_price, ps_purchase_price, ps_unit) VALUES (?, ?, ?, ?, 0, 0, ?)`,
            values: [
              externalId,
              externalName,
              'PRODUCT',
              item.category || 'INVENTORY',
              item.unit || 'pcs',
            ],
          })
        }
      }
    }

    if (syncQueries.length > 0) {
      await Transaction(syncQueries)
    }

    const productsService = await SelectAll(
      Master.products_service.tablename,
      Master.products_service.prefix_,
    )

    res.status(200).json({
      success: true,
      message: `Product/Service sync completed. ${syncQueries.length} queries queued; ${inventoriesProcessed} inventory item(s) processed.`,
      data: productsService,
      count: productsService.length,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error syncing product/service:', error)
    return res.status(500).json({
      success: false,
      message: 'Server error while syncing product/service',
      error:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Internal server error',
    })
  }
}

const createProductService = async (req, res, next) => {
  try {
    const { code, name, type, category, sales_price, purchase_price, unit } =
      req.body

    if (
      !code ||
      !name ||
      !type ||
      !category ||
      !sales_price ||
      !purchase_price ||
      !unit
    ) {
      return res.status(400).json({
        success: false,
        message:
          'Product/Service code, name, type, category, sales price, purchase price and unit are required',
      })
    }

    let queries = []

    queries.push({
      sql: sql
        .insert(Master.products_service.tablename, {
          columns: Master.products_service.insertColumns,
          prefix: Master.products_service.prefix,
          isTransaction: true,
        })
        .build(),
      values: [
        code || null,
        name || null,
        type || null,
        category || null,
        sales_price || null,
        purchase_price || null,
        unit || null,
      ],
    })

    let result = await Transaction(queries)

    const getIdQuery = `SELECT LAST_INSERT_ID() as insertId`
    const idResult = await Query(getIdQuery)
    const newProductId = idResult[0]?.insertId

    if (!newProductId) {
      throw new Error('Failed to get product/service ID from insertion')
    }

    // Audit trail for create
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
        newProductId || null,
        'PRODUCT_SERVICE',
        req.context?.username || null,
        now.toISOString().split('T')[0],
        now.toTimeString().split(' ')[0],
        `CREATE: ID ${newProductId}`,
      ],
    })
    await Transaction(auditQueries)

    res.status(201).json({
      success: true,
      message: 'Product/Service created successfully',
      data: {
        id: newProductId,
        code: code,
        name: name,
        type: type,
        category: category,
        sales_price: sales_price,
        purchase_price: purchase_price,
        unit: unit,
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error creating product/service:', error)
    return res.status(500).json({
      success: false,
      message: 'Server error while creating product/service',
      error:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Internal server error',
    })
  }
}

const updateProductService = async (req, res, next) => {
  try {
    const {
      id: idFromBody,
      code,
      name,
      type,
      category,
      sales_price,
      purchase_price,
      unit,
    } = req.body
    const { id: idFromParams } = req.params
    const id = Number(idFromParams || idFromBody)

    if (
      !id ||
      !code ||
      !name ||
      !type ||
      !category ||
      sales_price === undefined ||
      purchase_price === undefined ||
      !unit
    ) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required',
      })
    }

    // Fetch existing product/service to compare changes
    const existingQuery = sql
      .select([
        Master.products_service.selectOptionColumns.code,
        Master.products_service.selectOptionColumns.name,
        Master.products_service.selectOptionColumns.type,
        Master.products_service.selectOptionColumns.category,
        Master.products_service.selectOptionColumns.sales_price,
        Master.products_service.selectOptionColumns.purchase_price,
        Master.products_service.selectOptionColumns.unit,
      ])
      .from(Master.products_service.tablename)
      .where(Master.products_service.selectOptionColumns.id)
      .build()
    const existingProducts = await Query(
      existingQuery,
      [id],
      Master.products_service.prefix_,
    )
    const old = existingProducts[0] || {}

    const updateQuery = sql
      .update(Master.products_service.tablename)
      .set([
        Master.products_service.selectOptionColumns.code,
        Master.products_service.selectOptionColumns.name,
        Master.products_service.selectOptionColumns.type,
        Master.products_service.selectOptionColumns.category,
        Master.products_service.selectOptionColumns.sales_price,
        Master.products_service.selectOptionColumns.purchase_price,
        Master.products_service.selectOptionColumns.unit,
      ])
      .where(Master.products_service.selectOptionColumns.id)
      .build()

    const queries = [
      {
        sql: updateQuery,
        values: [code, name, type, category, sales_price, purchase_price, unit, id],
      },
    ]

    await Transaction(queries)

    // Build change description - only include changed columns with new values
    const changes = []
    if (old.code !== code) changes.push(`code='${code}'`)
    if (old.name !== name) changes.push(`name='${name}'`)
    if (old.type !== type) changes.push(`type='${type}'`)
    if (old.category !== category) changes.push(`category='${category}'`)
    if (old.sales_price != sales_price) changes.push(`sales_price='${sales_price}'`)
    if (old.purchase_price != purchase_price)
      changes.push(`purchase_price='${purchase_price}'`)
    if (old.unit !== unit) changes.push(`unit='${unit}'`)
    const changeDesc = changes.length > 0 ? changes.join(', ') : 'no changes'

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
        id || null,
        'PRODUCT_SERVICE',
        req.context?.username || null,
        now.toISOString().split('T')[0],
        now.toTimeString().split(' ')[0],
        `UPDATE ID ${id}: ${changeDesc}`,
      ],
    })
    await Transaction(auditQueries)

    res.status(200).json({
      success: true,
      message: 'Product/Service updated successfully',
      data: { id, code, name, type, category, sales_price, purchase_price, unit },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error updating product/service:', error)
    return res.status(500).json({
      success: false,
      message: 'Server error while updating product/service',
      error:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Internal server error',
    })
  }
}

module.exports = {
  getProductsService,
  syncProductService,
  createProductService,
  updateProductService,
}
