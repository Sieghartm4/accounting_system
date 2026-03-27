'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const chartsOfAccounts = [
      // Assets
      { coa_code: '100-1000', coa_name: 'Petty Cash', coa_type: 'Assets', coa_description: 'Revolving Fund', coa_status: 'ACTIVE' },
      { coa_code: '100-1100', coa_name: 'Cash On Hand', coa_type: 'Assets', coa_description: 'Cash On Hand', coa_status: 'ACTIVE' },
      { coa_code: '100-1201', coa_name: 'Cash in Bank - BPI 5915', coa_type: 'Assets', coa_description: 'Cash in Bank', coa_status: 'ACTIVE' },
      { coa_code: '100-1202', coa_name: 'Cash in Bank - EastWest Bank 8877', coa_type: 'Assets', coa_description: 'Cash in Bank', coa_status: 'ACTIVE' },
      { coa_code: '100-1203', coa_name: 'Cash in Bank - Sterling Bank 4929', coa_type: 'Assets', coa_description: 'Cash in Bank', coa_status: 'ACTIVE' },
      { coa_code: '100-1204', coa_name: 'Cash in Bank - Security Bank 4522', coa_type: 'Assets', coa_description: 'Cash in Bank', coa_status: 'ACTIVE' },
      { coa_code: '100-1205', coa_name: 'Cash in Bank - Metrobank 4929', coa_type: 'Assets', coa_description: 'Cash in Bank', coa_status: 'ACTIVE' },
      { coa_code: '100-1299', coa_name: 'Cash Clearing Account', coa_type: 'Assets', coa_description: 'Temporary clearing account', coa_status: 'ACTIVE' },
      { coa_code: '100-2000', coa_name: 'Accounts Receivables', coa_type: 'Assets', coa_description: 'Accounts Receivables', coa_status: 'ACTIVE' },
      { coa_code: '100-2100', coa_name: 'Advances to Officers and Employees', coa_type: 'Assets', coa_description: 'Advances to Officers and Employees', coa_status: 'ACTIVE' },
      { coa_code: '100-2101', coa_name: 'Advances to Owners', coa_type: 'Assets', coa_description: '', coa_status: 'ACTIVE' },
      { coa_code: '100-2102', coa_name: 'SSS Sickness Benefit Receivable', coa_type: 'Assets', coa_description: '', coa_status: 'ACTIVE' },
      { coa_code: '100-3000', coa_name: 'Inventory', coa_type: 'Assets', coa_description: 'Inventory', coa_status: 'ACTIVE' },
      { coa_code: '100-4000', coa_name: 'Input VAT', coa_type: 'Assets', coa_description: 'Input VAT', coa_status: 'ACTIVE' },
      { coa_code: '100-4100', coa_name: 'Creditable Withholding Tax', coa_type: 'Assets', coa_description: 'Creditable Withholding Tax', coa_status: 'ACTIVE' },
      { coa_code: '100-4200', coa_name: 'Prepaid Expenses', coa_type: 'Assets', coa_description: 'Prepaid Expenses', coa_status: 'ACTIVE' },
      { coa_code: '100-4210', coa_name: 'Prepaid Income Tax', coa_type: 'Assets', coa_description: 'Prepaid Income Tax', coa_status: 'ACTIVE' },
      { coa_code: '100-4300', coa_name: 'Other Current Assets', coa_type: 'Assets', coa_description: 'Other Current Assets', coa_status: 'ACTIVE' },
      { coa_code: '100-5000', coa_name: 'Office Equipment', coa_type: 'Assets', coa_description: 'Office Equipment', coa_status: 'ACTIVE' },
      { coa_code: '100-5100', coa_name: 'Accumulated Depreciation: Office Equipment', coa_type: 'Assets', coa_description: 'Accumulated Depreciation: Office Equipment', coa_status: 'ACTIVE' },
      { coa_code: '100-6000', coa_name: 'Tools and Equipment', coa_type: 'Assets', coa_description: 'Tools and Equipment', coa_status: 'ACTIVE' },
      { coa_code: '100-6100', coa_name: 'Accumulated Depreciation: Tools and Equipment', coa_type: 'Assets', coa_description: 'Accumulated Depreciation: Tools and Equipment', coa_status: 'ACTIVE' },
      { coa_code: '100-7000', coa_name: 'Furniture and Fixtures', coa_type: 'Assets', coa_description: 'Furniture and Fixtures', coa_status: 'ACTIVE' },
      { coa_code: '100-7100', coa_name: 'Accumulated Depreciation: Furniture and Fixtures', coa_type: 'Assets', coa_description: 'Accumulated Depreciation: Furniture and Fixtures', coa_status: 'ACTIVE' },
      { coa_code: '100-8000', coa_name: 'Transportation Equipment', coa_type: 'Assets', coa_description: 'Transportation Equipment', coa_status: 'ACTIVE' },
      { coa_code: '100-8100', coa_name: 'Accumulated Depreciation: Transportation Equipment', coa_type: 'Assets', coa_description: 'Accumulated Depreciation: Transportation Equipment', coa_status: 'ACTIVE' },
      { coa_code: '100-9000', coa_name: 'Other Noncurrent Assets', coa_type: 'Assets', coa_description: 'Other Noncurrent Assets', coa_status: 'ACTIVE' },
      
      // Liabilities
      { coa_code: '200-1000', coa_name: 'Accounts Payable', coa_type: 'Liabilities', coa_description: 'Accounts Payable', coa_status: 'ACTIVE' },
      { coa_code: '200-1100', coa_name: 'Accrued Expenses', coa_type: 'Liabilities', coa_description: 'Accrued Expenses', coa_status: 'ACTIVE' },
      { coa_code: '200-1200', coa_name: 'Withholding Tax - Compensation', coa_type: 'Liabilities', coa_description: 'Withholding Tax - Compensation', coa_status: 'ACTIVE' },
      { coa_code: '200-1300', coa_name: 'Withholding Tax - Expanded', coa_type: 'Liabilities', coa_description: 'Withholding Tax - Expanded', coa_status: 'ACTIVE' },
      { coa_code: '200-1400', coa_name: 'Percentage Tax', coa_type: 'Liabilities', coa_description: 'Percentage Tax', coa_status: 'ACTIVE' },
      { coa_code: '200-1500', coa_name: 'Output VAT', coa_type: 'Liabilities', coa_description: 'Output VAT', coa_status: 'ACTIVE' },
      { coa_code: '200-1600', coa_name: 'Income Tax Payable', coa_type: 'Liabilities', coa_description: 'Income Tax Payable', coa_status: 'ACTIVE' },
      { coa_code: '200-1700', coa_name: 'SSS Payable', coa_type: 'Liabilities', coa_description: 'SSS Payable', coa_status: 'ACTIVE' },
      { coa_code: '200-1800', coa_name: 'Philhealth Payable', coa_type: 'Liabilities', coa_description: 'Philhealth Payable', coa_status: 'ACTIVE' },
      { coa_code: '200-1900', coa_name: 'Pag-Ibig Fund Payable', coa_type: 'Liabilities', coa_description: 'Pag-Ibig Fund Payable', coa_status: 'ACTIVE' },
      { coa_code: '200-200-1501', coa_name: 'VAT Payable', coa_type: 'Liabilities', coa_description: '', coa_status: 'ACTIVE' },
      { coa_code: '200-2000', coa_name: 'Loans Payable', coa_type: 'Liabilities', coa_description: 'Loans Payable', coa_status: 'ACTIVE' },
      { coa_code: '200-2100', coa_name: 'Other Current Liabilities', coa_type: 'Liabilities', coa_description: 'Other Current Liabilities', coa_status: 'ACTIVE' },
      { coa_code: '200-2200', coa_name: 'Advances from Officers', coa_type: 'Liabilities', coa_description: 'Advances from Officers', coa_status: 'ACTIVE' },
      { coa_code: '200-3000', coa_name: 'Other Noncurrent Liabilities', coa_type: 'Liabilities', coa_description: 'Other Noncurrent Liabilities', coa_status: 'ACTIVE' },
      
      // Equity
      { coa_code: '300-1000', coa_name: "Shareholder's Equity", coa_type: 'Equity', coa_description: "Shareholder's Equity", coa_status: 'ACTIVE' },
      { coa_code: '300-2000', coa_name: 'Retained Earnings', coa_type: 'Equity', coa_description: 'Retained Earnings', coa_status: 'ACTIVE' },
      
      // Revenues
      { coa_code: '400-1000', coa_name: 'Income from Trading', coa_type: 'Revenue', coa_description: 'Income from Trading', coa_status: 'ACTIVE' },
      { coa_code: '400-1100', coa_name: 'Income from Services', coa_type: 'Revenue', coa_description: 'Income from Services', coa_status: 'ACTIVE' },
      { coa_code: '400-2000', coa_name: 'Sales Discounts', coa_type: 'Revenue', coa_description: 'Sales Discounts', coa_status: 'ACTIVE' },
      { coa_code: '400-3000', coa_name: 'Interest Income', coa_type: 'Revenue', coa_description: 'Interest Income', coa_status: 'ACTIVE' },
      { coa_code: '400-4000', coa_name: 'Other Income', coa_type: 'Revenue', coa_description: 'Other Income', coa_status: 'ACTIVE' },
      
      // Expenses
      { coa_code: '500-1000', coa_name: 'Cost of Sales', coa_type: 'Expenses', coa_description: 'Cost of Sales', coa_status: 'ACTIVE' },
      { coa_code: '500-1100', coa_name: 'Purchases', coa_type: 'Expenses', coa_description: 'Purchases', coa_status: 'ACTIVE' },
      { coa_code: '500-1200', coa_name: 'Purchase Discounts', coa_type: 'Expenses', coa_description: 'Purchase Discounts', coa_status: 'ACTIVE' },
      { coa_code: '500-1300', coa_name: 'Direct Charges - Salaries, Wages & Benefits', coa_type: 'Expenses', coa_description: 'Direct Charges - Salaries, Wages & Benefits', coa_status: 'ACTIVE' },
      { coa_code: '500-1400', coa_name: 'Direct Charges - Materials, Supplies & Facilities', coa_type: 'Expenses', coa_description: 'Direct Charges - Materials, Supplies & Facilities', coa_status: 'ACTIVE' },
      { coa_code: '500-1500', coa_name: 'Salaries and Wages - Operating', coa_type: 'Expenses', coa_description: 'Salaries and Wages - Operating', coa_status: 'ACTIVE' },
      { coa_code: '500-1501', coa_name: 'Sales Commission Expense', coa_type: 'Expenses', coa_description: '', coa_status: 'ACTIVE' },
      { coa_code: '500-1502', coa_name: 'Bonus Expense', coa_type: 'Expenses', coa_description: '', coa_status: 'ACTIVE' },
      { coa_code: '500-1600', coa_name: 'SSS, PHIC & Pag-Ibig Contributions', coa_type: 'Expenses', coa_description: 'SSS, PHIC & Pag-Ibig Contributions', coa_status: 'ACTIVE' },
      { coa_code: '500-1700', coa_name: 'Fuel and Oil', coa_type: 'Expenses', coa_description: 'Fuel and Oil', coa_status: 'ACTIVE' },
      { coa_code: '500-1800', coa_name: 'Repairs and Maintenance - Materials and Supplies', coa_type: 'Expenses', coa_description: 'Repairs and Maintenance - Materials and Supplies', coa_status: 'ACTIVE' },
      { coa_code: '500-1900', coa_name: 'Communication, Light & Water', coa_type: 'Expenses', coa_description: 'Communication, Light & Water', coa_status: 'ACTIVE' },
      { coa_code: '500-2000', coa_name: 'Office Supplies', coa_type: 'Expenses', coa_description: 'Office Supplies', coa_status: 'ACTIVE' },
      { coa_code: '500-2100', coa_name: 'Taxes & Licenses', coa_type: 'Expenses', coa_description: 'Taxes & Licenses', coa_status: 'ACTIVE' },
      { coa_code: '500-2200', coa_name: 'Transportation and Travel', coa_type: 'Expenses', coa_description: 'Transportation and Travel', coa_status: 'ACTIVE' },
      { coa_code: '500-2300', coa_name: 'Representation Expense', coa_type: 'Expenses', coa_description: 'Representation Expense', coa_status: 'ACTIVE' },
      { coa_code: '500-2400', coa_name: 'Miscellaneous Expense', coa_type: 'Expenses', coa_description: 'Miscellaneous Expense', coa_status: 'ACTIVE' },
      { coa_code: '500-2500', coa_name: 'Medical Expense', coa_type: 'Expenses', coa_description: 'Medical Expense', coa_status: 'ACTIVE' },
      { coa_code: '500-2600', coa_name: 'Subscriptions', coa_type: 'Expenses', coa_description: 'Monthly and annual subscriptions', coa_status: 'ACTIVE' },
      { coa_code: '500-2700', coa_name: 'Depreciation Expense', coa_type: 'Expenses', coa_description: 'Depreciation Expense', coa_status: 'ACTIVE' },
      { coa_code: '500-2800', coa_name: 'Bank Charges', coa_type: 'Expenses', coa_description: '', coa_status: 'ACTIVE' },
      { coa_code: '500-2900', coa_name: 'Postage and Delivery Expense', coa_type: 'Expenses', coa_description: '', coa_status: 'ACTIVE' },
      { coa_code: '500-3000', coa_name: 'Rent Expense', coa_type: 'Expenses', coa_description: 'Rent Expense', coa_status: 'ACTIVE' },
      { coa_code: '500-3100', coa_name: 'Parking & Toll Fee', coa_type: 'Expenses', coa_description: '', coa_status: 'ACTIVE' },
      { coa_code: '500-3202', coa_name: 'Meals & Allowances', coa_type: 'Expenses', coa_description: '', coa_status: 'ACTIVE' },
      { coa_code: '500-3203', coa_name: 'Accommodation Expense', coa_type: 'Expenses', coa_description: '', coa_status: 'ACTIVE' },
      { coa_code: '500-3205', coa_name: 'Professional Fees', coa_type: 'Expenses', coa_description: '', coa_status: 'ACTIVE' },
      { coa_code: '500-3300', coa_name: 'General and Administrative Expenses', coa_type: 'Expenses', coa_description: 'General and Administrative Expenses', coa_status: 'ACTIVE' },
      { coa_code: '500-4105', coa_name: 'Repair & Maintenance - Equipment', coa_type: 'Expenses', coa_description: '', coa_status: 'ACTIVE' },
      { coa_code: '500-4106', coa_name: 'Repair & Maintenance - Vehicle', coa_type: 'Expenses', coa_description: '', coa_status: 'ACTIVE' },
      { coa_code: '500-5100', coa_name: 'Interest Expense - Car Loans', coa_type: 'Expenses', coa_description: 'Interest expense on car loans', coa_status: 'ACTIVE' },
      { coa_code: '500-5200', coa_name: 'Interest Expense - Loans', coa_type: 'Expenses', coa_description: 'Interest expense on loans', coa_status: 'ACTIVE' },
      { coa_code: '500-7000', coa_name: 'Income Tax Expense', coa_type: 'Expenses', coa_description: 'Income Tax Expense', coa_status: 'ACTIVE' },
      { coa_code: '500-9500', coa_name: 'Insurance Expense - Fire', coa_type: 'Expenses', coa_description: '', coa_status: 'ACTIVE' },
      { coa_code: '500-9600', coa_name: 'Insurance Expense - Life', coa_type: 'Expenses', coa_description: '', coa_status: 'ACTIVE' },
      { coa_code: '500-9700', coa_name: 'Insurance Expense - Vehicle', coa_type: 'Expenses', coa_description: '', coa_status: 'ACTIVE' }
    ];

    await queryInterface.bulkInsert('charts_of_accounts', chartsOfAccounts);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('charts_of_accounts', {
      coa_code: [
        '100-1000', '100-1100', '100-1201', '100-1202', '100-1203', '100-1204', '100-1205', '100-1299',
        '100-2000', '100-2100', '100-2101', '100-2102', '100-3000', '100-4000', '100-4100', '100-4200',
        '100-4210', '100-4300', '100-5000', '100-5100', '100-6000', '100-6100', '100-7000', '100-7100',
        '100-8000', '100-8100', '100-9000', '200-1000', '200-1100', '200-1200', '200-1300', '200-1400',
        '200-1500', '200-1600', '200-1700', '200-1800', '200-1900', '200-200-1501', '200-2000', '200-2100',
        '200-2200', '200-3000', '300-1000', '300-2000', '400-1000', '400-1100', '400-2000', '400-3000',
        '400-4000', '500-1000', '500-1100', '500-1200', '500-1300', '500-1400', '500-1500', '500-1501',
        '500-1502', '500-1600', '500-1700', '500-1800', '500-1900', '500-2000', '500-2100', '500-2200',
        '500-2300', '500-2400', '500-2500', '500-2600', '500-2700', '500-2800', '500-2900', '500-3000',
        '500-3100', '500-3202', '500-3203', '500-3205', '500-3300', '500-4105', '500-4106', '500-5100',
        '500-5200', '500-7000', '500-9500', '500-9600', '500-9700'
      ]
    });
  }
};
