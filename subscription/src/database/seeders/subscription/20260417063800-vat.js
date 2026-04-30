'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const vatData = [
      {
        vat_code: 'ZR-S',
        vat_name: 'Zero-Rated - Services',
        vat_rate: 0.00,
        vat_type: 'Zero-rated',
        vat_sub_type: 'Services',
        vat_description: 'Zero-Rated - Services',
        vat_status: 'ACTIVE'
      },
      {
        vat_code: 'ZR-OCG',
        vat_name: 'Zero-Rated - Goods Other Than Capital Goods',
        vat_rate: 0.00,
        vat_type: 'Zero-rated',
        vat_sub_type: 'Goods Other Than Capital Goods',
        vat_description: 'Zero-Rated - Goods Other Than Capital Goods',
        vat_status: 'ACTIVE'
      },
      {
        vat_code: 'ZR-CG',
        vat_name: 'Zero-Rated - Capital Goods',
        vat_rate: 0.00,
        vat_type: 'Zero-rated',
        vat_sub_type: 'Capital Goods',
        vat_description: 'Zero-Rated - Capital Goods',
        vat_status: 'ACTIVE'
      },
      {
        vat_code: 'VAT-S',
        vat_name: 'VATable - Services',
        vat_rate: 12.00,
        vat_type: 'Vatable',
        vat_sub_type: 'Services',
        vat_description: 'VATable - Services',
        vat_status: 'ACTIVE'
      },
      {
        vat_code: 'VAT-OCG',
        vat_name: 'VATable - Goods Other Than Capital Goods',
        vat_rate: 12.00,
        vat_type: 'Vatable',
        vat_sub_type: 'Goods Other Than Capital Goods',
        vat_description: 'VATable - Goods Other Than Capital Goods',
        vat_status: 'ACTIVE'
      },
      {
        vat_code: 'VAT-CG',
        vat_name: 'VATable - Capital Goods',
        vat_rate: 12.00,
        vat_type: 'Vatable',
        vat_sub_type: 'Capital Goods',
        vat_description: 'VATable - Capital Goods',
        vat_status: 'ACTIVE'
      },
      {
        vat_code: 'NT-S',
        vat_name: 'Non-Taxable - Services',
        vat_rate: 0.00,
        vat_type: 'Exempt',
        vat_sub_type: 'Services',
        vat_description: 'Non-Taxable - Services',
        vat_status: 'ACTIVE'
      },
      {
        vat_code: 'NT-OCG',
        vat_name: 'Non-Taxable - Goods Other Than Capital Goods',
        vat_rate: 0.00,
        vat_type: 'Exempt',
        vat_sub_type: 'Goods Other Than Capital Goods',
        vat_description: 'Non-Taxable - Goods Other Than Capital Goods',
        vat_status: 'ACTIVE'
      },
      {
        vat_code: 'NT-CG',
        vat_name: 'Non-Taxable - Capital Goods',
        vat_rate: 0.00,
        vat_type: 'Exempt',
        vat_sub_type: 'Capital Goods',
        vat_description: 'Non-Taxable - Capital Goods',
        vat_status: 'ACTIVE'
      },
      {
        vat_code: 'EX-S',
        vat_name: 'Exempt - Services',
        vat_rate: 0.00,
        vat_type: 'Exempt',
        vat_sub_type: 'Services',
        vat_description: 'Exempt - Services',
        vat_status: 'ACTIVE'
      },
      {
        vat_code: 'EX-OCG',
        vat_name: 'Exempt - Goods Other Than Capital Goods',
        vat_rate: 0.00,
        vat_type: 'Exempt',
        vat_sub_type: 'Goods Other Than Capital Goods',
        vat_description: 'Exempt - Goods Other Than Capital Goods',
        vat_status: 'ACTIVE'
      },
      {
        vat_code: 'EX-CG',
        vat_name: 'Exempt - Capital Goods',
        vat_rate: 0.00,
        vat_type: 'Exempt',
        vat_sub_type: 'Capital Goods',
        vat_description: 'Exempt - Capital Goods',
        vat_status: 'ACTIVE'
      },
      {
        vat_code: 'No VAT',
        vat_name: 'No VAT%',
        vat_rate: 0.00,
        vat_type: 'Vatable',
        vat_sub_type: 'Goods Other Than Capital Goods',
        vat_description: 'No VAT%',
        vat_status: 'ACTIVE'
      },
      {
        vat_code: 'VAT12',
        vat_name: 'VAT 12%',
        vat_rate: 12.00,
        vat_type: 'Vatable',
        vat_sub_type: 'Goods Other Than Capital Goods',
        vat_description: 'Value Added Tax 12%',
        vat_status: 'ACTIVE'
      }
    ];

    await queryInterface.bulkInsert('vat', vatData);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('vat', {
      vat_code: [
        'ZR-S', 'ZR-OCG', 'ZR-CG', 'VAT-S', 'VAT-OCG', 'VAT-CG',
        'NT-S', 'NT-OCG', 'NT-CG', 'EX-S', 'EX-OCG', 'EX-CG',
        'No VAT', 'VAT12'
      ]
    });
  }
};
