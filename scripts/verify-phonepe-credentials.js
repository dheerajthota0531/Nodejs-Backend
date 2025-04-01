/**
 * PhonePe Credentials Verification Script
 * This script analyzes your PhonePe credentials to verify they match the environment
 */

const { phonePeConfig, PHONEPE_ENV } = require('../config/phonepe.config');

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

console.log(`${colors.cyan}PhonePe Credentials Verification${colors.reset}`);
console.log(`${colors.yellow}=================================${colors.reset}\n`);

// Display current configuration
console.log(`${colors.blue}Current Configuration:${colors.reset}`);
console.log(`${colors.blue}Client ID:${colors.reset} ${phonePeConfig.clientId}`);
console.log(`${colors.blue}Client Secret:${colors.reset} ${phonePeConfig.clientSecret.substring(0, 4)}...${phonePeConfig.clientSecret.substring(phonePeConfig.clientSecret.length - 4)}`);
console.log(`${colors.blue}Client Version:${colors.reset} ${phonePeConfig.clientVersion}`);
console.log(`${colors.blue}Merchant ID:${colors.reset} ${phonePeConfig.merchantId}`);
console.log(`${colors.blue}Environment:${colors.reset} ${phonePeConfig.environment}\n`);

// Analyze Client ID format
console.log(`${colors.blue}Credential Analysis:${colors.reset}`);

// Check Client ID format against environment
let clientIdFormat = 'UNKNOWN';
let isFormatCorrect = false;

if (phonePeConfig.clientId.startsWith('PGTESTPAYUAT')) {
  clientIdFormat = 'UAT/SANDBOX';
  isFormatCorrect = phonePeConfig.environment === PHONEPE_ENV.SANDBOX;
} else if (phonePeConfig.clientId.startsWith('SU')) {
  clientIdFormat = 'PRODUCTION/LIVE';
  isFormatCorrect = phonePeConfig.environment === PHONEPE_ENV.PRODUCTION;
} else {
  clientIdFormat = 'CUSTOM/UNKNOWN';
}

console.log(`${colors.blue}Client ID Format:${colors.reset} ${clientIdFormat}`);
console.log(`${colors.blue}Current Environment:${colors.reset} ${phonePeConfig.environment}`);

if (!isFormatCorrect && clientIdFormat !== 'CUSTOM/UNKNOWN') {
  console.log(`${colors.red}WARNING: Client ID format doesn't match configured environment!${colors.reset}`);
  console.log(`${colors.red}Your Client ID appears to be for ${clientIdFormat} but you're using ${phonePeConfig.environment} environment${colors.reset}\n`);
  
  if (clientIdFormat === 'UAT/SANDBOX') {
    console.log(`${colors.yellow}Recommendation: Change environment to SANDBOX${colors.reset}`);
    console.log(`Update your .env file: PHONEPE_ENVIRONMENT=SANDBOX\n`);
  } else {
    console.log(`${colors.yellow}Recommendation: Change environment to PRODUCTION${colors.reset}`);
    console.log(`Update your .env file: PHONEPE_ENVIRONMENT=PRODUCTION\n`);
  }
} else if (clientIdFormat === 'CUSTOM/UNKNOWN') {
  console.log(`${colors.yellow}NOTE: Your Client ID has a non-standard format${colors.reset}`);
  console.log(`Verify with PhonePe that this is correct for your account\n`);
} else {
  console.log(`${colors.green}✓ Client ID format matches configured environment${colors.reset}\n`);
}

// Check Client Secret format
if (phonePeConfig.clientSecret.length < 20) {
  console.log(`${colors.red}WARNING: Client Secret seems too short!${colors.reset}`);
  console.log(`Most PhonePe client secrets are 32+ characters\n`);
} else {
  console.log(`${colors.green}✓ Client Secret length looks good${colors.reset}\n`);
}

// Environment specific recommendations
console.log(`${colors.magenta}Environment-Specific Information:${colors.reset}`);

if (phonePeConfig.environment === PHONEPE_ENV.SANDBOX) {
  console.log(`${colors.yellow}SANDBOX Environment Notes:${colors.reset}`);
  console.log(`1. Sandbox environments require explicit activation by PhonePe`);
  console.log(`2. Even in Sandbox, domains need to be whitelisted (localhost:3000, localhost:3001)`);
  console.log(`3. Typical UAT Client IDs start with "PGTESTPAYUAT", not "SU"`);
  console.log(`4. Contact PhonePe to confirm your Sandbox credentials are active\n`);
} else {
  console.log(`${colors.yellow}PRODUCTION Environment Notes:${colors.reset}`);
  console.log(`1. Production credentials should NOT be used for testing`);
  console.log(`2. All domains must be whitelisted by PhonePe before use`);
  console.log(`3. Production transactions will involve real money`);
  console.log(`4. Ensure your account is fully activated for live payments\n`);
}

// Recommendation
console.log(`${colors.magenta}Recommendation:${colors.reset}`);

if (phonePeConfig.clientId.startsWith('SU') && phonePeConfig.environment === PHONEPE_ENV.SANDBOX) {
  console.log(`${colors.yellow}It appears you're using PRODUCTION credentials with SANDBOX environment.${colors.reset}`);
  console.log(`${colors.yellow}This is likely causing the authentication failures.${colors.reset}\n`);
  
  console.log(`${colors.green}Options:${colors.reset}`);
  console.log(`1. Switch to PRODUCTION environment to match your credentials:`);
  console.log(`   Update your .env file: PHONEPE_ENVIRONMENT=PRODUCTION`);
  console.log(`2. OR request proper SANDBOX credentials from PhonePe`);
  console.log(`   Typical format: PGTESTPAYUAT...\n`);
} else if (!isFormatCorrect) {
  console.log(`${colors.yellow}Align your environment with your credentials${colors.reset}\n`);
} else {
  console.log(`${colors.green}Your configuration appears correct.${colors.reset}`);
  console.log(`If you're still having issues, contact PhonePe support.\n`);
}

console.log(`${colors.cyan}Next Steps:${colors.reset}`);
console.log(`1. Make any recommended changes to your configuration`);
console.log(`2. Run the test script: node scripts/test-phonepe-connection.js`);
console.log(`3. Contact PhonePe support if issues persist\n`); 