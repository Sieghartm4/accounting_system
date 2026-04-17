'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const proformaEntries = [
      // Cash Receipts
      { pe_module: 'Cash Receipts', pe_name: 'Cash in Bank', pe_coa_id: 3, pe_t_account: 'Debit' },
      { pe_module: 'Cash Receipts', pe_name: 'Sales Discounts', pe_coa_id: 47, pe_t_account: 'Debit' },
      { pe_module: 'Cash Receipts', pe_name: 'Creditable Withholding Tax', pe_coa_id: 15, pe_t_account: 'Debit' },
      { pe_module: 'Cash Receipts', pe_name: 'Output Vat', pe_coa_id: 33, pe_t_account: 'Credit' },
      { pe_module: 'Cash Receipts', pe_name: 'Sales', pe_coa_id: 45, pe_t_account: 'Credit' },
      
      // Purchases
      { pe_module: 'Purchases', pe_name: 'Purchases', pe_coa_id: 51, pe_t_account: 'Debit' },
      { pe_module: 'Purchases', pe_name: 'Input Vat', pe_coa_id: 14, pe_t_account: 'Debit' },
      { pe_module: 'Purchases', pe_name: 'Purchase Discount', pe_coa_id: 52, pe_t_account: 'Credit' },
      { pe_module: 'Purchases', pe_name: 'Withholding Tax - Expanded', pe_coa_id: 31, pe_t_account: 'Credit' },
      { pe_module: 'Purchases', pe_name: 'Accounts Payable', pe_coa_id: 28, pe_t_account: 'Credit' },
      
      // Payments
      { pe_module: 'Payments', pe_name: 'Cash in Bank', pe_coa_id: 3, pe_t_account: 'Debit' },
      { pe_module: 'Payments', pe_name: 'Accounts Payable', pe_coa_id: 28, pe_t_account: 'Debit' },
      { pe_module: 'Payments', pe_name: 'Withholding Tax - Expanded', pe_coa_id: 31, pe_t_account: 'Credit' },
      
      // Sales
      { pe_module: 'Sales', pe_name: 'Accounts Receivable', pe_coa_id: 9, pe_t_account: 'Debit' },
      { pe_module: 'Sales', pe_name: 'Sales Discounts', pe_coa_id: 47, pe_t_account: 'Debit' },
      { pe_module: 'Sales', pe_name: 'Creditable Withholding Tax', pe_coa_id: 15, pe_t_account: 'Debit' },
      { pe_module: 'Sales', pe_name: 'Output Vat', pe_coa_id: 33, pe_t_account: 'Credit' },
      { pe_module: 'Sales', pe_name: 'Sales', pe_coa_id: 45, pe_t_account: 'Credit' },
      
      // Cash Disbursements
      { pe_module: 'Cash Disbursements', pe_name: 'Purchases', pe_coa_id: 51, pe_t_account: 'Debit' },
      { pe_module: 'Cash Disbursements', pe_name: 'Input Vat', pe_coa_id: 14, pe_t_account: 'Debit' },
      { pe_module: 'Cash Disbursements', pe_name: 'Purchase Discount', pe_coa_id: 52, pe_t_account: 'Credit' },
      { pe_module: 'Cash Disbursements', pe_name: 'Withholding Tax - Expanded', pe_coa_id: 31, pe_t_account: 'Credit' },
      { pe_module: 'Cash Disbursements', pe_name: 'Cash in Bank', pe_coa_id: 3, pe_t_account: 'Credit' },
      
      // Collections
      { pe_module: 'Collections', pe_name: 'Cash in Bank', pe_coa_id: 3, pe_t_account: 'Debit' },
      { pe_module: 'Collections', pe_name: 'Creditable Withholding Tax', pe_coa_id: 15, pe_t_account: 'Debit' },
      { pe_module: 'Collections', pe_name: 'Accounts Receivable', pe_coa_id: 9, pe_t_account: 'Credit' },
      
      // Closing
      { pe_module: 'Closing', pe_name: 'Closing', pe_coa_id: 44, pe_t_account: 'Credit' },
      
      // Payment Taxes - VAT
      { pe_module: 'Payment Taxes - VAT', pe_name: 'Output VAT', pe_coa_id: 33, pe_t_account: 'Debit' },
      { pe_module: 'Payment Taxes - VAT', pe_name: 'Input VAT', pe_coa_id: 14, pe_t_account: 'Credit' }
    ];

    await queryInterface.bulkInsert('proforma_entries', proformaEntries, {});
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('proforma_entries', null, {});
  }
};
