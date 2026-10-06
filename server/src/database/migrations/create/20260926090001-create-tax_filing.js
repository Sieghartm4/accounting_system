module.exports = {
  /**
   * Tax filing header, normalized.
   *
   * Additive only: the legacy `tax_forms` table and its JSON blob are left
   * untouched so existing rows keep working during the transition. This table
   * is keyed by form_code + period + company, which is what the dispatcher
   * actually resolves a return by, and it stores the period as dates rather
   * than a blob so a filing can be found by period without parsing JSON.
   *
   * `tfg_status` deliberately extends the legacy vocabulary. A filing can be
   * blocked (acknowledged gaps present) or nil (a real return filed at zero),
   * and neither of those has anywhere to live in the legacy ENUM.
   */
  async up(queryInterface, Sequelize) {
    if (await queryInterface.tableExists('tax_filing')) return

    await queryInterface.createTable('tax_filing', {
      tfg_id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      tfg_form_code: { type: Sequelize.STRING(30), allowNull: false },
      tfg_company_id: { type: Sequelize.INTEGER, allowNull: false },
      tfg_user_id: { type: Sequelize.INTEGER, allowNull: false },

      // The period as filed. For a 2307 this is the tax year; for everything
      // else it is the resolved window from the form's period basis.
      tfg_period_start: { type: Sequelize.DATEONLY, allowNull: false },
      tfg_period_end: { type: Sequelize.DATEONLY, allowNull: false },
      tfg_period_type: {
        type: Sequelize.ENUM('MONTH', 'QUARTER', 'YEAR', 'CREDENTIAL'),
        allowNull: false,
      },
      tfg_period_label: { type: Sequelize.STRING(80), allowNull: true },

      // The catalog revision the filing was prepared against. If the catalog
      // changes (rate table, line schema, deadline) the filing keeps a record
      // of what it was computed under instead of silently looking current.
      tfg_catalog_revision: { type: Sequelize.STRING(40), allowNull: true },

      tfg_status: {
        type: Sequelize.ENUM(
          'draft',
          'computed',
          'acknowledged',
          'filed',
          'filed_with_bir',
          'rejected',
          'superseded',
        ),
        allowNull: false,
        defaultValue: 'draft',
      },

      // Advisory, not enforcement: a filing with unresolved data gaps is never
      // refused. These columns record that the gaps were seen and why the user
      // proceeded anyway.
      tfg_has_blocking_gaps: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      tfg_acknowledged_by: { type: Sequelize.INTEGER, allowNull: true },
      tfg_acknowledged_at: { type: Sequelize.DATE, allowNull: true },
      tfg_acknowledgement_note: { type: Sequelize.TEXT, allowNull: true },

      tfg_amount_paid: { type: Sequelize.DECIMAL(18, 2), allowNull: true },
      tfg_amount_still_due: { type: Sequelize.DECIMAL(18, 2), allowNull: true },
      tfg_filed_at: { type: Sequelize.DATE, allowNull: true },
      tfg_reference_no: { type: Sequelize.STRING(80), allowNull: true },

      // A 2307 is keyed by payee, so the certificate table hangs off the same
      // filing header rather than duplicating the period columns.
      tfg_payee_tin: { type: Sequelize.STRING(20), allowNull: true },
      tfg_payee_name: { type: Sequelize.STRING(180), allowNull: true },

      tfg_computed_at: { type: Sequelize.DATE, allowNull: true },
      tfg_created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      tfg_updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'),
      },
    })

    const indexes = [
      { fields: ['tfg_form_code'], name: 'idx_tax_filing_form_code' },
      { fields: ['tfg_company_id'], name: 'idx_tax_filing_company_id' },
      { fields: ['tfg_status'], name: 'idx_tax_filing_status' },
      { fields: ['tfg_period_start'], name: 'idx_tax_filing_period_start' },
      // One filing per form per company per period. Re-filing is modelled as a
      // status change on the same row, not as a second row, so the period is
      // unique rather than the form+company pair.
      {
        fields: ['tfg_form_code', 'tfg_company_id', 'tfg_period_start', 'tfg_period_end', 'tfg_payee_tin'],
        unique: true,
        name: 'unique_tax_filing_period',
      },
    ]

    const existing = new Set((await queryInterface.showIndex('tax_filing')).map((i) => i.name))
    for (const index of indexes) {
      if (!existing.has(index.name)) {
        await queryInterface.addIndex('tax_filing', index.fields, index)
      }
    }
  },

  async down(queryInterface) {
    await queryInterface.dropTable('tax_filing')
  },
}
