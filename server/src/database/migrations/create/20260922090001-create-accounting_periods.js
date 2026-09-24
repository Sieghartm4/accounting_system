'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Check if tables already exist (from partial migration)
    const [tables] = await queryInterface.sequelize.query(
      "SHOW TABLES LIKE 'accounting_fiscal_years'"
    )
    
    if (tables.length === 0) {
      await queryInterface.createTable('accounting_fiscal_years', {
      afy_id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      afy_code: {
        type: Sequelize.STRING(20),
        allowNull: false,
        unique: true,
      },
      afy_name: {
        type: Sequelize.STRING(120),
        allowNull: false,
      },
      afy_start_date: {
        type: Sequelize.STRING(20),
        allowNull: false,
      },
      afy_end_date: {
        type: Sequelize.STRING(20),
        allowNull: false,
      },
      afy_status: {
        type: Sequelize.ENUM('ACTIVE', 'INACTIVE', 'ARCHIVED'),
        allowNull: false,
        defaultValue: 'ACTIVE',
      },
      afy_is_current: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      afy_created_date: {
        type: Sequelize.STRING(30),
        allowNull: true,
      },
      afy_created_by: {
        type: Sequelize.STRING(300),
        allowNull: true,
      },
      afy_updated_date: {
        type: Sequelize.STRING(30),
        allowNull: true,
      },
      afy_updated_by: {
        type: Sequelize.STRING(300),
        allowNull: true,
      },
    })
    }

    // Check if accounting_periods table already exists
    const [periodTables] = await queryInterface.sequelize.query(
      "SHOW TABLES LIKE 'accounting_periods'"
    )
    
    if (periodTables.length === 0) {
      await queryInterface.createTable('accounting_periods', {
      ap_id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      ap_fiscal_year_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      ap_period: {
        type: Sequelize.STRING(7),
        allowNull: false,
        unique: true,
      },
      ap_year: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      ap_month: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      ap_start_date: {
        type: Sequelize.STRING(20),
        allowNull: false,
      },
      ap_end_date: {
        type: Sequelize.STRING(20),
        allowNull: false,
      },
      ap_status: {
        type: Sequelize.ENUM('OPEN', 'SOFT_CLOSED', 'CLOSED', 'LOCKED'),
        allowNull: false,
        defaultValue: 'OPEN',
      },
      ap_opened_date: {
        type: Sequelize.STRING(30),
        allowNull: true,
      },
      ap_opened_by: {
        type: Sequelize.STRING(300),
        allowNull: true,
      },
      ap_soft_closed_date: {
        type: Sequelize.STRING(30),
        allowNull: true,
      },
      ap_soft_closed_by: {
        type: Sequelize.STRING(300),
        allowNull: true,
      },
      ap_closed_date: {
        type: Sequelize.STRING(30),
        allowNull: true,
      },
      ap_closed_by: {
        type: Sequelize.STRING(300),
        allowNull: true,
      },
      ap_locked_date: {
        type: Sequelize.STRING(30),
        allowNull: true,
      },
      ap_locked_by: {
        type: Sequelize.STRING(300),
        allowNull: true,
      },
      ap_reopened_date: {
        type: Sequelize.STRING(30),
        allowNull: true,
      },
      ap_reopened_by: {
        type: Sequelize.STRING(300),
        allowNull: true,
      },
      ap_reopen_reason: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      ap_created_date: {
        type: Sequelize.STRING(30),
        allowNull: true,
      },
      ap_created_by: {
        type: Sequelize.STRING(300),
        allowNull: true,
      },
      ap_updated_date: {
        type: Sequelize.STRING(30),
        allowNull: true,
      },
      ap_updated_by: {
        type: Sequelize.STRING(300),
        allowNull: true,
      },
    })
    }

    // Add indexes with existence checks
    try {
      await queryInterface.addIndex('accounting_periods', ['ap_fiscal_year_id'], {
        name: 'idx_accounting_periods_fiscal_year_id',
      })
    } catch (error) {
      if (!error.message.includes('Duplicate key')) {
        throw error
      }
    }
    
    try {
      await queryInterface.addIndex('accounting_periods', ['ap_status'], {
        name: 'idx_accounting_periods_status',
      })
    } catch (error) {
      if (!error.message.includes('Duplicate key')) {
        throw error
      }
    }

    // Skip trigger creation for now - there's a syntax issue
    // TODO: Fix trigger syntax and add back later
    console.log('⚠️ Skipping trigger creation due to syntax issues')
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query(
      'DROP TRIGGER IF EXISTS trg_journal_entries_period_lock',
    )
    await queryInterface.dropTable('accounting_periods')
    await queryInterface.dropTable('accounting_fiscal_years')
  },
}
