/**
 * PhonePe Payment Gateway Configuration
 */
require('dotenv').config();

// PhonePe Environment settings
const PHONEPE_ENV = {
  PRODUCTION: 'PRODUCTION',
  SANDBOX: 'SANDBOX'
};

// PhonePe configuration object
const phonePeConfig = {
  // Client credentials from your PhonePe business dashboard
  clientId: process.env.PHONEPE_CLIENT_ID || 'M220FPIWE4PZDUAT_2504011',
  clientSecret: process.env.PHONEPE_CLIENT_SECRET || 'ZTlmNmIzZTktYmE2NC00YTE2LWFlNDAtNjczMjM1NGU3M2My',
  clientVersion: parseInt(process.env.PHONEPE_CLIENT_VERSION || '1'),
  merchantId: process.env.PHONEPE_MERCHANT_ID || 'M220FPIWE4PZDUAT',
  
  // Environment - should be SANDBOX for testing, PRODUCTION for live
  environment: process.env.PHONEPE_ENVIRONMENT || PHONEPE_ENV.SANDBOX,
  
  // Merchant API/backend domain for callbacks from PhonePe
  // This should be the domain where your API is running
  merchantDomain: process.env.MERCHANT_DOMAIN || 'http://localhost:3000',
  
  // Frontend domain for user redirects after payment
  // This is where your React app is running
  frontendDomain: process.env.FRONTEND_DOMAIN || 'http://localhost:3001',
  
  // Webhook endpoints for callbacks
  callbackUrl: '/api/payment/phonepe-callback', // Relative path for callback from PhonePe
  redirectUrl: '/api/payment/response', // Relative path for redirecting the user after payment
  
  // Callback authentication - required for validateCallback
  callbackUsername: process.env.PHONEPE_CALLBACK_USERNAME || 'merchant_username',
  callbackPassword: process.env.PHONEPE_CALLBACK_PASSWORD || 'merchant_password',
  
  // Deep linking for mobile apps
  mobileAppScheme: process.env.MOBILE_APP_SCHEME || 'myapp://', // For mobile app deep linking
  
  // Payment settings
  paymentTypes: ['UPI', 'CARD', 'NET_BANKING'], // Available payment methods
  
  // Transaction status constants
  transactionStatus: {
    PENDING: 'PENDING',
    COMPLETED: 'COMPLETED',
    FAILED: 'FAILED'
  },
  
  // Retry configuration
  maxRetries: 3,
  retryDelay: 1000 // 1 second
};

module.exports = {
  phonePeConfig,
  PHONEPE_ENV
}; 