const cron = require('node-cron');
const { Query } = require('../database/util/queries.util');

/**
 * Schedule subscription expiry check
 * Runs daily at midnight
 */
const scheduleSubscriptionExpiry = () => {
  // Run daily at 00:00 (midnight)
  cron.schedule('0 0 * * *', async () => {
    try {
      console.log('[Subscription Expiry] Running daily subscription expiry check...');
      await Query('CALL expire_subscriptions()');
      console.log('[Subscription Expiry] Subscription expiry check completed successfully');
    } catch (error) {
      console.error('[Subscription Expiry] Error running subscription expiry check:', error);
    }
  });

  console.log('[Subscription Expiry] Scheduled to run daily at midnight');
};

module.exports = { scheduleSubscriptionExpiry };
