const os = require('os')
const { checkConnection, SelectAll, Transaction, Query, SelectWithCondition } = require('../database/util/queries.util')
const { formatMemoryUsage, formatTime, DataModeling } = require('../util/helper.util')
const { Master } = require('../database/model/Master')
const { SQLQueryBuilder } = require('../util/helper.util')
const sql = new SQLQueryBuilder()

require('dotenv').config()

const getProductsService = async (req, res, next) => {
  try {
    const productsService = await SelectAll(Master.products_service.tablename, Master.products_service.prefix_)
    
    res.status(200).json({
      success: true,
      message: 'Products/Service retrieved successfully',
      data: productsService,
      count: productsService.length,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error fetching products/service:', error)
    return res.status(500).json({ 
      success: false,
      message: 'Server error while fetching products/service',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    })
  }
}

const createProductService = async (req, res, next) => {
    try {
        const { code, name, type, category, sales_price, purchase_price, unit } = req.body;

        if (!code || !name || !type || !category || !sales_price || !purchase_price || !unit) {
            return res.status(400).json({
                success: false,
                message: 'Product/Service code, name, type, category, sales price, purchase price and unit are required'
            });
        }
        
        let queries = []
        
        queries.push({
            sql: sql.insert(Master.products_service.tablename, {
                columns: Master.products_service.insertColumns,
                prefix: Master.products_service.prefix,
                isTransaction: true
            })
                .build(),
            values: [
                code || null,
                name || null,
                type || null,
                category || null,
                sales_price || null,
                purchase_price || null,
                unit || null
            ]
        });

        let result = await Transaction(queries);

        const getIdQuery = `SELECT LAST_INSERT_ID() as insertId`;
        const idResult = await Query(getIdQuery);
        const newProductId = idResult[0]?.insertId;

        if (!newProductId) {
            throw new Error('Failed to get product/service ID from insertion');
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
                'PRODUCT_SERVICE',
                req.context?.username || null,
                now.toISOString().split('T')[0],
                now.toTimeString().split(' ')[0],
                `CREATE: ID ${newProductId}`
            ]
        });
        await Transaction(auditQueries);

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
                unit: unit
            },
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Error creating product/service:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error while creating product/service',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
}

const updateProductService = async (req, res, next) => {
  try {
    const { id: idFromBody, code, name, type, category, sales_price, purchase_price, unit } = req.body;
    const { id: idFromParams } = req.params;
    const id = Number(idFromParams || idFromBody);

    if (!id || !code || !name || !type || !category || sales_price === undefined || purchase_price === undefined || !unit) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }

    // Fetch existing product/service to compare changes
    const existingQuery = sql.select([Master.products_service.selectOptionColumns.code, Master.products_service.selectOptionColumns.name, Master.products_service.selectOptionColumns.type, Master.products_service.selectOptionColumns.category, Master.products_service.selectOptionColumns.sales_price, Master.products_service.selectOptionColumns.purchase_price, Master.products_service.selectOptionColumns.unit])
      .from(Master.products_service.tablename)
      .where(Master.products_service.selectOptionColumns.id)
      .build();
    const existingProducts = await Query(existingQuery, [id], Master.products_service.prefix_);
    const old = existingProducts[0] || {};

    const updateQuery = sql.update(Master.products_service.tablename)
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
      .build();

    const queries = [
      {
        sql: updateQuery,
        values: [code, name, type, category, sales_price, purchase_price, unit, id]
      }
    ];

    await Transaction(queries);

    // Build change description - only include changed columns with new values
    const changes = [];
    if (old.code !== code) changes.push(`code='${code}'`);
    if (old.name !== name) changes.push(`name='${name}'`);
    if (old.type !== type) changes.push(`type='${type}'`);
    if (old.category !== category) changes.push(`category='${category}'`);
    if (old.sales_price != sales_price) changes.push(`sales_price='${sales_price}'`);
    if (old.purchase_price != purchase_price) changes.push(`purchase_price='${purchase_price}'`);
    if (old.unit !== unit) changes.push(`unit='${unit}'`);
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
            'PRODUCT_SERVICE',
            req.context?.username || null,
            now.toISOString().split('T')[0],
            now.toTimeString().split(' ')[0],
            `UPDATE ID ${id}: ${changeDesc}`
        ]
    });
    await Transaction(auditQueries);

    res.status(200).json({
      success: true,
      message: 'Product/Service updated successfully',
      data: { id, code, name, type, category, sales_price, purchase_price, unit },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error updating product/service:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while updating product/service',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
}

module.exports = {
  getProductsService,
  createProductService,
  updateProductService
}
