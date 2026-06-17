'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Drop foreign keys that reference cash_disbursements.cd_id so we can safely change types
    try {
      await queryInterface.removeConstraint(
        'cash_disbursement_items',
        'cash_disbursement_items_ibfk_1',
      )
    } catch (e) {
      // ignore if constraint does not exist
    }

    try {
      await queryInterface.removeConstraint(
        'cash_disbursement_attachments',
        'cash_disbursement_attachments_ibfk_1',
      )
    } catch (e) {
      // ignore if constraint does not exist
    }

    // Update child columns to match new parent length
    await queryInterface.changeColumn(
      'cash_disbursement_items',
      'cdi_cash_disbursement_id',
      {
        type: Sequelize.STRING(300),
        allowNull: false,
      },
    )

    await queryInterface.changeColumn(
      'cash_disbursement_attachments',
      'a_cash_disburssement_id',
      {
        type: Sequelize.STRING(300),
        allowNull: false,
      },
    )

    // Change cash_disbursements.cd_id to STRING(300) to allow indexing
    await queryInterface.changeColumn('cash_disbursements', 'cd_id', {
      type: Sequelize.STRING(300),
      allowNull: false,
    })

    // Recreate foreign key constraints
    await queryInterface.addConstraint('cash_disbursement_items', {
      fields: ['cdi_cash_disbursement_id'],
      type: 'foreign key',
      name: 'cash_disbursement_items_ibfk_1',
      references: {
        table: 'cash_disbursements',
        field: 'cd_id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    })

    await queryInterface.addConstraint('cash_disbursement_attachments', {
      fields: ['a_cash_disburssement_id'],
      type: 'foreign key',
      name: 'cash_disbursement_attachments_ibfk_1',
      references: {
        table: 'cash_disbursements',
        field: 'cd_id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    })

    // Drop FK constraints referencing receipts
    try {
      await queryInterface.removeConstraint('receipt_items', 'receipt_items_ibfk_1')
    } catch (e) {}
    try {
      await queryInterface.removeConstraint(
        'receipt_attachments',
        'receipt_attachments_ibfk_1',
      )
    } catch (e) {}

    // Update receipt child columns
    await queryInterface.changeColumn('receipt_items', 'ri_receipts_id', {
      type: Sequelize.STRING(300),
      allowNull: false,
    })
    await queryInterface.changeColumn('receipt_attachments', 'ra_receipt_id', {
      type: Sequelize.STRING(300),
      allowNull: false,
    })

    // Change receipts.r_id to STRING(300) to allow indexing
    await queryInterface.changeColumn('receipts', 'r_id', {
      type: Sequelize.STRING(300),
      allowNull: false,
    })

    // Recreate receipts FK constraints
    await queryInterface.addConstraint('receipt_items', {
      fields: ['ri_receipts_id'],
      type: 'foreign key',
      name: 'receipt_items_ibfk_1',
      references: { table: 'receipts', field: 'r_id' },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    })
    await queryInterface.addConstraint('receipt_attachments', {
      fields: ['ra_receipt_id'],
      type: 'foreign key',
      name: 'receipt_attachments_ibfk_1',
      references: { table: 'receipts', field: 'r_id' },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    })

    // Drop FK constraints referencing sales
    try {
      await queryInterface.removeConstraint('sales_items', 'sales_items_ibfk_1')
    } catch (e) {}
    try {
      await queryInterface.removeConstraint(
        'sales_attachments',
        'sales_attachments_ibfk_1',
      )
    } catch (e) {}

    // Update sales child columns
    await queryInterface.changeColumn('sales_items', 'si_sales_id', {
      type: Sequelize.STRING(300),
      allowNull: false,
    })
    await queryInterface.changeColumn('sales_attachments', 'sa_sales_id', {
      type: Sequelize.STRING(300),
      allowNull: false,
    })

    // Change sales.s_id to STRING(300) (idempotent if already STRING)
    await queryInterface.changeColumn('sales', 's_id', {
      type: Sequelize.STRING(300),
      allowNull: false,
    })

    // Recreate sales FK constraints
    await queryInterface.addConstraint('sales_items', {
      fields: ['si_sales_id'],
      type: 'foreign key',
      name: 'sales_items_ibfk_1',
      references: { table: 'sales', field: 's_id' },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    })
    await queryInterface.addConstraint('sales_attachments', {
      fields: ['sa_sales_id'],
      type: 'foreign key',
      name: 'sales_attachments_ibfk_1',
      references: { table: 'sales', field: 's_id' },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    })

    // Drop FK constraints referencing purchase
    try {
      await queryInterface.removeConstraint(
        'purchase_items',
        'purchase_items_ibfk_1',
      )
    } catch (e) {}
    try {
      await queryInterface.removeConstraint(
        'purchase_attachments',
        'purchase_attachments_ibfk_1',
      )
    } catch (e) {}

    // Update purchase child columns
    await queryInterface.changeColumn('purchase_items', 'pi_purchase_id', {
      type: Sequelize.STRING(300),
      allowNull: false,
    })
    await queryInterface.changeColumn('purchase_attachments', 'pa_purchase_id', {
      type: Sequelize.STRING(300),
      allowNull: false,
    })

    // Change purchase.p_id to STRING(300) to allow indexing
    await queryInterface.changeColumn('purchase', 'p_id', {
      type: Sequelize.STRING(300),
      allowNull: false,
    })

    // Recreate purchase FK constraints
    await queryInterface.addConstraint('purchase_items', {
      fields: ['pi_purchase_id'],
      type: 'foreign key',
      name: 'purchase_items_ibfk_1',
      references: { table: 'purchase', field: 'p_id' },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    })
    await queryInterface.addConstraint('purchase_attachments', {
      fields: ['pa_purchase_id'],
      type: 'foreign key',
      name: 'purchase_attachments_ibfk_1',
      references: { table: 'purchase', field: 'p_id' },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    })
  },

  async down(queryInterface, Sequelize) {
    // Drop FK constraints first
    try {
      await queryInterface.removeConstraint(
        'cash_disbursement_items',
        'cash_disbursement_items_ibfk_1',
      )
    } catch (e) {}
    try {
      await queryInterface.removeConstraint(
        'cash_disbursement_attachments',
        'cash_disbursement_attachments_ibfk_1',
      )
    } catch (e) {}

    // Revert child columns back to original lengths
    await queryInterface.changeColumn(
      'cash_disbursement_items',
      'cdi_cash_disbursement_id',
      {
        type: Sequelize.STRING(300),
        allowNull: false,
      },
    )

    await queryInterface.changeColumn(
      'cash_disbursement_attachments',
      'a_cash_disburssement_id',
      {
        type: Sequelize.STRING(300),
        allowNull: false,
      },
    )

    // Revert cash_disbursements.cd_id to STRING(300)
    await queryInterface.changeColumn('cash_disbursements', 'cd_id', {
      type: Sequelize.STRING(300),
      allowNull: false,
    })

    // Recreate original foreign keys
    await queryInterface.addConstraint('cash_disbursement_items', {
      fields: ['cdi_cash_disbursement_id'],
      type: 'foreign key',
      name: 'cash_disbursement_items_ibfk_1',
      references: {
        table: 'cash_disbursements',
        field: 'cd_id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    })

    await queryInterface.addConstraint('cash_disbursement_attachments', {
      fields: ['a_cash_disburssement_id'],
      type: 'foreign key',
      name: 'cash_disbursement_attachments_ibfk_1',
      references: {
        table: 'cash_disbursements',
        field: 'cd_id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    })

    // Revert receipts: drop constraints, restore child and parent sizes, recreate constraints
    try {
      await queryInterface.removeConstraint('receipt_items', 'receipt_items_ibfk_1')
    } catch (e) {}
    try {
      await queryInterface.removeConstraint(
        'receipt_attachments',
        'receipt_attachments_ibfk_1',
      )
    } catch (e) {}

    await queryInterface.changeColumn('receipt_items', 'ri_receipts_id', {
      type: Sequelize.STRING(300),
      allowNull: false,
    })
    await queryInterface.changeColumn('receipt_attachments', 'ra_receipt_id', {
      type: Sequelize.STRING(300),
      allowNull: false,
    })

    await queryInterface.changeColumn('receipts', 'r_id', {
      type: Sequelize.STRING(300),
      allowNull: false,
    })

    await queryInterface.addConstraint('receipt_items', {
      fields: ['ri_receipts_id'],
      type: 'foreign key',
      name: 'receipt_items_ibfk_1',
      references: { table: 'receipts', field: 'r_id' },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    })
    await queryInterface.addConstraint('receipt_attachments', {
      fields: ['ra_receipt_id'],
      type: 'foreign key',
      name: 'receipt_attachments_ibfk_1',
      references: { table: 'receipts', field: 'r_id' },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    })

    // Revert sales: drop constraints, restore child and parent sizes, recreate constraints
    try {
      await queryInterface.removeConstraint('sales_items', 'sales_items_ibfk_1')
    } catch (e) {}
    try {
      await queryInterface.removeConstraint(
        'sales_attachments',
        'sales_attachments_ibfk_1',
      )
    } catch (e) {}

    await queryInterface.changeColumn('sales_items', 'si_sales_id', {
      type: Sequelize.STRING(300),
      allowNull: false,
    })
    await queryInterface.changeColumn('sales_attachments', 'sa_sales_id', {
      type: Sequelize.STRING(300),
      allowNull: false,
    })

    await queryInterface.changeColumn('sales', 's_id', {
      type: Sequelize.STRING(300),
      allowNull: false,
    })

    await queryInterface.addConstraint('sales_items', {
      fields: ['si_sales_id'],
      type: 'foreign key',
      name: 'sales_items_ibfk_1',
      references: { table: 'sales', field: 's_id' },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    })
    await queryInterface.addConstraint('sales_attachments', {
      fields: ['sa_sales_id'],
      type: 'foreign key',
      name: 'sales_attachments_ibfk_1',
      references: { table: 'sales', field: 's_id' },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    })

    // Revert purchase: drop constraints, restore child and parent sizes, recreate constraints
    try {
      await queryInterface.removeConstraint(
        'purchase_items',
        'purchase_items_ibfk_1',
      )
    } catch (e) {}
    try {
      await queryInterface.removeConstraint(
        'purchase_attachments',
        'purchase_attachments_ibfk_1',
      )
    } catch (e) {}

    await queryInterface.changeColumn('purchase_items', 'pi_purchase_id', {
      type: Sequelize.STRING(300),
      allowNull: false,
    })
    await queryInterface.changeColumn('purchase_attachments', 'pa_purchase_id', {
      type: Sequelize.STRING(300),
      allowNull: false,
    })

    await queryInterface.changeColumn('purchase', 'p_id', {
      type: Sequelize.STRING(300),
      allowNull: false,
    })

    await queryInterface.addConstraint('purchase_items', {
      fields: ['pi_purchase_id'],
      type: 'foreign key',
      name: 'purchase_items_ibfk_1',
      references: { table: 'purchase', field: 'p_id' },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    })
    await queryInterface.addConstraint('purchase_attachments', {
      fields: ['pa_purchase_id'],
      type: 'foreign key',
      name: 'purchase_attachments_ibfk_1',
      references: { table: 'purchase', field: 'p_id' },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    })
  },
}
