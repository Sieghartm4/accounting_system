module.exports = {
  /**
   * 2307 certificates and the gap-resolution log.
   *
   * Certificates are per payee per tax year, and a payee can ask for a
   * replacement, so `tfc_generation` increments rather than the row being
   * overwritten. The superseded certificate is kept: a payee holding
   * generation 1 while generation 2 exists is a real situation that has to be
   * answerable.
   *
   * `tax_filing_gap` records every gap the user acknowledged to proceed. Because
   * the chosen policy is advisory, filing is never refused — but an accepted
   * filing has to carry the reason it was accepted, which is what this log is
   * for. Without it "warn but allow" is indistinguishable from "no checks".
   */
  async up(queryInterface, Sequelize) {
    if (!(await queryInterface.tableExists('tax_certificate'))) {
      await queryInterface.createTable('tax_certificate', {
        tfc_id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true,
          allowNull: false,
        },
        // The filing header for this certificate, so a certificate shares the
        // same period/status handling as every other form.
        tfc_filing_id: { type: Sequelize.INTEGER, allowNull: false },
        tfc_company_id: { type: Sequelize.INTEGER, allowNull: false },

        tfc_certificate_number: { type: Sequelize.STRING(40), allowNull: false },
        tfc_generation: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
        tfc_supersedes_id: { type: Sequelize.INTEGER, allowNull: true },

        tfc_tax_year: { type: Sequelize.INTEGER, allowNull: false },
        // Nullable on purpose. A row can exist for tax that really was withheld
        // but cannot be certified yet - the payee has not been selected, or the
        // TIN is unknown. That row is written with tfc_blocked = 1 and the reason
        // recorded, because dropping it would hide a liability the company owes.
        // A NOT NULL column here made every such save fail with
        // "Column 'tfc_payee_tin' cannot be null", which is how a 2307 for a
        // period with creditable withholding became unsaveable.
        tfc_payee_tin: { type: Sequelize.STRING(20), allowNull: true },
        tfc_payee_name: { type: Sequelize.STRING(180), allowNull: true },
        // The withholding agent, which on the printed certificate is the
        // company filing it rather than the taxpayer whose TIN is on top.
        tfc_agent_tin: { type: Sequelize.STRING(20), allowNull: true },
        tfc_agent_name: { type: Sequelize.STRING(180), allowNull: true },
        tfc_agent_address: { type: Sequelize.STRING(255), allowNull: true },
        tfc_rdo_code: { type: Sequelize.STRING(10), allowNull: true },

        tfc_total_payments: { type: Sequelize.DECIMAL(18, 2), allowNull: true },
        tfc_total_tax_withheld: { type: Sequelize.DECIMAL(18, 2), allowNull: true },

        tfc_status: {
          type: Sequelize.ENUM('issued', 'superseded', 'cancelled', 'reissued'),
          allowNull: false,
          defaultValue: 'issued',
        },
        tfc_issued_at: { type: Sequelize.DATEONLY, allowNull: true },
        // Set when a row exists but cannot be issued (missing TIN, unresolvable
        // base). The amounts are still recorded, because the tax really was
        // withheld even when the certificate cannot be produced.
        tfc_blocked: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
        tfc_blocked_reason: { type: Sequelize.TEXT, allowNull: true },

        tfc_created_by: { type: Sequelize.INTEGER, allowNull: true },
        tfc_created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        },
        tfc_updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'),
        },
      })

      const certificateIndexes = [
        { fields: ['tfc_filing_id'], name: 'idx_tax_certificate_filing_id' },
        { fields: ['tfc_company_id'], name: 'idx_tax_certificate_company_id' },
        { fields: ['tfc_payee_tin'], name: 'idx_tax_certificate_payee_tin' },
        { fields: ['tfc_tax_year'], name: 'idx_tax_certificate_tax_year' },
        {
          fields: ['tfc_certificate_number', 'tfc_generation'],
          unique: true,
          name: 'unique_tax_certificate_generation',
        },
      ]
      const existingCertificate = new Set(
        (await queryInterface.showIndex('tax_certificate')).map((i) => i.name),
      )
      for (const index of certificateIndexes) {
        if (!existingCertificate.has(index.name)) {
          await queryInterface.addIndex('tax_certificate', index.fields, index)
        }
      }

      await queryInterface.addConstraint('tax_certificate', {
        fields: ['tfc_filing_id'],
        type: 'foreign key',
        name: 'fk_tax_certificate_filing',
        onDelete: 'CASCADE',
        references: { table: 'tax_filing', field: 'tfg_id' },
      })
    }

    if (!(await queryInterface.tableExists('tax_filing_gap'))) {
      await queryInterface.createTable('tax_filing_gap', {
        tfp_id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true,
          allowNull: false,
        },
        tfp_filing_id: { type: Sequelize.INTEGER, allowNull: false },
        tfp_company_id: { type: Sequelize.INTEGER, allowNull: false },
        tfp_gap_key: { type: Sequelize.STRING(80), allowNull: false },
        tfp_severity: {
          type: Sequelize.ENUM('error', 'warning', 'info'),
          allowNull: false,
        },
        tfp_message: { type: Sequelize.TEXT, allowNull: true },
        tfp_detail: { type: Sequelize.JSON, allowNull: true },

        // Set when the accountant accepted the gap and filed anyway. An
        // unresolved row with no acknowledgement means the gap is still open.
        tfp_acknowledged: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
        tfp_acknowledged_by: { type: Sequelize.INTEGER, allowNull: true },
        tfp_acknowledged_at: { type: Sequelize.DATE, allowNull: true },
        tfp_acknowledgement_note: { type: Sequelize.TEXT, allowNull: true },
        tfp_resolved_at: { type: Sequelize.DATE, allowNull: true },
        tfp_created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        },
        tfp_updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'),
        },
      })

      const gapIndexes = [
        { fields: ['tfp_filing_id'], name: 'idx_tax_filing_gap_filing_id' },
        { fields: ['tfp_gap_key'], name: 'idx_tax_filing_gap_key' },
        { fields: ['tfp_acknowledged'], name: 'idx_tax_filing_gap_acknowledged' },
      ]
      const existingGap = new Set(
        (await queryInterface.showIndex('tax_filing_gap')).map((i) => i.name),
      )
      for (const index of gapIndexes) {
        if (!existingGap.has(index.name)) {
          await queryInterface.addIndex('tax_filing_gap', index.fields, index)
        }
      }

      await queryInterface.addConstraint('tax_filing_gap', {
        fields: ['tfp_filing_id'],
        type: 'foreign key',
        name: 'fk_tax_filing_gap_filing',
        onDelete: 'CASCADE',
        references: { table: 'tax_filing', field: 'tfg_id' },
      })
    }
  },

  async down(queryInterface) {
    await queryInterface.removeConstraint('tax_filing_gap', 'fk_tax_filing_gap_filing')
    await queryInterface.dropTable('tax_filing_gap')
    await queryInterface.removeConstraint('tax_certificate', 'fk_tax_certificate_filing')
    await queryInterface.dropTable('tax_certificate')
  },
}
