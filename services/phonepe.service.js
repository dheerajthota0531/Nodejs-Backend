/**
 * PhonePe Payment Gateway Service
 * Handles integration with PhonePe payment gateway
 */
const { randomUUID } = require('crypto');
const { StandardCheckoutClient, Env, StandardCheckoutPayRequest, CreateSdkOrderRequest, MetaInfo } = require('pg-sdk-node');
const { phonePeConfig, PHONEPE_ENV } = require('../config/phonepe.config');

// Initialize PhonePe client as a singleton
let phonePeClient = null;
let authInitialized = false;
let authRetryCount = 0;
let phonePeAvailable = null; // Availability status cache

/**
 * Check if PhonePe service is available
 * @returns {Promise<boolean>} True if PhonePe is available, false otherwise
 */
async function isPhonePeAvailable() {
  // For UAT testing, always return true
  console.log('UAT Testing: Forcing PhonePe availability to true');
  return true;

  /* Original function commented out for testing
  // Return cached result if available (valid for 5 minutes)
  if (phonePeAvailable !== null) {
    return phonePeAvailable;
  }

  try {
    // Set environment based on configuration
    const env = phonePeConfig.environment === PHONEPE_ENV.PRODUCTION ? Env.PRODUCTION : Env.SANDBOX;
    
    // Initialize PhonePe client
    const client = StandardCheckoutClient.getInstance(
      phonePeConfig.clientId,
      phonePeConfig.clientSecret,
      phonePeConfig.clientVersion,
      env
    );
    
    // Create a test order ID to check authentication
    const testOrderId = `TEST_ORDER_${Date.now()}`;
    
    try {
      // This will fail but we want to check if it fails with auth error or not
      await client.getOrderStatus(testOrderId);
      // We don't expect to reach here since the order doesn't exist
    } catch (error) {
      // If it's an auth error, PhonePe is not available
      if (error.httpStatusCode === 401 || error.code === '401' || error.type === 'UnauthorizedAccess') {
        console.error('PhonePe authentication failed:', error.message);
        phonePeAvailable = false;
        
        // Cache result for 5 minutes
        setTimeout(() => { phonePeAvailable = null; }, 5 * 60 * 1000);
        return false;
      }
      
      // If it's an "order not found" error, that means authentication worked
      if (error.message.includes('not found') || error.code === 'ORDER_NOT_FOUND') {
        console.log('PhonePe authentication successful');
        phonePeAvailable = true;
        
        // Cache result for 5 minutes
        setTimeout(() => { phonePeAvailable = null; }, 5 * 60 * 1000);
        return true;
      }
    }
    
    // Default to false if we can't determine
    phonePeAvailable = false;
    
    // Cache result for 5 minutes
    setTimeout(() => { phonePeAvailable = null; }, 5 * 60 * 1000);
    return false;
  } catch (error) {
    console.error('Error checking PhonePe availability:', error);
    phonePeAvailable = false;
    
    // Cache result for 5 minutes
    setTimeout(() => { phonePeAvailable = null; }, 5 * 60 * 1000);
    return false;
  }
  */
}

/**
 * Get PhonePe client instance with retry logic
 * @returns {Promise<Object>} PhonePe StandardCheckoutClient instance
 */
async function getClient() {
  try {
    if (!phonePeClient) {
      console.log('Initializing PhonePe client with credentials:', {
        clientId: phonePeConfig.clientId,
        clientVersion: phonePeConfig.clientVersion,
        environment: phonePeConfig.environment
      });
      
      // Set environment based on configuration
      const env = phonePeConfig.environment === PHONEPE_ENV.PRODUCTION ? Env.PRODUCTION : Env.SANDBOX;
      
      // Add options with grant_type for UAT environment
      const options = {
        grantType: 'client_credentials'
      };
      
      console.log('Using UAT/SANDBOX environment with grant_type: client_credentials');
      
      // Initialize PhonePe client using getInstance as per documentation
      phonePeClient = StandardCheckoutClient.getInstance(
        phonePeConfig.clientId,
        phonePeConfig.clientSecret,
        phonePeConfig.clientVersion,
        env,
        options  // Add options parameter for UAT
      );
      
      authInitialized = true;
      authRetryCount = 0;
    }
    
    return phonePeClient;
  } catch (error) {
    authRetryCount++;
    console.error(`Error initializing PhonePe client (attempt ${authRetryCount}):`, error);
    
    if (authRetryCount < phonePeConfig.maxRetries) {
      console.log(`Retrying in ${phonePeConfig.retryDelay}ms...`);
      await new Promise(resolve => setTimeout(resolve, phonePeConfig.retryDelay));
      phonePeClient = null; // Reset client for retry
      return getClient(); // Recursive retry
    }
    
    throw new Error(`Failed to initialize PhonePe client after ${authRetryCount} attempts: ${error.message}`);
  }
}

/**
 * Build payment redirect URL
 * @param {Object} paymentData - Payment data
 * @returns {String} Complete redirect URL
 */
function buildRedirectUrl(paymentData) {
  // For callbacks from PhonePe to our server, use the backend domain
  const callbackUrl = `${phonePeConfig.merchantDomain}${phonePeConfig.callbackUrl}`;
  
  // For user redirects after payment completion, use the frontend domain with parameters
  let frontendRedirectUrl = `${phonePeConfig.frontendDomain}/payment-status`;
  
  // Add order information to the redirect URL
  if (paymentData && paymentData.orderId) {
    frontendRedirectUrl += `?orderId=${paymentData.orderId}`;
  }
  
  // Return the backend callback URL for PhonePe
  return callbackUrl;
}

/**
 * Initiate a payment using PhonePe
 * @param {Object} paymentData - Payment data including amount, order details, etc.
 * @returns {Promise<Object>} Payment initiation response with redirect URL
 */
async function initiatePayment(paymentData) {
  try {
    const client = await getClient();
    
    // Generate a unique merchant order ID if not provided
    const merchantOrderId = paymentData.merchantOrderId || `ORDER_${paymentData.orderId}_${Date.now()}`;
    
    // Convert amount to paisa (1 INR = 100 paisa)
    const amount = Math.round(parseFloat(paymentData.amount) * 100);
    
    // Construct redirect URL with base domain from config
    // This needs to be the backend URL for PhonePe to call
    const redirectUrl = `${phonePeConfig.merchantDomain}${phonePeConfig.redirectUrl}`;
    
    // Create metadata using the builder pattern as per documentation
    const metaInfo = MetaInfo.builder()
                        .udf1(paymentData.orderId)
                        .udf2(paymentData.userId)
                        .build();
    
    // Create payment request with builder pattern as per documentation
    const request = StandardCheckoutPayRequest.builder()
      .merchantOrderId(merchantOrderId)
      .amount(amount)
      .redirectUrl(redirectUrl)
      .metaInfo(metaInfo)
      .build();
    
    console.log('PhonePe payment request:', {
      merchantOrderId,
      amount,
      redirectUrl,
      metaInfo
    });
    
    // Send payment request to PhonePe
    const response = await client.pay(request);
    
    console.log('PhonePe payment response:', response);
    
    return {
      success: true,
      orderId: response.orderId,
      merchantOrderId: merchantOrderId,
      amount: paymentData.amount,
      redirectUrl: response.redirectUrl,
      state: response.state,
      expireAt: response.expireAt
    };
  } catch (error) {
    console.error('Error initiating PhonePe payment:', error);
    
    // Try to recreate client if auth error
    if (error.httpStatusCode === 401 || error.code === '401' || error.type === 'UnauthorizedAccess') {
      phonePeClient = null; // Reset client on auth error
      authInitialized = false;
      
      if (authRetryCount < phonePeConfig.maxRetries) {
        console.log('Retrying payment initiation after auth error...');
        authRetryCount++;
        await new Promise(resolve => setTimeout(resolve, phonePeConfig.retryDelay));
        return initiatePayment(paymentData);
      }
    }
    
    // Handle specific error cases
    if (error.code === 'INVALID_AMOUNT' || (error.data && error.data.code === 'INVALID_AMOUNT')) {
      return {
        success: false,
        error: 'Invalid payment amount. Amount must be at least Rs. 1',
        code: 'INVALID_AMOUNT'
      };
    }
    
    return {
      success: false,
      error: error.message || 'Failed to initiate payment',
      code: error.code || error.type || 'PAYMENT_INIT_FAILED',
      details: error.httpStatusCode ? { httpStatusCode: error.httpStatusCode } : undefined
    };
  }
}

/**
 * Check payment status by merchant order ID
 * @param {String} merchantOrderId - Merchant order ID
 * @returns {Promise<Object>} Payment status response
 */
async function checkPaymentStatus(merchantOrderId) {
  try {
    const client = await getClient();
    
    console.log('Checking payment status for:', merchantOrderId);
    
    // Get detailed status information - pass true to get all payment attempts
    const response = await client.getOrderStatus(merchantOrderId, true);
    
    console.log('Payment status response:', response);
    
    return {
      success: true,
      orderId: response.orderId,
      merchantOrderId: merchantOrderId,
      state: response.state,
      amount: response.amount / 100, // Convert paisa to INR
      expireAt: response.expireAt,
      paymentDetails: response.paymentDetails
    };
  } catch (error) {
    console.error('Error checking PhonePe payment status:', error);
    
    // Try to recreate client if auth error
    if (error.httpStatusCode === 401 || error.code === '401' || error.type === 'UnauthorizedAccess') {
      phonePeClient = null; // Reset client on auth error
      authInitialized = false;
      
      if (authRetryCount < phonePeConfig.maxRetries) {
        console.log('Retrying payment status check after auth error...');
        authRetryCount++;
        await new Promise(resolve => setTimeout(resolve, phonePeConfig.retryDelay));
        return checkPaymentStatus(merchantOrderId);
      }
    }
    
    return {
      success: false,
      error: error.message || 'Failed to check payment status',
      code: error.code || error.type || 'PAYMENT_STATUS_CHECK_FAILED',
      details: error.httpStatusCode ? { httpStatusCode: error.httpStatusCode } : undefined
    };
  }
}

/**
 * Process payment callback from PhonePe
 * @param {String} username - Configured username for callback authentication
 * @param {String} password - Configured password for callback authentication
 * @param {String} authorization - Authorization header from callback
 * @param {String} responseBody - Callback request body
 * @returns {Promise<Object>} Processed callback data
 */
async function processCallback(username, password, authorization, responseBody) {
  try {
    const client = await getClient();
    
    console.log('Processing PhonePe callback with authorization:', authorization ? 'provided' : 'missing');
    
    // Validate callback
    const callbackResponse = client.validateCallback(
      username,
      password,
      authorization,
      responseBody
    );
    
    console.log('PhonePe callback validated successfully');
    
    // Extract important information from callback
    const callbackData = {
      type: callbackResponse.type,
      orderId: callbackResponse.payload.orderId,
      merchantOrderId: callbackResponse.payload.merchantOrderId,
      state: callbackResponse.payload.state,
      amount: callbackResponse.payload.amount / 100, // Convert paisa to INR
      transactionId: callbackResponse.payload.paymentDetails?.[0]?.transactionId || null
    };
    
    return {
      success: true,
      ...callbackData
    };
  } catch (error) {
    console.error('Error processing PhonePe callback:', error);
    
    // Try to recreate client if auth error
    if (error.httpStatusCode === 401 || error.code === '401' || error.type === 'UnauthorizedAccess') {
      phonePeClient = null; // Reset client on auth error
      authInitialized = false;
      
      if (authRetryCount < phonePeConfig.maxRetries) {
        console.log('Retrying callback processing after auth error...');
        authRetryCount++;
        await new Promise(resolve => setTimeout(resolve, phonePeConfig.retryDelay));
        return processCallback(username, password, authorization, responseBody);
      }
    }
    
    return {
      success: false,
      error: error.message || 'Failed to process payment callback',
      code: error.code || error.type || 'PAYMENT_CALLBACK_FAILED',
      details: error.httpStatusCode ? { httpStatusCode: error.httpStatusCode } : undefined
    };
  }
}

module.exports = {
  initiatePayment,
  checkPaymentStatus,
  processCallback,
  isPhonePeAvailable
}; 