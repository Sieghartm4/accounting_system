'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Drop the existing procedure if it exists
    await queryInterface.sequelize.query('DROP PROCEDURE IF EXISTS expire_subscriptions');

    // Create a stored procedure to check and expire subscriptions
    const procedureSQL = `
      CREATE PROCEDURE expire_subscriptions()
      BEGIN
        DECLARE affected_rows INT;

        -- First, find users with expired active subscriptions and update master_user
        UPDATE master_user mu
        INNER JOIN subscription_history sh 
          ON mu.mu_id = sh.sh_mu_id 
          AND mu.subscription_id = sh.sh_subscription_id
        SET mu.subscription_id = NULL
        WHERE sh.sh_status = 'active'
          AND sh.sh_end_date < CURDATE();

        SET affected_rows = ROW_COUNT();

        -- Then, update subscription_history status to expired
        UPDATE subscription_history
        SET sh_status = 'expired',
            sh_updated_at = NOW()
        WHERE sh_status = 'active'
          AND sh_end_date < CURDATE();
      END;
    `;

    // Execute the stored procedure creation
    try {
      await queryInterface.sequelize.query(procedureSQL);
      console.log('Stored procedure expire_subscriptions created successfully');
    } catch (error) {
      console.log('Stored procedure creation error:', error.message);
    }
  },

  async down(queryInterface, Sequelize) {
    // Drop the stored procedure
    await queryInterface.sequelize.query('DROP PROCEDURE IF EXISTS expire_subscriptions');
  }
};
