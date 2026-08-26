'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Check if procedure exists before trying to create it
    const [procedures] = await queryInterface.sequelize.query(
      "SELECT ROUTINE_NAME FROM INFORMATION_SCHEMA.ROUTINES WHERE ROUTINE_SCHEMA = DATABASE() AND ROUTINE_NAME = 'expire_subscriptions'"
    );

    // Only create if it doesn't exist
    if (procedures.length === 0) {
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

      try {
        await queryInterface.sequelize.query(procedureSQL);
        console.log('Stored procedure expire_subscriptions created successfully');
      } catch (error) {
        console.log('Stored procedure creation error:', error.message);
      }
    } else {
      console.log('Stored procedure expire_subscriptions already exists, skipping creation');
    }
  },

  async down(queryInterface, Sequelize) {
    // Try to drop the procedure, but handle permission errors gracefully
    try {
      await queryInterface.sequelize.query('DROP PROCEDURE IF EXISTS expire_subscriptions');
      console.log('Stored procedure expire_subscriptions dropped successfully');
    } catch (error) {
      console.log('Could not drop stored procedure (may be permission issue):', error.message);
    }
  }
};
