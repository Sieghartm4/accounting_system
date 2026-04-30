'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const withholdingTaxData = [
      {
        wt_code: 'WHTR',
        wt_name: 'WHT on Rent',
        wt_rate: 5.00,
        wt_tax_account: 'Withholding Tax - Expanded',
        wt_description: '',
        wt_status: 'ACTIVE'
      },
      {
        wt_code: 'WC120',
        wt_name: 'Income Payments to certain contractors - Corporate',
        wt_rate: 2.00,
        wt_tax_account: 'Withholding Tax - Expanded',
        wt_description: 'Income payments to certain contractors - Corporate',
        wt_status: 'ACTIVE'
      },
      {
        wt_code: 'NON-WHT',
        wt_name: 'NON-WHT',
        wt_rate: 0.00,
        wt_tax_account: 'Withholding Tax - Expanded',
        wt_description: 'NON-WHT',
        wt_status: 'ACTIVE'
      },
      {
        wt_code: 'WHTC',
        wt_name: 'Withholding Tax - Compensation',
        wt_rate: 1.00,
        wt_tax_account: 'Withholding Tax - Expanded',
        wt_description: '10400 - Withholding Tax - Compensation',
        wt_status: 'ACTIVE'
      },
      {
        wt_code: 'WI 158',
        wt_name: 'Withholding Tax - Expanded (Individuals - Goods)',
        wt_rate: 1.00,
        wt_tax_account: 'Withholding Tax - Expanded',
        wt_description: 'EWT- Income payments made by top 10,000 individuals to their local/resident supplier of goods',
        wt_status: 'ACTIVE'
      },
      {
        wt_code: 'WC 158',
        wt_name: 'Withholding Tax - Expanded (Corporations - Goods)',
        wt_rate: 1.00,
        wt_tax_account: 'Withholding Tax - Expanded',
        wt_description: 'EWT- Income payments made by top 10,000 public corporations to their local/resident supplier of goods',
        wt_status: 'ACTIVE'
      },
      {
        wt_code: 'WI 160',
        wt_name: 'Withholding Tax - Expanded (Individuals - Services)',
        wt_rate: 2.00,
        wt_tax_account: 'Withholding Tax - Expanded',
        wt_description: 'EWT- Income payments made by top 10,000 individuals to their local/resident supplier of services',
        wt_status: 'ACTIVE'
      },
      {
        wt_code: 'WC 160',
        wt_name: 'Withholding Tax - Expanded (Corporations- Goods)',
        wt_rate: 2.00,
        wt_tax_account: 'Withholding Tax - Expanded',
        wt_description: 'EWT- Income payments made by top 10,000 public corporations to their local/resident supplier of services',
        wt_status: 'ACTIVE'
      },
      {
        wt_code: 'WC157',
        wt_name: 'Income Payment made by NGAs, LGU, & etc',
        wt_rate: 2.00,
        wt_tax_account: 'Withholding Tax - Expanded',
        wt_description: 'Income Payment made by NGAs, LGU, & etc to its local/resident suppliers of services other than those covered by other rates of withholding tax',
        wt_status: 'ACTIVE'
      },
      {
        wt_code: 'WC100',
        wt_name: 'Rent',
        wt_rate: 5.00,
        wt_tax_account: 'Withholding Tax - Expanded',
        wt_description: 'Rent',
        wt_status: 'ACTIVE'
      },
      {
        wt_code: 'WI010',
        wt_name: 'Professional Fees (Lawyers,CPAs, Engineers, etc. )',
        wt_rate: 5.00,
        wt_tax_account: 'Withholding Tax - Expanded',
        wt_description: 'Professional Fees (Lawyers,CPAs, Engineers, etc. ) if the gross income for the current did not exceed P3M',
        wt_status: 'ACTIVE'
      },
      {
        wt_code: 'WV020',
        wt_name: 'VAT Withholding on Purchase of Services',
        wt_rate: 5.00,
        wt_tax_account: 'Withholding Tax - Expanded',
        wt_description: 'VAT Withholding on Purchase of Services',
        wt_status: 'ACTIVE'
      },
      {
        wt_code: 'WI050',
        wt_name: 'Management and technical consultants',
        wt_rate: 5.00,
        wt_tax_account: 'Withholding Tax - Expanded',
        wt_description: 'Management and technical consultants - if the gross income for the current year did not exceed P3M',
        wt_status: 'ACTIVE'
      },
      {
        wt_code: 'WV010',
        wt_name: 'VAT withholding on Purchase of Goods',
        wt_rate: 5.00,
        wt_tax_account: 'Withholding Tax - Expanded',
        wt_description: 'Applicable to Government Withholding Agent Only- VAT withholding on Purchase of Goods-',
        wt_status: 'ACTIVE'
      },
      {
        wt_code: 'WV010-WC157',
        wt_name: 'VAT withholding on Purchase of Goods & Income Payment made by NGAs, LGU, & etc',
        wt_rate: 7.00,
        wt_tax_account: 'Withholding Tax - Expanded',
        wt_description: 'Income Payment made by NGAs, LGU, & etc to its local/resident suppliers of services other than those covered by other rates of withholding tax VAT withholding on Purchase of Goods',
        wt_status: 'ACTIVE'
      },
      {
        wt_code: 'WI310',
        wt_name: 'On payments to oil exploration service contractors/sub-contractors',
        wt_rate: 8.00,
        wt_tax_account: 'Withholding Tax - Expanded',
        wt_description: 'On payments to oil exploration service contractors/sub-contractors',
        wt_status: 'ACTIVE'
      },
      {
        wt_code: 'WC310',
        wt_name: 'On payments to oil exploration service contractors/sub-contractors',
        wt_rate: 8.00,
        wt_tax_account: 'Withholding Tax - Expanded',
        wt_description: 'On payments to oil exploration service contractors/sub-contractors',
        wt_status: 'ACTIVE'
      },
      {
        wt_code: 'WC190',
        wt_name: 'Interest and other income payments on foreign currency transactions/loans payable of Offshore Banking Units (OBUs)',
        wt_rate: 10.00,
        wt_tax_account: 'Withholding Tax - Expanded',
        wt_description: 'Interest and other income payments on foreign currency transactions/loans payable of Offshore Banking Units (OBUs)',
        wt_status: 'ACTIVE'
      },
      {
        wt_code: 'WC191',
        wt_name: 'Interest and other income payments on foreign currency transactions/loans payable of Foreign Currency Deposits Units (FCDUs)',
        wt_rate: 10.00,
        wt_tax_account: 'Withholding Tax - Expanded',
        wt_description: 'Interest and other income payments on foreign currency transactions/loans payable of Foreign Currency Deposits Units (FCDUs)',
        wt_status: 'ACTIVE'
      },
      {
        wt_code: 'W1202',
        wt_name: 'Cash dividend payment by domestic corporation to citizens ans residents aliens/NRFCs',
        wt_rate: 10.00,
        wt_tax_account: 'Withholding Tax - Expanded',
        wt_description: 'Cash dividend payment by domestic corporation to citizens ans residents aliens/NRFCs',
        wt_status: 'ACTIVE'
      },
      {
        wt_code: 'WI203',
        wt_name: 'Property dividend payment by domestic corporation to citizens and resident aliens/NRFCs',
        wt_rate: 10.00,
        wt_tax_account: 'Withholding Tax - Expanded',
        wt_description: 'Property dividend payment by domestic corporation to citizens and resident aliens/NRFCs',
        wt_status: 'ACTIVE'
      },
      {
        wt_code: 'WI240',
        wt_name: 'Distributive share of individual partners in a taxable partnership, association, joint account or joint venture or consortium',
        wt_rate: 10.00,
        wt_tax_account: 'Withholding Tax - Expanded',
        wt_description: 'Royalties paid to citizens, resident aliens and nraetb on books, other literary works and musical compositions',
        wt_status: 'ACTIVE'
      },
      {
        wt_code: 'WI380',
        wt_name: 'Royalties paid to citizens, resident aliens and nraetb on books, other literary works and musical compositions',
        wt_rate: 10.00,
        wt_tax_account: 'Withholding Tax - Expanded',
        wt_description: 'Royalties paid to citizens, resident aliens and nraetb on books, other literary works and musical compositions',
        wt_status: 'ACTIVE'
      },
      {
        wt_code: 'WC010',
        wt_name: 'Professional fees',
        wt_rate: 10.00,
        wt_tax_account: 'Withholding Tax - Expanded',
        wt_description: 'Professional fees',
        wt_status: 'ACTIVE'
      },
      {
        wt_code: 'WI011',
        wt_name: 'Professional Fees (Lawyers,CPAs, Engineers, etc. )- 10%',
        wt_rate: 10.00,
        wt_tax_account: 'Withholding Tax - Expanded',
        wt_description: 'Professional Fees (Lawyers,CPAs, Engineers, etc. )- 10%',
        wt_status: 'ACTIVE'
      },
      {
        wt_code: 'WI 151',
        wt_name: 'EWT - Medical Service Providers',
        wt_rate: 10.00,
        wt_tax_account: 'Withholding Tax - Expanded',
        wt_description: 'EWT- payments for medical/dental /veterinary services thru hospitals/clinics/ health maintenance organizations, including direct payments to service providers',
        wt_status: 'ACTIVE'
      },
      {
        wt_code: 'WC222',
        wt_name: 'Cash dividend payment by domestic corporation to NFRCs whose countries allowed tax deemed paid credit (subject to tax sparing rule)',
        wt_rate: 15.00,
        wt_tax_account: 'Withholding Tax - Expanded',
        wt_description: 'Cash dividend payment by domestic corporation to NFRCs whose countries allowed tax deemed paid credit (subject to tax sparing rule)',
        wt_status: 'ACTIVE'
      },
      {
        wt_code: 'WC223',
        wt_name: 'Property dividend payment by domestic corporation to NFRCs whose countries allowed tax deemed paid credit (subject to tax sparing rule)',
        wt_rate: 15.00,
        wt_tax_account: 'Withholding Tax - Expanded',
        wt_description: 'Property dividend payment by domestic corporation to NFRCs whose countries allowed tax deemed paid credit (subject to tax sparing rule)',
        wt_status: 'ACTIVE'
      },
      {
        wt_code: 'WC280',
        wt_name: 'Branch profit remittance by all corporations except PEZA/SBMA/CDA registered',
        wt_rate: 15.00,
        wt_tax_account: 'Withholding Tax - Expanded',
        wt_description: 'Branch profit remittance by all corporations except PEZA/SBMA/CDA registered',
        wt_status: 'ACTIVE'
      },
      {
        wt_code: 'WC051',
        wt_name: 'Management and Technical Consultants',
        wt_rate: 15.00,
        wt_tax_account: 'Withholding Tax - Expanded',
        wt_description: 'Management and Technical Consultants',
        wt_status: 'ACTIVE'
      },
      {
        wt_code: 'WI224',
        wt_name: 'Cash dividend payment by domestic corporation to non-resident alien engaged in Trade or Business within the Philippines (NRAETB)',
        wt_rate: 20.00,
        wt_tax_account: 'Withholding Tax - Expanded',
        wt_description: 'Cash dividend payment by domestic corporation to non-resident alien engaged in Trade or Business within the Philippines (NRAETB)',
        wt_status: 'ACTIVE'
      },
      {
        wt_code: 'WI225',
        wt_name: 'Property dividend payment by domestic corporation to NRAETB',
        wt_rate: 20.00,
        wt_tax_account: 'Withholding Tax - Expanded',
        wt_description: 'Property dividend payment by domestic corporation to NRAETB',
        wt_status: 'ACTIVE'
      },
      {
        wt_code: 'WI226',
        wt_name: 'Share of NRAETB in the distributable net income after tax of a partnership (except GPPs) of which he is a partner, or share in the net income after tax of an association, joint account or a j',
        wt_rate: 20.00,
        wt_tax_account: 'Withholding Tax - Expanded',
        wt_description: 'Share of NRAETB in the distributable net income after tax of a partnership (except GPPs) of which he is a partner, or share in the net income after tax of an association, joint account or a joint venture taxable as a corporation of which he is a member or a co-venturer',
        wt_status: 'ACTIVE'
      },
      {
        wt_code: 'WI250',
        wt_name: 'All kinds of royalty payments to citizens, resident aliens and NRAETB (other than WI380 and WI341), domestic and resident foreign corporations',
        wt_rate: 20.00,
        wt_tax_account: 'Withholding Tax - Expanded',
        wt_description: 'All kinds of royalty payments to citizens, resident aliens and NRAETB (other than WI380 and WI341), domestic and resident foreign corporations',
        wt_status: 'ACTIVE'
      },
      {
        wt_code: 'WC250',
        wt_name: 'All kinds of royalty payments to citizens, resident aliens and NRAETB (other than WI380 and WI341), domestic and resident foreign corporations',
        wt_rate: 20.00,
        wt_tax_account: 'Withholding Tax - Expanded',
        wt_description: 'All kinds of royalty payments to citizens, resident aliens and NRAETB (other than WI380 and WI341), domestic and resident foreign corporations',
        wt_status: 'ACTIVE'
      },
      {
        wt_code: 'WI330',
        wt_name: 'Payments to non-resident alien not engage in trade or business within the Philippines (NRANETB) except on sale of shares in domestic corporation and real property',
        wt_rate: 25.00,
        wt_tax_account: 'Withholding Tax - Expanded',
        wt_description: 'Payments to non-resident alien not engage in trade or business within the Philippines (NRANETB) except on sale of shares in domestic corporation and real property',
        wt_status: 'ACTIVE'
      },
      {
        wt_code: 'WI340',
        wt_name: 'On payments to non-residnet individual/foreign corporate cinematographic film owners, lessors or distributors',
        wt_rate: 25.00,
        wt_tax_account: 'Withholding Tax - Expanded',
        wt_description: 'On payments to non-residnet individual/foreign corporate cinematographic film owners, lessors or distributors',
        wt_status: 'ACTIVE'
      },
      {
        wt_code: 'WC340',
        wt_name: 'On payments to non-residnet individual/foreign corporate cinematographic film owners, lessors or distributors',
        wt_rate: 25.00,
        wt_tax_account: 'Withholding Tax - Expanded',
        wt_description: 'On payments to non-residnet individual/foreign corporate cinematographic film owners, lessors or distributors',
        wt_status: 'ACTIVE'
      },
      {
        wt_code: 'WI341',
        wt_name: 'Royalties paid to NRAETB on cinematographic films and similar works',
        wt_rate: 25.00,
        wt_tax_account: 'Withholding Tax - Expanded',
        wt_description: 'Royalties paid to NRAETB on cinematographic films and similar works',
        wt_status: 'ACTIVE'
      },
      {
        wt_code: 'WC212',
        wt_name: 'Cash dividend payment by domestic corporation to citizens ans residents aliens/NRFCs',
        wt_rate: 30.00,
        wt_tax_account: 'Withholding Tax - Expanded',
        wt_description: 'Cash dividend payment by domestic corporation to citizens ans residents aliens/NRFCs',
        wt_status: 'ACTIVE'
      },
      {
        wt_code: 'WC213',
        wt_name: 'Property dividend payment by domestic corporation to citizens and resident aliens/NRFCs',
        wt_rate: 30.00,
        wt_tax_account: 'Withholding Tax - Expanded',
        wt_description: 'Property dividend payment by domestic corporation to citizens and resident aliens/NRFCs',
        wt_status: 'ACTIVE'
      },
      {
        wt_code: 'WC230',
        wt_name: 'On other payments to NRFCs',
        wt_rate: 30.00,
        wt_tax_account: 'Withholding Tax - Expanded',
        wt_description: 'On other payments to NRFCs',
        wt_status: 'ACTIVE'
      },
      {
        wt_code: 'WI350',
        wt_name: 'Final tax on interest or other payments upon tax-free covenant bonds, mortgages, deeds of trust or other obligations under Sec. 57C of the NIRC of 1997, as amended',
        wt_rate: 30.00,
        wt_tax_account: 'Withholding Tax - Expanded',
        wt_description: 'Final tax on interest or other payments upon tax-free covenant bonds, mortgages, deeds of trust or other obligations under Sec. 57C of the NIRC of 1997, as amended',
        wt_status: 'ACTIVE'
      },
      {
        wt_code: 'WC290',
        wt_name: 'On the gross rentals, lease and charter fees derived by non-resident owner or lessor of foreign vessels',
        wt_rate: 45.00,
        wt_tax_account: 'Withholding Tax - Expanded',
        wt_description: 'On the gross rentals, lease and charter fees derived by non-resident owner or lessor of foreign vessels',
        wt_status: 'ACTIVE'
      },
      {
        wt_code: 'WC300',
        wt_name: 'On gross rentals, charter and other fees derived by non-resident lessor or aircraft, machineries and equipment',
        wt_rate: 75.00,
        wt_tax_account: 'Withholding Tax - Expanded',
        wt_description: 'On gross rentals, charter and other fees derived by non-resident lessor or aircraft, machineries and equipment',
        wt_status: 'ACTIVE'
      }
    ];

    await queryInterface.bulkInsert('withholding_tax', withholdingTaxData);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('withholding_tax', {
      wt_code: [
        'WHTR', 'WC120', 'NON-WHT', 'WHTC', 'WI 158', 'WC 158', 'WI 160', 'WC 160',
        'WC157', 'WC100', 'WI010', 'WV020', 'WI050', 'WV010', 'WV010-WC157', 'WI310',
        'WC310', 'WC190', 'WC191', 'W1202', 'WI203', 'WI240', 'WI380', 'WC010',
        'WI011', 'WI 151', 'WC222', 'WC223', 'WC280', 'WC051', 'WI224', 'WI225',
        'WI226', 'WI250', 'WC250', 'WI330', 'WI340', 'WC340', 'WI341', 'WC212',
        'WC213', 'WC230', 'WI350', 'WC290', 'WC300'
      ]
    });
  }
};
