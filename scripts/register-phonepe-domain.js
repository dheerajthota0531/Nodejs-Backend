/**
 * PhonePe Domain Registration Guide
 * This script provides guidance on registering your domain with PhonePe
 */

const { phonePeConfig } = require('../config/phonepe.config');
const url = require('url');

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

// Calculate URLs for PhonePe configuration
const backendDomain = phonePeConfig.merchantDomain;
const frontendDomain = phonePeConfig.frontendDomain;
const callbackUrl = url.resolve(backendDomain, phonePeConfig.callbackUrl);
const redirectUrl = url.resolve(backendDomain, phonePeConfig.redirectUrl);

console.log(`${colors.cyan}PhonePe Domain Registration Guide${colors.reset}`);
console.log(`${colors.yellow}====================================${colors.reset}\n`);

console.log(`${colors.green}Your current PhonePe configuration:${colors.reset}`);
console.log(`${colors.blue}Backend API Domain:${colors.reset} ${backendDomain}`);
console.log(`${colors.blue}Frontend Domain:${colors.reset} ${frontendDomain}`);
console.log(`${colors.blue}Callback URL:${colors.reset} ${callbackUrl}`);
console.log(`${colors.blue}Redirect URL:${colors.reset} ${redirectUrl}\n`);

console.log(`${colors.magenta}Follow these steps to register your domain with PhonePe:${colors.reset}\n`);

console.log(`${colors.yellow}Step 1:${colors.reset} Log in to your PhonePe merchant dashboard`);
console.log(`        URL: https://dashboard.phonepe.com/\n`);

console.log(`${colors.yellow}Step 2:${colors.reset} Navigate to "Integration" → "API Keys & Domains"`);
console.log(`        This section manages your authorized domains\n`);

console.log(`${colors.yellow}Step 3:${colors.reset} Add the following domains and URLs:`);
console.log(`        - ${colors.green}Backend API Domain:${colors.reset} ${backendDomain}`);
console.log(`        - ${colors.green}Frontend Domain:${colors.reset} ${frontendDomain}`);
console.log(`        - ${colors.green}Callback URL:${colors.reset} ${callbackUrl}`);
console.log(`        - ${colors.green}Redirect URL:${colors.reset} ${redirectUrl}\n`);

console.log(`${colors.yellow}Step 4:${colors.reset} For CORS configuration in PhonePe, add both domains:`);
console.log(`        - ${colors.green}Backend:${colors.reset} ${backendDomain.split('://')[1]}`);
console.log(`        - ${colors.green}Frontend:${colors.reset} ${frontendDomain.split('://')[1]}\n`);

console.log(`${colors.yellow}Step 5:${colors.reset} For localhost testing`);
console.log(`        Make sure "localhost" is explicitly allowed with both ports:`);
console.log(`        - ${colors.green}Backend port:${colors.reset} ${backendDomain.split(':')[2] || '80'}`);
console.log(`        - ${colors.green}Frontend port:${colors.reset} ${frontendDomain.split(':')[2] || '80'}\n`);

console.log(`${colors.yellow}Step 6:${colors.reset} Save your changes and wait for approval`);
console.log(`        Some changes may require PhonePe approval\n`);

console.log(`${colors.yellow}Step 7:${colors.reset} Test your integration`);
console.log(`        Run: node scripts/test-phonepe-connection.js\n`);

console.log(`${colors.yellow}Step 8:${colors.reset} For production`);
console.log(`        Update your .env file with production domains:`);
console.log(`        MERCHANT_DOMAIN=https://api.yourdomain.com`);
console.log(`        FRONTEND_DOMAIN=https://www.yourdomain.com\n`);

console.log(`${colors.magenta}Important Notes:${colors.reset}`);
console.log(`- Both domains must be registered with PhonePe`);
console.log(`- Domain changes can take up to 24 hours to propagate`);
console.log(`- Always test after making changes`);
console.log(`- Keep your credentials secure and never share them publicly\n`);

console.log(`${colors.green}Good luck with your PhonePe integration!${colors.reset}`); 