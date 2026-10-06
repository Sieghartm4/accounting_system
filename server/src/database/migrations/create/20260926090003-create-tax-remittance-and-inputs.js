module.exports = {
  /**
   * Remittances and manual inputs.
   *
   * These are the two things the ledger cannot produce and the computation
   * modules refuse to invent:
   *
   *   tax_remittance  - money actually remitted for a period. The 1601-EQ /
   *                     1601-C "tax still due" figures are the difference
   *                     between what was withheld and what was remitted, so a
   *                     missing remittance row must be reported as missing
   *                     rather than as zero.
   *   tax_input       - election-driven and prior-year figures (prior-year
   *                     credit, OSD vs itemized election, 1701-Q preceding
   *                     quarter income, the 1702 graduated/flat election).
   *
   * Both are keyed per company so the values are reusable across forms and
   * periods, with the period recorded so a re-used figure is visible.
   */
  async up(queryInterface, Sequelize) {
    if (!(await queryInterface.tableExists('tax_remittance'))) {
      await queryInterface.createTable('tax_remittance', {
        trm_id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true,
          allowNull: false,
        },
        trm_company_id: { type: Sequelize.INTEGER, allowNull: false },
        trm_form_code: { type: Sequelize.STRING(30), allowNull: true },
        trm_period_start: { type: Sequelize.DATEONLY, allowNull: false },
        trm_period_end: { type: Sequelize.DATEONLY, allowNull: false },
        trm_month: { type: Sequelize.STRING(7), allowNull: true },

        // `amount` is the amount remitted. `overpayment` is the excess shown on
        // a prior return that carries forward as this period's credit; it is
        // stored rather than inferred so a credit cannot appear from nowhere.
        trm_amount_remitted: { type: Sequelize.DECIMAL(18, 2), allowNull: true },
        trm_amount_paid: { type: Sequelize.DECIMAL(18, 2), allowNull: true },
        trm_overpayment: { type: Sequelize.DECIMAL(18, 2), allowNull: false, defaultValue: 0 },

        trm_payee_name: { type: Sequelize.STRING(180), allowNull: true },
        trm_reference_no: { type: Sequelize.STRING(80), allowNull: true },
        trm_remitted_at: { type: Sequelize.DATEONLY, allowNull: true },
        trm_source: {
          type: Sequelize.ENUM('manual', 'imported', 'derived'),
          allowNull: false,
          defaultValue: 'manual',
        },
        trm_note: { type: Sequelize.TEXT, allowNull: true },
        trm_created_by: { type: Sequelize.INTEGER, allowNull: true },
        trm_created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        },
        trm_updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'),
        },
      })

      const remittanceIndexes = [
        { fields: ['trm_company_id'], name: 'idx_tax_remittance_company_id' },
        { fields: ['trm_period_start'], name: 'idx_tax_remittance_period_start' },
        {
          fields: ['trm_company_id', 'trm_form_code', 'trm_period_start', 'trm_period_end'],
          name: 'idx_tax_remittance_lookup',
        },
      ]
      const existingRemittance = new Set(
        (await queryInterface.showIndex('tax_remittance')).map((i) => i.name),
      )
      for (const index of remittanceIndexes) {
        if (!existingRemittance.has(index.name)) {
          await queryInterface.addIndex('tax_remittance', index.fields, index)
        }
      }
    }

    if (!(await queryInterface.tableExists('tax_input'))) {
      await queryInterface.createTable('tax_input', {
        txi_id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true,
          allowNull: false,
        },
        txi_company_id: { type: Sequelize.INTEGER, allowNull: false },
        txi_form_code: { type: Sequelize.STRING(30), allowNull: true },
        txi_input_key: { type: Sequelize.STRING(80), allowNull: false },
        txi_period_start: { type: Sequelize.DATEONLY, allowNull: true },
        txi_period_end: { type: Sequelize.DATEONLY, allowNull: true },

        // A text column, not DECIMAL: several inputs are elections
        // (GRADUATED / FLAT_PROFESSIONAL, OSD / ITEMIZED), and the number is
        // carried in txi_value_number when the input is numeric.
        txi_value_text: { type: Sequelize.STRING(255), allowNull: true },
        txi_value_number: { type: Sequelize.DECIMAL(18, 2), allowNull: true },
        txi_value_date: { type: Sequelize.DATEONLY, allowNull: true },

        txi_source: {
          type: Sequelize.ENUM('manual', 'prior_filing', 'imported'),
          allowNull: false,
          defaultValue: 'manual',
        },
        // Which prior return the figure was carried from, so "prior year
        // credit" is traceable to a specific filing rather than being a number
        // someone typed once.
        txi_source_filing_id: { type: Sequelize.INTEGER, allowNull: true },
        txi_note: { type: Sequelize.TEXT, allowNull: true },
        txi_created_by: { type: Sequelize.INTEGER, allowNull: true },
        txi_created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        },
        txi_updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'),
        },
      })

      const inputIndexes = [
        { fields: ['txi_company_id'], name: 'idx_tax_input_company_id' },
        { fields: ['txi_input_key'], name: 'idx_tax_input_key' },
        {
          fields: ['txi_company_id', 'txi_input_key', 'txi_period_start', 'txi_period_end'],
          unique: true,
          name: 'unique_tax_input_key_period',
        },
      ]
      const existingInput = new Set((await queryInterface.showIndex('tax_input')).map((i) => i.name))
      for (const index of inputIndexes) {
        if (!existingInput.has(index.name)) {
          await queryInterface.addIndex('tax_input', index.fields, index)
        }
      }
    }
  },

  async down(queryInterface) {
    await queryInterface.dropTable('tax_input')
    await queryInterface.dropTable('tax_remittance')
  },
}
