module.exports = {
  /**
   * Normalized filing lines, replacing the legacy JSON blob for new filings.
   *
   * The row is keyed by the line `key` from the catalog's line_schema, not by a
   * line number, because BIR renumbers lines between revisions while the key
   * stays stable. The line number actually filed is kept alongside it as
   * `tfl_line_number` so a print/PDF export can reproduce the official layout
   * without the schema being the authority on ordering.
   *
   * A NULL value is meaningful here: it records that the computation could not
   * produce the figure. It is NOT a zero, and the reporting layer must not
   * coalesce it to one.
   */
  async up(queryInterface, Sequelize) {
    if (await queryInterface.tableExists('tax_filing_line')) return

    await queryInterface.createTable('tax_filing_line', {
      tfl_id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      tfl_filing_id: { type: Sequelize.INTEGER, allowNull: false },
      tfl_company_id: { type: Sequelize.INTEGER, allowNull: false },

      tfl_form_code: { type: Sequelize.STRING(30), allowNull: false },
      tfl_line_key: { type: Sequelize.STRING(80), allowNull: false },
      tfl_line_number: { type: Sequelize.INTEGER, allowNull: true },
      tfl_section: { type: Sequelize.STRING(40), allowNull: true },
      tfl_label: { type: Sequelize.STRING(255), allowNull: true },

      // 'computed' | 'subtotal' | 'input' | 'declaration' mirrors the catalog's
      // line kind, so a UI can distinguish a derived figure from a value the
      // accountant typed without hardcoding per-form rules.
      tfl_kind: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'computed' },
      tfl_emphasis: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },

      tfl_value: { type: Sequelize.DECIMAL(18, 2), allowNull: true },
      tfl_value_text: { type: Sequelize.STRING(255), allowNull: true },

      // Quarterly forms file a per-column breakdown. Stored as a small JSON
      // object keyed by the catalog's column keys rather than a second table,
      // because the column set is per-form and already declared in the catalog.
      tfl_columns: { type: Sequelize.JSON, allowNull: true },

      // Why this line is null, or why it is being flagged. This is the audit
      // trail behind every number the accountant accepted.
      tfl_gap_key: { type: Sequelize.STRING(80), allowNull: true },
      tfl_is_override: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      tfl_override_note: { type: Sequelize.TEXT, allowNull: true },

      tfl_created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      tfl_updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'),
      },
    })

    const indexes = [
      { fields: ['tfl_filing_id'], name: 'idx_tax_filing_line_filing_id' },
      { fields: ['tfl_company_id'], name: 'idx_tax_filing_line_company_id' },
      {
        fields: ['tfl_filing_id', 'tfl_line_key'],
        unique: true,
        name: 'unique_tax_filing_line_key',
      },
    ]

    const existing = new Set((await queryInterface.showIndex('tax_filing_line')).map((i) => i.name))
    for (const index of indexes) {
      if (!existing.has(index.name)) {
        await queryInterface.addIndex('tax_filing_line', index.fields, index)
      }
    }

    await queryInterface.addConstraint('tax_filing_line', {
      fields: ['tfl_filing_id'],
      type: 'foreign key',
      name: 'fk_tax_filing_line_filing',
      onDelete: 'CASCADE',
      references: { table: 'tax_filing', field: 'tfg_id' },
    })
  },

  async down(queryInterface) {
    await queryInterface.removeConstraint('tax_filing_line', 'fk_tax_filing_line_filing')
    await queryInterface.dropTable('tax_filing_line')
  },
}
