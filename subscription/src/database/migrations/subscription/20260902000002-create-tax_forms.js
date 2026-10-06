module.exports = {
  async up(queryInterface, Sequelize) {
    if (!(await queryInterface.tableExists('tax_forms'))) {
      await queryInterface.createTable('tax_forms', {
        tf_id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true,
          allowNull: false,
        },
        tf_form_type: { type: Sequelize.STRING(50), allowNull: false },
        tf_user_id: { type: Sequelize.INTEGER, allowNull: false },
        tf_company_id: { type: Sequelize.INTEGER, allowNull: false },
        tf_start_date: { type: Sequelize.DATEONLY, allowNull: false },
        tf_end_date: { type: Sequelize.DATEONLY, allowNull: false },
        tf_form_data: { type: Sequelize.TEXT('long'), allowNull: false },
        tf_status: {
          type: Sequelize.ENUM('draft', 'filed', 'filed_with_bir', 'rejected'),
          allowNull: false,
          defaultValue: 'draft',
        },
        tf_created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        },
        tf_updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal(
            'CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
          ),
        },
      })
    }

    const indexes = [
      { fields: ['tf_form_type'], name: 'idx_tax_forms_form_type' },
      { fields: ['tf_user_id'], name: 'idx_tax_forms_user_id' },
      { fields: ['tf_company_id'], name: 'idx_tax_forms_company_id' },
      { fields: ['tf_status'], name: 'idx_tax_forms_status' },
      {
        fields: ['tf_form_type', 'tf_company_id', 'tf_start_date', 'tf_end_date'],
        unique: true,
        name: 'unique_tax_form_period',
      },
    ]

    const existingIndexes = await queryInterface.showIndex('tax_forms')
    const existingNames = new Set(existingIndexes.map((index) => index.name))

    for (const index of indexes) {
      if (!existingNames.has(index.name)) {
        await queryInterface.addIndex('tax_forms', index.fields, index)
      }
    }
  },

  async down(queryInterface) {
    await queryInterface.dropTable('tax_forms')
  },
}
