/**
 * Test PhonePe SDK Connection
 * This script tests the connection to PhonePe SDK with your credentials
 */

// Import required modules
const { phonePeConfig, PHONEPE_ENV } = require('../config/phonepe.config');
const { StandardCheckoutClient, Env } = require('pg-sdk-node');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

console.log(`${colors.cyan}PhonePe SDK Connection Test${colors.reset}`);
console.log(`${colors.yellow}=============================${colors.reset}`);

// Print environment details
console.log(`${colors.blue}Environment:${colors.reset} ${phonePeConfig.environment}`);
console.log(`${colors.blue}Node Version:${colors.reset} ${process.version}`);
console.log(`${colors.blue}SDK Version:${colors.reset} From package.json\n`);

// Print configuration (masking sensitive data)
console.log(`${colors.magenta}Configuration:${colors.reset}`);
console.log(`${colors.blue}Client ID:${colors.reset} ${phonePeConfig.clientId}`);
console.log(`${colors.blue}Client Secret:${colors.reset} ${phonePeConfig.clientSecret.substring(0, 4)}...${phonePeConfig.clientSecret.substring(phonePeConfig.clientSecret.length - 4)}`);
console.log(`${colors.blue}Client Version:${colors.reset} ${phonePeConfig.clientVersion}`);
console.log(`${colors.blue}Merchant ID:${colors.reset} ${phonePeConfig.merchantId}`);
console.log(`${colors.blue}Merchant Domain:${colors.reset} ${phonePeConfig.merchantDomain}`);
console.log(`${colors.blue}Redirect URL:${colors.reset} ${phonePeConfig.merchantDomain}${phonePeConfig.redirectUrl}\n`);

// Test connection
async function testConnection() {
  console.log(`${colors.cyan}Attempting to connect to PhonePe...${colors.reset}`);
  
  try {
    // Set environment based on configuration
    const env = phonePeConfig.environment === PHONEPE_ENV.PRODUCTION ? Env.PRODUCTION : Env.SANDBOX;
    console.log(`${colors.blue}Using environment:${colors.reset} ${env}`);
    
    // Initialize PhonePe client
    console.log(`${colors.yellow}Initializing client...${colors.reset}`);
    const client = StandardCheckoutClient.getInstance(
      phonePeConfig.clientId,
      phonePeConfig.clientSecret,
      phonePeConfig.clientVersion,
      env
    );
    
    console.log(`${colors.green}✓ Client initialized successfully!${colors.reset}`);
    
    // Now try to call a simple API to test authentication
    console.log(`${colors.yellow}Calling API to test authentication...${colors.reset}`);
    
    // Create a test order ID (we won't actually use this, just to test connection)
    const testOrderId = `TEST_ORDER_${Date.now()}`;
    
    try {
      // This will fail with "Order not found" if authentication works but more generic
      // authentication errors if credentials are invalid
      await client.getOrderStatus(testOrderId);
    } catch (error) {
      // We expect an error here since the order doesn't exist
      // But we want to see if it's an auth error or "order not found" error
      if (error.httpStatusCode === 401 || error.code === '401' || error.message.includes('Unauthorized')) {
        console.log(`${colors.red}✗ Authentication failed!${colors.reset}`);
        console.log(`${colors.red}Error:${colors.reset} ${error.message}`);
        console.log(`${colors.red}Status Code:${colors.reset} ${error.httpStatusCode || 'N/A'}`);
        console.log(`${colors.red}Error Code:${colors.reset} ${error.code || 'N/A'}`);
        
        // Provide advice
        console.log(`\n${colors.yellow}Troubleshooting:${colors.reset}`);
        console.log(`1. Verify your Client ID and Secret are correct`);
        console.log(`2. Ensure your PhonePe account is active`);
        console.log(`3. Check if you need to use PRODUCTION environment instead of SANDBOX`);
        console.log(`4. Contact PhonePe support with this error message`);
      } else if (error.message.includes('not found') || error.code === 'ORDER_NOT_FOUND') {
        // This is actually good! It means authentication worked but the order doesn't exist
        console.log(`${colors.green}✓ Authentication successful!${colors.reset}`);
        console.log(`${colors.green}The error "${error.message}" is expected since we used a test order ID.${colors.reset}`);
        console.log(`${colors.green}Your PhonePe credentials are working correctly.${colors.reset}`);
      } else {
        console.log(`${colors.red}✗ Error occurred:${colors.reset} ${error.message}`);
        console.log(`${colors.red}Status Code:${colors.reset} ${error.httpStatusCode || 'N/A'}`);
        console.log(`${colors.red}Error Code:${colors.reset} ${error.code || 'N/A'}`);
      }
    }
  } catch (error) {
    console.log(`${colors.red}✗ Failed to initialize client!${colors.reset}`);
    console.log(`${colors.red}Error:${colors.reset} ${error.message}`);
    
    // Provide advice
    console.log(`\n${colors.yellow}Troubleshooting:${colors.reset}`);
    console.log(`1. Verify your Client ID and Secret are correct`);
    console.log(`2. Ensure you're using the correct environment (SANDBOX or PRODUCTION)`);
    console.log(`3. Check your SDK version is compatible with your account`);
    console.log(`4. Contact PhonePe support with this error message`);
  }
}

// Run the test
testConnection(); 