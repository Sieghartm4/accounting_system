const { logger } = require('../util/logger.util');
const { checkConnection, Query } = require('../database/util/queries.util');
const { Master } = require('../database/model/Master');
const { SQLQueryBuilder } = require('../util/helper.util');
const sql = new SQLQueryBuilder();

/**
 * Create PayMongo checkout session for subscription payment
 */
const createCheckoutSession = async (req, res) => {
  try {
    const { 
      amount, 
      description, 
      username, 
      email, 
      company_name,
      subscription_id,
      subscription_billing_cycle
    } = req.body;

    if (!amount) {
      return res.status(400).json({ 
        success: false, 
        message: 'Amount is required' 
      });
    }

    const paymongoSecretKey = process.env.PAYMONGO_SECRET_KEY;
    if (!paymongoSecretKey) {
      return res.status(500).json({ 
        success: false, 
        message: 'PayMongo secret key not configured' 
      });
    }

    // Ensure CLIENT_URL has protocol prefix (fallback to CLIENT_URL without underscore)
    let clientUrl = process.env._CLIENT_URL || process.env.CLIENT_URL || 'http://localhost:3000';
    if (clientUrl && !clientUrl.startsWith('http://') && !clientUrl.startsWith('https://')) {
      clientUrl = `http://${clientUrl}`;
    }

    // Create PayMongo checkout session
    const checkoutData = {
      data: {
        attributes: {
          send_email_receipt: false,
          show_description: true,
          show_line_items: true,
          line_items: [
            {
              amount: Math.round(amount * 100), // PayMongo expects amount in cents
              currency: 'PHP',
              description: description || 'Subscription Payment',
              name: description || 'Subscription Payment',
              quantity: 1
            }
          ],
          payment_method_types: ['gcash', 'card', 'paymaya'],
          success_url: `${clientUrl}/register?payment=success&session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${clientUrl}/register?payment=failed`,
          metadata: {
            username: username || '',
            email: email || '',
            company_name: company_name || '',
            subscription_id: subscription_id || '',
            subscription_billing_cycle: subscription_billing_cycle || ''
          }
        }
      }
    };

    const response = await fetch('https://api.paymongo.com/v1/checkout_sessions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${Buffer.from(paymongoSecretKey + ':').toString('base64')}`
      },
      body: JSON.stringify(checkoutData)
    });

    const responseData = await response.json();

    if (!response.ok) {
      logger.error('PayMongo checkout session creation failed:', responseData);
      return res.status(response.status).json({
        success: false,
        message: responseData.errors?.[0]?.detail || 'Failed to create checkout session'
      });
    }

    const checkoutUrl = responseData.data.attributes.checkout_url;

    res.json({
      success: true,
      data: {
        checkout_url: checkoutUrl,
        session_id: responseData.data.id
      }
    });

  } catch (error) {
    logger.error('Error creating checkout session:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during checkout session creation'
    });
  }
};

/**
 * Fetch payment details from PayMongo using checkout session ID
 */
const getPaymentDetails = async (req, res) => {
  try {
    const { session_id } = req.params;

    if (!session_id) {
      return res.status(400).json({
        success: false,
        message: 'Session ID is required'
      });
    }

    const paymongoSecretKey = process.env.PAYMONGO_SECRET_KEY;
    if (!paymongoSecretKey) {
      return res.status(500).json({
        success: false,
        message: 'PayMongo secret key not configured'
      });
    }

    // Fetch checkout session details from PayMongo
    const response = await fetch(`https://api.paymongo.com/v1/checkout_sessions/${session_id}`, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${Buffer.from(paymongoSecretKey + ':').toString('base64')}`
      }
    });

    const responseData = await response.json();

    if (!response.ok) {
      logger.error('PayMongo payment details fetch failed:', responseData);
      return res.status(response.status).json({
        success: false,
        message: responseData.errors?.[0]?.detail || 'Failed to fetch payment details'
      });
    }

    const sessionData = responseData.data.attributes;
    let paymentMethod = null;
    let paymentReference = null;
    let amount = null;

    console.log('PayMongo session data:', JSON.stringify(sessionData, null, 2));

    // Extract payment method directly from session data
    paymentMethod = sessionData.payment_method_used || null;
    console.log('Payment method from session:', paymentMethod);

    // Extract payment ID from payments array in session data
    if (sessionData.payments && sessionData.payments.length > 0) {
      paymentReference = sessionData.payments[0].id;
      console.log('Payment reference from session payments:', paymentReference);
      
      // If payment method is still null, try to get it from the payment source
      if (!paymentMethod && sessionData.payments[0].attributes && sessionData.payments[0].attributes.source) {
        paymentMethod = sessionData.payments[0].attributes.source.type;
        console.log('Payment method from payment source:', paymentMethod);
      }
    }

    // Extract amount from line items
    if (sessionData.line_items && sessionData.line_items.length > 0) {
      amount = sessionData.line_items[0].amount / 100; // Convert from cents
      console.log('Amount from line items:', amount);
    }
    
    console.log('Final payment method:', paymentMethod);
    console.log('Final payment reference:', paymentReference);
    console.log('Final amount:', amount);

    res.json({
      success: true,
      data: {
        payment_method: paymentMethod,
        payment_reference: paymentReference,
        status: sessionData.status,
        amount: amount || (sessionData.amount_total ? sessionData.amount_total / 100 : null), // Convert from cents
        currency: sessionData.currency,
        billing_cycle: sessionData.metadata?.subscription_billing_cycle || null
      }
    });
  } catch (error) {
    logger.error('Error fetching payment details:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching payment details'
    });
  }
};

/**
 * Verify PayMongo payment and complete registration
 */
const verifyPayment = async (req, res) => {
  try {
    const { session_id } = req.body;

    if (!session_id) {
      return res.status(400).json({ 
        success: false, 
        message: 'Session ID is required' 
      });
    }

    const paymongoSecretKey = process.env.PAYMONGO_SECRET_KEY;
    if (!paymongoSecretKey) {
      return res.status(500).json({ 
        success: false, 
        message: 'PayMongo secret key not configured' 
      });
    }

    // Retrieve checkout session from PayMongo
    const response = await fetch(`https://api.paymongo.com/v1/checkout_sessions/${session_id}`, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${Buffer.from(paymongoSecretKey + ':').toString('base64')}`
      }
    });

    const responseData = await response.json();

    if (!response.ok) {
      logger.error('PayMongo session retrieval failed:', responseData);
      return res.status(response.status).json({
        success: false,
        message: responseData.errors?.[0]?.detail || 'Failed to retrieve payment session'
      });
    }

    const session = responseData.data;
    const paymentStatus = session.attributes.status;
    const metadata = session.attributes.metadata;

    if (paymentStatus !== 'paid') {
      return res.status(400).json({
        success: false,
        message: `Payment not completed. Status: ${paymentStatus}`
      });
    }

    // Save subscription history after successful payment
    if (metadata.username && metadata.subscription_id) {
      try {
        // Get user ID from username
        const userQuery = sql
          .select([Master.master_user.selectOptionColumns.id])
          .from(Master.master_user.tablename)
          .where(Master.master_user.selectOptionColumns.username)
          .build();

        const users = await Query(
          userQuery,
          [metadata.username],
          [Master.master_user.prefix_],
        );

        if (users.length > 0) {
          const userId = users[0].mu_id;
          const amount = session.attributes.amount / 100;
          
          // Calculate end date based on billing cycle
          let endDate = null;
          if (metadata.subscription_billing_cycle) {
            const startDate = new Date();
            const cycleDays = parseInt(metadata.subscription_billing_cycle);
            if (!isNaN(cycleDays)) {
              endDate = new Date(startDate);
              endDate.setDate(endDate.getDate() + cycleDays);
            }
          }

          // Insert subscription history
          const insertQuery = sql
            .insert(Master.subscription_history.tablename, {
              columns: Master.subscription_history.insertColumns,
              isTransaction: true,
            })
            .values([
              userId,
              parseInt(metadata.subscription_id),
              amount,
              metadata.subscription_billing_cycle || null,
              new Date(),
              endDate,
              'active',
              'paymongo',
              session.attributes.payment_intent_id
            ])
            .build();

          await Query(
            insertQuery,
            [
              userId,
              parseInt(metadata.subscription_id),
              amount,
              metadata.subscription_billing_cycle || null,
              new Date(),
              endDate,
              'active',
              'paymongo',
              session.attributes.payment_intent_id
            ],
            [Master.subscription_history.prefix_],
          );

          logger.info(`Subscription history saved for user ${metadata.username}`);
        }
      } catch (historyError) {
        logger.error('Error saving subscription history:', historyError);
        // Don't fail the payment verification if history saving fails
      }
    }

    // Return payment details for registration completion
    res.json({
      success: true,
      data: {
        payment_status: paymentStatus,
        payment_id: session.attributes.payment_intent_id,
        amount: session.attributes.amount / 100,
        metadata: metadata
      }
    });

  } catch (error) {
    logger.error('Error verifying payment:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

module.exports = {
  createCheckoutSession,
  getPaymentDetails,
  verifyPayment
};
