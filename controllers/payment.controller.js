/**
 * Payment Controller
 * Handles payment-related API endpoints for PhonePe integration
 */
const { initiatePayment, checkPaymentStatus, processCallback, isPhonePeAvailable } = require('../services/phonepe.service');
const { formatResponse } = require('../helpers/functions');
const { addTransaction, updateTransactionStatus } = require('../models/transaction.model');
const { updateOrderStatus } = require('../models/order.model');
const { phonePeConfig } = require('../config/phonepe.config');

/**
 * Initialize PhonePe payment for an order
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<Object>} - Payment initialization response
 */
async function initializePhonePePayment(req, res) {
  try {
    console.log('PhonePe payment initialization request:', req.body);
    
    // Validate request parameters
    const { user_id, order_id, amount, platform } = req.body;
    
    if (!user_id || !order_id || !amount) {
      return res.status(400).json(formatResponse(
        true,
        'Missing required parameters. user_id, order_id, and amount are required.',
        []
      ));
    }
    
    // Check if amount is valid (greater than 0)
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json(formatResponse(
        true,
        'Invalid amount. Amount must be greater than 0.',
        []
      ));
    }
    
    // Check if PhonePe is available
    const phonePeAvailable = await isPhonePeAvailable();
    
    if (!phonePeAvailable) {
      console.error('PhonePe payment gateway is not available');
      // Fall back to COD or another payment method
      return res.status(503).json(formatResponse(
        true,
        'PhonePe payment gateway is currently unavailable. Please try another payment method or try again later.',
        [{
          paymentMethod: 'PHONEPE', 
          status: 'UNAVAILABLE', 
          fallbackOptions: ['COD', 'OTHER']
        }]
      ));
    }
    
    // Update order status to 'awaiting_payment' - this is a temporary state
    try {
      // Only update if the order is in 'pending' state
      await updateOrderStatus(order_id, 'awaiting_payment', 'Awaiting payment via PhonePe');
    } catch (orderError) {
      console.error('Error updating order status:', orderError);
      // Continue with payment flow even if status update fails
    }
    
    // Prepare payment data
    const paymentData = {
      userId: user_id,
      orderId: order_id,
      amount: parsedAmount,
      platform: platform || 'web' // Track if request is from mobile app
    };
    
    // Initialize payment
    const response = await initiatePayment(paymentData);
    
    if (!response.success) {
      console.error('PhonePe payment initiation failed:', response);
      
      // Check for authentication errors
      if (response.code === 'UnauthorizedAccess' || response.code === '401') {
        // Revert order status to pending
        try {
          await updateOrderStatus(order_id, 'pending', 'Payment gateway authentication failed');
        } catch (orderError) {
          console.error('Error reverting order status:', orderError);
        }
        
        return res.status(503).json(formatResponse(
          true,
          'Payment gateway authentication failed. Please try another payment method.',
          [{
            paymentMethod: 'PHONEPE', 
            status: 'AUTHENTICATION_FAILED', 
            fallbackOptions: ['COD', 'OTHER']
          }]
        ));
      }
      
      // Revert order status to pending for other errors
      try {
        await updateOrderStatus(order_id, 'pending', 'Payment initialization failed');
      } catch (orderError) {
        console.error('Error reverting order status:', orderError);
      }
      
      return res.status(400).json(formatResponse(
        true,
        response.error || 'Failed to initialize payment',
        []
      ));
    }
    
    // Create a pending transaction record
    const transactionData = {
      user_id: user_id,
      order_id: order_id,
      txn_id: response.orderId, // PhonePe order ID as transaction ID
      amount: amount,
      status: 'pending',
      message: `Payment initiated via PhonePe with merchant order ID ${response.merchantOrderId}`,
      transaction_type: 'PhonePe',
      type: 'credit' // Money flowing to merchant
    };
    
    try {
      await addTransaction(transactionData);
    } catch (transactionError) {
      console.error('Error creating transaction record:', transactionError);
      // Continue even if transaction record fails - don't fail the payment flow
    }
    
    // Return success response with redirect URL for PhonePe checkout
    return res.json({
      error: false,
      message: 'Payment initiated successfully',
      data: {
        redirect_url: response.redirectUrl,
        merchant_order_id: response.merchantOrderId,
        phonepe_order_id: response.orderId,
        state: response.state,
        expire_at: response.expireAt,
        platform: platform || 'web'
      }
    });
  } catch (error) {
    console.error('Error in initializePhonePePayment:', error);
    
    // Attempt to revert order status to pending
    if (req.body.order_id) {
      try {
        await updateOrderStatus(req.body.order_id, 'pending', 'Payment initialization failed due to error');
      } catch (orderError) {
        console.error('Error reverting order status:', orderError);
      }
    }
    
    return res.status(500).json(formatResponse(
      true,
      'An error occurred while initializing payment. Please try again.',
      []
    ));
  }
}

/**
 * Check payment status
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<Object>} - Payment status response
 */
async function checkPhonePePaymentStatus(req, res) {
  try {
    const { merchant_order_id } = req.body;
    
    if (!merchant_order_id) {
      return res.status(400).json(formatResponse(
        true,
        'Merchant order ID is required.',
        []
      ));
    }
    
    // Check payment status
    const response = await checkPaymentStatus(merchant_order_id);
    
    if (!response.success) {
      return res.status(400).json(formatResponse(
        true,
        response.error || 'Failed to check payment status',
        []
      ));
    }
    
    // Format payment status data
    const paymentStatus = {
      merchant_order_id: merchant_order_id,
      phonepe_order_id: response.orderId,
      state: response.state,
      amount: response.amount,
      payment_details: response.paymentDetails?.map(detail => ({
        transaction_id: detail.transactionId,
        payment_mode: detail.paymentMode,
        timestamp: detail.timestamp,
        state: detail.state,
        error_code: detail.errorCode,
        detailed_error_code: detail.detailedErrorCode
      })) || []
    };
    
    // Process based on payment state
    if (response.state === phonePeConfig.transactionStatus.COMPLETED) {
      // Update transaction status in database
      const transactionId = response.paymentDetails?.[0]?.transactionId;
      if (transactionId) {
        // Extract order_id from merchant_order_id (you'd need to parse it based on your format)
        const orderIdMatch = merchant_order_id.match(/ORDER_(\d+)_/);
        if (orderIdMatch && orderIdMatch[1]) {
          const orderId = orderIdMatch[1];
          
          // Update transaction
          await updateTransactionStatus({
            order_id: orderId,
            txn_id: response.orderId,
            status: 'success',
            message: 'Payment completed successfully'
          });
          
          // Update order status
          await updateOrderStatus(orderId, 'received', 'Payment received via PhonePe');
        }
      }
    }
    
    return res.json({
      error: false,
      message: 'Payment status retrieved successfully',
      data: paymentStatus
    });
  } catch (error) {
    console.error('Error in checkPhonePePaymentStatus:', error);
    return res.status(500).json(formatResponse(
      true,
      'An error occurred while checking payment status.',
      []
    ));
  }
}

/**
 * Handle PhonePe callback
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<Object>} - Callback response
 */
async function handlePhonePeCallback(req, res) {
  try {
    // Extract callback data
    const authorization = req.headers.authorization;
    const responseBody = JSON.stringify(req.body);
    
    // Callback authentication credentials from config
    const callbackUsername = phonePeConfig.callbackUsername;
    const callbackPassword = phonePeConfig.callbackPassword;
    
    if (!authorization) {
      console.error('Missing authorization header in PhonePe callback');
      return res.status(401).json({ status: 'error', message: 'Unauthorized' });
    }
    
    console.log('Processing PhonePe callback with authorization:', authorization.substring(0, 10) + '...');
    
    // Process callback
    const callbackResult = await processCallback(
      callbackUsername,
      callbackPassword,
      authorization,
      responseBody
    );
    
    if (!callbackResult.success) {
      console.error('PhonePe callback validation failed:', callbackResult.error);
      return res.status(400).json({ status: 'error', message: callbackResult.error });
    }
    
    // Extract order ID from merchant order ID
    const orderIdMatch = callbackResult.merchantOrderId.match(/ORDER_(\d+)_/);
    let orderId = null;
    
    if (orderIdMatch && orderIdMatch[1]) {
      orderId = orderIdMatch[1];
    }
    
    console.log('PhonePe callback processed successfully:', {
      orderId,
      state: callbackResult.state,
      phonepeOrderId: callbackResult.orderId
    });
    
    // Process based on callback state
    if (callbackResult.state === phonePeConfig.transactionStatus.COMPLETED) {
      if (orderId) {
        // Update transaction status
        await updateTransactionStatus({
          order_id: orderId,
          txn_id: callbackResult.orderId,
          status: 'success',
          message: 'Payment completed successfully'
        });
        
        // Update order status
        await updateOrderStatus(orderId, 'received', 'Payment received via PhonePe');
      }
      
      return res.json({ status: 'success', message: 'Callback processed successfully' });
    } else if (callbackResult.state === phonePeConfig.transactionStatus.FAILED) {
      if (orderId) {
        // Update transaction status
        await updateTransactionStatus({
          order_id: orderId,
          txn_id: callbackResult.orderId,
          status: 'failed',
          message: 'Payment failed'
        });
        
        // Update order status to failed
        await updateOrderStatus(orderId, 'payment_failed', 'Payment failed via PhonePe');
      }
      
      return res.json({ status: 'success', message: 'Failed payment callback processed' });
    } else {
      // Handle other states if needed
      return res.json({ status: 'success', message: 'Callback acknowledged' });
    }
  } catch (error) {
    console.error('Error in handlePhonePeCallback:', error);
    return res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
}

/**
 * Handle payment response redirect from PhonePe
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function handlePaymentResponse(req, res) {
  try {
    console.log('PhonePe payment redirect received:', req.query);
    
    // Extract parameters from query
    const { merchantOrderId, transactionId, state, code } = req.query;
    
    // Check if request is from mobile app (will have specific header or query param)
    const isMobileApp = req.query.platform === 'app' || req.headers['x-platform'] === 'app';
    
    // Log the payment response
    console.log('Payment response received:', {
      merchantOrderId,
      transactionId,
      state,
      code,
      isMobileApp
    });
    
    if (isMobileApp) {
      // For mobile apps, redirect to app scheme
      const redirectScheme = phonePeConfig.mobileAppScheme;
      const status = state === phonePeConfig.transactionStatus.COMPLETED ? 'success' : 'failure';
      
      // Create deep link URL with payment details
      const deepLinkUrl = `${redirectScheme}payment/${status}?orderId=${merchantOrderId}&txnId=${transactionId || ''}`;
      
      console.log('Redirecting to mobile app:', deepLinkUrl);
      return res.redirect(deepLinkUrl);
    } else {
      // Extract order ID from merchant order ID
      let orderId = null;
      const orderIdMatch = merchantOrderId.match(/ORDER_(\d+)_/);
      if (orderIdMatch && orderIdMatch[1]) {
        orderId = orderIdMatch[1];
      }
      
      // For web, first process payment asynchronously
      if (state === phonePeConfig.transactionStatus.COMPLETED) {
        // Update payment status in database asynchronously
        try {
          if (orderId) {
            // Update transaction and order status
            await updateTransactionStatus({
              order_id: orderId,
              txn_id: transactionId || merchantOrderId,
              status: 'success',
              message: 'Payment completed successfully via PhonePe'
            });
            
            await updateOrderStatus(orderId, 'received', 'Payment received via PhonePe');
          }
        } catch (error) {
          console.error('Error updating payment status during redirect:', error);
        }
        
        // Then redirect to frontend with success
        return res.redirect(`${phonePeConfig.frontendDomain}/payment-success?order=${orderId || merchantOrderId}`);
      } else {
        // Redirect to frontend with failure
        return res.redirect(`${phonePeConfig.frontendDomain}/payment-failed?order=${orderId || merchantOrderId}&code=${code || 'unknown'}`);
      }
    }
  } catch (error) {
    console.error('Error in handlePaymentResponse:', error);
    // Redirect to frontend error page
    return res.redirect(`${phonePeConfig.frontendDomain}/payment-error`);
  }
}

module.exports = {
  initializePhonePePayment,
  checkPhonePePaymentStatus,
  handlePhonePeCallback,
  handlePaymentResponse
}; 