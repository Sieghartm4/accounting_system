const os = require('os')
const { checkConnection, SelectAll } = require('../database/util/queries.util')
const { formatMemoryUsage, formatTime, DataModeling } = require('../util/helper.util')
const { Accounting } = require('../database/model/Accounting')

require('dotenv').config()

const getCashDisbursements = async (req, res, next) => {
  try {
    const cashDisbursements = await SelectAll(Accounting.cash_disbursements.tablename, Accounting.cash_disbursements.prefix_)
    
    res.status(200).json({
      success: true,
      message: 'Cash disbursements retrieved successfully',
      data: cashDisbursements,
      count: cashDisbursements.length,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error fetching cash disbursements:', error)
    return res.status(500).json({ 
      success: false,
      message: 'Server error while fetching cash disbursements',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    })
  }
}

const createCashDisbursement = async (req, res, next) => {
    try {
        const { vendor_id, document_reference, payment_date, mode_of_payment, bank_name, check_number, category, remarks, total_amount_due, created_by } = req.body;

        if (!vendor_id || !document_reference || !payment_date || !mode_of_payment || !bank_name || !check_number || !category || !remarks || !total_amount_due || !created_by) {
            return res.status(400).json({
                success: false,
                message: 'All fields are required'
            });
        }
        
        let queries = []
        
        queries.push({
            sql: sql.insert(Accounting.cash_disbursements.tablename, {
                columns: Accounting.cash_disbursements.insertColumns,
                prefix: Accounting.cash_disbursements.prefix,
                isTransaction: true
            })
                .build(),
            values: [
                vendor_id || null,
                document_reference || null,
                payment_date || null,
                mode_of_payment || null,
                bank_name || null,
                check_number || null,
                category || null,
                remarks || null,
                total_amount_due || null,
                created_by || null
            ]
        });

        let result = await Transaction(queries);

        const getIdQuery = `SELECT LAST_INSERT_ID() as insertId`;
        const idResult = await Query(getIdQuery);
        const newCashDisbursementId = idResult[0]?.insertId;

        if (!newCashDisbursementId) {
            throw new Error('Failed to get cash disbursement ID from insertion');
        }

        res.status(201).json({
            success: true,
            message: 'Cash disbursement created successfully',
            data: {
                id: newCashDisbursementId,
                vendor_id: vendor_id,
                document_reference: document_reference,
                payment_date: payment_date,
                mode_of_payment: mode_of_payment,
                bank_name: bank_name,
                check_number: check_number,
                category: category,
                remarks: remarks,
                total_amount_due: total_amount_due,
                created_by: created_by
            },
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Error creating cash disbursement:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error while creating cash disbursement',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
}

module.exports = {
  getCashDisbursements,
  createCashDisbursement
}
