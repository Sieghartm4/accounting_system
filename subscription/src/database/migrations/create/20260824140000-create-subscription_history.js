'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('subscription_history', {
      sh_id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      sh_mu_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'master_user',
          key: 'mu_id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      sh_subscription_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'subscription_plans',
          key: 'sp_id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      sh_price: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0
      },
      sh_billing_cycle: {
        type: Sequelize.STRING(50),
        allowNull: true
      },
      sh_start_date: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      },
      sh_end_date: {
        type: Sequelize.DATE,
        allowNull: true
      },
      sh_status: {
        type: Sequelize.ENUM('active', 'expired', 'cancelled'),
        allowNull: false,
        defaultValue: 'active'
      },
      sh_payment_method: {
        type: Sequelize.STRING(50),
        allowNull: true
      },
      sh_payment_reference: {
        type: Sequelize.STRING(300),
        allowNull: true
      },
      sh_created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      },
      sh_updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      }
    });

    // Add index for faster lookups by user
    await queryInterface.addIndex('subscription_history', ['sh_mu_id']);
    // Add index for checking free trial usage
    await queryInterface.addIndex('subscription_history', ['sh_mu_id', 'sh_price']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('subscription_history');
  }
};
