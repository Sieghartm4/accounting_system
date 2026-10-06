module.exports = {
  /**
   * The form registry and the taxpayer profile.
   *
   * `tax_form_registry` is the DB-backed registry: it holds which forms exist,
   * their presentation (headers, line schema, column layout, deadline) and
   * whether they are active. The seeder syncs it from the code catalog, and
   * `tax/registry.service.js` reads from here.
   *
   * IMPORTANT LIMIT, stated here because it is easy to get wrong: the
   * `tfr_applicability` column stores a DECLARATIVE MIRROR of the rules for
   * display and audit. The rules that actually evaluate are JavaScript
   * functions in `services/tax/catalog.js` and cannot be serialized. The
   * registry service therefore always evaluates through the in-process catalog
   * and uses this column only to show a human-readable mirror. If the mirror
   * and the code disagree, `detectDrift` reports it rather than letting the two
   * silently disagree at filing time.
   *
   * `tax_profile` holds the per-company tax facts the applicability rules read
   * (taxpayer type, VAT registration, fiscal year end, RDO code). This is a new
   * table rather than new columns on master_company so the tax module owns its
   * own inputs and no existing table has to be altered.
   */
  async up(queryInterface, Sequelize) {
    if (!(await queryInterface.tableExists('tax_form_registry'))) {
      await queryInterface.createTable('tax_form_registry', {
        tfr_id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true,
          allowNull: false,
        },
        tfr_form_code: { type: Sequelize.STRING(30), allowNull: false },
        tfr_category: { type: Sequelize.STRING(40), allowNull: false },
        tfr_title: { type: Sequelize.STRING(255), allowNull: false },
        tfr_short_title: { type: Sequelize.STRING(120), allowNull: true },
        // Wide enough for a full revision string. The longest catalog value is
        // "BIR Form 1701 (rev. 2018, as amended by CREATE)" at 47 characters,
        // and revision notes grow every time the BIR amends a form, so this is
        // sized for headroom rather than to the current maximum.
        tfr_form_revision: { type: Sequelize.STRING(120), allowNull: true },

        tfr_frequency: { type: Sequelize.STRING(20), allowNull: false },
        tfr_period_basis: { type: Sequelize.STRING(30), allowNull: false },
        tfr_follows_fiscal_year: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
        tfr_computation_key: { type: Sequelize.STRING(50), allowNull: true },

        tfr_is_declaration: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
        tfr_is_filable: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },

        tfr_deadline_day: { type: Sequelize.INTEGER, allowNull: true },
        tfr_deadline_offset_months: { type: Sequelize.INTEGER, allowNull: true },
        tfr_deadline_grace_weekend_to: { type: Sequelize.INTEGER, allowNull: true },

        tfr_prerequisite_forms: { type: Sequelize.JSON, allowNull: true },
        tfr_export_profiles: { type: Sequelize.JSON, allowNull: true },
        tfr_header_fields: { type: Sequelize.JSON, allowNull: true },
        tfr_line_schema: { type: Sequelize.JSON, allowNull: true },
        tfr_columns: { type: Sequelize.JSON, allowNull: true },
        // Declarative mirror only. See the note at the top of this file.
        tfr_applicability: { type: Sequelize.JSON, allowNull: true },
        tfr_notes: { type: Sequelize.TEXT, allowNull: true },

        // Bumped when the catalog changes so a filing can record which revision
        // it was prepared under.
        tfr_catalog_revision: { type: Sequelize.STRING(40), allowNull: true },
        tfr_status: {
          type: Sequelize.ENUM('active', 'retired'),
          allowNull: false,
          defaultValue: 'active',
        },
        tfr_synced_at: { type: Sequelize.DATE, allowNull: true },
        tfr_created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        },
        tfr_updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'),
        },
      })

      const indexes = [
        { fields: ['tfr_form_code'], unique: true, name: 'unique_tax_form_registry_code' },
        { fields: ['tfr_category'], name: 'idx_tax_form_registry_category' },
        { fields: ['tfr_status'], name: 'idx_tax_form_registry_status' },
        { fields: ['tfr_computation_key'], name: 'idx_tax_form_registry_computation_key' },
      ]
      const existing = new Set(
        (await queryInterface.showIndex('tax_form_registry')).map((i) => i.name),
      )
      for (const index of indexes) {
        if (!existing.has(index.name)) {
          await queryInterface.addIndex('tax_form_registry', index.fields, index)
        }
      }
    }

    if (!(await queryInterface.tableExists('tax_profile'))) {
      await queryInterface.createTable('tax_profile', {
        txp_id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true,
          allowNull: false,
        },
        txp_company_id: { type: Sequelize.INTEGER, allowNull: false },

        // The three facts the applicability engine treats as required for a
        // confident answer. NULL here means "unknown", which the engine reports
        // as incomplete rather than assuming.
        txp_taxpayer_type: { type: Sequelize.STRING(30), allowNull: true },
        txp_vat_registered: { type: Sequelize.BOOLEAN, allowNull: true },
        txp_subject_to_income_tax: { type: Sequelize.BOOLEAN, allowNull: true },

        // 1-12; 12 or NULL means a calendar year. Drives FISCAL_* period bases.
        txp_fiscal_year_end_month: { type: Sequelize.INTEGER, allowNull: true },

        txp_rdo_code: { type: Sequelize.STRING(10), allowNull: true },
        txp_rdo_name: { type: Sequelize.STRING(180), allowNull: true },
        txp_tin: { type: Sequelize.STRING(20), allowNull: true },
        txp_legal_name: { type: Sequelize.STRING(180), allowNull: true },
        txp_registered_address: { type: Sequelize.STRING(255), allowNull: true },

        // Withholding roles, as distinct from being a corporation.
        txp_ewt_remitter: { type: Sequelize.BOOLEAN, allowNull: true },
        txp_withholding_agent_for_compensation: { type: Sequelize.BOOLEAN, allowNull: true },
        txp_has_creditable_withheld: { type: Sequelize.BOOLEAN, allowNull: true },

        // eFPS / eAccounting channel, needed by the exporters.
        txp_efps_channel: {
          type: Sequelize.ENUM('efps', 'eaccounting', 'both'),
          allowNull: true,
        },

        txp_confirmed_by: { type: Sequelize.INTEGER, allowNull: true },
        txp_confirmed_at: { type: Sequelize.DATE, allowNull: true },
        txp_created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        },
        txp_updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'),
        },
      })

      const profileIndexes = [
        { fields: ['txp_company_id'], unique: true, name: 'unique_tax_profile_company' },
      ]
      const existingProfile = new Set(
        (await queryInterface.showIndex('tax_profile')).map((i) => i.name),
      )
      for (const index of profileIndexes) {
        if (!existingProfile.has(index.name)) {
          await queryInterface.addIndex('tax_profile', index.fields, index)
        }
      }
    }
  },

  async down(queryInterface) {
    await queryInterface.dropTable('tax_profile')
    await queryInterface.dropTable('tax_form_registry')
  },
}
