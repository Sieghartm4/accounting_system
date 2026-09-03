'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const itemTables = {
      sales_items: {
        si_id: {
          type: 'STRING(300)',
          allowNull: false,
          primaryKey: true,
          autoIncrement: false,
        },
        si_sales_id: { type: 'STRING(300)', allowNull: false },
        si_product_service: { type: 'STRING(300)', allowNull: true },
        si_charts_of_accounts: { type: 'INTEGER', allowNull: false },
        si_description: { type: 'TEXT(long)', allowNull: true },
        si_quantity: { type: 'INTEGER', allowNull: true },
        si_sales_price: { type: 'NUMERIC', allowNull: false },
        si_discount: { type: 'DECIMAL(18,2)', allowNull: false },
        si_discount_type: { type: "ENUM('PERCENT','FIXED')", allowNull: true },
        si_vat: { type: 'DECIMAL(18,2)', allowNull: false },
        si_witholding_tax: { type: 'DECIMAL(18,2)', allowNull: false },
        si_responsibility_center: { type: 'STRING(300)', allowNull: false },
      },
      collection_items: {
        ci_id: {
          type: 'INTEGER',
          allowNull: false,
          primaryKey: true,
          autoIncrement: true,
        },
        ci_collection_id: { type: 'STRING(300)', allowNull: false },
        ci_sales_id: { type: 'STRING(300)', allowNull: false },
        ci_amount: { type: 'NUMERIC', allowNull: false },
        ci_witholding_tax: { type: 'DECIMAL(18,2)', allowNull: false },
      },
      purchase_items: {
        pi_id: {
          type: 'STRING(300)',
          allowNull: false,
          primaryKey: true,
          autoIncrement: false,
        },
        pi_purchase_id: { type: 'STRING(300)', allowNull: false },
        pi_product_service: { type: 'STRING(300)', allowNull: true },
        pi_charts_of_accounts: { type: 'INTEGER', allowNull: true },
        pi_description: { type: 'TEXT(long)', allowNull: true },
        pi_quantity: { type: 'INTEGER', allowNull: true },
        pi_purchase_price: { type: 'NUMERIC', allowNull: true },
        pi_discount: { type: 'DECIMAL(18,2)', allowNull: true },
        pi_discount_type: { type: "ENUM('PERCENT','FIXED')", allowNull: true },
        pi_vat: { type: 'DECIMAL(18,2)', allowNull: true },
        pi_witholding_tax: { type: 'DECIMAL(18,2)', allowNull: true },
        pi_responsibility_center: { type: 'STRING(300)', allowNull: true },
      },
      payment_items: {
        ci_id: {
          type: 'INTEGER',
          allowNull: false,
          primaryKey: true,
          autoIncrement: true,
        },
        ci_payment_id: { type: 'STRING(300)', allowNull: false },
        ci_purchase_id: { type: 'STRING(300)', allowNull: true },
        ci_amount: { type: 'NUMERIC', allowNull: false },
        ci_witholding_tax: { type: 'DECIMAL(18,2)', allowNull: true },
      },
    }

    const normalize = (value) => String(value).toUpperCase().replace(/\s/g, '')
    const typeMatches = (actual, expected) => {
      const actualType = normalize(actual)
      const expectedType = normalize(expected)

      if (expectedType === 'STRING(300)') return actualType === 'VARCHAR(300)'
      if (expectedType === 'TEXT(LONG)') return actualType === 'LONGTEXT'
      if (expectedType === 'NUMERIC') {
        return actualType === 'DECIMAL' || actualType.startsWith('DECIMAL(')
      }
      return actualType === expectedType
    }
    const toSequelizeType = (type) => {
      if (type.startsWith('STRING')) return Sequelize.STRING(300)
      if (type === 'INTEGER') return Sequelize.INTEGER
      if (type === 'TEXT(long)') return Sequelize.TEXT('long')
      if (type === 'NUMERIC') return Sequelize.NUMERIC
      if (type.startsWith('DECIMAL')) return Sequelize.DECIMAL(18, 2)
      return Sequelize.ENUM('PERCENT', 'FIXED')
    }

    const removeForeignKeys = async (table, column) => {
      const [constraints] = await queryInterface.sequelize.query(
        `SELECT DISTINCT CONSTRAINT_NAME
         FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = ?
           AND COLUMN_NAME = ?
           AND REFERENCED_TABLE_NAME IS NOT NULL`,
        { replacements: [table, column] },
      )

      for (const constraint of constraints) {
        await queryInterface.removeConstraint(table, constraint.CONSTRAINT_NAME)
      }
    }

    // These constraints reference columns whose types may need reconciliation.
    await removeForeignKeys('collection_items', 'ci_sales_id')
    await removeForeignKeys('sales_items', 'si_sales_id')
    await removeForeignKeys('sales_items', 'si_charts_of_accounts')
    await removeForeignKeys('payment_items', 'ci_purchase_id')
    await removeForeignKeys('purchase_items', 'pi_purchase_id')

    for (const [tableName, columns] of Object.entries(itemTables)) {
      const actualColumns = await queryInterface.describeTable(tableName)

      for (const [columnName, expected] of Object.entries(columns)) {
        const actual = actualColumns[columnName]
        if (!actual) {
          throw new Error(`Missing required column ${tableName}.${columnName}`)
        }

        const needsChange =
          !typeMatches(actual.type, expected.type) ||
          actual.allowNull !== expected.allowNull ||
          Boolean(actual.autoIncrement) !== expected.autoIncrement

        if (needsChange) {
          await queryInterface.changeColumn(tableName, columnName, {
            type: toSequelizeType(expected.type),
            allowNull: expected.allowNull,
            autoIncrement: expected.autoIncrement,
          })
        }
      }
    }

    await queryInterface.addConstraint('sales_items', {
      fields: ['si_sales_id'],
      type: 'foreign key',
      name: 'sales_items_ibfk_1',
      references: { table: 'sales', field: 's_id' },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    })
    await queryInterface.addConstraint('sales_items', {
      fields: ['si_charts_of_accounts'],
      type: 'foreign key',
      name: 'sales_items_ibfk_2',
      references: { table: 'charts_of_accounts', field: 'coa_id' },
    })
    await queryInterface.addConstraint('collection_items', {
      fields: ['ci_sales_id'],
      type: 'foreign key',
      name: 'collection_items_ibfk_2',
      references: { table: 'sales_items', field: 'si_id' },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    })
    await queryInterface.addConstraint('purchase_items', {
      fields: ['pi_purchase_id'],
      type: 'foreign key',
      name: 'purchase_items_ibfk_1',
      references: { table: 'purchase', field: 'p_id' },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    })
    await queryInterface.addConstraint('payment_items', {
      fields: ['ci_purchase_id'],
      type: 'foreign key',
      name: 'payment_items_ibfk_2',
      references: { table: 'purchase_items', field: 'pi_id' },
    })
  },

  async down() {
    // This reconciliation is intentionally forward-only to preserve generated IDs.
  },
}
