/**
 * Sequence Settings
 *
 * One row per transaction module per tenant database: the document-number
 * prefix template a company wants for its receipt / disbursement / sales /
 * collection / purchase / payment / adjustment ids.
 *
 * Company scope is the tenant database itself (same as every master table) -
 * one row set per company, shared by all its users, which is why there is no
 * company_id column here. Defaults match the ids the generators have always
 * produced, so nothing changes until a company edits its sequences.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('sequence_settings', {
      ss_id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      ss_module: {
        type: Sequelize.STRING(40),
        allowNull: false,
        unique: true,
      },
      ss_prefix: {
        type: Sequelize.STRING(10),
        allowNull: false,
      },
      ss_date_format: {
        // '' (no date group), MMDDYY (legacy default), YYMMDD, YYYYMMDD
        type: Sequelize.STRING(10),
        allowNull: false,
        defaultValue: 'MMDDYY',
      },
      ss_padding: {
        // digits the running number is zero-padded to
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 4,
      },
      ss_next_sequence: {
        // seed used when a prefix group has no document yet; afterwards the
        // sequence continues from the newest document in that group.
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },
      ss_created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      ss_updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'),
      },
    })
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('sequence_settings')
  },
}
